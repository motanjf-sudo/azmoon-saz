/* پازمونک: منطق برنامه
 * مسیرها:
 *   /                           صفحه‌ی اصلی
 *   /create                     انتخاب مدل آزمون
 *   /create/<tf|mcq|mixed>      ساخت آزمون
 *   /q/<id>                     شرکت در آزمون
 *   /m/<id>                     مدیریت و نتایج (کلید مدیریت از حساب کاربر خوانده می‌شود، نه از آدرس)
 */
(function () {
  "use strict";

  const cfg = window.AZMOON_CONFIG || {};
  const app = document.getElementById("app");
  const BASE_TITLE = "پازمونک";
  const LIMITS = { title: 200, desc: 2000, text: 500, opt: 300, questions: 100, minOpts: 2, maxOpts: 8 };

  /* نوع سؤال‌ها (فیلد type هر سؤال که به سرور می‌رود) */
  const QTYPES = {
    mcq: { short: "تستی" },
    tf: { short: "درست/نادرست" },
  };

  /* مدل‌های آزمون در صفحه‌ی انتخاب. هر مدل فقط نوع سؤال‌های خودش را می‌پذیرد.
     essay هنوز فعال نیست و فقط با برچسب «به‌زودی» نمایش داده می‌شود. */
  const MODES = {
    tf: { label: "درست / نادرست", desc: "یک جمله می‌نویسید و مشخص می‌کنید درست است یا نادرست.", icon: "check", types: ["tf"] },
    mcq: { label: "تستی", desc: "چندگزینه‌ای؛ هر چند گزینه که بخواهید (۲ تا ۸) و یک پاسخ درست.", icon: "list", types: ["mcq"] },
    essay: { label: "تشریحی", desc: "پاسخ‌های نوشتاری و باز.", icon: "pen", soon: true },
    mixed: { label: "مخلوط", desc: "ترکیبی از سؤال‌های تستی و درست/نادرست در یک آزمون.", icon: "mix", types: ["mcq", "tf"] },
  };
  const ACTIVE_MODES = ["tf", "mcq", "mixed"];

  /* بزرگ‌شدن خودکار کادرهای چندخطی (متن طولانی و فرمول در موبایل بریده نشود) */
  function grow(t) {
    if (!t || !t.isConnected) return;
    t.style.height = "auto";
    if (t.scrollHeight > 0) t.style.height = t.scrollHeight + 2 + "px";
  }
  function autoGrow(t) {
    t.addEventListener("input", () => grow(t));
    requestAnimationFrame(() => requestAnimationFrame(() => grow(t)));
  }
  /* متن ساده‌ی یک سؤال برای عنوان‌های کوتاه: فرمول‌ها با «(فرمول)» جایگزین می‌شوند */
  const plainQ = (t) => String(t == null ? "" : t).replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, " (فرمول) ").replace(/\s+/g, " ").trim();

  const ICONS = {
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="7" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="5" cy="17" r="1.6"/><path d="M10 7h10M10 12h10M10 17h10"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3.2 3.2L12 5.5"/><path d="M13.5 15l5.5 5.5M19 15l-5.5 5.5"/><path d="M20.5 3.5L3.5 20.5" stroke-opacity=".4" stroke-dasharray="1.2 2.4"/></svg>',
    mix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3.5" width="13" height="9" rx="2.2"/><rect x="8" y="11.5" width="13" height="9" rx="2.2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 14l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10l6 6 6-6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  };

  /* ---------- ابزارها ---------- */
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const FA = "۰۱۲۳۴۵۶۷۸۹";
  const faNum = (n) => String(n).replace(/\d/g, (d) => FA[d]);
  /* هر نوع ناشناخته (مثلاً آزمون‌های قدیمی) چندگزینه‌ای حساب می‌شود */
  const typeOf = (t) => (t === "tf" ? "tf" : "mcq");

  function randomSecret() {
    const a = new Uint8Array(24);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function baseUrl() {
    return location.origin;
  }

  /* ---------- مسیرها: آدرس‌های تمیز (/q/abc) بدون # ---------- */
  const curPath = () => location.pathname + location.search;
  const isHomePath = () => location.pathname === "/" || location.pathname === "";
  /* کلید مدیریتِ آزمون‌هایی که همین لحظه ساخته یا با لینک قدیمی باز شده‌اند (فقط در حافظه‌ی همین صفحه) */
  const memSecrets = {};
  /* لینک‌های قدیمی (#/q/abc، #/m/abc/کلید) به آدرس تمیز تبدیل می‌شوند */
  function upgradeLegacy() {
    const h = location.hash;
    if (!/^#\//.test(h)) return;
    const hp = h.slice(1).split("?");
    const parts = hp[0].split("/").filter(Boolean);
    if ((parts[0] === "m" || parts[0] === "edit") && parts[1] && /^[A-Za-z0-9]{16,128}$/.test(parts[2] || "")) {
      memSecrets[safeDecode(parts[1])] = parts[2];
      parts.length = 2;
    }
    const q = hp[1] ? "?" + hp[1] : location.search;
    try { history.replaceState(null, "", "/" + parts.join("/") + q); } catch (e) { /* ignore */ }
  }
  /* رفتن به یک مسیر داخلی بدون بارگذاری دوباره‌ی صفحه */
  function go(to, replace) {
    to = String(to || "/");
    if (to.charAt(0) !== "/") to = "/" + to;
    if (genLockHash !== null) return;
    if (to === curPath()) { window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" }); return; }
    try { history[replace ? "replaceState" : "pushState"](null, "", to); } catch (e) { location.assign(to); return; }
    window.dispatchEvent(new Event("pz:nav"));
    route();
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ساخت سریع عنصر DOM (بدون innerHTML، پس برای متن کاربر امن است) */
  function el(tag, props, kids) {
    const n = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k === "html") n.innerHTML = v; /* فقط برای آیکون‌های ثابت */
        else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
        else if (k === "value" || k === "checked" || k === "disabled") n[k] = v;
        else n.setAttribute(k, v === true ? "" : v);
      }
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach((c) => { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }


  /* ---------- نمایش فرمول‌های ریاضی (LaTeX) با KaTeX؛ فقط وقتی متنی علامت $ دارد بارگذاری می‌شود ---------- */
  const KATEX = "https://cdnjs.cloudflare.com/ajax/libs/katex/0.16.11/";
  let katexP = null;
  function loadKatex() {
    if (window.renderMathInElement) return Promise.resolve(true);
    if (katexP) return katexP;
    const addScript = (src) => new Promise((res, rej) => {
      const n = document.createElement("script");
      n.src = src;
      n.onload = () => res();
      n.onerror = () => { n.remove(); rej(new Error("load")); };
      document.head.appendChild(n);
    });
    const addCss = (href) => new Promise((res, rej) => {
      const n = document.createElement("link");
      n.rel = "stylesheet";
      n.href = href;
      n.onload = () => res();
      n.onerror = () => rej(new Error("load"));
      document.head.appendChild(n);
    });
    /* اول فایل داخل خود سایت (katex-bundle.js، همه‌چیز در یک فایل) که بعد از بار اول در حافظه‌ی مرورگر (Cache Storage) می‌ماند تا دفعه‌های بعد فوری بالا بیاید؛ اگر نبود از cdnjs (با مهلت کوتاه) */
    const timed = (p, ms) => Promise.race([p, new Promise((res, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
    const bundleCached = async () => {
      const KV = "katex-bundle-0.16.11";
      if (!("caches" in window)) throw new Error("nocache");
      const c = await caches.open("pz-katex");
      let r = await c.match(KV);
      if (!r) {
        const n = await timed(fetch("/katex-bundle.js"), 25000);
        if (!n.ok) throw new Error("http");
        try { await c.put(KV, n.clone()); } catch (e) { /* ignore */ }
        r = n;
      }
      const code = await r.text();
      if (code.length < 100000) { try { await c.delete(KV); } catch (e) { /* ignore */ } throw new Error("bad"); }
      const u = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      try { await addScript(u); } finally { URL.revokeObjectURL(u); }
    };
    katexP = bundleCached()
      .catch(() => addScript("/katex-bundle.js"))
      .catch(() => timed(addCss(KATEX + "katex.min.css").then(() => addScript(KATEX + "katex.min.js")).then(() => addScript(KATEX + "contrib/auto-render.min.js")), 10000))
      .then(() => !!window.renderMathInElement)
      .catch(() => false)
      .then((ok) => { if (!ok) katexP = null; return ok; });
    return katexP;
  }
  /* $...$ فقط وقتی فرمول حساب می‌شود که داخلش نشانه‌ی ریاضی باشد (تا «۵ دلار و ۱۰ دلار» خراب نشود) */
  function normalizeMath(t) {
    /* آزمون‌های قدیمی: \f و \t و \b داخل فرمول به‌اشتباه کاراکتر کنترلی شده‌اند */
    t = t.replace(/\$[^$\n]*\$/g, (seg) => seg.replace(/\f/g, "\\f").replace(/\t/g, "\\t").replace(/\x08/g, "\\b").replace(/\r/g, "\\r"));
    const clean = (a) => a.replace(/\\[()[\]]/g, "").trim();
    /* داخل $...$ وقتی فرمول حساب می‌شود که حرف فارسی/عربی نداشته باشد و نشانه‌ی ریاضی (عملگر، پرانتز، توان…) یا فقط یک متغیر/عدد باشد */
    const isMath = (a) =>
      !/[\u0600-\u06FF]/.test(a) && a.trim() !== "" &&
      (/[\\^_{}=+\-*/<>()×÷]/.test(a) || /^\s*([A-Za-z]|-?\d+([.,]\d+)?)\s*$/.test(a));
    return t
      .replace(/\$\$([\s\S]+?)\$\$/g, (m, a) => (isMath(a) ? "\\[" + clean(a) + "\\]" : m))
      .replace(/\$([^$\n]+?)\$/g, (m, a) => (isMath(a) ? "\\(" + clean(a) + "\\)" : m));
  }
  function renderMath(root) {
    if (!root || !/[$\\]/.test(root.textContent || "")) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/^(INPUT|TEXTAREA|SCRIPT|STYLE|OPTION)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    let any = false;
    nodes.forEach((n) => {
      if (n.data.indexOf("$") < 0) return;
      const v = normalizeMath(n.data);
      if (v !== n.data) { n.data = v; any = true; }
    });
    if (!any && !/\\[(\[]/.test(root.textContent)) return;
    loadKatex().then((ok) => {
      if (!root.isConnected) return;
      if (!ok || !window.renderMathInElement) {   /* بارگذاری فرمول‌ها نشد (اینترنت ضعیف): چند بار دیگر، با فاصله، دوباره تلاش می‌شود */
        const n = (root._mrt = (root._mrt || 0) + 1);
        if (n <= 4) setTimeout(() => renderMath(root), 3000 * n);
        return;
      }
      try {
        window.renderMathInElement(root, {
          delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }],
          throwOnError: false,
          ignoredTags: ["script", "style", "textarea", "input", "option", "pre", "code"],
        });
      } catch (e) { /* ignore */ }
    });
  }

  const tokenOf = () => { const a = auth.get(); return a ? a.token : null; };

  async function rpc(name, args) {
    let res;
    try {
      res = await fetch(cfg.SUPABASE_URL + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(args),
      });
    } catch (e) {
      throw new Error("ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.");
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* بدنه‌ی خالی */ }
    if (!res.ok) {
      const msg = (data && (data.message || data.hint)) || "خطایی رخ داد (" + res.status + ")";
      if (/دوباره وارد شوید/.test(msg)) auth.clear();   /* نشست منقضی یا نامعتبر است */
      throw new Error(msg);
    }
    return data;
  }

  /* اگر حافظه‌ی مرورگر بسته یا پر باشد (حالت خصوصی/مسدود)، داده‌ها دست‌کم تا بسته شدن همین زبانه در حافظه می‌مانند تا ورود و پیش‌نویس کار کند */
  const memStore = Object.create(null);
  const store = {
    get(k, d) {
      if (k in memStore) return memStore[k];
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); delete memStore[k]; return true; } catch (e) { memStore[k] = v; return false; }
    },
    del(k) {
      delete memStore[k];
      try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    },
    addQuiz(item) {
      const l = this.get("myQuizzes", []).filter((x) => x && x.id !== item.id);
      l.unshift(item);
      this.set("myQuizzes", l.slice(0, 50));
    },
    removeQuiz(id) {
      this.set("myQuizzes", this.get("myQuizzes", []).filter((x) => x && x.id !== id));
    },
    localQuizzes() {
      return this.get("myQuizzes", []).filter((m) => m && m.id && m.secret);
    },
  };

  /* ذخیره‌ی آزمون: اگر کاربر وارد شده باشد روی حساب (شماره‌اش) ذخیره می‌شود، وگرنه روی همین دستگاه.
     اگر ذخیره روی حساب نشد (مثلاً قطعی اینترنت)، آزمون روی دستگاه نگه داشته می‌شود تا گم نشود. */
  async function keepQuiz(item) {
    const s = auth.get();
    if (s) {
      try {
        const r = await rpc("account_claim", { p_token: s.token, p_id: item.id, p_secret: item.secret });
        if (r && r.ok) { store.removeQuiz(item.id); return; }
        if (r && r.error === "no_session") auth.clear();
      } catch (e) { /* روی دستگاه نگه می‌داریم */ }
    }
    store.addQuiz(item);
  }

  /* انتقال آزمون‌های روی دستگاه به حساب + خواندن فهرست حساب */
  let accountJob = null;
  function loadAccountQuizzes(s) {
    if (accountJob) return accountJob;
    accountJob = (async () => {
      try {
        for (const m of store.localQuizzes()) {
          let r;
          try { r = await rpc("account_claim", { p_token: s.token, p_id: m.id, p_secret: m.secret }); } catch (e) { return { items: [], error: true }; }
          if (r && r.ok) store.removeQuiz(m.id);
          else if (r && r.error === "no_session") { auth.clear(); return { items: [], loggedOut: true }; }
          else if (r && (r.error === "not_found" || r.error === "bad_secret")) store.removeQuiz(m.id);
        }
        let r;
        try { r = await rpc("account_quizzes", { p_token: s.token }); } catch (e) { return { items: [], error: true }; }
        if (r && r.ok && Array.isArray(r.items)) return { items: r.items };
        if (r && r.error === "no_session") { auth.clear(); return { items: [], loggedOut: true }; }
        return { items: [], error: true };
      } finally {
        accountJob = null;
      }
    })();
    return accountJob;
  }

  function setTitle(t) {
    document.title = t ? t + " | " + BASE_TITLE : "ساخت آزمون آنلاین با هوش مصنوعی | " + BASE_TITLE;
  }

  function copyHandlers(root) {
    root.querySelectorAll("[data-copy]").forEach((b) => {
      b.addEventListener("click", async () => {
        const input = root.querySelector(b.dataset.copy);
        if (!input) return;
        try { await navigator.clipboard.writeText(input.value); } catch (e) { input.select(); try { document.execCommand("copy"); } catch (e2) { /* ignore */ } }
        const old = b.textContent;
        b.textContent = "کپی شد ✓";
        setTimeout(() => { b.textContent = old; }, 1500);
      });
    });
  }

  /* ---------- نمایش خطا / راه‌اندازی ---------- */
  function showError(text, retry) {
    app.innerHTML =
      '<div class="err" role="alert">' + esc(text) + "</div>" +
      '<div class="actions">' +
      (retry ? '<button class="btn" type="button" id="retry">تلاش دوباره</button>' : "") +
      '<a class="btn ghost" href="/">بازگشت به صفحه‌ی اصلی</a></div>';
    if (retry) document.getElementById("retry").addEventListener("click", retry);
  }

  function showSetup() {
    setTitle();
    app.innerHTML =
      "<h1>راه‌اندازی لازم است</h1>" +
      '<div class="warn">مقدارهای <code>SUPABASE_URL</code> و <code>SUPABASE_ANON_KEY</code> در فایل <code>config.js</code> پر نشده‌اند. مراحل در فایل README.md توضیح داده شده است.</div>';
  }

  /* ---------- صفحه‌ی اصلی ---------- */
  let homeTok = null;
  const isHomeHash = isHomePath;

  /* فهرست آزمون‌های من: ۵ آزمونِ تازه دیده می‌شود و بقیه با اسکرول داخل همان کادر؛ جستجو بر اساس نام */
  const MINE_VIS = 5;
  const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
  const nrm = (v) => String(v == null ? "" : v).toLowerCase()
    .replace(/[\u064A\u0649]/g, "ی").replace(/\u0643/g, "ک").replace(/[\u0622\u0623\u0625]/g, "ا").replace(/\u0629/g, "ه")
    .replace(/[\u200c\u200d\u064B-\u065F\u0640]/g, "")
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/\s+/g, " ").trim();
  const mineRow = (m) =>
    '<div class="mine-row"><span class="mine-t">' + esc(m.title) +
    (m.participants != null ? '<small class="mine-n">' + faNum(m.participants) + " شرکت‌کننده</small>" : "") + "</span>" +
    '<a class="btn small ghost" href="/q/' + encodeURIComponent(m.id) + '">باز کردن</a>' +
    '<a class="btn small" href="/m/' + encodeURIComponent(m.id) + '">نتایج</a>' +
    '<button class="mine-del" type="button" data-id="' + esc(m.id) + '" aria-label="پاک کردن آزمون «' + esc(m.title) + '»" title="پاک کردن آزمون">' + CROSS + "</button></div>";
  function mineMore(l) { l.classList.toggle("more", l.scrollHeight - l.scrollTop - l.clientHeight > 3 && !!l.style.maxHeight); }
  function mineFit() {
    const l = document.getElementById("mineList");
    if (!l) return;
    l.style.maxHeight = "";
    const r = l.children;
    if (r.length > MINE_VIS) {
      const a = r[0], b = r[MINE_VIS - 1];
      l.style.maxHeight = (b.offsetTop - a.offsetTop + b.offsetHeight + 22) + "px";
    }
    mineMore(l);
  }
  window.addEventListener("resize", mineFit);

  function viewHome() {
    setTitle();
    const sess = auth.get();
    homeTok = sess ? sess.token : "";

    const draw = (items, note) => {
      if (!items.length) {
        app.innerHTML =
          (note || "") +
          '<div class="card empty">' + ICONS.doc +
          "<h2>هنوز آزمونی نساخته‌اید</h2>" +
          '<p class="muted">با چند کلیک اولین آزمون خود را بسازید و لینکش را برای دیگران بفرستید.</p>' +
          '<div class="actions" style="justify-content:center"><a class="btn" href="/create">ساخت اولین آزمون</a>' + (sess ? '<a class="btn ghost" href="/groups">گروه‌ها</a>' : "") + "</div></div>";
        return;
      }
      items = items.slice();
      const rowsOf = () => items.map((m) => ({ m: m, n: nrm(m.title) }));
      app.innerHTML =
        (note || "") +
        '<div class="card"><div class="sec-t"><h2>' + (sess ? "آزمون‌های شما" : "آزمون‌هایی که روی این دستگاه ساخته‌اید") + '</h2><span class="badge" id="mineCnt" aria-live="polite">' + faNum(items.length) + "</span></div>" +
        (items.length > MINE_VIS
          ? '<div class="mine-search"><input type="text" id="mineQ" inputmode="search" enterkeyhint="search" autocomplete="off" spellcheck="false" maxlength="80" placeholder="جستجوی نام آزمون…" aria-label="جستجوی نام آزمون" aria-controls="mineList">' +
            '<button class="mine-clear" id="mineClr" type="button" aria-label="پاک کردن جستجو" hidden>×</button></div>'
          : "") +
        '<div class="err" id="mineErr" role="alert" hidden></div>' +
        '<div class="mine-list" id="mineList" tabindex="-1">' + items.map(mineRow).join("") + "</div>" +
        '<p class="muted mine-none" id="mineNone" role="status" hidden>آزمونی با این نام پیدا نشد.</p>' +
        (sess ? "" : '<p class="hint">این آزمون‌ها فقط روی همین دستگاه هستند. برای اینکه روی حسابتان بمانند و از هر دستگاهی ببینیدشان، <a href="/signup">وارد شوید یا ثبت‌نام کنید</a>.</p>') +
        "</div>" +
        '<div class="actions"><a class="btn" href="/create">ساخت آزمون جدید</a>' + (sess ? '<a class="btn ghost" href="/groups">گروه‌ها</a>' : "") + "</div>";
      const list = document.getElementById("mineList"), inp = document.getElementById("mineQ"), clr = document.getElementById("mineClr");
      const none = document.getElementById("mineNone"), cnt = document.getElementById("mineCnt");
      list.addEventListener("scroll", () => mineMore(list), { passive: true });
      const apply = (keepScroll) => {
        const all = rowsOf();
        const words = inp ? nrm(inp.value).split(" ").filter(Boolean) : [];
        const vis = words.length ? all.filter((r) => words.every((w) => r.n.indexOf(w) >= 0)) : all;
        const top = list.scrollTop;
        list.innerHTML = vis.map((r) => mineRow(r.m)).join("");
        list.scrollTop = keepScroll === true ? top : 0;
        list.hidden = !vis.length;
        none.hidden = vis.length > 0;
        cnt.textContent = words.length ? faNum(vis.length) + " از " + faNum(items.length) : faNum(items.length);
        if (clr) clr.hidden = !inp.value;
        mineFit();
      };
      if (inp) {
        inp.addEventListener("input", () => apply());
        inp.addEventListener("keydown", (e) => { if (e.key === "Escape" && inp.value) { e.preventDefault(); inp.value = ""; apply(); } });
        clr.addEventListener("click", () => { inp.value = ""; apply(); inp.focus(); });
      }
      /* پاک کردن آزمون: اول تأیید می‌گیرد، بعد از سرور و از فهرست پاکش می‌کند */
      const errBox = document.getElementById("mineErr");
      const deleting = new Set();
      list.addEventListener("click", async (e) => {
        const btn = e.target.closest && e.target.closest(".mine-del");
        if (!btn || !list.contains(btn)) return;
        const id = btn.getAttribute("data-id");
        const m = items.find((x) => x.id === id);
        if (!m || deleting.has(id)) return;
        errBox.hidden = true;
        const nm = cleanName(m.title) || "بدون عنوان";
        const yes = await askConfirm({
          title: "مطمئنید که می‌خواهید آزمون «" + nm + "» پاک شود؟",
          text: "این آزمون با همه‌ی نتایج و پاسخ‌های شرکت‌کنندگانش برای همیشه پاک می‌شود و لینکش دیگر کار نمی‌کند. این کار برگشت ندارد.",
          yes: "بله، پاک شود", danger: true,
        });
        if (!yes || !list.isConnected) return;
        deleting.add(id);
        const cur = list.querySelector('.mine-del[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
        if (cur) { cur.disabled = true; cur.classList.add("loading"); }
        try {
          await rpc("quiz_delete", { p_id: m.id, p_secret: m.secret });
        } catch (er) {
          deleting.delete(id);
          if (!list.isConnected) return;
          if (cur && cur.isConnected) { cur.disabled = false; cur.classList.remove("loading"); }
          errBox.textContent = /دسترسی نامعتبر/.test(er.message) ? "اجازه‌ی پاک کردن این آزمون را ندارید." : (er.message || "پاک کردن انجام نشد. دوباره تلاش کنید.");
          errBox.hidden = false;
          return;
        }
        deleting.delete(id);
        store.removeQuiz(id);
        if (!list.isConnected) return;
        items = items.filter((x) => x.id !== id);
        if (!items.length) { draw([], note); return; }
        apply(true);
        try { (inp && inp.value ? inp : list).focus({ preventScroll: true }); } catch (e2) { /* ignore */ }
      });
      mineFit();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(mineFit).catch(() => {});
    };

    if (!sess) { draw(store.localQuizzes(), ""); return; }

    const my = routeToken;
    app.innerHTML = '<div class="card"><p class="muted">در حال بارگذاری آزمون‌های شما…</p></div>';
    loadAccountQuizzes(sess).then((res) => {
      /* اگر در این فاصله صفحه عوض شد یا کاربر خارج/وارد حساب دیگری شد، فهرست قبلی نشان داده نشود */
      if (my !== routeToken || (auth.get() || {}).token !== sess.token) return;
      const left = store.localQuizzes().filter((m) => !res.items.some((x) => x.id === m.id));
      let note = "";
      if (res.error) note = '<div class="card warn-card"><strong>فهرست حساب‌تان الان بارگذاری نشد.</strong><div class="hint">اتصال اینترنت را بررسی کنید و صفحه را دوباره باز کنید. آزمون‌هایتان گم نشده‌اند.</div></div>';
      else if (left.length) note = '<div class="hint">بعضی آزمون‌ها هنوز فقط روی این دستگاه هستند و بعداً به حساب منتقل می‌شوند.</div>';
      draw(left.concat(res.items), note);
    });
  }

  /* با ورود یا خروج کاربر، فهرست صفحه‌ی اصلی دوباره ساخته می‌شود */
  window.addEventListener("authchange", () => {
    const cur = (auth.get() || {}).token || "";
    if (isHomeHash() && cur !== homeTok && cfg.SUPABASE_URL) viewHome();
    else if (!cur && /^\/(create|q\/|groups|g\/)/.test(location.pathname) && !gateOn && genLockHash === null && cfg.SUPABASE_URL) route();
  });

  /* ---------- انتخاب مدل آزمون ---------- */
  /* ---------- زمان آزمون (به دقیقه؛ خالی یعنی بدون زمان) ---------- */
  const DUR_MAX = 600;
  const durNum = (t) => {
    const x = String(t == null ? "" : t).replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
    return x ? Math.min(DUR_MAX, parseInt(x, 10)) : 0;
  };
  const okDur = (v) => (Number.isInteger(v) && v >= 1 && v <= DUR_MAX ? v : null);
  const durUp = (v) => (v < 10 ? v + 1 : (Math.floor(v / 5) + 1) * 5);
  const durDown = (v) => (v <= 10 ? v - 1 : (Math.ceil(v / 5) - 1) * 5);
  const DUR_HINT = {
    none: "بدون محدودیت زمان؛ هر کس هر وقت بخواهد پاسخ می‌دهد.",
    set: "با زدن «شروع آزمون» تایمر شروع می‌شود و با تمام‌شدن زمان، پاسخ‌ها خودکار ثبت می‌شود.",
    auto: "هوش مصنوعی بر اساس تعداد و سختی سؤال‌ها زمان مناسب را انتخاب می‌کند؛ بعداً می‌توانید تغییرش دهید.",
  };
  /* پیشنهاد زمان از روی خود سؤال‌ها (اگر هوش مصنوعی زمانی نداده بود) */
  function estimateMinutes(qs, level) {
    const per = { tf: [20, 30, 40], mcq: [40, 60, 90] }, li = level === "easy" ? 0 : level === "hard" ? 2 : 1;
    let sec = 0;
    qs.forEach((q) => { sec += per[q.type === "tf" ? "tf" : "mcq"][li] + (String(q.text).indexOf("$") >= 0 ? 30 : 0); });
    let d = Math.max(1, Math.ceil(sec / 60));
    if (d > 30) d = Math.ceil(d / 5) * 5;
    return Math.min(DUR_MAX, d);
  }
  function durHtml(modes, mode, minutes) {
    const L = { none: "بدون زمان", set: modes.indexOf("auto") >= 0 ? "دلخواه" : "زمان‌دار", auto: "خودکار" };
    return '<div class="dur"><label id="durLbl">زمان آزمون</label>' +
      '<div class="seg" role="group" aria-labelledby="durLbl" id="durSeg">' +
      modes.map((m) => '<button type="button" data-v="' + m + '" aria-pressed="' + String(m === mode) + '">' + L[m] + "</button>").join("") + "</div>" +
      '<div class="dur-set" id="durSet"' + (mode === "set" ? "" : " hidden") + '><div class="stepper"><button type="button" id="durM" aria-label="کمتر">−</button>' +
      '<input id="durIn" type="text" inputmode="numeric" autocomplete="off" value="' + faNum(minutes) + '" aria-label="زمان آزمون به دقیقه"><button type="button" id="durP" aria-label="بیشتر">+</button></div>' +
      '<span class="dur-unit">دقیقه</span></div><p class="hint dur-hint" id="durHint" aria-live="polite">' + DUR_HINT[mode] + "</p></div>";
  }
  function durBind(root, mode, minutes, onChange) {
    const st = { mode: mode, min: minutes };
    const q = (id) => root.querySelector("#" + id);
    const seg = q("durSeg"), set = q("durSet"), inp = q("durIn"), hint = q("durHint");
    const cur = () => Math.min(DUR_MAX, Math.max(1, durNum(inp.value) || st.min));
    const fire = () => { if (onChange) onChange(); };
    const setMin = (v) => { st.min = Math.min(DUR_MAX, Math.max(1, v)); inp.value = faNum(st.min); fire(); };
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !seg.contains(b)) return;
      st.mode = b.dataset.v;
      seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      set.hidden = st.mode !== "set";
      hint.textContent = DUR_HINT[st.mode];
      fire();
    });
    q("durM").addEventListener("click", () => setMin(durDown(cur())));
    q("durP").addEventListener("click", () => setMin(durUp(cur())));
    inp.addEventListener("blur", () => setMin(cur()));
    inp.addEventListener("input", () => { const v = durNum(inp.value); if (v) { st.min = v; fire(); } });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
    return { mode: () => st.mode, min: cur };
  }

  function draftInfo() {
    const d = store.get("quizDraft", null);
    if (!d || !Array.isArray(d.questions) || ACTIVE_MODES.indexOf(d.type) < 0) return null;
    const meaningful = (d.title && String(d.title).trim()) || d.questions.some((q) => q && q.text && String(q.text).trim());
    return meaningful ? d : null;
  }

  function viewChoose() {
    setTitle("ساخت آزمون");
    const draft = draftInfo();
    const demo = {
      tf: '<div class="demo two"><span class="on">درست</span><span>نادرست</span></div>',
      mcq: '<div class="demo"><span>تهران</span><span class="on">اصفهان</span><span>شیراز</span><span>تبریز</span></div>',
      essay: '<div class="demo"><span class="lines"></span></div>',
      mixed: '<div class="demo two"><span class="on">تستی</span><span class="on">درست / نادرست</span></div>',
    };
    const card = (m) => {
      const M = MODES[m];
      const inner = '<span class="ti">' + ICONS[M.icon] + "</span><h3>" + esc(M.label) + (M.soon ? ' <span class="soon-badge">به‌زودی</span>' : "") + "</h3><p>" + esc(M.desc) + "</p>" + demo[m];
      return M.soon
        ? '<div class="card type-card soon" aria-disabled="true">' + inner + "</div>"
        : '<a class="card type-card" href="' + withG("/create/" + m) + '" data-base="/create/' + m + '">' + inner + "</a>";
    };
    app.innerHTML =
      '<a class="back" href="/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a>" +
      "<h1>چه مدل آزمونی می‌خواهید؟</h1>" +
      '<p class="muted">یکی از مدل‌ها را انتخاب کنید. در مرحله‌ی بعد سؤال‌ها را می‌نویسید.</p>' +
      (draft
        ? '<div class="card draft"><div><strong>پیش‌نویس ذخیره‌شده دارید</strong><div class="hint">' + (draft.title ? esc(draft.title) + " — " : "") + faNum(draft.questions.length) + ' سؤال</div></div>' +
          '<div class="draft-actions"><a class="btn small" href="' + withG("/create/" + draft.type + "?draft=1") + '" data-base="/create/' + draft.type + '?draft=1">ادامه‌ی پیش‌نویس</a>' +
          '<button class="btn small danger" type="button" id="dropDraft">حذف</button></div></div>'
        : "") +
      '<div class="card aud"><strong>این آزمون برای چه کسانی است؟</strong>' +
      '<div class="seg" role="group" aria-label="مخاطب آزمون"><button type="button" data-aud="pub" aria-pressed="' + (!createGroup) + '">همه (عمومی)</button><button type="button" data-aud="grp" aria-pressed="' + (!!createGroup) + '">فقط یک گروه</button></div>' +
      '<p class="hint" id="audHint" style="margin:6px 0 0"></p><div id="audSel" hidden></div></div>' +
      '<div class="types" id="typesBox"><a class="card type-card ai-card" href="' + withG("/create/ai") + '" data-base="/create/ai"><span class="ti">' + ICONS.spark + '</span><h3>ساخت با هوش مصنوعی <span class="soon-badge ai-badge">جدید</span></h3>' +
      "<p>موضوع را بنویسید یا فایل جزوه‌تان را بدهید؛ آزمون خودکار ساخته می‌شود و لینکش را همان‌جا می‌گیرید. هر سؤال ۱ پولک است.</p></a>" +
      ["tf", "mcq", "essay", "mixed"].map(card).join("") + "</div>";
    const dropBtn = document.getElementById("dropDraft");
    if (dropBtn) dropBtn.addEventListener("click", () => { store.del("quizDraft"); viewChoose(); });

    /* انتخاب مخاطب: عمومی یا یکی از گروه‌هایی که مالک یا مدیرش هستید */
    const myTok = routeToken;
    const typesBox = document.getElementById("typesBox"), hint = document.getElementById("audHint"), selBox = document.getElementById("audSel");
    let owned = null;           /* null = هنوز بارگذاری نشده */
    let loadFailed = false;
    let grpMode = !!createGroup;
    const applyLinks = () => {
      app.querySelectorAll("a[data-base]").forEach((a) => a.setAttribute("href", withG(a.dataset.base)));
      const locked = grpMode && !createGroup;
      if (locked) typesBox.setAttribute("inert", ""); else typesBox.removeAttribute("inert");
    };
    const renderAud = () => {
      app.querySelectorAll("button[data-aud]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.aud === "grp") === grpMode)));
      if (!grpMode) { hint.textContent = "هر کسی که لینک آزمون را داشته باشد و ثبت‌نام کرده باشد می‌تواند شرکت کند."; selBox.hidden = true; applyLinks(); return; }
      hint.textContent = "فقط اعضای گروه می‌توانند آزمون را ببینند و بدهند.";
      selBox.hidden = false;
      if (loadFailed) {
        selBox.innerHTML = '<div class="err" role="alert">فهرست گروه‌ها بارگذاری نشد.</div><button class="btn small ghost" type="button" id="audRetry">تلاش دوباره</button>';
        document.getElementById("audRetry").addEventListener("click", loadOwned);
      } else if (owned === null) {
        selBox.innerHTML = '<p class="hint">در حال بارگذاری گروه‌ها…</p>';
      } else if (!owned.length) {
        selBox.innerHTML = '<p class="hint">شما هنوز گروهی نساخته‌اید.</p><a class="btn small" href="/groups">ساخت گروه</a>';
      } else {
        selBox.innerHTML = '<label for="audGroup" class="hint">گروه:</label><select id="audGroup">' + owned.map((g) => '<option value="' + esc(g.id) + '"' + (g.id === createGroup ? " selected" : "") + ">" + esc(g.name) + "</option>").join("") + "</select>";
        const sel = document.getElementById("audGroup");
        if (!createGroup) createGroup = sel.value;
        sel.addEventListener("change", () => { createGroup = sel.value; applyLinks(); });
      }
      applyLinks();
    };
    const loadOwned = async () => {
      loadFailed = false;
      try {
        const gs = await ensureGroups(true);
        if (myTok !== routeToken) return;
        owned = gs.filter((g) => g.role === "owner" || g.role === "manager");
        if (createGroup && !owned.some((g) => g.id === createGroup)) { createGroup = ""; if (grpMode && owned.length) createGroup = owned[0].id; }
      } catch (e) { if (myTok !== routeToken) return; loadFailed = true; }
      renderAud();
    };
    app.querySelectorAll("button[data-aud]").forEach((b) => b.addEventListener("click", () => {
      grpMode = b.dataset.aud === "grp";
      if (!grpMode) createGroup = "";
      else if (owned && owned.length && !createGroup) createGroup = owned[0].id;
      renderAud();
    }));
    renderAud();
    loadOwned();
  }

  /* ---------- سازنده‌ی آزمون ---------- */
  function viewBuild(mode, wantDraft, edit) {
    const M = MODES[mode];
    const allowed = M.types;
    const mixed = allowed.length > 1;
    setTitle(edit ? "ویرایش آزمون" : "ساخت آزمون " + M.label);
    if (!edit) setTimeout(fillGroupChip, 0);
    const backHref = edit ? "/m/" + encodeURIComponent(edit.id) : withG("/create");
    let nSubs = edit ? edit.submissions : 0;

    let uid = 0;
    const questions = [];
    const newQ = (t) => ({ id: ++uid, type: t, text: "", options: ["", "", "", ""], correct: null, tf: null });
    let titleVal = "";
    let descVal = "";
    let restored = false;
    let durInit = null;      /* زمان آزمون در لحظه‌ی باز شدن صفحه (دقیقه یا null) */
    let durCtl = null;

    if (edit) {
      titleVal = String(edit.title || "").slice(0, LIMITS.title);
      descVal = String(edit.description || "").slice(0, LIMITS.desc);
      durInit = okDur(edit.duration);
      edit.questions.slice(0, LIMITS.questions).forEach((s) => {
        if (!s) return;
        const q = newQ(s.type === "tf" ? "tf" : "mcq");
        q.text = String(s.text || "").slice(0, LIMITS.text);
        const c = Number.isInteger(s.correct) ? s.correct : null;
        if (q.type === "tf") q.tf = c === 0 || c === 1 ? c : null;
        else {
          if (Array.isArray(s.options) && s.options.length >= LIMITS.minOpts) q.options = s.options.slice(0, LIMITS.maxOpts).map((o) => String(o).slice(0, LIMITS.opt));
          q.correct = c != null && c >= 0 && c < q.options.length ? c : null;
        }
        questions.push(q);
      });
    } else if (wantDraft) {
      const d = draftInfo();
      if (d && d.type === mode) {
        restored = true;
        titleVal = String(d.title || "").slice(0, LIMITS.title);
        descVal = String(d.description || "").slice(0, LIMITS.desc);
        durInit = okDur(d.duration);
        d.questions.slice(0, LIMITS.questions).forEach((s) => {
          if (!s) return;
          const t = allowed.indexOf(s.type) >= 0 ? s.type : allowed[0];
          const q = newQ(t);
          q.text = String(s.text || "").slice(0, LIMITS.text);
          if (Array.isArray(s.options) && s.options.length >= LIMITS.minOpts) q.options = s.options.slice(0, LIMITS.maxOpts).map((o) => String(o).slice(0, LIMITS.opt));
          q.correct = Number.isInteger(s.correct) && s.correct >= 0 && s.correct < q.options.length ? s.correct : null;
          q.tf = s.tf === 0 || s.tf === 1 ? s.tf : null;
          questions.push(q);
        });
      }
    }
    if (!questions.length) questions.push(newQ(allowed[0]));

    app.innerHTML =
      '<a class="back" href="' + backHref + '">' + ICONS.back + (edit ? " بازگشت به نتایج و لینک‌ها" : " بازگشت به انتخاب مدل") + "</a>" +
      (edit ? "<h1>ویرایش آزمون</h1>" : "<h1>ساخت آزمون</h1>" + (createGroup ? '<div id="grpChipBox">' + groupChip(groupName(createGroup)) + "</div>" : "")) +
      (edit
        ? '<p class="muted">سؤال‌ها، گزینه‌ها و پاسخ درست را تغییر دهید. لینک آزمون همان می‌ماند.</p>'
        : '<p class="muted">مدل انتخابی: <span class="badge">' + esc(M.label) + "</span> — سؤال‌ها را بنویسید و پاسخ درست را مشخص کنید. پیش‌نویس شما خودکار ذخیره می‌شود.</p>") +
      (edit && nSubs > 0
        ? '<div class="card warn-card" role="alert"><strong>⚠️ این آزمون تا الان ' + faNum(nSubs) + " شرکت‌کننده داشته است.</strong>" +
          "<p>با ذخیره‌ی تغییرات، <b>همه‌ی نتایج قبلی برای همیشه پاک می‌شوند</b>، چون با سؤال‌های جدید قابل مقایسه نیستند. اگر نمی‌خواهید نتایج از بین برود، ویرایش نکنید.</p>" +
          '<label class="chk"><input type="checkbox" id="confirmClear"><span>متوجه‌ام و می‌خواهم نتایج قبلی پاک شوند</span></label></div>'
        : "") +
      (restored ? '<div class="card draft" id="restoredNote"><div><strong>پیش‌نویس قبلی بازیابی شد</strong></div><div class="draft-actions"><button class="btn small danger" type="button" id="freshBtn">شروع تازه</button></div></div>' : "") +
      '<div class="card" id="meta">' +
      '<label for="title">عنوان آزمون</label><input id="title" type="text" maxlength="' + LIMITS.title + '" autocomplete="off">' +
      '<label for="desc">توضیح (اختیاری)</label><textarea id="desc" maxlength="' + LIMITS.desc + '"></textarea></div>' +
      '<div class="card dur-card">' + durHtml(["none", "set"], durInit ? "set" : "none", durInit || 20) + "</div>" +
      '<div id="qs"></div>' +
      '<div class="card add-card"><span class="add-lbl">افزودن سؤال:</span><div class="add-btns" id="addBtns"></div></div>' +
      '<div id="msg"></div>' +
      '<div class="actions"><a class="btn ghost" href="' + backHref + '">' + ICONS.back + ' بازگشت</a><button class="btn" id="save" type="button">' + (edit ? "ذخیره‌ی تغییرات" : "ساخت آزمون و دریافت لینک") + "</button></div>";

    const qsBox = document.getElementById("qs");
    const titleEl = document.getElementById("title");
    const descEl = document.getElementById("desc");
    autoGrow(descEl);
    const msg = document.getElementById("msg");
    titleEl.value = titleVal;
    descEl.value = descVal;

    /* پیش‌نویس خودکار */
    let draftTimer = 0;
    let finished = false;
    const durValue = () => (durCtl && durCtl.mode() === "set" ? durCtl.min() : null);
    const draftPayload = () => ({
      type: mode,
      title: titleEl.value,
      description: descEl.value,
      duration: durValue(),
      questions: questions.map((q) => ({ type: q.type, text: q.text, options: q.options, correct: q.correct, tf: q.tf })),
    });
    const hasContent = () => titleEl.value.trim() || questions.some((q) => q.text.trim() || q.options.some((o) => o.trim()));
    const saveDraft = () => {
      draftTimer = 0;
      if (finished || edit) return;
      if (hasContent()) store.set("quizDraft", draftPayload());
    };
    const touch = () => { if (finished || edit) return; clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400); };
    titleEl.addEventListener("input", () => { titleEl.classList.remove("bad"); msg.innerHTML = ""; touch(); });
    descEl.addEventListener("input", touch);
    durCtl = durBind(app, durInit ? "set" : "none", durInit || 20, touch);

    const fresh = document.getElementById("freshBtn");
    if (fresh) fresh.addEventListener("click", () => { finished = true; clearTimeout(draftTimer); store.del("quizDraft"); const t = withG("/create/" + mode); if (t === curPath()) route(); else go(t); });

    /* شماره‌گذاری و وضعیت دکمه‌ها */
    function refreshChrome() {
      const cards = Array.from(qsBox.querySelectorAll(":scope > .q:not(.leaving)"));
      cards.forEach((c, i) => {
        c.querySelector(".qnum").textContent = "سؤال " + faNum(i + 1);
        c.querySelector(".mv-up").disabled = i === 0;
        c.querySelector(".mv-down").disabled = i === cards.length - 1;
        c.querySelector(".rm-q").disabled = cards.length === 1;
      });
    }

    const findQ = (card) => questions.find((q) => q.id === Number(card.dataset.id));

    function clearInvalid(card) {
      card.classList.remove("invalid");
      const e = card.querySelector(".q-err");
      if (e) e.textContent = "";
    }

    function buildAnswers(card, q) {
      const box = card.querySelector(".q-answers");
      box.innerHTML = "";
      if (q.type === "tf") {
        const grp = el("div", { class: "tf", role: "radiogroup", "aria-label": "پاسخ درست را انتخاب کنید" });
        [["0", "درست", "tick", "tf-true"], ["1", "نادرست", "cross", "tf-false"]].forEach((o) => {
          const input = el("input", { type: "radio", name: "c" + q.id, value: o[0] });
          input.checked = q.tf === Number(o[0]);
          input.addEventListener("change", () => { q.tf = Number(o[0]); clearInvalid(card); touch(); });
          grp.appendChild(el("label", { class: "tf-opt " + o[3] }, [input, el("span", { class: "ic", html: ICONS[o[2]] }), el("span", { text: o[1] })]));
        });
        box.appendChild(el("div", { class: "hint", text: "پاسخ درست این جمله را انتخاب کنید." }));
        box.appendChild(grp);
        return;
      }
      box.appendChild(el("div", { class: "hint", text: "دایره‌ی کنار گزینه‌ی درست را انتخاب کنید." }));
      const opts = el("div", { class: "opts", role: "radiogroup", "aria-label": "گزینه‌ها" });
      q.options.forEach((val, i) => {
        const radio = el("input", { type: "radio", name: "c" + q.id, "aria-label": "گزینه‌ی " + faNum(i + 1) + " پاسخ درست است" });
        radio.checked = q.correct === i;
        radio.addEventListener("change", () => { q.correct = i; clearInvalid(card); touch(); });
        const text = el("textarea", { class: "optx", rows: "1", maxlength: String(LIMITS.opt), placeholder: "گزینه‌ی " + faNum(i + 1), "aria-label": "متن گزینه‌ی " + faNum(i + 1) });
        text.value = val;
        text.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
        autoGrow(text);
        text.addEventListener("input", () => { q.options[i] = text.value; text.classList.remove("bad"); clearInvalid(card); touch(); });
        const rm = el("button", { class: "btn small danger", type: "button", "aria-label": "حذف گزینه‌ی " + faNum(i + 1), html: "×" });
        rm.disabled = q.options.length <= LIMITS.minOpts;
        rm.addEventListener("click", () => {
          if (q.options.length <= LIMITS.minOpts) return;
          q.options.splice(i, 1);
          if (q.correct === i) q.correct = null; else if (q.correct != null && q.correct > i) q.correct -= 1;
          buildAnswers(card, q);
          const ins = card.querySelectorAll(".opts .optx");
          if (ins.length) ins[Math.min(i, ins.length - 1)].focus();
          touch();
        });
        opts.appendChild(el("div", { class: "row" }, [radio, text, rm]));
      });
      box.appendChild(opts);
      const add = el("button", { class: "btn small ghost addopt", type: "button", text: "+ گزینه" });
      add.disabled = q.options.length >= LIMITS.maxOpts;
      add.addEventListener("click", () => {
        if (q.options.length >= LIMITS.maxOpts) return;
        q.options.push("");
        buildAnswers(card, q);
        const ins = card.querySelectorAll(".opts .optx");
        ins[ins.length - 1].focus();
        touch();
      });
      box.appendChild(add);
    }

    /* فقط در مدل «مخلوط» نوع هر سؤال قابل تغییر است */
    function setType(card, q, t) {
      if (q.type === t || allowed.indexOf(t) < 0) return;
      q.type = t;
      card.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
      clearInvalid(card);
      buildAnswers(card, q);
      touch();
    }

    function buildCard(q, enter) {
      const card = el("div", { class: "card q" + (enter ? " enter" : ""), "data-id": String(q.id), role: "group" });
      const mvUp = el("button", { class: "icon-btn mv-up", type: "button", "aria-label": "انتقال سؤال به بالا", html: ICONS.up });
      const mvDown = el("button", { class: "icon-btn mv-down", type: "button", "aria-label": "انتقال سؤال به پایین", html: ICONS.down });
      const rm = el("button", { class: "icon-btn rm-q", type: "button", "aria-label": "حذف سؤال", html: ICONS.trash });
      mvUp.addEventListener("click", () => {
        const prev = card.previousElementSibling;
        if (!prev) return;
        const i = questions.indexOf(q);
        questions.splice(i, 1); questions.splice(i - 1, 0, q);
        qsBox.insertBefore(card, prev);
        refreshChrome(); touch();
        (mvUp.disabled ? mvDown : mvUp).focus();
      });
      mvDown.addEventListener("click", () => {
        const next = card.nextElementSibling;
        if (!next) return;
        const i = questions.indexOf(q);
        questions.splice(i, 1); questions.splice(i + 1, 0, q);
        qsBox.insertBefore(next, card);
        refreshChrome(); touch();
        (mvDown.disabled ? mvUp : mvDown).focus();
      });
      rm.addEventListener("click", () => {
        if (questions.length <= 1) return;
        const i = questions.indexOf(q);
        questions.splice(i, 1);
        card.classList.add("leaving");
        const sib = card.nextElementSibling || card.previousElementSibling;
        setTimeout(() => { card.remove(); refreshChrome(); }, 230);
        refreshChrome();
        const f = sib && sib.querySelector(".qtext");
        if (f) f.focus({ preventScroll: true });
        touch();
      });
      const head = [el("h2", { class: "qnum" })];
      if (mixed) {
        head.push(el("div", { class: "seg", role: "group", "aria-label": "نوع سؤال" },
          allowed.map((t) => {
            const b = el("button", { type: "button", "data-t": t, "aria-pressed": String(q.type === t), text: QTYPES[t].short });
            b.addEventListener("click", () => setType(card, q, t));
            return b;
          })));
      } else {
        head.push(el("span", { class: "badge", text: QTYPES[q.type].short }));
      }
      head.push(el("div", { class: "q-tools" }, [mvUp, mvDown, rm]));
      card.appendChild(el("div", { class: "q-head" }, head));
      const ta = el("textarea", { class: "qtext", id: "qt" + q.id, maxlength: String(LIMITS.text), "aria-label": "متن سؤال" });
      ta.value = q.text;
      autoGrow(ta);
      ta.addEventListener("input", () => { q.text = ta.value; ta.classList.remove("bad"); clearInvalid(card); touch(); });
      card.appendChild(el("label", { for: "qt" + q.id, text: "متن سؤال" }));
      card.appendChild(ta);
      card.appendChild(el("div", { class: "q-answers" }));
      card.appendChild(el("div", { class: "q-err", role: "alert" }));
      buildAnswers(card, q);
      return card;
    }

    function addQuestion(t, focus) {
      if (questions.length >= LIMITS.questions) {
        msg.innerHTML = '<div class="err" role="alert">حداکثر ' + faNum(LIMITS.questions) + " سؤال مجاز است.</div>";
        return;
      }
      msg.innerHTML = "";
      const q = newQ(t);
      questions.push(q);
      const card = buildCard(q, true);
      qsBox.appendChild(card);
      refreshChrome();
      if (focus) {
        card.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
        card.querySelector(".qtext").focus({ preventScroll: true });
      }
      touch();
    }

    questions.forEach((q) => qsBox.appendChild(buildCard(q, false)));
    refreshChrome();

    /* دکمه‌های افزودن: هر مدل فقط نوع سؤال خودش را اضافه می‌کند */
    const addBtns = document.getElementById("addBtns");
    allowed.forEach((t, i) => {
      const label = mixed ? QTYPES[t].short : "سؤال جدید";
      const b = el("button", { class: "btn small" + (mixed && i > 0 ? " ghost" : ""), type: "button", html: ICONS.plus + " " + esc(label) });
      b.addEventListener("click", () => addQuestion(t, true));
      addBtns.appendChild(b);
    });

    /* اعتبارسنجی؛ اولین خطا را برمی‌گرداند */
    function validate() {
      if (!titleEl.value.trim()) return { el: titleEl, msg: "عنوان آزمون را وارد کنید.", global: true };
      const cards = Array.from(qsBox.querySelectorAll(":scope > .q:not(.leaving)"));
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const q = findQ(card);
        const n = faNum(i + 1);
        const fail = (field, m) => ({ card: card, el: field, msg: m });
        if (!q.text.trim()) return fail(card.querySelector(".qtext"), "متن سؤال " + n + " را بنویسید.");
        if (q.type === "tf") {
          if (q.tf == null) return fail(card.querySelector(".tf input"), "پاسخ درست سؤال " + n + " را مشخص کنید.");
          continue;
        }
        const inputs = Array.from(card.querySelectorAll(".opts .optx"));
        const emptyIdx = q.options.findIndex((o) => !o.trim());
        if (emptyIdx >= 0) return fail(inputs[emptyIdx], "همه‌ی گزینه‌های سؤال " + n + " را پر کنید.");
        const seen = {};
        for (let j = 0; j < q.options.length; j++) {
          const k = q.options[j].trim().toLowerCase();
          if (seen[k] != null) return fail(inputs[j], "در سؤال " + n + " دو گزینه یکسان‌اند.");
          seen[k] = j;
        }
        if (q.correct == null) return fail(card.querySelector(".opts input[type=radio]"), "گزینه‌ی درست سؤال " + n + " را مشخص کنید.");
      }
      return null;
    }

    function serialize() {
      return questions.map((q) => {
        const text = q.text.trim();
        if (q.type === "tf") return { type: "tf", text: text, options: ["درست", "نادرست"], correct: q.tf };
        return { type: "mcq", text: text, options: q.options.map((o) => o.trim()), correct: q.correct };
      });
    }

    const saveBtn = document.getElementById("save");
    saveBtn.addEventListener("click", async () => {
      msg.innerHTML = "";
      qsBox.querySelectorAll(".q.invalid").forEach((c) => clearInvalid(c));
      const v = validate();
      if (v) {
        if (v.global) {
          msg.innerHTML = '<div class="err" role="alert">' + esc(v.msg) + "</div>";
        } else {
          v.card.classList.add("invalid");
          v.card.querySelector(".q-err").textContent = v.msg;
        }
        if (v.el) {
          v.el.classList.add("bad");
          (v.card || v.el).scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
          v.el.focus({ preventScroll: true });
        }
        return;
      }
      if (edit && nSubs > 0 && !document.getElementById("confirmClear").checked) {
        const cb = document.getElementById("confirmClear");
        msg.innerHTML = '<div class="err" role="alert">برای ذخیره، باید تیک تأیید پاک شدن نتایج قبلی را بزنید.</div>';
        cb.closest(".warn-card").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
        cb.focus({ preventScroll: true });
        return;
      }
      const secret = edit ? edit.secret : randomSecret();
      saveBtn.disabled = true;
      saveBtn.classList.add("loading");
      try {
        if (edit) {
          const r = await rpc("update_quiz", Object.assign({
            p_id: edit.id,
            p_secret: edit.secret,
            p_title: titleEl.value.trim(),
            p_description: descEl.value.trim(),
            p_questions: serialize(),
            p_confirm_clear: nSubs > 0,
          }, durValue() !== durInit ? { p_duration: durValue(), p_set_duration: true } : {}));
          finished = true;
          await keepQuiz({ id: edit.id, secret: edit.secret, title: titleEl.value.trim() });
          memSecrets[edit.id] = edit.secret;
          go("/m/" + encodeURIComponent(edit.id) + "?updated=1" + (r && r.cleared ? "&cleared=" + r.cleared : ""));
          return;
        }
        const id = await rpc("create_quiz", Object.assign({
          p_title: titleEl.value.trim(),
          p_description: descEl.value.trim(),
          p_questions: serialize(),
          p_secret: secret,
          p_token: tokenOf(),
          p_group: createGroup || null,
        }, durValue() ? { p_duration: durValue() } : {}));
        finished = true;
        clearTimeout(draftTimer);
        store.del("quizDraft");
        await keepQuiz({ id: id, secret: secret, title: titleEl.value.trim() });
        memSecrets[id] = secret;
        go("/m/" + encodeURIComponent(id) + "?new=1");
      } catch (e) {
        saveBtn.disabled = false;
        saveBtn.classList.remove("loading");
        /* اگر در همین فاصله کسی در آزمون شرکت کرده باشد، تأیید پاک شدن نتایج همین‌جا پرسیده می‌شود (تغییرات از دست نمی‌رود) */
        if (edit && !document.getElementById("confirmClear") && /پاک شدن نتایج/.test(String(e.message))) {
          nSubs = 1;
          msg.insertAdjacentHTML("beforebegin", '<div class="card warn-card" role="alert"><strong>⚠️ در همین فاصله کسی در این آزمون شرکت کرده است.</strong>' +
            "<p>با ذخیره‌ی تغییرات، <b>همه‌ی نتایج قبلی برای همیشه پاک می‌شوند</b>.</p>" +
            '<label class="chk"><input type="checkbox" id="confirmClear"><span>متوجه‌ام و می‌خواهم نتایج قبلی پاک شوند</span></label></div>');
          msg.innerHTML = '<div class="err" role="alert">برای ذخیره، تیک بالا را بزنید و دوباره «ذخیره» را بزنید.</div>';
          return;
        }
        msg.innerHTML = '<div class="err" role="alert">' + esc(e.message) + "</div>";
      }
    });

    return function cleanup() {
      clearTimeout(draftTimer);
      if (!finished && !edit && hasContent()) store.set("quizDraft", draftPayload());
    };
  }


  /* ---------- ویرایش آزمون ---------- */
  async function viewEdit(id, secret, token) {
    setTitle("ویرایش آزمون");
    app.innerHTML = '<p class="muted">در حال بارگذاری…</p>';
    let d;
    try { d = await rpc("get_results", { p_id: id, p_secret: secret }); } catch (e) { if (token !== routeToken) return; return showError(e.message, () => viewEdit(id, secret, token)); }
    if (token !== routeToken) return;
    const c = viewBuild("mixed", false, {
      id: id,
      secret: secret,
      title: d.title,
      description: d.description,
      questions: Array.isArray(d.questions) ? d.questions : [],
      submissions: Array.isArray(d.submissions) ? d.submissions.length : 0,
      duration: d.duration,
    });
    if (token === routeToken) cleanup = c; else if (c) c();
  }

  /* ---------- ساخت آزمون با هوش مصنوعی ---------- */
  /* اسم نشانی تابع روی Supabase (در لیست Edge Functions ستون URL را ببینید) */
  const AI_FN = "node-api";

  /* خروجی سرور را قبل از ساخت آزمون دوباره بررسی می‌کنیم */
  function normalizeAI(d) {
    const out = [];
    (d && Array.isArray(d.questions) ? d.questions : []).forEach((q) => {
      const text = String((q && q.text) || "").trim().slice(0, LIMITS.text);
      if (!text || !q) return;
      if (q.type === "tf") {
        if (q.correct === 0 || q.correct === 1) out.push({ type: "tf", text: text, options: ["درست", "نادرست"], correct: q.correct });
        return;
      }
      const opts = (Array.isArray(q.options) ? q.options : []).map((o) => String(o == null ? "" : o).trim().slice(0, LIMITS.opt));
      if (opts.length < LIMITS.minOpts || opts.length > LIMITS.maxOpts || opts.some((o) => !o)) return;
      if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return;
      if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= opts.length) return;
      out.push({ type: "mcq", text: text, options: opts, correct: q.correct });
    });
    return out.slice(0, LIMITS.questions);
  }

  /* مدل معلم هوشمند (مدل ساخت آزمون جدا، در صفحه‌ی ساخت آزمون انتخاب می‌شود) */
  const AI_MODELS = [
    { id: "ds-vision", label: "DeepSeek Flash", provider: "deepseek", model: "deepseek-flash", vision: true },
  ];
  const aiModel = (id) => AI_MODELS.find((m) => m.id === id) || AI_MODELS[0];

  /* ---------- پولک: اعتبار ساخت آزمون با هوش مصنوعی (هر پولک = یک سؤال) ---------- */
  const TK_FREE = 20;          /* هدیه‌ی ثبت‌نام؛ فقط برای متن نمایشی (مقدار واقعی را دیتابیس می‌دهد) */
  const TK_MAX_BUY = 10000;
  const TK_MIN_BUY = 1;
  /* قیمت پلکانی (تومان): تعداد خریداری‌شده در هر بازه باشد، همه‌ی پولک‌ها با نرخ همان بازه حساب می‌شوند */
  const TK_TIERS = [[50, 1000], [100, 950], [250, 900], [500, 850], [1000, 800], [Infinity, 750]];
  const TK_TIER_LBL = ["۱ تا ۵۰ پولک", "۵۱ تا ۱۰۰ پولک", "۱۰۱ تا ۲۵۰ پولک", "۲۵۱ تا ۵۰۰ پولک", "۵۰۱ تا ۱٬۰۰۰ پولک", "بیشتر از ۱٬۰۰۰ پولک"];
  const tkTier = (n) => { for (let i = 0; i < TK_TIERS.length; i++) if (n <= TK_TIERS[i][0]) return i; return TK_TIERS.length - 1; };
  const tkRate = (n) => TK_TIERS[tkTier(n)][1];
  const tkPrice = (n) => n * tkRate(n);
  const tkOffPct = (n) => Math.round((1000 - tkRate(n)) / 10);
  const fmtN = (n) => faNum(String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "٬"));
  const COIN = '<span class="coin" aria-hidden="true"><svg viewBox="0 0 100 100"><use href="#pz-p"/></svg></span>';

  const tk = { bal: null, at: 0, tok: "" };
  let tkBusy = null, tkAnim = 0;
  let tkLast = null;           /* مصرف آخرین ساخت آزمون (برای یادداشت روی صفحه‌ی آزمونِ تازه‌ساخته) */
  const tkTxt = () => (tk.bal == null ? "…" : fmtN(tk.bal));
  /* نشان پولک در هدر؛ کلاس has-tk فقط برای جمع‌کردن هدر در گوشی‌های خیلی کوچک است */
  function tkChip(show) {
    const chip = document.getElementById("tkBtn");
    if (chip) chip.hidden = !show;
    document.documentElement.classList.toggle("has-tk", !!show);
    return chip;
  }

  /* موجودی را همه‌جا (نشان هدر، منوی پروفایل، صفحه‌ها) یک‌جا به‌روز می‌کند */
  function tkSet(n) {
    if (typeof n !== "number" || !isFinite(n) || n < 0) return;
    n = Math.floor(n);
    const prev = tk.bal;
    tk.bal = n;
    tk.at = Date.now();
    const nodes = Array.prototype.slice.call(document.querySelectorAll("[data-tk]"));
    const chip = tkChip(!!auth.get());
    if (chip) {
      chip.classList.toggle("zero", n === 0);
      chip.setAttribute("aria-label", "موجودی پولک: " + faNum(n) + " پولک");
    }
    cancelAnimationFrame(tkAnim);
    const paint = (v) => { nodes.forEach((e) => { e.textContent = fmtN(v); }); };
    if (prev == null || prev === n || reduceMotion() || !nodes.length) {
      paint(n);
    } else {
      const t0 = performance.now(), D = 700;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
        paint(prev + (n - prev) * e);
        if (k < 1) tkAnim = requestAnimationFrame(step); else paint(n);
      };
      tkAnim = requestAnimationFrame(step);
      if (chip) { chip.classList.remove("bump"); void chip.offsetWidth; chip.classList.add("bump"); }
    }
    window.dispatchEvent(new Event("tkchange"));
  }
  function tkSync(force) {
    const s = auth.get();
    if (!s) { tk.bal = null; tk.tok = ""; tkChip(false); return Promise.resolve(null); }
    if (tk.tok !== s.token) { tk.tok = s.token; tk.bal = null; force = true; tkChip(false); }
    if (!force && tk.bal != null && Date.now() - tk.at < 15000) return Promise.resolve(tk.bal);
    if (tkBusy) return tkBusy;
    const mine = s.token;
    tkBusy = rpc("my_tokens", { p_token: mine }).then((n) => {
      const cur = auth.get();
      if (cur && cur.token === mine && typeof n === "number") tkSet(n);
      return tk.bal;
    }).catch(() => tk.bal).then((v) => { tkBusy = null; return v; });
    return tkBusy;
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tkSync(); });
  window.addEventListener("focus", () => tkSync());

  /* قفل کامل برنامه هنگام ساخت آزمون با هوش مصنوعی */
  let genLockHash = null;
  const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; return ""; };
  function setGenLock(on) {
    const els = document.querySelectorAll("header.top, #app");
    els.forEach((el) => { if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert"); });
    document.documentElement.classList.toggle("gen-lock", on);
    if (on) { genLockHash = curPath(); window.addEventListener("beforeunload", onBeforeUnload); }
    else { genLockHash = null; window.removeEventListener("beforeunload", onBeforeUnload); }
  }

  function viewAI() {
    setTitle("ساخت آزمون با هوش مصنوعی");
    fzCss();
    setTimeout(fillGroupChip, 0);
    tkSync(true);
    const st = { mode: "mixed", level: "medium", count: 10 };
    const pick = exPick({ files: false, total: () => st.count, onChange: () => { if (!gone) paintCost(); } });
    let busy = false;
    let ctl = null;
    let gone = false;
    let pending = null;     /* آزمونی که ساخته شد ولی ذخیره‌اش نشد؛ پولکش کم شده، پس برای ذخیره‌ی دوباره نگه داشته می‌شود */

    const seg = (name, items) =>
      '<div class="seg" role="group" data-seg="' + name + '">' +
      items.map((i) => '<button type="button" data-v="' + i[0] + '" aria-pressed="' + String(st[name] === i[0]) + '">' + i[1] + "</button>").join("") + "</div>";

    app.innerHTML =
      '<a class="back" href="' + withG("/create") + '">' + ICONS.back + " بازگشت به انتخاب مدل</a>" +
      "<h1>ساخت آزمون با هوش مصنوعی</h1>" + (createGroup ? '<div id="grpChipBox">' + groupChip(groupName(createGroup)) + "</div>" : "") +
      (typeof fzSwitch === "function" ? fzSwitch("ai") : "") +
      '<p class="muted">موضوع را بنویسید و تنظیمات را انتخاب کنید. آزمون ساخته می‌شود و مثل بقیه‌ی آزمون‌ها لینک شرکت و لینک نتایج را می‌گیرید.</p>' +
      '<div class="card ai-form">' +
      '<div class="tk-strip">' + COIN + '<span class="tk-strip-t">موجودی شما: <b data-tk>' + tkTxt() + '</b> پولک</span><a class="tk-strip-a" href="/tokens">خرید پولک</a></div>' +
      '<label for="topic">موضوع آزمون</label><input id="topic" type="text" maxlength="300" placeholder="مثلاً: تاریخ ایران در دوره‌ی صفوی" autocomplete="off">' +
      pick.html() +
      '<label>مدل سؤال‌ها</label>' + seg("mode", [["tf", "درست / نادرست"], ["mcq", "تستی"], ["mixed", "مخلوط"]]) +
      '<label>درجه‌ی سختی</label>' + seg("level", [["easy", "آسان"], ["medium", "متوسط"], ["hard", "سخت"]]) +
      '<label for="count">تعداد سؤال</label><div class="stepper"><button type="button" id="cm" aria-label="کمتر">−</button><input id="count" type="text" inputmode="numeric" value="' + faNum(st.count) + '" aria-label="تعداد سؤال"><button type="button" id="cp" aria-label="بیشتر">+</button><span class="hint">از ۱ تا ۳۰</span></div>' +
      durHtml(["none", "auto", "set"], "none", 15) +
      '<p class="tk-cost" id="tkCost" aria-live="polite"></p>' +
      "</div>" +
      '<div id="msg"></div>' +
      '<div class="actions"><a class="btn ghost" href="' + withG("/create") + '">' + ICONS.back + ' بازگشت</a><button class="btn" id="go" type="button">' + ICONS.spark + ' <span id="goT">ساخت آزمون و دریافت لینک</span><span class="go-cost" id="goCost"></span></button></div>' +
      '<p class="hint" id="wait" hidden>در حال ساخت آزمون… معمولاً ۱۰ تا ۶۰ ثانیه طول می‌کشد. تا پایان کار، همه‌ی دکمه‌ها قفل است. این صفحه را نبندید و از آن خارج نشوید.</p>';

    const $ = (id) => document.getElementById(id);
    const msg = $("msg");
    pick.bind(app);
    const fail = (t, extraHtml) => { msg.innerHTML = '<div class="err" role="alert">' + esc(t) + (extraHtml || "") + "</div>"; };
    const buyLink = ' <a class="err-a" href="/tokens">خرید پولک</a>';

    const durCtl = durBind(app, "none", 15, null);
    app.querySelectorAll(".seg[data-seg]").forEach((g) => {
      g.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b || busy) return;
        st[g.dataset.seg] = b.dataset.v;
        g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      });
    });

    /* هزینه‌ی همین آزمون به پولک: همیشه روی صفحه و روی دکمه دیده می‌شود */
    const cost = $("tkCost"), goCost = $("goCost");
    const paintCost = () => {
      const c = st.count, p = pick.price(), t = c * p, b = tk.bal;
      const low = b != null && b < t;
      cost.className = "tk-cost" + (low ? " low" : "");
      cost.innerHTML = low
        ? "برای " + faNum(c) + " سؤال با «" + esc(pick.name()) + "»، " + faNum(t) + " پولک لازم است و موجودی شما " + faNum(b) + " پولک است. تعداد سؤال را کمتر کنید، مدل ارزان‌تر بردارید یا " + '<a href="/tokens">پولک بخرید</a>.'
        : "هر سؤال با «" + esc(pick.name()) + "» " + faNum(p) + " پولک است؛ این آزمون <b>" + faNum(t) + " پولک</b> مصرف می‌کند.";
      goCost.textContent = pending ? "" : " · " + faNum(t) + " پولک";
    };
    const setCount = (n) => { st.count = Math.min(30, Math.max(1, n)); $("count").value = faNum(st.count); paintCost(); };
    const parseCount = () => {
      const t = $("count").value.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
      return t ? parseInt(t, 10) : st.count;
    };
    $("cm").addEventListener("click", () => { if (!busy) setCount(parseCount() - 1); });
    $("cp").addEventListener("click", () => { if (!busy) setCount(parseCount() + 1); });
    $("count").addEventListener("blur", () => setCount(parseCount()));
    const onTk = () => paintCost();
    window.addEventListener("tkchange", onTk);
    paintCost();

    const goBtn = $("go");
    const lockUi = (on) => {
      busy = on;
      goBtn.disabled = on;
      goBtn.classList.toggle("loading", on);
      pick.lock(on);
      $("wait").hidden = !on;
      app.querySelectorAll(".dur button,.dur input").forEach((x) => { x.disabled = on; });
      setGenLock(on);
    };

    /* ذخیره‌ی آزمونِ ساخته‌شده؛ اگر نشد، سؤال‌ها نگه داشته می‌شوند تا بدون خرج دوباره‌ی پولک دوباره ذخیره شوند */
    const saveQuiz = async (p) => {
      lockUi(true);
      let res = null, err = null;
      try {
        const secret = randomSecret();
        const id = await rpc("create_quiz", Object.assign({
          p_title: p.title, p_description: p.desc, p_questions: p.questions, p_secret: secret, p_token: tokenOf(), p_group: createGroup || null,
        }, p.duration ? { p_duration: p.duration } : {}));
        await keepQuiz({ id: id, secret: secret, title: p.title });
        res = { id: id, secret: secret };
      } catch (e) { err = e; }
      if (gone) return;
      if (res) {
        pending = null;
        tkLast = { used: p.used, bal: p.bal };
        lockUi(false);
        memSecrets[res.id] = res.secret;
        go("/m/" + encodeURIComponent(res.id) + "?new=1");
        return;
      }
      pending = p;
      lockUi(false);
      $("goT").textContent = "ذخیره‌ی دوباره‌ی آزمون";
      paintCost();
      fail("آزمون ساخته شد و پولک‌تان مصرف شد، ولی ذخیره‌ی آن ناموفق بود (" + ((err && err.message) || "خطای نامشخص") + "). دکمه‌ی «ذخیره‌ی دوباره‌ی آزمون» را بزنید؛ پولک دوباره کم نمی‌شود.");
    };

    goBtn.addEventListener("click", async () => {
      if (busy) return;
      msg.innerHTML = "";
      if (pending) return saveQuiz(pending);
      setCount(parseCount());
      const t = $("topic").value.trim();
      if (!t) { $("topic").classList.add("bad"); $("topic").focus(); return fail("موضوع آزمون را بنویسید."); }
      const need = st.count * pick.price();
      if (tk.bal != null && tk.bal < need) return fail("پولک شما کافی نیست؛ موجودی شما " + faNum(tk.bal) + " پولک است و این آزمون " + faNum(need) + " پولک می‌خواهد. تعداد سؤال را کمتر کنید، مدل ارزان‌تر بردارید یا پولک بخرید.", buyLink);
      const body = { mode: st.mode, difficulty: st.level, count: st.count, topic: t, model: pick.id() === "ds" ? "deepseek" : pick.id(), ai: pick.id() };

      const wantDur = durCtl.mode();
      lockUi(true);
      ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 130000);
      let made = null;
      try {
        let res;
        try {
          res = await fetch(cfg.SUPABASE_URL + "/functions/v1/" + AI_FN, {
            method: "POST",
            signal: ctl.signal,
            headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
            body: JSON.stringify(Object.assign({}, body, { token: tokenOf() })),
          });
        } catch (e) {
          console.error("generate fetch failed", e);
          throw new Error(e && e.name === "AbortError" ? "ساخت آزمون بیش از حد طول کشید. دوباره تلاش کنید." : "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.");
        }
        let d = null;
        try { d = await res.json(); } catch (e) { /* ignore */ }
        if (!res.ok) {
          if (res.status === 402) {
            if (d && typeof d.tokens === "number") tkSet(d.tokens);
            const e402 = new Error("پولک شما کافی نیست؛ موجودی شما " + faNum((d && d.tokens) || 0) + " پولک است و این آزمون " + faNum((d && d.need) || st.count) + " پولک می‌خواهد. تعداد سؤال را کمتر کنید یا پولک بخرید.");
            e402.buy = true;
            throw e402;
          }
          throw new Error((d && d.error) || (res.status === 404 ? "بخش هوش مصنوعی هنوز روی سرور راه‌اندازی نشده است." : "خطایی رخ داد (" + res.status + ")."));
        }
        const questions = normalizeAI(d);
        if (!questions.length) throw new Error("آزمون معتبری ساخته نشد. دوباره تلاش کنید.");
        if (d && typeof d.tokens === "number") tkSet(d.tokens);
        made = {
          questions: questions,
          title: String((d && d.title) || "").trim().slice(0, LIMITS.title) || "آزمون",
          desc: String((d && d.description) || "").trim().slice(0, LIMITS.desc),
          used: (d && d.cost) || ((d && d.used) || questions.length) * pick.price(),
          bal: d && typeof d.tokens === "number" ? d.tokens : null,
          duration: wantDur === "set" ? okDur(durCtl.min()) : wantDur === "auto" ? (okDur(Number(d && d.duration_min)) || estimateMinutes(questions, st.level)) : null,
        };
      } catch (e) {
        if (gone) return;
        lockUi(false);
        tkSync(true);   /* اگر پولک برگردانده شده باشد موجودی همین حالا درست دیده می‌شود */
        fail(e.message, e.buy ? buyLink : "");
        return;
      } finally {
        clearTimeout(timer);
      }
      await saveQuiz(made);
    });

    return function cleanup() {
      gone = true;
      busy = false;
      pick.destroy();
      setGenLock(false);
      window.removeEventListener("tkchange", onTk);
      if (ctl) ctl.abort();
    };
  }

  /* ---------- ساخت آزمون از روی فایل ---------- */
  /* متن فایل‌ها داخل مرورگر استخراج می‌شود و برای ساخت به دیتابیس می‌رود؛ ساخت روی سرور انجام می‌شود (fj_* و سرویس pazmoonak-files). */
  const FZ = {
    maxFiles: 15,
    maxBytes: 20 * 1024 * 1024,
    maxChars: 3000000,      /* سقف کل متن همه‌ی فایل‌ها */
    maxExams: 15,
    maxQ: 50,               /* سؤال در هر آزمون */
    perCall: 25,            /* سؤال در هر درخواست به سرور */
    chunk: 24000,           /* اندازه‌ی هر تکه‌ی ارسالی به سرور */
    cap: 48000,             /* سقف کاراکتر متن در هر درخواست */
    minChars: 300,          /* کمترین متن برای ساختن آزمون */
    secPerCall: 35,         /* فقط برای تخمین زمان */
  };
  const FZ_EXT = { pdf: "PDF", docx: "DOCX", txt: "TXT", md: "TXT", text: "TXT" };
  const fzExt = (n) => { const m = /\.([a-z0-9]+)$/i.exec(String(n || "")); return m ? m[1].toLowerCase() : ""; };
  const fzBase = (n) => String(n || "").replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").trim();
  const fzSleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fzSize = (b) => (b < 1048576 ? faNum(Math.max(1, Math.round(b / 1024))) + " کیلوبایت" : faNum((b / 1048576).toFixed(1)).replace(".", "٫") + " مگابایت");

  /* ---- استایل (فقط یک بار به صفحه اضافه می‌شود) ---- */
  /* ---------- انتخاب مدل هوش مصنوعی در ساخت آزمون ----------
     قیمت‌ها و فهرست مدل‌های قابل‌استفاده را سرور (تابع ex_models) می‌دهد؛ تا وقتی سرور آماده نیست فقط DeepSeek انتخاب‌پذیر است.
     قیمت واقعی را همیشه سرور حساب می‌کند؛ این‌جا فقط برای نمایش است. */
  const EX_MODELS = [
    { id: "ds", name: "DeepSeek 4.1 Flash", by: "DeepSeek", price: 1, pf: 2, tag: "سریع و اقتصادی · پیش‌فرض" },
    { id: "luna", name: "GPT-6 Luna", by: "OpenAI", price: 1, pf: 2, tag: "سبک و سریع" },
    { id: "haiku", name: "Haiku 5.5", by: "Anthropic", price: 1, pf: 2, tag: "بسیار سریع" },
    { id: "hyd", name: "Gemini Hydrogen", by: "Google", price: 2, pf: 4, tag: "متعادل" },
    { id: "sonnet", name: "Sonnet 5.5", by: "Anthropic", price: 2, pf: 4, tag: "دقیق و روان" },
    { id: "sol", name: "GPT Sol 6.2", by: "OpenAI", price: 2, pf: 4, tag: "استدلال قوی" },
    { id: "neon", name: "Gemini Neon", by: "Google", price: 2, pf: 4, tag: "", soon: true },
    { id: "carbon", name: "Gemini Carbon", by: "Google", price: 3, pf: 6, tag: "دقت بالا" },
    { id: "argon", name: "Gemini Argon", by: "Google", price: 3, pf: 6, tag: "دقت بالا" },
    { id: "opus", name: "Opus 5.5", by: "Anthropic", price: 3, pf: 10, tag: "تحلیل عمیق" },
    { id: "astra", name: "Astra 6.2", by: "OpenAI", price: 6, pf: 15, tag: "قوی‌ترین مدل OpenAI" },
    { id: "fable", name: "Fable 5.2", by: "Anthropic", price: 6, pf: 15, tag: "برترین مدل Anthropic" },
  ];
  const EX_TIER = { 1: ["اقتصادی", "سریع و کم‌هزینه"], 2: ["متعادل", "کیفیت خوب با قیمت مناسب"], 3: ["پیشرفته", "دقت بالاتر برای موضوع‌های سخت"], 6: ["حرفه‌ای", "برترین مدل‌ها برای بهترین نتیجه"] };
  const EX_TIER_F = { 2: ["اقتصادی", "سریع و کم‌هزینه برای فایل‌های ساده"], 4: ["متعادل", "کیفیت خوب با قیمت مناسب"], 6: ["پیشرفته", "دقت بالاتر برای فایل‌های سنگین و موضوع‌های سخت"], 10: ["حرفه‌ای", "تحلیل عمیق فایل و تصویرها"], 15: ["ویژه", "برترین مدل‌ها برای بهترین نتیجه"] };
  const EX_BY = { DeepSeek: "deepseek", OpenAI: "openai", Anthropic: "claude", Google: "gemini" };
  const EX_LOGO = {
    claude: "data:image/webp;base64,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",
    gemini: "data:image/webp;base64,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",
    openai: "data:image/webp;base64,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",
    deepseek: "data:image/webp;base64,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",
  };
  const EX_CHEV = '<svg class="xm-ch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const EX_TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const EX_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const exLoad = () => { try { return localStorage.getItem("pz:xm") || ""; } catch (e) { return ""; } };
  const exSave = (id) => { try { localStorage.setItem("pz:xm", id); } catch (e) { /* ignore */ } };
  let EX_CAP = null;
  function exCaps() {
    if (!EX_CAP || Date.now() - EX_CAP.at > 300000) {
      EX_CAP = {
        at: Date.now(),
        p: rpc("ex_models", {}).then((d) => {
          const arr = d && Array.isArray(d.models) ? d.models : null;
          if (!arr) return null;
          const m = {};
          arr.forEach((x) => { if (x && x.id) m[String(x.id)] = { price: Math.max(1, Math.floor(Number(x.price) || 0)), pf: Math.max(1, Math.floor(Number(x.pf) || Number(x.price) || 0)), on: x.on !== false }; });
          return { m: m, files: d.files === true };
        }).catch(() => null),
      };
    }
    return EX_CAP.p;
  }
  function exCss() {
    if (document.getElementById("pzXmCss")) return;
    const s = document.createElement("style");
    s.id = "pzXmCss";
    s.textContent =
      ".xm-l{display:block;margin-top:18px}" +
      ".xm{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;margin-top:6px;border:1.5px solid var(--line-2);border-radius:18px;background:var(--field);color:var(--text);font:inherit;text-align:start;cursor:pointer;transition:border-color .2s,box-shadow .25s,transform .15s}" +
      ".xm:hover{border-color:var(--accent)}.xm:active{transform:scale(.992)}.xm:disabled{opacity:.6;cursor:default;transform:none}" +
      ".xm:focus-visible,.xm-row:focus-visible,.xm-x:focus-visible{outline:3px solid var(--accent);outline-offset:2px}" +
      ".xm-mk{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 2px 8px rgba(0,0,0,.10)}.xm-mk img{width:30px;height:30px;object-fit:contain;display:block;-webkit-user-drag:none;user-select:none}" +
      ".xm-t{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}" +
      ".xm-n{font-weight:800;font-size:1rem;line-height:1.55;overflow-wrap:break-word}" +
      "@media (max-width:520px){.xm{gap:10px;padding:10px 12px}.xm-p small{display:none}.xm-p{padding:5px 11px}}" +
      ".xm-s{font-size:.8rem;color:var(--muted);line-height:1.6}" +
      ".xm-p{flex:none;display:inline-flex;align-items:baseline;gap:4px;padding:5px 12px;border-radius:999px;background:var(--chip);color:var(--accent-2);font-weight:800;font-size:.86rem;white-space:nowrap}.xm-p small{font-size:.7rem;font-weight:700;opacity:.8}" +
      ".xm-ch{flex:none;width:18px;height:18px;color:var(--muted)}" +
      "html.xm-open{overflow:hidden}" +
      ".xm-ov{position:fixed;inset:0;z-index:400;display:flex;align-items:flex-end;justify-content:center;background:rgba(5,25,19,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .22s}" +
      ".xm-ov.on{opacity:1}" +
      ".xm-sh{width:100%;max-width:640px;max-height:min(88dvh,780px);display:flex;flex-direction:column;background:var(--surface-solid);color:var(--text);border:1px solid var(--line);border-radius:26px 26px 0 0;box-shadow:var(--shadow);transform:translateY(32px);transition:transform .32s var(--ease)}" +
      ".xm-ov.on .xm-sh{transform:none}" +
      "@media (min-width:700px){.xm-ov{align-items:center;padding:20px}.xm-sh{border-radius:26px;max-height:min(84vh,800px)}}" +
      ".xm-hd{display:flex;align-items:flex-start;gap:10px;padding:18px 18px 8px}" +
      ".xm-hd h2{margin:0;font-size:1.12rem}.xm-hd p{margin:3px 0 0;color:var(--muted);font-size:.84rem;line-height:1.7}" +
      ".xm-hd>div{flex:1 1 auto;min-width:0}" +
      ".xm-x{flex:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--field);color:var(--text);display:grid;place-items:center;cursor:pointer;padding:0}.xm-x svg{width:16px;height:16px}" +
      ".xm-bd{overflow:auto;padding:0 14px 8px;overscroll-behavior:contain}" +
      ".xm-tier{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 4px 8px}" +
      ".xm-tp{display:inline-flex;align-items:center;gap:5px;padding:3px 11px;border-radius:999px;background:var(--btn-grad);color:var(--on-accent);font-weight:800;font-size:.8rem}" +
      ".xm-tier b{font-size:.92rem;color:var(--accent-2)}.xm-tier small{color:var(--muted);font-size:.78rem}" +
      ".xm-row{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;margin:0 0 8px;border:1.5px solid var(--line);border-radius:16px;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer;transition:border-color .2s,background .2s,transform .15s}" +
      ".xm-row:hover{border-color:var(--line-2);background:var(--chip)}.xm-row:active{transform:scale(.99)}" +
      ".xm-row[aria-checked=true]{border-color:var(--accent);background:var(--chip);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}" +
      ".xm-row[aria-disabled=true]{opacity:.55;cursor:not-allowed}.xm-row[aria-disabled=true]:hover{background:transparent;border-color:var(--line)}.xm-row[aria-disabled=true] .xm-mk img{filter:grayscale(1)}" +
      ".xm-row .xm-mk{width:40px;height:40px;border-radius:12px}.xm-row .xm-mk img{width:27px;height:27px}" +
      ".xm-ck{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--line-2);color:transparent;transition:background .2s,border-color .2s,color .2s}.xm-ck svg{width:13px;height:13px}" +
      ".xm-row[aria-checked=true] .xm-ck{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}" +
      ".xm-soon{flex:none;padding:3px 10px;border-radius:999px;border:1px dashed var(--line-2);color:var(--muted);font-size:.74rem;font-weight:800;white-space:nowrap}" +
      ".xm-ft{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);font-size:.82rem;color:var(--muted)}" +
      ".xm-ft span{flex:1 1 auto;min-width:0;line-height:1.8}.xm-ft b{color:var(--text)}" +
      ".xm-ft a{flex:none;font-weight:800;text-decoration:none;padding:5px 14px;border-radius:999px;border:1.5px solid var(--line-2);color:var(--accent)}.xm-ft a:hover{border-color:var(--accent)}" +
      "@media (prefers-reduced-motion:reduce){.xm-ov,.xm-sh,.xm,.xm-row{transition:none}}";
    document.head.appendChild(s);
  }
  /* o = { files: بخش «از روی فایل» است؟, total: () => تعداد کل سؤال‌های آزمون(ها), onChange: () => هزینه دوباره نمایش داده شود } */
  function exPick(o) {
    exCss();
    let sel = exLoad() || "ds", caps = null, ov = null, opener = null, gone = false, locked = false, box = null, closeT = 0;
    const mdl = (id) => EX_MODELS.find((m) => m.id === id) || EX_MODELS[0];
    const isF = () => (typeof o.files === "function" ? !!o.files() : !!o.files);
    const priceOf = (m) => (isF() ? (caps && caps.m[m.id] && caps.m[m.id].pf) || m.pf || m.price : (caps && caps.m[m.id] && caps.m[m.id].price) || m.price);
    const avail = (m) => !m.soon && (m.id === "ds" || !!(caps && caps.m[m.id] && caps.m[m.id].on && (!isF() || caps.files)));
    const cur = () => { const m = mdl(sel); return avail(m) ? m : EX_MODELS[0]; };
    const mark = (m) => '<span class="xm-mk" aria-hidden="true"><img src="' + EX_LOGO[EX_BY[m.by]] + '" alt="" width="120" height="120" draggable="false"></span>';
    const paintBtn = () => {
      if (!box) return;
      const m = cur();
      box.innerHTML = '<label id="xmL" class="xm-l">مدل هوش مصنوعی</label>' +
        '<button type="button" class="xm" id="xmBtn" aria-haspopup="dialog" aria-labelledby="xmL xmN"' + (locked ? " disabled" : "") + ">" + mark(m) +
        '<span class="xm-t"><span class="xm-n" id="xmN"><bdi>' + esc(m.name) + '</bdi></span><span class="xm-s">' + esc(m.by) + (m.tag ? " · " + esc(m.tag) : "") + "</span></span>" +
        '<span class="xm-p">' + faNum(priceOf(m)) + " پولک <small>برای هر سؤال</small></span>" + EX_CHEV + "</button>";
    };
    const rows = () => {
      const c = cur(), n = Math.max(0, Math.floor(Number(o.total && o.total()) || 0));
      const prices = Array.from(new Set(EX_MODELS.map(priceOf))).sort((a, b) => a - b);
      return prices.map((p) => {
        const t = (isF() ? EX_TIER_F : EX_TIER)[p] || ["", ""];
        return '<div class="xm-tier"><span class="xm-tp">' + faNum(p) + " پولک</span>" + (t[0] ? "<b>" + t[0] + "</b><small>" + t[1] + "</small>" : "") + "</div>" +
          EX_MODELS.filter((m) => priceOf(m) === p).map((m) => {
            const ok = avail(m);
            const sub = m.soon ? "" : (m.tag ? esc(m.tag) : "") + (ok && n ? (m.tag ? " · " : "") + '<span style="white-space:nowrap">آزمون شما: ' + faNum(n * p) + " پولک</span>" : "");
            return '<button type="button" class="xm-row" role="radio" data-id="' + m.id + '" aria-checked="' + String(m.id === c.id) + '"' + (ok ? "" : ' aria-disabled="true"') + ' tabindex="' + (m.id === c.id ? "0" : "-1") + '">' + mark(m) +
              '<span class="xm-t"><span class="xm-n"><bdi>' + esc(m.name) + '</bdi></span><span class="xm-s">' + (m.soon ? esc(m.by) : esc(m.by) + (sub ? " · " + sub : "")) + "</span></span>" +
              (ok ? '<span class="xm-ck" aria-hidden="true">' + EX_TICK + "</span>" : '<span class="xm-soon">به‌زودی</span>') + "</button>";
          }).join("");
      }).join("");
    };
    const paintRows = () => { if (!ov) return; const g = ov.querySelector(".xm-bd"); const st = g.scrollTop; g.querySelector("[role=radiogroup]").innerHTML = rows(); g.scrollTop = st; };
    const close = (instant) => {
      if (!ov) return;
      const el = ov; ov = null;
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.classList.remove("xm-open");
      el.classList.remove("on");
      const done = () => { if (el.parentNode) el.parentNode.removeChild(el); };
      if (instant) done(); else setTimeout(done, 240);
      try { if (opener && opener.focus && !gone) opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    };
    function onKey(e) {
      if (!ov) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === "Tab") {
        const f = Array.prototype.slice.call(ov.querySelectorAll("button:not([disabled]):not([tabindex='-1']),a[href]"));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!ov.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const list = Array.prototype.slice.call(ov.querySelectorAll(".xm-row"));
        const i = list.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        const nx = list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length];
        list.forEach((x) => x.setAttribute("tabindex", x === nx ? "0" : "-1"));
        nx.focus();
      }
    }
    const choose = (id) => {
      const m = mdl(id);
      if (!avail(m)) return;
      sel = m.id; exSave(sel);
      paintBtn(); paintRows();
      if (o.onChange) o.onChange();
      setTimeout(() => { if (ov) close(); }, 170);
    };
    const open = () => {
      if (ov || locked || gone) return;
      opener = document.activeElement;
      ov = document.createElement("div");
      ov.className = "xm-ov";
      ov.innerHTML = '<div class="xm-sh" role="dialog" aria-modal="true" aria-labelledby="xmT">' +
        '<div class="xm-hd"><div><h2 id="xmT">انتخاب مدل هوش مصنوعی</h2><p>هر مدل در هر سؤال تعداد مشخصی پولک مصرف می‌کند. مدل‌های بالاتر معمولاً دقیق‌ترند.</p></div><button type="button" class="xm-x" aria-label="بستن">' + EX_X + "</button></div>" +
        '<div class="xm-bd"><div role="radiogroup" aria-label="مدل هوش مصنوعی">' + rows() + "</div></div>" +
        '<div class="xm-ft"><span>موجودی شما: <b data-tk>' + tkTxt() + '</b> پولک</span><a href="/tokens">خرید پولک</a></div></div>';
      document.body.appendChild(ov);
      document.documentElement.classList.add("xm-open");
      document.addEventListener("keydown", onKey, true);
      ov.addEventListener("click", (e) => {
        if (e.target === ov || e.target.closest(".xm-x")) { close(); return; }
        const r = e.target.closest(".xm-row");
        if (r) choose(r.dataset.id);
      });
      requestAnimationFrame(() => { if (ov) ov.classList.add("on"); });
      setTimeout(() => { const c = ov && ov.querySelector(".xm-row[aria-checked=true]"); if (c) { try { c.focus({ preventScroll: true }); c.scrollIntoView({ block: "center" }); } catch (e) { /* ignore */ } } }, 60);
    };
    exCaps().then((c) => { if (gone) return; caps = c; paintBtn(); paintRows(); if (o.onChange) { try { o.onChange(); } catch (e) { /* صفحه هنوز کامل ساخته نشده */ } } });
    return {
      html: () => '<div class="xm-box" id="xmBox"></div>',
      bind: (root) => {
        box = root.querySelector("#xmBox");
        paintBtn();
        box.addEventListener("click", (e) => { if (e.target.closest("#xmBtn")) open(); });
      },
      id: () => cur().id,
      price: () => priceOf(cur()),
      name: () => cur().name,
      lock: (on) => { locked = !!on; if (on) close(true); paintBtn(); },
      refresh: () => { paintBtn(); paintRows(); },
      destroy: () => { gone = true; if (closeT) clearTimeout(closeT); close(true); },
    };
  }

  function fzCss() {
    if (document.getElementById("pzFzCss")) return;
    const st = document.createElement("style");
    st.id = "pzFzCss";
    st.textContent =
      ".fz-sw{display:flex;gap:4px;padding:4px;margin:14px 0 6px;border:1px solid var(--line);border-radius:16px;background:var(--field)}" +
      ".fz-sw a{flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;border-radius:12px;font-weight:700;font-size:.95rem;color:var(--muted);text-decoration:none;text-align:center;transition:background .25s,color .25s,transform .2s}" +
      ".fz-sw a:hover{color:var(--text)}.fz-sw a:active{transform:scale(.97)}" +
      ".fz-sw a[aria-current=page]{background:var(--btn-grad);color:var(--on-accent);box-shadow:0 8px 16px -10px var(--accent)}" +
      ".fz-sw .soon-badge{font-size:.68rem;padding:0 8px}" +
      ".fz-drop{display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px 16px;border:2px dashed var(--line-2);border-radius:18px;background:var(--field);text-align:center;cursor:pointer;color:var(--muted);transition:border-color .25s,background .25s,transform .25s}" +
      ".fz-drop svg{width:38px;height:38px;color:var(--accent);transition:transform .3s var(--spring)}" +
      ".fz-drop strong{color:var(--text);font-size:1rem}.fz-drop small{font-size:.8rem;color:var(--muted);line-height:1.8}" +
      ".fz-drop:hover,.fz-drop.over,.fz-drop:focus-visible{border-color:var(--accent);background:var(--chip)}" +
      ".fz-drop.over{transform:scale(1.01)}.fz-drop.over svg,.fz-drop:hover svg{transform:translateY(-3px)}" +
      ".fz-drop:focus-visible{outline:2px solid var(--accent);outline-offset:3px}" +
      ".fz-drop.off{opacity:.55;pointer-events:none}" +
      ".fz-list{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:8px}" +
      ".fz-list:empty{display:none}" +
      ".fz-it{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:var(--field);animation:fzIn .35s var(--ease) both}" +
      "@keyframes fzIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
      ".fz-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:.66rem;font-weight:800;letter-spacing:.4px;direction:ltr;color:#fff;background:var(--accent)}" +
      ".fz-ic.pdf{background:linear-gradient(135deg,#C8553D,#A23B2F)}.fz-ic.docx{background:linear-gradient(135deg,#3C78C9,#2B5FA8)}.fz-ic.txt{background:linear-gradient(135deg,#1C8059,#0F5132)}.fz-ic.er{background:linear-gradient(135deg,#8D9A93,#6B7973)}" +
      ".fz-n{display:block;font-weight:700;font-size:.93rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;unicode-bidi:plaintext}" +
      ".fz-m{display:block;font-size:.8rem;color:var(--muted);line-height:1.7}.fz-m.er{color:var(--bad);font-weight:600}" +
      ".fz-pg{height:4px;margin-top:6px;border-radius:9px;background:var(--line);overflow:hidden}.fz-pg i{display:block;height:100%;width:100%;border-radius:9px;background:var(--btn-grad);transform-origin:right center;transform:scaleX(var(--v,.05));transition:transform .25s}" +
      ".fz-x{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--muted);font:inherit;font-size:1.15rem;line-height:1;cursor:pointer;transition:color .2s,border-color .2s,background .2s}" +
      ".fz-x:hover{color:var(--bad);border-color:var(--bad);background:var(--bad-bg)}" +
      ".fz-sum{margin:10px 2px 0;font-size:.88rem;color:var(--muted)}.fz-sum b{color:var(--accent-2)}" +
      ".fz-multi{margin-top:18px;border:1px solid var(--line);border-radius:14px;background:var(--field);overflow:hidden}" +
      ".fz-multi>summary{cursor:pointer;padding:12px 14px;font-weight:700;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px}" +
      ".fz-multi>summary::-webkit-details-marker{display:none}" +
      ".fz-multi>summary::after{content:\"\";width:9px;height:9px;border-inline-end:2.4px solid var(--muted);border-bottom:2.4px solid var(--muted);transform:rotate(45deg);transition:transform .25s;margin-top:-4px;flex:none}" +
      ".fz-multi[open]>summary::after{transform:rotate(-135deg);margin-top:4px}" +
      ".fz-multi-b{padding:2px 14px 14px;border-top:1px solid var(--line)}" +
      ".fz-multi-b label{margin-top:14px !important}" +
      ".fz-chk{display:flex !important;align-items:center;gap:10px;font-weight:600 !important;cursor:pointer}" +
      ".fz-multi+.dur{margin-top:18px}" +
      ".fz-chk input{width:20px;height:20px;accent-color:var(--accent);flex:none}" +
      ".fz-warn{margin:10px 0 0;padding:10px 14px;border-radius:14px;background:var(--warn-bg);color:var(--warn-text);font-size:.88rem;line-height:1.9;font-weight:600}" +
      ".fz-run{padding:20px}.fz-run h2{margin:0 0 4px;font-size:1.15rem}" +
      ".fz-bar{height:10px;margin:14px 0 8px;border-radius:99px;background:var(--line);overflow:hidden}" +
      ".fz-bar i{display:block;height:100%;width:100%;border-radius:99px;background:var(--btn-grad);transform-origin:right center;transform:scaleX(var(--v,0));transition:transform .6s var(--ease)}" +
      ".fz-stat{margin:0;color:var(--muted);font-size:.9rem;line-height:1.9}.fz-stat b{color:var(--text)}" +
      ".fz-ex{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:8px;max-height:min(52vh,460px);overflow:auto}" +
      ".fz-e{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--line);border-radius:12px;background:var(--field);font-size:.9rem}" +
      ".fz-e.run{border-color:var(--accent);background:var(--chip)}" +
      ".fz-e .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;unicode-bidi:plaintext}.fz-e .t small{display:block;font-weight:400;color:var(--muted);font-size:.78rem}.fz-e .t small.er{color:var(--bad)}" +
      ".fz-e a.btn{padding:4px 12px;min-height:0;font-size:.8rem}" +
      ".fz-st{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none;border:2px solid var(--line-2);color:#fff;font-size:.8rem;font-weight:800}" +
      ".fz-st.ok{background:var(--ok);border-color:var(--ok)}.fz-st.fail{background:var(--bad);border-color:var(--bad)}" +
      ".fz-st.run{border-color:var(--line);border-top-color:var(--accent);animation:fzSp .8s linear infinite}" +
      "@keyframes fzSp{to{transform:rotate(360deg)}}" +
      ".fz-pill{position:fixed;z-index:90;inset-inline-start:16px;bottom:16px;max-width:calc(100vw - 32px);display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--line-2);border-radius:999px;background:color-mix(in srgb,var(--surface-solid) 90%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:var(--shadow);font-size:.88rem;font-weight:700;animation:fzIn .35s var(--ease) both}" +
      ".fz-pill a{color:var(--accent);text-decoration:none;font-weight:800;white-space:nowrap}.fz-pill button{border:0;background:transparent;color:var(--muted);font:inherit;font-size:1.1rem;line-height:1;cursor:pointer;padding:0 2px}" +
      ".fz-pill .fz-st{width:20px;height:20px;font-size:.7rem}" +
      "@media (prefers-reduced-motion:reduce){.fz-it,.fz-pill{animation:none}.fz-st.run{animation-duration:2s}.fz-bar i,.fz-pg i{transition:none}}";
    document.head.appendChild(st);
  }

  /* ---- پاک‌سازی و خواندن متن فایل‌ها ---- */
  const fzClean = (s) => String(s || "")
    .normalize("NFKC")
    .replace(/ك/g, "ک").replace(/[يى]/g, "ی")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F​‎‏‪-‮⁦-⁩﻿­]/g, "")
    .replace(/\r\n?/g, "\n").replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  function fzDecodeText(buf) {
    const u = new Uint8Array(buf);
    if (u.length >= 2 && u[0] === 0xFF && u[1] === 0xFE) return new TextDecoder("utf-16le").decode(u.subarray(2));
    if (u.length >= 2 && u[0] === 0xFE && u[1] === 0xFF) return new TextDecoder("utf-16be").decode(u.subarray(2));
    try { return new TextDecoder("utf-8", { fatal: true }).decode(u); } catch (e) { /* قدیمی: ویندوز-۱۲۵۶ */ }
    try { return new TextDecoder("windows-1256").decode(u); } catch (e) { return new TextDecoder("utf-8").decode(u); }
  }

  /* بازکردن یک فایلِ داخل zip (برای docx) */
  async function fzUnzip(buf, want) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) { if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; } }
    if (e < 0) throw new Error("zip");
    const n = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    for (let k = 0; k < n; k++) {
      if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      if (name === want) {
        const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        const data = u8.subarray(start, start + csize);
        if (method === 0) return data;
        if (method === 8) {
          if (typeof DecompressionStream !== "function") throw new Error("old");
          const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
          return new Uint8Array(await new Response(stream).arrayBuffer());
        }
        throw new Error("zip");
      }
      p += 46 + nl + xl + cl;
    }
    return null;
  }

  async function fzReadDocx(buf) {
    const xml = await fzUnzip(buf, "word/document.xml");
    if (!xml) throw new Error("docx");
    const doc = new DOMParser().parseFromString(new TextDecoder("utf-8").decode(xml), "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("docx");
    const out = [];
    const paras = doc.getElementsByTagName("w:p");
    for (let i = 0; i < paras.length; i++) {
      let line = "";
      const walk = (node) => {
        for (let c = node.firstChild; c; c = c.nextSibling) {
          if (c.nodeType !== 1) continue;
          const t = c.nodeName;
          if (t === "w:t") line += c.textContent;
          else if (t === "w:tab") line += " ";
          else if (t === "w:br" || t === "w:cr") line += "\n";
          else if (t === "w:p") continue;
          else walk(c);
        }
      };
      walk(paras[i]);
      out.push(line);
    }
    return { text: out.join("\n"), pages: 0 };
  }

  let fzPdfP = null;
  function fzLoadPdf() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (fzPdfP) return fzPdfP;
    fzPdfP = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "/logo/pdf.min.js?v=1";
      s.async = true;
      s.onload = () => {
        if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/logo/pdf.worker.min.js?v=1"; res(window.pdfjsLib); } else { fzPdfP = null; rej(new Error("pdf")); }
      };
      s.onerror = () => { fzPdfP = null; s.remove(); rej(new Error("pdf")); };
      document.head.appendChild(s);
    });
    return fzPdfP;
  }
  const FZ_RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
  const FZ_LTR = /^[0-9\u06F0-\u06F9\u0660-\u0669A-Za-z.,:\/%+\-\u066B\u066C]+$/;
  /* متن یک صفحه‌ی PDF: آیتم‌ها را به خط‌ها گروه می‌کند. در PDFهای فارسی ترتیب آیتم‌ها «بصری» (چپ به راست) است؛ پس خط راست‌به‌چپ از راست خوانده می‌شود، ولی عددها و متن لاتین سر جای خود (چپ به راست) می‌مانند. */
  function fzPageText(items) {
    const its = items.filter((it) => it && typeof it.str === "string" && it.str !== "" && it.transform);
    if (!its.length) return "";
    const rows = [];
    its.slice().sort((a, b) => b.transform[5] - a.transform[5]).forEach((it) => {
      const h = Math.max(it.height || 0, Math.abs(it.transform[3]) || 0, 6);
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.y - it.transform[5]) <= Math.max(2, Math.min(last.h, h) * 0.5)) { last.items.push(it); last.h = Math.max(last.h, h); }
      else rows.push({ y: it.transform[5], h: h, items: [it] });
    });
    const lines = rows.map((r) => {
      const all = r.items.map((i) => i.str).join("");
      const rtl = (all.match(FZ_RTL) || []).length * 2 >= all.replace(/\s/g, "").length;
      let arr = r.items.slice().sort((a, b) => a.transform[4] - b.transform[4]);
      if (rtl) {
        arr.reverse();
        /* عددها و لاتین: دوباره چپ به راست */
        const f = arr.map((it) => FZ_LTR.test(it.str.trim()) && it.str.trim() !== "");
        for (let i = 1; i < arr.length - 1; i++) if (!f[i] && arr[i].str.trim() === "" && f[i - 1] && f[i + 1]) f[i] = "sp";
        const out = [];
        for (let i = 0; i < arr.length;) {
          if (!f[i]) { out.push(arr[i]); i++; continue; }
          let j = i;
          while (j < arr.length && f[j]) j++;
          for (let k = j - 1; k >= i; k--) out.push(arr[k]);
          i = j;
        }
        arr = out;
      }
      let s = "";
      let prev = null;
      arr.forEach((it) => {
        if (prev) {
          const a = prev.transform[4], b = it.transform[4];
          const gap = b >= a ? b - (a + (prev.width || 0)) : a - (b + (it.width || 0));
          if (gap > r.h * 0.18 && !/\s$/.test(s) && !/^\s/.test(it.str)) s += " ";
        }
        s += it.str;
        prev = it;
      });
      return s.trim();
    }).filter((l) => l && !(l.length <= 5 && /^[\d\u06F0-\u06F9\u0660-\u0669\s\-\u2013]+$/.test(l)));
    return lines.join("\n");
  }
  async function fzReadPdf(buf, onProg) {
    const lib = await fzLoadPdf();
    const doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const n = doc.numPages, out = [];
    let chars = 0;
    try {
      for (let p = 1; p <= n; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        const t = fzPageText(tc.items);
        out.push(t);
        chars += t.length;
        try { page.cleanup(); } catch (e) { /* ignore */ }
        if (onProg) onProg(p / n);
        if (chars > FZ.maxChars) break;
      }
    } finally { try { doc.destroy(); } catch (e) { /* ignore */ } }
    return { text: out.join("\n\n"), pages: n };
  }

  /* یک فایل را می‌خواند و { text, pages } برمی‌گرداند؛ در خطا Error با پیام فارسی می‌اندازد */
  async function fzReadFile(file, onProg) {
    const ext = fzExt(file.name);
    if (ext === "doc") throw new Error("فایل doc قدیمی پشتیبانی نمی‌شود؛ آن را به صورت docx یا PDF ذخیره کنید.");
    if (!FZ_EXT[ext]) throw new Error("این نوع فایل پشتیبانی نمی‌شود؛ PDF، docx یا متن بدهید.");
    if (file.size > FZ.maxBytes) throw new Error("حجم فایل بیشتر از " + faNum(Math.round(FZ.maxBytes / 1048576)) + " مگابایت است.");
    if (!file.size) throw new Error("فایل خالی است.");
    let buf;
    try { buf = await file.arrayBuffer(); } catch (e) { throw new Error("خواندن فایل ممکن نشد."); }
    let r;
    try {
      if (ext === "pdf") r = await fzReadPdf(buf, onProg);
      else if (ext === "docx") r = await fzReadDocx(buf);
      else r = { text: fzDecodeText(buf), pages: 0 };
    } catch (e) {
      const m = String((e && e.message) || "");
      if (ext === "pdf" && /password/i.test(String(e && e.name) + m)) throw new Error("این PDF رمز دارد.");
      if (ext === "pdf" && m === "pdf") throw new Error("بخش خواندن PDF بارگذاری نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.");
      if (ext === "docx" && m === "old") throw new Error("مرورگر شما قدیمی است و docx را نمی‌خواند؛ از PDF یا متن استفاده کنید.");
      if (ext === "docx") throw new Error("این فایل docx خوانده نشد. شاید خراب باشد.");
      if (ext === "pdf") throw new Error("این PDF خوانده نشد. شاید خراب باشد.");
      throw new Error("خواندن فایل ممکن نشد.");
    }
    const text = fzClean(r.text);
    const letters = (text.match(/[؀-ۿA-Za-z]/g) || []).length;
    const body = text.replace(/\s/g, "").length;
    if (text.length < FZ.minChars || letters < body * 0.35) {
      throw new Error(ext === "pdf" ? "متنی در این PDF پیدا نشد. اگر اسکن (عکسِ صفحه) است، فعلاً پشتیبانی نمی‌شود." : "متن کافی در این فایل نیست.");
    }
    return { text: text, pages: r.pages || Math.max(1, Math.round(text.length / 1800)) };
  }

  /* ---- تقسیم متن بین آزمون‌ها و درخواست‌ها ---- */
  function fzSnap(text, i, dir) {
    /* نزدیک‌ترین مرز بند یا فاصله به i (در بازه‌ی کوچک) */
    const lim = Math.min(400, Math.floor(text.length / 20));
    for (let d = 0; d <= lim; d++) {
      const a = i + (dir > 0 ? d : -d);
      if (a > 0 && a < text.length && (text[a] === "\n" || (d > 0 && text[a] === " "))) return a;
    }
    return i;
  }
  function fzSplit(text, n) {
    if (n <= 1) return [text];
    const out = [];
    let a = 0;
    for (let k = 1; k <= n; k++) {
      const b = k === n ? text.length : fzSnap(text, Math.round((text.length * k) / n), 1);
      out.push(text.slice(a, Math.max(a, b)).trim());
      a = Math.max(a, b);
    }
    return out;
  }
  function fzSample(text, cap) {
    if (text.length <= cap) return text;
    const k = 6, w = Math.floor(cap / k) - 8, parts = [];
    for (let i = 0; i < k; i++) {
      const s0 = Math.floor((i * (text.length - w)) / (k - 1));
      const s = i === 0 ? 0 : fzSnap(text, s0, 1);
      parts.push(text.slice(s, s + w).trim());
    }
    return parts.join("\n…\n");
  }
  /* سؤال‌های یک آزمون به چند درخواست تقسیم می‌شود (هر درخواست حداکثر ۲۵ سؤال) */
  function fzCalls(slice, count) {
    const n = Math.max(1, Math.ceil(count / FZ.perCall));
    const base = Math.floor(count / n), extra = count % n;
    const parts = fzSplit(slice, n);
    const calls = [];
    for (let i = 0; i < n; i++) calls.push({ count: base + (i < extra ? 1 : 0), text: fzSample((parts[i] && parts[i].length >= 200) ? parts[i] : slice, FZ.cap) });
    return calls;
  }
  function fzPlan(files, nExams, byFile, count) {
    const slices = byFile ? files.map((f) => f.text) : fzSplit(files.map((f) => f.text).join("\n\n"), nExams);
    return slices.map((s, i) => ({ n: i + 1, count: count, fileName: byFile ? fzBase(files[i].name) : "", calls: fzCalls(s, count) }));
  }

  /* ---- وضعیت ساخت: همه‌چیز روی سرور (دیتابیس) است. مرورگر فقط می‌پرسد و نشان می‌دهد و چیزی در حافظه‌ی مرورگر نگه نمی‌دارد. ---- */
  const FJ = { data: null, subs: new Set(), pill: null, timer: 0, busy: null, hide: new Set(), marked: new Set(), up: false };
  const fjActive = (j) => !!j && (j.status === "queued" || j.status === "running");
  const fzStats = (d) => {
    const ex = (d && d.exams) || [];
    const ok = ex.filter((e) => e.status === "ok").length;
    const fail = ex.filter((e) => e.status === "fail" || e.status === "cancelled").length;
    return { ok: ok, fail: fail, total: ex.length, left: ex.filter((e) => e.status === "wait" || e.status === "run").length };
  };
  const fzOnLeave = (e) => { e.preventDefault(); e.returnValue = ""; return ""; };
  const fzHere = () => /^\/create\/files(\/|$)/.test(curPath().split("?")[0]);

  function fzEmit(prev) {
    FJ.subs.forEach((f) => { try { f(FJ.data, prev); } catch (e) { console.error("fz sub", e); } });
    fzPillPaint();
  }
  async function fzPoll() {
    const t = tokenOf();
    if (!t) { const had = FJ.data; FJ.data = null; if (had) fzEmit(had); return null; }
    if (FJ.busy) return FJ.busy;
    FJ.busy = rpc("fj_status", { p_token: t }).then((r) => {
      if (tokenOf() !== t || !r || !r.ok) return FJ.data;
      const prev = FJ.data;
      FJ.data = r;
      if (typeof r.tokens === "number") tkSet(r.tokens);
      fzEmit(prev);
      return FJ.data;
    }).catch(() => FJ.data).then((v) => { FJ.busy = null; return v; });
    return FJ.busy;
  }
  function fzSchedule() {
    clearTimeout(FJ.timer);
    FJ.timer = 0;
    if (!tokenOf()) return;
    const act = fjActive(FJ.data && FJ.data.job);
    const ms = act ? (fzHere() ? 3000 : 6000) : (document.hidden ? 90000 : 30000);
    FJ.timer = setTimeout(async () => { await fzPoll(); fzSchedule(); }, ms);
  }
  async function fzSync() {
    clearTimeout(FJ.timer);
    FJ.timer = 0;
    if (!tokenOf()) { FJ.data = null; fzPillPaint(); return; }
    await fzPoll();
    fzSchedule();
  }
  function fzMarkSeen(d) {
    const j = d && d.job;
    if (!j || fjActive(j) || j.seen || FJ.marked.has(j.id) || !tokenOf()) return;
    FJ.marked.add(j.id);
    rpc("fj_seen", { p_token: tokenOf(), p_job: j.id }).then(() => { if (FJ.data && FJ.data.job && FJ.data.job.id === j.id) FJ.data.job.seen = true; fzPillPaint(); }).catch(() => FJ.marked.delete(j.id));
  }

  /* ---- نوار کوچک پیشرفت روی صفحه‌های دیگر ---- */
  function fzPillPaint() {
    const d = FJ.data, j = d && d.job;
    let el = FJ.pill;
    const show = j && !fzHere() && (fjActive(j) || (!j.seen && !FJ.hide.has(j.id)));
    if (!show) { if (el) { el.remove(); FJ.pill = null; } return; }
    fzCss();
    if (!el) {
      el = document.createElement("div");
      el.className = "fz-pill";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
      FJ.pill = el;
      el.addEventListener("click", (e) => {
        if (!e.target.closest("[data-x]")) return;
        const cur = FJ.data && FJ.data.job;
        if (!cur) return;
        FJ.hide.add(cur.id);
        rpc("fj_seen", { p_token: tokenOf(), p_job: cur.id }).catch(() => {});
        fzPillPaint();
      });
    }
    const s = fzStats(d);
    const running = fjActive(j);
    const bad = !running && s.fail > 0;
    el.innerHTML = (running ? '<span class="fz-st run" aria-hidden="true"></span>' : '<span class="fz-st ' + (bad ? "fail" : "ok") + '" aria-hidden="true">' + (bad ? "!" : "✓") + "</span>") +
      "<span>" + (running ? "در حال ساخت آزمون‌ها: " + faNum(s.ok) + " از " + faNum(s.total) : faNum(s.ok) + " از " + faNum(s.total) + " آزمون ساخته شد") + "</span>" +
      '<a href="/create/files">' + (running ? "مشاهده" : "نتیجه") + "</a>" + (running ? "" : '<button type="button" data-x aria-label="بستن">×</button>');
  }
  window.addEventListener("pz:nav", () => setTimeout(() => { fzPillPaint(); fzSchedule(); }, 0));
  window.addEventListener("authchange", () => { FJ.hide.clear(); FJ.marked.clear(); fzSync(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && tokenOf()) fzSync(); });

  /* ---- نمایش پیوند «از روی موضوع / از روی فایل» بالای هر دو صفحه ---- */
  function fzSwitch(cur) {
    const a = (id, t, extra) => '<a href="' + withG("/create/" + id) + '" data-base="/create/' + id + '"' + (cur === id ? ' aria-current="page"' : "") + ">" + t + (extra || "") + "</a>";
    return '<nav class="fz-sw" aria-label="روش ساخت">' + a("ai", "از روی موضوع") + a("files", "از روی فایل", ' <span class="soon-badge ai-badge">جدید</span>') + "</nav>";
  }

  const FZ_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 7.97"/><path d="M12 20v-8m0 0-3 3m3-3 3 3"/></svg>';

  function viewFiles() {
    setTitle("ساخت آزمون از روی فایل");
    setTimeout(fillGroupChip, 0);
    tkSync(true);
    fzCss();
    const st = { mode: "mixed", level: "medium", count: 20, exams: 1, byFile: false };
    const pick = exPick({ files: true, total: () => exCount() * st.count, onChange: () => { if (!gone) paint(); } });
    const files = [];
    let gone = false, sending = false, uid = 0, qChain = Promise.resolve();
    const $ = (id) => document.getElementById(id);

    const seg = (name, items) =>
      '<div class="seg" role="group" data-seg="' + name + '">' +
      items.map((i) => '<button type="button" data-v="' + i[0] + '" aria-pressed="' + String(st[name] === i[0]) + '">' + i[1] + "</button>").join("") + "</div>";

    app.innerHTML =
      '<a class="back" href="' + withG("/create") + '">' + ICONS.back + " بازگشت به انتخاب مدل</a>" +
      "<h1>ساخت آزمون با هوش مصنوعی</h1>" + (createGroup ? '<div id="grpChipBox">' + groupChip(groupName(createGroup)) + "</div>" : "") +
      fzSwitch("files") +
      '<p class="muted">جزوه یا کتابتان را بدهید؛ سؤال‌ها فقط از روی همان ساخته می‌شود و مثل بقیه‌ی آزمون‌ها لینک شرکت و لینک نتایج می‌گیرید.</p>' +
      '<div id="fzRun" hidden></div>' +
      '<div id="fzFormBox">' +
      '<div class="card ai-form fz-form">' +
      '<div class="tk-strip">' + COIN + '<span class="tk-strip-t">موجودی شما: <b data-tk>' + tkTxt() + '</b> پولک</span><a class="tk-strip-a" href="/tokens">خرید پولک</a></div>' +
      '<label id="fzFl">فایل‌ها</label>' +
      '<div class="fz-drop" id="fzDrop" tabindex="0" role="button" aria-labelledby="fzFl fzDt">' + FZ_UP +
      '<strong id="fzDt">فایل‌ها را اینجا رها کنید یا برای انتخاب بزنید</strong>' +
      "<small>PDF، Word (docx) یا متن · تا " + faNum(FZ.maxFiles) + " فایل · هر فایل تا " + faNum(Math.round(FZ.maxBytes / 1048576)) + " مگابایت</small></div>" +
      '<input type="file" id="fzIn" multiple accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden>' +
      '<ul class="fz-list" id="fzList" aria-live="polite"></ul>' +
      '<p class="fz-sum" id="fzSum" hidden></p>' +
      '<p class="hint" style="margin:10px 2px 0">متن فایل‌ها داخل مرورگر شما استخراج و برای ساخت به سرور فرستاده می‌شود (خود فایل ذخیره نمی‌شود و متن ۲۴ ساعت بعد از پایان ساخت پاک می‌شود). بعد از شروع ساخت می‌توانید مرورگر را ببندید؛ ساخت روی سرور ادامه پیدا می‌کند. PDF اسکن‌شده (عکس) فعلاً پشتیبانی نمی‌شود.</p>' +
      '<label for="fzName">نام آزمون <small class="hint">(اختیاری)</small></label><input id="fzName" type="text" maxlength="120" autocomplete="off" placeholder="اگر خالی بماند، هوش مصنوعی نام می‌گذارد">' +
      '<label for="fzFocus">روی کدام بخش تمرکز کنیم؟ <small class="hint">(اختیاری)</small></label><input id="fzFocus" type="text" maxlength="200" autocomplete="off" placeholder="مثلاً: فقط فصل ۲ و ۳">' +
      pick.html() +
      '<label>مدل سؤال‌ها</label>' + seg("mode", [["tf", "درست / نادرست"], ["mcq", "تستی"], ["mixed", "مخلوط"]]) +
      '<label>درجه‌ی سختی</label>' + seg("level", [["easy", "آسان"], ["medium", "متوسط"], ["hard", "سخت"]]) +
      '<label for="fzCount">تعداد سؤال در هر آزمون</label><div class="stepper"><button type="button" id="fzCm" aria-label="کمتر">−</button><input id="fzCount" type="text" inputmode="numeric" value="' + faNum(st.count) + '" aria-label="تعداد سؤال"><button type="button" id="fzCp" aria-label="بیشتر">+</button></div>' +
      '<details class="fz-multi" id="fzMulti"><summary>ساخت چند آزمون از این فایل‌ها</summary><div class="fz-multi-b">' +
      '<label for="fzEx">تعداد آزمون</label><div class="stepper"><button type="button" id="fzEm" aria-label="کمتر">−</button><input id="fzEx" type="text" inputmode="numeric" value="' + faNum(st.exams) + '" aria-label="تعداد آزمون"><button type="button" id="fzEp" aria-label="بیشتر">+</button></div>' +
      '<label class="fz-chk" id="fzByW" hidden><input type="checkbox" id="fzBy"><span id="fzByT">هر فایل یک آزمون جدا</span></label>' +
      '<p class="hint" style="margin:10px 0 0">متن به بخش‌های مساوی تقسیم می‌شود و هر آزمون از بخش خودش ساخته می‌شود تا سؤال‌ها تکراری نباشند. ساخت چند آزمون چند دقیقه طول می‌کشد.</p>' +
      "</div></details>" +
      durHtml(["none", "auto", "set"], "none", 15) +
      '<p class="tk-cost" id="fzCost" aria-live="polite"></p><p class="fz-warn" id="fzWarn" hidden></p>' +
      "</div>" +
      '<div id="fzMsg"></div>' +
      '<div class="actions"><a class="btn ghost" href="' + withG("/create") + '">' + ICONS.back + ' بازگشت</a><button class="btn" id="fzGo" type="button" disabled>' + ICONS.spark + ' <span id="fzGoT">ساخت آزمون و دریافت لینک</span><span class="go-cost" id="fzGoCost"></span></button></div>' +
      "</div>";

    const msg = $("fzMsg");
    pick.bind(app);
    const fail = (t, extra) => { msg.innerHTML = '<div class="err" role="alert">' + esc(t) + (extra || "") + "</div>"; };
    const durCtl = durBind(app, "none", 15, null);
    app.querySelectorAll(".seg[data-seg]").forEach((g) => {
      g.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        st[g.dataset.seg] = b.dataset.v;
        g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      });
    });

    /* ---- فایل‌ها ---- */
    const okFiles = () => files.filter((f) => f.status === "ok");
    const numOf = (el, dflt) => {
      const t = el.value.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
      return t ? parseInt(t, 10) : dflt;
    };
    const listEl = $("fzList"), sumEl = $("fzSum"), drop = $("fzDrop"), fin = $("fzIn");

    const rowHtml = (f) => {
      const ext = FZ_EXT[fzExt(f.name)] || "؟";
      const cls = f.status === "err" ? "er" : ext === "PDF" ? "pdf" : ext === "DOCX" ? "docx" : "txt";
      const meta = f.status === "read" ? "در حال خواندن…" : f.status === "err" ? esc(f.err) : fzSize(f.size) + " · " + fmtN(f.text.length) + " کاراکتر · حدود " + faNum(f.pages) + " صفحه";
      return '<li class="fz-it" data-id="' + f.id + '"><span class="fz-ic ' + cls + '" aria-hidden="true">' + (f.status === "err" ? "!" : ext) + "</span>" +
        '<span><span class="fz-n" dir="auto">' + esc(f.name) + '</span><span class="fz-m' + (f.status === "err" ? " er" : "") + '">' + meta + "</span>" +
        (f.status === "read" ? '<span class="fz-pg"><i style="--v:' + (f.prog || 0.05) + '"></i></span>' : "") + "</span>" +
        '<button type="button" class="fz-x" data-rm="' + f.id + '" aria-label="حذف ' + esc(f.name) + '">×</button></li>';
    };
    const paintList = () => {
      listEl.innerHTML = files.map(rowHtml).join("");
      drop.classList.toggle("off", files.length >= FZ.maxFiles);
      paint();
    };
    const paintProg = (f) => {
      const li = listEl.querySelector('[data-id="' + f.id + '"] .fz-pg i');
      if (li) li.style.setProperty("--v", String(Math.max(0.05, f.prog || 0)));
    };

    const addFiles = (list) => {
      msg.innerHTML = "";
      const arr = Array.prototype.slice.call(list || []);
      let skipped = 0, dup = 0;
      arr.forEach((file) => {
        if (files.length >= FZ.maxFiles) { skipped++; return; }
        if (files.some((f) => f.name === file.name && f.size === file.size)) { dup++; return; }
        const f = { id: "f" + (++uid), name: file.name, size: file.size, status: "read", text: "", pages: 0, err: "", prog: 0.05 };
        files.push(f);
        qChain = qChain.then(async () => {
          if (gone || files.indexOf(f) < 0) return;
          try {
            const r = await fzReadFile(file, (p) => { f.prog = p; paintProg(f); });
            if (gone || files.indexOf(f) < 0) return;
            const total = okFiles().reduce((s, x) => s + x.text.length, 0) + r.text.length;
            if (total > FZ.maxChars) throw new Error("حجم کل متن فایل‌ها بیش از حد است؛ فایل کمتری بدهید.");
            f.text = r.text; f.pages = r.pages; f.status = "ok";
          } catch (e) {
            f.status = "err"; f.err = (e && e.message) || "خواندن فایل ممکن نشد.";
          }
          if (!gone) paintList();
        });
      });
      if (skipped) fail("حداکثر " + faNum(FZ.maxFiles) + " فایل می‌شود داد.");
      else if (dup) fail("این فایل قبلاً اضافه شده است.");
      paintList();
    };
    drop.addEventListener("click", () => { if (files.length < FZ.maxFiles) fin.click(); });
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drop.click(); } });
    fin.addEventListener("change", () => { addFiles(fin.files); fin.value = ""; });
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
    const onWinDrop = (e) => { if (e.target && e.target.closest && !e.target.closest("#fzDrop") && document.getElementById("fzDrop")) e.preventDefault(); };
    window.addEventListener("dragover", onWinDrop);
    window.addEventListener("drop", onWinDrop);
    listEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]");
      if (!b) return;
      const i = files.findIndex((f) => f.id === b.dataset.rm);
      if (i >= 0) { files.splice(i, 1); msg.innerHTML = ""; paintList(); }
    });

    /* ---- هزینه و آماده‌بودن ---- */
    const exCount = () => (st.byFile ? okFiles().length : Math.min(FZ.maxExams, Math.max(1, st.exams)));
    let canGo = false;
    function paint() {
      const ok = okFiles(), reading = files.some((f) => f.status === "read");
      const chars = ok.reduce((s, f) => s + f.text.length, 0);
      sumEl.hidden = !ok.length;
      if (ok.length) sumEl.innerHTML = "مجموع متن: <b>" + fmtN(chars) + " کاراکتر</b> (حدود " + faNum(Math.max(1, Math.round(chars / 1800))) + " صفحه) از " + faNum(ok.length) + " فایل";
      /* گزینه‌ی «هر فایل یک آزمون» فقط وقتی دو فایل یا بیشتر هست */
      const byW = $("fzByW");
      byW.hidden = ok.length < 2;
      if (ok.length < 2 && st.byFile) { st.byFile = false; $("fzBy").checked = false; }
      $("fzByT").textContent = "هر فایل یک آزمون جدا (" + faNum(ok.length) + " آزمون)";
      $("fzEx").disabled = st.byFile; $("fzEm").disabled = st.byFile; $("fzEp").disabled = st.byFile;
      $("fzEx").value = faNum(exCount());
      const n = exCount(), c = st.count, p = pick.price(), total = n * c * p, b = tk.bal;
      const calls = n * Math.ceil(c / FZ.perCall);
      const mins = Math.max(1, Math.ceil((calls * FZ.secPerCall) / 60));
      const low = b != null && b < total;
      const cost = $("fzCost");
      cost.className = "tk-cost" + (low ? " low" : "");
      cost.innerHTML = low
        ? "برای " + faNum(n * c) + " سؤال با «" + esc(pick.name()) + "»، " + faNum(total) + " پولک لازم است و موجودی شما " + faNum(b) + " پولک است. تعداد سؤال یا آزمون را کمتر کنید، مدل ارزان‌تر بردارید یا " + '<a href="/tokens">پولک بخرید</a>.'
        : (n > 1 ? faNum(n) + " آزمون × " + faNum(c) + " سؤال × " + faNum(p) + " پولک = <b>" + faNum(total) + " پولک</b>" : "هر سؤال با «" + esc(pick.name()) + "» " + faNum(p) + " پولک است؛ این آزمون <b>" + faNum(c * p) + " پولک</b> مصرف می‌کند.") +
          (ok.length ? " زمان ساخت: حدود " + faNum(mins) + " دقیقه (تخمینی)." : "");
      /* هشدار اگر متن برای این تعداد سؤال کم است */
      const warn = $("fzWarn");
      let w = "";
      if (ok.length) {
        const per = st.byFile ? Math.min.apply(null, ok.map((f) => f.text.length)) : chars / n;
        if (per < FZ.minChars) w = "متنِ هر آزمون خیلی کم است؛ تعداد آزمون‌ها را کمتر کنید یا فایل بیشتری بدهید.";
        else if (per < c * 150) w = "متن برای " + faNum(c) + " سؤال در هر آزمون کم است (حدود " + fmtN(Math.round(per)) + " کاراکتر)؛ ممکن است سؤال‌ها تکراری یا ضعیف شوند. تعداد سؤال یا آزمون را کمتر کنید.";
        if (!w && chars > FZ.cap * 1.2 * n) w = "متن شما از حدی که در هر آزمون استفاده می‌شود بلندتر است؛ از سراسر متن نمونه‌هایی برداشته می‌شود. برای پوشش کامل‌تر، چند آزمون بسازید.";
      }
      warn.hidden = !w; warn.textContent = w;
      const blocked = !ok.length || reading || (ok.length && (st.byFile ? Math.min.apply(null, ok.map((f) => f.text.length)) : chars / n) < FZ.minChars);
      canGo = !blocked;
      const go = $("fzGo");
      go.disabled = blocked || sending;
      if (!sending) {
        $("fzGoCost").textContent = " · " + faNum(total) + " پولک";
        $("fzGoT").textContent = n > 1 ? "ساخت " + faNum(n) + " آزمون" : "ساخت آزمون و دریافت لینک";
      }
    }
    const setCount = (v) => { st.count = Math.min(FZ.maxQ, Math.max(1, v)); $("fzCount").value = faNum(st.count); paint(); };
    const setEx = (v) => { st.exams = Math.min(FZ.maxExams, Math.max(1, v)); $("fzEx").value = faNum(st.exams); paint(); };
    $("fzCm").addEventListener("click", () => setCount(numOf($("fzCount"), st.count) - 1));
    $("fzCp").addEventListener("click", () => setCount(numOf($("fzCount"), st.count) + 1));
    $("fzCount").addEventListener("blur", () => setCount(numOf($("fzCount"), st.count)));
    $("fzCount").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
    $("fzEm").addEventListener("click", () => setEx(numOf($("fzEx"), st.exams) - 1));
    $("fzEp").addEventListener("click", () => setEx(numOf($("fzEx"), st.exams) + 1));
    $("fzEx").addEventListener("blur", () => setEx(numOf($("fzEx"), st.exams)));
    $("fzEx").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
    $("fzBy").addEventListener("change", (e) => { st.byFile = e.target.checked; paint(); });
    const onTk = () => paint();
    window.addEventListener("tkchange", onTk);

    /* ---- نمایش پیشرفت/نتیجه (از روی وضعیتی که سرور می‌دهد) ---- */
    const runBox = $("fzRun"), formBox = $("fzFormBox");
    const view = { showId: "", decided: false, dismissed: "", sig: "" };
    const retryable = (d) => {
      const j = d && d.job;
      if (!j || fjActive(j) || !fzStats(d).fail) return false;
      return j.finished && Date.now() - new Date(j.finished).getTime() < 86400000;
    };
    const exRow = (ex, d) => {
      const multi = d.exams.length > 1;
      const label = ex.status === "ok" && ex.title ? esc(ex.title) : (multi ? "آزمون " + faNum(ex.n) + (ex.file ? " — " + esc(ex.file) : "") : "آزمون");
      let sub = "";
      if (ex.status === "run") sub = "در حال ساخت… (بخش " + faNum(Math.min(ex.done + 1, ex.calls)) + " از " + faNum(ex.calls) + ")";
      else if (ex.status === "ok") sub = faNum(ex.got) + " سؤال" + (ex.partial ? " (از " + faNum(ex.count) + " خواسته‌شده؛ پولک مابقی برگشت)" : "");
      else if (ex.status === "wait") sub = "در صف";
      else if (ex.status === "cancelled") sub = "لغو شد؛ پولکش برگشت";
      const mk = ex.status === "ok" ? '<span class="fz-st ok" aria-hidden="true">✓</span>' : (ex.status === "fail" || ex.status === "cancelled") ? '<span class="fz-st fail" aria-hidden="true">!</span>' : ex.status === "run" ? '<span class="fz-st run" aria-hidden="true"></span>' : '<span class="fz-st" aria-hidden="true"></span>';
      const right = ex.status === "ok" && ex.id ? '<a class="btn small ghost" href="/m/' + encodeURIComponent(ex.id) + '">نتایج و لینک</a>' : "";
      const subHtml = ex.status === "fail" ? '<small class="er">' + esc(ex.err || "ساخته نشد") + " (پولکش برگشت)</small>" : "<small>" + sub + "</small>";
      return '<li class="fz-e ' + ex.status + '">' + mk + '<span class="t">' + label + subHtml + "</span>" + right + "</li>";
    };
    const hold = (t) => { runBox.hidden = false; formBox.hidden = true; runBox.innerHTML = '<div class="card fz-run"><p class="muted" style="margin:0">' + t + "</p></div>"; };
    function paintRun(d, note) {
      if (gone) return;
      const j = d && d.job;
      if (!j || view.showId !== j.id) { view.sig = ""; runBox.hidden = true; formBox.hidden = false; return; }
      runBox.hidden = false; formBox.hidden = true;
      const sig = JSON.stringify([view.showId, d.job, d.exams]);
      if (!note && view.sig === sig && $("fzNote")) return;
      view.sig = sig;
      const s = fzStats(d);
      const running = fjActive(j);
      const pct = s.total ? s.ok / s.total : 0;
      let title;
      if (running) title = j.cancel ? "در حال توقف…" : "در حال ساخت آزمون" + (s.total > 1 ? "‌ها" : "") + "…";
      else if (j.status === "cancelled" || (j.cancel && s.fail)) title = "ساخت متوقف شد";
      else if (s.fail && !s.ok) title = "ساخت آزمون ناموفق بود";
      else if (s.fail) title = faNum(s.ok) + " آزمون ساخته شد و " + faNum(s.fail) + " ناموفق بود";
      else title = s.total > 1 ? "همه‌ی " + faNum(s.total) + " آزمون آماده شد" : "آزمون آماده شد";
      const keepOpen = runBox.querySelector("#fzNote");
      runBox.innerHTML =
        '<div class="card fz-run"><h2>' + title + "</h2>" +
        '<div class="fz-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct * 100) + '"><i style="--v:' + pct + '"></i></div>' +
        '<p class="fz-stat"><b>' + faNum(s.ok) + "</b> از " + faNum(s.total) + " آزمون آماده است · " + faNum(j.spent) + " پولک مصرف شد</p>" +
        '<div id="fzNote">' + (note || (keepOpen ? keepOpen.innerHTML : "")) + "</div>" +
        '<ul class="fz-ex">' + d.exams.map((ex) => exRow(ex, d)).join("") + "</ul>" +
        (running ? '<p class="hint" style="margin:12px 0 0">ساخت روی سرور انجام می‌شود. می‌توانید به بخش‌های دیگر بروید یا مرورگر را ببندید و بعداً برگردید؛ هیچ چیزی از بین نمی‌رود.</p>' : "") +
        '<div class="actions" style="margin-top:14px">' +
        (running ? '<button class="btn ghost danger" id="fzStop" type="button"' + (j.cancel ? " disabled" : "") + ">توقف ساخت</button>"
          : (s.fail && retryable(d) ? '<button class="btn" id="fzRetry" type="button">تلاش دوباره برای ' + faNum(s.fail) + " آزمون</button>" : "") +
            '<a class="btn ghost" href="/">آزمون‌های من</a><button class="btn ghost" id="fzNew" type="button">ساخت آزمون تازه</button>') +
        "</div></div>";
      const noteBox = $("fzNote");
      const say = (t, extra) => { noteBox.innerHTML = '<div class="err" role="alert" style="margin:12px 0 0">' + esc(t) + (extra || "") + "</div>"; };
      const stop = $("fzStop");
      if (stop) stop.addEventListener("click", async () => {
        stop.disabled = true;
        try { await rpc("fj_cancel", { p_token: tokenOf(), p_job: j.id }); } catch (e) { say((e && e.message) || "توقف انجام نشد."); stop.disabled = false; return; }
        fzPoll();
      });
      const retry = $("fzRetry");
      if (retry) retry.addEventListener("click", async () => {
        retry.disabled = true;
        let r;
        try { r = await rpc("fj_retry", { p_token: tokenOf(), p_job: j.id }); } catch (e) { say((e && e.message) || "خطا در ارتباط با سرور."); retry.disabled = false; return; }
        if (r && r.ok) { if (typeof r.tokens === "number") tkSet(r.tokens); fzSync(); return; }
        retry.disabled = false;
        const er = r && r.error;
        if (er === "insufficient") { if (typeof r.tokens === "number") tkSet(r.tokens); say("پولک شما کافی نیست؛ این کار " + faNum(r.need) + " پولک می‌خواهد و موجودی شما " + faNum(r.tokens) + " است.", ' <a class="err-a" href="/tokens">خرید پولک</a>'); }
        else if (er === "expired") say("متن فایل‌ها از سرور پاک شده است؛ لطفاً فایل‌ها را دوباره بدهید و از اول بسازید.");
        else if (er === "busy") say("یک ساخت دیگر در جریان است.");
        else if (er === "no_session") say("نشست شما تمام شده است؛ دوباره وارد حساب شوید.");
        else say("تلاش دوباره ممکن نشد.");
      });
      const nw = $("fzNew");
      if (nw) nw.addEventListener("click", () => { view.dismissed = j.id; view.showId = ""; paintRun(FJ.data); window.scrollTo({ top: 0 }); });
    }
    const sub = (d, prev) => {
      if (gone) return;
      const j = d && d.job;
      if (!view.decided) {
        view.decided = true;
        if (j && (fjActive(j) || !j.seen || retryable(d)) && view.dismissed !== j.id) view.showId = j.id;
      }
      if (j && view.showId === j.id && !fjActive(j)) {
        /* اگر فقط یک آزمون بود و جلوی چشم ما تمام شد، مثل ساخت عادی مستقیم به صفحه‌ی آزمون می‌رویم */
        const was = prev && prev.job && prev.job.id === j.id && fjActive(prev.job);
        if (was && d.exams.length === 1 && d.exams[0].status === "ok" && d.exams[0].id) {
          tkLast = { used: j.spent, bal: tk.bal };
          fzMarkSeen(d);
          go("/m/" + encodeURIComponent(d.exams[0].id) + "?new=1");
          return;
        }
        fzMarkSeen(d);
      }
      paintRun(d);
    };
    FJ.subs.add(sub);

    /* ---- شروع: ارسال متن به دیتابیس و سپردن کار به سرور ---- */
    const goBtn = $("fzGo");
    async function startJob() {
      msg.innerHTML = "";
      if (sending || FJ.up || !canGo) return;
      const ok = okFiles();
      if (!ok.length) return fail("اول یک فایل بدهید.");
      st.count = Math.min(FZ.maxQ, Math.max(1, numOf($("fzCount"), st.count)));
      const n = exCount(), total = n * st.count * pick.price();
      if (tk.bal != null && tk.bal < total) return fail("پولک شما کافی نیست؛ موجودی شما " + faNum(tk.bal) + " پولک است و این کار " + faNum(total) + " پولک می‌خواهد.", ' <a class="err-a" href="/tokens">خرید پولک</a>');
      if (fjActive(FJ.data && FJ.data.job)) { view.showId = FJ.data.job.id; paintRun(FJ.data); return; }
      const dm = durCtl.mode();
      const plan = fzPlan(ok, n, st.byFile, st.count);
      const params = {
        mode: st.mode, level: st.level, focus: $("fzFocus").value.trim().slice(0, 200), name: $("fzName").value.trim().slice(0, 120),
        fallback: ok.length === 1 ? fzBase(ok[0].name) || "آزمون" : "آزمون از روی فایل‌ها",
        by_file: st.byFile, ai: pick.id(), group: createGroup || "", dur_mode: dm, dur_min: dm === "set" ? durCtl.min() : 0,
      };
      const exams = plan.map((ex) => ({
        count: ex.count, file_name: ex.fileName || "",
        calls: ex.calls.map((c) => ({ count: c.count, parts: Math.max(1, Math.ceil(c.text.length / FZ.chunk)) })),
      }));
      const tasks = [];
      plan.forEach((ex) => ex.calls.forEach((c, ci) => {
        const np = Math.max(1, Math.ceil(c.text.length / FZ.chunk));
        for (let p = 0; p < np; p++) tasks.push({ n: ex.n, call: ci, part: p, text: c.text.slice(p * FZ.chunk, (p + 1) * FZ.chunk) });
      }));
      const explain = (er, r) => {
        if (er === "no_session") return "نشست شما تمام شده است؛ دوباره وارد حساب شوید.";
        if (er === "busy") return "یک ساخت دیگر در جریان است.";
        if (er === "group") return "گروه پیدا نشد یا شما مالک یا مدیر آن نیستید.";
        if (er === "model") return "این مدل هوش مصنوعی الان در دسترس نیست؛ مدل دیگری انتخاب کنید.";
        if (er === "incomplete") return "ارسال متن کامل نشد؛ دوباره تلاش کنید.";
        if (er === "bad_text" || er === "bad_request") return "درخواست نامعتبر بود؛ فایل‌ها یا تنظیمات را بررسی کنید.";
        return "ساخت شروع نشد. دوباره تلاش کنید.";
      };
      sending = true; FJ.up = true;
      window.addEventListener("beforeunload", fzOnLeave);
      goBtn.disabled = true; pick.lock(true);
      const setGo = (t) => { $("fzGoT").textContent = t; $("fzGoCost").textContent = ""; };
      setGo("در حال ارسال فایل‌ها…");
      const dis = [drop, listEl];
      dis.forEach((e) => e.style.pointerEvents = "none");
      try {
        const t0 = tokenOf();
        if (!t0) throw { soft: "نشست شما تمام شده است؛ دوباره وارد حساب شوید." };
        const cr = await rpc("fj_create", { p_token: t0, p_params: params, p_exams: exams });
        if (!cr || !cr.ok) {
          if (cr && cr.error === "busy") fzPoll();
          throw { soft: explain(cr && cr.error, cr) };
        }
        let next = 0, done = 0, bad = null;
        const put = async (t) => {
          let last = "";
          for (let a = 0; a < 4; a++) {
            if (bad) return;
            try {
              const r = await rpc("fj_put", { p_token: tokenOf(), p_job: cr.id, p_n: t.n, p_call: t.call, p_part: t.part, p_text: t.text });
              if (r && r.ok) return;
              last = (r && r.error) || "";
              if (last === "no_session" || last === "not_found" || last === "bad_request" || last === "bad_text") break;
            } catch (e) { last = "net"; }
            await fzSleep(900 * (a + 1));
          }
          bad = bad || (last === "net" ? "ارتباط با سرور قطع شد؛ اتصال اینترنت را بررسی و دوباره تلاش کنید." : explain(last));
        };
        const worker = async () => {
          while (!bad && next < tasks.length) {
            const t = tasks[next++];
            await put(t);
            done++;
            setGo("در حال ارسال فایل‌ها… " + faNum(Math.round((done / tasks.length) * 100)) + "٪");
          }
        };
        await Promise.all([worker(), worker(), worker()]);
        if (bad) throw { soft: bad };
        setGo("در حال شروع ساخت…");
        let sr = null;
        for (let a = 0; a < 3 && !sr; a++) {
          try { sr = await rpc("fj_start", { p_token: tokenOf(), p_job: cr.id }); } catch (e) { if (a === 2) throw { soft: "ارتباط با سرور قطع شد؛ دوباره تلاش کنید." }; await fzSleep(1000 * (a + 1)); }
        }
        if (!sr || !sr.ok) {
          if (sr && sr.error === "insufficient") {
            if (typeof sr.tokens === "number") tkSet(sr.tokens);
            throw { soft: "پولک شما کافی نیست؛ این کار " + faNum(sr.need) + " پولک می‌خواهد و موجودی شما " + faNum(sr.tokens) + " است.", extra: ' <a class="err-a" href="/tokens">خرید پولک</a>' };
          }
          if (sr && sr.error === "busy") fzPoll();
          throw { soft: explain(sr && sr.error, sr) };
        }
        if (typeof sr.tokens === "number") tkSet(sr.tokens);
        view.decided = true;
        view.showId = sr.id;
        await fzSync();
        paintRun(FJ.data);
        window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
      } catch (e) {
        if (e && e.soft) fail(e.soft, e.extra);
        else fail((e && e.message) || "خطایی رخ داد؛ دوباره تلاش کنید.");
      } finally {
        sending = false; FJ.up = false; pick.lock(false);
        window.removeEventListener("beforeunload", fzOnLeave);
        dis.forEach((e) => e.style.pointerEvents = "");
        if (!gone) paint();
      }
    }
    goBtn.addEventListener("click", startJob);

    /* ---- شروع نمایش: اول از سرور می‌پرسیم کار نیمه‌تمام یا نتیجه‌ی ندیده‌ای هست یا نه ---- */
    paintList();
    hold("در حال بررسی ساخت‌های قبلی…");
    let first = true;
    Promise.race([fzPoll(), fzSleep(6000)]).then(() => {
      if (gone || !first) return;
      first = false;
      if (!view.decided) { view.decided = true; const d = FJ.data, j = d && d.job; if (j && (fjActive(j) || !j.seen || retryable(d))) view.showId = j.id; }
      paintRun(FJ.data);
      if (FJ.data && FJ.data.job && view.showId === FJ.data.job.id && !fjActive(FJ.data.job)) fzMarkSeen(FJ.data);
      fzSchedule();
    });
    fzPillPaint();

    return function cleanup() {
      gone = true;
      FJ.subs.delete(sub);
      pick.destroy();
      window.removeEventListener("tkchange", onTk);
      window.removeEventListener("dragover", onWinDrop);
      window.removeEventListener("drop", onWinDrop);
      setTimeout(fzPillPaint, 0);
    };
  }

  /* ---------- پرداخت پولک (درگاه زیبال) ---------- */
  const payFlag = {
    get() { try { return localStorage.getItem("pz.pay") || ""; } catch (e) { return ""; } },
    set(v) { try { localStorage.setItem("pz.pay", v); } catch (e) { /* ignore */ } },
    clear() { try { localStorage.removeItem("pz.pay"); } catch (e) { /* ignore */ } },
  };
  async function payCall(body) {
    const res = await fetch(cfg.SUPABASE_URL + "/functions/v1/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify(Object.assign({ token: tokenOf() }, body)),
    });
    let d = null;
    try { d = await res.json(); } catch (e) { /* ignore */ }
    return { ok: res.ok, status: res.status, d: d };
  }
  const WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.1"/></svg>';

  /* ---------- صفحه‌ی خرید پولک ---------- */
  function viewTokens(token) {
    setTitle("خرید پولک");
    tkSync(true);
    let n = 100;
    const quizzes = (v) => Math.floor(v / 10);
    const quizTxt = (v) => (quizzes(v) >= 1 ? "حدود " + faNum(quizzes(v)) + " آزمون ۱۰ سؤاله" : "کمتر از یک آزمون ۱۰ سؤاله");

    app.innerHTML =
      '<a class="back" href="/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a>" +
      '<div class="page-head"><h1>خرید پولک</h1><a class="btn small ghost" href="/wallet">' + MENU_IC.wallet + " بخش مالی</a></div>" +
      '<p class="tkp-lead"><b>۱ پولک = ۱ سؤال آزمون با مدل پایه</b><small> (مدل‌های قوی‌تر ۲ تا ۶ پولک برای هر سؤال)</small></p>' +
      '<div class="card tkp-res" id="tkRes" role="status" aria-live="polite" hidden></div>' +
      '<div class="card tkp-buy"><h2 class="tkp-h">چند پولک می‌خواهید؟</h2>' +
      '<div class="tkp-step"><button type="button" class="tkp-sb" id="tkM" aria-label="یک پولک کمتر">−</button>' +
      '<label class="tkp-num"><input id="tkN" type="text" inputmode="numeric" autocomplete="off" aria-label="تعداد پولک"><span>پولک</span></label>' +
      '<button type="button" class="tkp-sb" id="tkP" aria-label="یک پولک بیشتر">+</button></div>' +

      '<div class="tkp-sum">' +
      '<div class="tkp-line"><span>قیمت هر پولک</span><span class="tkp-v"><b id="tkRate"></b><em class="tkp-badge" id="tkOff"></em></span></div>' +
      '<div class="tkp-line"><span>معادل</span><b id="tkEq" class="tkp-v"></b></div>' +
      '<div class="tkp-line tot"><span>مبلغ قابل پرداخت</span><span class="tkp-tot"><b id="tkTot"></b> <small>تومان</small></span></div></div>' +
      '<div class="sr-only" id="tkSr" role="status" aria-live="polite"></div>' +
      '<div class="err tkp-err" id="tkErr" role="alert" hidden></div>' +
      '<button class="btn wide tkp-pay" id="tkPay" type="button"></button></div>' +

      '<details class="card tkp-tbl"><summary>جدول قیمت <small>(هر چه بیشتر بخرید، ارزان‌تر)</small></summary><div class="tkp-rows">' +
      TK_TIERS.map((t, i) => '<div class="tkp-row" data-i="' + i + '"><span>' + TK_TIER_LBL[i] + "</span><b>" + fmtN(t[1]) + " <small>تومان برای هر پولک</small></b></div>").join("") + "</div></details>";

    const $ = (id) => document.getElementById(id);
    let paying = false, alive = true;
    const inp = $("tkN"), mBtn = $("tkM"), pBtn = $("tkP"), payB = $("tkPay");
    const el = { rate: $("tkRate"), off: $("tkOff"), eq: $("tkEq"), tot: $("tkTot"), sr: $("tkSr") };
    const rows = Array.prototype.slice.call(app.querySelectorAll(".tkp-row"));
    const en = (v) => String(v).replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const timers = [];
    let raf = 0, srT = 0, shown = {}, lockInp = false;

    /* هر بار فقط چیزی که واقعاً عوض شده نوشته می‌شود، آن هم حداکثر یک بار در هر فریم؛ ارتفاع هیچ بخشی عوض نمی‌شود */
    const put = (key, node, val, prop) => { if (shown[key] !== val) { shown[key] = val; node[prop || "textContent"] = val; } };
    const flag = (key, node, cls, on) => { if (shown[key] !== on) { shown[key] = on; node.classList.toggle(cls, on); } };
    const lim = (key, btn, on) => { if (shown[key] !== on) { shown[key] = on; btn.setAttribute("aria-disabled", on ? "true" : "false"); btn.classList.toggle("off", on); } };
    const paint = () => {
      raf = 0;
      const ok = n >= TK_MIN_BUY;
      const rate = tkRate(Math.max(n, 1)), off = tkOffPct(Math.max(n, 1));
      if (!lockInp) put("inp", inp, n ? faNum(n) : "", "value");
      put("rate", el.rate, fmtN(rate) + " تومان");
      put("off", el.off, off > 0 ? faNum(off) + "٪ تخفیف" : "");
      flag("offOn", el.off, "on", off > 0);
      put("eq", el.eq, ok ? quizTxt(n) : "—");
      put("tot", el.tot, fmtN(ok ? tkPrice(n) : 0));
      /* با اینکه دکمه‌ها در حد مجاز غیرفعال می‌شوند، فوکوس و لمس فعلی از دست نمی‌رود (aria-disabled) */
      lim("m", mBtn, n <= TK_MIN_BUY);
      lim("p", pBtn, n >= TK_MAX_BUY);
      if (!paying) {
        payB.disabled = !ok;
        put("pay", payB, ok ? ICONS.spark + " پرداخت " + fmtN(tkPrice(n)) + " تومان" : "تعداد پولک را وارد کنید", "innerHTML");
      }
      const ti = tkTier(Math.max(n, 1));
      rows.forEach((r, i) => flag("row" + i, r, "on", i === ti));
    };
    const sched = () => { if (!raf) raf = requestAnimationFrame(paint); };
    /* خواننده‌ی صفحه فقط بعد از توقف عدد، یک بار مبلغ را می‌شنود (نه با هر قدم) */
    const speak = () => {
      clearTimeout(srT);
      srT = setTimeout(() => { if (alive && n >= TK_MIN_BUY) el.sr.textContent = faNum(n) + " پولک، " + fmtN(tkPrice(n)) + " تومان"; }, 700);
    };
    const setN = (v, typing) => {
      v = Math.floor(+v);
      if (!isFinite(v) || v < 0) v = 0;
      if (v > TK_MAX_BUY) v = TK_MAX_BUY;
      if (!typing && v < TK_MIN_BUY) v = TK_MIN_BUY;
      n = v;
      sched();
      speak();
    };
    const stepBy = (dir, k) => {
      const t = dir > 0 ? (Math.floor(n / k) + 1) * k : (Math.ceil(n / k) - 1) * k;
      setN(Math.max(TK_MIN_BUY, t));
    };

    inp.addEventListener("input", () => {
      const t = en(inp.value).replace(/\D/g, "").slice(0, 6);
      const p = t ? parseInt(t, 10) : 0;
      lockInp = true;                       /* وسط تایپ، متن خود کاربر دست‌نخورده می‌ماند */
      setN(p, true);
      lockInp = false;
      if (p > TK_MAX_BUY) { shown.inp = null; sched(); }
    });
    inp.addEventListener("blur", () => { setN(n); shown.inp = null; sched(); });
    inp.addEventListener("focus", () => { try { inp.select(); } catch (e) { /* ignore */ } });

    /* نگه‌داشتن + و − پشت‌سرهم و هرچه طولانی‌تر، تندتر عوض می‌کند.
       دکمه فوکوس نمی‌گیرد و حرکت لمس را نمی‌گیرد: نه صفحه بالا و پایین می‌شود، نه کیبورد باز و بسته می‌شود */
    const hold = (btn, dir) => {
      let t0 = 0, t1 = 0, since = 0, lastDown = 0, pid = null;
      const stop = () => {
        clearTimeout(t0); clearTimeout(t1); t0 = t1 = 0;
        if (pid != null) { try { btn.releasePointerCapture(pid); } catch (e) { /* ignore */ } pid = null; }
      };
      const tick = () => {
        const dt = Date.now() - since;
        stepBy(dir, dt < 1200 ? 1 : dt < 2400 ? 5 : dt < 3800 ? 10 : 50);
        if ((dir < 0 && n <= TK_MIN_BUY) || (dir > 0 && n >= TK_MAX_BUY)) { stop(); return; }
        t1 = setTimeout(tick, dt < 1200 ? 85 : 70);
      };
      btn.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button > 0) return;
        if (btn.getAttribute("aria-disabled") === "true" || paying) return;
        e.preventDefault();                 /* فوکوس و انتخاب متن نگیرد */
        lastDown = Date.now(); since = lastDown; stop();
        try { btn.setPointerCapture(e.pointerId); pid = e.pointerId; } catch (er) { pid = null; }
        stepBy(dir, 1);
        if (!((dir < 0 && n <= TK_MIN_BUY) || (dir > 0 && n >= TK_MAX_BUY))) t0 = setTimeout(tick, 420);
      });
      ["pointerup", "pointercancel", "lostpointercapture", "blur"].forEach((ev) => btn.addEventListener(ev, stop));
      btn.addEventListener("contextmenu", (e) => e.preventDefault());
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      /* کلیک با صفحه‌کلید (Enter/Space): با ماوس و لمس در pointerdown انجام شده است */
      btn.addEventListener("click", (e) => { if (e.detail === 0 && Date.now() - lastDown > 600 && !paying && btn.getAttribute("aria-disabled") !== "true") stepBy(dir, 1); });
    };
    hold(mBtn, -1);
    hold(pBtn, 1);

    /* ---- پرداخت ---- */
    const showErr = (m) => { const e = $("tkErr"); if (!e) return; e.hidden = !m; e.textContent = m || ""; };
    const busy = (on) => {
      app.querySelector(".tkp-buy").classList.toggle("busy", on);
      inp.disabled = on;
    };
    const idle = () => {
      paying = false;
      busy(false);
      payB.removeAttribute("aria-busy");
      shown.pay = null;
      sched();
    };
    let goTimer = 0;
    $("tkPay").addEventListener("click", async () => {
      if (paying || n < TK_MIN_BUY) return;
      const count = n, total = tkPrice(n);
      paying = true;
      showErr("");
      busy(true);
      const pb = payB;
      pb.disabled = true;
      pb.setAttribute("aria-busy", "true");
      shown.pay = null;
      pb.innerHTML = '<span class="spin-s" aria-hidden="true"></span> در حال انتقال به درگاه…';
      const fail = (m) => { if (!alive) return; idle(); showErr(m); };
      let r = null;
      try { r = await payCall({ action: "start", tokens: count, expect: total }); } catch (e) { r = null; }
      if (!alive) return;
      if (!r) return fail("ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.");
      const d = r.d || {};
      if (r.ok && d.ok && /^https?:\/\//i.test(String(d.url || ""))) {
        payFlag.set(String(d.order || ""));
        goTimer = setTimeout(() => { if (alive) { idle(); showErr("انتقال به درگاه انجام نشد. دوباره دکمه‌ی پرداخت را بزنید."); } }, 20000);
        location.assign(d.url);
        return;
      }
      if (r.status === 503 && d.error === "not_configured") { idle(); payInfo(count, total); return; }
      if (r.status === 409 && d.error === "price_changed") return fail("قیمت‌ها به‌روز شده است. صفحه را دوباره باز کنید و خرید را تکرار کنید.");
      if (r.status === 401) return fail("نشست شما تمام شده است. دوباره وارد حساب شوید.");
      fail(d.error || "خطایی رخ داد. دوباره تلاش کنید.");
    });
    /* برگشت با دکمه‌ی «بازگشت» مرورگر از صفحه‌ی بانک: دکمه دوباره فعال شود */
    const onShow = (e) => { if (e.persisted && paying) { clearTimeout(goTimer); idle(); } };
    window.addEventListener("pageshow", onShow);

    /* ---- نتیجه‌ی پرداخت (بعد از برگشت از بانک) ---- */
    const res = $("tkRes");
    const SPIN = '<span class="spin-s" aria-hidden="true"></span>';
    const showRes = (kind, icon, title, body, extra) => {
      res.hidden = false;
      res.className = "card tkp-res " + kind;
      res.innerHTML = '<div class="tkp-res-i" aria-hidden="true">' + icon + '</div><div class="tkp-res-t"><b>' + title + "</b>" + (body ? "<p>" + body + "</p>" : "") + (extra || "") + "</div>";
    };
    const TEL = '<a class="pay-tel sm" href="tel:+982126378190">۰۲۱-۲۶۳۷۸۱۹۰</a>';
    const sleep = (ms) => new Promise((ok) => { const t = setTimeout(ok, ms); timers.push(t); });
    const resolveOrder = async (order, fromBank) => {
      if (fromBank) showRes("wait", SPIN, "در حال تأیید پرداخت…");
      for (let i = 0; i < 4 && alive; i++) {
        let r = null;
        try { r = await payCall({ action: "status", order: order }); } catch (e) { r = null; }
        if (!alive) return;
        if (!r || !r.ok) {
          if (r && r.status === 404) { payFlag.clear(); if (fromBank) showRes("bad", WARN, "سفارش پیدا نشد", "اگر پرداخت کرده‌اید، تماس بگیرید:", TEL); return; }
        } else {
          const d = r.d || {};
          if (d.status === "paid") {
            payFlag.clear();
            if (typeof d.balance === "number") tkSet(d.balance);
            showRes("ok", ICONS.tick, "پرداخت موفق بود", faNum(d.tokens) + " پولک به حساب شما اضافه شد." + (d.ref ? '<span class="tkp-ref">کد پیگیری: <bdi dir="ltr">' + esc(d.ref) + "</bdi></span>" : ""));
            return;
          }
          if (d.status === "failed") {
            payFlag.clear();
            if (fromBank) showRes("bad", WARN, "پرداخت انجام نشد", "اگر پولی کم شده، بانک تا ۷۲ ساعت آن را برمی‌گرداند.");
            return;
          }
          if (d.status === "review") { showRes("warn", WARN, "پرداخت در حال بررسی است", "برای اضافه شدن پولک تماس بگیرید:", TEL); return; }
        }
        if (!fromBank) return;
        await sleep(2500);
      }
      if (alive && fromBank) {
        showRes("wait", WARN, "پرداخت هنوز تأیید نشده است", "اگر پول کم شده، پولک‌ها تا چند دقیقه‌ی دیگر خودکار اضافه می‌شود.", '<button class="btn small ghost tkp-go" type="button" id="tkAgain">بررسی دوباره</button>');
        const again = $("tkAgain");
        if (again) again.addEventListener("click", () => resolveOrder(order, true));
      }
    };
    const qs = new URLSearchParams(location.search);
    const pm = qs.get("pay");
    if (pm !== null) {
      try { history.replaceState(null, "", location.pathname); } catch (e) { /* ignore */ }
      const o = String(qs.get("o") || "").toLowerCase();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(o)) resolveOrder(o, true);
      else showRes("bad", WARN, "پرداخت انجام نشد", "اگر پولی کم شده، بانک تا ۷۲ ساعت آن را برمی‌گرداند.");
    } else {
      /* کاربر بعد از پرداخت از راه دیگری برگشته (مثلاً صفحه‌ی بانک را بسته) */
      const f = payFlag.get();
      if (f) resolveOrder(f, false);
    }

    setN(n);
    cancelAnimationFrame(raf); paint();          /* اولین نمایش بدون تأخیر */
    return function cleanup() {
      alive = false;
      clearTimeout(goTimer);
      timers.forEach(clearTimeout);
      window.removeEventListener("pageshow", onShow);
      cancelAnimationFrame(raf);
      clearTimeout(srT);
    };
  }

  /* پنجره‌ی پرداخت: تا وصل شدن درگاه، فقط توضیح می‌دهد (جای وصل‌کردن درگاه همین‌جاست) */
  function payInfo(count, total) {
    const prev = document.activeElement;
    const ov = document.createElement("div");
    ov.className = "modal confirm";
    ov.innerHTML =
      '<div class="modal-box confirm-box pay-box" role="dialog" aria-modal="true" aria-labelledby="pyT" aria-describedby="pyD">' +
      '<div class="pay-ic">' + COIN + "</div>" +
      '<h2 id="pyT">پرداخت آنلاین به‌زودی فعال می‌شود</h2>' +
      '<p id="pyD">درگاه پرداخت هنوز راه‌اندازی نشده است. برای خرید <b>' + fmtN(count) + " پولک (" + fmtN(total) + ' تومان)</b> می‌توانید همین حالا با ما تماس بگیرید.</p>' +
      '<a class="pay-tel" href="tel:+982126378190">۰۲۱-۲۶۳۷۸۱۹۰</a>' +
      '<div class="actions"><button class="btn" type="button" id="pyOk">باشه</button></div></div>';
    document.body.appendChild(ov);
    const prevOv = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pz:nav", close);
      document.body.style.overflow = prevOv;
      ov.remove();
      if (prev && prev.isConnected) { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "Tab") {
        const f = Array.prototype.slice.call(ov.querySelectorAll("a[href],button"));
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("pz:nav", close);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    ov.querySelector("#pyOk").addEventListener("click", close);
    ov.querySelector("#pyOk").focus();
  }

  /* ---------- شرکت در آزمون ---------- */
  const fmtDur = (m) => {
    m = Number(m);
    if (m < 60) return faNum(m) + " دقیقه";
    const h = Math.floor(m / 60), r = m % 60;
    return faNum(h) + " ساعت" + (r ? " و " + faNum(r) + " دقیقه" : "");
  };
  const clockTxt = (sec) => {
    sec = Math.max(0, sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
    const p = (v) => (v < 10 ? "0" : "") + v;
    return faNum((h ? h + ":" + p(m) : p(m)) + ":" + p(x));
  };

  async function viewTake(id, token) {
    setTitle();
    app.innerHTML = '<p class="muted">در حال بارگذاری…</p>';
    let quiz;
    try { quiz = await rpc("get_quiz", { p_id: id, p_token: tokenOf() }); } catch (e) { if (token !== routeToken) return; return showError(e.message, () => viewTake(id, token)); }
    if (token !== routeToken) return;
    if (!quiz || !Array.isArray(quiz.questions)) return showError("این آزمون پیدا نشد.");
    setTitle(quiz.title);
    const dur = okDur(quiz.duration);
    /* آزمون زمان‌دار تا وقتی شروع نشده، سؤالی نمی‌فرستد؛ بعد از بارگذاری دوباره‌ی صفحه، همان آزمونِ در حال انجام ادامه پیدا می‌کند */
    if (dur && !(quiz.questions.length && quiz.remaining != null)) return takeIntro(quiz, id, token, dur);
    return takeRun(quiz, id, token, dur);
  }

  function takeIntro(quiz, id, token, dur) {
    const cnt = Number(quiz.count) || 0;
    app.innerHTML =
      "<h1>" + esc(quiz.title) + "</h1>" +
      (quiz.group_name ? groupChip(quiz.group_name) : "") +
      (quiz.description ? '<p class="muted">' + esc(quiz.description) + "</p>" : "") +
      '<div class="card tk-intro"><div class="stats two"><div class="stat"><b>' + faNum(cnt) + "</b><span>سؤال</span></div>" +
      '<div class="stat"><b>' + fmtDur(dur) + "</b><span>زمان آزمون</span></div></div>" +
      "<p>با زدن «شروع آزمون» زمان شروع می‌شود و متوقف نمی‌شود. با تمام‌شدن زمان، پاسخ‌های شما خودکار ثبت می‌شود.</p>" +
      '<div id="msg"></div><button class="btn" type="button" id="startBtn">' + ICONS.clock + " شروع آزمون</button></div>";
    const btn = document.getElementById("startBtn"), msg = document.getElementById("msg");
    btn.addEventListener("click", async () => {
      msg.innerHTML = "";
      btn.disabled = true;
      btn.classList.add("loading");
      try {
        const r = await rpc("quiz_start", { p_id: id, p_token: tokenOf() });
        if (token !== routeToken) return;
        if (!r || !Array.isArray(r.questions) || !r.questions.length || r.remaining == null) throw new Error("شروع آزمون ممکن نشد. دوباره تلاش کنید.");
        try { sessionStorage.removeItem("takeDraft:" + id); } catch (e) { /* بی‌اهمیت */ }
        takeRun(r, id, token, okDur(r.duration));
        window.scrollTo(0, 0);
      } catch (err) {
        if (token !== routeToken) return;
        btn.disabled = false;
        btn.classList.remove("loading");
        msg.innerHTML = '<div class="err" role="alert">' + esc(err.message) + "</div>";
      }
    });
  }

  function takeRun(quiz, id, token, dur) {
    const qs = quiz.questions.map((q) => ({ type: typeOf(q.type), text: String(q.text == null ? "" : q.text), options: Array.isArray(q.options) ? q.options.map(String) : [] }));
    const n = qs.length;
    const answers = new Array(n).fill(null);
    const lastName = store.get("lastName", "");

    const qHtml = (q, i) => {
      const head = '<legend class="badge">سؤال ' + faNum(i + 1) + " از " + faNum(n) + "</legend>";
      if (q.type === "tf") {
        return head + "<h2>" + esc(q.text) + '</h2><div class="tf" role="radiogroup">' +
          [0, 1].map((j) =>
            '<label class="tf-opt ' + (j === 0 ? "tf-true" : "tf-false") + '"><input type="radio" name="q' + i + '" value="' + j + '">' +
            '<span class="ic">' + (j === 0 ? ICONS.tick : ICONS.cross) + "</span><span>" + esc(q.options[j] || (j === 0 ? "درست" : "نادرست")) + "</span></label>").join("") + "</div>";
      }
      return head + "<h2>" + esc(q.text) + "</h2>" +
        q.options.map((o, j) => '<label class="opt"><input type="radio" name="q' + i + '" value="' + j + '"><span>' + esc(o) + "</span></label>").join("");
    };

    app.innerHTML =
      "<h1>" + esc(quiz.title) + "</h1>" +
      (quiz.group_name ? groupChip(quiz.group_name) : "") +
      (quiz.description ? '<p class="muted">' + esc(quiz.description) + "</p>" : "") +
      '<div class="ap"><div class="ap-top"><span id="apTxt" role="status" aria-live="polite"></span>' +
      (dur ? '<span class="ap-time" id="tm" role="timer" aria-label="زمان باقی‌مانده">' + ICONS.clock + '<span id="tmTxt"></span></span>' : "") + '</div><div class="ap-bar"><i id="apBar"></i></div>' +
      (dur ? '<div class="ap-bar ap-tbar" aria-hidden="true"><i id="tmBar"></i></div><span class="sr-only" id="tmSr" role="status" aria-live="polite"></span>' : "") + "</div>" +
      '<form id="f" novalidate>' +
      '<div class="card" id="nameCard"><div id="nameAcc" class="name-acc" hidden></div>' +
      '<div id="nameField"><label for="name">نام شما</label><input id="name" type="text" maxlength="100" autocomplete="name"></div></div>' +
      qs.map((q, i) => '<fieldset class="card qcard" data-i="' + i + '">' + qHtml(q, i) + "</fieldset>").join("") +
      '<div id="msg"></div><button class="btn" type="submit" id="submitBtn">ثبت پاسخ‌ها</button></form>';

    renderMath(app);
    const form = document.getElementById("f");
    const nameEl = document.getElementById("name");
    const msg = document.getElementById("msg");
    nameEl.value = lastName;
    const nameAcc = document.getElementById("nameAcc");
    const nameField = document.getElementById("nameField");
    /* اگر کاربر وارد حسابش شده باشد، نتیجه با نام حساب ثبت می‌شود و اسمی پرسیده نمی‌شود */
    const accName = () => { const a = auth.get(); const n = a ? cleanName(a.name) : ""; return validName(n) ? n : ""; };
    const syncNameCard = () => {
      const an = accName();
      nameAcc.hidden = !an;
      nameField.hidden = !!an;
      if (an) nameAcc.innerHTML = '<span class="mini-av">' + esc(initialOf(an)) + '</span><div><div class="hint">نتیجه با نام حساب شما ثبت می‌شود</div><strong>' + esc(an) + "</strong></div>";
    };
    syncNameCard();
    const onAuth = () => {
      if (token !== routeToken || !nameCard.isConnected) { window.removeEventListener("authchange", onAuth); return; }
      syncNameCard();
    };
    const nameCard = document.getElementById("nameCard");
    window.addEventListener("authchange", onAuth);

    const updateProgress = () => {
      const done = answers.filter((a) => a !== null).length;
      document.getElementById("apTxt").textContent = faNum(done) + " از " + faNum(n) + " سؤال پاسخ داده شده";
      document.getElementById("apBar").style.setProperty("--v", n ? done / n : 0);
    };
    /* پاسخ‌ها در همین زبانه نگه داشته می‌شوند تا اگر صفحه دوباره بارگذاری شد یا نشست منقضی شد و دوباره وارد شد، از دست نروند */
    const DKEY = "takeDraft:" + id;
    const saveDraft = () => { try { sessionStorage.setItem(DKEY, JSON.stringify({ n: n, a: answers })); } catch (e) { /* بی‌اهمیت */ } };
    const dropDraft = () => { try { sessionStorage.removeItem(DKEY); } catch (e) { /* بی‌اهمیت */ } };
    try {
      const d = JSON.parse(sessionStorage.getItem(DKEY) || "null");
      if (d && d.n === n && Array.isArray(d.a)) d.a.forEach((v, i) => {
        const r = Number.isInteger(v) ? form.querySelector('input[name="q' + i + '"][value="' + v + '"]') : null;
        if (r) { r.checked = true; answers[i] = v; }
      });
    } catch (e) { /* بی‌اهمیت */ }
    updateProgress();

    form.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.type === "radio") {
        const m = /^q(\d+)$/.exec(t.name);
        if (m) {
          answers[Number(m[1])] = Number(t.value);
          const c = form.querySelector('.qcard[data-i="' + m[1] + '"]');
          if (c) c.classList.remove("unanswered");
          updateProgress();
          saveDraft();
        }
      }
    });

    let skipOk = false, sending = false, over = false, tmId = 0;
    const stopTimer = () => { clearInterval(tmId); };
    const fail = (t) => { msg.innerHTML = '<div class="err" role="alert">' + esc(t) + "</div>"; };
    const send = async (auto) => {
      if (sending) return;
      msg.innerHTML = "";
      syncNameCard();
      let name = accName() || nameEl.value.trim();
      if (!name) {
        if (!over) {
          fail("نام خود را وارد کنید.");
          nameEl.classList.add("bad");
          nameEl.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
          nameEl.focus({ preventScroll: true });
          return;
        }
        name = "بدون نام";
      }
      nameEl.classList.remove("bad");
      const left = [];
      answers.forEach((a, i) => { if (a === null) left.push(i); });
      form.querySelectorAll(".unanswered").forEach((c) => c.classList.remove("unanswered"));
      if (left.length && !skipOk && !over) {
        skipOk = true;
        left.forEach((i) => { const c = form.querySelector('.qcard[data-i="' + i + '"]'); if (c) c.classList.add("unanswered"); });
        msg.innerHTML = '<div class="warn" role="alert">به ' + faNum(left.length) + " سؤال پاسخ نداده‌اید. اگر می‌خواهید همین‌طور ثبت شود دوباره روی «ثبت پاسخ‌ها» بزنید.</div>";
        const first = form.querySelector('.qcard[data-i="' + left[0] + '"]');
        if (first) first.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
        return;
      }
      const btn = document.getElementById("submitBtn");
      sending = true;
      btn.disabled = true;
      btn.classList.add("loading");
      try {
        const r = await rpc("submit_quiz", { p_id: id, p_name: name, p_answers: answers, p_token: tokenOf() });
        stopTimer();
        dropDraft();
        if (token !== routeToken) return;
        if (!accName() && name !== "بدون نام") store.set("lastName", name);
        showResult(quiz, qs, answers, r, token, over ? "زمان آزمون تمام شد و پاسخ‌های شما خودکار ثبت شد." : "");
      } catch (err) {
        sending = false;
        if (token !== routeToken) return;
        btn.disabled = false;
        btn.classList.remove("loading");
        if (dur && /زمان آزمون تمام|اول «شروع/.test(err.message)) {
          stopTimer();
          dropDraft();
          btn.hidden = true;
          msg.innerHTML = '<div class="err" role="alert">' + esc(err.message) + '</div><button class="btn" type="button" id="restart">شروع دوباره</button>';
          document.getElementById("restart").addEventListener("click", () => { viewTake(id, token); window.scrollTo(0, 0); });
        } else fail(err.message);
      }
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); send(false); });

    /* تایمر آزمون زمان‌دار: پایان زمان از ساعت سرور (ثانیه‌ی باقی‌مانده‌ی دریافتی) حساب می‌شود، نه از ساعت دستگاه */
    if (dur) {
      const total = dur * 60;
      const endAt = Date.now() + Math.max(0, Number(quiz.remaining) || 0) * 1000;
      const ap = app.querySelector(".ap"), tmTxt = document.getElementById("tmTxt"), tmBar = document.getElementById("tmBar"), tmSr = document.getElementById("tmSr");
      let lvl = "";
      const tick = () => {
        if (token !== routeToken || !ap.isConnected) { stopTimer(); document.removeEventListener("visibilitychange", onVis); return; }
        const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        tmTxt.textContent = clockTxt(left);
        tmBar.style.setProperty("--v", Math.min(1, left / total));
        const nl = left <= Math.max(10, Math.min(60, total * 0.12)) ? "danger" : left <= Math.min(300, total * 0.35) ? "warn" : "";
        if (nl !== lvl) {
          lvl = nl;
          if (nl) ap.setAttribute("data-t", nl); else ap.removeAttribute("data-t");
          if (nl) tmSr.textContent = nl === "danger" ? "زمان آزمون رو به پایان است." : "از زمان آزمون کمی باقی مانده است.";
        }
        if (left <= 0 && !over) {
          over = true;
          stopTimer();
          form.querySelectorAll("input[type=radio]").forEach((r) => { r.disabled = true; });
          msg.innerHTML = '<div class="warn" role="alert">زمان آزمون تمام شد؛ در حال ثبت پاسخ‌های شما…</div>';
          send(true);
        }
      };
      const onVis = () => { if (!document.hidden) tick(); };
      document.addEventListener("visibilitychange", onVis);
      tmId = setInterval(tick, 1000);
      tick();
    }
  }

  function showResult(quiz, qs, answers, r, token, note) {
    const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;

    const review = (q, i) => {
      const right = r.correct[i];
      const mine = answers[i];
      const state = mine == null ? '<span class="badge skipb">بدون پاسخ</span>' : mine === right ? '<span class="badge okb">درست</span>' : '<span class="badge badb">نادرست</span>';
      const opts = q.options.map((o, j) => {
        const cls = j === right ? "right" : j === mine ? "wrong" : "";
        const tag = j === right ? " ✓ پاسخ درست" : j === mine ? " ✗ پاسخ شما" : "";
        return '<div class="opt ' + cls + '"><span>' + esc(o) + "</span><strong>" + tag + "</strong></div>";
      }).join("");
      return '<div class="card"><div class="rv-top">' + state + "</div><h2>" + faNum(i + 1) + ". " + esc(q.text) + "</h2>" + opts + "</div>";
    };

    app.innerHTML =
      (note ? '<div class="warn" role="status">' + esc(note) + "</div>" : "") +
      '<div class="card"><p class="muted center">نمره‌ی شما</p><div class="score">' + faNum(r.score) + " از " + faNum(r.total) + '</div><p class="muted center">' + faNum(pct) + "٪</p></div>" +
      "<h2>مرور پاسخ‌ها</h2>" + qs.map(review).join("") +
      '<div class="actions"><button class="btn" type="button" id="again">شرکت دوباره</button><a class="btn ghost" href="/create">ساخت آزمون خودم</a></div>';
    renderMath(app);
    document.getElementById("again").addEventListener("click", () => { viewTake(quiz.id, token); window.scrollTo(0, 0); });
    window.scrollTo(0, 0);
  }

  /* ---------- مدیریت و نتایج ---------- */
  async function viewManage(id, secret, isNew, token, flags) {
    flags = flags || {};
    setTitle();
    app.innerHTML = '<p class="muted">در حال بارگذاری…</p>';
    let d;
    try { d = await rpc("get_results", { p_id: id, p_secret: secret }); } catch (e) { if (token !== routeToken) return; return showError(e.message, () => viewManage(id, secret, isNew, token, flags)); }
    if (token !== routeToken) return;
    setTitle("نتایج: " + d.title);

    const take = baseUrl() + "/q/" + id;
    const subs = Array.isArray(d.submissions) ? d.submissions : [];
    const qs = Array.isArray(d.questions) ? d.questions : [];
    const ratio = (s) => (s.total ? s.score / s.total : 0);
    const avg = subs.length ? subs.reduce((a, s) => a + ratio(s), 0) / subs.length : 0;
    const best = subs.length ? Math.max.apply(null, subs.map(ratio)) : 0;
    const when = (v) => { const t = new Date(v); return isNaN(t) ? "" : t.toLocaleDateString("fa-IR") + " — " + t.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }); };

    const qstat = qs.map((q, i) => {
      const ok = subs.filter((s) => Array.isArray(s.answers) && s.answers[i] === q.correct).length;
      const p = subs.length ? Math.round((ok / subs.length) * 100) : 0;
      const txt = String(q.text || "");
      return '<div class="qstat"><div class="qs-top"><span class="qs-n">' + faNum(i + 1) + '</span><span class="qs-t">' + esc(plainQ(txt).length > 90 ? plainQ(txt).slice(0, 90) + "…" : plainQ(txt)) +
        '</span><span class="badge">' + esc(QTYPES[typeOf(q.type)].short) + '</span><span class="qs-p">' + faNum(p) + '٪</span></div><div class="bar" role="img" aria-label="' + faNum(p) + ' درصد درست"><i style="--w:' + (p / 100) + '"></i></div></div>';
    }).join("");

    /* آزمونِ تازه‌ساخته با هوش مصنوعی: مصرف پولک را یک‌بار و آرام نشان می‌دهد */
    const tkNote = isNew && tkLast ? '<div class="tk-used">' + COIN + "<span>" + faNum(tkLast.used) + " پولک مصرف شد" + (tkLast.bal != null ? " · " + faNum(tkLast.bal) + " پولک باقی مانده" : "") + "</span></div>" : "";
    tkLast = null;
    app.innerHTML =
      "<h1>" + esc(d.title) + "</h1>" +
      (d.group_name ? groupChip(d.group_name) + '<p class="hint" style="margin-top:-6px">این آزمون فقط برای اعضای گروه باز می‌شود.</p>' : "") +
      (okDur(d.duration) ? '<p class="dur-badge"><span class="badge">زمان آزمون: ' + fmtDur(d.duration) + "</span></p>" : "") +
      (isNew ? '<div class="card created"><strong>آزمون ساخته شد 🎉</strong><div class="hint">اگر سؤالی یا پاسخ درستی اشتباه است، با دکمه‌ی «ویرایش آزمون» در همین صفحه اصلاحش کنید.</div>' + tkNote + "</div>" : "") +
      (flags.updated ? '<div class="card created"><strong>تغییرات ذخیره شد ✅</strong>' + (flags.cleared ? '<div class="hint">' + faNum(flags.cleared) + " نتیجه‌ی قبلی پاک شد.</div>" : "") + "</div>" : "") +
      '<div class="card"><h2>لینک آزمون</h2>' +
      '<div class="linkbox"><input id="l1" type="text" readonly value="' + esc(take) + '" aria-label="لینک آزمون"><button class="btn small" type="button" data-copy="#l1">کپی</button></div>' +
      '<div class="actions"><a class="btn ghost small" href="/q/' + encodeURIComponent(id) + '">پیش‌نمایش آزمون</a>' +
      '<a class="btn small" href="/edit/' + encodeURIComponent(id) + '">ویرایش آزمون</a>' +
      (navigator.share ? '<button class="btn small" type="button" id="shareBtn">اشتراک‌گذاری</button>' : "") + "</div></div>" +
      '<div class="stats"><div class="stat"><b>' + faNum(subs.length) + "</b><span>شرکت‌کننده</span></div>" +
      '<div class="stat"><b>' + faNum(Math.round(avg * 100)) + "٪</b><span>میانگین</span></div>" +
      '<div class="stat"><b>' + faNum(Math.round(best * 100)) + "٪</b><span>بهترین نمره</span></div></div>" +
      '<div class="card"><h2>نتایج</h2>' +
      (subs.length
        ? '<div style="overflow-x:auto"><table class="rtbl"><thead><tr><th>نام</th><th>نمره</th><th>زمان</th><th></th></tr></thead><tbody>' +
          subs.map((s, i) => '<tr class="srow"><td class="c-name">' + esc(s.name) + '</td><td class="c-score" data-l="نمره">' + faNum(s.score) + " از " + faNum(s.total) + '</td><td class="c-time" data-l="زمان">' + esc(when(s.created_at)) + '</td><td class="det-cell"><button class="btn ghost small" type="button" data-det="' + i + '" aria-haspopup="dialog">مشاهده جزئیات</button></td></tr>').join("") +
          '</tbody></table></div><div class="actions"><button class="btn ghost small" type="button" id="xlsx">دانلود اکسل</button><button class="btn ghost small" type="button" id="refresh">به‌روزرسانی</button></div>'
        : '<p class="muted">هنوز کسی شرکت نکرده است. لینک آزمون را برای دیگران بفرستید.</p><button class="btn ghost small" type="button" id="refresh">به‌روزرسانی</button>') +
      "</div>" +
      (subs.length && qs.length ? '<div class="card"><h2>آمار هر سؤال <span class="hint">(درصد پاسخ درست)</span></h2>' + qstat + "</div>" : "") +
      '<div class="actions"><a class="btn ghost" href="' + (d.group_id && GROUP_ID_RE.test(d.group_id) ? "/g/" + d.group_id : "/") + '">' + ICONS.back + (d.group_id ? " بازگشت به گروه" : " بازگشت به صفحه‌ی اصلی") + "</a></div>";

    /* جزئیات پاسخ هر شرکت‌کننده (فقط در سایت؛ در فایل اکسل نیست) */
    const detailHtml = (s) => {
      const ans = Array.isArray(s.answers) ? s.answers : [];
      return qs.map((q, i) => {
        const mine = ans[i];
        const opts = Array.isArray(q.options) ? q.options : [];
        const has = Number.isInteger(mine) && mine >= 0 && mine < opts.length;
        const right = has && mine === q.correct;
        const state = !has ? ["r-skip", "بدون پاسخ"] : right ? ["r-ok", "درست"] : ["r-bad", "غلط"];
        const row = (label, text, cls) => '<div class="dl ' + cls + '"><span class="dl-k">' + label + '</span><span class="dl-v">' + esc(text) + "</span></div>";
        let body = row("پاسخ شرکت‌کننده", has ? opts[mine] : "پاسخی نداده", has ? (right ? "r-ok" : "r-bad") : "r-skip");
        if (!right && opts[q.correct] != null) body += row("پاسخ درست", opts[q.correct], "r-ok");
        return '<div class="dq ' + state[0] + '"><div class="dq-top"><span class="dq-n">' + faNum(i + 1) + '</span><span class="dq-t">' + esc(q.text) + '</span><span class="dq-s ' + state[0] + '">' + state[1] + "</span></div>" + body + "</div>";
      }).join("");
    };
    let closeModal = null;
    const openDetails = (s, opener) => {
      if (closeModal) closeModal();
      const ov = document.createElement("div");
      ov.className = "modal";
      ov.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="mdT"><div class="modal-head"><h2 id="mdT">جزئیات پاسخ‌ها<span class="sub">' + esc(s.name) + " — " + faNum(s.score) + " از " + faNum(s.total) + '</span></h2><button class="btn ghost small" type="button" id="mdX">بستن</button></div><div class="modal-body">' + (qs.length ? detailHtml(s) : '<p class="muted">جزئیاتی موجود نیست.</p>') + "</div></div>";
      document.body.appendChild(ov);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e) => { if (e.key === "Escape") closeModal(); };
      closeModal = () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prevOverflow;
        ov.remove();
        closeModal = null;
        if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      };
      document.addEventListener("keydown", onKey);
      ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(); });
      ov.querySelector("#mdX").addEventListener("click", () => closeModal());
      ov.querySelector("#mdX").focus({ preventScroll: true });
      renderMath(ov);
      const prevCleanup = cleanup;
      cleanup = () => { if (closeModal) closeModal(); if (prevCleanup) prevCleanup(); };
    };
    app.querySelectorAll("[data-det]").forEach((btn) => {
      btn.addEventListener("click", () => openDetails(subs[Number(btn.getAttribute("data-det"))], btn));
    });

    copyHandlers(app);
    renderMath(app);
    document.getElementById("refresh").addEventListener("click", () => viewManage(id, secret, false, token));
    const share = document.getElementById("shareBtn");
    if (share) share.addEventListener("click", () => { navigator.share({ title: d.title, url: take }).catch(() => {}); });
    const xlsxBtn = document.getElementById("xlsx");
    if (xlsxBtn) xlsxBtn.addEventListener("click", () => {
      const rows = [["نام", "نمره", "از", "زمان"]].concat(subs.map((s) => [s.name, s.score, s.total, s.created_at]));
      const bytes = makeXlsx(rows);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "results-" + id + ".xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  /* ساخت فایل اکسل (xlsx) بدون کتابخانه: یک zip ساده (بدون فشرده‌سازی) از چند فایل XML. ردیف اول پررنگ، شیت راست‌به‌چپ */
  function makeXlsx(rows) {
    const enc = new TextEncoder();
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    const col = (i) => String.fromCharCode(65 + i);
    const sheetRows = rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
      const ref = col(ci) + (ri + 1);
      if (ri > 0 && typeof v === "number" && isFinite(v)) return '<c r="' + ref + '"><v>' + v + "</v></c>";
      return '<c r="' + ref + '" t="inlineStr"' + (ri === 0 ? ' s="1"' : "") + "><is><t>" + esc(v == null ? "" : v) + "</t></is></c>";
    }).join("") + "</row>").join("");
    const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const files = [
      ["[Content_Types].xml", X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ["_rels/.rels", X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", X + "<workbook " + NS + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Results" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ["xl/_rels/workbook.xml.rels", X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml", X + "<styleSheet " + NS + '><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
      ["xl/worksheets/sheet1.xml", X + "<worksheet " + NS + '><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="3" width="9" customWidth="1"/><col min="4" max="4" width="26" customWidth="1"/></cols><sheetData>' + sheetRows + "</sheetData></worksheet>"],
    ];
    const T = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
    const crc = (u) => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = T[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const parts = [], central = [];
    let off = 0;
    const u16 = (n) => [n & 255, (n >>> 8) & 255], u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    files.forEach(([name, text]) => {
      const nm = enc.encode(name), data = enc.encode(text), c = crc(data);
      const head = [0x50, 0x4B, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nm.length), ...u16(0)];
      parts.push(new Uint8Array(head), nm, data);
      central.push(new Uint8Array([0x50, 0x4B, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += head.length + nm.length + data.length;
    });
    const cdSize = central.reduce((a, x) => a + x.length, 0);
    const end = new Uint8Array([0x50, 0x4B, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
    return concatBytes(parts.concat(central, [end]));
  }
  function concatBytes(list) {
    const total = list.reduce((a, x) => a + x.length, 0), out = new Uint8Array(total);
    let o = 0; list.forEach((x) => { out.set(x, o); o += x.length; });
    return out;
  }

  /* ---------- ثبت‌نام و ورود با شماره‌ی موبایل ---------- */
  const AUTH_FN = "auth-otp";
  const auth = {
    get() {
      const v = store.get("session", null);
      return v && typeof v.token === "string" && (typeof v.phone === "string" || typeof v.email === "string") ? v : null;
    },
    set(v) { store.set("session", v); syncAuthBtn(); window.dispatchEvent(new Event("authchange")); },
    clear() { store.del("session"); syncAuthBtn(); window.dispatchEvent(new Event("authchange")); },
  };

  const cleanName = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const validName = (n) => n.length >= 2 && n.length <= 60;
  const initialOf = (n) => { const c = Array.from(cleanName(n))[0]; return c ? c.toUpperCase() : ""; };
  const USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.9-3.6 3.8-5.4 7.2-5.4s6.3 1.8 7.2 5.4"/></svg>';

  /* رنگ‌های آواتار پروفایل */
  const AV_GRADS = { g1: ["#2A9D6F", "#0F5132"], g2: ["#4C8DF6", "#1E4DB7"], g3: ["#9B6BF2", "#5A2DB0"], g4: ["#F06BA8", "#B02A6A"], g5: ["#F59E4B", "#C4620F"], g6: ["#EF6A5E", "#B42318"], g7: ["#2CC5C0", "#0B7C80"], g8: ["#7A8CA0", "#3C4A5C"] };
  const avBg = (k) => { const g = AV_GRADS[k] || AV_GRADS.g1; return "background:linear-gradient(135deg," + g[0] + "," + g[1] + ")"; };
  const avStyle = (k) => (k && AV_GRADS[k] && k !== "g1" ? ' style="' + avBg(k) + '"' : "");
  const PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l3 3"/></svg>';

  async function doLogout(btn) {
    if (btn) { btn.disabled = true; btn.classList.add("loading"); }
    const cur = auth.get();
    /* گفت‌وگوهای معلم که هنوز به سرور نرسیده‌اند، پیش از خروج (حداکثر ۲ ثانیه) فرستاده می‌شوند */
    if (cur && TCS.pending()) { try { await Promise.race([TCS.flush(), new Promise((r) => setTimeout(r, 2000))]); } catch (e) { /* ignore */ } }
    /* خروج فوری: نشست روی دستگاه همین حالا پاک می‌شود و ابطال سمت سرور در پس‌زمینه انجام می‌شود */
    if (cur) { try { authCall({ action: "logout", token: cur.token }).catch(() => {}); } catch (e) { /* بی‌اهمیت */ } }
    auth.clear();
    TCS.wipe();   /* گفت‌وگوهای این کاربر از روی این دستگاه پاک می‌شود (روی حساب می‌ماند) */
    go("/");
  }

  /* دکمه‌ی «ثبت‌نام» بعد از ورود به یک آواتار دایره‌ای (با اسم و شماره) تبدیل می‌شود */
  function closeProfile() {
    const pop = document.getElementById("profPop"), btn = document.getElementById("profBtn");
    if (pop) pop.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function openProfile() {
    const pop = document.getElementById("profPop"), btn = document.getElementById("profBtn");
    if (!pop || !btn) return;
    pop.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth;
    pop.style.top = Math.round(r.bottom + 10) + "px";
    pop.style.left = Math.round(Math.max(12, Math.min(r.left, vw - w - 12))) + "px";
  }
  function syncAuthBtn() {
    const b = document.getElementById("authBtn");
    const wrap = document.getElementById("profWrap");
    if (!b) return;
    const s = auth.get();
    b.style.display = s ? "none" : "";
    if (!wrap) return;
    wrap.hidden = !s;
    if (!s) { wrap.innerHTML = ""; return; }
    const nm = cleanName(s.name);
    const av = nm ? "<span>" + esc(initialOf(nm)) + "</span>" : USER_ICON;
    const avSt = avStyle(s.avatar);
    wrap.innerHTML =
      '<button class="prof-btn" id="profBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="profPop" aria-label="پروفایل' + (nm ? "؛ " + esc(nm) : "") + '"' + avSt + ">" + av + "</button>" +
      '<div class="prof-pop" id="profPop" role="dialog" aria-label="اطلاعات حساب" hidden>' +
      '<button class="prof-av" id="profAv" type="button" aria-label="تغییر پروفایل"' + avSt + ">" + av + '<span class="prof-av-edit">' + PENCIL + "</span></button>" +
      '<div class="prof-namerow"><div class="prof-name">' + (nm ? esc(nm) : "کاربر پازمونک") + '</div><button class="prof-edit" id="profEdit" type="button" aria-label="تغییر پروفایل" title="تغییر پروفایل">' + PENCIL + "</button></div>" +
      '<div class="prof-phone" dir="ltr"' + (s.email && !s.phone ? " data-em" : "") + ">" + esc(showPhone(s.phone || s.email)) + "</div>" +
      (s.phone && s.email ? '<div class="prof-phone prof-2" dir="ltr" data-em>' + esc(showPhone(s.email)) + "</div>"
        : '<button class="prof-add" id="profAdd" type="button">+ ' + (s.phone ? "افزودن ایمیل" : "افزودن شماره‌ی موبایل") + "</button>") +
      '<a class="prof-tk" id="profTk" href="/tokens">' + COIN + '<span>پولک‌های من</span><b data-tk>' + tkTxt() + "</b></a>" +
      '<a class="prof-tk prof-wl" id="profWl" href="/wallet"><span>بخش مالی</span></a>' +
      '<button class="btn ghost small wide" id="profOut" type="button">خروج از حساب</button></div>';
    document.getElementById("profBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      const pop = document.getElementById("profPop");
      if (pop.hidden) openProfile(); else closeProfile();
    });
    document.getElementById("profPop").addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("profOut").addEventListener("click", (e) => { closeProfile(); doLogout(e.currentTarget); });
    document.getElementById("profTk").addEventListener("click", () => closeProfile());
    document.getElementById("profWl").addEventListener("click", () => closeProfile());
    const pa = document.getElementById("profAdd");
    if (pa) pa.addEventListener("click", () => { closeProfile(); openLinkModal(s.phone ? "email" : "phone"); });
    const edit = () => { closeProfile(); openProfileEdit(); };
    document.getElementById("profEdit").addEventListener("click", edit);
    document.getElementById("profAv").addEventListener("click", edit);
  }


  /* افزودن شماره‌ی موبایل (به حساب ایمیلی) یا ایمیل (به حساب موبایلی) با کد تأیید */
  function openLinkModal(kind) {
    const cur = auth.get();
    if (!cur) return;
    const isPhone = kind === "phone";
    const prev = document.activeElement;
    const ov = document.createElement("div");
    ov.className = "modal pf-modal";
    ov.innerHTML =
      '<div class="modal-box pf-box" role="dialog" aria-modal="true" aria-labelledby="lkT">' +
      '<div class="modal-head"><h2 id="lkT">' + (isPhone ? "افزودن شماره‌ی موبایل" : "افزودن ایمیل") + "</h2></div>" +
      '<form class="modal-body" id="lkForm" novalidate>' +
      '<p class="hint" style="margin:0">' + (isPhone ? "کد تأیید با پیامک برایتان فرستاده می‌شود." : "کد تأیید به ایمیل شما فرستاده می‌شود.") + "</p>" +
      '<div id="lkS1"><label for="lkV">' + (isPhone ? "شماره‌ی موبایل" : "ایمیل") + '</label>' +
      '<input id="lkV" class="auth-input" type="' + (isPhone ? "tel" : "email") + '" inputmode="' + (isPhone ? "tel" : "email") + '" dir="ltr" maxlength="' + (isPhone ? "14" : "254") + '" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (isPhone ? "09123456789" : "name@example.com") + '"' + (isPhone ? "" : ' style="letter-spacing:0;font-size:1.05rem!important"') + "></div>" +
      '<div id="lkS2" hidden><label for="lkC">کد ۵ رقمی</label><input id="lkC" class="auth-input" type="text" inputmode="numeric" dir="ltr" maxlength="5" autocomplete="one-time-code" placeholder="_ _ _ _ _"></div>' +
      '<div class="auth-msg" id="lkMsg" role="alert"></div>' +
      '<div class="actions"><button class="btn ghost" type="button" id="lkNo">انصراف</button><button class="btn" type="submit" id="lkYes">ارسال کد</button></div>' +
      '<button class="btn ghost small wide" type="button" id="lkAgain" hidden>ارسال دوباره‌ی کد</button></form></div>';
    document.body.appendChild(ov);
    const prevOv = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const $ = (id) => ov.querySelector("#" + id);
    const vEl = $("lkV"), cEl = $("lkC"), msg = $("lkMsg"), yes = $("lkYes"), again = $("lkAgain");
    let step = 1, value = "", done = false, tmr = 0;
    const say = (t, bad) => { msg.className = "auth-msg" + (bad ? " m-err" : " info"); msg.textContent = t || ""; };
    const close = () => {
      if (done) return;
      done = true;
      clearInterval(tmr);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pz:nav", close);
      document.body.style.overflow = prevOv;
      ov.remove();
      if (prev && prev.isConnected) { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("pz:nav", close);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    $("lkNo").addEventListener("click", close);
    const wait = (n) => {
      clearInterval(tmr);
      again.hidden = false; again.disabled = true;
      let left = Math.max(1, n | 0);
      const tick = () => { again.textContent = left > 0 ? "ارسال دوباره‌ی کد (" + faNum(left) + ")" : "ارسال دوباره‌ی کد"; again.disabled = left > 0; if (left-- <= 0) clearInterval(tmr); };
      tick(); tmr = setInterval(tick, 1000);
    };
    const send = async (btn) => {
      btn.disabled = true; btn.classList.add("loading"); say("");
      const r = await authCall({ action: "link_send", token: cur.token, kind: kind, value: value });
      if (done) return false;
      btn.classList.remove("loading");
      if (r && r.ok) {
        step = 2; $("lkS1").hidden = true; $("lkS2").hidden = false;
        yes.textContent = "تأیید"; yes.disabled = false;
        say("کد به " + showPhone(value) + " فرستاده شد.");
        wait(r.resend_in || 60);
        cEl.value = ""; cEl.focus();
        return true;
      }
      btn.disabled = false;
      if (r && r.error === "no_session") { auth.clear(); close(); return false; }
      say(((r && r.message) || "ارسال ناموفق بود. دوباره تلاش کنید.") + (r && r.retry_in ? " (" + faNum(r.retry_in) + " ثانیه)" : ""), true);
      return false;
    };
    again.addEventListener("click", () => { if (!again.disabled) send(again).then(() => { if (!done) again.classList.remove("loading"); }); });
    vEl.addEventListener("input", () => { vEl.classList.remove("bad"); say(""); });
    cEl.addEventListener("input", () => { cEl.value = toLatinDigits(cEl.value).replace(/\D/g, "").slice(0, 5); cEl.classList.remove("bad"); say(""); });
    $("lkForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (yes.disabled) return;
      if (step === 1) {
        const id = cleanIdent(vEl.value);
        if (!id.ok || (id.v.indexOf("@") >= 0) === isPhone) { vEl.classList.add("bad"); say(isPhone ? "شماره‌ی موبایل معتبر نیست. مثل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید." : "ایمیل معتبر نیست. مثل name@example.com وارد کنید.", true); vEl.focus(); return; }
        value = id.v;
        await send(yes);
        return;
      }
      const code = cEl.value;
      if (!/^\d{5}$/.test(code)) { cEl.classList.add("bad"); say("کد ۵ رقمی را وارد کنید.", true); cEl.focus(); return; }
      yes.disabled = true; yes.classList.add("loading"); say("");
      const r = await authCall({ action: "link_verify", token: cur.token, kind: kind, value: value, code: code });
      if (done) return;
      yes.classList.remove("loading");
      if (r && r.ok) {
        const s2 = auth.get();
        if (s2) auth.set(Object.assign({}, s2, isPhone ? { phone: value } : { email: value }));
        close();
        if (window.__pzToast) window.__pzToast(isPhone ? "شماره‌ی موبایل اضافه شد ✓" : "ایمیل اضافه شد ✓");
        return;
      }
      yes.disabled = false;
      if (r && r.error === "no_session") { auth.clear(); close(); return; }
      if (r && (r.error === "locked" || r.error === "expired")) { say(r.message || "کد معتبر نیست. یک کد جدید بگیرید.", true); return; }
      cEl.classList.add("bad");
      say((r && r.message) || "تأیید ناموفق بود. دوباره تلاش کنید.", true);
      cEl.focus(); cEl.select();
    });
    setTimeout(() => { if (!done) { try { vEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 60);
  }


  /* ---------- منوی همبرگری (گوشی): از سمت چپ باز می‌شود ---------- */
  const MENU_IC = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5a1 1 0 0 0 1 1H10v-5.5h4v5.5h3.5a1 1 0 0 0 1-1V10"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.2 19.5c.5-3.1 2.8-5 5.8-5s5.3 1.9 5.8 5"/><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M17.6 14.8c1.9.5 3.2 2.2 3.5 4.7"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><path d="M4 7.5V17a2 2 0 0 0 2 2h12.5a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 8H6.5A2.5 2.5 0 0 1 4 7.5z"/><circle cx="16" cy="13.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.4 3 8 7.5 9.5 4.5-1.5 7.5-5.1 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.7-3.6 3.6-5.6 7.5-5.6s6.8 2 7.5 5.6"/></svg>',
    theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H10"/><path d="M15 8l4 4-4 4M19 12H9.5"/></svg>',
  };
  let menuClose = null;
  function openMenu() {
    if (menuClose) return;
    const s = auth.get();
    const prev = document.activeElement;
    const here = location.pathname;
    const visible = (id) => { const e = document.getElementById(id); return !!e && !e.hidden; };
    const nm = cleanName(s && s.name);
    const item = (href, ic, label, extra) => '<a class="dr-item" href="' + href + '"' + (here === href ? ' aria-current="page"' : "") + ">" + ic + "<span>" + label + "</span>" + (extra || "") + "</a>";
    const btn = (id, ic, label, cls) => '<button class="dr-item' + (cls ? " " + cls : "") + '" type="button" id="' + id + '">' + ic + "<span>" + label + "</span></button>";
    const gb = document.getElementById("grpBadge");
    const gcount = gb && !gb.hidden ? (gb.textContent || "").trim() : "";
    let html = '<div class="dr-head">';
    if (s) {
      html += '<span class="dr-av"' + avStyle(s.avatar) + ">" + (nm ? esc(initialOf(nm)) : USER_ICON) + "</span>" +
        '<div class="dr-who"><strong>' + (nm ? esc(nm) : "کاربر پازمونک") + "</strong><small dir=\"ltr\">" + esc(showPhone(s.phone || s.email)) + "</small></div>";
    } else {
      html += '<div class="dr-who"><strong>پازمونک</strong><small>آزمون‌ساز آنلاین</small></div>';
    }
    html += '<button class="dr-x" type="button" id="drX" aria-label="بستن منو">' + CROSS + "</button></div><nav class=\"dr-nav\" aria-label=\"منوی اصلی\">";
    html += item("/", MENU_IC.home, "خانه") + item("/create", MENU_IC.plus, "ساخت آزمون") + (TUTOR_ON ? item("/tutor", TT_CAP, "معلم هوشمند") : "");
    if (s) {
      if (visible("grpBtn")) html += item("/groups", MENU_IC.users, "گروه‌ها", gcount ? '<b class="dr-badge">' + esc(gcount) + "</b>" : "");
      html += item("/tokens", COIN, "پولک‌های من", '<b class="dr-bal">' + tkTxt() + "</b>") + item("/wallet", MENU_IC.wallet, "بخش مالی");
      if (visible("admBtn")) html += item("/admin", MENU_IC.shield, "پنل مدیریت");
    }
    html += '</nav><div class="dr-foot">';
    if (s) {
      html += btn("drEdit", MENU_IC.user, "ویرایش پروفایل");
      if (!(s.phone && s.email)) html += btn("drAdd", MENU_IC.plus, s.phone ? "افزودن ایمیل" : "افزودن شماره‌ی موبایل");
    } else {
      html += '<a class="btn wide" href="/signup">ثبت‌نام / ورود</a>';
    }
    html += btn("drTheme", MENU_IC.theme, "حالت روشن / تیره");
    if (s) html += btn("drOut", MENU_IC.out, "خروج از حساب", "dr-danger");
    html += "</div>";

    const ov = document.createElement("div");
    ov.className = "dr-ov";
    const dr = document.createElement("aside");
    dr.className = "drawer";
    dr.setAttribute("role", "dialog");
    dr.setAttribute("aria-modal", "true");
    dr.setAttribute("aria-label", "منو");
    dr.innerHTML = html;
    document.body.appendChild(ov);
    document.body.appendChild(dr);
    const prevOv = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const mb = document.getElementById("menuBtn");
    if (mb) mb.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => requestAnimationFrame(() => { ov.classList.add("on"); dr.classList.add("on"); }));
    let done = false;
    const close = (noFocus) => {
      if (done) return;
      done = true;
      menuClose = null;
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pz:nav", close);
      document.body.style.overflow = prevOv;
      if (mb) mb.setAttribute("aria-expanded", "false");
      ov.classList.remove("on"); dr.classList.remove("on");
      setTimeout(() => { ov.remove(); dr.remove(); }, reduceMotion() ? 0 : 260);
      if (noFocus !== true && prev && prev.isConnected) { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "Tab") {
        const f = Array.prototype.slice.call(dr.querySelectorAll("a[href],button"));
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    menuClose = close;
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("pz:nav", close);
    ov.addEventListener("click", () => close());
    dr.addEventListener("click", (e) => { if (e.target.closest("a[href]")) close(true); });
    const $ = (id) => dr.querySelector("#" + id);
    $("drX").addEventListener("click", () => close());
    const on = (id, fn) => { const b = $(id); if (b) b.addEventListener("click", fn); };
    on("drEdit", () => { close(true); openProfileEdit(); });
    on("drAdd", () => { close(true); openLinkModal(s.phone ? "email" : "phone"); });
    on("drTheme", (e) => { const t = document.getElementById("themeBtn"); if (t) { window.__pzThemeSrc = e.currentTarget; t.click(); } });
    on("drOut", (e) => { close(true); doLogout(e.currentTarget); });
    setTimeout(() => { if (!done) { const f = dr.querySelector(".dr-item"); if (f) f.focus({ preventScroll: true }); } }, 60);
  }

  /* ---------- بخش مالی: خریدها و مصرف پولک ---------- */
  function viewWallet(token) {
    setTitle("بخش مالی");
    const ok = () => token === routeToken;
    app.innerHTML =
      '<a class="back" href="/tokens">' + ICONS.back + " پولک‌های من</a>" +
      '<div class="page-head"><h1>بخش مالی</h1><a class="btn small" href="/tokens">' + COIN + " خرید پولک</a></div>" +
      '<div id="wlBox" aria-live="polite"><p class="muted">در حال بارگذاری…</p></div>';
    const fmtDT = (v) => {
      const t = new Date(v);
      if (isNaN(t)) return "";
      try { return t.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric" }) + " · " + t.toLocaleTimeString("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }); }
      catch (e) { return t.toLocaleDateString("fa-IR"); }
    };
    const REASON = { ai: "ساخت آزمون با هوش مصنوعی", tutor: "پرسش از معلم هوشمند", refund: "برگشت پولک", admin: "تغییر توسط پشتیبانی", gift: "هدیه" };
    const load = async () => {
      const box = document.getElementById("wlBox");
      let r;
      try { r = await rpc("my_wallet", { p_token: tokenOf() }); }
      catch (e) { if (ok() && box) box.innerHTML = '<div class="err" role="alert">' + esc(e.message || "بارگذاری ممکن نشد.") + '</div><div class="actions"><button class="btn" type="button" id="wlRetry">تلاش دوباره</button></div>'; const b = document.getElementById("wlRetry"); if (b) b.addEventListener("click", load); return; }
      if (!ok() || !box) return;
      if (!r || r.ok !== true) { if (r && r.error === "no_session") { auth.clear(); go("/signup?next=wallet", true); return; } box.innerHTML = '<div class="err" role="alert">بارگذاری ممکن نشد.</div>'; return; }
      const sm = r.summary || {};
      const cards = [
        ["موجودی فعلی", COIN + "<b>" + fmtN(r.balance || 0) + "</b>", "پولک"],
        ["مجموع پرداخت", "<b>" + fmtN(sm.amount || 0) + "</b>", "تومان"],
        ["پولک خریداری‌شده", "<b>" + fmtN(sm.tokens || 0) + "</b>", faNum(sm.count || 0) + " خرید"],
        ["پولک مصرف‌شده", "<b>" + fmtN(Math.max(r.used || 0, 0)) + "</b>", "پولک"],
      ];
      const buys = r.purchases || [], log = r.log || [];
      box.innerHTML =
        '<div class="wl-st">' + cards.map((c) => '<div class="wl-c"><span>' + c[0] + '</span><div class="wl-v">' + c[1] + "</div><small>" + c[2] + "</small></div>").join("") + "</div>" +
        '<div class="card"><h2 class="wl-h">خریدها</h2>' +
        (buys.length ? buys.map((p) =>
          '<div class="wl-row"><div class="wl-m"><b>' + fmtN(p.tokens) + " پولک</b><small>" + esc(fmtDT(p.at)) + "</small></div>" +
          '<div class="wl-a"><b>' + fmtN(p.amount) + " تومان</b></div></div>").join("")
          : '<p class="muted" style="margin:0">هنوز خریدی انجام نداده‌اید.</p>') + "</div>" +
        '<div class="card"><h2 class="wl-h">مصرف و تغییرات</h2>' +
        (log.length ? log.map((l) => {
          const pos = l.delta > 0;
          return '<div class="wl-row"><div class="wl-m"><b>' + esc(REASON[l.reason] || "تغییر موجودی") + "</b><small>" + esc(fmtDT(l.at)) + "</small></div>" +
            '<div class="wl-a"><b class="' + (pos ? "wl-pos" : "wl-neg") + '" dir="ltr">' + (pos ? "+" : "−") + faNum(Math.abs(l.delta)) + "</b><small>موجودی: " + fmtN(l.balance) + "</small></div></div>";
        }).join("") : '<p class="muted" style="margin:0">هنوز پولکی مصرف نشده است.</p>') + "</div>";
    };
    load();
    return null;
  }

  /* پنجره‌ی «تغییر پروفایل»: نام و رنگ */
  function openProfileEdit() {
    const cur = auth.get();
    if (!cur) return;
    const prev = document.activeElement;
    let color = AV_GRADS[cur.avatar] ? cur.avatar : "g1";
    const ov = document.createElement("div");
    ov.className = "modal pf-modal";
    ov.innerHTML =
      '<div class="modal-box pf-box" role="dialog" aria-modal="true" aria-labelledby="pfT">' +
      '<div class="modal-head"><h2 id="pfT">تغییر پروفایل</h2></div>' +
      '<form class="modal-body" id="pfForm" novalidate>' +
      '<div class="pf-prev" id="pfPrev" aria-hidden="true"></div>' +
      '<label for="pfName">نام و نام خانوادگی</label>' +
      '<input id="pfName" class="auth-input auth-name" type="text" autocomplete="name" maxlength="60">' +
      '<div class="pf-lbl" id="pfL">رنگ پروفایل</div>' +
      '<div class="pf-sw" role="radiogroup" aria-labelledby="pfL">' +
      Object.keys(AV_GRADS).map((k) => '<button type="button" role="radio" data-c="' + k + '" aria-label="رنگ ' + faNum(k.slice(1)) + '" aria-checked="false" style="' + avBg(k) + '"></button>').join("") +
      "</div>" +
      '<div class="auth-msg" id="pfMsg" role="alert"></div>' +
      '<div class="actions"><button class="btn ghost" type="button" id="pfNo">انصراف</button><button class="btn" type="submit" id="pfYes">ذخیره</button></div></form></div>';
    document.body.appendChild(ov);
    const prevOv = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const nmEl = ov.querySelector("#pfName"), prevEl = ov.querySelector("#pfPrev"), msg = ov.querySelector("#pfMsg"), yes = ov.querySelector("#pfYes");
    nmEl.value = cleanName(cur.name);
    const paint = () => {
      const n = cleanName(nmEl.value);
      prevEl.style.background = AV_GRADS[color] ? "linear-gradient(135deg," + AV_GRADS[color][0] + "," + AV_GRADS[color][1] + ")" : "";
      prevEl.innerHTML = n ? esc(initialOf(n)) : USER_ICON.replace("<svg", '<svg style="width:55%;height:55%"');
      ov.querySelectorAll(".pf-sw button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.c === color)));
    };
    paint();
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pz:nav", close);
      document.body.style.overflow = prevOv;
      ov.remove();
      if (prev && prev.isConnected) { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("pz:nav", close);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    ov.querySelector("#pfNo").addEventListener("click", close);
    nmEl.addEventListener("input", () => { nmEl.classList.remove("bad"); msg.textContent = ""; paint(); });
    ov.querySelectorAll(".pf-sw button").forEach((b) => b.addEventListener("click", () => { color = b.dataset.c; paint(); }));
    ov.querySelector("#pfForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const n = cleanName(nmEl.value);
      if (!validName(n)) { nmEl.classList.add("bad"); msg.className = "auth-msg m-err"; msg.textContent = "نام و نام خانوادگی‌تان را وارد کنید (حداقل ۲ حرف)."; nmEl.focus(); return; }
      yes.disabled = true; yes.classList.add("loading"); msg.textContent = "";
      const r = await authCall({ action: "profile_update", token: cur.token, name: n, avatar: color });
      if (done) return;
      yes.disabled = false; yes.classList.remove("loading");
      if (r && r.ok) {
        const s2 = auth.get();
        if (s2) auth.set(Object.assign({}, s2, { name: cleanName(r.name), avatar: r.avatar || undefined }));
        close();
        if (window.__pzToast) window.__pzToast("پروفایل ذخیره شد");
        return;
      }
      msg.className = "auth-msg m-err";
      msg.textContent = (r && r.message) || "ذخیره نشد. دوباره تلاش کنید.";
    });
    setTimeout(() => { if (!done) { try { nmEl.focus({ preventScroll: true }); nmEl.select(); } catch (e) { /* ignore */ } } }, 60);
  }
  document.addEventListener("click", closeProfile);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const pop = document.getElementById("profPop"); if (pop && !pop.hidden) { closeProfile(); const b = document.getElementById("profBtn"); if (b) b.focus(); } } });
  window.addEventListener("resize", closeProfile);
  window.addEventListener("pz:nav", closeProfile);

  async function authCall(body) {
    let res;
    try {
      res = await fetch(cfg.SUPABASE_URL + "/functions/v1/" + AUTH_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return { ok: false, error: "network", message: "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید." };
    }
    let d = null;
    try { d = await res.json(); } catch (e) { /* ignore */ }
    if (d && typeof d.ok === "boolean") return d;
    return {
      ok: false,
      error: "server",
      message: res.status === 404 ? "بخش ثبت‌نام هنوز روی سرور راه‌اندازی نشده است." : "خطایی رخ داد (" + res.status + "). دوباره تلاش کنید.",
    };
  }

  const toLatinDigits = (s) => String(s).replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  function cleanPhone(v) {
    let d = toLatinDigits(v).replace(/\D/g, "");
    if (d.indexOf("0098") === 0) d = "0" + d.slice(4);
    else if (d.indexOf("98") === 0 && d.length >= 12) d = "0" + d.slice(2);
    else if (d.charAt(0) === "9") d = "0" + d;
    return d.slice(0, 11);
  }
  const validPhone = (p) => /^09\d{9}$/.test(p);
  /* ایمیل همان‌طور که هست؛ شماره در گروه‌های ۴-۳-۴. هر دو «جدا» (LRI…PDI) تا وسط متن فارسی ترتیبشان برعکس نشود */
  const showPhone = (p) => "\u2066" + (p.indexOf("@") >= 0 ? p : faNum(p.slice(0, 4) + " " + p.slice(4, 7) + " " + p.slice(7))) + "\u2069";
  const validEmail = (e) => e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
  /* ورودیِ «شماره یا ایمیل» (برای دعوت به گروه) → { v: مقدار پاک‌شده, ok } */
  function cleanIdent(raw) {
    const t = String(raw == null ? "" : raw).trim();
    if (t.indexOf("@") >= 0) { const e = t.toLowerCase().replace(/\s+/g, ""); return { v: e, ok: validEmail(e) }; }
    const p = cleanPhone(t);
    return { v: p, ok: validPhone(p) };
  }
  const mmss = (sec) => faNum(Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"));

  const LOGO_CHECK = '<img class="logo" src="/logo/mark.png" width="73" height="52" alt="" decoding="async">';

  function ringSvg() {
    let ticks = "";
    for (let i = 0; i < 12; i++) {
      const big = i % 3 === 0;
      ticks += '<line class="tk' + (big ? " big" : "") + '" x1="60" y1="' + (big ? 7 : 8.5) + '" x2="60" y2="' + (big ? 14 : 12) + '" transform="rotate(' + i * 30 + ' 60 60)"/>';
    }
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A9D6F"/><stop offset="1" stop-color="#0F5132"/></linearGradient></defs>' +
      '<circle class="track" cx="60" cy="60" r="46"/>' +
      '<circle class="prog" id="ringProg" cx="60" cy="60" r="46" pathLength="100"/>' +
      '<g>' + ticks + "</g>" +
      '</svg>';
  }

  function viewSignup() {
    setTitle("ثبت‌نام");
    if (auth.get()) { go(signupNext ? "/" + signupNext : "/"); return null; }
    const nextHash = signupNext ? "/" + signupNext : "/";

    app.innerHTML =
      '<div class="auth-wrap"><div class="card auth-card">' +
      '<div class="auth-logo">' + LOGO_CHECK + "</div>" +
      '<div id="authStep"></div></div>' +
      '<div class="actions" id="authBack" style="justify-content:center"><a class="back" href="/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a></div></div>";
    const box = document.getElementById("authStep");

    let alive = true;
    let raf = 0;
    let navTimer = 0;
    let phone = "";
    let fullName = "";
    let method = "phone";       /* روش ورود: phone | email */
    let email = "";
    let kind = "phone";         /* کدِ تأیید به کجا رفته: phone | email */

    const stopTimers = () => { cancelAnimationFrame(raf); raf = 0; };
    const mount = (html) => { stopTimers(); box.innerHTML = '<div class="auth-step">' + html + "</div>"; return box.firstChild; };

    const methodSeg = () => '<div class="seg auth-seg" role="group" aria-label="روش ثبت‌نام و ورود"><button type="button" data-m="phone" aria-pressed="' + (method === "phone") + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18h2"/></svg><span>با موبایل</span></button><button type="button" data-m="email" aria-pressed="' + (method === "email") + '"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>با ایمیل</span></button></div>';
    const bindSeg = () => box.querySelectorAll("button[data-m]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.m === method) return;
      method = b.dataset.m;
      stepStart();
    }));
    const stepStart = () => { if (method === "email") stepEmail(email); else stepPhone(phone); };

    /* ----- مرحله‌ی ۱: شماره ----- */
    function stepPhone(prefill) {
      mount(
        "<h1>ثبت‌نام</h1>" + methodSeg() +
        '<p class="sub">شماره‌ی موبایل‌تان را وارد کنید تا یک کد تأیید برایتان بفرستیم. اگر قبلاً ثبت‌نام کرده‌اید، وارد حساب‌تان می‌شوید.</p>' +
        '<form id="phoneForm" novalidate><label for="nm">نام و نام خانوادگی</label>' +
        '<input id="nm" class="auth-input auth-name" type="text" autocomplete="name" maxlength="60" placeholder="مثلاً علی رضایی" aria-describedby="phMsg">' +
        '<label for="ph">شماره‌ی موبایل</label>' +
        '<input id="ph" class="auth-input" type="text" inputmode="numeric" autocomplete="tel" maxlength="14" placeholder="۰۹۱۲۳۴۵۶۷۸۹" aria-describedby="phMsg">' +
        '<div class="auth-msg" id="phMsg" role="alert"></div>' +
        '<button class="btn wide" id="phGo" type="submit">دریافت کد</button></form>'
      );
      bindSeg();
      const ph = document.getElementById("ph");
      const nmEl = document.getElementById("nm");
      const msg = document.getElementById("phMsg");
      const go = document.getElementById("phGo");
      ph.value = faNum(prefill || "");
      nmEl.value = fullName;
      nmEl.addEventListener("input", () => { nmEl.classList.remove("bad"); msg.textContent = ""; });
      /* هنگام تایپ فقط رقم‌ها فارسی می‌شوند (و جای مکان‌نما حفظ می‌شود)؛ پیش‌شماره‌ی ‎+98‎ و صفر اول هنگام ارسال درست می‌شود */
      ph.addEventListener("input", () => {
        const v = ph.value;
        const keep = (t) => toLatinDigits(t).replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
        const clean = keep(v).slice(0, 14);
        const out = clean.replace(/\d/g, (d) => FA[d]);
        if (out !== v) {
          const pos = Math.min(keep(v.slice(0, ph.selectionStart == null ? v.length : ph.selectionStart)).length, out.length);
          ph.value = out;
          try { ph.setSelectionRange(pos, pos); } catch (e) { /* بی‌اهمیت */ }
        }
        ph.classList.remove("bad");
        msg.textContent = "";
      });
      document.getElementById("phoneForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const n = cleanName(nmEl.value);
        if (!validName(n)) {
          nmEl.classList.add("bad");
          msg.className = "auth-msg m-err";
          msg.textContent = "نام و نام خانوادگی‌تان را وارد کنید (حداقل ۲ حرف).";
          nmEl.focus();
          return;
        }
        const p = cleanPhone(ph.value);
        if (!validPhone(p)) {
          ph.classList.add("bad");
          msg.className = "auth-msg m-err";
          msg.textContent = "شماره‌ی موبایل معتبر نیست. مثل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.";
          ph.focus();
          return;
        }
        go.disabled = true; go.classList.add("loading"); msg.textContent = "";
        const r = await authCall({ action: "send", phone: p });
        if (!alive) return;
        go.disabled = false; go.classList.remove("loading");
        if (r.ok) { phone = p; fullName = n; kind = "phone"; stepCode(r); return; }
        msg.className = "auth-msg m-err";
        msg.textContent = r.message || "ارسال کد ناموفق بود.";
        if (r.retry_in) msg.textContent += " (" + faNum(r.retry_in) + " ثانیه)";
      });
      const first = fullName ? ph : nmEl;
      if (!reduceMotion()) setTimeout(() => { if (alive) first.focus({ preventScroll: true }); }, 350);
      else first.focus({ preventScroll: true });
    }


    /* ----- مرحله‌ی ۱ (ایمیل): نام + ایمیل → کد تأیید (بدون رمز عبور؛ همان روشِ شماره‌ی موبایل) ----- */
    function stepEmail(prefill) {
      mount(
        "<h1>ثبت‌نام</h1>" + methodSeg() +
        '<p class="sub">ایمیل‌تان را وارد کنید تا یک کد تأیید برایتان بفرستیم. اگر قبلاً ثبت‌نام کرده‌اید، وارد حساب‌تان می‌شوید.</p>' +
        '<form id="emForm" novalidate>' +
        '<label for="nm">نام و نام خانوادگی</label><input id="nm" class="auth-input auth-name" type="text" autocomplete="name" maxlength="60" placeholder="مثلاً علی رضایی">' +
        '<label for="em">ایمیل</label><input id="em" class="auth-input auth-plain" type="email" inputmode="email" autocomplete="email" maxlength="254" autocapitalize="off" spellcheck="false" placeholder="name@example.com">' +
        '<div class="auth-msg" id="emMsg" role="alert"></div>' +
        '<button class="btn wide" id="emGo" type="submit">دریافت کد</button></form>'
      );
      bindSeg();
      const emEl = document.getElementById("em"), nmEl = document.getElementById("nm");
      const msg = document.getElementById("emMsg"), go = document.getElementById("emGo");
      emEl.value = prefill || "";
      nmEl.value = fullName;
      const clearBad = (el) => () => { el.classList.remove("bad"); msg.textContent = ""; };
      [emEl, nmEl].forEach((el) => el.addEventListener("input", clearBad(el)));
      const bad = (el, text) => { el.classList.add("bad"); msg.className = "auth-msg m-err"; msg.textContent = text; el.focus(); };
      document.getElementById("emForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const n = cleanName(nmEl.value);
        const em = emEl.value.trim().toLowerCase();
        if (!validName(n)) return bad(nmEl, "نام و نام خانوادگی‌تان را وارد کنید (حداقل ۲ حرف).");
        if (!validEmail(em)) return bad(emEl, "ایمیل معتبر نیست. مثل name@example.com وارد کنید.");
        go.disabled = true; go.classList.add("loading"); msg.textContent = "";
        const r = await authCall({ action: "email_send", email: em });
        if (!alive) return;
        go.disabled = false; go.classList.remove("loading");
        if (r.ok) { email = em; fullName = n; kind = "email"; stepCode(r); return; }
        msg.className = "auth-msg m-err";
        msg.textContent = r.message || "درخواست ناموفق بود.";
        if (r.retry_in) msg.textContent += " (" + faNum(r.retry_in) + " ثانیه)";
      });
      if (!reduceMotion()) setTimeout(() => { if (alive) (fullName ? emEl : nmEl).focus({ preventScroll: true }); }, 350);
      else (fullName ? emEl : nmEl).focus({ preventScroll: true });
    }

    /* ----- مرحله‌ی ۲: کد + ساعت دایره‌ای ----- */
    function stepCode(info) {
      mount(
        "<h1>کد تأیید</h1>" +
        '<p class="sub">کد ۵ رقمی به ' + (kind === "email" ? "ایمیل" : "شماره‌ی") + ' <span class="auth-phone">' + esc(kind === "email" ? email : showPhone(phone)) + "</span> ارسال شد. " +
        (kind === "email" ? "اگر پیدایش نکردید، پوشه‌ی هرزنامه (Spam) را هم ببینید. " : "") +
        '<button class="auth-link" id="editPh" type="button">' + (kind === "email" ? "ویرایش ایمیل" : "ویرایش شماره") + "</button></p>" +
        '<div class="ring" id="ring" role="timer" aria-label="زمان باقی‌مانده تا انقضای کد">' + ringSvg() +
        '<div class="ring-t"><b id="ringT">۲:۰۰</b><span>زمان باقی‌مانده</span></div></div>' +
        '<div class="otp" id="otp" role="group" aria-label="کد ۵ رقمی">' +
        [0, 1, 2, 3, 4].map((i) => '<input type="text" inputmode="numeric" maxlength="' + (i === 0 ? 5 : 1) + '" autocomplete="' + (i === 0 ? "one-time-code" : "off") + '" aria-label="رقم ' + faNum(i + 1) + '">').join("") +
        "</div>" +
        (info.dev_code ? '<div class="auth-dev">حالت آزمایشی (ارسال ' + (kind === "email" ? "ایمیل" : "پیامک") + ' هنوز فعال نیست): کد شما <b>' + faNum(info.dev_code) + "</b></div>" : "") +
        '<div class="auth-msg info" id="cMsg" role="alert"></div>' +
        '<button class="btn ghost wide" id="resend" type="button" hidden>ارسال دوباره‌ی کد</button>'
      );
      const ring = document.getElementById("ring");
      const prog = document.getElementById("ringProg");
      const timeEl = document.getElementById("ringT");
      const otp = document.getElementById("otp");
      const boxes = Array.prototype.slice.call(otp.querySelectorAll("input"));
      const msg = document.getElementById("cMsg");
      const resend = document.getElementById("resend");

      let total = (info.expires_in || 120) * 1000;
      let deadline = Date.now() + total;
      let expired = false;
      let busy = false;
      let lastSec = -1;

      const setMsg = (t, cls) => { msg.className = "auth-msg " + (cls === "err" ? "m-err" : "info"); msg.textContent = t || ""; };
      const getCode = () => boxes.map((b) => b.dataset.d || "").join("");
      const clearBoxes = () => { boxes.forEach((b) => { b.value = ""; b.dataset.d = ""; b.classList.remove("filled"); }); };
      const lock = (v) => boxes.forEach((b) => { b.disabled = v; });

      function showResend() { resend.hidden = false; resend.disabled = false; }

      function paint() {
        const now = Date.now();
        const left = Math.max(0, deadline - now);
        const used = 1 - left / total;
        prog.style.strokeDashoffset = String(100 * used);
        const sec = Math.ceil(left / 1000);
        if (sec !== lastSec) {
          lastSec = sec;
          timeEl.textContent = mmss(sec);
          ring.classList.toggle("low", sec <= 10 && sec > 0);
        }
        if (left <= 0 && !expired) {
          expired = true;
          ring.classList.remove("low"); ring.classList.add("off");
          lock(true);
          setMsg("زمان کد تمام شد. یک کد جدید بگیرید.", "err");
          showResend();
        }
        if (!expired) raf = requestAnimationFrame(paint);
      }

      async function submit() {
        if (busy || expired) return;
        const code = getCode();
        if (code.length !== 5) return;
        busy = true; lock(true); setMsg("در حال بررسی…", "info");
        const r = kind === "email"
          ? await authCall({ action: "email_verify", email: email, code: code, name: fullName })
          : await authCall({ action: "verify", phone: phone, code: code, name: fullName });
        if (!alive) return;
        busy = false;
        if (r.ok) {
          fullName = cleanName(r.name || fullName);
          auth.set(kind === "email" ? { token: r.token, email: r.email, name: fullName, avatar: r.avatar || undefined } : { token: r.token, phone: r.phone, name: fullName });
          stepWelcome(!!r.created);
          return;
        }
        if (r.error === "wrong") {
          otp.classList.remove("bad-code"); void otp.offsetWidth; otp.classList.add("bad-code");
          const left = Number(r.attempts_left || 0);
          setMsg("کد اشتباه است." + (left > 0 ? " " + faNum(left) + " بار دیگر می‌توانید تلاش کنید." : " دیگر نمی‌توانید تلاش کنید؛ یک کد جدید بگیرید."), "err");
          setTimeout(() => {
            if (!alive) return;
            otp.classList.remove("bad-code"); clearBoxes();
            if (left > 0 && !expired) { lock(false); boxes[0].focus(); }
          }, 650);
          if (left <= 0) { lock(true); showResend(); }
          return;
        }
        if (r.error === "network" || r.error === "server") { lock(false); setMsg(r.message, "err"); return; }
        /* منقضی یا قفل */
        otp.classList.add("bad-code");
        lock(true);
        setMsg(r.message || "کد معتبر نیست. یک کد جدید بگیرید.", "err");
        showResend();
      }

      function fill(start, digits) {
        let i = start;
        for (let k = 0; k < digits.length && i < 5; k++, i++) {
          boxes[i].dataset.d = digits[k];
          boxes[i].value = FA[digits[k]];
          boxes[i].classList.add("filled");
        }
        const next = Math.min(i, 4);
        boxes[next].focus();
        if (getCode().length === 5) submit();
      }

      boxes.forEach((b, i) => {
        b.addEventListener("input", () => {
          const d = toLatinDigits(b.value).replace(/\D/g, "");
          setMsg("");
          otp.classList.remove("bad-code");
          if (!d) { b.value = ""; b.dataset.d = ""; b.classList.remove("filled"); return; }
          b.value = ""; b.dataset.d = ""; b.classList.remove("filled");
          fill(i, d);
        });
        b.addEventListener("keydown", (e) => {
          if (e.key === "Backspace" && !b.value && i > 0) {
            boxes[i - 1].value = ""; boxes[i - 1].dataset.d = ""; boxes[i - 1].classList.remove("filled");
            boxes[i - 1].focus(); e.preventDefault();
          } else if (e.key === "ArrowLeft" && i > 0) { boxes[i - 1].focus(); e.preventDefault(); }
          else if (e.key === "ArrowRight" && i < 4) { boxes[i + 1].focus(); e.preventDefault(); }
        });
        b.addEventListener("focus", () => { try { b.select(); } catch (e) { /* ignore */ } });
        b.addEventListener("paste", (e) => {
          const t = (e.clipboardData && e.clipboardData.getData("text")) || "";
          const d = toLatinDigits(t).replace(/\D/g, "").slice(0, 5);
          if (!d) return;
          e.preventDefault();
          clearBoxes();
          fill(0, d);
        });
      });

      resend.addEventListener("click", async () => {
        if (resend.disabled) return;
        resend.disabled = true; resend.classList.add("loading");
        const r = kind === "email"
          ? await authCall({ action: "email_send", email: email })
          : await authCall({ action: "send", phone: phone });
        if (!alive) return;
        resend.classList.remove("loading");
        if (r.ok) {
          total = (r.expires_in || 120) * 1000;
          deadline = Date.now() + total;
          resend.hidden = true;
          expired = false; lastSec = -1;
          ring.classList.remove("off", "low");
          clearBoxes(); lock(false); otp.classList.remove("bad-code");
          setMsg("کد جدید ارسال شد.", "info");
          const dev = box.querySelector(".auth-dev b");
          if (r.dev_code && dev) dev.textContent = faNum(r.dev_code);
          boxes[0].focus();
          cancelAnimationFrame(raf); raf = requestAnimationFrame(paint);
        } else {
          setMsg((r.message || "ارسال دوباره ناموفق بود.") + (r.retry_in ? " (" + faNum(r.retry_in) + " ثانیه)" : ""), "err");
          resend.disabled = false;
        }
      });
      document.getElementById("editPh").addEventListener("click", () => { method = kind; stepStart(); });

      paint();
      if (!reduceMotion()) setTimeout(() => { if (alive && !expired) boxes[0].focus({ preventScroll: true }); }, 350);
      else boxes[0].focus({ preventScroll: true });
    }

    /* ----- موفقیت: خودکار وارد می‌شود ----- */
    function stepWelcome(created) {
      const bk = document.getElementById("authBack");
      if (bk) bk.hidden = true;   /* دکمه‌ی «ورود به سایت» همین کار را می‌کند */
      mount(
        '<div class="auth-welcome"><div class="ring done" id="ring">' + ringSvg() +
        '<div class="okmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>' +
        "<h1>" + (created ? "ثبت‌نام شما انجام شد 🎉" : "خوش آمدید 👋") + "</h1>" +
        (fullName ? '<p class="auth-hello">' + esc(fullName) + "</p>" : "") +
        '<p class="sub">' + (created ? "به پازمونک خوش آمدید." : "با موفقیت وارد شدید.") + " در حال انتقال به " + (/^q\//.test(signupNext) ? "آزمون…" : /^(groups|g\/)/.test(signupNext) ? "گروه‌ها…" : signupNext === "tutor" ? "معلم هوشمند…" : signupNext ? "صفحه‌ی ساخت آزمون…" : "صفحه‌ی اصلی…") + "</p>" +
        (created ? '<div class="tk-gift">' + COIN + "<span><b>" + faNum(TK_FREE) + " پولک</b> هدیه‌ی ثبت‌نام برای ساخت آزمون با هوش مصنوعی</span></div>" : "") +
        '<a class="btn wide" href="' + nextHash + '">' + (/^q\//.test(signupNext) ? "ادامه و شرکت در آزمون" : /^(groups|g\/)/.test(signupNext) || signupNext === "tutor" ? "ادامه" : signupNext ? "ادامه و ساخت آزمون" : "ورود به سایت") + "</a></div>"
      );
      const prog = document.getElementById("ringProg");
      prog.style.strokeDashoffset = "100";
      requestAnimationFrame(() => requestAnimationFrame(() => { prog.style.strokeDashoffset = "0"; }));
      navTimer = setTimeout(() => { if (alive) go(nextHash); }, created ? 3000 : 1700);
    }

    stepStart();
    return function cleanup() { alive = false; stopTimers(); clearTimeout(navTimer); };
  }

  function viewAccount() {
    setTitle("حساب من");
    const s = auth.get();
    if (!s) { go("/signup"); return null; }
    app.innerHTML =
      '<div class="auth-wrap"><div class="card auth-card"><div class="auth-logo">' + LOGO_CHECK + "</div>" +
      '<div class="auth-step"><h1>حساب من</h1><p class="sub">' + (cleanName(s.name) ? "<strong>" + esc(cleanName(s.name)) + "</strong><br>" : "") + (s.phone ? "با این شماره" : "با این ایمیل") + " وارد شده‌اید:</p>" +
      '<div class="acc-phone">' + esc(showPhone(s.phone || s.email)) + "</div>" +
      (s.phone && s.email ? '<div class="acc-phone" style="font-size:1rem;letter-spacing:0;margin-top:-10px">' + esc(showPhone(s.email)) + "</div>" : "") +
      '<a class="btn wide" href="/create">ساخت آزمون</a>' +
      '<button class="btn ghost wide" id="logout" type="button">خروج از حساب</button></div></div></div>';
    document.getElementById("logout").addEventListener("click", (e) => doLogout(e.currentTarget));
    return null;
  }

  async function validateSession() {
    const s = auth.get();
    if (!s || !cfg.SUPABASE_URL) return;
    const r = await authCall({ action: "me", token: s.token });
    if (r && r.ok === false && r.error === "no_session") { auth.clear(); if (/^\/account/.test(location.pathname)) go("/signup"); }
    else if (r && r.ok && (cleanName(r.name) !== cleanName(s.name) || (r.avatar || "") !== (s.avatar || "") || (r.phone || "") !== (s.phone || "") || (r.email || "") !== (s.email || ""))) auth.set(Object.assign({}, s, { name: cleanName(r.name), avatar: r.avatar || undefined, phone: r.phone || undefined, email: r.email || undefined }));
  }



  /* ---------- آزمایشگاه مدل‌ها: دکمه‌ی گرد کنار صفحه + چت با همه‌ی مدل‌ها (فقط مدیر؛ دسترسی سمت سرور بررسی می‌شود) ---------- */
  const LAB = { fab: null, panel: null, models: null, sel: null, hist: [], busy: false, ctl: null, stopped: false, open: false, loading: false, failedText: "", vvOn: false };
  const LAB_IC = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z"/><path d="M12 8.2l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9z" fill="currentColor" stroke="none"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>',
  };
  const labSrcTag = (m) => (m.src === "ds" ? "مستقیم" : m.group === "DeepSeek" ? "سرویس دوم" : "");
  const labFmtS = (ms) => faNum((ms / 1000).toFixed(1)).replace(".", "٫");
  const labCopy = (t, done) => {
    const ok = () => { if (done) done(); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok, () => labCopyOld(t, ok)); return; }
    } catch (e) { /* ادامه با روش قدیمی */ }
    labCopyOld(t, ok);
  };
  function labCopyOld(t, ok) {
    const a = document.createElement("textarea");
    a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:-100px;opacity:0";
    document.body.appendChild(a); a.select();
    try { if (document.execCommand("copy")) ok(); } catch (e) { /* ignore */ }
    a.remove();
  }
  function labStore(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* ignore */ } return null; }

  function labSync(on) {
    if (on && !LAB.fab) labMount();
    else if (!on && LAB.fab) labUnmount();
  }
  function labUnmount() {
    try { if (LAB.ctl) LAB.ctl.abort(); } catch (e) { /* ignore */ }
    labVV(false);
    if (LAB.fab) LAB.fab.remove();
    if (LAB.panel) LAB.panel.remove();
    LAB.fab = LAB.panel = null; LAB.models = null; LAB.sel = null; LAB.hist = []; LAB.busy = false; LAB.ctl = null; LAB.open = false; LAB.loading = false; LAB.failedText = "";
  }
  /* روی گوشی وقتی کیبورد باز می‌شود، پنل با ارتفاعِ دیدنی صفحه هماهنگ می‌شود تا ورودی زیر کیبورد نماند */
  function labVV(on) {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => {
      const p = LAB.panel;
      if (!p) return;
      if (!LAB.open || window.innerWidth >= 640) { p.style.removeProperty("--lab-h"); p.style.removeProperty("--lab-b"); return; }
      p.style.setProperty("--lab-h", Math.max(260, Math.round(vv.height - 16)) + "px");
      p.style.setProperty("--lab-b", Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + 8 + "px");
    };
    if (on && !LAB.vvOn) { LAB.vvOn = true; vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); LAB.vvFit = fit; fit(); }
    else if (!on && LAB.vvOn) { LAB.vvOn = false; vv.removeEventListener("resize", LAB.vvFit); vv.removeEventListener("scroll", LAB.vvFit); if (LAB.panel) { LAB.panel.style.removeProperty("--lab-h"); LAB.panel.style.removeProperty("--lab-b"); } }
  }

  function labMount() {
    const fab = document.createElement("button");
    fab.type = "button"; fab.className = "lab-fab"; fab.id = "labFab";
    fab.setAttribute("aria-label", "چت با مدل‌های هوش مصنوعی"); fab.setAttribute("aria-haspopup", "dialog"); fab.setAttribute("aria-expanded", "false");
    fab.innerHTML = LAB_IC.chat + '<i class="lab-dot" hidden></i>';
    const p = document.createElement("section");
    p.className = "lab-panel"; p.id = "labPanel"; p.hidden = true;
    p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "چت با مدل‌های هوش مصنوعی");
    p.innerHTML =
      '<header class="lab-hd"><button type="button" class="lab-model" id="labModel" aria-haspopup="listbox" aria-expanded="false"><span class="lab-mname" id="labMName">در حال بارگذاری…</span><span class="lab-mtag" id="labMTag" hidden></span>' + LAB_IC.chev + "</button>" +
      '<button type="button" class="lab-ib" id="labNew" aria-label="گفت‌وگوی تازه" title="گفت‌وگوی تازه">' + LAB_IC.plus + "</button>" +
      '<button type="button" class="lab-ib" id="labClose" aria-label="بستن" title="بستن">' + LAB_IC.x + "</button></header>" +
      '<div class="lab-log" id="labLog" role="log" aria-live="off"><p class="lab-empty">یک مدل انتخاب کنید و شروع به نوشتن کنید.<br>می‌توانید وسط گفت‌وگو مدل را عوض کنید و جواب‌ها را مقایسه کنید.</p></div>' +
      '<form class="lab-in" id="labForm" autocomplete="off"><textarea id="labTa" rows="1" maxlength="12000" placeholder="پیام…" aria-label="پیام"></textarea>' +
      '<button type="submit" class="lab-send" id="labSend" aria-label="ارسال" disabled>' + LAB_IC.send + "</button></form>" +
      '<div class="lab-pick" id="labPick" hidden><div class="lab-ph"><input type="search" id="labQ" placeholder="جست‌وجوی مدل…" aria-label="جست‌وجوی مدل" autocomplete="off"><button type="button" class="lab-ib" id="labPX" aria-label="بستن فهرست">' + LAB_IC.x + '</button></div><div class="lab-pl" id="labPL" role="listbox" aria-label="مدل‌ها"></div></div>';
    document.body.appendChild(fab);
    document.body.appendChild(p);
    LAB.fab = fab; LAB.panel = p;

    const $ = (id) => p.querySelector("#" + id);
    const log = $("labLog"), ta = $("labTa"), sendBtn = $("labSend"), pick = $("labPick"), pl = $("labPL"), qIn = $("labQ"), mBtn = $("labModel");
    const coarse = () => { try { return window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } };
    const near = () => log.scrollHeight - log.scrollTop - log.clientHeight < 90;
    const toEnd = () => { log.scrollTop = log.scrollHeight; };

    /* ----- باز و بسته ----- */
    function setOpen(v) {
      LAB.open = v;
      p.hidden = !v; fab.hidden = v;
      fab.setAttribute("aria-expanded", String(v));
      labVV(v);
      if (v) {
        if (!LAB.models && !LAB.loading) loadModels(false);
        if (!coarse()) setTimeout(() => { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
        toEnd();
      } else {
        closePick();
        try { fab.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }
    fab.addEventListener("click", () => setOpen(true));
    $("labClose").addEventListener("click", () => setOpen(false));
    p.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (!pick.hidden) closePick(); else setOpen(false);
    });

    /* ----- فهرست مدل‌ها ----- */
    function renderModelBtn() {
      const m = LAB.sel;
      $("labMName").textContent = m ? m.name : (LAB.loading ? "در حال بارگذاری…" : "انتخاب مدل");
      const tg = $("labMTag"), t = m ? labSrcTag(m) : "";
      tg.hidden = !t; tg.textContent = t;
      sync();
    }
    async function loadModels(refresh) {
      const s = auth.get();
      if (!s) return;
      LAB.loading = true; renderModelBtn();
      let err = "";
      try {
        const r = await fetch(cfg.SUPABASE_URL + "/functions/v1/lab", {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: "models", token: s.token, refresh: !!refresh }),
        });
        const d = await r.json().catch(() => null);
        if (!LAB.panel) return;
        if (r.ok && d && Array.isArray(d.models) && d.models.length) {
          LAB.models = d.models;
          const saved = labStore("lab:model");
          LAB.sel = (LAB.sel && d.models.find((m) => m.src === LAB.sel.src && m.id === LAB.sel.id)) || d.models.find((m) => m.src + ":" + m.id === saved) || d.models[0];
        } else err = (d && d.error) || "فهرست مدل‌ها نیامد.";
      } catch (e) { err = "اتصال برقرار نشد."; }
      if (!LAB.panel) return;
      LAB.loading = false;
      renderModelBtn();
      if (err && !LAB.models) { log.querySelector(".lab-empty") && (log.querySelector(".lab-empty").textContent = err + " دوباره روی نام مدل بزنید."); }
      if (!pick.hidden) renderPick();
    }
    function renderPick() {
      const q = qIn.value.trim().toLowerCase();
      pl.textContent = "";
      if (!LAB.models) {
        const d = document.createElement("div"); d.className = "lab-pm";
        d.textContent = LAB.loading ? "در حال بارگذاری…" : "فهرست نیامد.";
        if (!LAB.loading) { const b = document.createElement("button"); b.type = "button"; b.className = "btn small"; b.textContent = "تلاش دوباره"; b.addEventListener("click", () => loadModels(true)); d.appendChild(b); }
        pl.appendChild(d); return;
      }
      const list = LAB.models.filter((m) => !q || (m.name + " " + m.group + " " + m.id).toLowerCase().indexOf(q) >= 0);
      if (!list.length) { const d = document.createElement("div"); d.className = "lab-pm"; d.textContent = "مدلی پیدا نشد."; pl.appendChild(d); return; }
      let last = "";
      list.forEach((m) => {
        const g = m.group + (m.src === "ds" ? " · مستقیم" : m.group === "DeepSeek" ? " · سرویس دوم" : "");
        if (g !== last) { last = g; const h = document.createElement("div"); h.className = "lab-pg"; h.textContent = g; pl.appendChild(h); }
        const b = document.createElement("button");
        const on = LAB.sel && LAB.sel.src === m.src && LAB.sel.id === m.id;
        b.type = "button"; b.className = "lab-po"; b.setAttribute("role", "option"); b.setAttribute("aria-selected", String(!!on));
        b.textContent = m.name;
        b.addEventListener("click", () => { LAB.sel = m; labStore("lab:model", m.src + ":" + m.id); renderModelBtn(); closePick(); if (!coarse()) ta.focus({ preventScroll: true }); });
        pl.appendChild(b);
      });
    }
    function openPick() {
      if (!LAB.models && !LAB.loading) loadModels(true);
      pick.hidden = false; mBtn.setAttribute("aria-expanded", "true");
      qIn.value = ""; renderPick();
      if (!coarse()) setTimeout(() => qIn.focus({ preventScroll: true }), 30);
      const sel = pl.querySelector('[aria-selected="true"]');
      if (sel) sel.scrollIntoView({ block: "center" });
    }
    function closePick() { pick.hidden = true; mBtn.setAttribute("aria-expanded", "false"); }
    mBtn.addEventListener("click", () => { if (pick.hidden) openPick(); else closePick(); });
    $("labPX").addEventListener("click", () => { closePick(); try { mBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
    qIn.addEventListener("input", renderPick);

    /* ----- گفت‌وگو ----- */
    function sync() {
      sendBtn.classList.toggle("stop", LAB.busy);
      sendBtn.innerHTML = LAB.busy ? LAB_IC.stop : LAB_IC.send;
      sendBtn.setAttribute("aria-label", LAB.busy ? "توقف پاسخ" : "ارسال");
      sendBtn.disabled = LAB.busy ? false : (!ta.value.trim() || !LAB.sel);
      $("labNew").disabled = false;
      const dot = fab.querySelector(".lab-dot");
      if (dot) dot.hidden = !LAB.busy;
      log.setAttribute("aria-busy", String(LAB.busy));
    }
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, 132) + "px"; };
    ta.addEventListener("input", () => { grow(); sync(); });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !coarse()) { e.preventDefault(); if (!LAB.busy) submit(); }
    });
    $("labForm").addEventListener("submit", (e) => { e.preventDefault(); if (LAB.busy) { LAB.stopped = true; try { if (LAB.ctl) LAB.ctl.abort(); } catch (x) { /* ignore */ } } else submit(); });
    $("labNew").addEventListener("click", () => {
      if (LAB.busy) { LAB.stopped = true; try { if (LAB.ctl) LAB.ctl.abort(); } catch (x) { /* ignore */ } }
      LAB.hist = []; LAB.failedText = "";
      log.innerHTML = '<p class="lab-empty">گفت‌وگوی تازه. هر مدلی را که می‌خواهید انتخاب کنید و بنویسید.</p>';
      sync();
    });

    const mk = (cls, html) => { const d = document.createElement("div"); d.className = cls; if (html) d.innerHTML = html; return d; };
    function userBubble(t) { const d = mk("lab-m me"); const b = mk("lab-b"); b.textContent = t; d.appendChild(b); return d; }

    async function submit(retryText) {
      if (LAB.busy || !LAB.sel) return;
      const s = auth.get();
      if (!s) { labUnmount(); return; }
      const text = retryText || ta.value.trim();
      if (!text) return;
      const model = LAB.sel;
      const empty = log.querySelector(".lab-empty"); if (empty) empty.remove();
      log.querySelectorAll(".lab-m.err").forEach((n) => n.remove());
      if (!retryText) { log.appendChild(userBubble(text)); ta.value = ""; grow(); }
      else { /* تلاش دوباره: پیام کاربر قبلاً در صفحه است */ }
      LAB.hist.push({ r: "u", c: text });
      LAB.failedText = "";
      const wrap = mk("lab-m ai streaming");
      const tag = mk("lab-tag"); tag.textContent = model.name + (labSrcTag(model) ? " · " + labSrcTag(model) : "");
      const body = mk("lab-b tt-md"); body.innerHTML = '<span class="tt-dots" role="status" aria-label="در حال نوشتن"><i></i><i></i><i></i></span>';
      const meta = mk("lab-meta");
      wrap.appendChild(tag); wrap.appendChild(body); wrap.appendChild(meta);
      log.appendChild(wrap);
      LAB.busy = true; LAB.stopped = false; sync(); toEnd();

      const t0 = performance.now();
      let txt = "", first = 0, usage = null, trunc = false, err = "", done = false, stall = false, shown = "", timer = 0, lastDraw = 0;
      const draw = (final) => {
        timer = 0;
        if (!final && shown === txt) return;
        shown = txt;
        const stick = near();
        body.innerHTML = ttMd(txt, !final);
        if (final) renderMath(body);
        lastDraw = performance.now();
        if (stick) toEnd();
      };
      const sched = () => { if (timer) return; const w = Math.max(0, 110 - (performance.now() - lastDraw)); timer = setTimeout(() => draw(false), w); };
      LAB.ctl = window.AbortController ? new AbortController() : null;
      let res = null;
      try {
        res = await fetch(cfg.SUPABASE_URL + "/functions/v1/lab", {
          method: "POST", signal: LAB.ctl ? LAB.ctl.signal : undefined,
          headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: "chat", token: s.token, model: model.id, src: model.src, messages: LAB.hist.slice(-24).map((m) => ({ role: m.r === "u" ? "user" : "assistant", content: m.c })) }),
        });
      } catch (e) { err = LAB.stopped ? "" : "اتصال به سرور برقرار نشد."; }

      if (res && res.ok && /text\/event-stream/i.test(res.headers.get("content-type") || "") && res.body && res.body.getReader) {
        const rd = res.body.getReader(), dec = new TextDecoder();
        let buf = "";
        const line = (ln) => {
          ln = ln.replace(/\r$/, "");
          if (ln.indexOf("data:") !== 0) return;
          let j; try { j = JSON.parse(ln.slice(5)); } catch (e) { return; }
          if (typeof j.d === "string") { if (!first) first = performance.now() - t0; txt += j.d; sched(); }
          else if (j.done) { done = true; trunc = !!j.truncated; if (j.usage) usage = j.usage; }
          else if (j.error) err = String(j.error);
        };
        const read = () => new Promise((resolve, reject) => {
          const tm = setTimeout(() => { stall = true; try { if (LAB.ctl) LAB.ctl.abort(); } catch (e) { /* ignore */ } reject(new Error("stall")); }, 90000);
          rd.read().then((v) => { clearTimeout(tm); resolve(v); }, (e) => { clearTimeout(tm); reject(e); });
        });
        try {
          for (;;) {
            const r = await read();
            if (r.done) break;
            buf += dec.decode(r.value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n")) >= 0) { const ln = buf.slice(0, i); buf = buf.slice(i + 1); line(ln); }
          }
          if (buf) line(buf);
        } catch (e) { if (!err && !done && !LAB.stopped) err = stall ? "پاسخ دیر رسید و قطع شد." : "اتصال در میانه‌ی پاسخ قطع شد."; }
      } else if (res) {
        let d = null; try { d = await res.json(); } catch (e) { /* ignore */ }
        err = (d && d.error) || "پاسخ دادن ممکن نشد.";
        if (res.status === 401 || (d && d.code === "forbidden")) { err = (d && d.error) || err; }
      }

      /* پایان */
      if (!LAB.panel) return;   /* در همین حین خارج شده‌اید */
      clearTimeout(timer); timer = 0;
      const total = performance.now() - t0;
      LAB.busy = false; LAB.ctl = null;
      wrap.classList.remove("streaming");
      if (txt) {
        draw(true);
        LAB.hist.push({ r: "a", c: txt });
        const parts = [];
        if (first) parts.push("اولین کلمه " + labFmtS(first) + " ثانیه");
        parts.push("کل " + labFmtS(total) + " ثانیه");
        if (usage && usage.out) {
          parts.push(faNum(usage.out) + " توکن");
          const gen = (total - (first || 0)) / 1000;
          if (gen > 0.3 && usage.out > 5) parts.push(faNum(Math.round(usage.out / gen)) + " توکن بر ثانیه");
        }
        const note = LAB.stopped ? "متوقف شد" : err ? err : trunc ? "پاسخ ناقص ماند" : "";
        meta.textContent = parts.join(" · ") + (note ? " · " + note : "");
        const cp = document.createElement("button");
        cp.type = "button"; cp.className = "lab-cp"; cp.setAttribute("aria-label", "کپی پاسخ"); cp.title = "کپی پاسخ"; cp.innerHTML = LAB_IC.copy;
        cp.addEventListener("click", () => labCopy(txt, () => { if (window.__pzToast) window.__pzToast("کپی شد"); }));
        meta.appendChild(cp);
        if (err && !LAB.stopped) wrap.classList.add("warn");
      } else {
        /* بدون هیچ متنی: پیام کاربر را از تاریخچه برمی‌داریم تا دوباره‌فرستادنش پیام تکراری نسازد */
        LAB.hist.pop();
        wrap.remove();
        if (!LAB.stopped) {
          LAB.failedText = text;
          const e = mk("lab-m err");
          const b = mk("lab-b");
          const sp = document.createElement("span"); sp.textContent = (model.name + ": " + (err || "پاسخی نرسید."));
          b.appendChild(sp);
          const rt = document.createElement("button"); rt.type = "button"; rt.className = "btn small"; rt.textContent = "تلاش دوباره (با مدل انتخاب‌شده)";
          rt.addEventListener("click", () => { if (!LAB.busy) submit(LAB.failedText); });
          b.appendChild(rt);
          e.appendChild(b); log.appendChild(e);
        } else {
          const u = log.querySelectorAll(".lab-m.me"); if (u.length) u[u.length - 1].remove(); if (!ta.value) { ta.value = text; grow(); }
        }
      }
      sync();
      toEnd();
    }
    renderModelBtn();
    sync();
  }

  /* ---------- پنل مدیریت (فقط برای ادمین؛ دسترسی سمت سرور بررسی می‌شود و این دکمه فقط یک میان‌بر است) ---------- */
  let adminTok = "", adminOk = false;
  function adminSync() {
    const b = document.getElementById("admBtn");
    if (!b) return;
    const s = auth.get();
    const root = document.documentElement;
    if (!s) { adminTok = ""; adminOk = false; b.hidden = true; root.classList.remove("has-adm"); labSync(false); return; }
    if (adminTok === s.token) { b.hidden = !adminOk; root.classList.toggle("has-adm", adminOk); labSync(adminOk); return; }
    const t = s.token;
    adminTok = t; adminOk = false; b.hidden = true; root.classList.remove("has-adm");
    rpc("admin_check", { p_token: t }).then((r) => {
      const cur = auth.get();
      if (!cur || cur.token !== t) return;
      adminOk = r === true;
      b.hidden = !adminOk;
      document.documentElement.classList.toggle("has-adm", adminOk);
      labSync(adminOk);
    }).catch(() => { if (adminTok === t) adminTok = ""; });
  }

  function viewAdmin(token) {
    setTitle("پنل مدیریت");
    if (!auth.get()) { go("/signup", true); return null; }
    const ok = () => token === routeToken;
    const PER = 25;
    let page = 0, q = "", seq = 0, timer = 0, total = 0, loaded = false;
    const REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
    const fmtD = (v) => {
      const t = new Date(v);
      if (isNaN(t)) return ["—", ""];
      try {
        return [t.toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric" }), t.toLocaleTimeString("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" })];
      } catch (e) {
        return [t.toLocaleDateString("fa-IR"), t.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })];
      }
    };
    app.innerHTML =
      '<a class="back" href="/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a>" +
      '<div class="page-head"><h1>پنل مدیریت</h1><button class="btn small ghost" id="admRef" type="button">' + REFRESH + " بروزرسانی</button></div>" +
      '<p class="muted">فهرست کاربرانی که در پازمونک ثبت‌نام کرده‌اند؛ تازه‌ترین‌ها بالاتر.</p>' +
      '<div class="adm-st" id="admSt" aria-live="polite"></div>' +
      '<div class="card adm-card"><div class="adm-search"><input type="text" id="admQ" inputmode="search" autocomplete="off" spellcheck="false" maxlength="80" placeholder="جستجو بر اساس نام، شماره یا ایمیل" aria-label="جستجو"></div>' +
      '<div id="admErr" class="err" role="alert" hidden></div>' +
      '<div id="admList" aria-live="polite"><p class="muted">در حال بارگذاری…</p></div>' +
      '<div class="adm-pager" id="admPager" hidden></div></div>' +
      '<div class="card adm-card" id="apCard"><h2 class="apay-h">پرداخت‌ها</h2><div class="adm-st apay-st" id="apSt"></div><div id="apList" aria-live="polite"><p class="muted">در حال بارگذاری…</p></div></div>';
    const $ = (id) => document.getElementById(id);
    const en = (v) => String(v).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

    const drawStats = (st) => {
      const it = [["کل کاربران", st.total], ["امروز", st.today], ["۷ روز اخیر", st.week], ["با شماره‌ی موبایل", st.phone], ["با ایمیل", st.email]];
      $("admSt").innerHTML = it.map((x) => "<div><b>" + faNum(x[1] || 0) + "</b><span>" + x[0] + "</span></div>").join("");
    };
    const rowHtml = (u, i) => {
      const d = fmtD(u.created_at);
      const nm = cleanName(u.name);
      return "<tr><td data-l=\"ردیف\" class=\"adm-i\">" + faNum(page * PER + i + 1) + "</td>" +
        '<td data-l="نام"><button class="adm-n adm-nb" type="button" data-id="' + esc(u.id) + '" title="آزمون‌های این کاربر"><span class="av-s" aria-hidden="true">' + esc(nm ? initialOf(nm) : "؟") + "</span><span>" + (nm ? esc(nm) : '<em class="muted">بدون نام</em>') + "</span></button></td>" +
        '<td data-l="موبایل">' + (u.phone ? "<span class=\"adm-ltr\">" + esc(showPhone(u.phone)) + "</span>" : '<span class="muted">—</span>') + "</td>" +
        '<td data-l="ایمیل">' + (u.email ? '<span class="adm-ltr adm-em" dir="ltr">' + esc(u.email) + "</span>" : '<span class="muted">—</span>') + "</td>" +
        '<td data-l="پولک"><span class="adm-tk">' + COIN + "<b>" + fmtN(u.tokens || 0) + '</b></span><button class="adm-tkb" type="button" data-id="' + esc(u.id) + '" aria-label="تغییر پولک' + (nm ? "؛ " + esc(nm) : "") + '" title="تغییر پولک">' + PENCIL + "</button></td>" +
        '<td data-l="تاریخ ثبت‌نام"><span>' + esc(d[0]) + '</span> <small class="muted">' + esc(d[1]) + "</small></td></tr>";
    };
    let rowsById = {};
    const drawList = (r) => {
      const rows = r.rows || [];
      rowsById = {};
      rows.forEach((u) => { if (u && u.id) rowsById[u.id] = u; });
      total = r.total || 0;
      const pages = Math.max(1, Math.ceil(total / PER));
      $("admList").innerHTML = rows.length
        ? '<div class="adm-tw"><table class="adm-t"><thead><tr><th>ردیف</th><th>نام</th><th>موبایل</th><th>ایمیل</th><th>پولک</th><th>تاریخ ثبت‌نام</th></tr></thead><tbody>' + rows.map(rowHtml).join("") + "</tbody></table></div>"
        : '<p class="muted adm-empty">' + (q ? "نتیجه‌ای پیدا نشد." : "هنوز کسی ثبت‌نام نکرده است.") + "</p>";
      const pg = $("admPager");
      pg.hidden = total <= PER;
      pg.innerHTML =
        '<button class="btn small ghost" type="button" id="admPrev"' + (page <= 0 ? " disabled" : "") + ">قبلی</button>" +
        "<span>صفحه‌ی " + faNum(page + 1) + " از " + faNum(pages) + (q ? " · " + faNum(total) + " نتیجه" : "") + "</span>" +
        '<button class="btn small ghost" type="button" id="admNext"' + (page >= pages - 1 ? " disabled" : "") + ">بعدی</button>";
      const go = (n) => { page = n; load(); const t = $("admQ"); if (t) t.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" }); };
      const pv = $("admPrev"), nx = $("admNext");
      if (pv) pv.addEventListener("click", () => go(page - 1));
      if (nx) nx.addEventListener("click", () => go(page + 1));
    };

    /* تغییر دستی پولک یک کاربر: افزودن، کم‌کردن یا تنظیم روی یک عدد */
    const openTok = (u) => {
      const prev = document.activeElement;
      let mode = "add";
      const cur = u.tokens || 0;
      const who = cleanName(u.name) || showPhone(u.phone || u.email || "");
      const ov = document.createElement("div");
      ov.className = "modal tk-modal";
      ov.innerHTML =
        '<div class="modal-box tk-box" role="dialog" aria-modal="true" aria-labelledby="tkmT">' +
        '<div class="modal-head"><h2 id="tkmT">پولک‌های <span id="tkmN"></span></h2></div>' +
        '<form class="modal-body" id="tkmF" novalidate>' +
        '<div class="tkm-cur">موجودی فعلی: <b>' + fmtN(cur) + "</b> پولک</div>" +
        '<div class="seg" role="group" aria-label="نوع تغییر"><button type="button" data-m="add" aria-pressed="true">افزودن</button><button type="button" data-m="sub" aria-pressed="false">کم کردن</button><button type="button" data-m="set" aria-pressed="false">تنظیم روی عدد</button></div>' +
        '<label for="tkmA">مقدار</label><input id="tkmA" type="text" inputmode="numeric" autocomplete="off" maxlength="7">' +
        '<div class="tkm-new" id="tkmNew" aria-live="polite"></div>' +
        '<div class="auth-msg" id="tkmMsg" role="alert"></div>' +
        '<div class="actions"><button class="btn ghost" type="button" id="tkmNo">انصراف</button><button class="btn" type="submit" id="tkmYes">ثبت</button></div></form></div>';
      document.body.appendChild(ov);
      ov.querySelector("#tkmN").textContent = who;
      const prevOv = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const A = ov.querySelector("#tkmA"), nw = ov.querySelector("#tkmNew"), mg = ov.querySelector("#tkmMsg"), yes = ov.querySelector("#tkmYes");
      const val = () => { const t = en(A.value).replace(/\D/g, ""); return t ? Math.min(parseInt(t.slice(0, 7), 10), 1000000) : null; };
      const paint = () => {
        const v = val();
        if (v == null) { nw.textContent = ""; return; }
        const nx = mode === "add" ? cur + v : mode === "sub" ? Math.max(cur - v, 0) : v;
        nw.innerHTML = "موجودی جدید: <b>" + fmtN(nx) + "</b> پولک";
      };
      let done = false;
      const close = () => {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("pz:nav", close);
        document.body.style.overflow = prevOv;
        ov.remove();
        if (prev && prev.isConnected) { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      };
      const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("pz:nav", close);
      ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
      ov.querySelector("#tkmNo").addEventListener("click", close);
      ov.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
        mode = b.dataset.m;
        ov.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        mg.textContent = ""; paint(); A.focus();
      }));
      A.addEventListener("input", () => { A.classList.remove("bad"); mg.textContent = ""; paint(); });
      ov.querySelector("#tkmF").addEventListener("submit", async (e) => {
        e.preventDefault();
        const v = val();
        if (v == null) { A.classList.add("bad"); mg.className = "auth-msg m-err"; mg.textContent = "مقدار را وارد کنید."; A.focus(); return; }
        yes.disabled = true; yes.classList.add("loading"); mg.textContent = "";
        let r = null, err = "";
        try { r = await rpc("admin_tokens", { p_token: tokenOf(), p_id: u.id, p_mode: mode, p_amount: v }); } catch (e2) { err = e2.message || "ذخیره نشد."; }
        if (done) return;
        yes.disabled = false; yes.classList.remove("loading");
        if (!r || r.ok !== true) { mg.className = "auth-msg m-err"; mg.textContent = err || "ذخیره نشد. دوباره تلاش کنید."; return; }
        close();
        if (window.__pzToast) window.__pzToast("موجودی شد " + faNum(r.tokens) + " پولک");
        tkSync(true);
        if (ok()) load();
      });
      setTimeout(() => { if (!done) { try { A.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 60);
    };
    /* آزمون‌هایی که یک کاربر ساخته (فقط خواندنی) */
    const openQuizzes = (u) => {
      const prev = document.activeElement;
      const nm = cleanName(u.name);
      const ov = document.createElement("div");
      ov.className = "modal";
      ov.innerHTML =
        '<div class="modal-box aq-box" role="dialog" aria-modal="true" aria-labelledby="aqT">' +
        '<div class="modal-head"><h2 id="aqT"></h2><small class="muted aq-sub"></small></div>' +
        '<div class="modal-body"><div id="aqList" aria-live="polite"><p class="muted">در حال بارگذاری…</p></div>' +
        '<div class="actions"><button class="btn ghost" type="button" id="aqNo">بستن</button></div></div></div>';
      document.body.appendChild(ov);
      ov.querySelector("#aqT").textContent = "آزمون‌های " + (nm || "این کاربر");
      ov.querySelector(".aq-sub").textContent = u.phone ? showPhone(u.phone) : (u.email || "");
      const prevOv = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      let done = false;
      const close = () => {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("pz:nav", close);
        document.body.style.overflow = prevOv;
        ov.remove();
        if (prev && prev.isConnected) { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      };
      const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("pz:nav", close);
      ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
      ov.querySelector("#aqNo").addEventListener("click", close);
      const box = ov.querySelector("#aqList");
      rpc("admin_user_quizzes", { p_token: tokenOf(), p_user: u.id }).then((r) => {
        if (done) return;
        if (!r || r.ok !== true) { box.innerHTML = '<p class="muted">بارگذاری ممکن نشد.</p>'; return; }
        const items = r.items || [];
        box.innerHTML = items.length ? items.map((x) => {
          const d = fmtD(x.created_at);
          return '<div class="aq-row"><div class="aq-t"><b>' + esc(x.title) + "</b><small>" + faNum(x.questions || 0) + " سؤال · " + faNum(x.participants || 0) + " شرکت‌کننده" +
            (x.group_name ? " · گروه «" + esc(x.group_name) + "»" : "") + " · " + esc(d[0]) + "</small></div>" +
            '<a class="btn small ghost" href="/q/' + encodeURIComponent(x.id) + '">باز کردن</a></div>';
        }).join("") + (r.total > items.length ? '<p class="muted aq-more">' + faNum(items.length) + " آزمونِ تازه از " + faNum(r.total) + "</p>" : "")
          : '<p class="muted">این کاربر هنوز آزمونی نساخته است.</p>';
      }).catch(() => { if (!done) box.innerHTML = '<p class="muted">بارگذاری ممکن نشد.</p>'; });
      setTimeout(() => { if (!done) { const b = ov.querySelector("#aqNo"); if (b) b.focus({ preventScroll: true }); } }, 60);
    };
    $("admList").addEventListener("click", (e) => {
      const b = e.target.closest(".adm-tkb");
      if (b) { const u = rowsById[b.dataset.id]; if (u) openTok(u); return; }
      const n = e.target.closest(".adm-nb");
      if (n) { const u = rowsById[n.dataset.id]; if (u) openQuizzes(u); }
    });


    const loadPay = async () => {
      let r;
      try { r = await rpc("admin_payments", { p_token: tokenOf(), p_limit: 30 }); } catch (e) { if (ok() && $("apList")) $("apList").innerHTML = '<p class="muted">بارگذاری پرداخت‌ها ممکن نشد.</p>'; return; }
      if (!ok() || !r || r.ok !== true || !$("apList")) return;
      const st = r.stats || {};
      $("apSt").innerHTML = [["پرداخت موفق", faNum(st.paid || 0)], ["مجموع فروش (تومان)", fmtN(st.sum || 0)]]
        .map((x) => "<div><b>" + x[1] + "</b><span>" + x[0] + "</span></div>").join("");
      const rows = r.rows || [];
      $("apList").innerHTML = rows.length ? rows.map((p) => {
        const d = fmtD(p.created_at), nm = cleanName(p.name);
        const who = nm || (p.phone ? showPhone(p.phone) : p.email || "—");
        return '<div class="apay-row"><div class="apay-u">' + esc(who) + "<small>" + esc(p.phone ? showPhone(p.phone) : p.email || "") + "</small></div>" +
          '<div class="apay-m">' + fmtN(p.tokens) + " پولک <small>· " + fmtN(p.amount) + " تومان</small><span class=\"apay-d\">" + d[0] + " · " + d[1] + (p.ref ? " · " + esc(p.ref) : "") + "</span></div>" +
          "</div>";
      }).join("") : '<p class="muted">هنوز پرداخت موفقی ثبت نشده است.</p>';
    };

    const load = async () => {
      const my = ++seq;
      const list = $("admList");
      if (list && loaded) list.classList.add("busy");
      let r;
      try {
        r = await rpc("admin_users", { p_token: tokenOf(), p_q: q || null, p_limit: PER, p_offset: page * PER });
      } catch (e) {
        if (my !== seq || !ok()) return;
        if (/forbidden|دسترسی مجاز نیست/.test(e.message)) { go("/", true); return; }
        if (list) list.classList.remove("busy");
        const er = $("admErr");
        if (!loaded) $("admList").innerHTML = "";
        er.hidden = false; er.textContent = e.message || "خطایی رخ داد.";
        return;
      }
      if (my !== seq || !ok()) return;
      if (!r || r.ok !== true) { go("/", true); return; }
      if (!(r.rows || []).length && page > 0 && r.total > 0) { page = 0; return load(); }
      loaded = true;
      $("admErr").hidden = true;
      if (list) list.classList.remove("busy");
      drawStats(r.stats || {});
      drawList(r);
    };

    $("admQ").addEventListener("input", (e) => {
      clearTimeout(timer);
      const v = cleanName(en(e.target.value));
      timer = setTimeout(() => { if (v === q) return; q = v; page = 0; load(); }, 300);
    });
    $("admRef").addEventListener("click", () => { load(); loadPay(); });
    load();
    loadPay();
    return () => { clearTimeout(timer); seq++; };
  }

  /* ---------- گروه‌ها ---------- */
  const GROUP_ID_RE = /^[0-9a-f]{8}$/;
  let createGroup = "";        /* گروهِ انتخاب‌شده برای ساخت آزمون ("" یعنی آزمون عمومی) */
  let groupsCache = null;      /* آخرین فهرست گروه‌ها (برای نام گروه) */
  const gcall = (name, args) => rpc(name, Object.assign({ p_token: tokenOf() }, args || {}));
  const withG = (href) => (createGroup ? href + (href.indexOf("?") < 0 ? "?" : "&") + "g=" + createGroup : href);
  const gInitial = (n) => { const c = Array.from(cleanName(n))[0]; return c ? c.toUpperCase() : "؟"; };
  const USERS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.2 19.5c.5-3.1 2.8-5 5.8-5s5.3 1.9 5.8 5"/><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M17.6 14.8c1.9.5 3.2 2.2 3.5 4.7"/></svg>';

  /* پنجره‌ی تأیید با دکمه‌ی «برگشت» (برای جلوگیری از اشتباه) */
  function askConfirm(o) {
    return new Promise((resolve) => {
      const prev = document.activeElement;
      const ov = document.createElement("div");
      ov.className = "modal confirm";
      ov.innerHTML =
        '<div class="modal-box confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="cfT" aria-describedby="cfD">' +
        '<h2 id="cfT"></h2><p id="cfD"></p>' +
        '<div class="actions"><button class="btn ghost" type="button" id="cfNo">برگشت</button><button class="btn' + (o.danger ? " danger" : "") + '" type="button" id="cfYes"></button></div></div>';
      document.body.appendChild(ov);
      ov.querySelector("#cfT").textContent = o.title;
      ov.querySelector("#cfD").textContent = o.text || "";
      ov.querySelector("#cfYes").textContent = o.yes || "تأیید";
      const prevOv = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("pz:nav", onHash);
        document.body.style.overflow = prevOv;
        ov.remove();
        if (prev && prev.isConnected && v !== "nav") { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
        resolve(v === true);
      };
      const onHash = () => finish("nav");
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); }
        else if (e.key === "Tab") {
          const b = [ov.querySelector("#cfNo"), ov.querySelector("#cfYes")];
          const i = b.indexOf(document.activeElement);
          e.preventDefault();
          b[(i + (e.shiftKey ? -1 : 1) + 2) % 2].focus();
        }
      };
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("pz:nav", onHash);
      ov.addEventListener("click", (e) => { if (e.target === ov) finish(false); });
      ov.querySelector("#cfNo").addEventListener("click", () => finish(false));
      ov.querySelector("#cfYes").addEventListener("click", () => finish(true));
      ov.querySelector("#cfNo").focus();
    });
  }

  /* ----- اعلان دعوت‌ها (نشان روی دکمه‌ی گروه‌ها + پیام داخل برنامه) ----- */
  const inv = { timer: 0, busy: false, seen: null };
  function setInviteBadge(n) {
    const b = document.getElementById("grpBadge");
    if (!b) return;
    b.hidden = !(n > 0);
    b.textContent = n > 99 ? "۹۹+" : faNum(n);
    const mb = document.getElementById("menuBtn");
    if (mb) { mb.classList.toggle("dot", n > 0); mb.setAttribute("aria-label", n > 0 ? "منو؛ " + faNum(n) + " دعوت جدید به گروه" : "منو"); }
    const g = document.getElementById("grpBtn");
    if (g) g.setAttribute("aria-label", n > 0 ? "گروه‌ها؛ " + faNum(n) + " دعوت جدید" : "گروه‌ها");
  }
  function inviteToast(text) {
    const box = document.getElementById("toasts");
    if (!box) return;
    const t = el("div", { class: "toast inv-toast", role: "alert" });
    t.appendChild(el("span", { text: text }));
    t.appendChild(el("a", { href: "/groups", text: "مشاهده", onclick: () => t.remove() }));
    t.appendChild(el("button", { type: "button", "aria-label": "بستن", html: ICONS.cross, onclick: () => t.remove() }));
    box.appendChild(t);
    setTimeout(() => t.remove(), 12000);
  }
  async function pollInvites() {
    if (inv.busy || !auth.get() || document.hidden) return;
    inv.busy = true;
    try {
      const r = await gcall("groups_mine");
      if (!auth.get()) return;
      const list = (r && Array.isArray(r.invites)) ? r.invites : [];
      if (r && Array.isArray(r.groups)) groupsCache = r.groups;
      setInviteBadge(list.length);
      const cur = auth.get() || {};
      const seenKey = "seenInv_" + (cur.phone || cur.email);
      if (!inv.seen) inv.seen = new Set(store.get(seenKey, []));
      const fresh = list.filter((x) => !inv.seen.has(x.group_id));
      if (fresh.length) {
        fresh.forEach((x) => inv.seen.add(x.group_id));
        store.set(seenKey, Array.from(inv.seen).slice(-200));
        if (!/^\/groups/.test(location.pathname)) {
          inviteToast(fresh.length === 1 ? "دعوت جدید به گروه «" + fresh[0].group_name + "»" : faNum(fresh.length) + " دعوت جدید به گروه دارید");
        }
      }
    } catch (e) { /* اتصال ضعیف؛ دفعه‌ی بعد */ } finally { inv.busy = false; }
  }
  function syncInviteWatch() {
    clearInterval(inv.timer);
    inv.timer = 0;
    inv.seen = null;
    const g = document.getElementById("grpBtn");
    if (g) g.hidden = !auth.get();
    adminSync();
    tkSync(true);
    if (!auth.get()) { setInviteBadge(0); groupsCache = null; return; }
    pollInvites();
    inv.timer = setInterval(pollInvites, 45000);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pollInvites(); });
  window.addEventListener("focus", () => pollInvites());

  async function ensureGroups(force) {
    if (groupsCache && !force) return groupsCache;
    const r = await gcall("groups_mine");
    groupsCache = (r && Array.isArray(r.groups)) ? r.groups : [];
    setInviteBadge(r && Array.isArray(r.invites) ? r.invites.length : 0);
    return groupsCache;
  }
  const groupName = (id) => { const g = (groupsCache || []).find((x) => x.id === id); return g ? g.name : ""; };
  const ROLE_FA = { owner: "مالک", manager: "مدیر", member: "عضو" };
  const grpMeta = (g) => (ROLE_FA[g.role] || "عضو") + " · " + faNum(g.members) + " عضو · " + faNum(g.quizzes) + " آزمون";

  /* ---------- صفحه‌ی گروه‌ها ---------- */
  function viewGroups(token) {
    setTitle("گروه‌ها");
    let data = null;
    let showForm = false;
    const ok = () => token === routeToken;

    const load = async (soft) => {
      if (!soft) app.innerHTML = '<p class="muted">در حال بارگذاری…</p>';
      try {
        data = await gcall("groups_mine");
      } catch (e) {
        if (!ok()) return;
        if (!soft) return showError(e.message, () => load(false));
        return;
      }
      if (!ok()) return;
      groupsCache = data.groups || [];
      setInviteBadge((data.invites || []).length);
      draw("");
    };

    const draw = (errMsg) => {
      const invs = data.invites || [];
      const gs = data.groups || [];
      app.innerHTML =
        '<a class="back" href="/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a>" +
        '<div class="page-head"><h1>گروه‌ها</h1><button class="btn small" id="newGrp" type="button" aria-expanded="' + showForm + '">' + ICONS.plus + " گروه جدید</button></div>" +
        '<p class="muted">در گروه می‌توانید آزمونی بسازید که فقط اعضای همان گروه آن را ببینند و بدهند.</p>' +
        (errMsg ? '<div class="err" role="alert">' + esc(errMsg) + "</div>" : "") +
        '<div id="newBox"></div>' +
        (invs.length
          ? '<div class="card"><div class="sec-t"><h2>دعوت‌ها</h2><span class="badge">' + faNum(invs.length) + "</span></div>" +
            invs.map((x) =>
              '<div class="grp-row"><span class="av-s" aria-hidden="true">' + esc(gInitial(x.group_name)) + '</span><div class="grp-t"><strong>' + esc(x.group_name) + "</strong><small>دعوت از طرف " + esc(x.from_name) + "</small></div>" +
              '<div class="grp-a"><button class="btn small" type="button" data-act="acc" data-g="' + esc(x.group_id) + '">پذیرفتن</button>' +
              '<button class="btn small ghost" type="button" data-act="rej" data-g="' + esc(x.group_id) + '">رد کردن</button></div></div>'
            ).join("") + "</div>"
          : "") +
        (gs.length
          ? '<div class="card"><div class="sec-t"><h2>گروه‌های من</h2></div>' +
            gs.map((g) =>
              '<a class="grp-row" href="/g/' + esc(g.id) + '"><span class="av-s" aria-hidden="true">' + esc(gInitial(g.name)) + '</span><div class="grp-t"><strong>' + esc(g.name) + "</strong><small>" + esc(grpMeta(g)) + "</small></div>" + '<span class="grp-go">' + ICONS.back + "</span></a>"
            ).join("") + "</div>"
          : '<div class="card empty">' + USERS_ICON.replace("<svg", '<svg width="54" height="54"') + "<h2>هنوز در هیچ گروهی نیستید</h2>" +
            '<p class="muted">یک گروه بسازید و شماره‌ی دوستان یا دانش‌آموزهایتان را دعوت کنید. یا منتظر دعوت بمانید.</p></div>');
      if (showForm) drawForm();
      app.querySelector("#newGrp").addEventListener("click", () => { showForm = !showForm; draw(""); if (showForm) { const i = document.getElementById("gName"); if (i) i.focus(); } });
    };

    const drawForm = () => {
      const box = document.getElementById("newBox");
      box.innerHTML =
        '<div class="card"><h2>گروه جدید</h2><label for="gName">نام گروه</label>' +
        '<input id="gName" type="text" maxlength="60" autocomplete="off" placeholder="مثلاً: کلاس نهم ۲">' +
        '<div id="gMsg"></div><div class="actions"><button class="btn ghost" type="button" id="gBack">برگشت</button><button class="btn" type="button" id="gMake">ساخت گروه</button></div></div>';
      const inp = document.getElementById("gName"), mk = document.getElementById("gMake"), msg = document.getElementById("gMsg");
      document.getElementById("gBack").addEventListener("click", () => { showForm = false; draw(""); });
      const make = async () => {
        const nm = cleanName(inp.value);
        if (nm.length < 2) { msg.innerHTML = '<div class="err" role="alert">نام گروه را بنویسید (حداقل ۲ حرف).</div>'; inp.focus(); return; }
        mk.disabled = true; mk.classList.add("loading"); msg.innerHTML = "";
        try {
          const r = await gcall("group_create", { p_name: nm });
          groupsCache = null;
          if (r && r.id) go("/g/" + r.id); else { showForm = false; load(true); }
        } catch (e) {
          if (!ok()) return;
          mk.disabled = false; mk.classList.remove("loading");
          msg.innerHTML = '<div class="err" role="alert">' + esc(e.message) + "</div>";
        }
      };
      mk.addEventListener("click", make);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); make(); } });
    };

    app.addEventListener("click", onClick);
    async function onClick(e) {
      const b = e.target.closest("button[data-act]");
      if (!b || !app.contains(b)) return;
      const gid = b.dataset.g;
      const item = (data.invites || []).find((x) => x.group_id === gid);
      if (!item) return;
      const accept = b.dataset.act === "acc";
      const yes = await askConfirm(accept
        ? { title: "عضو گروه «" + item.group_name + "» شوید؟", text: "با پذیرفتن، آزمون‌های این گروه را می‌بینید و می‌توانید در آن‌ها شرکت کنید. مدیر گروه نام و شماره‌ی شما را می‌بیند.", yes: "بله، عضو می‌شوم" }
        : { title: "دعوت رد شود؟", text: "دعوت به گروه «" + item.group_name + "» رد می‌شود و پاک می‌شود. برای عضویت دوباره، باید دوباره دعوتتان کنند.", yes: "بله، رد کن", danger: true });
      if (!yes || !ok()) return;
      b.disabled = true; b.classList.add("loading");
      try {
        await gcall("group_invite_respond", { p_group: gid, p_accept: accept });
        if (!ok()) return;
        groupsCache = null;
        await load(true);
        if (ok() && window.__pzToast) window.__pzToast(accept ? "به گروه پیوستید ✓" : "دعوت رد شد");
      } catch (err) {
        if (!ok()) return;
        await load(true);
        if (ok()) draw(err.message);
      }
    }

    load(false);
    return function cleanup() { app.removeEventListener("click", onClick); };
  }

  /* ---------- گپ گروه ---------- */
  const CHAT_MAX = 2000;      /* حداکثر حرف هر پیام (هم‌خوان با سرور) */
  const CHAT_KEEP = 400;      /* تعداد پیام نگه‌داشته‌شده در صفحه بعد از پاک‌سازی */
  const CHAT_TRIM = 600;      /* از این تعداد بیشتر شد، پیام‌های قدیمیِ صفحه حذف می‌شوند */
  const svgI = (d, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  const CI = {
    send: svgI('<path d="M21 3 10.5 13.5"/><path d="m21 3-6.5 18-4-7.5L3 9.5z"/>'),
    reply: svgI('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/>'),
    copy: svgI('<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>'),
    edit: svgI('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
    trash: svgI('<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>'),
    close: svgI('<path d="M6 6l12 12M18 6 6 18"/>', 2.4),
    down: svgI('<path d="M12 5v14M5 12l7 7 7-7"/>', 2.4),
  };
  let chatFmt = null;
  function chatFmts() {
    if (chatFmt) return chatFmt;
    const mk = (o) => { try { return new Intl.DateTimeFormat("fa-IR", o); } catch (e) { return new Intl.DateTimeFormat(undefined, o); } };
    chatFmt = { time: mk({ hour: "2-digit", minute: "2-digit" }), day: mk({ weekday: "long", day: "numeric", month: "long" }), dayY: mk({ weekday: "long", day: "numeric", month: "long", year: "numeric" }) };
    return chatFmt;
  }
  const dayNum = (d) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) { /* روش جایگزین */ }
    try {
      const a = el("textarea", { readonly: true, style: "position:fixed;top:0;opacity:0;pointer-events:none", value: t });
      document.body.appendChild(a);
      a.select();
      a.setSelectionRange(0, t.length);
      const done = document.execCommand("copy");
      a.remove();
      return !!done;
    } catch (e) { return false; }
  }

  /* گپ گروه؛ o = { gid, toast, draft, onDraft }؛ تابع پاک‌سازی برمی‌گرداند */
  function mountChat(box, o) {
    const gid = o.gid, F = chatFmts();
    const msgs = [], byId = new Map(), nodes = new Map(), pend = [];
    let rev = 0, more = false, ready = false, dead = false, fails = 0, idle = 0, sending = 0, busyOlder = false, inflight = false;
    let timer = 0, replyTo = null, editing = null, menuEl = null, menuFor = 0, unseen = 0, lp = null, lpBlock = 0;
    const fine = window.matchMedia("(pointer: fine)");

    box.innerHTML =
      '<div class="chat">' +
      '<div class="chat-list" role="log" aria-label="پیام‌های گروه" tabindex="0"><div class="chat-more" hidden></div><div class="chat-state"></div><div class="chat-msgs"></div></div>' +
      '<button type="button" class="chat-new" hidden></button>' +
      '<div class="chat-net" role="status" hidden>ارتباط قطع است؛ دوباره تلاش می‌کنیم…</div>' +
      '<div class="chat-ctx" hidden><span class="chat-ctx-i" aria-hidden="true"></span><div class="chat-ctx-t"><b></b><span></span></div><button type="button" class="chat-ctx-x" aria-label="لغو">' + CI.close + "</button></div>" +
      '<form class="chat-in" autocomplete="off"><textarea rows="1" maxlength="' + CHAT_MAX + '" dir="auto" enterkeyhint="send" placeholder="پیام بنویسید…" aria-label="متن پیام"></textarea>' +
      '<button class="chat-send" type="submit" aria-label="ارسال" disabled>' + CI.send + "</button></form>" +
      '<div class="chat-cnt" hidden></div></div>';
    const q = (s) => box.querySelector(s);
    const list = q(".chat-list"), wrap = q(".chat-msgs"), moreBox = q(".chat-more"), stateEl = q(".chat-state"), newBtn = q(".chat-new"), net = q(".chat-net");
    const ctx = q(".chat-ctx"), ctxI = q(".chat-ctx-i"), ctxT = q(".chat-ctx-t b"), ctxS = q(".chat-ctx-t span"), form = q(".chat-in"), ta = q("textarea"), sendBtn = q(".chat-send"), cnt = q(".chat-cnt");
    ta.value = o.draft || "";

    const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 90;
    const toBottom = () => { list.scrollTop = list.scrollHeight; unseen = 0; newBtn.hidden = true; };
    const keepBottom = (fn) => { const nb = nearBottom(); fn(); if (nb) toBottom(); };
    const prep = (m) => { m._d = new Date(m.created_at); m._k = dayNum(m._d); return m; };
    const quote = (r) => { const f = byId.get(r.id); return f ? f : r; };

    function dayLabel(d) {
      const t = new Date(), k = dayNum(d);
      if (k === dayNum(t)) return "امروز";
      if (k === dayNum(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1))) return "دیروز";
      return (d.getFullYear() === t.getFullYear() ? F.day : F.dayY).format(d);
    }
    const daySep = (m) => el("div", { class: "cday" }, [el("span", { text: dayLabel(m._d) })]);

    function build(m, prev) {
      const cont = !!prev && prev._k === m._k && prev.u === m.u && m._d - prev._d < 600000;
      const kids = [];
      if (!m.mine && !cont) kids.push(el("div", { class: "cn" }, [el("span", { text: m.name }), (m.owner || m.manager) ? el("span", { class: "cbadge", text: m.owner ? "مالک" : "مدیر" }) : null]));
      if (m.reply && !m.deleted) {
        const r = quote(m.reply);
        kids.push(el("div", { class: "cq", "data-q": m.reply.id }, [el("b", { text: r.name }), el("span", { text: r.deleted ? "پیام حذف شده" : r.body })]));
      }
      kids.push(el("div", { class: "ct", dir: "auto", text: m.deleted ? "این پیام حذف شد" : m.body }));
      kids.push(el("div", { class: "cf" }, [
        m.edited && !m.deleted ? el("span", { text: "ویرایش‌شده" }) : null,
        m.pending ? el("span", { text: "در حال ارسال…" }) : el("time", { datetime: m.created_at, text: F.time.format(m._d) }),
      ]));
      return el("div", { class: "cm " + (m.mine ? "me" : "ot") + (cont ? " cont" : "") + (m.pending ? " pending" : ""), "data-id": m.pending ? null : m.id }, [el("div", { class: "cb" + (m.deleted ? " del" : ""), tabindex: "-1" }, kids)]);
    }

    function appendNode(m, prev) {
      const frag = document.createDocumentFragment();
      if (!prev || prev._k !== m._k) frag.appendChild(daySep(m));
      const n = build(m, prev);
      n.classList.add("in");
      nodes.set(m.id, n);
      frag.appendChild(n);
      wrap.insertBefore(frag, pend[0] || null);
    }

    function renderAll() {
      const frag = document.createDocumentFragment();
      nodes.clear();
      msgs.forEach((m, i) => {
        const prev = msgs[i - 1];
        if (!prev || prev._k !== m._k) frag.appendChild(daySep(m));
        const n = build(m, prev);
        nodes.set(m.id, n);
        frag.appendChild(n);
      });
      pend.forEach((n) => frag.appendChild(n));
      wrap.textContent = "";
      wrap.appendChild(frag);
      closeMenu();
      renderMore();
      showState(ready && !msgs.length && !pend.length ? "empty" : "");
    }

    function refreshNode(m) {
      const old = nodes.get(m.id);
      if (!old) return;
      const nw = build(m, msgs[msgs.indexOf(m) - 1]);
      const had = old.contains(document.activeElement);
      old.replaceWith(nw);
      nodes.set(m.id, nw);
      if (had) nw.firstChild.focus({ preventScroll: true });
      if (menuFor === m.id) closeMenu();
    }

    function showState(kind, msg) {
      stateEl.textContent = "";
      stateEl.hidden = !kind;
      if (!kind) return;
      if (kind === "loading") stateEl.textContent = "در حال بارگذاری گپ…";
      else if (kind === "empty") stateEl.textContent = "هنوز پیامی نیست. اولین پیام را شما بنویسید.";
      else stateEl.append(el("span", { text: msg }), el("button", { class: "btn small ghost", type: "button", text: "تلاش دوباره", onclick: load }));
    }

    function renderMore() {
      moreBox.textContent = "";
      moreBox.hidden = !more;
      if (more) moreBox.appendChild(el("button", { class: "btn small ghost", type: "button", text: "پیام‌های قدیمی‌تر", onclick: older }));
    }

    /* ---- ورود پیام‌های تازه یا تغییریافته ---- */
    function ingest(arr, force) {
      const wasNear = nearBottom();
      let added = 0, others = 0, full = false;
      for (const raw of arr) {
        const old = byId.get(raw.id);
        if (old) {
          if (raw.rev > old.rev) {
            Object.assign(old, prep(raw));
            refreshNode(old);
            msgs.forEach((x) => { if (x.reply && x.reply.id === old.id) refreshNode(x); });
            if (editing && editing.id === old.id && old.deleted) cancelCtx(true);
          }
          continue;
        }
        if (msgs.length && raw.id < msgs[0].id) continue;   /* مربوط به تاریخچه‌ی بارگذاری‌نشده است */
        const m = prep(raw);
        const last = msgs[msgs.length - 1];
        if (last && m.id < last.id) full = true;
        msgs.push(m);
        byId.set(m.id, m);
        added++;
        if (!m.mine) others++;
        if (!full) appendNode(m, msgs[msgs.length - 2]);
      }
      if (!ready) return;
      if (full) { msgs.sort((a, b) => a.id - b.id); renderAll(); }
      if (added) showState("");
      if (force || wasNear) toBottom();
      else if (others) { unseen += others; newBtn.hidden = false; newBtn.querySelector("span").textContent = unseen > 1 ? faNum(unseen) + " پیام جدید" : "پیام جدید"; }
      if (msgs.length > CHAT_TRIM && (force || wasNear)) {
        msgs.splice(0, msgs.length - CHAT_KEEP).forEach((d) => byId.delete(d.id));
        more = true;
        renderAll();
        toBottom();
      }
    }

    /* ---- پیام‌های پاک‌شده: از صفحه برداشته می‌شوند و هیچ ردی نمی‌ماند ---- */
    function removeMsgs(ids) {
      let touched = false;
      for (const id of ids) {
        const i = msgs.findIndex((x) => x.id === id);
        if (i < 0) continue;
        touched = true;
        const n = nodes.get(id), prev = msgs[i - 1], next = msgs[i + 1];
        if (n) {
          const sep = n.previousElementSibling;
          if (sep && sep.classList.contains("cday")) sep.remove();
          n.remove();
        }
        nodes.delete(id); byId.delete(id);
        msgs.splice(i, 1);
        if (menuFor === id) closeMenu();
        if (editing && editing.id === id) cancelCtx(true);
        if (replyTo && replyTo.id === id) { replyTo = null; syncCtx(); }
        if (next) {
          const nn = nodes.get(next.id);
          if (nn && (!prev || prev._k !== next._k) && !(nn.previousElementSibling && nn.previousElementSibling.classList.contains("cday"))) wrap.insertBefore(daySep(next), nn);
          refreshNode(next);
        }
      }
      if (!touched) return;
      msgs.forEach((x) => { if (x.reply && ids.indexOf(x.reply.id) >= 0) { x.reply = null; refreshNode(x); } });
      if (ready && !msgs.length && !pend.length) showState("empty");
    }

    /* ---- خطاهایی که یعنی دیگر به گروه دسترسی ندارید ---- */
    function fatal(e) {
      if (!/این گروه پیدا نشد|دوباره وارد شوید/.test(e.message)) return false;
      dead = true;
      clearTimeout(timer);
      o.toast(/گروه/.test(e.message) ? "دیگر عضو این گروه نیستید." : e.message);
      go("/groups");
      return true;
    }

    /* ---- بارگذاری اولیه و قدیمی‌ترها ---- */
    async function load() {
      showState("loading");
      try {
        const r = await gcall("chat_list", { p_group: gid, p_limit: 40 });
        if (dead) return;
        msgs.length = 0; byId.clear();
        r.messages.forEach((m) => { prep(m); msgs.push(m); byId.set(m.id, m); });
        rev = r.rev; more = !!r.more; ready = true;
        renderAll();
        toBottom();
        sync();
        schedule(delay());
      } catch (e) {
        if (dead || fatal(e)) return;
        showState("error", e.message);
      }
    }

    async function older() {
      if (busyOlder || !more || !msgs.length || dead) return;
      busyOlder = true;
      const b = moreBox.querySelector("button");
      if (b) { b.disabled = true; b.classList.add("loading"); }
      try {
        const r = await gcall("chat_list", { p_group: gid, p_before: msgs[0].id, p_limit: 40 });
        if (dead) return;
        const fresh = r.messages.filter((m) => !byId.has(m.id)).map(prep);
        fresh.forEach((m) => byId.set(m.id, m));
        msgs.unshift(...fresh);
        more = !!r.more;
        const h = list.scrollHeight, t = list.scrollTop;
        renderAll();
        list.scrollTop = t + (list.scrollHeight - h);
      } catch (e) {
        if (dead || fatal(e)) return;
        o.toast(e.message);
        renderMore();
      } finally { busyOlder = false; }
    }

    /* ---- نظرسنجیِ پیام‌های تازه (کُندتر می‌شود وقتی خبری نیست) ---- */
    const delay = () => (idle < 20 ? 3000 : idle < 60 ? 6000 : 10000);
    function schedule(ms) { clearTimeout(timer); if (!dead) timer = setTimeout(tick, ms); }
    async function tick() {
      timer = 0;
      if (dead || !ready || document.hidden) return;
      if (sending || inflight) return schedule(500);
      inflight = true;
      let next = delay();
      try {
        const r = await gcall("chat_list", { p_group: gid, p_since: rev });
        if (dead) return;
        fails = 0; net.hidden = true;
        if (r.rev > rev) rev = r.rev;
        const gone = r.gone || [];
        if (r.messages.length || gone.length) {
          idle = 0;
          const wasNear = nearBottom();
          if (r.messages.length) ingest(r.messages, false);
          if (gone.length) { removeMsgs(gone); if (wasNear) toBottom(); }
          if (r.messages.length >= 200) next = 200;
        } else idle++;
      } catch (e) {
        if (dead || fatal(e)) return;
        fails++;
        if (fails >= 2) net.hidden = false;
        next = Math.min(3000 * Math.pow(2, fails), 20000);
      } finally { inflight = false; }
      schedule(next);
    }
    const onVis = () => { if (!document.hidden && ready) { idle = 0; schedule(0); } };
    const onOnline = () => { if (ready) schedule(0); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);

    /* ---- نوشتن، ارسال، ویرایش ---- */
    function sync() {
      sendBtn.disabled = !ready || !ta.value.trim();
      const n = ta.value.length;
      cnt.hidden = n < 1700;
      if (!cnt.hidden) cnt.textContent = faNum(n) + " / " + faNum(CHAT_MAX);
    }
    function autosize() {
      keepBottom(() => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, 132) + "px"; });
    }
    function syncCtx() {
      const m = editing || replyTo;
      keepBottom(() => {
        ctx.hidden = !m;
        if (!m) return;
        ctxI.innerHTML = editing ? CI.edit : CI.reply;
        ctxT.textContent = editing ? "ویرایش پیام" : "پاسخ به " + m.name;
        ctxS.textContent = m.deleted ? "پیام حذف شده" : m.body;
      });
      ta.setAttribute("aria-label", editing ? "ویرایش پیام" : "متن پیام");
      sendBtn.setAttribute("aria-label", editing ? "ذخیره‌ی ویرایش" : "ارسال");
    }
    function cancelCtx(clear) {
      const wasEdit = !!editing;
      editing = null; replyTo = null;
      if (wasEdit || clear) { ta.value = ""; o.onDraft(""); }
      syncCtx(); autosize(); sync();
    }
    function setReply(m) {
      if (editing) { editing = null; ta.value = ""; }
      replyTo = m;
      syncCtx(); autosize(); sync();
      ta.focus({ preventScroll: true });
    }
    function startEdit(m) {
      replyTo = null; editing = m;
      ta.value = m.body;
      syncCtx(); autosize(); sync();
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }

    async function submit() {
      const text = ta.value.trim();
      if (!text || !ready || dead) return;
      if (editing) return saveEdit(text);
      const rp = replyTo;
      const p = prep({ id: 0, mine: true, body: text, pending: true, reply: rp ? { id: rp.id, name: rp.name, body: rp.body, deleted: rp.deleted } : null, created_at: new Date().toISOString() });
      const node = build(p, msgs[msgs.length - 1]);
      pend.push(node);
      wrap.appendChild(node);
      showState("");
      ta.value = ""; o.onDraft("");
      replyTo = null;
      syncCtx(); autosize(); sync();
      toBottom();
      sending++;
      try {
        const m = await gcall("chat_send", { p_group: gid, p_body: text, p_reply: rp ? rp.id : null });
        pend.splice(pend.indexOf(node), 1); node.remove();
        if (dead) return;
        ingest([m], true);
        idle = 0;
        schedule(1500);
      } catch (e) {
        pend.splice(pend.indexOf(node), 1); node.remove();
        if (dead || fatal(e)) return;
        if (!ta.value && !editing) { ta.value = text; o.onDraft(text); if (rp && byId.has(rp.id)) replyTo = rp; syncCtx(); autosize(); sync(); }
        showState(ready && !msgs.length && !pend.length ? "empty" : "");
        o.toast(e.message);
      } finally { sending--; }
    }

    async function saveEdit(text) {
      const m = editing;
      if (text === m.body) { cancelCtx(false); return; }
      sendBtn.disabled = true;
      sending++;
      try {
        const r = await gcall("chat_edit", { p_msg: m.id, p_body: text });
        if (dead) return;
        if (editing === m) cancelCtx(false);
        ingest([r], false);
      } catch (e) {
        if (dead || fatal(e)) return;
        o.toast(e.message);
        sync();
      } finally { sending--; }
    }

    async function del(m) {
      if (!(await askConfirm({ title: "این پیام حذف شود؟", text: "پیام برای همه‌ی اعضای گروه حذف می‌شود و برگشت ندارد.", yes: "بله، حذف کن", danger: true })) || dead) return;
      sending++;
      try {
        const r = await gcall("chat_delete", { p_msg: m.id });
        if (dead) return;
        keepBottom(() => removeMsgs([r.id]));
      } catch (e) {
        if (dead || fatal(e)) return;
        o.toast(e.message);
      } finally { sending--; }
    }

    /* ---- منوی کلیک راست / نگه داشتن ---- */
    function closeMenu() {
      if (!menuEl) return;
      const b = nodes.get(menuFor);
      if (b) b.firstChild.classList.remove("sel");
      menuEl.remove();
      menuEl = null; menuFor = 0;
    }
    function openMenu(m, x, y, fromKey) {
      if (m.deleted || m.pending || dead) return;
      if (menuEl && menuFor === m.id) return;
      closeMenu();
      const bub = nodes.get(m.id).firstChild;
      const sel = window.getSelection ? window.getSelection() : null;
      const selText = sel && !sel.isCollapsed && bub.contains(sel.anchorNode) ? String(sel).trim() : "";
      const items = [["reply", "پاسخ", CI.reply], ["copy", "کپی", CI.copy]];
      if (m.mine) items.push(["edit", "ویرایش", CI.edit], ["del", "حذف", CI.trash]);
      menuEl = el("div", { class: "cmenu", role: "menu", "aria-label": "گزینه‌های پیام" },
        items.map((it) => el("button", { type: "button", role: "menuitem", class: it[0] === "del" ? "dng" : "", "data-a": it[0], html: it[2] + "<span>" + it[1] + "</span>" })));
      document.body.appendChild(menuEl);
      menuFor = m.id;
      bub.classList.add("sel");
      const w = menuEl.offsetWidth, h = menuEl.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      menuEl.style.left = Math.max(8, Math.min(x, vw - w - 8)) + "px";
      menuEl.style.top = Math.max(8, y + h + 8 > vh ? y - h : y) + "px";
      menuEl.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-a]");
        if (!b) return;
        const a = b.dataset.a;
        closeMenu();
        if (a === "reply") setReply(m);
        else if (a === "edit") startEdit(m);
        else if (a === "del") del(m);
        else copyText(selText || m.body).then((ok) => o.toast(ok ? "کپی شد ✓" : "کپی نشد؛ متن را دستی انتخاب کنید."));
      });
      menuEl.addEventListener("keydown", (e) => {
        const bs = Array.from(menuEl.querySelectorAll("button")), i = bs.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
        else if (e.key === "Home") { e.preventDefault(); bs[0].focus(); }
        else if (e.key === "End") { e.preventDefault(); bs[bs.length - 1].focus(); }
        else if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          closeMenu();
          bub.focus({ preventScroll: true });
        }
      });
      menuEl.querySelector("button").focus({ preventScroll: true });
      if (fromKey) menuEl.classList.add("kb");
    }
    const msgOf = (t) => { const r = t.closest && t.closest(".cm[data-id]"); return r && list.contains(r) ? byId.get(+r.dataset.id) : null; };
    const onDocDown = (e) => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); };
    document.addEventListener("pointerdown", onDocDown, true);
    window.addEventListener("resize", closeMenu);

    list.addEventListener("contextmenu", (e) => {
      const m = msgOf(e.target);
      if (!m || m.deleted) return;
      e.preventDefault();
      cancelLP();
      openMenu(m, e.clientX, e.clientY, false);
    });
    function cancelLP() { if (lp) { clearTimeout(lp.t); lp = null; } }
    list.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" || e.button) return;
      const m = msgOf(e.target);
      cancelLP();
      if (!m || m.deleted) return;
      const x = e.clientX, y = e.clientY;
      lp = { x, y, t: setTimeout(() => { lp = null; lpBlock = Date.now() + 700; openMenu(m, x, y, false); }, 450) };
    });
    list.addEventListener("pointermove", (e) => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) cancelLP(); });
    ["pointerup", "pointercancel"].forEach((t) => list.addEventListener(t, cancelLP));
    list.addEventListener("scroll", () => {
      cancelLP();
      if (menuEl) closeMenu();
      if (!newBtn.hidden && nearBottom()) { unseen = 0; newBtn.hidden = true; }
    }, { passive: true });

    list.addEventListener("keydown", (e) => {
      const bub = e.target.closest && e.target.closest(".cb");
      if (bub && list.contains(bub)) {
        const row = bub.parentNode;
        if (e.key === "Enter" || e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
          const m = byId.get(+row.dataset.id), r = bub.getBoundingClientRect();
          if (m && !m.deleted) { e.preventDefault(); openMenu(m, r.left + r.width / 2, r.top + r.height / 2, true); }
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          let n = row;
          do { n = e.key === "ArrowUp" ? n.previousElementSibling : n.nextElementSibling; } while (n && !n.classList.contains("cm"));
          if (n) n.firstChild.focus();
        }
      } else if (e.target === list && e.key === "ArrowUp") {
        const last = wrap.querySelector(".cm:last-child .cb");
        if (last) { e.preventDefault(); last.focus(); }
      }
    });

    function jumpTo(id) {
      const n = nodes.get(id);
      if (!n) { o.toast("پیام اصلی در بخش بالاتر است؛ «پیام‌های قدیمی‌تر» را بزنید."); return; }
      n.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" });
      n.classList.add("flash");
      setTimeout(() => n.classList.remove("flash"), 1300);
    }
    list.addEventListener("click", (e) => {
      if (Date.now() < lpBlock) return;
      const c = e.target.closest(".cq");
      if (c && list.contains(c)) jumpTo(+c.dataset.q);
    });

    newBtn.innerHTML = CI.down + "<span></span>";
    newBtn.addEventListener("click", toBottom);
    q(".chat-ctx-x").addEventListener("click", () => { cancelCtx(false); ta.focus({ preventScroll: true }); });
    form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
    ta.addEventListener("input", () => { if (!editing) o.onDraft(ta.value); autosize(); sync(); });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && fine.matches) { e.preventDefault(); submit(); }
      else if (e.key === "Escape" && (editing || replyTo)) { e.preventDefault(); cancelCtx(false); }
    });

    sync(); autosize();
    load();

    return function unmount() {
      dead = true;
      clearTimeout(timer);
      cancelLP();
      closeMenu();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("pointerdown", onDocDown, true);
      window.removeEventListener("resize", closeMenu);
    };
  }

  /* ---------- صفحه‌ی یک گروه ---------- */
  function viewGroup(gid, token) {
    setTitle("گروه");
    let g = null;
    let tab = "quizzes";
    let phoneVal = "";
    let editName = false;
    let chatOff = null;       /* بستن گپِ باز */
    let chatDraft = "";       /* پیش‌نویسِ گپ؛ با ساخت دوباره‌ی صفحه نمی‌پرد */
    const ok = () => token === routeToken;
    const toast = (m) => { if (window.__pzToast) window.__pzToast(m); };

    const load = async (soft) => {
      if (!soft) app.innerHTML = '<p class="muted">در حال بارگذاری…</p>';
      try { g = await gcall("group_get", { p_group: gid }); }
      catch (e) { if (!ok()) return; if (!soft) return showError(e.message, () => load(false)); return; }
      if (!ok()) return;
      setTitle(g.name);
      draw("");
    };

    const owner = () => g && g.role === "owner";
    const staff = () => g && (g.role === "owner" || g.role === "manager");

    const quizzesTab = () => {
      const qs = g.quizzes || [];
      return (staff() ? '<div class="actions" style="margin-top:6px"><a class="btn" href="/create?g=' + esc(g.id) + '">' + ICONS.plus + " آزمون جدید برای این گروه</a></div>" : "") +
        '<div class="card">' +
        (qs.length
          ? qs.map((q) =>
              '<div class="mine-row"><span class="mine-t">' + esc(q.title) + (staff() && q.participants != null ? '<small class="mine-n">' + faNum(q.participants) + " شرکت‌کننده</small>" : "") + "</span>" +
              (staff()
                ? '<a class="btn small ghost" href="/q/' + encodeURIComponent(q.id) + '">باز کردن</a>' + (q.secret ? '<a class="btn small" href="/m/' + encodeURIComponent(q.id) + '">نتایج</a>' : "")
                : '<a class="btn small" href="/q/' + encodeURIComponent(q.id) + '">شروع آزمون</a>') + "</div>"
            ).join("")
          : '<p class="muted" style="margin:0">' + (staff() ? "هنوز آزمونی برای این گروه نساخته‌اید. با دکمه‌ی بالا اولین آزمون را بسازید." : "هنوز آزمونی در این گروه نیست. وقتی مالک یا مدیر آزمون بسازد، اینجا می‌بینید.") + "</p>") +
        "</div>";
    };

    const membersTab = () => {
      const ms = g.members || [];
      const pend = g.invites || [];
      return (staff()
          ? '<div class="card"><h2>دعوت با شماره‌ی موبایل یا ایمیل</h2><p class="hint" style="margin-top:0">شخص فوراً عضو نمی‌شود؛ دعوت را داخل پازمونک می‌بیند و خودش می‌پذیرد یا رد می‌کند.</p>' +
            '<div class="grp-add"><input id="gPhone" type="text" inputmode="email" dir="ltr" maxlength="254" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="09123456789 یا name@example.com" aria-label="شماره‌ی موبایل یا ایمیل" value="' + esc(phoneVal) + '"><button class="btn" type="button" id="gInv">دعوت</button></div><div id="gMsg"></div></div>'
          : "") +
        '<div class="card"><div class="sec-t"><h2>اعضا</h2><span class="badge">' + faNum(ms.length) + "</span></div>" +
        ms.map((m) => {
          const canAct = m.role !== "owner" && m.user_id;
          const acts = [];
          if (canAct && owner()) {
            acts.push('<button class="btn small ghost" type="button" data-act="role" data-r="' + (m.role === "manager" ? "member" : "manager") + '" data-u="' + esc(m.user_id) + '" data-n="' + esc(m.name) + '">' + (m.role === "manager" ? "برداشتن از مدیریت" : "مدیر شود") + "</button>");
            acts.push('<button class="btn small ghost" type="button" data-act="mk" data-u="' + esc(m.user_id) + '" data-n="' + esc(m.name) + '">مالک شود</button>');
          }
          if (canAct && (owner() || (staff() && m.role === "member"))) acts.push('<button class="btn small danger" type="button" data-act="rm" data-u="' + esc(m.user_id) + '" data-n="' + esc(m.name) + '">حذف</button>');
          return '<div class="grp-row"><span class="av-s" aria-hidden="true">' + esc(gInitial(m.name)) + '</span><div class="grp-t"><strong>' + esc(m.name) + (m.role === "owner" || m.role === "manager" ? ' <span class="badge">' + ROLE_FA[m.role] + "</span>" : "") + "</strong>" +
            (staff() && m.phone ? '<small><bdi class="grp-ph">' + esc(showPhone(m.phone)) + "</bdi></small>" : "") + "</div>" +
            (acts.length ? '<div class="grp-a">' + acts.join("") + "</div>" : "") + "</div>";
        }).join("") + "</div>" +
        (staff() && pend.length
          ? '<div class="card"><div class="sec-t"><h2>منتظر پاسخ</h2><span class="badge">' + faNum(pend.length) + "</span></div>" +
            pend.map((p) =>
              '<div class="grp-row"><span class="av-s" aria-hidden="true">' + USERS_ICON + '</span><div class="grp-t"><strong><bdi class="grp-ph">' + esc(showPhone(p.phone)) + "</bdi></strong><small>دعوت فرستاده شده</small></div>" +
              '<button class="btn small ghost" type="button" data-act="cancel" data-p="' + esc(p.phone) + '">لغو دعوت</button></div>'
            ).join("") + "</div>"
          : "");
    };

    const draw = (errMsg) => {
      if (chatOff) { chatOff(); chatOff = null; }
      app.innerHTML =
        '<a class="back" href="/groups">' + ICONS.back + " گروه‌ها</a>" +
        (editName
          ? '<div class="card"><label for="gNewName">نام گروه</label><input id="gNewName" type="text" maxlength="60" autocomplete="off" value="' + esc(g.name) + '">' +
            '<div id="gRenMsg"></div><div class="actions"><button class="btn ghost" type="button" id="gRenBack">برگشت</button><button class="btn" type="button" id="gRenSave">ذخیره‌ی نام</button></div></div>'
          : '<div class="page-head grp-head"><h1>' + esc(g.name) + "</h1>" +
            (staff() ? '<button class="btn small ghost" type="button" data-act="rename">تغییر نام گروه</button>' : "") +
            '<span class="badge">' + (ROLE_FA[g.role] || "عضو") + "</span></div>") +
        (errMsg ? '<div class="err" role="alert">' + esc(errMsg) + "</div>" : "") +
        '<div class="grp-tabs"><div class="seg" role="group" aria-label="بخش‌های گروه">' +
        '<button type="button" data-tab="quizzes" aria-pressed="' + (tab === "quizzes") + '">آزمون‌ها (' + faNum((g.quizzes || []).length) + ")</button>" +
        '<button type="button" data-tab="chat" aria-pressed="' + (tab === "chat") + '">گپ</button>' +
        '<button type="button" data-tab="members" aria-pressed="' + (tab === "members") + '">اعضا (' + faNum((g.members || []).length) + ")</button></div></div>" +
        (tab === "quizzes" ? quizzesTab() : tab === "chat" ? '<div id="chatBox"></div>' : membersTab()) +
        (tab === "chat" ? "" : '<div class="actions"><button class="btn danger" type="button" data-act="' + (owner() ? "del" : "leave") + '">' + (owner() ? "حذف گروه" : "ترک گروه") + "</button></div>");
      if (tab === "chat") chatOff = mountChat(document.getElementById("chatBox"), { gid, toast, draft: chatDraft, onDraft: (t) => { chatDraft = t; } });
      const inp = document.getElementById("gPhone");
      if (inp) {
        inp.addEventListener("input", () => { phoneVal = inp.value; });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); invite(); } });
      }
      const ib = document.getElementById("gInv");
      if (ib) ib.addEventListener("click", invite);
      const rn = document.getElementById("gNewName");
      if (rn) {
        rn.focus();
        rn.setSelectionRange(rn.value.length, rn.value.length);
        const save = async () => {
          const nm = cleanName(rn.value), msg = document.getElementById("gRenMsg"), sb = document.getElementById("gRenSave");
          if (nm === g.name) { editName = false; draw(""); return; }
          if (nm.length < 2) { msg.innerHTML = '<div class="err" role="alert">نام گروه را بنویسید (حداقل ۲ حرف).</div>'; rn.focus(); return; }
          sb.disabled = true; sb.classList.add("loading"); msg.innerHTML = "";
          try {
            await gcall("group_rename", { p_group: gid, p_name: nm });
            if (!ok()) return;
            editName = false;
            groupsCache = null;
            await load(true);
            toast("نام گروه تغییر کرد ✓");
          } catch (e) {
            if (!ok()) return;
            sb.disabled = false; sb.classList.remove("loading");
            msg.innerHTML = '<div class="err" role="alert">' + esc(e.message) + "</div>";
          }
        };
        document.getElementById("gRenSave").addEventListener("click", save);
        document.getElementById("gRenBack").addEventListener("click", () => { editName = false; draw(""); });
        rn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } else if (e.key === "Escape") { e.preventDefault(); editName = false; draw(""); } });
      }
    };

    const invite = async () => {
      const inp = document.getElementById("gPhone"), msg = document.getElementById("gMsg"), btn = document.getElementById("gInv");
      if (!inp) return;
      const id = cleanIdent(inp.value), p = id.v;
      if (!id.ok) { msg.innerHTML = '<div class="err" role="alert">شماره‌ی موبایل یا ایمیل معتبر نیست. مثل ۰۹۱۲۳۴۵۶۷۸۹ یا name@example.com وارد کنید.</div>'; inp.focus(); return; }
      msg.innerHTML = "";
      const yes = await askConfirm({ title: "دعوت فرستاده شود؟", text: "برای " + (p.indexOf("@") >= 0 ? "ایمیل " : "شماره‌ی ") + showPhone(p) + " دعوت‌نامه‌ی گروه «" + g.name + "» فرستاده می‌شود. اگر اشتباه نوشته‌اید، «برگشت» را بزنید.", yes: "بله، دعوت را بفرست" });
      if (!yes || !ok()) return;
      btn.disabled = true; btn.classList.add("loading");
      try {
        await gcall("group_invite", { p_group: gid, p_phone: p });
        if (!ok()) return;
        phoneVal = "";
        groupsCache = null;
        await load(true);
        toast("دعوت فرستاده شد ✓");
      } catch (e) {
        if (!ok()) return;
        btn.disabled = false; btn.classList.remove("loading");
        msg.innerHTML = '<div class="err" role="alert">' + esc(e.message) + "</div>";
      }
    };

    const run = async (fn, doneMsg) => {
      try { await fn(); if (!ok()) return; groupsCache = null; await load(true); if (ok() && doneMsg) toast(doneMsg); }
      catch (e) { if (!ok()) return; await load(true); if (ok()) draw(e.message); }
    };

    async function onClick(e) {
      const t = e.target.closest("button[data-tab]");
      if (t && app.contains(t)) { tab = t.dataset.tab; draw(""); return; }
      const b = e.target.closest("button[data-act]");
      if (!b || !app.contains(b) || !g) return;
      const act = b.dataset.act;
      if (act === "rename") { editName = true; draw(""); return; }
      if (act === "role") {
        const nm = b.dataset.n, uid = b.dataset.u, r = b.dataset.r;
        const up = r === "manager";
        if (!(await askConfirm({ title: up ? "«" + nm + "» مدیر شود؟" : "«" + nm + "» از مدیریت برداشته شود؟", text: up ? "مدیر به همه‌ی اطلاعات گروه «" + g.name + "» (اعضا، آزمون‌ها و نتایج) دسترسی دارد و می‌تواند دعوت بفرستد و عضو عادی را حذف کند. فقط شما می‌توانید مدیر تعیین یا برکنار کنید و گروه را ببندید." : "او دیگر عضو عادی است و نتایج و اطلاعات مدیریتی گروه را نمی‌بیند. لینک‌های مدیریت آزمون‌های گروه هم تازه می‌شود.", yes: up ? "بله، مدیر شود" : "بله، بردار", danger: !up })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        tab = "members";
        run(() => gcall("group_set_role", { p_group: gid, p_user: uid, p_role: r }), up ? "مدیر تعیین شد" : "از مدیریت برداشته شد");
        return;
      }
      if (act === "mk") {
        const nm = b.dataset.n, uid = b.dataset.u;
        if (!(await askConfirm({ title: "«" + nm + "» مالک گروه شود؟", text: "از این به بعد او مالک گروه «" + g.name + "» است و شما مدیر می‌شوید. فقط مالک می‌تواند مدیر تعیین یا برکنار کند، مالک را عوض کند و گروه را ببندد؛ برگرداندنش هم فقط دست خود اوست.", yes: "بله، مالک شود", danger: true })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        tab = "members";
        run(() => gcall("group_transfer", { p_group: gid, p_user: uid }), "مالک گروه عوض شد");
        return;
      }
      if (act === "rm") {
        const nm = b.dataset.n, uid = b.dataset.u;
        if (!(await askConfirm({ title: "«" + nm + "» از گروه حذف شود؟", text: "این شخص دیگر آزمون‌های گروه را نمی‌بیند. نتایجی که قبلاً داده می‌ماند.", yes: "بله، حذف کن", danger: true })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        run(() => gcall("group_member_remove", { p_group: gid, p_user: uid }), "عضو حذف شد");
      } else if (act === "cancel") {
        const ph = b.dataset.p;
        if (!(await askConfirm({ title: "دعوت لغو شود؟", text: "دعوت برای " + (String(ph).indexOf("@") >= 0 ? "ایمیل " : "شماره‌ی ") + showPhone(ph) + " لغو می‌شود و او دیگر آن را نمی‌بیند.", yes: "بله، لغو کن", danger: true })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        run(() => gcall("group_invite_cancel", { p_group: gid, p_phone: ph }), "دعوت لغو شد");
      } else if (act === "leave") {
        if (!(await askConfirm({ title: "گروه را ترک می‌کنید؟", text: "دیگر آزمون‌های گروه «" + g.name + "» را نمی‌بینید. برای برگشتن، باید دوباره دعوتتان کنند.", yes: "بله، ترک می‌کنم", danger: true })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        try { await gcall("group_leave", { p_group: gid }); groupsCache = null; if (ok()) go("/groups"); }
        catch (err) { if (ok()) { b.disabled = false; b.classList.remove("loading"); draw(err.message); } }
      } else if (act === "del") {
        if (!(await askConfirm({ title: "گروه «" + g.name + "» حذف شود؟", text: "گروه، همه‌ی آزمون‌های گروه و نتایجشان برای همیشه پاک می‌شود و برگشت ندارد.", yes: "بله، همه را حذف کن", danger: true })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        try { await gcall("group_delete", { p_group: gid }); groupsCache = null; if (ok()) go("/groups"); }
        catch (err) { if (ok()) { b.disabled = false; b.classList.remove("loading"); draw(err.message); } }
      }
    }
    app.addEventListener("click", onClick);
    load(false);
    return function cleanup() { app.removeEventListener("click", onClick); if (chatOff) { chatOff(); chatOff = null; } };
  }

  /* نام گروه روی نشانک بالای صفحه‌ی ساخت آزمون؛ اگر گروه معتبر نبود هشدار می‌دهد */
  function fillGroupChip() {
    const gid = createGroup;
    if (!gid) return;
    ensureGroups().then((gs) => {
      const bx = document.getElementById("grpChipBox");
      if (!bx || gid !== createGroup) return;
      const g = gs.find((x) => x.id === gid && (x.role === "owner" || x.role === "manager"));
      bx.innerHTML = g ? groupChip(g.name) : '<div class="err" role="alert">این گروه پیدا نشد یا شما مالک یا مدیر آن نیستید؛ آزمون ساخته نمی‌شود. با «بازگشت» یک گروه دیگر یا حالت عمومی را انتخاب کنید.</div>';
    }).catch(() => {});
  }

  /* جمله‌ی کوتاه «آزمون گروهی» روی صفحه‌ها */
  const groupChip = (name) => '<div class="grp-chip">' + USERS_ICON + " آزمون گروهی" + (name ? " · " + esc(name) : "") + "</div>";

  /* ---------- قفل «ساخت آزمون»: فقط برای کاربران واردشده ---------- */
  let signupNext = "";
  let gateOn = false;
  const GATE_SEL = "header.top, #hero, #app, #siteFoot";
  const LOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/></svg>';

  function syncHeroNow() {
    const h = document.getElementById("hero");
    if (h) h.hidden = !(isHomeHash() || gateOn);
  }

  function closeGate() {
    gateOn = false;
    document.documentElement.classList.remove("gate-on");
    document.querySelectorAll(GATE_SEL).forEach((el) => el.removeAttribute("inert"));
    const g = document.getElementById("gate");
    if (g) g.remove();
    document.removeEventListener("keydown", onGateKey, true);
    syncHeroNow();
  }
  function onGateKey(e) {
    if (e.key === "Escape") { e.preventDefault(); go("/"); }
  }

  function viewGate(target, token) {
    const take = /^q\//.test(target);
    const grp = /^(groups|g\/)/.test(target);
    const tut = target === "tutor";
    const tok = target === "tokens" || target === "wallet";
    setTitle(tut ? "ورود برای معلم هوشمند" : tok ? "ورود برای خرید پولک" : grp ? "ورود برای گروه‌ها" : take ? "ورود برای شرکت در آزمون" : "ورود برای ساخت آزمون");
    viewHome();                               /* پس‌زمینه‌ی تار: صفحه‌ی اصلی */
    gateOn = true;
    document.documentElement.classList.add("gate-on");
    syncHeroNow();
    document.querySelectorAll(GATE_SEL).forEach((el) => el.setAttribute("inert", ""));
    const g = document.createElement("div");
    g.className = "gate";
    g.id = "gate";
    g.innerHTML =
      '<div class="gate-box" role="dialog" aria-modal="true" aria-labelledby="gateT" aria-describedby="gateD">' +
      '<div class="gate-ic">' + LOCK_ICON + "</div>" +
      '<h2 id="gateT">' + (tut ? "برای استفاده از معلم هوشمند وارد شوید" : tok ? "برای خرید پولک وارد شوید" : grp ? "برای دیدن گروه‌ها وارد شوید" : take ? "برای شرکت در آزمون وارد شوید" : "برای ساخت آزمون وارد شوید") + "</h2>" +
      '<p id="gateD">' + (tut ? "معلم هوشمند" : tok ? "خرید پولک" : grp ? "گروه‌ها" : take ? "شرکت در آزمون" : "ساخت آزمون") + " فقط برای کاربران ثبت‌نام‌شده است. ثبت‌نام با شماره‌ی موبایل یا ایمیل است و کمتر از یک دقیقه طول می‌کشد." + (take ? " بعد از ورود، مستقیم به همین آزمون برمی‌گردید." : "") + "</p>" +
      '<a class="btn wide" id="gateGo" href="/signup' + (/^create/.test(target) ? "" : "?next=" + target) + '">ثبت‌نام / ورود</a>' +
      '<a class="gate-back" href="/">بازگشت به صفحه‌ی اصلی</a></div>';
    document.body.appendChild(g);
    document.addEventListener("keydown", onGateKey, true);
    setTimeout(() => { if (token === routeToken) { const b = document.getElementById("gateGo"); if (b) b.focus({ preventScroll: true }); } }, 30);
    return function () { closeGate(); };
  }

  /* ---------- معلم هوشمند ---------- */
  /* برای خاموش‌کردن: این مقدار false، دکمه‌ی ttBtn در index.html با hidden، و TUTOR_ENABLED=0 روی سرور */
  const TUTOR_ON = true;
  const TT_GRADES = ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم", "یازدهم", "دوازدهم", "دانشگاه", "عمومی"];
  const TT_JR = ["ریاضی", "علوم تجربی", "فارسی", "عربی", "زبان انگلیسی", "مطالعات اجتماعی", "دینی"];
  const TT_EL = ["ریاضی", "فارسی", "نگارش", "علوم تجربی", "مطالعات اجتماعی", "هدیه‌های آسمان", "آموزش قرآن"];
  const TT_SUBJECTS = {
    "اول": TT_EL, "دوم": TT_EL, "سوم": TT_EL, "چهارم": TT_EL, "پنجم": TT_EL, "ششم": TT_EL,
    "هفتم": TT_JR, "هشتم": TT_JR, "نهم": TT_JR,
    "دهم": ["ریاضی", "فیزیک", "شیمی", "زیست‌شناسی", "فارسی", "عربی", "زبان انگلیسی", "دین و زندگی", "هندسه", "زمین‌شناسی", "جامعه‌شناسی", "اقتصاد", "تاریخ", "جغرافیا", "منطق"],
    "یازدهم": ["ریاضی", "حسابان", "هندسه", "آمار و احتمال", "فیزیک", "شیمی", "زیست‌شناسی", "فارسی", "عربی", "زبان انگلیسی", "دین و زندگی", "جامعه‌شناسی", "اقتصاد", "تاریخ", "جغرافیا", "فلسفه"],
    "دوازدهم": ["حسابان", "هندسه", "ریاضیات گسسته", "فیزیک", "شیمی", "زیست‌شناسی", "فارسی", "عربی", "زبان انگلیسی", "دین و زندگی", "جامعه‌شناسی", "اقتصاد", "تاریخ", "جغرافیا", "فلسفه", "روان‌شناسی"],
    "دانشگاه": ["ریاضی عمومی", "فیزیک عمومی", "شیمی عمومی", "آمار و احتمال", "برنامه‌نویسی", "اقتصاد"],
    "عمومی": ["هر درسی"],
  };
  const TT_OTHER = "__other";
  const ttSafe = (m) => String(m == null ? "" : m).replace(/دیپ[\s\u200c]*سیک|deep[\s-]*seek/gi, "معلم");   /* اسم مدل در هیچ پیامی به کاربر نشان داده نمی‌شود */
  const TT_GROUPS = [
    { t: "دبستان", g: ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم"] },
    { t: "متوسطه‌ی اول", g: ["هفتم", "هشتم", "نهم"] },
    { t: "متوسطه‌ی دوم", g: ["دهم", "یازدهم", "دوازدهم"] },
    { t: "سایر", g: ["دانشگاه", "عمومی"] },
  ];
  const TT_SVG = (p, w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
  const TT_BOOK = TT_SVG('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>');
  const TT_CHECK = TT_SVG('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 3.2);
  const TT_GO = TT_SVG('<path d="M19 12H5M11 6l-6 6 6 6"/>', 2.4);
  const TT_BACK = TT_SVG('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.4);
  const TT_SWAP = TT_SVG('<path d="m7 4-4 4 4 4M3 8h15M17 20l4-4-4-4M21 16H6"/>');
  const TT_CAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9.5 12 5l10 4.5-10 4.5z"/><path d="M6 11.6v4.4c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.4"/><path d="M22 9.5V15"/></svg>';
  const TT_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>';
  const TT_IMG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3.5"/><circle cx="9" cy="10" r="1.7"/><path d="m21 16-5.2-5.2L8 19"/></svg>';
  const TT_NEW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

  /* ---------- اصلاحِ نگارشِ فارسیِ پاسخ‌ها (فقط هنگام نمایش و کپی؛ متنِ اصلی دست نمی‌خورد) ----------
     نیم‌فاصله‌ی «می‌/نمی‌» و «‌ها/‌های»، چسبیدنِ «میشود»، و خط‌تیره بینِ دو کلمه‌ی فارسی (مثلاً «می-شود»). کد و فرمول دست نمی‌خورند. */
  const FA_L = "؀-ۿ";
  const FA_J = "بپتثجچحخسشصضطظعغفقکگلمنهیئكيى";
  const FA_PL_NO = ["أي", "اي", "ای", "انت", "ابت"];
  const FA_RE = {
    miSp: new RegExp("(?<![" + FA_L + "‌])(ن?می)[  ]+(?=[" + FA_L + "])(?!و[  ])", "g"),
    miGl: new RegExp("(?<![" + FA_L + "‌])(ن?می)(?=(?:شو[دنمیو]|کن[دمین]|ده[دمی]|خواه|خوان|توان|باش|گوی|گیر|رو[دنمی]|آی[دن]|بین|ساز|کش[دمین]|یاب|پذیر|نویس|پرس|ماند|افتد|رس[دن]|افزا|کاه|شناس|فهم|کوش|ریز|پرداز|دان(?:م|د|یم|ید|ند)(?![" + FA_L + "])))", "g"),
    plSp: new RegExp("(?<=[" + FA_L + "])[  ]+(ها|های|هایی)(?![" + FA_L + "])", "g"),
    plGl: new RegExp("(?<![" + FA_L + "‌])([" + FA_L + "]{2,}?)(هایی|های|ها)(?![" + FA_L + "])", "g"),
    hy: new RegExp("(?<=[" + FA_L + "])[-‐‑](?=[" + FA_L + "])", "g"),
  };
  function faFix(t) {
    if (!/[؀-ۿ]/.test(t)) return t;
    return t.replace(FA_RE.miSp, "$1‌").replace(FA_RE.miGl, "$1‌")
      .replace(FA_RE.plSp, "‌$1")
      .replace(FA_RE.plGl, (m, w, suf) => (FA_J.indexOf(w.charAt(w.length - 1)) >= 0 && FA_PL_NO.indexOf(w) < 0 ? w + "‌" + suf : m))
      .replace(FA_RE.hy, "‌");
  }
  /* همین اصلاح روی یک متنِ کامل (برای دکمه‌ی کپی)، به‌جز کد و فرمول */
  const ttFa = (src) => String(src == null ? "" : src).split(/(```[\s\S]*?```|`[^`\n]*`|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$)/).map((x, i) => (i % 2 ? x : faFix(x))).join("");

  /* ظاهرِ تمام‌صفحه‌ی چت، نمایشِ نرمِ متن و عکس‌های پیوست؛ فقط وقتی صفحه‌ی معلم باز می‌شود به صفحه اضافه می‌شود */
  const TT_CSS = [
    "html.tt-chat,html.tt-chat body{height:var(--vvh,100dvh);min-height:0;overflow:hidden;overscroll-behavior:none}",
    "html.tt-chat body{position:fixed;inset-inline:0;top:0;width:100%;transform:translateY(var(--vvt,0px));display:flex;flex-direction:column}",
    ".tt-log>*{flex:none}",
    ".tt-m.err{background:none;padding:0;border:0;border-radius:0;margin:0;animation:none;font-weight:inherit}",
    "html.tt-chat #hero,html.tt-chat #homeSeo,html.tt-chat #siteFoot{display:none !important}",
    "html.tt-chat #app.wrap{flex:1 1 auto;min-height:0;width:100%;max-width:none;margin:0;padding:0;display:flex;flex-direction:column;overflow:hidden;scroll-margin-top:0}",
    "html.tt-chat .tt{flex:1 1 auto;min-height:0;width:100%;max-width:none;margin:0;gap:0}",
    "html.tt-chat .tt-ctx{flex:none;margin:0;border-width:0 0 1px;border-radius:0;padding:8px max(12px,calc((100% - 820px)/2))}",
    "html.tt-chat .tt-box{flex:1 1 auto;min-height:0;height:auto;border:0;border-radius:0;display:flex;flex-direction:column}",
    ".tt-logw{position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}",
    "html.tt-chat .tt-log{flex:1 1 auto;min-height:0;overflow-anchor:none;padding:16px max(14px,calc((100% - 820px)/2))}",
    "html.tt-chat .tt-att{padding-inline:max(12px,calc((100% - 820px)/2))}",
    "html.tt-chat .tt-in{padding:10px max(12px,calc((100% - 820px)/2)) calc(10px + env(safe-area-inset-bottom,0px))}",
    "html.tt-chat .tt-b{max-width:min(92%,680px)}",
    "@media (min-width:1100px){html.tt-chat.tt-side-on #app.wrap{padding:0 0 0 272px}}",
    ".tt-empty h2{margin:6px 0 2px}",
    ".tt-empty p.tt-price{margin:0;font-size:.78rem;color:var(--muted);line-height:1.6}",
    ".tt-fd{animation:ttFd .46s ease-out both}",
    "@keyframes ttFd{from{opacity:0}to{opacity:1}}",
    "@media (prefers-reduced-motion:reduce){.tt-fd{animation:none}}",
    ".tt-down{position:absolute;inset-inline:0;bottom:10px;margin-inline:auto;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--surface-solid);color:var(--accent-2);display:grid;place-items:center;cursor:pointer;box-shadow:var(--shadow);padding:0;-webkit-tap-highlight-color:transparent}",
    ".tt-down[hidden]{display:none}.tt-down svg{width:20px;height:20px}",
    ".tt-pic-b{display:block;padding:0;border:0;border-radius:12px;background:rgba(255,255,255,.2);cursor:zoom-in;overflow:hidden;line-height:0;font:inherit}",
    ".tt-pic-b.ld{min-width:88px;min-height:88px;background:linear-gradient(110deg,rgba(255,255,255,.12) 30%,rgba(255,255,255,.3) 50%,rgba(255,255,255,.12) 70%) 0 0/200% 100%;animation:ttSh 1.2s linear infinite}",
    ".tt-pic-b.gone{cursor:default;min-width:88px;min-height:88px;display:grid;place-items:center;font-size:.7rem;line-height:1.5;padding:6px;color:inherit;opacity:.8}",
    "@keyframes ttSh{to{background-position:-200% 0}}",
    ".tt-lb{position:fixed;inset:0;z-index:300;background:rgba(5,25,19,.86);display:grid;place-items:center;padding:16px;cursor:zoom-out}",
    ".tt-lb img{max-width:100%;max-height:100%;border-radius:12px;background:#fff;object-fit:contain}",
    ".tt-lb-x{position:absolute;inset-block-start:14px;inset-inline-end:14px;width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#0b3427;display:grid;place-items:center;cursor:pointer;padding:0}",
    ".tt-lb-x svg{width:16px;height:16px}",
  ].join("\n");
  let ttCssOn = false;
  const ttCss = () => {
    if (ttCssOn) return;
    ttCssOn = true;
    const el = document.createElement("style");
    el.id = "ttCss";
    el.textContent = TT_CSS;
    document.head.appendChild(el);
  };

  /* نمایش متنِ پاسخ (Markdown ساده + فرمول‌های ریاضی) بدون innerHTML خام
     live=true: متنِ نیمه‌تمام (در حال استریم) است؛ کدِ باز مانده بسته فرض می‌شود */
  function ttMd(src, live) {
    const P = "", Q = "", R = "";
    let t = String(src == null ? "" : src).replace(/\r\n?/g, "\n");
    /* ۱) بلوک‌های کد (اول از همه تا چیزی داخلشان دستکاری نشود) */
    const codes = [];
    if (live && ((t.match(/^[ \t]*```/gm) || []).length % 2) === 1) t += "\n```";
    t = t.replace(/```[^\n]*\n?([\s\S]*?)```/g, (m, c) => { codes.push(c.replace(/\n$/, "")); return "\n" + P + (codes.length - 1) + P + "\n"; });
    /* ۲) کدِ درون‌خطی */
    const icodes = [];
    t = t.replace(/`([^`\n]+)`/g, (m, c) => { icodes.push(c); return Q + (icodes.length - 1) + Q; });
    /* ۳) فرمول‌ها (\( \) و \[ \] و $…$ و $$…$$ که واقعاً فرمول باشند) */
    if (live) {   /* فرمولِ نیمه‌نوشته نشان داده نمی‌شود (LaTeX خام در متن راست‌به‌چپ به‌هم می‌ریزد) */
      const o1 = t.lastIndexOf("\\["); if (o1 >= 0 && t.indexOf("\\]", o1) < 0) t = t.slice(0, o1);
      const o2 = t.lastIndexOf("\\("); if (o2 >= 0 && t.indexOf("\\)", o2) < 0) t = t.slice(0, o2);
      t = t.replace(/\\$/, "");
    }
    const maths = [];
    t = normalizeMath(t).replace(/\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/g, (m) => { maths.push(m); return R + (maths.length - 1) + R; });
    t = faFix(t);
    const inline = (x) => {
      let h = esc(x);
      h = h.replace(/\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/g, (m, a1, b1) => "<strong>" + (a1 || b1) + "</strong>");
      h = h.replace(/(^|[\s(،؛:])\*([^*\n]+?)\*(?=$|[\s).،؛:!؟?])/g, "$1<em>$2</em>");
      return h;
    };
    const dig = (n) => String(n).replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c));
    const lines = t.split("\n");
    const out = [];
    let para = [], list = null;
    const li = (it) => "<li>" + it.lines.map(inline).join("<br>") + (it.sub && it.sub.length ? "<" + it.sub[0].t + ">" + it.sub.map((x) => "<li>" + inline(x.c) + "</li>").join("") + "</" + it.sub[0].t + ">" : "") + "</li>";
    const flushP = () => { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    const flushL = () => { if (list) { out.push("<" + list.t + (list.t === "ol" && list.start > 1 ? ' start="' + list.start + '"' : "") + ">" + list.items.map(li).join("") + "</" + list.t + ">"); list = null; } };
    const BUL = /^(\s*)[-*•]\s+(.+)$/, NUM = /^(\s*)(\d+|[۰-۹]+)[.)\-]\s+(.+)$/;
    const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      let m;
      if (/^\s*$/.test(ln)) { flushP(); if (list) list.gap = true; continue; }   /* لیست با خط خالی تمام نمی‌شود؛ اگر آیتم بعدی هم‌نوع بود ادامه می‌یابد */
      if ((m = new RegExp("^\\s*" + P + "(\\d+)" + P + "\\s*$").exec(ln))) { flushP(); flushL(); out.push("<pre><code>" + esc(codes[+m[1]]) + "</code></pre>"); continue; }
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(ln) && !BUL.test(ln)) { flushP(); flushL(); out.push("<hr>"); continue; }
      if ((m = /^\s{0,3}(#{1,4})\s+(.+)$/.exec(ln))) { flushP(); flushL(); out.push('<h4 class="tt-h">' + inline(m[2].replace(/\s*#+\s*$/, "")) + "</h4>"); continue; }
      if (ln.indexOf("|") >= 0 && i + 1 < lines.length && SEP.test(lines[i + 1]) && lines[i + 1].indexOf("-") >= 0) {
        flushP(); flushL();
        const head = cells(ln); let j = i + 2; const rows = [];
        while (j < lines.length && lines[j].indexOf("|") >= 0 && !/^\s*$/.test(lines[j])) { rows.push(cells(lines[j])); j++; }
        out.push('<div class="tt-tbl"><table><thead><tr>' + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" +
          rows.map((r) => "<tr>" + head.map((_, k) => "<td>" + inline(r[k] || "") + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>");
        i = j - 1; continue;
      }
      if ((m = /^\s*>\s?(.*)$/.exec(ln))) { flushP(); flushL(); out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); continue; }
      const mb = BUL.exec(ln), mn = mb ? null : NUM.exec(ln);
      if (mb || mn) {
        const indent = (mb ? mb[1] : mn[1]).replace(/\t/g, "    ").length;
        const kind = mb ? "ul" : "ol", text = mb ? mb[2] : mn[3];
        if (list && indent >= 2 && list.items.length) {   /* زیرلیست (یک سطح) */
          const last = list.items[list.items.length - 1];
          (last.sub = last.sub || []).push({ t: kind, c: text });
          list.gap = false; continue;
        }
        flushP();
        if (!list || list.t !== kind) { flushL(); list = { t: kind, items: [], start: mn ? +dig(mn[2]) || 1 : 1 }; }
        list.items.push({ lines: [text] }); list.gap = false;
        continue;
      }
      if (list && /^\s{2,}\S/.test(ln) && !list.gap) { list.items[list.items.length - 1].lines.push(ln.trim()); continue; }   /* ادامه‌ی آیتم با تورفتگی */
      flushL(); para.push(ln);
    }
    flushP(); flushL();
    return out.join("")
      .replace(new RegExp(R + "(\\d+)" + R, "g"), (m, k) => (live ? '<span class="tt-rawm" dir="ltr">' + esc(maths[+k]) + "</span>" : esc(maths[+k])))
      .replace(new RegExp(Q + "(\\d+)" + Q, "g"), (m, k) => "<code>" + esc(icodes[+k]) + "</code>")
      .replace(new RegExp(P + "(\\d+)" + P, "g"), (m, k) => "<code>" + esc(codes[+k]) + "</code>");
  }

  /* در متنِ در حال استریم: تا کجا «پاراگرافِ تمام‌شده» است؟ (مرزِ امن = خط خالی بیرون از کد و فرمولِ باز). فقط از from به بعد بررسی می‌شود */
  function ttSplit(text, from) {
    let pos = from, fence = false, lastCut = from, open = 0, prevItem = false;
    const ITEM = /^\s*(?:[-*•]|\d+[.)\-]|[۰-۹]+[.)\-])\s+\S/;
    while (pos < text.length) {
      let e = text.indexOf("\n", pos);
      const last = e < 0;
      if (last) e = text.length;
      const ln = text.slice(pos, e);
      if (/^[ \t]*```/.test(ln)) { fence = !fence; prevItem = false; }
      else if (!fence) {
        open += (ln.split("\\[").length - 1) - (ln.split("\\]").length - 1);
        if ((ln.split("$$").length - 1) % 2) open += open > 0 ? -1 : 1;
        if (/^\s*$/.test(ln)) {
          if (open <= 0 && !last) {
            /* بین دو آیتمِ یک لیست خط خالی باشد، لیست را نشکن (تا شماره‌ها و فاصله‌ها مثلِ رندر کامل شود) */
            const nx = /^(?:[ \t]*\n)*([^\n]*)/.exec(text.slice(e + 1, e + 600));
            const next = nx ? nx[1] : "";
            const hold = prevItem && (!next.trim() || ITEM.test(next) || /^\s{2,}\S/.test(next));
            if (!hold) lastCut = e + 1;
          }
        } else prevItem = ITEM.test(ln) || (prevItem && /^\s{2,}\S/.test(ln));
      }
      pos = e + 1;
    }
    return lastCut;
  }

  const TT_STOP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/></svg>';
  const TT_SIDE = TT_SVG('<rect x="3" y="4.5" width="18" height="15" rx="3.2"/><path d="M9.5 4.5v15"/>');
  const TT_DOTS = TT_SVG('<path d="M5 12h.01M12 12h.01M19 12h.01"/>', 3.6);

  /* ---------- گفت‌وگوهای معلم روی حساب ----------
     نسخه‌ی اصلی روی سرور است و هر کاربر روی همین دستگاه یک کش جدا دارد. تغییرها کم‌کم به سرور می‌روند و با باز شدن صفحه
     (یا برگشتن به برنامه) تغییرهای دستگاه‌های دیگر گرفته و ادغام می‌شوند. چیزی بدون دکمه‌ی «حذف» پاک نمی‌شود. */
  const TT_BOOK_RE = /^(0|[a-z0-9_-]{1,40})$/;
  /* عنوانِ موقت از روی پیام اول، تا وقتی عنوان هوشمند برسد */
  const ttProv = (t) => {
    t = String(t || "").replace(/\s+/g, " ").trim();
    if (t.length <= 30) return t;
    const c = t.slice(0, 30), i = c.lastIndexOf(" ");
    return (i > 14 ? c.slice(0, i) : c).trim() + "…";
  };
  const ttUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const TT_FID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const ttCleanMsgs = (a) => (Array.isArray(a) ? a : []).filter((m) => m && (m.r === "u" || m.r === "a") && typeof m.c === "string" && m.c)
    .map((m) => {
      if (m.r === "a") return m.p ? { r: "a", c: m.c.slice(0, 9000), p: 1 } : { r: "a", c: m.c.slice(0, 9000) };
      const f = Array.isArray(m.f) ? m.f.filter((x) => typeof x === "string" && TT_FID.test(x)).slice(0, 5) : [];   /* شناسه‌ی عکس‌های پیوست (خودِ عکس‌ها فقط روی سرورند) */
      return f.length ? { r: "u", c: m.c.slice(0, 9000), f: f } : { r: "u", c: m.c.slice(0, 9000) };
    }).slice(-40);
  const ttCleanChat = (c) => {
    if (!c || typeof c !== "object" || typeof c.id !== "string" || !/^[a-z0-9]{4,40}$/.test(c.id)) return null;
    return {
      id: c.id,
      title: typeof c.title === "string" ? c.title.replace(/\s+/g, " ").trim().slice(0, 60) : "",
      ai: !!c.ai, man: !!c.man, seq: 0,
      grade: TT_GRADES.indexOf(c.grade) >= 0 ? c.grade : "",
      subj: typeof c.subj === "string" ? c.subj.slice(0, 40) : "",
      book: typeof c.book === "string" && TT_BOOK_RE.test(c.book) ? c.book : "",
      t: typeof c.t === "number" && isFinite(c.t) ? c.t : 0,
      msgs: ttCleanMsgs(c.msgs),
    };
  };
  const TCS = (() => {
    const PFX = "tutor:c:", LEG2 = "tutor:v2", LEG1 = "tutor:v1";
    const PUSH_CHARS = 50000;
    let rec = null, recKey = "", timer = 0, retryT = 0, tries = 0, flushing = null, again = false, pulling = null, lastPull = 0;
    const who = () => { const s = auth.get(); return s ? String(s.phone || s.email || "u" + s.token.slice(0, 16)) : ""; };
    const sigOf = (c) => {
      let n = 0;
      for (let i = 0; i < c.msgs.length; i++) n += c.msgs[i].c.length + (c.msgs[i].f ? c.msgs[i].f.length * 37 : 0);
      const l = c.msgs[c.msgs.length - 1];
      return [c.t, c.title, c.ai ? 1 : 0, c.man ? 1 : 0, c.grade, c.subj, c.book, c.msgs.length, n, l ? l.r + l.c.length : ""].join("|");
    };
    const plain = (c) => ({ id: c.id, title: c.title, ai: !!c.ai, man: !!c.man, grade: c.grade, subj: c.subj, book: c.book, t: c.t, msgs: c.msgs.slice() });
    const packChat = (c) => {
      let n = 0, i = c.msgs.length;
      while (i > 0 && c.msgs.length - i < 40 && n + c.msgs[i - 1].c.length <= PUSH_CHARS) { n += c.msgs[i - 1].c.length; i--; }
      return { id: c.id, title: c.title, ai: !!c.ai, man: !!c.man, grade: c.grade, subj: c.subj, book: c.book, t: c.t, msgs: c.msgs.slice(i) };
    };
    const blank = () => ({ v: 3, active: "", sel: {}, chats: [], ss: {}, base: {}, gone: {} });
    const mapOf = (o, f) => { const r = {}; if (o && typeof o === "object") Object.keys(o).forEach((k) => { if (/^[a-z0-9]{4,40}$/.test(k) && f(o[k])) r[k] = o[k]; }); return r; };
    const read = (k) => {
      const v = store.get(k, null);
      if (!v || v.v !== 3 || !Array.isArray(v.chats)) return null;
      const seen = {}, r = blank();
      r.active = typeof v.active === "string" ? v.active : "";
      r.sel = v.sel && typeof v.sel === "object" ? v.sel : {};
      r.chats = v.chats.map(ttCleanChat).filter((c) => c && !seen[c.id] && (seen[c.id] = 1));
      r.ss = mapOf(v.ss, (x) => typeof x === "string");
      r.base = mapOf(v.base, (x) => typeof x === "number" && isFinite(x));
      r.gone = mapOf(v.gone, (x) => x === 1);
      return r;
    };
    /* گفت‌وگوهای نسخه‌های قبلی (که برای همه‌ی کاربرانِ این مرورگر مشترک بود) یک بار به اولین کاربرِ واردشده می‌رسد */
    const legacy = () => {
      const v2 = store.get(LEG2, null);
      if (v2 && v2.v === 2 && Array.isArray(v2.chats)) {
        const seen = {};
        return { active: typeof v2.active === "string" ? v2.active : "", sel: v2.sel || {}, chats: v2.chats.map(ttCleanChat).filter((c) => c && !seen[c.id] && (seen[c.id] = 1)).slice(-100) };
      }
      const old = store.get(LEG1, null);
      if (!old || typeof old !== "object") return null;
      const chats = [], ch = old.chats && typeof old.chats === "object" ? old.chats : {}, keys = Object.keys(ch);
      keys.forEach((k, i) => {
        const arr = ttCleanMsgs(ch[k]);
        if (!arr.length) return;
        const j = k.indexOf("|");
        let g = j < 0 ? "" : k.slice(0, j), sj = j < 0 ? k : k.slice(j + 1);
        if (sj === "؟") sj = "";
        if (sj === "هدیه‌های آسمان" && ["هفتم", "هشتم", "نهم"].indexOf(g) >= 0) sj = "دینی";   /* درسِ «هدیه‌های آسمان» در متوسطه‌ی اول حالا «دینی» است */
        const first = arr.filter((m) => m.r === "u")[0];
        const c = ttCleanChat({ id: ttUid() + i, title: ttProv(first ? first.c : ""), grade: g, subj: sj, book: old.useBook === false ? "0" : (typeof old.book === "string" ? old.book : ""), t: Date.now() - (keys.length - i) * 1000, msgs: arr });
        if (c) chats.push(c);
      });
      return chats.length ? { active: "", sel: { grade: old.grade, subject: old.subject, other: old.other, book: old.useBook === false ? "0" : old.book }, chats: chats } : null;
    };
    const write = (r, k) => store.set(k, r);
    const load = () => {
      const u = who();
      if (!u) { rec = null; recKey = ""; return null; }
      if (rec && recKey === PFX + u) return rec;
      recKey = PFX + u;
      rec = read(recKey);
      if (!rec) {
        rec = blank();
        const lg = legacy();
        if (lg) {
          rec.active = lg.active; rec.sel = lg.sel; rec.chats = lg.chats.map(plain);
          if (write(rec, recKey)) { store.del(LEG2); store.del(LEG1); }
        }
      }
      return rec;
    };
    const dirtyOf = (r) => r.chats.filter((c) => c.msgs.length && r.ss[c.id] !== sigOf(c));
    const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(flush, ms == null ? 500 : ms); };
    const retryLater = () => { clearTimeout(retryT); if (tries >= 8) return; retryT = setTimeout(flush, [4000, 10000, 30000, 90000][Math.min(tries++, 3)]); };

    async function drain() {
      for (let guard = 0; guard < 500; guard++) {
        const r = load(), s = auth.get();
        if (!r || !s) return;
        const key = recKey, tk = s.token, gid = Object.keys(r.gone)[0];
        try {
          if (gid) {
            const res = await rpc("tutor_chat_del", { p_token: tk, p_id: gid });
            if (rec !== r) return;
            if (res && res.ok) { delete r.gone[gid]; delete r.ss[gid]; delete r.base[gid]; write(r, key); tries = 0; continue; }
            if (res && res.error === "no_session") return;
            if (res && res.error === "bad_chat") { delete r.gone[gid]; write(r, key); continue; }
            throw new Error("del");
          }
          const c = dirtyOf(r)[0];
          if (!c) { tries = 0; return; }
          const sg = sigOf(c);
          const res = await rpc("tutor_chat_put", { p_token: tk, p_chat: packChat(c) });
          if (rec !== r) return;
          if (res && res.ok) { r.ss[c.id] = sg; r.base[c.id] = res.rev; write(r, key); tries = 0; continue; }
          if (res && res.error === "no_session") return;
          if (res && res.error === "bad_chat") { r.ss[c.id] = sg; write(r, key); continue; }
          throw new Error("put");
        } catch (e) { retryLater(); return; }
      }
    }
    function flush() {
      clearTimeout(timer);
      if (flushing) { again = true; return flushing; }
      flushing = (async () => { try { do { again = false; await drain(); } while (again); } finally { flushing = null; } })();
      return flushing;
    }

    return {
      owner: () => who(),
      /* کش این کاربر: نسخه‌ی مستقلی از گفت‌وگوها (یا خالی اگر کسی وارد نشده) */
      open() {
        const r = load();
        if (!r) return { owner: "", active: "", sel: {}, chats: [] };
        return { owner: who(), active: r.active, sel: r.sel, chats: r.chats.map((c) => ttCleanChat(c)) };
      },
      save(owner, active, sel, chats) {
        const r = load();
        if (!r || who() !== owner) return true;
        r.active = active; r.sel = sel; r.chats = chats.map(plain);
        const okk = write(r, recKey);
        schedule();
        return okk;
      },
      del(owner, c) {
        const r = load();
        if (!r || who() !== owner) return;
        r.chats = r.chats.filter((x) => x.id !== c.id);
        if (c.msgs.length || r.ss[c.id] !== undefined || r.base[c.id] !== undefined) r.gone[c.id] = 1;
        delete r.ss[c.id]; delete r.base[c.id];
        write(r, recKey);
        schedule();
      },
      /* عنوانِ هوشمند وقتی رسید که صفحه بسته شده بود */
      setTitle(owner, id, prov, t) {
        const r = load();
        if (!r || who() !== owner) return;
        const c = r.chats.filter((x) => x.id === id)[0];
        if (!c || c.man || !c.msgs.length || c.title !== prov) return;
        c.title = t; c.ai = true;
        write(r, recKey);
        schedule();
      },
      pending() { const r = load(); return !!r && (Object.keys(r.gone).length > 0 || dirtyOf(r).length > 0); },
      kick() { tries = 0; if (load()) schedule(50); },
      flush,
      wipe() {
        clearTimeout(timer); clearTimeout(retryT);
        rec = null; recKey = ""; tries = 0;
        const hit = (k) => k.indexOf(PFX) === 0 || k === LEG2 || k === LEG1;
        Object.keys(memStore).forEach((k) => { if (hit(k)) delete memStore[k]; });
        try {
          const ks = [];
          for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && hit(k)) ks.push(k); }
          ks.forEach((k) => localStorage.removeItem(k));
        } catch (e) { /* ignore */ }
      },
      /* گرفتن تغییرهای سرور و ادغام با گفت‌وگوهای فعلیِ صفحه.
         view: { chats(): آرایه‌ی گفت‌وگوهای صفحه، skip(): {id:true} گفت‌وگوهایی که الان نباید دست بخورند، done(out, info) } */
      pull(owner, view, force) {
        if (pulling) return pulling;
        if (!force && Date.now() - lastPull < 4000) return Promise.resolve(false);
        const r0 = load(), s = auth.get();
        if (!r0 || !s || who() !== owner) return Promise.resolve(false);
        pulling = (async () => {
          try {
            const known = {};
            view.chats().forEach((c) => { if (r0.base[c.id] !== undefined) known[c.id] = r0.base[c.id]; });
            const res = await rpc("tutor_chats_list", { p_token: s.token, p_known: known });
            lastPull = Date.now();
            if (rec !== r0 || who() !== owner || !res || !res.ok || !Array.isArray(res.chats)) return false;
            const L = view.chats(), skip = view.skip(), by = {}, here = {}, out = [], removed = [], changed = [], added = [];
            res.chats.forEach((x) => { if (x && typeof x.id === "string") by[x.id] = x; });
            L.forEach((c) => {
              here[c.id] = 1;
              const x = by[c.id];
              if (skip[c.id]) { out.push(c); return; }
              if (!x) {
                if (r0.ss[c.id] !== undefined && r0.ss[c.id] === sigOf(c)) { removed.push(c.id); delete r0.ss[c.id]; delete r0.base[c.id]; }   /* در دستگاه دیگری حذف شده */
                else out.push(c);
                return;
              }
              if (x.same) { out.push(c); return; }
              const sv = ttCleanChat(x);
              if (!sv || typeof x.rev !== "number") { out.push(c); return; }
              const dirty = r0.ss[c.id] === undefined || r0.ss[c.id] !== sigOf(c);
              if (!dirty || c.t < sv.t) { r0.ss[c.id] = sigOf(sv); r0.base[c.id] = x.rev; out.push(sv); changed.push(c.id); }
              else { r0.base[c.id] = x.rev; out.push(c); }
            });
            res.chats.forEach((x) => {
              if (!x || x.same || typeof x.id !== "string" || here[x.id] || r0.gone[x.id] || typeof x.rev !== "number") return;
              const sv = ttCleanChat(x);
              if (!sv) return;
              r0.ss[sv.id] = sigOf(sv); r0.base[sv.id] = x.rev; out.push(sv); added.push(sv.id);
            });
            r0.chats = out.map(plain);
            write(r0, recKey);
            view.done(out, { removed: removed, changed: changed, added: added });
            schedule(100);
            return true;
          } catch (e) { return false; } finally { pulling = null; }
        })();
        return pulling;
      },
    };
  })();
  window.addEventListener("authchange", () => TCS.kick());

  function viewTutor(token) {
    setTitle("معلم هوشمند");
    const ok = () => token === routeToken;
    const SIDEKEY = "tutor:side";
    const MAX_CHATS = 100, MAX_MSGS = 40;
    const uid = ttUid;
    const BOOK_RE = TT_BOOK_RE;
    const provTitle = ttProv;
    const saved = TCS.open();
    const owner = saved.owner;
    const sel0 = saved.sel || {};
    const st = {
      grade: TT_GRADES.indexOf(sel0.grade) >= 0 ? sel0.grade : "",
      subject: typeof sel0.subject === "string" ? sel0.subject : "",
      other: typeof sel0.other === "string" ? sel0.other.slice(0, 40) : "",
      model: "ds-vision",   /* معلم فقط با DeepSeek Flash (متن و عکس) کار می‌کند */
      book: typeof sel0.book === "string" && BOOK_RE.test(sel0.book) ? sel0.book : "",   /* "" = اولین کتاب آن درس، "0" = بدون کتاب، یا نام یکی از کتاب‌ها */
      chats: saved.chats,
      active: "",
    };
    const chatById = (id) => { for (let i = 0; i < st.chats.length; i++) if (st.chats[i].id === id) return st.chats[i]; return null; };
    const curChat = () => chatById(st.active);
    const newChatObj = (g, sj, bk) => ({ id: uid(), title: "", ai: false, man: false, seq: 0, grade: g || "", subj: sj || "", book: bk || "", t: Date.now(), msgs: [] });
    /* گفت‌وگوی فعال: آخرین گفت‌وگوی بازشده، وگرنه تازه‌ترین؛ اگر هیچ گفت‌وگویی نیست یکی تازه ساخته می‌شود */
    {
      let a = saved.active && chatById(saved.active);
      if (!a && st.chats.length) a = st.chats.slice().sort((x, y) => y.t - x.t)[0];
      if (!a) { a = newChatObj(); st.chats.push(a); }
      st.active = a.id;
      if (a.grade && a.subj) { st.grade = a.grade; st.subject = a.subj; st.other = ""; st.book = a.book; }
    }
    const persist = () => {
      st.chats = st.chats.filter((c) => c.id === st.active || c.msgs.length);   /* گفت‌وگوی خالیِ غیرفعال نگه داشته نمی‌شود */
      const trim = (n) => {
        if (st.chats.length <= n) return;
        const keep = {};
        st.chats.slice().sort((x, y) => y.t - x.t).slice(0, n).forEach((c) => { keep[c.id] = 1; });
        keep[st.active] = 1;
        st.chats = st.chats.filter((c) => keep[c.id]);
      };
      trim(MAX_CHATS);
      const pack = () => TCS.save(owner, st.active, { grade: st.grade, subject: st.subject, other: st.other, book: st.book }, st.chats);
      let okk = pack();
      if (!okk) { trim(Math.max(2, Math.floor(st.chats.length / 2))); okk = pack(); }   /* حافظه‌ی مرورگر پر بود: قدیمی‌ترین نسخه‌های این دستگاه کنار می‌روند (روی حساب می‌مانند) */
    };
    loadKatex();   /* فرمول‌ها از همین حالا آماده می‌شوند تا اولین پاسخ معطل نماند */
    document.documentElement.classList.add("tt-page");
    ttCss();
    const subjName = () => (st.subject === TT_OTHER ? st.other.trim() : st.subject);
    const hist = () => { const c = curChat(); return c ? c.msgs : []; };

    app.innerHTML =
      '<section class="tt" aria-label="معلم هوشمند">' +
      '<div class="tp" id="ttPick" hidden>' +
      '<button class="tt-sb tp-sb" id="ttSb2" type="button" aria-label="فهرست گفت‌وگوها" aria-controls="ttSide" aria-expanded="false" title="گفت‌وگوها">' + TT_SIDE + "</button>" +
      '<button class="tp-back" id="ttBack" type="button" hidden>' + TT_BACK + "<span>بازگشت به گفت‌وگو</span></button>" +
      '<div class="tp-hero"><span class="tt-ic big">' + TT_CAP + '</span><h1 id="ttH">معلم هوشمند</h1><p>پایه و درس را انتخاب کن؛ کتاب درسی خودکار می‌آید و هر چه نفهمیدی بپرس.</p></div>' +
      '<section class="tp-s" id="tpG" aria-label="پایه"></section><section class="tp-s" id="tpS" aria-label="درس" hidden></section><section class="tp-s" id="tpB" aria-label="کتاب" hidden></section>' +
      '<div class="tp-bar" id="tpGo"></div></div>' +
      '<div class="tt-ctx" id="ttCtx" hidden><span class="tt-ic">' + TT_CAP + '</span><div class="tt-ctx-t"><strong id="ttCtxT"></strong><small>' + TT_BOOK + '<span id="ttCtxS"></span></small></div>' +
      '<button class="btn ghost small tt-ab" id="ttChg" type="button" aria-label="تغییر پایه و درس" title="تغییر پایه و درس">' + TT_SWAP + "<span>تغییر</span></button>" +
      '<button class="btn ghost small tt-ab" id="ttNew" type="button" aria-label="گفت‌وگوی جدید" title="گفت‌وگوی جدید">' + TT_NEW + "<span>جدید</span></button>" +
      '<button class="tt-sb" id="ttSb1" type="button" aria-label="فهرست گفت‌وگوها" aria-controls="ttSide" aria-expanded="false" title="گفت‌وگوها">' + TT_SIDE + "</button></div>" +
      '<div class="tt-box" id="ttBox" hidden><div class="tt-logw"><div class="tt-log" id="ttLog" role="log" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="گفت‌وگو با معلم"></div>' +
      '<button class="tt-down" id="ttDown" type="button" aria-label="رفتن به پایین گفت‌وگو" title="رفتن به پایین" hidden>' + TT_SVG('<path d="M12 5v14M6 13l6 6 6-6"/>', 2.4) + "</button></div>" +
      '<div class="tt-att" id="ttAttBox" hidden><div class="tt-ats" id="ttAts"></div><span id="ttAttT">عکس‌ها با فرستادن پیام روی حساب شما ذخیره می‌شود.</span></div>' +
      '<form class="chat-in tt-in" id="ttForm" autocomplete="off"><button class="tt-clip" type="button" id="ttClip" aria-label="پیوست عکس" title="پیوست عکس" hidden>' + TT_IMG + '</button><input type="file" id="ttFile" accept="image/*" multiple hidden><textarea id="ttTa" rows="1" maxlength="2000" dir="auto" enterkeyhint="send" placeholder="سؤالت را بنویس…" aria-label="سؤال شما"></textarea>' +
      '<button class="chat-send" type="submit" id="ttSend" aria-label="ارسال" disabled>' + CI.send + "</button></form></div></section>";

    const $ = (id) => document.getElementById(id);
    const log = $("ttLog"), ta = $("ttTa"), sendBtn = $("ttSend"), box = $("ttBox"), pickEl = $("ttPick");
    const ATT_MAX = 5;
    let busy = false;
    let alive = true;
    let lastFailed = null;
    let atts = [], reading = false;   /* عکس‌های پیوستِ پیامِ در حال نوشتن: {u: عکسِ کوچک‌شده, t: بندانگشتی}؛ فقط در حافظه‌ی همین صفحه تا لحظه‌ی ارسال */
    const toast = (m) => { if (window.__pzToast) window.__pzToast(m); };
    let ctl = null, userStop = false, stopHook = null, autoLeft = 0;
    let mode = curChat().grade && curChat().subj ? "chat" : "pick";   /* گفت‌وگوی فعال پایه و درس دارد: مستقیم به چت؛ وگرنه صفحه‌ی انتخاب */
    let prevSel = null;   /* اگر «تغییر» را بزند و پشیمان شود، به همین انتخاب برمی‌گردد */

    /* چت تمام‌صفحه است (چیدمان با CSS و کلاس tt-chat)؛ این‌جا فقط ارتفاعِ واقعاً دیدنیِ صفحه (با کیبورد موبایل) به CSS داده می‌شود */
    const fit = () => {
      if (!alive) return;
      const vv = window.visualViewport;
      const H = Math.round(vv ? vv.height : window.innerHeight);
      document.documentElement.style.setProperty("--vvh", H + "px");
      document.documentElement.style.setProperty("--vvt", Math.round(vv ? vv.offsetTop : 0) + "px");
      downSync();
    };
    const onResize = () => { fit(); setTop(); };
    window.addEventListener("resize", onResize);
    if (window.visualViewport) { window.visualViewport.addEventListener("resize", onResize); window.visualViewport.addEventListener("scroll", fit); }

    /* ---------- انتخاب پایه ← درس ← کتاب ---------- */
    let books = [], booksState = 0;   /* 0 در حال بارگیری، 1 آماده، 2 نشد */
    /* اسم کتاب برای نمایش: بدون پایه و برچسب‌های اضافه، با رقم فارسی */
    const cleanName = (t) => faNum(String(t || "").replace(/\s*-?\s*\(?\s*(?:پایه\s*)?(?:هفتم|هشتم|نهم)\s*\)?\s*$/, "").replace(/\s*\(اجرای آزمایشی\)/, "").replace(/\s+/g, " ").trim());
    const TT_TAGS = ["ریاضی و تجربی", "ریاضی فیزیک", "علوم تجربی", "علوم انسانی", "علوم و معارف اسلامی"];
    const bookParts = (b) => {
      const k = b.title.indexOf(" · "), n = cleanName(k < 0 ? b.title : b.title.slice(0, k)), t = k < 0 ? "" : b.title.slice(k + 3).trim();
      /* برچسب رشته فقط وقتی دو کتابِ هم‌نام در یک پایه و درس هست */
      const dup = !!t && books.some((x) => x !== b && x.grade === b.grade && x.subject === b.subject && cleanName(x.title.split(" · ")[0]) === n);
      return { n: n, t: dup ? t : "" };
    };
    const bookRank = (b) => (/کتاب کار/.test(b.title) ? 100 : 0) + (TT_TAGS.indexOf(bookParts(b).t) + 1);
    const booksFor = () => (st.grade ? books.filter((b) => b.grade === st.grade && b.subject === subjName()).sort((a, b) => bookRank(a) - bookRank(b)) : []);
    const curBook = () => {
      if (st.book === "0") return null;
      const l = booksFor();
      return l.find((b) => b.slug === st.book) || l[0] || null;
    };
    /* درس‌های هر پایه: اگر کتابی دارد همان‌ها (به ترتیب آشنا)، وگرنه فهرست ثابت */
    const subjectsOf = (g) => {
      const fixed = TT_SUBJECTS[g] || [];
      const have = [];
      books.forEach((b) => { if (b.grade === g && b.subject && have.indexOf(b.subject) < 0) have.push(b.subject); });
      if (!have.length) return fixed.slice();
      const rank = (x) => { const k = fixed.indexOf(x); return k < 0 ? 999 : k; };
      return have.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
    };
    const hasBook = (g, x) => books.some((b) => b.grade === g && b.subject === x);
    const subjReady = () => !!st.grade && !!st.subject && (st.subject !== TT_OTHER || st.other.trim().length >= 2);
    const seen = { s: false, b: false };   /* هر مرحله فقط بار اول که پیدا می‌شود با انیمیشن می‌آید */

    const renderG = () => {
      $("tpG").innerHTML = '<h2 class="tp-h"><b' + (st.grade ? ' class="ok"' : "") + ">" + (st.grade ? TT_CHECK : "۱") + "</b>پایه‌ی تحصیلی</h2>" +
        TT_GROUPS.map((x) => '<div class="tp-grp"><span class="tp-gl">' + x.t + '</span><div class="tp-grid">' +
          x.g.map((g) => '<button type="button" class="tp-t' + (g === st.grade ? " on" : "") + '" data-g="' + g + '" aria-pressed="' + (g === st.grade) + '">' + g + "</button>").join("") + "</div></div>").join("");
    };
    const renderS = () => {
      const el = $("tpS");
      if (!st.grade) { seen.s = false; el.hidden = true; el.innerHTML = ""; return; }
      el.hidden = false;
      el.classList.toggle("new", !seen.s); seen.s = true;
      let h = '<h2 class="tp-h"><b' + (subjReady() ? ' class="ok"' : "") + ">" + (subjReady() ? TT_CHECK : "۲") + "</b>درس</h2>";
      if (booksState === 0) h += '<div class="tp-chips tp-skel" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
      else {
        h += '<div class="tp-chips" role="group" aria-label="درس">' + subjectsOf(st.grade).map((x) => '<button type="button" class="tp-c' + (x === st.subject ? " on" : "") + '" data-s="' + esc(x) + '" aria-pressed="' + (x === st.subject) + '">' + (hasBook(st.grade, x) ? TT_BOOK : "") + "<span>" + esc(x) + "</span></button>").join("") +
          '<button type="button" class="tp-c more' + (st.subject === TT_OTHER ? " on" : "") + '" data-s="' + TT_OTHER + '" aria-pressed="' + (st.subject === TT_OTHER) + '">' + TT_NEW + "<span>درس دیگر</span></button></div>";
        if (st.subject === TT_OTHER) h += '<label class="tp-oth"><span>اسم درس</span><input id="ttOther" type="text" maxlength="40" placeholder="مثلاً مدار الکتریکی" autocomplete="off" value="' + esc(st.other) + '"></label>';
      }
      el.innerHTML = h;
    };
    const renderB = () => {
      const el = $("tpB");
      if (!subjReady()) { seen.b = false; el.hidden = true; el.innerHTML = ""; return; }
      el.hidden = false;
      el.classList.toggle("new", !seen.b); seen.b = true;
      const l = booksFor(), cur = curBook();
      let h = '<h2 class="tp-h"><b class="ok">' + TT_CHECK + "</b>کتاب درسی</h2>";
      if (!l.length) h += '<p class="tp-none">' + TT_BOOK + "<span>برای این درس کتابی در سایت نیست؛ بدون کتاب هم کمکت می‌کنم.</span></p>";
      else {
        h += '<div class="tp-books" role="radiogroup" aria-label="کتاب درسی">' + l.map((b) => {
          const p = bookParts(b), on = !!cur && cur.slug === b.slug;
          return '<button type="button" role="radio" aria-checked="' + on + '" class="tp-b' + (on ? " on" : "") + '" data-b="' + esc(b.slug) + '"><i class="tp-r"></i><span class="tp-bt"><b>' + esc(p.n) + "</b>" + (p.t ? "<small>" + esc(p.t) + "</small>" : "") + "</span>" + TT_BOOK + "</button>";
        }).join("") + '<button type="button" role="radio" aria-checked="' + !cur + '" class="tp-b none' + (!cur ? " on" : "") + '" data-b="0"><i class="tp-r"></i><span class="tp-bt"><b>بدون کتاب</b><small>فقط گفت‌وگو</small></span></button></div>';
      }
      el.innerHTML = h;
    };
    const renderGo = () => {
      const ready = subjReady();
      const cb = ready ? curBook() : null;
      const has = ready && hist().length > 0;
      $("tpGo").innerHTML = '<span class="tp-sm">' + (ready ? "<b>" + esc((st.grade === "عمومی" ? "" : st.grade + " · ") + subjName()) + "</b><small>" + (cb ? "با کتاب درسی" : "بدون کتاب") + "</small>" : "<b>" + (st.grade ? "حالا درس را انتخاب کن" : "پایه‌ات را انتخاب کن") + "</b>") + "</span>" +
        '<button type="button" class="btn tp-go" id="ttGo"' + (ready ? "" : " disabled") + ">" + (has ? "ادامه‌ی گفت‌وگو" : "شروع گفت‌وگو") + TT_GO + "</button>";
    };
    const renderPick = () => { renderG(); renderS(); renderB(); renderGo(); $("ttBack").hidden = !prevSel; };

    const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bring = (id) => setTimeout(() => { const el = $(id); if (alive && el && !el.hidden && mode === "pick") { try { el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" }); } catch (e) { /* ignore */ } } }, 80);
    const refocus = (attr, v) => { const n = Array.prototype.find.call(pickEl.querySelectorAll("[" + attr + "]"), (x) => x.getAttribute(attr) === v); if (n) { try { n.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } };

    pickEl.addEventListener("click", (e) => {
      const t = e.target.closest ? e.target.closest("button") : null;
      if (!t || !pickEl.contains(t) || t.disabled) return;
      if (t.hasAttribute("data-g")) {
        const g = t.getAttribute("data-g");
        if (g !== st.grade) { st.grade = g; st.subject = ""; st.other = ""; st.book = ""; persist(); }
        renderPick(); refocus("data-g", g); bring("tpS");
      } else if (t.hasAttribute("data-s")) {
        const x = t.getAttribute("data-s");
        st.subject = x; st.book = ""; persist();
        renderS(); renderB(); renderGo();
        if (x === TT_OTHER) { const o = $("ttOther"); if (o) o.focus(); } else { refocus("data-s", x); bring("tpB"); }
      } else if (t.hasAttribute("data-b")) {
        const b = t.getAttribute("data-b");
        st.book = b; persist();
        renderB(); renderGo(); refocus("data-b", b);
      } else if (t.id === "ttGo") startChat();
      else if (t.id === "ttBack") backToChat();
    });
    pickEl.addEventListener("input", (e) => {
      if (e.target && e.target.id === "ttOther") { st.other = e.target.value.slice(0, 40); persist(); renderB(); renderGo(); const so = $("tpS").querySelector(".tp-h b"); if (so) { so.innerHTML = subjReady() ? TT_CHECK : "۲"; so.className = subjReady() ? "ok" : ""; } }
    });

    const phText = () => (curBook() ? "سؤالت یا شماره‌ی صفحه را بنویس…" : "سؤالت را بنویس…");
    const applyCfg = () => {
      const chat = mode === "chat";
      pickEl.hidden = chat; $("ttCtx").hidden = !chat; box.hidden = !chat;
      document.documentElement.classList.toggle("tt-chat", chat);
      if (!chat) { fit(); return; }
      const cb = curBook();
      $("ttCtxT").textContent = (st.grade === "عمومی" ? "" : st.grade + " · ") + (subjName() || "؟");
      $("ttCtxS").textContent = cb ? (() => { const p = bookParts(cb); return p.n + (p.t ? " · " + p.t : ""); })() : (booksState === 0 && st.book !== "0" ? "…" : "بدون کتاب");
      fit();
    };
    /* درسی که از فهرست نیست («درس دیگر») در صفحه‌ی انتخاب با همان نام نمایش داده شود */
    const fitSubject = () => {
      if (st.subject && st.subject !== TT_OTHER && subjectsOf(st.grade).indexOf(st.subject) < 0) { st.other = st.subject.slice(0, 40); st.subject = TT_OTHER; }
    };
    const startChat = () => {
      if (!subjReady()) return;
      mode = "chat"; prevSel = null;
      const c = curChat();
      c.grade = st.grade; c.subj = subjName(); c.book = st.book;   /* پایه، درس و کتابِ همین گفت‌وگو */
      st.subject = c.subj; st.other = "";
      persist(); lastFailed = null; attReset();
      renderLog(); applyCfg(); sync(); clipSync(); renderSide();
      try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
      requestAnimationFrame(fit);
      if (fine.matches) { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    };
    const openPick = () => {
      if (busy) return;
      prevSel = { grade: st.grade, subject: st.subject, other: st.other, book: st.book };
      fitSubject();
      mode = "pick"; seen.s = true; seen.b = true;
      renderPick(); applyCfg(); closeDrawer(true);
      try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    };
    const backToChat = () => {
      if (!prevSel) return;
      Object.assign(st, prevSel); prevSel = null; mode = "chat";
      persist(); lastFailed = null; renderLog(); applyCfg(); sync(); clipSync(); renderSide();
      requestAnimationFrame(fit);
    };
    rpc("books_list", {}).then((r) => { if (!alive) return; if (Array.isArray(r)) books = r.filter((b) => b && typeof b.slug === "string" && typeof b.grade === "string" && typeof b.subject === "string" && typeof b.title === "string"); booksState = Array.isArray(r) ? 1 : 2; if (mode === "pick" && st.subject === TT_OTHER && st.other && subjectsOf(st.grade).indexOf(st.other.trim()) >= 0) { st.subject = st.other.trim(); st.other = ""; } renderPick(); applyCfg(); if (!hist().length) renderLog(); clipSync(); }).catch(() => { if (!alive) return; booksState = 2; renderPick(); });

    /* یادداشتِ «پاسخ ناقص» با دکمه‌ی ادامه */
    const incNote = (el, msg, withBtn) => {
      const b = el.querySelector(".tt-b");
      const n = document.createElement("div");
      n.className = "tt-inc";
      const sp = document.createElement("span");
      sp.textContent = msg || "پاسخ ناقص ماند.";
      n.appendChild(sp);
      if (withBtn) {
        const bt = document.createElement("button");
        bt.type = "button"; bt.className = "btn ghost small"; bt.textContent = "ادامه بده";
        bt.addEventListener("click", () => submit(false, "ادامه بده"));
        n.appendChild(bt);
      }
      b.appendChild(n);
    };

    /* عکس‌های پیوست روی دیتابیس‌اند. این‌جا فقط برای نمایش، و فقط در حافظه‌ی همین صفحه (blob)، گرفته می‌شوند؛ چیزی در مرورگر ذخیره نمی‌شود. */
    const fcache = new Map();
    const fwait = [];
    let fbusy = 0;
    const fslot = () => new Promise((res) => { const go = () => { if (fbusy < 4) { fbusy++; res(); } else fwait.push(go); }; go(); });
    const fdone = () => { fbusy--; const n = fwait.shift(); if (n) n(); };
    /* نتیجه: آدرس blob، یا "" (دیگر روی سرور نیست)، یا null (اینترنت؛ بعداً دوباره امتحان می‌شود) */
    const fileUrl = (id, thumb) => {
      const k = id + (thumb ? "t" : "f");
      if (fcache.has(k)) return fcache.get(k);
      const pr = (async () => {
        await fslot();
        try {
          const se = auth.get();
          if (!se) return null;
          const res = await fetch(cfg.SUPABASE_URL + "/functions/v1/tutor", {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
            body: JSON.stringify({ token: se.token, action: "file", id: id, thumb: !!thumb }),
          });
          if (res.status === 404) return "";
          if (!res.ok) return null;
          return URL.createObjectURL(await res.blob());
        } catch (e) { return null; } finally { fdone(); }
      })();
      fcache.set(k, pr);
      pr.then((u) => { if (u === null) fcache.delete(k); });
      return pr;
    };
    let lightbox = null;
    const closePic = () => { if (lightbox) { lightbox.remove(); lightbox = null; } document.removeEventListener("keydown", picKey, true); };
    const picKey = (e) => { if (e.key === "Escape" && lightbox) { e.preventDefault(); e.stopPropagation(); closePic(); } };
    const openPic = async (it) => {
      closePic();
      const ov = document.createElement("div");
      ov.className = "tt-lb"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "عکس پیوست‌شده");
      const im = document.createElement("img"); im.alt = "عکس پیوست‌شده";
      const x = document.createElement("button"); x.type = "button"; x.className = "tt-lb-x"; x.setAttribute("aria-label", "بستن"); x.innerHTML = CI.close;
      ov.appendChild(im); ov.appendChild(x);
      document.body.appendChild(ov);
      lightbox = ov;
      document.addEventListener("keydown", picKey, true);
      ov.addEventListener("click", closePic);
      if (it.u) im.src = it.u;
      else { const u = await fileUrl(it.id, false); if (lightbox !== ov) return; if (u) im.src = u; else { closePic(); toast("این عکس دیگر در دسترس نیست."); } }
    };
    const picBox = (items) => {
      const wrap = document.createElement("div");
      wrap.className = "tt-pics";
      items.forEach((it) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "tt-pic-b"; b.setAttribute("aria-label", "دیدن عکس");
        const im = document.createElement("img");
        im.className = "tt-pic"; im.alt = "عکس پیوست‌شده"; im.decoding = "async";
        b.appendChild(im);
        if (it.u) im.src = it.t || it.u;
        else {
          b.classList.add("ld");
          fileUrl(it.id, true).then((u) => {
            if (!alive) return;
            b.classList.remove("ld");
            if (u) im.src = u;
            else { im.remove(); b.classList.add("gone"); b.disabled = true; b.textContent = u === "" ? "عکس دیگر در دسترس نیست" : "عکس بارگیری نشد"; }
          });
        }
        b.addEventListener("click", () => { if (!b.disabled) openPic(it); });
        wrap.appendChild(b);
      });
      return wrap;
    };

    const bubble = (role, text, extra, inc, pics) => {
      const d = document.createElement("div");
      d.className = "tt-m " + (role === "user" ? "me" : "ai") + (extra ? " " + extra : "");
      if (role === "user") {
        const b = document.createElement("div");
        b.className = "tt-b";
        if (pics && pics.length) b.appendChild(picBox(pics));
        b.appendChild(document.createTextNode(text));
        d.appendChild(b);
      } else {
        const av = document.createElement("span");
        av.className = "tt-av";
        av.innerHTML = TT_CAP;
        const b = document.createElement("div");
        b.className = "tt-b tt-md";
        b.innerHTML = ttMd(text);
        const cp = document.createElement("button");
        cp.type = "button";
        cp.className = "tt-cp";
        cp.setAttribute("aria-label", "کپی پاسخ");
        cp.title = "کپی";
        cp.innerHTML = TT_COPY;
        d._t = text;
        cp.addEventListener("click", async () => { const r = await copyText(ttFa(d._t)); if (window.__pzToast) window.__pzToast(r === false ? "کپی نشد" : "کپی شد"); });
        d.appendChild(av); d.appendChild(b); d.appendChild(cp);
        if (text) renderMath(b);
        if (inc) incNote(d, "", inc.btn);
      }
      return d;
    };
    /* صفحه هیچ‌وقت خودش اسکرول نمی‌شود: فقط وقتی پیامی می‌فرستی، پیامِ تو بالای کادر می‌آید (یک بار) و پاسخ زیرش نوشته می‌شود */
    const scrollEnd = () => { log.scrollTop = log.scrollHeight; };
    const scrollToEl = (el) => { log.scrollTop = Math.max(0, el.offsetTop - 10); };
    const downBtn = $("ttDown");
    function downSync() {
      if (!downBtn || !log) return;
      const far = log.scrollHeight - log.scrollTop - log.clientHeight > 140;
      downBtn.hidden = !(far && mode === "chat" && hist().length > 0);
    }
    log.addEventListener("scroll", downSync, { passive: true });
    downBtn.addEventListener("click", () => { try { log.scrollTo({ top: log.scrollHeight, behavior: reduceMotion() ? "auto" : "smooth" }); } catch (e) { scrollEnd(); } });

    function renderLog() {
      log.innerHTML = "";
      const h = hist();
      if (!h.length) {
        const e = document.createElement("div");
        e.className = "tt-empty";
        e.innerHTML = '<span class="tt-ic big">' + TT_CAP + "</span><h2>از کجا شروع کنیم؟</h2><p class=\"tt-price\">هر سوال = ۲ پولک</p>";
        log.appendChild(e);
        downSync();
        return;
      }
      h.forEach((m, i) => log.appendChild(bubble(m.r === "u" ? "user" : "ai", m.c, "", m.r === "a" && m.p && i === h.length - 1 ? { btn: true } : null, m.r === "u" && m.f ? m.f.map((id) => ({ id: id })) : null)));
      scrollEnd(); downSync();
    }

    function autosize() {
      const was = log.scrollHeight - log.scrollTop - log.clientHeight < 4;   /* اگر ته گفت‌وگو بودی، با بلندشدن کادر نوشتن همان‌جا بمان */
      ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, 132) + "px";
      if (was) log.scrollTop = log.scrollHeight;
    }
    let sendMode = "";
    function sync() {
      ["ttChg"].forEach((id) => { $(id).disabled = busy; });
      side.classList.toggle("busy", busy);
      $("ttClip").disabled = busy || reading || atts.length >= ATT_MAX;
      $("ttAts").querySelectorAll("button").forEach((b) => { b.disabled = busy; });
      const mode = busy ? "stop" : "send";
      if (mode !== sendMode) {
        sendMode = mode;
        sendBtn.classList.toggle("stop", busy);
        sendBtn.innerHTML = busy ? TT_STOP : CI.send;
        sendBtn.setAttribute("aria-label", busy ? "توقف پاسخ" : "ارسال");
      }
      sendBtn.disabled = busy ? false : (!ta.value.trim() || !subjName());
    }
    const stop = () => { userStop = true; try { if (ctl) ctl.abort(); } catch (e) { /* ignore */ } if (stopHook) stopHook(); };

    const typing = () => {
      const d = document.createElement("div");
      d.className = "tt-m ai typing";
      d.innerHTML = '<span class="tt-av">' + TT_CAP + '</span><div class="tt-b"><span class="tt-dots" role="status" aria-label="معلم در حال نوشتن است"><i></i><i></i><i></i></span></div>';
      return d;
    };

    /* درخواست به معلم. onText(متنِ تا‌اکنون) با رسیدن هر تکه صدا زده می‌شود.
       نتیجه: {reply, left, inc, error?, stopped?}  یا  {error, code?, stopped?} */
    async function ask(history, onText, onFiles, imgs) {
      const M = aiModel(st.model);
      const s = auth.get();
      if (!s) return { error: "نشست شما منقضی شده است. دوباره وارد شوید.", code: "no_session" };
      userStop = false;
      ctl = window.AbortController ? new AbortController() : null;
      const hdr = setTimeout(() => { try { if (ctl) ctl.abort(); } catch (e) { /* ignore */ } }, 75000);
      let res;
      try {
        res = await fetch(cfg.SUPABASE_URL + "/functions/v1/tutor", {
          method: "POST",
          signal: ctl ? ctl.signal : undefined,
          headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
          body: JSON.stringify({
            token: s.token, grade: st.grade === "عمومی" ? "" : st.grade, subject: subjName(), book: curBook() ? curBook().slug : undefined, provider: M.provider, model: M.model, stream: true, chat: st.active,
            images: (M.vision && imgs && imgs.length) ? imgs.map((x) => x.u) : undefined,
            thumbs: (M.vision && imgs && imgs.length) ? imgs.map((x) => x.t) : undefined,
            messages: history.slice(-16).map((m) => { const o = { role: m.r === "u" ? "user" : "assistant", content: m.c }; if (m.r === "u" && m.f && m.f.length) o.files = m.f; return o; }),
          }),
        });
      } catch (e) {
        clearTimeout(hdr);
        if (userStop) return { error: "پاسخ متوقف شد.", stopped: true };
        return { error: "اتصال به سرور برقرار نشد. اینترنت‌تان را بررسی کنید و دوباره تلاش کنید." };
      }
      clearTimeout(hdr);
      if (res.ok && /text\/event-stream/i.test(res.headers.get("content-type") || "") && res.body && res.body.getReader) {
        const rd = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "", txt = "", left, left2, err = "", done = false, trunc = false, stall = false;
        const line = (ln) => {
          ln = ln.replace(/\r$/, "");
          if (ln.indexOf("data:") !== 0) return;
          let j; try { j = JSON.parse(ln.slice(5)); } catch (e) { return; }
          if (typeof j.d === "string") { txt += j.d; onText(txt); }
          else if (Array.isArray(j.files)) { if (onFiles) onFiles(j.files); }
          else if (j.done) { done = true; left = j.left; left2 = j.tokens; trunc = !!j.truncated; }
          else if (j.error) err = String(j.error);
        };
        const read = () => new Promise((resolve, reject) => {
          /* اگر ۴۵ ثانیه هیچ چیزی (حتی ضربانِ سرور) نرسد، اتصال مرده است */
          const tm = setTimeout(() => { stall = true; try { if (ctl) ctl.abort(); } catch (e) { /* ignore */ } reject(new Error("stall")); }, 45000);
          rd.read().then((v) => { clearTimeout(tm); resolve(v); }, (e) => { clearTimeout(tm); reject(e); });
        });
        try {
          for (;;) {
            const r = await read();
            if (r.done) break;
            buf += dec.decode(r.value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n")) >= 0) { const ln = buf.slice(0, i); buf = buf.slice(i + 1); line(ln); }
          }
          if (buf) line(buf);
        } catch (e) { if (!err && !done && !userStop) err = stall ? "پاسخ دیر رسید و قطع شد." : "اتصال در میانه‌ی پاسخ قطع شد."; }
        if (txt && done && !err) return { reply: txt, left: left, tokens: left2, inc: trunc };
        if (txt) return { reply: txt, inc: true, error: userStop ? "پاسخ را متوقف کردی." : (err || "پاسخ ناقص ماند."), stopped: userStop };
        if (userStop) return { error: "پاسخ متوقف شد.", stopped: true };
        return { error: err || "پاسخ ناقص بود. دوباره تلاش کنید." };
      }
      let d = null;
      try { d = await res.json(); } catch (e) { /* ignore */ }
      if (d && Array.isArray(d.files) && onFiles) onFiles(d.files);
      if (res.ok && d && d.reply) return { reply: String(d.reply), left: d.left, tokens: d.tokens, inc: false };
      if (res.status === 401 && d && d.code === "no_session") { auth.clear(); }
      return { error: (d && d.error) || "پاسخ دادن ممکن نشد. دوباره تلاش کنید.", code: d && d.code, tokens: d && d.tokens };
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    async function submit(retry, forced) {
      if (busy) return;
      let text;
      if (forced) text = forced;
      else if (retry && lastFailed) text = lastFailed;
      else { text = ta.value.trim(); if (!text || !subjName()) return; }
      lastFailed = null;
      if (!forced && !retry) autoLeft = 1;   /* اگر پاسخ وسط کار قطع شد، یک بار خودکار «ادامه بده» می‌فرستیم */
      const chat = curChat();
      if (!chat) return;
      const key = chat.id;
      const h = chat.msgs;
      const firstMsg = !retry && !forced && !h.length;
      chat.t = Date.now();   /* تازه‌ترین گفت‌وگو بالای فهرست */
      log.querySelectorAll(".tt-m.err").forEach((n) => n.remove());
      log.querySelectorAll(".tt-m").forEach((n) => { if (n.style.minHeight) n.style.minHeight = ""; });   /* جای خالیِ پیام قبلی دیگر لازم نیست */
      log.querySelectorAll(".tt-inc .btn").forEach((n) => n.remove());
      const mine = (!forced && aiModel(st.model).vision && atts.length) ? atts.slice() : [];   /* عکس‌هایی که با همین پیام می‌روند (هنوز روی سرور نیستند) */
      let ub = null;
      if (!retry) {
        if (!h.length) log.innerHTML = "";
        h.push({ r: "u", c: text });
        ub = bubble("user", text, "", null, mine.map((x) => ({ u: x.u, t: x.t })));
        log.appendChild(ub);
        if (!forced) { ta.value = ""; autosize(); }
      } else {
        const ms = log.querySelectorAll(".tt-m.me");
        ub = ms.length ? ms[ms.length - 1] : null;
      }
      const um = h[h.length - 1];   /* پیامِ کاربر که الان جواب می‌گیرد */
      if (firstMsg) nameChat(chat, text);   /* همان لحظه‌ی اولین پیام، نام‌گذاری شروع می‌شود (موازی با پاسخ) */
      persist();
      renderSide();
      busy = true; sync();
      const ty = typing();
      log.appendChild(ty);
      /* پیامِ تو یک بار بالای کادر می‌نشیند و پاسخ زیرش نوشته می‌شود؛ از این به بعد کادر خودش جابه‌جا نمی‌شود، هر قدر پاسخ بلند باشد */
      let room = 0;
      if (ub) {
        const cs = getComputedStyle(log);
        const padT = parseFloat(cs.paddingTop) || 0, padB = parseFloat(cs.paddingBottom) || 0;
        room = Math.max(0, log.clientHeight - padT - padB - ub.offsetHeight - 12);
        ty.style.minHeight = room + "px";
        log.scrollTop = Math.max(0, ub.offsetTop - padT);
      }
      downSync();

      /* نمایش زنده: متنی که از شبکه می‌رسد در صف می‌ماند و هر ~۶۰ میلی‌ثانیه یک (یا اگر صف بلند باشد چند) کلمه‌ی کامل از آن آشکار می‌شود؛ هر کلمه با یک محوشدگیِ نرم (fade) می‌آید.
         پس نه کلمه‌به‌کلمه می‌پرد و نه به سرعتِ تکه‌های شبکه بستگی دارد. پاراگراف‌های تمام‌شده یک بار رندر می‌شوند (فرمول‌ها هم) و فقط پاراگرافِ در حال نوشتن دوباره ساخته می‌شود. */
      const FADE = 0, TICK = 60;   /* هر کلمه همان لحظه که می‌رسد دیده می‌شود (بدون صف و محوشدگی) */
      let live = null, liveB = null, tail = null, cur = "", shown = 0, stableLen = 0, timer = 0, fin = false, ending = false, drainRes = null;
      let chunkLen = 0, lastEnd = 0;
      const marks = [];   /* [{a,b,t}]: نویسه‌های دیدنیِ a تا b در لحظه‌ی t آشکار شدند */
      const tlen = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n = 0, x; while ((x = w.nextNode())) n += x.nodeValue.length; return n; };
      const settled = (endPos, now) => {
        if (!FADE) return true;
        for (let i = 0; i < marks.length; i++) if (marks[i].b >= endPos) return marks[i].a >= endPos || now - marks[i].t >= FADE;
        return true;
      };
      const fadeWrap = (root, off, now) => {
        const rec = marks.filter((m) => now - m.t < FADE);
        if (!rec.length) return;
        const lo = rec[0].a;
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let n;
        while ((n = w.nextNode())) nodes.push(n);
        let pos = off;
        nodes.forEach((node) => {
          const txt = node.nodeValue, a0 = pos, b0 = pos + txt.length;
          pos = b0;
          if (b0 <= lo) return;
          const frag = document.createDocumentFragment();
          let cursor = 0;
          for (let k = 0; k < rec.length; k++) {
            const r = rec[k];
            if (r.b <= a0 || r.a >= b0) continue;
            const s0 = Math.max(r.a, a0) - a0, e0 = Math.min(r.b, b0) - a0;
            if (s0 > cursor) frag.appendChild(document.createTextNode(txt.slice(cursor, s0)));
            const sp = document.createElement("span");
            sp.className = "tt-fd";
            sp.style.animationDelay = "-" + Math.round(now - r.t) + "ms";
            sp.textContent = txt.slice(s0, e0);
            frag.appendChild(sp);
            cursor = e0;
          }
          if (cursor === 0) return;
          if (cursor < txt.length) frag.appendChild(document.createTextNode(txt.slice(cursor)));
          node.parentNode.replaceChild(frag, node);
        });
      };
      const trimMarks = (total) => {
        if (total > lastEnd) { marks.push({ a: lastEnd, b: total, t: performance.now() }); lastEnd = total; }
        else if (total < lastEnd) {   /* متنِ دیدنی کوتاه شد (مثلاً فرمولِ نیمه‌کاره کنار رفت) */
          lastEnd = total;
          while (marks.length && marks[marks.length - 1].a >= total) marks.pop();
          if (marks.length) marks[marks.length - 1].b = Math.min(marks[marks.length - 1].b, total);
        }
      };
      const render = () => {
        if (!live) return;
        const now = performance.now();
        const v = cur.slice(0, shown);
        const cut = ttSplit(v, stableLen);
        tail.innerHTML = ttMd(v.slice(stableLen), true);
        trimMarks(chunkLen + tlen(tail));   /* کلماتِ این دسته همین حالا ثبت می‌شوند */
        if (cut > stableLen) {
          const tmp = document.createElement("div");
          tmp.innerHTML = ttMd(v.slice(stableLen, cut));
          const len = tlen(tmp);
          if (settled(chunkLen + len, now)) {   /* پاراگراف وقتی ثابت می‌شود که محوشدگیِ کلماتش تمام شده باشد (تا نپرد) */
            const added = [];
            while (tmp.firstChild) { const nd = tmp.firstChild; added.push(nd); liveB.insertBefore(nd, tail); }
            added.forEach((nd) => { if (nd.nodeType === 1) renderMath(nd); });
            chunkLen += len; stableLen = cut;
            tail.innerHTML = ttMd(v.slice(stableLen), true);
            trimMarks(chunkLen + tlen(tail));
          }
        }
        if (FADE) fadeWrap(tail, chunkLen, now);
        while (marks.length > 1 && now - marks[0].t > FADE + 1500) marks.shift();
        downSync();
      };
      const settle = () => { if (drainRes) { const f = drainRes; drainRes = null; f(); } };
      const wordsIn = (a, b) => { let n = 0; for (let i = a; i < b; i++) { const c = cur.charCodeAt(i); if (c === 32 || c === 10 || c === 160) n++; } return n; };
      const isWs = (c) => c === " " || c === "\n" || c === "\t" || c === "\u00a0";
      const advance = () => {
        if (document.hidden) { shown = cur.length; return; }
        const bw = wordsIn(shown, cur.length);
        const want = ending ? Math.max(4, Math.ceil(bw / 5)) : Math.max(1, Math.round(bw / 10));   /* معمولاً کلمه‌به‌کلمه؛ اگر صف بلند شد کمی تندتر تا عقب نماند */
        let i = shown, n = 0;
        while (i < cur.length && n < want) {
          let j = i;
          while (j < cur.length && !isWs(cur.charAt(j))) j++;
          if (j >= cur.length) { if (ending || j - i > 40) { i = cur.length; n++; } break; }   /* کلمه‌ی آخر هنوز کامل نشده */
          while (j < cur.length && isWs(cur.charAt(j))) j++;
          i = j; n++;
        }
        shown = i;
      };
      const tick = () => {
        timer = 0;
        if (fin) return;
        const before = shown;
        advance();
        if (shown !== before) render();
        if (cur.length > shown) timer = setTimeout(tick, TICK); else settle();
      };
      const kick = () => { if (!timer && !fin) timer = setTimeout(tick, TICK); };
      let raf = 0;
      const show = () => { shown = cur.length; if (!raf && !fin) raf = requestAnimationFrame(() => { raf = 0; if (!fin) render(); }); };
      const flushNow = () => { shown = cur.length; settle(); };
      const drain = () => new Promise((res) => {
        if (!live || cur.length <= shown) return res();
        ending = true; drainRes = res; kick();
        setTimeout(flushNow, 4000);   /* اگر به هر دلیل تمام نشد، گیر نکن */
      });
      stopHook = flushNow;
      const finish = (full) => {
        fin = true;
        if (timer) { clearTimeout(timer); timer = 0; }
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (!live) return;
        const rest = full.slice(stableLen);
        if (rest.trim()) {
          const tmp = document.createElement("div");
          tmp.innerHTML = ttMd(rest);
          const added = [];
          while (tmp.firstChild) { const nd = tmp.firstChild; added.push(nd); liveB.insertBefore(nd, tail); }
          added.forEach((nd) => { if (nd.nodeType === 1) renderMath(nd); });
        }
        tail.remove();
        live.classList.remove("streaming");
        live._t = full;
        downSync();
      };
      log.setAttribute("aria-busy", "true");
      log.setAttribute("aria-live", "off");
      let acked = false;
      const r = await ask(h, (t) => {
        if (!alive || !ok() || key !== st.active) return;
        cur = t;
        if (!live) {
          ty.remove();
          live = bubble("ai", "", "in streaming");
          if (room) live.style.minHeight = room + "px";
          liveB = live.querySelector(".tt-b");
          tail = document.createElement("div");
          tail.className = "tt-tail";
          liveB.appendChild(tail);
          log.appendChild(live);
        }
        show();
      }, (ids) => {   /* عکس‌ها روی دیتابیس ذخیره شد: از این به بعد فقط شناسه‌شان با گفت‌وگو می‌ماند */
        if (acked || !alive || !ids.length) return;
        acked = true;
        const f = ids.filter((x) => typeof x === "string" && TT_FID.test(x)).slice(0, 5);
        if (f.length) { um.f = f; persist(); }
        if (mine.length && key === st.active) { atts = []; attDraw(); clipSync(); }
      }, mine);
      if (alive && ok() && live && !r.stopped) { await drain(); if (FADE && alive && ok() && !userStop) await sleep(FADE); } else flushNow();
      stopHook = null;
      if (timer) { clearTimeout(timer); timer = 0; }
      fin = true;
      log.removeAttribute("aria-busy");
      log.setAttribute("aria-live", "polite");
      if (!alive || !ok()) return;
      busy = false;
      ty.remove();
      /* موجودی پولک: سرور بعد از کسر ۲ پولک موجودی تازه را می‌فرستد؛ اگر نفرستاد، از سرور می‌پرسیم */
      if (typeof r.tokens === "number") tkSet(r.tokens);
      else if (!forced) tkSync(true);
      const willAuto = !!(r.reply && r.inc && !r.stopped && !userStop && autoLeft > 0 && key === st.active);
      if (r.reply) {
        chat.msgs.push(r.inc ? { r: "a", c: r.reply, p: 1 } : { r: "a", c: r.reply });
        if (chat.msgs.length > MAX_MSGS) chat.msgs = chat.msgs.slice(-MAX_MSGS);
        chat.t = Date.now();
        persist();
        renderSide();
        if (key === st.active) {
          if (live && live.isConnected) {
            finish(r.reply);
            if (r.inc && !willAuto) incNote(live, ttSafe(r.error), true);
          } else {
            const el = bubble("ai", r.reply, "in", r.inc && !willAuto ? { btn: true } : null);
            if (room) el.style.minHeight = room + "px";
            log.appendChild(el);
            scrollToEl(el);
          }
        }
      } else if (key === st.active) {
        if (live) live.remove();
        lastFailed = text;
        const broke = r.code === "insufficient";
        if (broke) {   /* پولک کافی نبود: پیام برمی‌گردد توی کادر تا بعد از خرید دوباره بفرستد */
          const arr = chat.msgs;
          if (arr.length && arr[arr.length - 1].r === "u") arr.pop();
          if (!arr.length && !chat.man) { chat.title = ""; chat.ai = false; chat.seq++; }   /* پیامی نمانده؛ عنوان هم پاک می‌شود تا با پیام بعدی دوباره ساخته شود */
          persist(); renderSide(); lastFailed = null;
          if (!forced) { ta.value = text; autosize(); }
          renderLog();
        }
        const e = document.createElement("div");
        e.className = "tt-m ai err";
        e.setAttribute("role", "alert");
        e.innerHTML = '<span class="tt-av">!</span><div class="tt-b"></div>';
        e.querySelector(".tt-b").textContent = ttSafe(r.error);
        if (broke) {
          const bb = document.createElement("a");
          bb.className = "btn small"; bb.href = "/tokens"; bb.textContent = "خرید پولک";
          e.querySelector(".tt-b").appendChild(document.createElement("br"));
          e.querySelector(".tt-b").appendChild(bb);
        } else if (r.code !== "limit" && r.code !== "no_session") {
          const rb = document.createElement("button");
          rb.type = "button"; rb.className = "btn ghost small"; rb.textContent = "تلاش دوباره";
          rb.addEventListener("click", () => submit(true));
          e.querySelector(".tt-b").appendChild(document.createElement("br"));
          e.querySelector(".tt-b").appendChild(rb);
        }
        log.appendChild(e);
        downSync();
        if (r.code === "no_session") setTimeout(() => { if (ok()) go("/signup"); }, 1800);
      }
      sync();
      if (willAuto) { autoLeft--; setTimeout(() => { if (alive && ok() && !busy) submit(false, "ادامه بده"); }, 500); }
      else if (fine.matches) { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }

    const fine = window.matchMedia("(pointer: fine)");
    ta.addEventListener("input", () => { autosize(); sync(); });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && fine.matches) { e.preventDefault(); if (!busy) submit(); } });
    $("ttForm").addEventListener("submit", (e) => { e.preventDefault(); if (busy) stop(); else submit(); });
    $("ttChg").addEventListener("click", openPick);
    const clipSync = () => {
      const v = !!aiModel(st.model).vision;
      $("ttClip").hidden = !v;
      if (!v && atts.length) attReset();
      ta.placeholder = v && atts.length ? "درباره‌ی عکس بپرس…" : phText();
      sync(); fit();
    };
    const attDraw = () => {
      const bx = $("ttAts");
      bx.textContent = "";
      atts.forEach((it, i) => {
        const w = document.createElement("span");
        w.className = "tt-at";
        const im = document.createElement("img"); im.alt = "عکس پیوست‌شده"; im.src = it.t || it.u;
        const x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", "حذف عکس"); x.innerHTML = CI.close; x.disabled = busy;
        x.addEventListener("click", () => { if (busy) return; atts.splice(i, 1); attDraw(); clipSync(); ta.focus(); });
        w.appendChild(im); w.appendChild(x); bx.appendChild(w);
      });
      $("ttAttBox").hidden = !atts.length;
    };
    const attReset = () => { atts = []; attDraw(); ta.placeholder = phText(); };
    /* عکس را کوچک می‌کنیم (حداکثر ۱۲۸۰ پیکسل، JPEG) تا سریع بالا برود، و یک بندانگشتیِ کوچک هم برای نمایش در گفت‌وگو می‌سازیم */
    const readImg = (file) => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        try {
          let w = im.naturalWidth, h = im.naturalHeight;
          if (!w || !h) throw new Error("size");
          const draw = (max, q0, limit) => {
            const k = Math.min(1, max / Math.max(w, h));
            const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
            const c = document.createElement("canvas");
            c.width = cw; c.height = ch;
            const g = c.getContext("2d");
            g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch); g.drawImage(im, 0, 0, cw, ch);
            let q = q0, out = c.toDataURL("image/jpeg", q);
            while (out.length > limit && q > 0.35) { q -= 0.12; out = c.toDataURL("image/jpeg", q); }
            c.width = c.height = 0;
            return out;
          };
          const u = draw(1280, 0.84, 1600000), t = draw(256, 0.72, 55000);
          URL.revokeObjectURL(url); resolve({ u: u, t: t });
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
      im.src = url;
    });
    $("ttClip").addEventListener("click", () => { if (!busy && !reading && atts.length < ATT_MAX) $("ttFile").click(); });
    $("ttFile").addEventListener("change", async () => {
      const all = Array.prototype.slice.call($("ttFile").files || []);
      $("ttFile").value = "";
      if (!all.length || busy || reading || !alive) return;
      const isImg = (f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(f.name);
      const imgs = all.filter(isImg);
      if (!imgs.length) { toast("فقط فایل عکس را می‌شود پیوست کرد."); return; }
      const small = imgs.filter((f) => f.size <= 25 * 1024 * 1024);
      if (!small.length) { toast("حجم عکس زیاد است؛ عکس کوچک‌تری انتخاب کنید."); return; }
      reading = true; sync();
      let bad = 0;
      try {
        for (let i = 0; i < small.length && atts.length < ATT_MAX; i++) {
          try {
            const d = await readImg(small[i]);
            if (!alive || !aiModel(st.model).vision) return;
            if (atts.length < ATT_MAX) atts.push(d);
          } catch (e) { bad++; }
        }
      } finally { reading = false; }
      if (!alive) return;
      attDraw();
      if (bad && !atts.length) toast("این عکس باز نشد. یک عکس JPG یا PNG انتخاب کنید.");
      ta.placeholder = atts.length ? "درباره‌ی عکس بپرس…" : phText();
      sync(); fit(); if (fine.matches) { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    });
    /* ---------- نوار کناریِ گفت‌وگوها (چند گفت‌وگوی مستقل) ---------- */
    const NEWT = "گفت‌وگوی جدید";
    const wide = window.matchMedia("(min-width: 1100px)");   /* عریض: نوار همیشه کنار صفحه است؛ باریک: کشویی */
    const hdrEl = document.querySelector(".top");
    const side = document.createElement("aside");
    side.className = "tt-side";
    side.id = "ttSide";
    side.setAttribute("aria-label", "گفت‌وگوها");
    side.innerHTML = '<div class="ts-head"><h2>گفت‌وگوها</h2><button class="ts-x" id="tsX" type="button" aria-label="بستن فهرست">' + CI.close + "</button></div>" +
      '<button class="btn ts-new" id="tsNew" type="button">' + TT_NEW + "<span>" + NEWT + "</span></button>" +
      '<nav class="ts-list" id="tsList" aria-label="فهرست گفت‌وگوها"></nav>';
    const sideOv = document.createElement("div");
    sideOv.className = "ts-ov";
    document.body.appendChild(sideOv);
    document.body.appendChild(side);
    let collapsed = store.get(SIDEKEY, "") === "1";   /* فقط در حالت عریض */
    let drawer = false;                               /* فقط در حالت باریک */
    let renaming = "", menuEl = null;
    const isOpen = () => (wide.matches ? !collapsed : drawer);
    const sbs = () => [$("ttSb1"), $("ttSb2")];
    const visibleSb = () => sbs().filter((b) => b && b.offsetParent !== null)[0] || null;
    const setTop = () => { side.style.setProperty("--ts-top", (hdrEl ? Math.round(hdrEl.getBoundingClientRect().bottom) : 64) + "px"); };
    function applySide() {
      const open = isOpen();
      side.classList.toggle("on", open);
      sideOv.classList.toggle("on", !wide.matches && drawer);
      document.documentElement.classList.toggle("tt-side-on", wide.matches && !collapsed);
      sbs().forEach((b) => { if (b) b.setAttribute("aria-expanded", String(open)); });
      if ("inert" in side) side.inert = !open;
      setTop();
    }
    function closeDrawer(noFocus) {
      if (wide.matches || !drawer) return;
      drawer = false;
      applySide();
      if (!noFocus) { const b = visibleSb(); if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
    }
    function toggleSide() {
      if (wide.matches) { collapsed = !collapsed; store.set(SIDEKEY, collapsed ? "1" : "0"); applySide(); fit(); return; }
      drawer = !drawer;
      applySide();
      if (drawer) { try { $("tsNew").focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      else { const b = visibleSb(); if (b) { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
    }
    const subLine = (c) => ((c.grade && c.grade !== "عمومی") ? c.grade + " · " : "") + (c.subj || "");
    const titleOf = (c) => c.title || NEWT;

    function renderSide(flashId) {
      if (!alive || renaming) return;   /* وسط تغییر نام، فهرست دوباره ساخته نمی‌شود */
      const list = $("tsList");
      if (!list) return;
      const sc = list.scrollTop;
      list.textContent = "";
      st.chats.slice().sort((x, y) => y.t - x.t).forEach((c) => {
        const it = document.createElement("div");
        it.className = "ts-it" + (c.id === st.active ? " on" : "");
        it.setAttribute("data-id", c.id);
        const op = document.createElement("button");
        op.type = "button"; op.className = "ts-open";
        if (c.id === st.active) op.setAttribute("aria-current", "true");
        const t = document.createElement("span");
        t.className = "ts-t" + (c.title ? "" : " ts-empty") + (c.id === flashId ? " fresh" : "");
        t.textContent = titleOf(c);
        op.appendChild(t);
        const sl = subLine(c);
        if (sl) { const sm = document.createElement("small"); sm.textContent = sl; op.appendChild(sm); }
        const mo = document.createElement("button");
        mo.type = "button"; mo.className = "ts-more";
        mo.setAttribute("aria-haspopup", "menu");
        mo.setAttribute("aria-label", "گزینه‌های «" + titleOf(c) + "»");
        mo.innerHTML = TT_DOTS;
        it.appendChild(op); it.appendChild(mo);
        list.appendChild(it);
      });
      list.scrollTop = sc;
      side.classList.toggle("busy", busy);
    }

    const closeMenu = () => { if (menuEl) { menuEl.remove(); menuEl = null; } };
    const openChatMenu = (id, anchor, x, y, fromKey) => {
      closeMenu();
      if (!chatById(id)) return;
      menuEl = document.createElement("div");
      menuEl.className = "cmenu" + (fromKey ? " kb" : "");
      menuEl.setAttribute("role", "menu");
      menuEl.setAttribute("aria-label", "گزینه‌های گفت‌وگو");
      menuEl.innerHTML = '<button type="button" role="menuitem" data-a="rn">' + CI.edit + "<span>تغییر نام</span></button>" +
        '<button type="button" role="menuitem" class="dng" data-a="del">' + CI.trash + "<span>حذف</span></button>";
      document.body.appendChild(menuEl);
      const ar = anchor ? anchor.getBoundingClientRect() : null;
      const px = ar ? ar.left : x, py = ar ? ar.bottom + 4 : y;
      const w = menuEl.offsetWidth, h = menuEl.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      menuEl.style.left = Math.max(8, Math.min(px, vw - w - 8)) + "px";
      menuEl.style.top = Math.max(8, py + h + 8 > vh ? (ar ? ar.top - h - 4 : py - h) : py) + "px";
      const back = () => { if (anchor && anchor.isConnected) { try { anchor.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } };
      menuEl.addEventListener("click", (e) => {
        const bt = e.target.closest ? e.target.closest("button[data-a]") : null;
        if (!bt) return;
        const a = bt.getAttribute("data-a");
        closeMenu();
        if (a === "rn") startRename(id); else delChat(id);
      });
      menuEl.addEventListener("keydown", (e) => {
        const bs = Array.prototype.slice.call(menuEl.querySelectorAll("button")), i = bs.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
        else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); closeMenu(); back(); }
      });
      menuEl.querySelector("button").focus({ preventScroll: true });
    };

    function startRename(id) {
      const c = chatById(id);
      const it = c && $("tsList").querySelector('.ts-it[data-id="' + id + '"]');
      if (!it || renaming) return;
      renaming = id;
      const op = it.querySelector(".ts-open");
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "ts-rn"; inp.maxLength = 60; inp.value = c.title; inp.placeholder = NEWT;
      inp.setAttribute("dir", "auto"); inp.setAttribute("aria-label", "نام گفت‌وگو"); inp.autocomplete = "off";
      op.replaceWith(inp);
      it.classList.add("rn");
      it.querySelector(".ts-more").hidden = true;
      inp.focus(); inp.select();
      let done = false;
      const end = (save) => {
        if (done) return;
        done = true; renaming = "";
        if (save) {
          const v = inp.value.replace(/\s+/g, " ").trim().slice(0, 60), cc = chatById(id);
          if (cc && v && v !== cc.title) { cc.title = v; cc.man = true; cc.ai = false; cc.seq++; persist(); }
        }
        renderSide();
        const nb = $("tsList") && $("tsList").querySelector('.ts-it[data-id="' + id + '"] .ts-open');
        if (nb && document.activeElement === document.body) { try { nb.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      };
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); end(true); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(false); }
      });
      inp.addEventListener("blur", () => end(true));
    }

    /* رفتن به یک گفت‌وگو (بدون هیچ شرطی؛ شرط‌ها در صدازننده‌هاست) */
    function activate(id) {
      const c = chatById(id);
      if (!c) return;
      st.active = id; prevSel = null; lastFailed = null; attReset();
      if (c.grade && c.subj) { st.grade = c.grade; st.subject = c.subj; st.other = ""; st.book = c.book; mode = "chat"; }
      else mode = "pick";
      persist(); renderLog(); renderPick(); applyCfg(); sync(); clipSync(); renderSide();
      try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
      requestAnimationFrame(fit);
    }
    const busyToast = () => toast("تا تمام شدن پاسخ صبر کن، یا آن را متوقف کن.");
    const switchTo = (id) => {
      if (id === st.active && mode === "chat") { closeDrawer(); return; }
      if (busy) { busyToast(); return; }
      activate(id);
      closeDrawer(true);
      if (mode === "chat" && fine.matches) { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    };
    const newChat = () => {
      if (busy) { busyToast(); return; }
      const c = curChat();
      if (c && !c.msgs.length && mode === "chat") { closeDrawer(true); if (fine.matches) ta.focus(); return; }   /* همین الان یک گفت‌وگوی خالی باز است */
      const base = c && c.grade && c.subj ? c : null;
      const d = newChatObj(base ? base.grade : "", base ? base.subj : "", base ? base.book : "");
      st.chats.push(d);
      activate(d.id);
      closeDrawer(true);
      if (mode === "chat" && fine.matches) { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    };
    async function delChat(id) {
      const c = chatById(id);
      if (!c) return;
      if (busy && id === st.active) { toast("اول پاسخ را متوقف کن، یا صبر کن تمام شود."); return; }
      const yes = await askConfirm({ title: "حذف گفت‌وگو؟", text: "«" + titleOf(c) + "» برای همیشه پاک می‌شود.", yes: "حذف", danger: true });
      if (!yes || !alive || !ok() || !chatById(id)) return;
      if (busy && id === st.active) return;   /* وسط پرسیدنِ تأیید، پاسخی شروع شده */
      const was = id === st.active;
      const gone = chatById(id);
      st.chats = st.chats.filter((x) => x.id !== id);
      if (gone) TCS.del(owner, gone);
      if (was) {
        const nx = st.chats.slice().sort((x, y) => y.t - x.t)[0];
        if (nx) activate(nx.id);
        else { const d = newChatObj(c.grade, c.subj, c.book); st.chats.push(d); activate(d.id); }
      } else { persist(); renderSide(); }
    }

    /* نام‌گذاری خودکار: همان لحظه‌ی اولین پیام یک درخواست کوتاه می‌رود؛ تا برسد، خودِ پیام (کوتاه‌شده) عنوان است. پولک کم نمی‌شود. */
    async function titleCall(text, grade, subj) {
      const s = auth.get();
      if (!s) return "";
      const c2 = window.AbortController ? new AbortController() : null;
      const tm = setTimeout(() => { try { if (c2) c2.abort(); } catch (e) { /* ignore */ } }, 15000);
      try {
        const res = await fetch(cfg.SUPABASE_URL + "/functions/v1/tutor", {
          method: "POST",
          signal: c2 ? c2.signal : undefined,
          headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
          body: JSON.stringify({ token: s.token, action: "title", text: String(text).slice(0, 400), grade: grade === "عمومی" ? "" : grade, subject: subj }),
        });
        if (!res.ok) return "";
        const d = await res.json();
        return d && typeof d.title === "string" ? d.title : "";
      } catch (e) { return ""; } finally { clearTimeout(tm); }
    }
    function nameChat(chat, text) {
      if (chat.man) return;
      const prov = provTitle(text);
      chat.title = prov; chat.ai = false;
      const seq = ++chat.seq, id = chat.id;
      titleCall(text, chat.grade, chat.subj).then((t) => {
        t = String(t || "").replace(/\s+/g, " ").trim().slice(0, 60);
        if (!t) return;
        if (alive) {
          const c = chatById(id);
          if (!c || c.man || c.seq !== seq || !c.msgs.length) return;
          c.title = t; c.ai = true;
          persist(); renderSide(id);
        } else {   /* صفحه بسته شده: فقط همین عنوان در حافظه به‌روز می‌شود */
          TCS.setTitle(owner, id, prov, t);
        }
      });
    }

    /* رویدادها */
    $("tsList").addEventListener("click", (e) => {
      const t = e.target.closest ? e.target.closest("button") : null;
      const it = t && t.closest(".ts-it");
      if (!t || !it) return;
      const id = it.getAttribute("data-id");
      if (t.classList.contains("ts-open")) switchTo(id);
      else if (t.classList.contains("ts-more")) openChatMenu(id, t, 0, 0, e.detail === 0);
    });
    $("tsList").addEventListener("dblclick", (e) => {
      const t = e.target.closest ? e.target.closest(".ts-open") : null;
      if (t) startRename(t.closest(".ts-it").getAttribute("data-id"));
    });
    $("tsList").addEventListener("contextmenu", (e) => {
      const it = e.target.closest ? e.target.closest(".ts-it") : null;
      if (!it || it.classList.contains("rn")) return;
      e.preventDefault();
      openChatMenu(it.getAttribute("data-id"), null, e.clientX, e.clientY, false);
    });
    $("tsList").addEventListener("scroll", closeMenu, { passive: true });
    $("tsNew").addEventListener("click", newChat);
    $("tsX").addEventListener("click", () => closeDrawer());
    sideOv.addEventListener("click", () => closeDrawer());
    sbs().forEach((b) => b.addEventListener("click", toggleSide));
    $("ttNew").addEventListener("click", newChat);
    const onDocDown = (e) => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); };
    const onDocKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (drawer && !wide.matches && !document.querySelector(".modal")) { e.preventDefault(); closeDrawer(); }
    };
    const onWide = () => { drawer = false; closeMenu(); applySide(); fit(); };
    document.addEventListener("pointerdown", onDocDown, true);
    document.addEventListener("keydown", onDocKey);
    window.addEventListener("resize", closeMenu);
    if (wide.addEventListener) wide.addEventListener("change", onWide); else if (wide.addListener) wide.addListener(onWide);
    $("ttBack").addEventListener("click", backToChat);

    applySide(); renderSide();
    renderPick(); renderLog(); applyCfg(); sync(); autosize(); clipSync();
    requestAnimationFrame(fit);
    setTimeout(fit, 700);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

    /* همگام‌سازی با حساب: همین حالا، و هر بار که به برنامه برمی‌گردیم یا اینترنت وصل می‌شود */
    const mergeFromServer = (out, info) => {
      if (!alive || !ok()) return;
      const prev = st.active;
      st.chats = out;
      const c = curChat();
      if (!c) {   /* گفت‌وگوی بازِ این صفحه در دستگاه دیگری حذف شده */
        const nx = st.chats.slice().sort((x, y) => y.t - x.t)[0];
        if (nx) activate(nx.id);
        else { const d = newChatObj(); st.chats.push(d); activate(d.id); }
        return;
      }
      if (info.changed.indexOf(prev) >= 0) {   /* همین گفت‌وگو در دستگاه دیگری ادامه پیدا کرده */
        if (c.grade && c.subj) { st.grade = c.grade; st.subject = c.subj; st.other = ""; st.book = c.book; if (mode !== "pick") mode = "chat"; }
        renderLog(); renderPick(); applyCfg(); sync(); clipSync();
      }
      persist(); renderSide();
    };
    const pullView = {
      chats: () => st.chats,
      skip: () => { const k = {}; if (busy) k[st.active] = 1; if (renaming) k[renaming] = 1; return k; },
      done: mergeFromServer,
    };
    const doPull = (force) => { if (alive && ok() && !document.hidden) TCS.pull(owner, pullView, force); };
    const onVis = () => doPull(false);
    const onOnline = () => { TCS.kick(); doPull(true); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("online", onOnline);
    TCS.kick();
    doPull(true);
    return function () {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("online", onOnline);
      try { if (ctl) ctl.abort(); } catch (e) { /* ignore */ }
      window.removeEventListener("resize", onResize);
      if (window.visualViewport) { window.visualViewport.removeEventListener("resize", onResize); window.visualViewport.removeEventListener("scroll", fit); }
      document.documentElement.classList.remove("tt-page", "tt-side-on", "tt-chat");
      document.documentElement.style.removeProperty("--vvh"); document.documentElement.style.removeProperty("--vvt");
      closePic();
      fcache.forEach((pr) => { pr.then((u) => { if (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } } }); });
      fcache.clear();
      document.removeEventListener("pointerdown", onDocDown, true);
      document.removeEventListener("keydown", onDocKey);
      window.removeEventListener("resize", closeMenu);
      if (wide.removeEventListener) wide.removeEventListener("change", onWide); else if (wide.removeListener) wide.removeListener(onWide);
      closeMenu();
      side.remove(); sideOv.remove();
    };
  }

  /* ---------- مسیریابی ---------- */
  let routeToken = 0;
  let cleanup = null;
  let first = true;
  /* انیمیشنِ ورودِ محتوا فقط بار اولِ دیدنِ هر بخش (خانه، ساخت آزمون، گروه…) */
  const fxSeen = new Set();
  let fxTimer = 0;
  const fxOff = () => { clearTimeout(fxTimer); app.classList.remove("fx"); };
  app.addEventListener("click", fxOff, true);   /* نه در pointerdown: وسط کلیک نباید چیزی جابه‌جا شود */
  app.addEventListener("keydown", fxOff, true);

  /* کلید مدیریتِ آزمون از حساب کاربر خوانده می‌شود (نه از آدرس): اول حافظه‌ی همین صفحه، بعد آزمون‌های روی این دستگاه، بعد سرور */
  function withSecret(kind, id, query, token) {
    const run = (secret) => {
      if (token !== routeToken) return;
      if (kind === "m") viewManage(id, secret, /(^|&)new=1(&|$)/.test(query), token, { updated: /(^|&)updated=1(&|$)/.test(query), cleared: +((/(^|&)cleared=(\d+)/.exec(query) || [])[2] || 0) });
      else viewEdit(id, secret, token);
    };
    if (memSecrets[id]) { run(memSecrets[id]); return null; }
    const loc = store.localQuizzes().filter((x) => x.id === id)[0];
    if (loc && loc.secret) { run(loc.secret); return null; }
    const s = auth.get();
    if (!s) return viewGate(kind + "/" + id, token);
    setTitle();
    app.innerHTML = '<p class="muted">در حال بارگذاری…</p>';
    const load = () => rpc("quiz_secret", { p_token: s.token, p_id: id }).then((r) => {
      if (token !== routeToken) return;
      if (r && r.ok && r.secret) { memSecrets[id] = r.secret; run(r.secret); }
      else if (r && r.error === "no_session") { auth.clear(); go("/signup?next=" + kind + "/" + encodeURIComponent(id), true); }
      else showError("این آزمون در حساب شما نیست. با حسابی که آزمون را ساخته (یا مالک/مدیر گروه آن هستید) وارد شوید.");
    }).catch((e) => { if (token === routeToken) showError(e.message, load); });
    load();
    return null;
  }

  function route() {
    if (gateOn) closeGate();
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    const token = ++routeToken;
    const initial = first;
    first = false;

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) { showSetup(); return; }

    upgradeLegacy();
    const path = location.pathname;
    const query = location.search.replace(/^\?/, "");
    const parts = path.split("/").filter(Boolean).map(safeDecode);
    const okId = (s) => /^[A-Za-z0-9_-]{1,64}$/.test(s || "");

    /* سئو: فقط صفحه‌ی اصلی در گوگل می‌آید؛ بقیه (آزمون‌ها، حساب، گروه‌ها، آدرس نامعتبر) noindex و canonical درست می‌گیرند */
    try {
      const home = parts.length === 0, cn = document.querySelector('link[rel="canonical"]'), rb = document.querySelector('meta[name="robots"]');
      if (cn) cn.setAttribute("href", "https://pazmoonak.com" + (home ? "/" : location.pathname));
      if (rb) rb.setAttribute("content", home ? "index,follow,max-snippet:-1,max-image-preview:large" : "noindex,nofollow");
    } catch (e) { /* ignore */ }

    createGroup = parts[0] === "create" ? ((/(^|&)g=([0-9a-f]{8})(&|$)/.exec(query) || [])[2] || "") : "";

    const kind = parts[0] || "home";
    fxOff();
    if (!fxSeen.has(kind) && !reduceMotion()) {
      fxSeen.add(kind);
      app.classList.add("fx");
      fxTimer = setTimeout(fxOff, 1600);
    }

    if (!initial) window.scrollTo(0, 0);
    const tb = document.getElementById("tkBtn");
    if (tb) { if (parts[0] === "tokens") tb.setAttribute("aria-current", "page"); else tb.removeAttribute("aria-current"); }
    const hb = document.getElementById("homeBtn");
    if (hb) { if (parts.length === 0) hb.setAttribute("aria-current", "page"); else hb.removeAttribute("aria-current"); }

    if (parts[0] === "q") {
      if (!okId(parts[1])) showError("لینک آزمون نامعتبر است.");
      else if (!auth.get()) cleanup = viewGate("q/" + parts[1], token);
      else viewTake(parts[1], token);
    } else if (parts[0] === "m" || parts[0] === "edit") {
      if (!okId(parts[1])) showError("لینک مدیریت نامعتبر است.");
      else cleanup = withSecret(parts[0], parts[1], query, token);
    } else if (parts[0] === "groups") {
      cleanup = auth.get() ? viewGroups(token) : viewGate("groups", token);
    } else if (parts[0] === "g") {
      if (!GROUP_ID_RE.test(parts[1] || "")) showError("لینک گروه نامعتبر است.");
      else cleanup = auth.get() ? viewGroup(parts[1], token) : viewGate("g/" + parts[1], token);
    } else if (parts[0] === "signup") {
      const nx = ((/(^|&)next=([^&]*)/.exec(query) || [])[2] || "");
      /* بعد از ثبت‌نام/ورود همیشه به خانه می‌رود؛ فقط لینک مستقیم یک آزمون (q/…) یا نتایجش (m/…) بعد از ورود باز می‌شود */
      signupNext = /^((q|m)\/[A-Za-z0-9_-]{1,64}|wallet|tokens)$/.test(nx) ? nx : "";
      cleanup = viewSignup();
    } else if (parts[0] === "tutor") {
      if (!TUTOR_ON) go("/", true);
      else cleanup = auth.get() ? viewTutor(token) : viewGate("tutor", token);
    } else if (parts[0] === "tokens") {
      cleanup = auth.get() ? viewTokens(token) : viewGate("tokens", token);
    } else if (parts[0] === "wallet") {
      cleanup = auth.get() ? viewWallet(token) : viewGate("wallet", token);
    } else if (parts[0] === "admin") {
      cleanup = viewAdmin(token);
    } else if (parts[0] === "account") {
      cleanup = viewAccount();
    } else if (parts[0] === "create" && !auth.get()) {
      cleanup = viewGate(parts.slice(0, 2).join("/"), token);
    } else if (parts[0] === "create") {
      if (parts[1] === "ai") cleanup = viewAI();
      else if (parts[1] === "files") cleanup = viewFiles();
      else if (ACTIVE_MODES.indexOf(parts[1]) >= 0) cleanup = viewBuild(parts[1], /(^|&)draft=1(&|$)/.test(query));
      else viewChoose();
    } else {
      viewHome();
    }
    if (!initial) app.focus({ preventScroll: true });
  }

  /* دکمه‌ی «عقب/جلو» مرورگر (و لینک‌های قدیمی با #) */
  function onNavigate() {
    if (genLockHash !== null) {
      if (curPath() !== genLockHash) { try { history.pushState(null, "", genLockHash); } catch (e) { /* ignore */ } }
      return;
    }
    window.dispatchEvent(new Event("pz:nav"));
    route();
  }
  window.addEventListener("popstate", onNavigate);
  window.addEventListener("hashchange", () => { if (/^#\//.test(location.hash)) onNavigate(); });
  /* لینک‌های داخلی بدون بارگذاری دوباره‌ی صفحه باز می‌شوند (تب جدید، Ctrl/⌘ و کلیک وسط همان رفتار عادی مرورگر را دارند) */
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const h = a.getAttribute("href") || "";
    if (h.charAt(0) !== "/" || h.charAt(1) === "/") return;
    /* صفحه‌های راهنمای ثابت (/azmoon-…) صفحه‌ی جدا هستند، نه مسیر برنامه: با بارگذاری معمولی باز می‌شوند */
    if (/^\/azmoon-[a-z0-9-]+\/?(?:[?#]|$)/.test(h)) return;
    e.preventDefault();
    go(h);
  });
  const menuBtn = document.getElementById("menuBtn");
  if (menuBtn) menuBtn.addEventListener("click", () => { if (menuClose) menuClose(); else openMenu(); });
  window.addEventListener("authchange", () => { if (menuClose) menuClose(true); });
  window.addEventListener("authchange", syncInviteWatch);
  syncAuthBtn();
  route();
  syncInviteWatch();
  validateSession();
  fzSync();
})();
