/* Lennox Beauty cart — self-contained, no dependencies, no build step.
   Drop-in: <script src="cart.js" defer></script>

   The Shopify cart id lives in localStorage and the same cart is reused across pages
   and visits. Everything is injected — the header button and the drawer — so a page
   only needs this script tag and a call to Cart.add(variantId, qty).

   2026-11-20: the drawer is rebuilt on superbonsai.com's cart, block for block —
   header with count, shipping bar, slab line cards with a bin icon, an "Add more.
   Save more." upgrade card, a "You may also like" rail, a total row with a saving
   pill and details toggle, the bright checkout button and a guarantee line.
   Their free-gift block is left out: Lennox has no gifts to give.

   The money shown is whatever Shopify returns for the cart, never anything this file
   works out. Automatic discounts round on Shopify's side; reading totals back off the
   cart is the only way the drawer and the checkout can't disagree. The offer and
   upgrade labels are the one exception — they describe what a click will do — and
   every figure in them was read off a real Storefront cart. Change a price or a
   discount in Shopify and change the label here. */
(function () {
  'use strict';

  var API = 'https://90uhee-je.myshopify.com/api/2024-07/graphql.json';
  var TOKEN = 'c733224a494da57cec069f47ad128634';
  var KEY = 'lb_cart_id';

  var cart = null;
  var busy = false;
  var root, drawer, badge;
  var showDetails = false;

  function getId() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setId(v) {
    try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {}
  }

  var CART_FIELDS = [
    'id checkoutUrl totalQuantity',
    'cost{ subtotalAmount{amount currencyCode} totalAmount{amount} }',
    'lines(first:50){edges{node{ id quantity',
    '  cost{ subtotalAmount{amount} totalAmount{amount} }',
    '  merchandise{ ...on ProductVariant { id title price{amount}',
    '    image{ url(transform:{maxWidth:160,maxHeight:160}) }',
    '    product{ title featuredImage{ url(transform:{maxWidth:160,maxHeight:160}) } } } } }}}'
  ].join(' ');

  var LOCAL_IMG = {};
  function lineImage(m) {
    return (m.image && m.image.url) ||
           (m.product && m.product.featuredImage && m.product.featuredImage.url) ||
           LOCAL_IMG[m.id] || '';
  }

  /* ---------- catalogue the drawer knows about ---------- */
  var GID = 'gid://shopify/ProductVariant/';
  var ROLL2 = '52660239794392', ROLL3 = '52660239827160';
  var LASH  = ['52609395425496', '52609395458264'];
  var DRILL = ['52527986082008', '52527986049240', '52527986016472'];
  var SERUM1 = '52304320856280', SERUM3 = '52304320921816', SERUM5 = '52304320889048';
  var SERUM = [SERUM1, SERUM3, SERUM5];
  function vid(gid) { return String(gid).split('/').pop(); }
  function kind(v) {
    return v === ROLL2 || v === ROLL3 ? 'roll' : LASH.indexOf(v) > -1 ? 'lash'
         : DRILL.indexOf(v) > -1 ? 'drill' : SERUM.indexOf(v) > -1 ? 'serum' : null;
  }

  function tally(lines) {
    var q = { roll: 0, lash: 0, drill: 0, serum: 0 }, first = {};
    lines.forEach(function (e) {
      var k = kind(vid(e.node.merchandise.id));
      if (!k) return;
      q[k] += e.node.quantity;
      if (!first[k]) first[k] = e.node;
    });
    return { q: q, first: first };
  }

  /* One upgrade at a time, like theirs. Figures, read off live carts:
     roll-on 2 = $34.99, 3 = $44.97 · serum 1/3/5 = $24.99/$38.99/$54.99 ·
     2 kits $37.48 · 2 drills $74.99. The "second one half off" discounts do NOT stack
     with the serum-half-price discount, so those upgrades hide once a serum is in. */
  function upgrade(lines) {
    var t = tally(lines), q = t.q, f = t.first;
    var r = f.roll, s = f.serum;
    if (r && vid(r.merchandise.id) === ROLL2 && r.quantity === 1)
      return { act: 'swap', line: r.id, to: ROLL3, sku: 'LB-ROLL', add: 9.98,
               title: 'Upgrade to 3 Bottles', price: '$44.97 · $14.99 a bottle', pill: 'Save 14%',
               btn: 'Upgrade &amp; save $2.51 per bottle' };
    if (s && s.quantity === 1 && vid(s.merchandise.id) === SERUM1)
      return { act: 'swap', line: s.id, to: SERUM3, sku: 'LB-SILK-3', add: 14.00,
               title: 'Upgrade to 3 Bottles', price: '$38.99 · $13.00 a bottle', pill: 'Save 48%',
               btn: 'Upgrade &amp; save $11.99 per bottle' };
    if (s && s.quantity === 1 && vid(s.merchandise.id) === SERUM3)
      return { act: 'swap', line: s.id, to: SERUM5, sku: 'LB-SILK-5', add: 16.00,
               title: 'Upgrade to 5 Bottles', price: '$54.99 · $11.00 a bottle', pill: 'Save 56%',
               btn: 'Upgrade &amp; save $2.00 per bottle' };
    if (!q.serum && q.lash === 1)
      return { act: 'qty', line: f.lash.id, qty: 2, sku: 'LB-LASH', add: 12.49,
               title: 'Add A Second Kit', price: '2 kits $37.48 · second one half off', pill: 'Save $12.50',
               btn: 'Add 2nd kit for $12.49' };
    if (!q.serum && q.drill === 1)
      return { act: 'qty', line: f.drill.id, qty: 2, sku: 'LB-NAIL', add: 25.00,
               title: 'Add A Second Drill', price: '2 drills $74.99 · second one half off', pill: 'Save $24.99',
               btn: 'Add 2nd drill for $25.00' };
    return null;
  }

  /* "You may also like": the products not already in the cart. The serum shows its
     half price only where Shopify will actually apply it (a kit or drill in the cart,
     neither at two). */
  function suggestions(lines) {
    var q = tally(lines).q;
    var half = !q.serum && (q.lash || q.drill) && q.lash < 2 && q.drill < 2;
    var all = [
      { k: 'roll',  v: ROLL2,  sku: 'LB-ROLL',   name: 'The Smoothing Roll-On', sub: '2 bottles', img: '/img/rollon/pack-400.webp', price: 34.99 },
      { k: 'lash',  v: LASH[0], sku: 'LB-LASH',  name: 'The Lash Kit', sub: '30·40·80·100 trays', img: '/img/lash/card.webp', price: 24.99 },
      { k: 'drill', v: DRILL[0], sku: 'LB-NAIL', name: 'The Nail Drill', sub: 'Grey', img: '/img/nail/card.webp', price: 49.99 },
      { k: 'serum', v: SERUM1, sku: 'LB-SILK-1', name: 'The Silk Serum', sub: '1 bottle', img: '/img/silk/single.webp',
        price: half ? 12.50 : 24.99, was: half ? 24.99 : 0 }
    ];
    return all.filter(function (p) { return !q[p.k]; });
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

  /* add(variantId, qty) or add([{merchandiseId, quantity}, ...]) */
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
        setId(null);
        return api('mutation($lines:[CartLineInput!]!){ cartCreate(input:{lines:$lines}){ cart{ ' + CART_FIELDS + ' } userErrors{message} } }', { lines: lines })
          .then(function (r) { return readCart(r, 'cartCreate'); });
      })
      .then(function (c) {
        if (!c) throw new Error('cart failed');
        cart = c; setId(c.id);
        busy = false; paint(); open();
        /* No AddToCart here: the product pages own that event (they know sku, qty and
           price). InitiateCheckout stays in this file because it is cart-level. */
      })
      .catch(function () { busy = false; paint(true); open(); });
  }

  function update(line) {
    if (busy) return;
    busy = true; paint();
    api('mutation($id:ID!,$lines:[CartLineUpdateInput!]!){ cartLinesUpdate(cartId:$id,lines:$lines){ cart{ ' + CART_FIELDS + ' } userErrors{message} } }',
        { id: getId(), lines: [line] })
      .then(function (r) { cart = readCart(r, 'cartLinesUpdate'); busy = false; paint(); })
      .catch(function () { busy = false; paint(true); });
  }
  function setQty(lineId, qty) {
    if (qty < 1) return remove(lineId);
    update({ id: lineId, quantity: qty });
  }
  function remove(lineId) {
    if (busy) return;
    busy = true; paint();
    api('mutation($id:ID!,$ids:[ID!]!){ cartLinesRemove(cartId:$id,lineIds:$ids){ cart{ ' + CART_FIELDS + ' } userErrors{message} } }',
        { id: getId(), ids: [lineId] })
      .then(function (r) { cart = readCart(r, 'cartLinesRemove'); busy = false; paint(); })
      .catch(function () { busy = false; paint(true); });
  }

  function track(sku, value) {
    try { fbq('track', 'AddToCart', { content_type: 'product', content_ids: [sku], num_items: 1, value: value, currency: 'USD' }); } catch (e) {}
    try { gtag('event', 'add_to_cart', { currency: 'USD', value: value, items: [{ item_id: sku, quantity: 1, price: value }] }); } catch (e) {}
  }

  /* ---------- ui ---------- */
  var D = '#1e1914', SAND = '#efe6d8', HI = '#ecd3a3';
  var SLAB = 'border:solid ' + D + ';border-width:1px 2px 3px 1px;';
  var COND = '"Barlow Condensed","Arial Narrow",sans-serif', BODY = 'Nunito,system-ui,sans-serif';
  var css = [
    '.lbc-btn{position:relative;width:40px;height:40px;flex:none;border:none;background:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center}',
    '.lbc-btn svg{width:22px;height:22px;stroke:' + D + ';fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.lbc-count{position:absolute;top:1px;right:0;min-width:18px;height:18px;border-radius:999px;background:' + HI + ';color:' + D + ';border:1.5px solid ' + D + ';',
    '  font:800 10px/15px ' + BODY + ';text-align:center;padding:0 4px;display:none}',
    '.lbc-count.on{display:block}',
    '.lbc-back{position:fixed;inset:0;z-index:9995;background:rgba(20,16,12,.5);opacity:0;pointer-events:none;transition:opacity .25s ease}',
    '.lbc-open .lbc-back{opacity:1;pointer-events:auto}',
    '.lbc-panel{position:fixed;top:0;right:0;bottom:0;z-index:9996;width:min(420px,100vw);background:#fff;font-family:' + BODY + ';font-weight:700;color:' + D + ';',
    '  display:flex;flex-direction:column;transform:translateX(100%);visibility:hidden;transition:transform .28s cubic-bezier(.4,0,.2,1),visibility 0s linear .28s}',
    '.lbc-open .lbc-panel{transform:none;visibility:visible;transition:transform .28s cubic-bezier(.4,0,.2,1)}',
    'body.lbc-lock{overflow:hidden}',
    '.lbc-head{display:flex;align-items:center;justify-content:space-between;padding:.9rem 1rem;border-bottom:1.5px solid ' + D + ';flex:none}',
    '.lbc-head h2{display:flex;align-items:center;gap:.5rem;font:800 1rem ' + BODY + ';margin:0}',
    '.lbc-head h2 svg{width:22px;height:22px;stroke:' + D + ';fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.lbc-x{width:36px;height:36px;border:none;background:none;cursor:pointer;font-size:1.35rem;line-height:1;color:' + D + ';font-weight:800}',
    '.lbc-x:focus:not(:focus-visible){outline:none}',
    '.lbc-ship{flex:none;padding:.7rem 1rem .8rem;text-align:center;font-size:.86rem;font-weight:800;border-bottom:1px solid #eadfcf}',
    '.lbc-bar{position:relative;height:9px;border-radius:999px;background:' + SAND + ';margin-top:.45rem;overflow:hidden;border:1.5px solid ' + D + '}',
    '.lbc-bar i{position:absolute;inset:0;background:linear-gradient(90deg,#cfa865,' + HI + ')}',
    '.lbc-body{flex:1;overflow-y:auto;padding:.9rem 1rem 1rem}',
    '.lbc-is-empty{background:linear-gradient(180deg,#fff 0%,#fff 45%,' + SAND + ' 100%)}',
    '.lbc-is-empty .lbc-foot{background:transparent;border-top:none}',
    '.lbc-empty{min-height:100%;display:flex;flex-direction:column;text-align:center;padding:.4rem 0 1rem}',
    '.lbc-empty h3{font:800 1.75rem/1 ' + COND + ';margin:.2rem 0 .4rem}',
    '.lbc-empty p{font-size:.92rem;margin:0}',
    '.lbc-cats{display:flex;flex-direction:column;gap:.7rem;margin:auto 0;padding-top:1.4rem}',
    '.lbc-cat{position:relative;display:flex;align-items:center;height:96px;padding:0 1rem;border-radius:12px;' + SLAB +
    '  overflow:hidden;text-decoration:none;color:' + D + ';background:linear-gradient(90deg,#fbf6ee 0%,' + SAND + ' 100%);transition:transform .15s ease}',
    '.lbc-cat:hover{transform:translateY(-2px)}',
    '@media(max-height:700px){.lbc-cat{height:74px}.lbc-cats{padding-top:1rem;gap:.55rem}}',
    '.lbc-cat b{position:relative;z-index:1;font:800 1.55rem/1 ' + COND + '}',
    '.lbc-cat img{position:absolute;right:0;top:0;width:46%;height:100%;object-fit:cover;',
    '  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 38%);mask-image:linear-gradient(90deg,transparent 0,#000 38%)}',
    '.lbc-all{position:relative;overflow:hidden;isolation:isolate;display:block;text-align:center;padding:.95rem;border-radius:10px;' + SLAB +
    '  background:' + D + ';color:#fff;font:800 1.2rem ' + COND + ';text-transform:uppercase;text-decoration:none}',
    '.lbc-all::before{content:"";position:absolute;z-index:-1;top:0;bottom:0;left:5%;width:16%;transform:skewX(-35deg);',
    '  background:linear-gradient(90deg,rgba(255,255,255,.16) 0 38%,transparent 38% 58%,rgba(255,255,255,.16) 58% 100%)}',
    '.lbc-line{position:relative;display:flex;gap:.8rem;padding:.75rem;border-radius:14px;' + SLAB + 'margin-bottom:.7rem;background:#fff}',
    '.lbc-thumb{width:76px;height:76px;flex:none;border-radius:10px;border:1px solid #e3d8c7;background:#faf6f0;object-fit:cover}',
    '.lbc-info{flex:1;min-width:0;padding-right:1.6rem}',
    '.lbc-name{font:800 1.2rem/1.05 ' + COND + '}',
    '.lbc-var{font-size:.84rem;margin-top:.2rem}',
    '.lbc-row{display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-top:.5rem}',
    '.lbc-price{font-size:.95rem;font-weight:800;white-space:nowrap}',
    '.lbc-was{font-size:.82rem;font-weight:700;color:#4a4037;text-decoration:line-through;margin-left:.35rem}',
    '.lbc-qty{display:flex;align-items:center;border:1.5px solid ' + D + ';border-radius:8px}',
    '.lbc-qty button{width:30px;height:28px;border:none;background:none;cursor:pointer;font-size:1.05rem;font-weight:800;line-height:1;color:' + D + '}',
    '.lbc-qty button:disabled{color:#b9ae9e;cursor:default}',
    '.lbc-qty span{min-width:1.4rem;text-align:center;font-size:.9rem;font-weight:800}',
    '.lbc-rm{position:absolute;top:.6rem;right:.6rem;width:30px;height:30px;border:none;background:none;cursor:pointer;display:grid;place-items:center}',
    '.lbc-rm svg{width:19px;height:19px;stroke:' + D + ';fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.lbc-up{margin:.3rem 0 1rem}',
    '.lbc-tab{display:inline-block;background:' + D + ';color:#fff;font:800 .82rem ' + BODY + ';letter-spacing:.04em;text-transform:uppercase;padding:.4rem .8rem;border-radius:10px 10px 0 0}',
    '.lbc-upc{border-radius:0 14px 14px 14px;' + SLAB + 'background:#fbf6ee;padding:.85rem}',
    '.lbc-upc h3{font:800 1.3rem/1 ' + COND + ';margin:0 0 .35rem}',
    '.lbc-upc p{display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;margin:0 0 .5rem;font-size:.88rem}',
    '.lbc-upc p b{background:' + HI + ';border:1.5px solid ' + D + ';border-radius:6px;padding:.1rem .45rem;font-size:.78rem;font-weight:800;text-transform:uppercase}',
    '.lbc-upc ul{list-style:none;margin:0 0 .7rem;padding:0;font-size:.86rem}',
    '.lbc-upc li{display:flex;gap:.45rem;margin-top:.2rem}',
    '.lbc-upc li::before{content:"\\2713";font-weight:900}',
    '.lbc-cta{position:relative;overflow:hidden;isolation:isolate;display:block;width:100%;padding:.9rem .6rem;border-radius:10px;' + SLAB,
    '  background:linear-gradient(180deg,' + HI + ',#cfa865);color:' + D + ';font:800 1.2rem/1.05 ' + COND + ';text-transform:uppercase;cursor:pointer;text-align:center;text-decoration:none}',
    '.lbc-cta::before{content:"";position:absolute;z-index:-1;top:0;bottom:0;left:5%;width:16%;transform:skewX(-35deg);',
    '  background:linear-gradient(90deg,rgba(255,255,255,.5) 0 38%,transparent 38% 58%,rgba(255,255,255,.5) 58% 100%)}',
    '.lbc-also{margin-top:.4rem}',
    '.lbc-also-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:.55rem}',
    '.lbc-also-h h3{font:800 1.05rem ' + BODY + ';margin:0}',
    '.lbc-also-h div{display:flex;gap:.35rem}',
    '.lbc-also-h button{width:32px;height:32px;border-radius:8px;border:1.5px solid ' + D + ';background:' + HI + ';cursor:pointer;font-weight:900;color:' + D + '}',
    '.lbc-rail{display:flex;gap:.6rem;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding-bottom:.3rem}',
    '.lbc-rail::-webkit-scrollbar{display:none}',
    '.lbc-card{flex:0 0 86%;scroll-snap-align:start;display:flex;align-items:center;gap:.7rem;padding:.6rem;border-radius:14px;' + SLAB + 'background:#fff}',
    '.lbc-card img{width:64px;height:64px;flex:none;border-radius:10px;object-fit:cover;border:1px solid #e3d8c7}',
    '.lbc-card div{flex:1;min-width:0}',
    '.lbc-card b{display:block;font:800 1.05rem/1.05 ' + COND + '}',
    '.lbc-card span{display:block;font-size:.88rem;font-weight:800;margin-top:.2rem}',
    '.lbc-card s{font-weight:700;color:#4a4037;margin-left:.3rem}',
    '.lbc-card button{flex:none;background:none;border:none;font:800 .95rem ' + BODY + ';text-decoration:underline;text-underline-offset:3px;cursor:pointer;color:' + D + ';padding:.4rem}',
    '.lbc-foot{flex:none;border-top:1.5px solid ' + D + ';padding:.85rem 1rem 1rem;background:#fff}',
    '.lbc-tot{display:flex;align-items:center;gap:.6rem;margin-bottom:.7rem}',
    '.lbc-tot strong{font:800 1.15rem ' + BODY + '}',
    '.lbc-tot button{background:none;border:none;font:800 .84rem ' + BODY + ';cursor:pointer;color:' + D + ';text-decoration:underline;text-underline-offset:3px;padding:0}',
    '.lbc-tot em{margin-left:auto;font-style:normal;background:' + HI + ';border:1.5px solid ' + D + ';border-radius:6px;padding:.1rem .45rem;font-size:.78rem;font-weight:800;text-transform:uppercase}',
    '.lbc-tot b{font:800 1.3rem ' + BODY + '}',
    '.lbc-tot em + b{margin-left:0}',
    '.lbc-tot strong + button + b{margin-left:auto}',
    '.lbc-det{font-size:.88rem;margin:-.2rem 0 .7rem;padding:.6rem .7rem;border-radius:10px;background:#faf6f0}',
    '.lbc-det div{display:flex;justify-content:space-between;margin:.15rem 0}',
    '.lbc-assure{display:flex;justify-content:center;gap:1rem;margin-top:.6rem;font-size:.82rem;font-weight:800}',
    '.lbc-assure span{display:inline-flex;align-items:center;gap:.3rem}',
    '.lbc-assure svg{width:15px;height:15px;stroke:' + D + ';fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.lbc-err{color:#8f2219;font-size:.88rem;font-weight:800;margin:.6rem 0 0;text-align:center}',
    '.lbc-busy{opacity:.6;pointer-events:none}'
  ].join('');

  var BAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';
  var BIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
  var SHIELD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>';
  var LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>';

  /* Same window the product pages print: dispatch 1–2 days, then 7–13 in transit. */
  function eta() {
    var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    function d(n) { var x = new Date(); x.setDate(x.getDate() + n); return MON[x.getMonth()] + ' ' + x.getDate(); }
    return d(8) + ' – ' + d(15);
  }
  function money(a) { return '$' + Number(a).toFixed(2); }
  var CATS = [
    { name: 'Shave &amp; Wax', url: '/roll-on', img: '/img/rollon/pack-400.webp' },
    { name: 'Lashes', url: '/lash-kit', img: '/img/lash/card.webp' },
    { name: 'Nails', url: '/nail-drill', img: '/img/nail/card.webp' },
    { name: 'Hair', url: '/silk-serum', img: '/img/silk/silk-07.webp' }
  ];
  /* 60 days on the roll-on, 30 on everything else — the footer of each page says the same. */
  function guaranteeDays(lines) {
    var t = tally(lines).q;
    return t.roll && !t.lash && !t.drill && !t.serum ? 60 : 30;
  }

  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = document.createElement('div');
    root.innerHTML =
      '<div class="lbc-back"></div>' +
      '<aside class="lbc-panel" role="dialog" aria-modal="true" aria-label="Your cart">' +
      '  <div class="lbc-head"><h2>' + BAG + '<span>Cart</span></h2><button class="lbc-x" type="button" aria-label="Close cart">&#10005;</button></div>' +
      '  <div class="lbc-ship">You\'ve unlocked FREE US shipping<div class="lbc-bar"><i></i></div></div>' +
      '  <div class="lbc-body"></div>' +
      '  <div class="lbc-foot"></div>' +
      '</aside>';
    document.body.appendChild(root);
    drawer = root.querySelector('.lbc-panel');
    root.querySelector('.lbc-back').addEventListener('click', close);
    root.querySelector('.lbc-x').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    var header = document.querySelector('header');
    if (header) {
      var b = document.createElement('button');
      b.className = 'lbc-btn'; b.type = 'button'; b.setAttribute('aria-label', 'Open cart');
      b.innerHTML = BAG + '<span class="lbc-count"></span>';
      b.addEventListener('click', open);
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
    var ship = root.querySelector('.lbc-ship');
    drawer.classList.toggle('lbc-busy', busy);

    var lines = (cart && cart.lines && cart.lines.edges) || [];
    var n = (cart && cart.totalQuantity) || 0;
    if (badge) { badge.textContent = n; badge.classList.toggle('on', n > 0); }
    root.querySelector('.lbc-head h2 span').textContent = 'Cart (' + n + ')';
    ship.style.display = lines.length ? '' : 'none';

    /* Empty state, Super Bonsai's: title and one line up top, a stack of "shop by
       need" cards (label left, product right), and a full-width Shop All pinned at
       the bottom. Theirs says "Shop our bestsellers"; we don't have the sales to call
       anything a bestseller, so ours says what each card is for. */
    drawer.classList.toggle('lbc-is-empty', !lines.length);
    if (!lines.length) {
      body.innerHTML = '<div class="lbc-empty"><h3>Your Cart Is Empty!</h3>' +
        '<p>Not sure where to start? Shop by what you need.</p>' +
        '<div class="lbc-cats">' + CATS.map(function (c) {
          return '<a class="lbc-cat" href="' + c.url + '"><b>' + c.name + '</b>' +
            '<img src="' + c.img + '" alt="" width="160" height="160" loading="lazy"></a>';
        }).join('') + '</div></div>';
      foot.innerHTML = '<a class="lbc-all" href="/catalog">Shop all</a>' +
        (failed ? '<p class="lbc-err">Something went wrong. Please try again.</p>' : '');
      foot.style.display = '';
      return;
    }
    foot.style.display = '';

    var up = upgrade(lines);
    var sugg = suggestions(lines);
    var days = guaranteeDays(lines);

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
              (paid < full - 0.005 ? '<span class="lbc-was">' + money(full) + '</span>' : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<button class="lbc-rm" type="button" data-act="rm" data-id="' + l.id + '" aria-label="Remove ' + m.product.title + '">' + BIN + '</button>' +
      '</div>';
    }).join('') +
    (up ? '<div class="lbc-up"><span class="lbc-tab">Add more. Save more.</span><div class="lbc-upc">' +
        '<h3>' + up.title + '</h3><p>' + up.price + ' <b>' + up.pill + '</b></p>' +
        '<ul><li>Free US shipping</li><li>' + days + '-day money-back guarantee</li></ul>' +
        '<button class="lbc-cta" type="button" data-up>' + up.btn + '</button></div></div>' : '') +
    (sugg.length ? '<div class="lbc-also"><div class="lbc-also-h"><h3>You May Also Like</h3>' +
        (sugg.length > 1 ? '<div><button type="button" data-rail="-1" aria-label="Previous">&#8249;</button><button type="button" data-rail="1" aria-label="Next">&#8250;</button></div>' : '') +
        '</div><div class="lbc-rail">' + sugg.map(function (p, i) {
          return '<div class="lbc-card"><img src="' + p.img + '" alt="" width="64" height="64" loading="lazy">' +
            '<div><b>' + p.name + '</b><span>' + money(p.price) + (p.was ? '<s>' + money(p.was) + '</s>' : '') + '</span></div>' +
            '<button type="button" data-sugg="' + i + '" aria-label="Add ' + p.name + '">Add</button></div>';
        }).join('') + '</div></div>' : '');

    var upBtn = body.querySelector('[data-up]');
    if (upBtn) upBtn.addEventListener('click', function () {
      track(up.sku, up.add);
      if (up.act === 'swap') update({ id: up.line, merchandiseId: GID + up.to, quantity: 1 });
      else setQty(up.line, up.qty);
    });
    body.querySelectorAll('[data-sugg]').forEach(function (el) {
      el.addEventListener('click', function () {
        var p = sugg[+el.getAttribute('data-sugg')];
        track(p.sku, p.price);
        add(GID + p.v, 1);
      });
    });
    var rail = body.querySelector('.lbc-rail');
    body.querySelectorAll('[data-rail]').forEach(function (el) {
      el.addEventListener('click', function () { rail.scrollBy({ left: +el.getAttribute('data-rail') * rail.clientWidth * .88, behavior: 'smooth' }); });
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

    /* totalAmount is what Shopify charges (order-level discounts included);
       subtotalAmount is before them. Both from Shopify — the gap is the saving. */
    var gross = Number(cart.cost.subtotalAmount.amount);
    var due = Number(cart.cost.totalAmount.amount);
    var lineFull = lines.reduce(function (s, e) { return s + Number(e.node.merchandise.price.amount) * e.node.quantity; }, 0);
    var saved = Math.max(lineFull, gross) - due;
    var pct = saved > 0.005 ? Math.round(saved / Math.max(lineFull, gross) * 100) : 0;

    foot.innerHTML =
      '<div class="lbc-tot"><strong>Total</strong>' +
        '<button type="button" data-det aria-expanded="' + showDetails + '">' + (showDetails ? 'Hide details' : 'Show details') + '</button>' +
        (pct ? '<em>Saving ' + pct + '%</em>' : '') +
        '<b' + (pct ? '' : ' style="margin-left:auto"') + '>' + money(due) + '</b></div>' +
      (showDetails ? '<div class="lbc-det">' +
        '<div><span>Subtotal</span><span>' + money(Math.max(lineFull, gross)) + '</span></div>' +
        (pct ? '<div><span>You save</span><span>&minus;' + money(saved) + '</span></div>' : '') +
        '<div><span>Shipping</span><span>Free</span></div>' +
        '<div><span>Arrives</span><span>' + eta() + ' · tracked</span></div></div>' : '') +
      '<a class="lbc-cta" href="' + cart.checkoutUrl + '">Checkout</a>' +
      '<div class="lbc-assure"><span>' + SHIELD + days + '-Day Money-Back Guarantee</span><span>' + LOCK + 'Secure Checkout</span></div>' +
      (failed ? '<p class="lbc-err">Something went wrong. Please try again.</p>' : '');

    foot.querySelector('[data-det]').addEventListener('click', function () { showDetails = !showDetails; paint(); });
    foot.querySelector('.lbc-cta').addEventListener('click', function () {
      try { fbq('track', 'InitiateCheckout', { value: due, currency: 'USD', num_items: cart.totalQuantity }); } catch (e) {}
      try { gtag('event', 'begin_checkout', { currency: 'USD', value: due }); } catch (e) {}
    });
  }

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
