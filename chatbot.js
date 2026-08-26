/* Lennox Beauty chat widget — self-contained, no dependencies, no API keys.
   Scripted brain (intent matching + guided chips). Every answer is traceable to
   copy already published on index.html / product.html — do not add claims here
   that the site doesn't make.
   Drop-in: <script src="chatbot.js" defer></script> */
(function () {
  'use strict';

  var PHONE_DISPLAY = '(929) 670-9555';
  var PHONE_TEL = '+19296709555';
  var PHONE_LINK = '<a href="tel:' + PHONE_TEL + '">' + PHONE_DISPLAY + '</a>';
  var SHOP_URL = 'product.html';

  /* ---------- styles (brand tokens mirrored from the site) ---------- */
  var css = [
    '.lcb-launcher{position:fixed;right:20px;bottom:calc(20px + var(--lcb-lift,0px));z-index:9990;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;',
    'background:linear-gradient(135deg,#8a7357 0%,#6f5c42 100%);color:#fff;display:flex;align-items:center;justify-content:center;',
    'box-shadow:0 10px 30px rgba(111,92,66,.38);transition:transform .25s ease,box-shadow .25s ease}',
    '.lcb-launcher:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 16px 40px rgba(111,92,66,.5)}',
    '.lcb-launcher:focus-visible{outline:2px solid #141414;outline-offset:3px}',
    '.lcb-launcher svg{width:26px;height:26px}',
    '.lcb-launcher .lcb-ico-close{display:none}',
    '.lcb-open .lcb-launcher .lcb-ico-chat{display:none}',
    '.lcb-open .lcb-launcher .lcb-ico-close{display:block}',
    '.lcb-ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(138,115,87,.55);animation:lcbring 2.6s ease-out infinite;pointer-events:none}',
    '@keyframes lcbring{0%{transform:scale(1);opacity:.75}100%{transform:scale(1.55);opacity:0}}',
    '.lcb-panel{position:fixed;right:20px;bottom:calc(90px + var(--lcb-lift,0px));z-index:9991;width:min(370px,calc(100vw - 40px));',
    'max-height:min(580px,calc(100vh - 130px - var(--lcb-lift,0px)));',
    'display:none;flex-direction:column;overflow:hidden;border-radius:16px;border:1px solid #ececec;',
    'background:#fff;box-shadow:0 24px 60px rgba(20,20,20,.18);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#141414}',
    '.lcb-open .lcb-panel{display:flex;animation:lcbpop .28s cubic-bezier(.22,.61,.36,1)}',
    '@keyframes lcbpop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}',
    '.lcb-head{display:flex;align-items:center;gap:11px;padding:14px 16px;background:#faf9f7;border-bottom:1px solid #ececec}',
    '.lcb-avatar{width:38px;height:38px;border-radius:50%;flex:none;background:linear-gradient(135deg,#8a7357,#6f5c42);display:flex;align-items:center;justify-content:center;',
    'font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:1.15rem;color:#fff}',
    '.lcb-head-t{flex:1;min-width:0}',
    '.lcb-head-t b{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-size:1.05rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase}',
    '.lcb-head-t span{display:flex;align-items:center;gap:6px;font-size:.7rem;color:#5c5c5c}',
    '.lcb-dot{width:6px;height:6px;border-radius:50%;background:#4ba373;flex:none}',
    '.lcb-x{background:none;border:0;color:#5c5c5c;cursor:pointer;padding:6px;border-radius:8px;line-height:0}',
    '.lcb-x:hover{color:#141414;background:#ececec}',
    '.lcb-msgs{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:9px;background:#fff;scrollbar-width:thin}',
    '.lcb-msg{max-width:86%;padding:10px 13px;border-radius:13px;font-size:.875rem;line-height:1.6;white-space:pre-line;overflow-wrap:break-word}',
    '.lcb-msg a{color:#6f5c42;font-weight:600;text-decoration:underline}',
    '.lcb-bot{align-self:flex-start;background:#faf9f7;border:1px solid #ececec;border-bottom-left-radius:4px}',
    '.lcb-user{align-self:flex-end;background:#8a7357;color:#fff;border-bottom-right-radius:4px}',
    '.lcb-typing{align-self:flex-start;display:flex;gap:5px;padding:12px 15px;background:#faf9f7;border:1px solid #ececec;border-radius:13px;border-bottom-left-radius:4px}',
    '.lcb-typing i{width:6px;height:6px;border-radius:50%;background:#b3a897;animation:lcbb 1.2s ease-in-out infinite}',
    '.lcb-typing i:nth-child(2){animation-delay:.15s}.lcb-typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes lcbb{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}',
    '.lcb-chips{display:flex;flex-wrap:wrap;gap:7px;align-self:flex-start;max-width:96%}',
    '.lcb-chip{background:#fff;border:1px solid #d8cfc1;color:#6f5c42;font-size:.78rem;font-weight:600;',
    'padding:8px 13px;border-radius:999px;cursor:pointer;transition:background .18s,border-color .18s;font-family:inherit}',
    '.lcb-chip:hover{background:#faf9f7;border-color:#8a7357}',
    '.lcb-foot{display:flex;gap:8px;padding:11px;border-top:1px solid #ececec;background:#fff}',
    '.lcb-in{flex:1;background:#faf9f7;border:1px solid #ececec;border-radius:11px;color:#141414;font-size:16px;padding:11px 13px;outline:none;font-family:inherit}',
    '.lcb-in:focus{border-color:#8a7357;background:#fff}',
    '.lcb-send{width:42px;height:42px;flex:none;border:0;border-radius:11px;cursor:pointer;background:#141414;color:#fff;display:flex;align-items:center;justify-content:center}',
    '.lcb-send:hover{background:#8a7357}',
    '.lcb-brand{text-align:center;font-size:.65rem;color:#9b9b9b;padding:0 0 9px;background:#fff}',
    '.lcb-brand a{color:inherit}',
    '@media(max-width:480px){.lcb-panel{right:10px;left:10px;width:auto;bottom:calc(82px + var(--lcb-lift,0px));',
    'max-height:calc(100dvh - 110px - var(--lcb-lift,0px))}.lcb-launcher{right:16px;bottom:calc(16px + var(--lcb-lift,0px))}}',
    '@media(prefers-reduced-motion:reduce){.lcb-ring{animation:none}.lcb-open .lcb-panel{animation:none}.lcb-typing i{animation:none}}'
  ].join('');

  /* ---------- content ----------
     Sourced from the live site. If site copy changes, change these too. */
  var T = {
    greet: "Hi 👋 I'm the Lennox assistant.\nAsk me anything about The Silk Serum — how it works, what it smells like, or when it would arrive.\n\nWhat would you like to know?",

    what: "The Silk Serum is a featherweight leave-in mist — a 100ml spray bottle, not a heavy oil.\n\nTwo or three sprays through mid-lengths and ends lays the hair cuticle flat, so flyaways smooth out and static disappears. The nozzle throws a very fine mist, so it spreads evenly instead of landing in wet patches — that's what keeps it feeling weightless rather than greasy.\n\nThe whole routine takes about sixty seconds.",

    pricing: "$38.99 — and during launch week that gets you three bottles, not one.\n\n• 3 × 100ml for $38.99 (≈ 7 months of use)\n• Free US shipping on every order\n• Make it 5 bottles for $16 more\n\nNo subscription, no fine print.",

    shipping: "Orders are dispatched within 1–2 business days and typically arrive 7–13 days later, tracked the whole way.\n\nThe tracking number is emailed to you the moment it ships. US shipping is free on every order.",

    ingredients: "Honest answer: we don't publish a full INCI list on the site yet — the complete ingredient list is printed on the bottle itself.\n\nIf you have a specific allergy or something you need to avoid, text or call " + PHONE_LINK + " before you order and we'll check the current batch for you. I'd rather you ask than guess.",

    howto: "Start with dry or towel-dried hair — no prep, no rinsing.\n\n1. Mist 2–3 sprays over mid-lengths and ends, about a hand's width away\n2. Comb it through\n3. Air dry or blow-dry as usual\n\nIt's a leave-in, so it stays put. Takes about a minute.",

    greasy: "No — that's rather the point of it.\n\nIt's a weightless leave-in mist, not an oil you pour on. The fine spray spreads a very thin, even layer and dries down silky instead of sitting on top of your hair. If coconut or castor oil burned you before, this feels completely different.",

    hairtype: "Yes. It smooths the cuticle without relaxing your pattern — curls stay curls, minus the halo of frizz.\n\nSafe for colour-treated hair as well.",

    results: "Flyaways smooth immediately, from the first application.\n\nThe full effect — hair that stays smooth through humid days — builds over 2–4 weeks of regular use. That's exactly why the other two bottles are free.",

    guarantee: "30 days, no risk.\n\nUse it for a month. If your hair isn't noticeably smoother, text or call " + PHONE_LINK + " and we refund every cent — you don't even ship the bottle back. No returns, no forms.",

    maker: "Straight answer: we don't make The Silk Serum ourselves — it's produced by a manufacturing partner, and the bottle that arrives carries their label rather than ours.\n\nWe'd rather tell you that up front than have it surprise you at the door.",

    lasts: "One 100ml bottle is roughly 2–3 months of daily use.\n\nSince every launch order ships with two extra bottles free, that's about 7 months in the box for $38.99.",

    scent: "It's a perfumed mist, so the scent is part of the product rather than an afterthought — soft and warm, noticeable when you first spray, then settling into your hair through the day.\n\nIt won't fight your perfume.",

    nosub: "No subscription and no fine print. It's a one-time purchase — you buy it once, it ships once.",

    collection: "The Silk Serum is the one that's live today.\n\nThree more are in development: The Repair Mask (weekly deep-conditioner), The Sleek Stick (pocket wax stick for flyaways) and The Heat Shield (pre-styling primer against heat damage).\n\nStart with the serum — the rest of the routine is on its way.",

    support: "A real person handles these — text or call:\n\n📱 " + PHONE_LINK + "\n\nOrder questions, refunds, anything I couldn't answer. Texting is usually fastest.",

    buy: "Launch offer: pay for one bottle at $38.99 and three arrive.\n\n<a href=\"" + SHOP_URL + "\">Claim my 2 free bottles →</a>",

    fallback: "I'll be honest — I'm a scripted assistant, so that one is outside what I know.\n\nA person can help: text or call " + PHONE_LINK + ". Or ask me about the offer, shipping, the scent, or how to use it.",

    thanks: "Any time. Anything else about the serum?",

    hi: "Hi! Ask me anything about The Silk Serum — the offer, shipping, the scent, or how to use it."
  };

  var CHIPS_MAIN = [
    ['What is it?', 'what'],
    ['Price & offer', 'pricing'],
    ['Shipping', 'shipping'],
    ["What's in it?", 'ingredients'],
    ['How to use', 'howto']
  ];
  var CHIPS_AFTER = [
    ['Claim the offer', 'buy'],
    ['Shipping', 'shipping'],
    ['Guarantee', 'guarantee'],
    ['Talk to a human', 'support']
  ];

  /* Order matters — most specific patterns first. */
  var INTENTS = [
    /* Problems with an existing order go to a human FIRST — before the shipping
       policy answer, which otherwise swallows "my order never arrived". */
    { k: /nev(er|ah) (arrived|came|showed)|not arrived|hasn'?t (arrived|come|shipped)|didn'?t (arrive|come|get)|still waiting|lost|missing|stolen|wrong (item|product|order|address)|damaged|broken|leak|empty bottle|refund my|cancel my|charged twice|double charged/i, r: 'support' },
    { k: /eelhoe|ouzhini|who makes|who manufact|manufacturer|label on|different (brand|name)|not lennox|whose brand/i, r: 'maker' },
    { k: /greas|oily|heavy|weigh (it|my hair) down|residue|buildup|build-up|sticky/i, r: 'greasy' },
    { k: /curl|coil|textur|colou?r[- ]?treated|dyed|bleach|relax|perm|fine hair|thick hair|straight hair|hair type/i, r: 'hairtype' },
    { k: /ingredient|inci|what'?s in it|whats in it|formula|contain|paraben|sulfate|sulphate|silicone|vegan|cruelty|allerg/i, r: 'ingredients' },
    { k: /ship|deliver|arrive|dispatch|track|usps|postage|customs|when (will|would) i get|how long.*(arrive|deliver|ship|take to)/i, r: 'shipping' },
    { k: /refund|guarantee|money[- ]?back|return|risk|if it doesn'?t work|not satisfied/i, r: 'guarantee' },
    { k: /how (do|should) i use|how to use|how much (do|should) i use|apply|application|direction|instruction|wet or dry|how many pumps|routine/i, r: 'howto' },
    { k: /how long until|how long before|see (a )?(difference|result)|does it (really )?work|effective|actually work/i, r: 'results' },
    { k: /how long does (a |one )?bottle|last|how many months|bottle size|100 ?ml|supply|run out/i, r: 'lasts' },
    { k: /scent|smell|fragrance|perfum|odou?r/i, r: 'scent' },
    { k: /subscri|recurring|auto[- ]?ship|cancel|charge me again|monthly/i, r: 'nosub' },
    { k: /price|pricing|cost|how much|\$|cheap|expensive|deal|offer|bogo|buy one|free bottle|discount|promo|coupon/i, r: 'pricing' },
    { k: /repair mask|sleek stick|silk mist|collection|other product|else do you (sell|have)|coming soon|full routine/i, r: 'collection' },
    { k: /support|human|real person|speak to|talk to|contact|customer service|where('?s| is) my order|order (status|issue|problem)|complain/i, r: 'support' },
    { k: /buy|order now|purchase|checkout|check out|shop|add to cart|claim|get it|where can i get/i, r: 'buy' },
    { k: /what is|tell me about|about the|silk serum|the product|explain/i, r: 'what' },
    { k: /thank|thanks|great|awesome|perfect|lovely|cool|nice|ok(ay)?$/i, r: 'thanks' },
    { k: /^(hi|hey|hello|yo|hiya|sup|good (morning|afternoon|evening))\b/i, r: 'hi' }
  ];

  /* ---------- widget ---------- */
  var root, msgs, input;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

  function addMsg(text, who) {
    var m = el('div', 'lcb-msg ' + (who === 'user' ? 'lcb-user' : 'lcb-bot'));
    if (who === 'user') { m.textContent = text; } else { m.innerHTML = text; }
    msgs.appendChild(m);
    scrollDown();
  }

  function addChips(list) {
    var old = msgs.querySelector('.lcb-chips');
    if (old) old.remove();
    var wrap = el('div', 'lcb-chips');
    list.forEach(function (c) {
      var b = el('button', 'lcb-chip', c[0]);
      b.type = 'button';
      b.addEventListener('click', function () {
        addMsg(c[0], 'user');
        wrap.remove();
        route(c[1]);
      });
      wrap.appendChild(b);
    });
    msgs.appendChild(wrap);
    scrollDown();
  }

  function botSay(text, chips) {
    var t = el('div', 'lcb-typing', '<i></i><i></i><i></i>');
    msgs.appendChild(t);
    scrollDown();
    setTimeout(function () {
      t.remove();
      addMsg(text, 'bot');
      if (chips) addChips(chips);
    }, 450 + Math.min(text.length * 3, 650));
  }

  function route(key) {
    var text = T[key] || T.fallback;
    var chips = (key === 'fallback' || key === 'thanks' || key === 'hi') ? CHIPS_MAIN : CHIPS_AFTER;
    botSay(text, chips);
  }

  function handleFree(text) {
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].k.test(text)) { route(INTENTS[i].r); return; }
    }
    route('fallback');
  }

  function send() {
    var v = input.value.trim();
    if (!v) return;
    addMsg(v, 'user');
    input.value = '';
    var chips = msgs.querySelector('.lcb-chips');
    if (chips) chips.remove();
    handleFree(v);
  }

  function toggle(open) {
    var isOpen = root.classList.contains('lcb-open');
    var next = open != null ? open : !isOpen;
    root.classList.toggle('lcb-open', next);
    var l = root.querySelector('.lcb-launcher');
    l.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      if (!msgs.childElementCount) botSay(T.greet, CHIPS_MAIN);
      setTimeout(function () { input.focus(); }, 300);
    }
  }

  /* index.html shows a fixed .sticky-cta buy bar below 760px — exactly where paid
     traffic lands. Lift the widget above it so the launcher never covers the buy
     button. Self-adjusting, so it's a no-op on pages without the bar. */
  function applyLift() {
    var lift = 0;
    var bars = document.querySelectorAll('.sticky-cta');
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i], cs = getComputedStyle(b);
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && cs.position === 'fixed') {
        lift = Math.max(lift, b.offsetHeight);
      }
    }
    root.style.setProperty('--lcb-lift', lift ? (lift + 8) + 'px' : '0px');
  }

  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    root = el('div');
    root.innerHTML =
      '<button class="lcb-launcher" type="button" aria-label="Chat about The Silk Serum" aria-expanded="false">' +
      '<span class="lcb-ring"></span>' +
      '<svg class="lcb-ico-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      '<svg class="lcb-ico-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
      '</button>' +
      '<div class="lcb-panel" role="dialog" aria-label="Lennox Beauty assistant">' +
      '<div class="lcb-head">' +
      '<div class="lcb-avatar">L</div>' +
      '<div class="lcb-head-t"><b>Lennox</b><span><span class="lcb-dot"></span>Replies instantly</span></div>' +
      '<button class="lcb-x" type="button" aria-label="Close chat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
      '<div class="lcb-msgs" aria-live="polite"></div>' +
      '<div class="lcb-foot">' +
      '<input class="lcb-in" type="text" placeholder="Ask about the serum…" aria-label="Ask about the serum" maxlength="300">' +
      '<button class="lcb-send" type="button" aria-label="Send"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></button>' +
      '</div>' +
      '<div class="lcb-brand">Automated assistant · <a href="tel:' + PHONE_TEL + '">text or call ' + PHONE_DISPLAY + '</a></div>' +
      '</div>';
    document.body.appendChild(root);
    applyLift();
    window.addEventListener('resize', applyLift);
    window.addEventListener('orientationchange', applyLift);

    msgs = root.querySelector('.lcb-msgs');
    input = root.querySelector('.lcb-in');
    root.querySelector('.lcb-launcher').addEventListener('click', function () { toggle(); });
    root.querySelector('.lcb-x').addEventListener('click', function () { toggle(false); });
    root.querySelector('.lcb-send').addEventListener('click', send);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('lcb-open')) toggle(false);
    });

    // in-page anchors inside bot messages should close the panel so the target is visible
    msgs.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a && a.getAttribute('href') && a.getAttribute('href').charAt(0) === '#') toggle(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
