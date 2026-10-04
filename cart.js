/* Lennox Beauty cart — self-contained, no dependencies, no build step.
   Drop-in: <script src="cart.js" defer></script>

   Replaces the old flow, where every "Add to cart" built a throwaway Shopify cart
   and redirected straight to checkout. Nobody could add two things, change their
   mind about a quantity, or leave and come back. Now the Shopify cart id lives in
   localStorage and the same cart is reused across pages and visits.

   Everything is injected — the header button and the drawer — so a page only needs
   this script tag and a call to Cart.add(variantId, qty). No per-page markup.

   The pricing shown here is whatever Shopify returns for the cart, never anything
   this file works out. That matters wherever an automatic Shopify discount is in
   play: the rounding is Shopify's and it does not always match the arithmetic a
   page would do. Reading totals back off the cart is the only way the drawer and
   the checkout can't disagree. */
(function () {
  'use strict';

  var API = 'https://90uhee-je.myshopify.com/api/2024-07/graphql.json';
  var TOKEN = 'c733224a494da57cec069f47ad128634';
  var KEY = 'lb_cart_id';

  var cart = null;      // last cart payload from Shopify
  var busy = false;
  var root, drawer, badge;

  /* ---------- storage (private windows and blocked cookies both throw) ---------- */
  function getId() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setId(v) {
    try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {}
  }

  /* ---------- api ---------- */
  var CART_FIELDS = [
    'id checkoutUrl totalQuantity',
    'cost{ subtotalAmount{amount currencyCode} totalAmount{amount} }',
    'lines(first:50){edges{node{ id quantity',
    '  cost{ subtotalAmount{amount} totalAmount{amount} }',
    '  merchandise{ ...on ProductVariant { id title price{amount}',
    '    image{ url(transform:{maxWidth:160,maxHeight:160}) }',
    // A variant with no image of its own is an ordinary Shopify state, not a fault:
    // only the serum's variants carry per-variant art. Ask for the product's
    // featured image too so the drawer has something to fall back to.
    '    product{ title featuredImage{ url(transform:{maxWidth:160,maxHeight:160}) } } } } }}}'
  ].join(' ');

  /* Last resort, for merchandise Shopify has no art for at all — no variant image,
     no featured image, an empty images collection — which renders the cart line as a
     bare grey box. Keyed by variant id and served from this site. The chain below
     prefers Shopify's own art whenever it exists, so a stale entry here is inert
     rather than wrong.

     Uploading the media is the real fix, not this map: Shopify's own checkout and
     Shop Pay pages read their thumbnail from the product's media, and nothing here
     can reach them. A new product with no images needs both. */
  var LOCAL_IMG = {};

  function lineImage(m) {
    return (m.image && m.image.url) ||
           (m.product && m.product.featuredImage && m.product.featuredImage.url) ||
           LOCAL_IMG[m.id] || '';
  }

  /* In-drawer offers, 2026-10-04. Each price is a live Shopify automatic discount,
     read back off real Storefront carts the same day:
       2 kits 37.48 (+12.49) · 2 drills 74.99 (+25.00) · serum with one kit/drill +12.50
     The serum half price does NOT stack with a two-of discount (2 kits + serum = 62.47),
     so the two kinds of offer never show together with a price that would be wrong:
     the "second one" offer hides once a serum is in the cart, and the serum offer
     hides once any line is at two. Turn a discount off in Shopify and its row here
     becomes a lie — change both together. */
  var LASH  = ['52609395425496', '52609395458264'];
  var DRILL = ['52527986082008', '52527986049240', '52527986016472'];
  var SERUM = ['52304320856280', '52304320921816', '52304320889048'];
  var SERUM_ONE = 'gid://shopify/ProductVariant/52304320856280';
  function vid(gid) { return String(gid).split('/').pop(); }

  function offers(lines) {
    var q = { lash: 0, drill: 0, serum: 0 }, first = {};
    lines.forEach(function (e) {
      var v = vid(e.node.merchandise.id);
      var k = LASH.indexOf(v) > -1 ? 'lash' : DRILL.indexOf(v) > -1 ? 'drill' : SERUM.indexOf(v) > -1 ? 'serum' : null;
      if (!k) return;
      q[k] += e.node.quantity;
      if (!first[k]) first[k] = e.node.id;
    });
    var out = [];
    if (!q.serum && q.lash === 1)
      out.push({ act: 'qty', line: first.lash, sku: 'LB-LASH', img: '/img/lash/card.webp',
                 name: 'A second Lash Kit', note: 'Second kit half off', add: 12.49, was: 24.99 });
    if (!q.serum && q.drill === 1)
      out.push({ act: 'qty', line: first.drill, sku: 'LB-NAIL', img: '/img/nail/card.webp',
                 name: 'A second Nail Drill', note: 'Second drill half off', add: 25.00, was: 49.99 });
    if (!q.serum && (q.lash || q.drill) && q.lash < 2 && q.drill < 2)
      out.push({ act: 'add', variant: SERUM_ONE, sku: 'LB-SILK-1', img: '/img/silk/single.webp',
                 name: 'The Silk Serum', note: 'Anti-frizz mist · half price with your order', add: 12.50, was: 24.99 });
    return out.slice(0, 2);
  }

  function api(query, variables) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (r) { return r.json(); });
  }

  function readCart(res, key) {
    var d = res && res.data && res.data[key];
    if (d && d.userErrors && d.userErrors.length) throw new Error(d.userErrors[0].message);
    return d ? d.cart : null;
  }

  /* Pull the stored cart. A cart that has been checked out, or has expired, comes
     back null — drop the id rather than leaving a dead one in storage forever. */
  function hydrate() {
    var id = getId();
    if (!id) return Promise.resolve(null);
    return api('query($id:ID!){ cart(id:$id){ ' + CART_FIELDS + ' } }', { id: id })
      .then(function (res) {
        var c = res && res.data && res.data.cart;
        if (!c) setId(null);
        cart = c;
        return c;
      })
      .catch(function () { return null; });
  }

  /* Accepts either add(variantId, qty) or add([{merchandiseId, quantity}, ...]).
     A page with an order bump needs the second form: both lines have to land in one
     round trip, or the drawer pops open twice. */
  function add(variantId, qty) {
    if (busy) return Promise.resolve();
    busy = true; paint();
    var lines = Array.isArray(variantId)
      ? variantId
      : [{ merchandiseId: variantId, quantity: qty || 1 }];
    var id = getId();
    var p = id
      ? api('mutation($id:ID!,$lines:[CartLineInput!]!){ cartLinesAdd(cartId:$id,lines:$lines){ cart{ ' + CART_FIELDS + ' } userErrors{message} } }', { id: id, lines: lines })
          .then(function (r) { return readCart(r, 'cartLinesAdd'); })
      : Promise.reject(new Error('no cart'));

    return p
      .catch(function () {
        // No cart yet, or the stored one is dead — start a fresh one.
        setId(null);
        return api('mutation($lines:[CartLineInput!]!){ cartCreate(input:{lines:$lines}){ cart{ ' + CART_FIELDS + ' } userErrors{message} } }', { lines: lines })
          .then(function (r) { return readCart(r, 'cartCreate'); });
      })
      .then(function (c) {
        if (!c) throw new Error('cart failed');
        cart = c; setId(c.id);
        justAdded = true;
        busy = false; paint(); open();
        /* No AddToCart fires here. It used to, and every add was therefore counted
           twice: once by the product page before it calls Cart.add, and again here.
           Worse, this one reported cost.subtotalAmount — the whole cart, not the line
           just added — with no content_ids, so a visitor with anything already in
           their cart sent an inflated value for an unidentifiable product.
           The product pages own this event: only they know the sku, the quantity and
           the price of what was actually added. InitiateCheckout stays in this file
           because it genuinely is cart-level and fires from the drawer. */
      })
      .catch(function () {
        /* Used to repaint a closed drawer, so a failed add looked like a dead button.
           Open it: the error line is the only feedback the shopper gets. */
        busy = false; paint(true); open();
      });
  }

  function setQty(lineId, qty) {
    if (busy) return;
    if (qty < 1) return remove(lineId);
    busy = true; paint();
    api('mutation($id:ID!,$lines:[CartLineUpdateInput!]!){ cartLinesUpdate(cartId:$id,lines:$lines){ cart{ ' + CART_FIELDS + ' } userErrors{message} } }',
        { id: getId(), lines: [{ id: lineId, quantity: qty }] })
      .then(function (r) { cart = readCart(r, 'cartLinesUpdate'); busy = false; paint(); })
      .catch(function () { busy = false; paint(true); });
  }

  function remove(lineId) {
    if (busy) return;
    busy = true; paint();
    api('mutation($id:ID!,$ids:[ID!]!){ cartLinesRemove(cartId:$id,lineIds:$ids){ cart{ ' + CART_FIELDS + ' } userErrors{message} } }',
        { id: getId(), ids: [lineId] })
      .then(function (r) { cart = readCart(r, 'cartLinesRemove'); busy = false; paint(); })
      .catch(function () { busy = false; paint(true); });
  }

  /* ---------- ui ---------- */
  var css = [
    '.lbc-btn{position:relative;width:40px;height:40px;flex:none;border:none;background:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center}',
    '.lbc-btn svg{width:21px;height:21px;stroke:#141414;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
    '.lbc-count{position:absolute;top:2px;right:1px;min-width:17px;height:17px;border-radius:999px;background:#8a7357;color:#fff;',
    '  font:600 10px/17px Inter,system-ui,sans-serif;text-align:center;padding:0 4px;display:none}',
    '.lbc-count.on{display:block}',
    '.lbc-back{position:fixed;inset:0;z-index:9995;background:rgba(20,20,20,.4);opacity:0;pointer-events:none;transition:opacity .25s ease}',
    '.lbc-open .lbc-back{opacity:1;pointer-events:auto}',
    '.lbc-panel{position:fixed;top:0;right:0;bottom:0;z-index:9996;width:min(400px,100vw);background:#fff;',
    '  display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:-8px 0 34px rgba(20,20,20,.16)}',
    '.lbc-open .lbc-panel{transform:none}',
    /* Hidden, not just off-screen, while closed: otherwise Tab walks through an
       invisible cart. The delay lets the slide-out finish before it disappears. */
    '.lbc-panel{visibility:hidden;transition:transform .28s cubic-bezier(.4,0,.2,1),visibility 0s linear .28s}',
    '.lbc-open .lbc-panel{visibility:visible;transition:transform .28s cubic-bezier(.4,0,.2,1)}',
    'body.lbc-lock{overflow:hidden}',
    '.lbc-head{display:flex;align-items:center;justify-content:space-between;padding:1.15rem 1.25rem;border-bottom:1px solid #ececec;flex:none}',
    '.lbc-head h2{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.35rem;font-weight:600;margin:0}',
    '.lbc-x:focus:not(:focus-visible){outline:none}',
    '.lbc-x{width:34px;height:34px;border:none;background:none;cursor:pointer;font-size:1.3rem;line-height:1;color:#5c5c5c}',
    '.lbc-body{flex:1;overflow-y:auto;padding:1.1rem 1.25rem;font-family:Inter,system-ui,sans-serif}',
    /* #6b655c, not the old #8f887c: that was 3.5:1 on white and failed AA for
       body text. Literal rather than var(--ink-faint) because this stylesheet is
       injected and must render the same on any page that loads it. */
    '.lbc-empty{text-align:center;color:#6b655c;font-size:.9rem;padding:3rem 1rem}',
    '.lbc-line{display:flex;gap:.85rem;padding:.9rem 0;border-bottom:1px solid #f2efea}',
    '.lbc-line:last-child{border-bottom:0}',
    '.lbc-thumb{width:62px;height:62px;flex:none;border:1px solid #ececec;border-radius:9px;background:#faf9f7;object-fit:contain}',
    '.lbc-info{flex:1;min-width:0}',
    '.lbc-name{font-size:.87rem;font-weight:600;line-height:1.3;color:#141414}',
    '.lbc-var{font-size:.76rem;color:#6b655c;margin-top:.1rem}',
    '.lbc-was{font-size:.76rem;color:#6b655c;text-decoration:line-through;margin-left:.35rem}',
    '.lbc-row{display:flex;align-items:center;justify-content:space-between;margin-top:.55rem;gap:.6rem}',
    '.lbc-qty{display:flex;align-items:center;border:1px solid #ddd7cd;border-radius:999px}',
    '.lbc-qty button{width:29px;height:29px;border:none;background:none;cursor:pointer;font-size:1rem;line-height:1;color:#141414}',
    '.lbc-qty button:disabled{color:#c9c9c9;cursor:default}',
    '.lbc-qty span{min-width:1.5rem;text-align:center;font-size:.83rem;font-weight:600}',
    '.lbc-price{font-size:.87rem;font-weight:600;white-space:nowrap}',
    '.lbc-rm{background:none;border:none;color:#6b655c;font-size:.76rem;cursor:pointer;padding:.3rem 0;text-decoration:underline;text-underline-offset:2px}',
    '.lbc-foot{flex:none;border-top:1px solid #ececec;padding:1.1rem 1.25rem;font-family:Inter,system-ui,sans-serif}',
    '.lbc-sub{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.2rem}',
    '.lbc-sub b{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.5rem;font-weight:700}',
    '.lbc-pre{display:flex;justify-content:space-between;font-size:.82rem;color:#6b655c;margin-bottom:.15rem}',
    '.lbc-pre.save{color:#6f5c42;font-weight:600}',
    '.lbc-note{font-size:.76rem;color:#6b655c;margin:0 0 .85rem}',
    '.lbc-go{display:block;width:100%;text-align:center;background:#8a7357;color:#fff;font-weight:600;font-size:.97rem;',
    '  padding:.95rem;border-radius:999px;border:none;cursor:pointer;font-family:Inter,system-ui,sans-serif;text-decoration:none}',
    '.lbc-go:hover{background:#6f5c42}',
    '.lbc-go[aria-disabled=true]{opacity:.5;pointer-events:none}',
    '.lbc-err{color:#a4372f;font-size:.8rem;margin:.6rem 0 0;text-align:center}',
    '.lbc-busy{opacity:.55;pointer-events:none}',
    /* ---- conversion layer, 2026-10-02. Everything below states a fact the site
       already promises elsewhere (ticker, footer, shipping checkpoints) — free US
       shipping, the 30-day guarantee, tracked delivery, the same 7–13 day window.
       No timer, no stock count, no "people are viewing": none of those are true. */
    '.lbc-head h2 small{font-family:Inter,system-ui,sans-serif;font-size:.78rem;font-weight:500;color:#6b655c;margin-left:.45rem}',
    '.lbc-added{display:none;align-items:center;gap:.5rem;margin:0 0 .6rem;padding:.6rem .8rem;border-radius:10px;background:#f4efe7;color:#6f5c42;font-size:.82rem;font-weight:600}',
    '.lbc-added.on{display:flex}',
    '.lbc-added svg{width:16px;height:16px;flex:none;stroke:currentColor;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}',
    '.lbc-thumb{width:72px;height:72px}',
    '.lbc-pill{display:inline-block;margin-top:.3rem;padding:.12rem .5rem;border-radius:999px;background:#f4efe7;color:#6f5c42;font-size:.7rem;font-weight:600}',
    '.lbc-ship{display:flex;justify-content:space-between;font-size:.82rem;color:#6b655c;margin-bottom:.15rem}',
    '.lbc-ship b{color:#6f5c42;font-weight:600}',
    '.lbc-eta{display:flex;align-items:center;gap:.45rem;font-size:.8rem;color:#141414;margin:.55rem 0 .8rem;padding:.55rem .75rem;border:1px dashed #ddd7cd;border-radius:10px}',
    '.lbc-eta svg{width:18px;height:18px;flex:none;stroke:#8a7357;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}',
    '.lbc-go{display:flex;align-items:center;justify-content:center;gap:.5rem;padding:1.05rem;font-size:1rem;box-shadow:0 6px 18px rgba(138,115,87,.28)}',
    '.lbc-go svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2}',
    '.lbc-pay{display:flex;flex-wrap:wrap;justify-content:center;gap:.3rem;margin:.75rem 0 .2rem}',
    '.lbc-pay img{width:34px;height:22px}',
    '.lbc-trust{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-top:.8rem;text-align:center}',
    '.lbc-trust div{font-size:.68rem;line-height:1.25;color:#6b655c}',
    '.lbc-trust svg{display:block;margin:0 auto .25rem;width:20px;height:20px;stroke:#8a7357;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}',
    '.lbc-more{display:block;width:100%;margin-top:.55rem;background:none;border:none;color:#5c5c5c;font:500 .8rem Inter,system-ui,sans-serif;cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
    '.lbc-empty svg{display:block;margin:0 auto .9rem;width:42px;height:42px;stroke:#c9bfae;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}',
    '.lbc-offers{margin-top:1rem;padding-top:.9rem;border-top:1px solid #f2efea}',
    '.lbc-offers h3{margin:0 0 .6rem;font:600 .72rem Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6b655c}',
    '.lbc-offer{display:flex;align-items:center;gap:.7rem;padding:.6rem;border:1px solid #ece5da;border-radius:12px;background:#faf8f4;margin-bottom:.5rem}',
    '.lbc-offer img{width:48px;height:48px;flex:none;border-radius:8px;object-fit:cover;background:#fff}',
    '.lbc-offer div{flex:1;min-width:0}',
    '.lbc-offer b{display:block;font-size:.84rem;color:#141414}',
    '.lbc-offer small{display:block;font-size:.74rem;color:#6f5c42;margin-top:.1rem}',
    '.lbc-offer s{color:#6b655c;font-size:.74rem;margin-left:.3rem}',
    '.lbc-offer button{flex:none;min-height:36px;padding:0 .9rem;border-radius:999px;border:1.5px solid #8a7357;background:#fff;color:#6f5c42;font:600 .8rem Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}',
    '.lbc-offer button:hover{background:#8a7357;color:#fff}',
    '.lbc-body .lbc-trust{margin-top:1.1rem;padding-top:.9rem;border-top:1px solid #f2efea}',
    '.lbc-empty a{display:inline-block;margin-top:1.1rem;padding:.8rem 1.6rem;border-radius:999px;background:#8a7357;color:#fff;font-weight:600;font-size:.88rem;text-decoration:none}'
  ].join('');

  /* Same window the product pages print in their shipping checkpoints: dispatch 1–2
     days, then 7–13 in transit, so today + 8 to today + 15. It read +7 to +13 until
     2026-10-04, which promised 1–2 days earlier than every written policy on the site.
     Change one, change the other. */
  function eta() {
    var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    function d(n) { var x = new Date(); x.setDate(x.getDate() + n); return MON[x.getMonth()] + ' ' + x.getDate(); }
    return d(8) + ' – ' + d(15);
  }
  var PAY = ['visa','mastercard','amex','discover','apple-pay','google-pay','shop-pay'];
  var justAdded = false;

  function offerHtml(lines) {
    var list = offers(lines);
    if (!list.length) return '';
    return '<div class="lbc-offers"><h3>Complete your order</h3>' + list.map(function (o, i) {
      return '<div class="lbc-offer"><img src="' + o.img + '" alt="" width="48" height="48" loading="lazy">' +
        '<div><b>' + o.name + '</b><small>' + o.note + '</small></div>' +
        '<button type="button" data-offer="' + i + '" aria-label="Add ' + o.name + ' for ' + money(o.add) + '">+ ' + money(o.add) +
        '<s>' + money(o.was) + '</s></button></div>';
    }).join('') + '</div>';
  }

  function money(a) { return '$' + Number(a).toFixed(2); }

  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    root = document.createElement('div');
    root.innerHTML =
      '<div class="lbc-back"></div>' +
      '<aside class="lbc-panel" role="dialog" aria-modal="true" aria-label="Your cart">' +
      '  <div class="lbc-head"><h2>Your cart</h2><button class="lbc-x" type="button" aria-label="Close cart">&#10005;</button></div>' +
      '  <div class="lbc-body"></div>' +
      '  <div class="lbc-foot"></div>' +
      '</aside>';
    document.body.appendChild(root);
    drawer = root.querySelector('.lbc-panel');

    root.querySelector('.lbc-back').addEventListener('click', close);
    root.querySelector('.lbc-x').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    // Header button, injected so no page needs its own markup.
    var header = document.querySelector('header');
    if (header) {
      var b = document.createElement('button');
      b.className = 'lbc-btn'; b.type = 'button'; b.setAttribute('aria-label', 'Open cart');
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"/>' +
                    '<path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><span class="lbc-count"></span>';
      b.addEventListener('click', open);
      /* The theme header puts the cart on the right and the menu on the left, so
         it offers an explicit slot. Older pages have neither and fall back to
         sitting beside the burger. */
      var slot = header.querySelector('#cart-slot');
      var burger = header.querySelector('.burger');
      if (slot) slot.appendChild(b);
      else if (burger) header.insertBefore(b, burger);
      else header.appendChild(b);
      badge = b.querySelector('.lbc-count');
    }
  }

  function paint(failed) {
    if (!root) return;
    var body = root.querySelector('.lbc-body');
    var foot = root.querySelector('.lbc-foot');
    drawer.classList.toggle('lbc-busy', busy);

    var lines = (cart && cart.lines && cart.lines.edges) || [];
    var n = (cart && cart.totalQuantity) || 0;
    if (badge) { badge.textContent = n; badge.classList.toggle('on', n > 0); }
    root.querySelector('.lbc-head h2').innerHTML = 'Your cart' +
      (n ? '<small>' + n + (n === 1 ? ' item' : ' items') + '</small>' : '');

    if (!lines.length) {
      body.innerHTML = '<div class="lbc-empty">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>' +
        'Your cart is empty.<br><a href="/catalog">Shop all products</a></div>';
      foot.innerHTML = failed ? '<p class="lbc-err">Something went wrong. Please try again.</p>' : '';
      return;
    }

    var added = justAdded; justAdded = false;
    body.innerHTML = '<div class="lbc-added' + (added ? ' on' : '') + '" role="status">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>Added to your cart</div>' +
      lines.map(function (e) {
      var l = e.node, m = l.merchandise;
      var full = Number(m.price.amount) * l.quantity;
      var paid = Number(l.cost.totalAmount.amount);
      var img = lineImage(m);
      return '<div class="lbc-line">' +
        (img ? '<img class="lbc-thumb" src="' + img + '" alt="" loading="lazy">' : '<div class="lbc-thumb"></div>') +
        '<div class="lbc-info">' +
          '<div class="lbc-name">' + m.product.title + '</div>' +
          (m.title && m.title !== 'Default Title' ? '<div class="lbc-var">' + m.title + '</div>' : '') +
          (paid < full - 0.005 ? '<span class="lbc-pill">You save ' + money(full - paid) + '</span>' : '') +
          '<div class="lbc-row">' +
            '<div class="lbc-qty">' +
              '<button type="button" data-act="dec" data-id="' + l.id + '" aria-label="Decrease quantity"' + (l.quantity <= 1 ? ' disabled' : '') + '>&minus;</button>' +
              '<span>' + l.quantity + '</span>' +
              '<button type="button" data-act="inc" data-id="' + l.id + '" aria-label="Increase quantity">+</button>' +
            '</div>' +
            '<div class="lbc-price">' + money(paid) +
              (paid < full - 0.005 ? '<span class="lbc-was">' + money(full) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<button class="lbc-rm" type="button" data-act="rm" data-id="' + l.id + '">Remove</button>' +
        '</div></div>';
    }).join('') + offerHtml(lines) +
    '<div class="lbc-trust">' +
      '<div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 6h13v10H1zM14 9h4l3 3v4h-7z"/><circle cx="5.5" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/></svg>Free US shipping</div>' +
      '<div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>30-day money-back guarantee</div>' +
      '<div><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>Secure checkout by Shopify</div>' +
    '</div>';

    body.querySelectorAll('[data-offer]').forEach(function (el) {
      el.addEventListener('click', function () {
        var o = offers(lines)[+el.getAttribute('data-offer')];
        if (!o) return;
        /* The product pages own AddToCart for their own button; an add made here is
           otherwise invisible to Meta and GA4, so this one reports itself. Value is
           what the add actually costs, not the line's full price. */
        try { fbq('track', 'AddToCart', { content_type: 'product', content_ids: [o.sku], num_items: 1, value: o.add, currency: 'USD' }); } catch (e) {}
        try { gtag('event', 'add_to_cart', { currency: 'USD', value: o.add, items: [{ item_id: o.sku, quantity: 1, price: o.add }] }); } catch (e) {}
        if (o.act === 'qty') {
          var line = lines.filter(function (e) { return e.node.id === o.line; })[0];
          setQty(o.line, line.node.quantity + 1);
        } else {
          justAdded = true;
          add(o.variant, 1);
        }
      });
    });

    body.querySelectorAll('[data-act]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-id'), act = el.getAttribute('data-act');
        var line = lines.filter(function (e) { return e.node.id === id; })[0];
        if (!line) return;
        if (act === 'rm') remove(id);
        else setQty(id, line.node.quantity + (act === 'inc' ? 1 : -1));
      });
    });

    /* subtotalAmount is the figure BEFORE order-level discounts. That used to be
       harmless: every discount this store ran was Amount-off-products, which comes off
       the lines, so the subtotal already had it. On 2026-09-15 the kit quantity tiers
       became Amount-off-ORDER discounts — they had to, or they fought the free-serum
       gift for the kit line — and from that moment a 3-kit cart printed $447 here while
       checkout charged $329. The drawer disagreed with the button and with the receipt.
       totalAmount is what Shopify actually charges, so that is the number to show.
       Both values come from Shopify; the gap between them is the only arithmetic here,
       and it is exact because neither side is computed locally. */
    var gross = Number(cart.cost.subtotalAmount.amount);
    var due = Number(cart.cost.totalAmount.amount);
    var saved = gross - due;
    var discounted = saved > 0.005;

    foot.innerHTML =
      (discounted
        ? '<div class="lbc-pre"><span>Before discounts</span><span>' + money(gross) + '</span></div>' +
          '<div class="lbc-pre save"><span>You save</span><span>&minus;' + money(saved) + '</span></div>'
        : '') +
      '<div class="lbc-ship"><span>Shipping</span><b>Free</b></div>' +
      '<div class="lbc-sub"><span>Total</span><b>' + money(due) + '</b></div>' +
      '<div class="lbc-eta"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 6h13v10H1zM14 9h4l3 3v4h-7z"/><circle cx="5.5" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/></svg>' +
        '<span>Arrives <b>' + eta() + '</b> · tracked</span></div>' +
      '<a class="lbc-go" href="' + cart.checkoutUrl + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>' +
        'Secure checkout · ' + money(due) + '</a>' +
      '<div class="lbc-pay" aria-label="Accepted payment methods">' +
        PAY.map(function (p) { return '<img src="/img/pay/' + p + '.svg" alt="' + p.replace('-', ' ') + '" width="34" height="22" loading="lazy">'; }).join('') +
      '</div>' +
      '<button class="lbc-more" type="button">Continue shopping</button>' +
      (failed ? '<p class="lbc-err">Something went wrong. Please try again.</p>' : '');

    foot.querySelector('.lbc-more').addEventListener('click', close);

    foot.querySelector('.lbc-go').addEventListener('click', function () {
      /* Report what is actually being paid. Sending the pre-discount subtotal here
         overstated every InitiateCheckout by the value of the discount. */
      try { fbq('track', 'InitiateCheckout', { value: due, currency: 'USD', num_items: cart.totalQuantity }); } catch (e) {}
      try { gtag('event', 'begin_checkout', { currency: 'USD', value: due }); } catch (e) {}
    });
  }

  /* Focus goes into the dialog on open and back to whatever opened it on close, so
     keyboard and screen-reader users land inside the cart rather than behind it. */
  var lastFocus = null;
  function open() {
    if (!root.classList.contains('lbc-open')) {
      lastFocus = document.activeElement;
      setTimeout(function () { var x = root.querySelector('.lbc-x'); if (x) x.focus({ preventScroll: true }); }, 50);
    }
    document.body.classList.add('lbc-lock'); root.classList.add('lbc-open'); document.documentElement.classList.add('lbc-open');
  }
  function close() {
    if (!root.classList.contains('lbc-open')) return;
    document.body.classList.remove('lbc-lock'); root.classList.remove('lbc-open'); document.documentElement.classList.remove('lbc-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function start() {
    build();
    paint();
    hydrate().then(function () { paint(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Cart = { add: add, open: open, close: close, get: function () { return cart; } };
})();
