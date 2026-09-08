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
     consent:'SUBSCRIBED' is stated explicitly rather than left to default, so the
     record carries real marketing consent and Klaviyo owns the unsubscribe — which
     is the whole reason this does not go through the Storefront API instead. */
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
                attributes: {
                  email: email,
                  subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } }
                }
              }
            }
          },
          relationships: { list: { data: { type: 'list', id: LIST_ID } } }
        }
      })
    });
  }

  function mount(host) {
    host.className = (host.className ? host.className + ' ' : '') + 'lbs';
    host.innerHTML =
      '<h2 class="lbs-h">Two more products are coming.</h2>' +
      '<p class="lbs-p">The Sleek Stick and the Heat Shield are in development. ' +
        'Leave your email and we\'ll tell you the day they land — that\'s all we ' +
        'use it for.</p>' +
      '<form class="lbs-form" novalidate>' +
        '<label class="lbs-hp" aria-hidden="true">' +
          'Leave this empty<input type="text" name="company" tabindex="-1" autocomplete="off">' +
        '</label>' +
        '<label class="lbs-hp" for="lbs-email">Email address</label>' +
        '<input id="lbs-email" type="email" name="email" required ' +
          'autocomplete="email" inputmode="email" placeholder="you@example.com">' +
        '<button type="submit">Keep me posted</button>' +
      '</form>' +
      '<p class="lbs-msg" role="status" aria-live="polite"></p>' +
      '<p class="lbs-fine">No more than a handful of emails a year. Unsubscribe in one click.</p>';

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
          say('You\'re on the list. We\'ll be in touch when they land.', 'ok');
          try { fbq('track', 'Lead', { content_name: 'coming-soon-list' }); } catch (_) {}
          try { gtag('event', 'generate_lead', { method: 'coming_soon_list' }); } catch (_) {}
        })
        .catch(function () {
          btn.disabled = false;
          // Never claim success we cannot verify: if the address did not land,
          // the visitor has to know, or they will wait for an email forever.
          say('That didn\'t go through. Try again, or text us on (929) 670-9555.', 'err');
        });
    });
  }

  function init() {
    var hosts = document.querySelectorAll('[data-lb-signup]');
    if (!hosts.length) return;
    // Not configured, or already subscribed: render nothing at all.
    if (!ENDPOINT || !LIST_ID || done()) return;

    var s = document.createElement('style');
    s.textContent = css();
    document.head.appendChild(s);
    Array.prototype.forEach.call(hosts, mount);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
