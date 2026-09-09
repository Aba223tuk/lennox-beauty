/* Lennox Beauty cart — self-contained, no dependencies, no build step.
   Drop-in: <script src="cart.js" defer></script>

   Replaces the old flow, where every "Add to cart" built a throwaway Shopify cart
   and redirected straight to checkout. Nobody could add two things, change their
   mind about a quantity, or leave and come back. Now the Shopify cart id lives in
   localStorage and the same cart is reused across pages and visits.

   Everything is injected — the header button and the drawer — so a page only needs
   this script tag and a call to Cart.add(variantId, qty). No per-page markup.

   The pricing shown here is whatever Shopify returns for the cart, never anything
   this file works out. That matters: the batana buy-one-get-one-half-price is an
   automatic Shopify discount, and 50% of $29.99 rounds to a $14.99 discount, not
   $15.00 (two jars are $44.99, not $44.98). Reading totals back off the cart is
   the only way the drawer and the checkout can't disagree. */
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

  /* Last resort, for merchandise Shopify has no art for at all. Batana is currently
     in exactly that state — no variant image, no featured image, an empty images
     collection — so its line rendered as a bare grey box next to the serum's photo.
     Keyed by variant id and served from this site. Delete an entry once the real
     product image is uploaded in Shopify admin; the chain below prefers Shopify's
     own art whenever it exists, so a stale entry here is inert rather than wrong. */
  var LOCAL_IMG = {
    'gid://shopify/ProductVariant/52368268034264': '/img/batana/jar.webp'
  };

  function lineImage(m) {
    return (m.image && m.image.url) ||
           (m.product && m.product.featuredImage && m.product.featuredImage.url) ||
           LOCAL_IMG[m.id] || '';
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
     The batana page needs the second form: jars and the cross-sold serum have to
     land in one round trip, or the drawer pops open twice. */
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
      .catch(function () { busy = false; paint(true); });
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
    'body.lbc-lock{overflow:hidden}',
    '.lbc-head{display:flex;align-items:center;justify-content:space-between;padding:1.15rem 1.25rem;border-bottom:1px solid #ececec;flex:none}',
    '.lbc-head h2{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.35rem;font-weight:600;margin:0}',
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
    '.lbc-note{font-size:.76rem;color:#6b655c;margin:0 0 .85rem}',
    '.lbc-go{display:block;width:100%;text-align:center;background:#8a7357;color:#fff;font-weight:600;font-size:.97rem;',
    '  padding:.95rem;border-radius:999px;border:none;cursor:pointer;font-family:Inter,system-ui,sans-serif;text-decoration:none}',
    '.lbc-go:hover{background:#6f5c42}',
    '.lbc-go[aria-disabled=true]{opacity:.5;pointer-events:none}',
    '.lbc-err{color:#a4372f;font-size:.8rem;margin:.6rem 0 0;text-align:center}',
    '.lbc-busy{opacity:.55;pointer-events:none}'
  ].join('');

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
      var burger = header.querySelector('.burger');
      burger ? header.insertBefore(b, burger) : header.appendChild(b);
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

    if (!lines.length) {
      body.innerHTML = '<p class="lbc-empty">Your cart is empty.</p>';
      foot.innerHTML = failed ? '<p class="lbc-err">Something went wrong. Please try again.</p>' : '';
      return;
    }

    body.innerHTML = lines.map(function (e) {
      var l = e.node, m = l.merchandise;
      var full = Number(m.price.amount) * l.quantity;
      var paid = Number(l.cost.totalAmount.amount);
      var img = lineImage(m);
      return '<div class="lbc-line">' +
        (img ? '<img class="lbc-thumb" src="' + img + '" alt="" loading="lazy">' : '<div class="lbc-thumb"></div>') +
        '<div class="lbc-info">' +
          '<div class="lbc-name">' + m.product.title + '</div>' +
          (m.title && m.title !== 'Default Title' ? '<div class="lbc-var">' + m.title + '</div>' : '') +
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
    }).join('');

    body.querySelectorAll('[data-act]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-id'), act = el.getAttribute('data-act');
        var line = lines.filter(function (e) { return e.node.id === id; })[0];
        if (!line) return;
        if (act === 'rm') remove(id);
        else setQty(id, line.node.quantity + (act === 'inc' ? 1 : -1));
      });
    });

    var sub = cart.cost.subtotalAmount.amount;
    foot.innerHTML =
      '<div class="lbc-sub"><span>Subtotal</span><b>' + money(sub) + '</b></div>' +
      '<p class="lbc-note">Free US shipping · 30-day money-back guarantee</p>' +
      '<a class="lbc-go" href="' + cart.checkoutUrl + '">Checkout</a>' +
      (failed ? '<p class="lbc-err">Something went wrong. Please try again.</p>' : '');

    foot.querySelector('.lbc-go').addEventListener('click', function () {
      try { fbq('track', 'InitiateCheckout', { value: +sub, currency: 'USD', num_items: cart.totalQuantity }); } catch (e) {}
      try { gtag('event', 'begin_checkout', { currency: 'USD', value: +sub }); } catch (e) {}
    });
  }

  function open() { document.body.classList.add('lbc-lock'); root.classList.add('lbc-open'); document.documentElement.classList.add('lbc-open'); }
  function close() { document.body.classList.remove('lbc-lock'); root.classList.remove('lbc-open'); document.documentElement.classList.remove('lbc-open'); }

  function start() {
    build();
    paint();
    hydrate().then(function () { paint(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.Cart = { add: add, open: open, close: close, get: function () { return cart; } };
})();
