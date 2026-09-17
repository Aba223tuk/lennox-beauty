/* Lennox Beauty — theme behaviour.

   Everything the ported Shopify theme did with its own JS bundle, rewritten as one
   small self-contained file: sticky-on-scroll-up header, mobile drawer, media
   gallery with thumbnails and dots, the bundle & save picker, the sticky add to
   cart, review rail dots, shipping checkpoint dates and scroll reveals.

   No dependencies and no build step, same as cart.js and chatbot.js. Every block
   is optional — a page only gets the behaviour for the markup it actually has. */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------- header */
  function header() {
    var el = $('.site-header');
    if (!el) return;

    // Keep --header-h honest so the sticky buy column lines up under the bar.
    function measure() {
      document.documentElement.style.setProperty('--header-h', el.offsetHeight + 'px');
    }
    measure();
    window.addEventListener('resize', measure);

    var last = window.scrollY, ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        // Only hide once past the ticker, and never while a drawer is open.
        var down = y > last && y > 120;
        if (!document.body.classList.contains('drawer-open')) {
          el.classList.toggle('is-hidden', down);
        }
        last = y;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------------- mobile drawer */
  function drawer() {
    var btn = $('.burger'), panel = $('.site-drawer');
    if (!btn || !panel) return;

    function set(open) {
      btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.classList.toggle('is-open', open);
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.classList.toggle('drawer-open', open);
    }
    btn.addEventListener('click', function () { set(!panel.classList.contains('is-open')); });
    $$('a', panel).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }

  /* ---------------------------------------------------------- media gallery */
  function gallery() {
    $$('[data-gallery]').forEach(function (root) {
      var slides = $('.gallery__slides', root);
      if (!slides) return;
      var items  = $$('.gallery__slide', slides);
      var thumbs = $$('.gallery__thumb', root);
      var dots   = $$('.gallery__dot', root);
      var prev   = $('.gallery__arrow--prev', root);
      var next   = $('.gallery__arrow--next', root);
      var index  = 0;

      function go(i, smooth) {
        index = Math.max(0, Math.min(items.length - 1, i));
        slides.scrollTo({ left: items[index].offsetLeft - slides.offsetLeft, behavior: smooth === false ? 'auto' : 'smooth' });
        paint();
      }
      function paint() {
        thumbs.forEach(function (t, i) { t.classList.toggle('is-active', i === index); });
        dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
        // Pause any video that scrolled out of view rather than leaving it playing
        // behind a still — the serum gallery mixes the two.
        items.forEach(function (s, i) {
          var v = s.querySelector('video');
          if (!v) return;
          if (i === index) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          else v.pause();
        });
      }

      slides.addEventListener('scroll', function () {
        var mid = slides.scrollLeft + slides.clientWidth / 2;
        var closest = 0, best = Infinity;
        items.forEach(function (s, i) {
          var c = s.offsetLeft - slides.offsetLeft + s.offsetWidth / 2;
          var d = Math.abs(c - mid);
          if (d < best) { best = d; closest = i; }
        });
        if (closest !== index) { index = closest; paint(); }
      }, { passive: true });

      thumbs.forEach(function (t, i) { t.addEventListener('click', function () { go(i); }); });
      dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
      if (prev) prev.addEventListener('click', function () { go(index - 1); });
      if (next) next.addEventListener('click', function () { go(index + 1); });
      paint();
    });
  }

  /* ---------------------------------------------------------- bundle & save
     The picker only owns the selection. What gets added to the cart and what the
     buttons say stays with the page, which knows its own variants — dispatched as
     a 'break:change' event carrying the chosen option's dataset. */
  function breaks() {
    $$('[data-breaks]').forEach(function (root) {
      var opts = $$('.break', root);

      function select(label, silent) {
        opts.forEach(function (o) {
          var on = o === label;
          o.classList.toggle('is-selected', on);
          var input = o.querySelector('input');
          if (input) input.checked = on;
        });
        if (!silent) {
          root.dispatchEvent(new CustomEvent('break:change', { bubbles: true, detail: label.dataset }));
        }
      }

      opts.forEach(function (o) {
        o.addEventListener('click', function () { select(o); });
        o.addEventListener('keydown', function (e) {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); select(o); }
        });
      });

      var pre = opts.filter(function (o) { return o.dataset.preselected === 'true'; })[0] || opts[0];
      if (pre) select(pre, true);
    });
  }

  /* ---------------------------------------------------------- sticky add to cart */
  function stickyAtc() {
    var bar = $('.sticky-atc');
    if (!bar) return;
    document.body.classList.add('has-sticky-atc');

    // "after_scroll" in the theme: show it once the main buy button has gone by.
    var anchor = $('[data-atc-anchor]') || $('.product__info');
    if (!anchor || !('IntersectionObserver' in window)) { bar.classList.add('is-visible'); return; }

    /* Showing and hiding the bar is all this does. Getting the chatbot launcher out
       of its way is chatbot.js's job — it owns --lcb-lift, sets it on its own root,
       and measures the bar off its bounding rect. Writing that property from here too
       looked like it worked and did not: the widget's own value wins, so the launcher
       stayed sitting on top of Add to cart. */
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var past = e.boundingClientRect.top < 0 && !e.isIntersecting;
        bar.classList.toggle('is-visible', past);
      });
    }, { threshold: 0 }).observe(anchor);
  }

  /* ---------------------------------------------------------- review rail dots */
  function rails() {
    $$('[data-rail]').forEach(function (root) {
      var rail = $('.reviews__rail', root);
      var dots = $$('.reviews__dot', root);
      if (!rail || !dots.length) return;
      var cards = $$('.review-card', rail);

      rail.addEventListener('scroll', function () {
        var mid = rail.scrollLeft + rail.clientWidth / 2;
        var closest = 0, best = Infinity;
        cards.forEach(function (c, i) {
          var center = c.offsetLeft - rail.offsetLeft + c.offsetWidth / 2;
          var d = Math.abs(center - mid);
          if (d < best) { best = d; closest = i; }
        });
        dots.forEach(function (d, i) { d.classList.toggle('is-active', i === closest); });
      }, { passive: true });

      dots.forEach(function (d, i) {
        d.addEventListener('click', function () {
          if (!cards[i]) return;
          rail.scrollTo({ left: cards[i].offsetLeft - rail.offsetLeft, behavior: 'smooth' });
        });
      });
    });
  }

  /* ---------------------------------------------------------- shipping checkpoints
     Dates are rendered from today so the timeline never shows a stale week.
     data-min / data-max are business-day offsets, matching the theme's block. */
  function checkpoints() {
    var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
    function fmt(d) { return MON[d.getMonth()] + ' ' + d.getDate(); }

    $$('[data-checkpoint]').forEach(function (el) {
      var now = new Date();
      var min = parseInt(el.dataset.min || '0', 10);
      var max = parseInt(el.dataset.max || '0', 10);
      var a = addDays(now, min), b = addDays(now, max);
      el.textContent = (min === max) ? fmt(a) : fmt(a) + ' – ' + fmt(b);
    });
  }

  /* ---------------------------------------------------------- scroll reveal */
  function reveal() {
    var els = $$('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(function (e) { e.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------------------------------------------------------- init */
  function start() {
    header(); drawer(); gallery(); breaks(); stickyAtc(); rails(); checkpoints(); reveal();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Theme = { $: $, $$: $$ };
})();
