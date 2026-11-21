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

  /* ---------------------------------------------------------- video rail
     Tap to play, tap again to pause. preload="none" in the markup, so a phone
     downloads nothing until someone asks; one clip plays at a time. */
  function ugc() {
    var cards = $$('[data-ugc]');
    cards.forEach(function (card) {
      var v = card.querySelector('video');
      if (!v) return;
      function toggle() {
        if (v.paused) {
          cards.forEach(function (c) {
            var o = c.querySelector('video');
            if (o && o !== v && !o.paused) { o.pause(); c.classList.remove('is-playing'); }
          });
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
          card.classList.add('is-playing');
        } else {
          v.pause();
          card.classList.remove('is-playing');
        }
      }
      card.querySelector('.sb-ugc__frame').addEventListener('click', toggle);
    });
  }

  /* ---------------------------------------------------------- mega menus + search
     superbonsai.com's header: "Shop All" and "Bundles" on the left, each opening a
     full-width panel (pitch + ticks + Shop All button left, four product cards right),
     search and cart on the right. Injected here so all 13 pages get it from one place;
     the plain links already in each page's markup stay as the no-JS fallback.
     Bundle prices are the live pack prices (read off Storefront carts 2026-11-20). */
  var PRODUCTS = [
    { url: '/roll-on', name: 'The Smoothing Roll-On', line: 'For the look of bumps after shaving or waxing', price: 'From $34.99', img: '/img/rollon/pack-400.webp', badge: 'New', keys: 'roll on roller ingrown bumps shave shaving wax waxing bikini underarm legs razor acid bha' },
    { url: '/lash-kit', name: 'The Lash Kit', line: 'Lash clusters you apply at home', price: '$24.99', img: '/img/lash/card.webp', keys: 'lash lashes eyelash clusters extensions diy bond seal tweezer' },
    { url: '/nail-drill', name: 'The Nail Drill', line: 'Cordless, up to 35,000 rpm', price: '$49.99', img: '/img/nail/card.webp', keys: 'nail nails drill manicure gel file cordless electric' },
    { url: '/silk-serum', name: 'The Silk Serum', line: 'Smooths flyaways and kills static', price: 'From $24.99', img: '/img/silk/silk-07.webp', keys: 'silk serum hair frizz anti-frizz mist spray flyaways static leave-in keratin' }
  ];
  var BUNDLES = [
    { url: '/roll-on?pack=3', name: 'Roll-On × 3', line: 'Legs, underarms, bikini line', price: '$44.97 · $14.99 each', img: '/img/rollon/bag-400.webp', badge: 'Best value', keys: 'roll on bundle 3 three pack' },
    { url: '/silk-serum?pack=3', name: 'Silk Serum × 3', line: 'Three 100ml bottles', price: '$38.99', img: '/img/silk/silk-09.webp', badge: 'Save $36', keys: 'silk serum bundle 3 three pack' },
    { url: '/lash-kit', name: 'Lash Kit × 2', line: 'Second kit half off', price: '$37.48', img: '/img/lash/card.webp', badge: '2nd half off', keys: 'lash bundle two 2 pack' },
    { url: '/nail-drill', name: 'Nail Drill × 2', line: 'Second drill half off', price: '$74.99', img: '/img/nail/card.webp', badge: '2nd half off', keys: 'nail drill bundle two 2 pack' }
  ];
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

  function card(p) {
    return '<a class="mm-card" href="' + p.url + '">' +
      '<span class="mm-card__media">' + (p.badge ? '<em>' + p.badge + '</em>' : '') +
      '<img src="' + p.img + '" alt="" width="300" height="300" loading="lazy"></span>' +
      '<b>' + p.name + '</b><small>' + p.line + '</small><span class="mm-card__price">' + p.price + '</span></a>';
  }
  function panel(id, title, list) {
    return '<div class="mm-panel" id="' + id + '" hidden><div class="mm-panel__inner">' +
      '<div class="mm-pitch"><h2>' + title + '</h2><ul>' +
      '<li>Free US shipping, tracked</li><li>30-day money-back guarantee</li><li>No subscription</li></ul>' +
      '<a class="sb-btn sb-btn--sand mm-all" href="/catalog">Shop all</a></div>' +
      '<div class="mm-cards">' + list.map(card).join('') + '</div></div></div>';
  }

  function megamenu() {
    var head = $('.site-header');
    var nav = $('.site-nav');
    if (!head || !nav) return;
    nav.innerHTML =
      '<button class="mm-trigger" type="button" aria-expanded="false" aria-controls="mmShop">Shop All' + CHEV + '</button>' +
      '<button class="mm-trigger" type="button" aria-expanded="false" aria-controls="mmBundles">Bundles' + CHEV + '</button>';
    head.insertAdjacentHTML('beforeend',
      panel('mmShop', 'Four Products, <em>Each Built For One Job.</em>', PRODUCTS) +
      panel('mmBundles', 'Take More. <em>Pay Less Each.</em>', BUNDLES));

    var triggers = $$('.mm-trigger', nav), timer;
    function show(t) {
      triggers.forEach(function (o) {
        var on = o === t, p = document.getElementById(o.getAttribute('aria-controls'));
        o.setAttribute('aria-expanded', on); p.hidden = !on;
      });
      head.classList.toggle('mm-open', !!t);
    }
    triggers.forEach(function (t) {
      var p = document.getElementById(t.getAttribute('aria-controls'));
      t.addEventListener('click', function () { show(t.getAttribute('aria-expanded') === 'true' ? null : t); });
      [t, p].forEach(function (el) {
        el.addEventListener('mouseenter', function () {
          if (!window.matchMedia('(hover:hover)').matches) return;
          clearTimeout(timer); show(t);
        });
        el.addEventListener('mouseleave', function () { timer = setTimeout(function () { show(null); }, 160); });
      });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') show(null); });
    document.addEventListener('click', function (e) { if (!head.contains(e.target)) show(null); });

    /* phone drawer: the same two menus as lists */
    var dr = $('#siteDrawer');
    if (dr) {
      var row = function (p) {
        return '<a class="dr-row" href="' + p.url + '"><img src="' + p.img + '" alt="" width="56" height="56" loading="lazy">' +
          '<span><b>' + p.name + '</b><small>' + p.price + '</small></span></a>';
      };
      var foot = $('.drawer-foot', dr);
      dr.innerHTML = '<p class="dr-h">Shop All</p>' + PRODUCTS.map(row).join('') +
        '<p class="dr-h">Bundles</p>' + BUNDLES.map(row).join('') +
        '<div class="dr-links"><a href="/catalog">Shop all</a><a href="/about">About</a><a href="/contact">Contact</a></div>';
      if (foot) dr.appendChild(foot);
    }
  }

  function search() {
    var right = $('.site-header__right');
    if (!right) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'sr-btn'; b.setAttribute('aria-label', 'Search products');
    b.innerHTML = SEARCH;
    right.insertBefore(b, right.firstChild);

    var wrap = document.createElement('div');
    wrap.className = 'sr'; wrap.hidden = true;
    wrap.innerHTML = '<div class="sr__back"></div><div class="sr__box" role="dialog" aria-label="Search">' +
      '<label class="sr__field">' + SEARCH + '<input type="search" placeholder="Search products" autocomplete="off" aria-label="Search products">' +
      '<button type="button" class="sr__x" aria-label="Close search">&#10005;</button></label><div class="sr__list"></div></div>';
    document.body.appendChild(wrap);
    var input = $('input', wrap), list = $('.sr__list', wrap);
    var all = PRODUCTS.concat(BUNDLES);

    function render() {
      var q = input.value.trim().toLowerCase();
      var hits = q ? all.filter(function (p) {
        var hay = (p.name + ' ' + p.line + ' ' + p.keys).toLowerCase();
        return q.split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
      }) : [];
      list.innerHTML = !q ? '' : hits.length ? hits.map(function (p) {
        return '<a class="sr__hit" href="' + p.url + '"><img src="' + p.img + '" alt="" width="48" height="48" loading="lazy">' +
          '<span><b>' + p.name + '</b><small>' + p.price + '</small></span></a>';
      }).join('') : '<p class="sr__none">No products match “' + input.value.replace(/[<>&"]/g, '') + '”.</p>';
    }
    function open() { wrap.hidden = false; document.body.classList.add('sr-lock'); setTimeout(function () { input.focus(); }, 30); }
    function close() { wrap.hidden = true; document.body.classList.remove('sr-lock'); input.value = ''; render(); b.focus(); }
    b.addEventListener('click', open);
    input.addEventListener('input', render);
    $('.sr__x', wrap).addEventListener('click', close);
    $('.sr__back', wrap).addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !wrap.hidden) close(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var h = $('.sr__hit', list); if (h) location.href = h.getAttribute('href'); }
    });
  }

  /* ?pack=N from the Bundles menu preselects that pack on the product page. */
  function packParam() {
    var n;
    try { n = new URLSearchParams(location.search).get('pack'); } catch (e) { return; }
    if (!n || !/^\d$/.test(n)) return;
    var btn = $('.pack[data-pack="' + n + '"]');
    if (btn) { btn.click(); return; }
    var br = $('.break[data-qty="' + n + '"]');
    if (br) br.click();
  }

  /* ---------------------------------------------------------- init */
  function start() {
    megamenu(); search();
    header(); drawer(); gallery(); breaks(); stickyAtc(); rails(); checkpoints(); reveal(); ugc();
    packParam();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Theme = { $: $, $$: $$ };
})();
