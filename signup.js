/* Email capture — Lennox Beauty
   ============================================================================
   Self-injecting, like cart.js: a page needs one <div data-lb-signup></div> and
   this script tag. No per-page markup, no per-page CSS.

   WHY THIS IS NOT WIRED TO SHOPIFY
   The store is headless — shop.lennoxbeauty.com/contact 404s and POSTs to it get
   a Cloudflare challenge, so the classic Shopify newsletter form endpoint does
   not exist here. The Storefront API has no subscribe mutation, and the token in
   cart.js is storefront-scoped, so it cannot write a customer.

   cartBuyerIdentityUpdate DOES accept an email with that same public token, and
   it is tempting. It is deliberately not used: it attaches an email to a cart for
   abandoned-checkout recovery, which is not marketing consent. Someone typing
   their address into a box that says "we'll email you when it lands" has not
   agreed to that, and recording it as though they had is the kind of thing this
   business does not do.

   It posts to Klaviyo instead, whose client endpoint is built for static pages and
   which owns consent and unsubscribe properly. Until it is configured the form does
   not render at all. That is on purpose — a form that looks like it works and
   silently drops addresses is worse than no form, because the visitor believes they
   are on the list and is never told otherwise.

   TO TURN IT ON: fill in PUBLIC_KEY and LIST_ID below. Nothing else changes. */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------------
     CONFIG — the only two lines that need editing to go live.

       PUBLIC_KEY  Klaviyo > Settings > API keys > Public API key / Site ID.
                   Six characters. Public by design: it can only create
                   subscriptions, so it is safe in a static page.
       LIST_ID     Klaviyo > Lists & segments > (your list) > Settings.

     Both blank means the form does not render at all. See the header comment.
     --------------------------------------------------------------------------- */
  var PUBLIC_KEY = 'R9Upbr';
  var LIST_ID = 'SjUu7D';

  var ENDPOINT = PUBLIC_KEY
    ? 'https://a.klaviyo.com/client/subscriptions/?company_id=' + encodeURIComponent(PUBLIC_KEY)
    : null;

  var KEY = 'lb_subscribed';

  /* Someone who has already given us their address should not be asked again on
     every page for the rest of their life. Private windows throw on localStorage,
     so every access is wrapped — same as cart.js. */
  function done() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function markDone() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }

  /* Deliberately loose. Strict RFC-5322 matching rejects real addresses, and the
     only thing worth catching here is an obvious typo before a round trip. */
  function looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }

  function css() {
    return '' +
    /* All three footers centre their text, so the block centres too and every
       max-width child gets auto side margins — otherwise the form hugs the left
       edge under centred headings. */
    '.lbs{border-top:1px solid var(--line,#e7e2d9);margin-top:2.5rem;padding:2rem 0 .5rem;text-align:center}' +
    '.lbs-h{font-family:var(--serif,Georgia,serif);font-size:1.15rem;font-weight:600;' +
      'color:var(--ink,#2b2620);margin:0 0 .4rem}' +
    '.lbs-p{font-size:.88rem;line-height:1.55;color:var(--ink-soft,#6b645a);' +
      'margin:0 auto .9rem;max-width:44ch}' +
    '.lbs-form{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;' +
      'max-width:26rem;margin:0 auto}' +
    '.lbs-form input{flex:1 1 12rem;min-width:0;font:inherit;font-size:.92rem;' +
      'padding:.7rem .85rem;border:1px solid var(--line,#e7e2d9);border-radius:999px;' +
      'background:#fff;color:var(--ink,#2b2620)}' +
    '.lbs-form input:focus{outline:2px solid var(--accent,#8b6f47);outline-offset:1px;border-color:transparent}' +
    '.lbs-form button{flex:0 0 auto;font:inherit;font-size:.9rem;font-weight:600;cursor:pointer;' +
      'padding:.7rem 1.3rem;border-radius:999px;border:1.5px solid var(--accent,#8b6f47);' +
      'background:var(--accent,#8b6f47);color:#fff;transition:opacity .15s ease}' +
    '.lbs-form button:hover{opacity:.88}' +
    '.lbs-form button[disabled]{opacity:.55;cursor:default}' +
    /* role="status" already announces this; it needs to be visible too. */
    '.lbs-msg{font-size:.84rem;line-height:1.5;margin:.65rem 0 0;min-height:1.2em}' +
    '.lbs-msg.err{color:#a4442f}' +
    '.lbs-msg.ok{color:var(--ink,#2b2620)}' +
    '.lbs-fine{font-size:.74rem;line-height:1.5;color:var(--ink-faint,#6b655c);' +
      'margin:.55rem auto 0;max-width:44ch}' +
    /* The honeypot must be reachable by nothing: not the eye, not the tab order,
       not a screen reader. display:none alone is what naive bots check for. */
    '.lbs-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}';
  }

  /* Klaviyo's client-side subscribe endpoint. 202 with an empty body on success.

     Do NOT add a `subscriptions` block to profile.attributes here. It looks like the
     right way to state consent and it is what the server-side profile API takes, but
     this endpoint rejects it outright:
       400 "'subscriptions' is not a valid field for the resource 'profile'"
     Subscribing IS what /client/subscriptions/ does, so consent is carried by the
     endpoint itself and Klaviyo owns the unsubscribe — which is the whole reason this
     does not go through the Storefront API instead. */
  function send(email) {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', revision: '2024-10-15' },
      body: JSON.stringify({
        data: {
          type: 'subscription',
          attributes: {
            custom_source: 'Site footer — coming soon list',
            profile: {
              data: {
                type: 'profile',
                attributes: { email: email }
              }
            }
          },
          relationships: { list: { data: { type: 'list', id: LIST_ID } } }
        }
      })
    });
  }

  /* Per-host copy. A page that wants its own offer sets data-heading / data-body /
     data-cta / data-fine / data-lead on the host div; anything unset falls back to the
     site-wide coming-soon copy below. Only the words are overridable — consent, the
     honeypot, the Klaviyo list and the never-claim-a-success-we-cannot-verify rule are
     shared and stay shared. */
  function copy(host, name, fallback) {
    var v = host.getAttribute('data-' + name);
    return v === null || v === '' ? fallback : v;
  }

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return ESCAPES[c]; });
  }

  function mount(host) {
    var lead = copy(host, 'lead', 'coming-soon-list');
    host.className = (host.className ? host.className + ' ' : '') + 'lbs';
    host.innerHTML =
      '<h2 class="lbs-h">' + esc(copy(host, 'heading', 'Two more products are coming.')) + '</h2>' +
      '<p class="lbs-p">' + esc(copy(host, 'body',
        'The Sleek Stick and the Heat Shield are in development. Leave your email and ' +
        'we\'ll tell you the day they land — that\'s all we use it for.')) + '</p>' +
      '<form class="lbs-form" novalidate>' +
        '<label class="lbs-hp" aria-hidden="true">' +
          'Leave this empty<input type="text" name="company" tabindex="-1" autocomplete="off">' +
        '</label>' +
        '<label class="lbs-hp" for="lbs-email">Email address</label>' +
        '<input id="lbs-email" type="email" name="email" required ' +
          'autocomplete="email" inputmode="email" placeholder="you@example.com">' +
        '<button type="submit">' + esc(copy(host, 'cta', 'Keep me posted')) + '</button>' +
      '</form>' +
      '<p class="lbs-msg" role="status" aria-live="polite"></p>' +
      '<p class="lbs-fine">' + esc(copy(host, 'fine',
        'No more than a handful of emails a year. Unsubscribe in one click.')) + '</p>';

    var form = host.querySelector('form');
    var input = host.querySelector('#lbs-email');
    var btn = host.querySelector('button');
    var msg = host.querySelector('.lbs-msg');
    var hp = host.querySelector('input[name="company"]');

    function say(text, kind) {
      msg.textContent = text;
      msg.className = 'lbs-msg' + (kind ? ' ' + kind : '');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (hp.value) return;              // bot filled the honeypot; drop it silently
      var email = input.value.trim();
      if (!looksLikeEmail(email)) { say('That doesn\'t look like an email address.', 'err'); input.focus(); return; }

      btn.disabled = true;
      say('Adding you…');

      send(email)
        .then(function (r) {
          // Klaviyo returns 202 with an empty body on success.
          if (!r.ok && r.status !== 202) throw new Error('http ' + r.status);
          markDone();
          form.remove();
          say(copy(host, 'thanks', 'You\'re on the list. We\'ll be in touch when they land.'), 'ok');
          try { fbq('track', 'Lead', { content_name: lead }); } catch (_) {}
          try { gtag('event', 'generate_lead', { method: lead }); } catch (_) {}
        })
        .catch(function () {
          btn.disabled = false;
          // Never claim success we cannot verify: if the address did not land,
          // the visitor has to know, or they will wait for an email forever.
          say('That didn\'t go through. Try again, or text us on (929) 670-9555.', 'err');
        });
    });
  }

  /* ---------------------------------------------------------------------------
     SECOND CHANCE — one modal, once per visitor, never shown to a buyer.

     Desktop gets real exit intent: the pointer leaving through the top of the
     window. Touch has no equivalent signal, and the usual mobile substitute —
     firing on a fast upward flick — goes off when somebody reaches for the address
     bar, which reads as a trap and is worse than showing nothing. Mobile gets depth
     instead: 70% of the page, which at least means they read it.

     Suppressed outright when a cart exists (cart.js writes lb_cart_id). Interrupting
     somebody who has already added the kit can only cost the sale.
     --------------------------------------------------------------------------- */
  var SEEN = 'lb_exit_seen';
  function seen() { try { return localStorage.getItem(SEEN) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN, '1'); } catch (e) {} }
  function hasCart() { try { return !!localStorage.getItem('lb_cart_id'); } catch (e) { return false; } }

  function modalCss() {
    return '' +
    '.lbx{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;' +
      'padding:1.2rem;background:rgba(24,20,16,.55);opacity:0;transition:opacity .18s ease}' +
    '.lbx.is-open{opacity:1}' +
    '.lbx__box{position:relative;width:100%;max-width:30rem;background:var(--bg,#fbf8f3);' +
      'border-radius:14px;padding:1.6rem 1.3rem 1.1rem;box-shadow:0 24px 60px rgba(0,0,0,.28);' +
      'transform:translateY(8px);transition:transform .18s ease}' +
    '.lbx.is-open .lbx__box{transform:none}' +
    '.lbx__x{position:absolute;top:.45rem;right:.55rem;width:2rem;height:2rem;border:0;' +
      'background:none;font-size:1.4rem;line-height:1;cursor:pointer;color:var(--ink-soft,#6b645a)}' +
    '.lbx .lbs{border-top:0;margin-top:0;padding:0}' +
    '@media (prefers-reduced-motion:reduce){.lbx,.lbx__box{transition:none}}';
  }

  function armExit(host) {
    if (seen() || hasCart()) return;

    var wrap = document.createElement('div');
    wrap.className = 'lbx';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', host.getAttribute('data-heading') || 'Before you go');
    wrap.innerHTML = '<div class="lbx__box">' +
      '<button class="lbx__x" type="button" aria-label="Close">&times;</button>' +
      '<div class="lbx__body"></div></div>';

    var opened = false, lastFocus = null;

    function close() {
      wrap.classList.remove('is-open');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 200);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    function open() {
      if (opened || done() || hasCart()) return;
      opened = true;
      markSeen();
      lastFocus = document.activeElement;
      host.hidden = false;
      wrap.querySelector('.lbx__body').appendChild(host);
      mount(host);
      document.body.appendChild(wrap);
      // Next frame, so the opacity transition has a start value to move from.
      requestAnimationFrame(function () { wrap.classList.add('is-open'); });
      var input = host.querySelector('input[type="email"]');
      if (input) input.focus();
      document.addEventListener('keydown', onKey);
      wrap.querySelector('.lbx__x').addEventListener('click', close);
      wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    }

    var fine = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    if (fine) {
      document.addEventListener('mouseout', function (e) {
        if (!e.relatedTarget && e.clientY <= 0) open();
      });
    } else {
      window.addEventListener('scroll', function () {
        var h = document.documentElement;
        var depth = (h.scrollTop + window.innerHeight) / h.scrollHeight;
        if (depth >= 0.7) open();
      }, { passive: true });
    }
  }

  function init() {
    var hosts = document.querySelectorAll('[data-lb-signup]');
    var exit = document.querySelector('[data-lb-exit]');
    if (!hosts.length && !exit) return;
    // Not configured, or already subscribed: render nothing at all.
    if (!ENDPOINT || !LIST_ID || done()) return;

    var s = document.createElement('style');
    s.textContent = css() + modalCss();
    document.head.appendChild(s);
    Array.prototype.forEach.call(hosts, mount);
    if (exit) armExit(exit);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
