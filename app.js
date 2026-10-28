/* پازمونک: منطق برنامه
 * مسیرها:
 *   #/                          صفحه‌ی اصلی
 *   #/create                    انتخاب مدل آزمون
 *   #/create/<tf|mcq|mixed>     ساخت آزمون
 *   #/q/<id>                    شرکت در آزمون
 *   #/m/<id>/<secret>           مدیریت و نتایج
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
    return location.origin + location.pathname;
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
    /* اول فایل داخل خود سایت (katex-bundle.js، همه‌چیز در یک فایل)، اگر نبود از cdnjs */
    katexP = addScript("katex-bundle.js")
      .catch(() => addCss(KATEX + "katex.min.css").then(() => addScript(KATEX + "katex.min.js")).then(() => addScript(KATEX + "contrib/auto-render.min.js")))
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
      if (!ok || !window.renderMathInElement || !root.isConnected) return;
      try {
        window.renderMathInElement(root, {
          delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }],
          throwOnError: false,
          ignoredTags: ["script", "style", "textarea", "input", "option"],
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

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    del(k) {
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
          else if (r && r.error === "not_found") store.removeQuiz(m.id);
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
    document.title = t ? t + " | " + BASE_TITLE : BASE_TITLE + " | ساخت آزمون آنلاین با هوش مصنوعی";
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
      '<a class="btn ghost" href="#/">بازگشت به صفحه‌ی اصلی</a></div>';
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
  const isHomeHash = () => !location.hash || location.hash === "#" || location.hash === "#/";

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
          '<div class="actions" style="justify-content:center"><a class="btn" href="#/create">ساخت اولین آزمون</a>' + (sess ? '<a class="btn ghost" href="#/groups">گروه‌ها</a>' : "") + "</div></div>";
        return;
      }
      app.innerHTML =
        (note || "") +
        '<div class="card"><h2>' + (sess ? "آزمون‌های شما" : "آزمون‌هایی که روی این دستگاه ساخته‌اید") + "</h2>" +
        items.map((m) =>
          '<div class="mine-row"><span class="mine-t">' + esc(m.title) +
          (m.participants != null ? '<small class="mine-n">' + faNum(m.participants) + " شرکت‌کننده</small>" : "") + "</span>" +
          '<a class="btn small ghost" href="#/q/' + encodeURIComponent(m.id) + '">باز کردن</a>' +
          '<a class="btn small" href="#/m/' + encodeURIComponent(m.id) + "/" + encodeURIComponent(m.secret) + '">نتایج</a></div>'
        ).join("") +
        (sess ? "" : '<p class="hint">این آزمون‌ها فقط روی همین دستگاه هستند. برای اینکه روی حسابتان بمانند و از هر دستگاهی ببینیدشان، <a href="#/signup">وارد شوید یا ثبت‌نام کنید</a>.</p>') +
        "</div>" +
        '<div class="actions"><a class="btn" href="#/create">ساخت آزمون جدید</a>' + (sess ? '<a class="btn ghost" href="#/groups">گروه‌ها</a>' : "") + "</div>";
    };

    if (!sess) { draw(store.localQuizzes(), ""); return; }

    const my = routeToken;
    app.innerHTML = '<div class="card"><p class="muted">در حال بارگذاری آزمون‌های شما…</p></div>';
    loadAccountQuizzes(sess).then((res) => {
      if (my !== routeToken) return;
      const left = store.localQuizzes().filter((m) => !res.items.some((x) => x.id === m.id));
      let note = "";
      if (res.error) note = '<div class="card warn-card"><strong>فهرست حساب‌تان الان بارگذاری نشد.</strong><div class="hint">اتصال اینترنت را بررسی کنید و صفحه را دوباره باز کنید. آزمون‌هایتان گم نشده‌اند.</div></div>';
      else if (left.length) note = '<div class="hint">بعضی آزمون‌ها هنوز فقط روی این دستگاه هستند و بعداً به حساب منتقل می‌شوند.</div>';
      draw(res.items.concat(left), note);
    });
  }

  /* با ورود یا خروج کاربر، فهرست صفحه‌ی اصلی دوباره ساخته می‌شود */
  window.addEventListener("authchange", () => {
    const cur = (auth.get() || {}).token || "";
    if (isHomeHash() && cur !== homeTok && cfg.SUPABASE_URL) viewHome();
    else if (!cur && /^#\/(create|q\/|groups|g\/)/.test(location.hash) && !gateOn && genLockHash === null && cfg.SUPABASE_URL) route();
  });

  /* ---------- انتخاب مدل آزمون ---------- */
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
        : '<a class="card type-card" href="' + withG("#/create/" + m) + '" data-base="#/create/' + m + '">' + inner + "</a>";
    };
    app.innerHTML =
      '<a class="back" href="#/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a>" +
      "<h1>چه مدل آزمونی می‌خواهید؟</h1>" +
      '<p class="muted">یکی از مدل‌ها را انتخاب کنید. در مرحله‌ی بعد سؤال‌ها را می‌نویسید.</p>' +
      (draft
        ? '<div class="card draft"><div><strong>پیش‌نویس ذخیره‌شده دارید</strong><div class="hint">' + (draft.title ? esc(draft.title) + " — " : "") + faNum(draft.questions.length) + ' سؤال</div></div>' +
          '<div class="draft-actions"><a class="btn small" href="' + withG("#/create/" + draft.type + "?draft=1") + '" data-base="#/create/' + draft.type + '?draft=1">ادامه‌ی پیش‌نویس</a>' +
          '<button class="btn small danger" type="button" id="dropDraft">حذف</button></div></div>'
        : "") +
      '<div class="card aud"><strong>این آزمون برای چه کسانی است؟</strong>' +
      '<div class="seg" role="group" aria-label="مخاطب آزمون"><button type="button" data-aud="pub" aria-pressed="' + (!createGroup) + '">همه (عمومی)</button><button type="button" data-aud="grp" aria-pressed="' + (!!createGroup) + '">فقط یک گروه</button></div>' +
      '<p class="hint" id="audHint" style="margin:6px 0 0"></p><div id="audSel" hidden></div></div>' +
      '<div class="types" id="typesBox"><a class="card type-card ai-card" href="' + withG("#/create/ai") + '" data-base="#/create/ai"><span class="ti">' + ICONS.spark + '</span><h3>ساخت با هوش مصنوعی <span class="soon-badge ai-badge">جدید</span></h3>' +
      "<p>یک فایل (PDF، متن یا عکس) بدهید یا فقط موضوع را بنویسید؛ آزمون خودکار ساخته می‌شود و لینکش را همان‌جا می‌گیرید.</p></a>" +
      ["tf", "mcq", "essay", "mixed"].map(card).join("") + "</div>";
    const dropBtn = document.getElementById("dropDraft");
    if (dropBtn) dropBtn.addEventListener("click", () => { store.del("quizDraft"); viewChoose(); });

    /* انتخاب مخاطب: عمومی یا یکی از گروه‌هایی که مدیرش هستید */
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
        selBox.innerHTML = '<p class="hint">شما هنوز گروهی نساخته‌اید.</p><a class="btn small" href="#/groups">ساخت گروه</a>';
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
        owned = gs.filter((g) => g.role === "owner");
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
    const backHref = edit ? "#/m/" + encodeURIComponent(edit.id) + "/" + edit.secret : withG("#/create");
    const nSubs = edit ? edit.submissions : 0;

    let uid = 0;
    const questions = [];
    const newQ = (t) => ({ id: ++uid, type: t, text: "", options: ["", "", "", ""], correct: null, tf: null });
    let titleVal = "";
    let descVal = "";
    let restored = false;

    if (edit) {
      titleVal = String(edit.title || "").slice(0, LIMITS.title);
      descVal = String(edit.description || "").slice(0, LIMITS.desc);
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
    const draftPayload = () => ({
      type: mode,
      title: titleEl.value,
      description: descEl.value,
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

    const fresh = document.getElementById("freshBtn");
    if (fresh) fresh.addEventListener("click", () => { finished = true; clearTimeout(draftTimer); store.del("quizDraft"); location.hash = "#/create/" + mode; route(); });

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
          const r = await rpc("update_quiz", {
            p_id: edit.id,
            p_secret: edit.secret,
            p_title: titleEl.value.trim(),
            p_description: descEl.value.trim(),
            p_questions: serialize(),
            p_confirm_clear: nSubs > 0,
          });
          finished = true;
          await keepQuiz({ id: edit.id, secret: edit.secret, title: titleEl.value.trim() });
          location.hash = "#/m/" + encodeURIComponent(edit.id) + "/" + edit.secret + "?updated=1" + (r && r.cleared ? "&cleared=" + r.cleared : "");
          return;
        }
        const id = await rpc("create_quiz", {
          p_title: titleEl.value.trim(),
          p_description: descEl.value.trim(),
          p_questions: serialize(),
          p_secret: secret,
          p_token: tokenOf(),
          p_group: createGroup || null,
        });
        finished = true;
        clearTimeout(draftTimer);
        store.del("quizDraft");
        await keepQuiz({ id: id, secret: secret, title: titleEl.value.trim() });
        location.hash = "#/m/" + encodeURIComponent(id) + "/" + secret + "?new=1";
      } catch (e) {
        saveBtn.disabled = false;
        saveBtn.classList.remove("loading");
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
    });
    if (token === routeToken) cleanup = c; else if (c) c();
  }

  /* ---------- ساخت آزمون با هوش مصنوعی ---------- */
  /* اسم نشانی تابع روی Supabase (در لیست Edge Functions ستون URL را ببینید) */
  const AI_FN = "node-api";
  const AI_MAX_BYTES = 4 * 1024 * 1024;
  const AI_FILE_TYPES = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword", rtf: "application/rtf",
  };

  function readFileAsB64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("خواندن فایل ممکن نشد."));
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.readAsDataURL(file);
    });
  }
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("خواندن فایل ممکن نشد."));
      r.onload = () => resolve(String(r.result));
      r.readAsText(file, "utf-8");
    });
  }

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

  /* مدل‌های قابل انتخاب. provider/model همان چیزی است که به تابع سرور می‌رود. */
  const AI_MODELS = [
    { id: "ds-v3", group: "DeepSeek", label: "DeepSeek V3", provider: "deepseek", model: "deepseek-chat", textOnly: true },
    { id: "ds-v41", group: "DeepSeek", label: "DeepSeek V4.1", provider: "deepseek", model: "deepseek-flash", textOnly: true },
    { id: "gem-argon", group: "Gemini", label: "Gemini 4 Argon", provider: "gemini", model: "gemini-4-argon" },
    { id: "gem-flash", group: "Gemini", label: "Gemini 3.8 Flash", provider: "gemini", model: "gemini-3.8-flash" },
  ];
  const aiModel = (id) => AI_MODELS.find((m) => m.id === id) || AI_MODELS[3];

  /* قفل کامل برنامه هنگام ساخت آزمون با هوش مصنوعی */
  let genLockHash = null;
  const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; return ""; };
  function setGenLock(on) {
    const els = document.querySelectorAll("header.top, #app");
    els.forEach((el) => { if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert"); });
    document.documentElement.classList.toggle("gen-lock", on);
    if (on) { genLockHash = location.hash; window.addEventListener("beforeunload", onBeforeUnload); }
    else { genLockHash = null; window.removeEventListener("beforeunload", onBeforeUnload); }
  }

  function viewAI() {
    setTitle("ساخت آزمون با هوش مصنوعی");
    setTimeout(fillGroupChip, 0);
    const st = { src: "file", mid: "gem-flash", mode: "mixed", level: "medium", count: 10, file: null };
    let busy = false;
    let ctl = null;

    const seg = (name, items) =>
      '<div class="seg" role="group" data-seg="' + name + '">' +
      items.map((i) => '<button type="button" data-v="' + i[0] + '" aria-pressed="' + String(st[name] === i[0]) + '">' + i[1] + "</button>").join("") + "</div>";

    app.innerHTML =
      '<a class="back" href="' + withG("#/create") + '">' + ICONS.back + " بازگشت به انتخاب مدل</a>" +
      "<h1>ساخت آزمون با هوش مصنوعی</h1>" + (createGroup ? '<div id="grpChipBox">' + groupChip(groupName(createGroup)) + "</div>" : "") +
      '<p class="muted">فایل یا موضوع را بدهید و تنظیمات را انتخاب کنید. آزمون ساخته می‌شود و مثل بقیه‌ی آزمون‌ها لینک شرکت و لینک نتایج را می‌گیرید.</p>' +
      '<div class="card ai-form">' +
      '<label for="mid">مدل هوش مصنوعی</label><select id="mid">' +
      ["DeepSeek", "Gemini"].map((g) => '<optgroup label="' + g + '">' +
        AI_MODELS.filter((m) => m.group === g).map((m) => '<option value="' + m.id + '"' + (m.id === st.mid ? " selected" : "") + ">" + m.label + (m.textOnly ? " (فقط متن و موضوع)" : "") + "</option>").join("") + "</optgroup>").join("") +
      "</select>" +
      '<label>منبع سؤال‌ها</label>' + seg("src", [["file", "از روی فایل"], ["topic", "فقط موضوع (بدون فایل)"]]) +
      '<div id="srcFile"><div class="drop" id="drop" tabindex="0" role="button" aria-label="انتخاب فایل">' + ICONS.upload +
      '<strong id="dropT">فایل را اینجا بکشید یا انتخاب کنید</strong><span class="hint">PDF، Word، متن (TXT یا MD) یا عکس، حداکثر ۴ مگابایت</span></div>' +
      '<input id="file" type="file" accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,.docx,.doc,.rtf,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp" hidden></div>' +
      '<div id="srcTopic" hidden><label for="topic">موضوع آزمون</label><input id="topic" type="text" maxlength="300" placeholder="مثلاً: تاریخ ایران در دوره‌ی صفوی" autocomplete="off"></div>' +
      '<div id="topicExtra"><label for="note">توضیح اضافه (اختیاری)</label><input id="note" type="text" maxlength="300" placeholder="مثلاً: فقط از فصل دوم سؤال بده" autocomplete="off"></div>' +
      '<label>مدل سؤال‌ها</label>' + seg("mode", [["tf", "درست / نادرست"], ["mcq", "تستی"], ["mixed", "مخلوط"]]) +
      '<label>درجه‌ی سختی</label>' + seg("level", [["easy", "آسان"], ["medium", "متوسط"], ["hard", "سخت"]]) +
      '<label for="count">تعداد سؤال</label><div class="stepper"><button type="button" id="cm" aria-label="کمتر">−</button><input id="count" type="text" inputmode="numeric" value="' + faNum(st.count) + '" aria-label="تعداد سؤال"><button type="button" id="cp" aria-label="بیشتر">+</button><span class="hint">از ۱ تا ۳۰</span></div>' +
      "</div>" +
      '<div id="msg"></div>' +
      '<div class="actions"><a class="btn ghost" href="' + withG("#/create") + '">' + ICONS.back + ' بازگشت</a><button class="btn" id="go" type="button">' + ICONS.spark + ' ساخت آزمون و دریافت لینک</button></div>' +
      '<p class="hint" id="wait" hidden>در حال ساخت آزمون… معمولاً ۱۰ تا ۶۰ ثانیه طول می‌کشد. تا پایان کار، همه‌ی دکمه‌ها قفل است. این صفحه را نبندید و از آن خارج نشوید.</p>';

    const $ = (id) => document.getElementById(id);
    const msg = $("msg");
    const fail = (t) => { msg.innerHTML = '<div class="err" role="alert">' + esc(t) + "</div>"; };

    app.querySelectorAll(".seg").forEach((g) => {
      g.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b || busy) return;
        const k = g.dataset.seg;
        st[k] = b.dataset.v;
        g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (k === "src") {
          $("srcFile").hidden = st.src !== "file";
          $("srcTopic").hidden = st.src !== "topic";
          $("topicExtra").hidden = st.src !== "file";
          msg.innerHTML = "";
        }
      });
    });

    $("mid").addEventListener("change", () => { st.mid = $("mid").value; msg.innerHTML = ""; });
    const setCount = (n) => { st.count = Math.min(30, Math.max(1, n)); $("count").value = faNum(st.count); };
    const parseCount = () => {
      const t = $("count").value.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
      return t ? parseInt(t, 10) : st.count;
    };
    $("cm").addEventListener("click", () => { if (!busy) setCount(parseCount() - 1); });
    $("cp").addEventListener("click", () => { if (!busy) setCount(parseCount() + 1); });
    $("count").addEventListener("blur", () => setCount(parseCount()));

    /* انتخاب فایل */
    const fileInput = $("file");
    const drop = $("drop");
    const showFile = () => {
      $("dropT").textContent = st.file ? st.file.name : "فایل را اینجا بکشید یا انتخاب کنید";
      drop.classList.toggle("has", !!st.file);
    };
    const pickFile = (f) => {
      msg.innerHTML = "";
      if (!f) return;
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      const isText = ext === "txt" || ext === "md";
      if (!isText && !AI_FILE_TYPES[ext]) return fail("این نوع فایل پشتیبانی نمی‌شود. PDF، Word، TXT، MD یا عکس انتخاب کنید.");
      if (f.size > AI_MAX_BYTES) return fail("حجم فایل بیشتر از ۴ مگابایت است.");
      if (!f.size) return fail("فایل خالی است.");
      st.file = f;
      showFile();
    };
    drop.addEventListener("click", () => { if (!busy) fileInput.click(); });
    drop.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !busy) { e.preventDefault(); fileInput.click(); } });
    fileInput.addEventListener("change", () => { pickFile(fileInput.files[0]); fileInput.value = ""; });
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => { if (!busy && e.dataTransfer && e.dataTransfer.files) pickFile(e.dataTransfer.files[0]); });

    const go = $("go");
    go.addEventListener("click", async () => {
      if (busy) return;
      msg.innerHTML = "";
      setCount(parseCount());
      const M = aiModel(st.mid);
      const body = { provider: M.provider, model: M.model, mode: st.mode, difficulty: st.level, count: st.count };
      try {
        if (st.src === "file") {
          if (!st.file) return fail("ابتدا یک فایل انتخاب کنید یا گزینه‌ی «فقط موضوع» را بزنید.");
          const ext = (st.file.name.split(".").pop() || "").toLowerCase();
          if (M.textOnly && ext !== "txt" && ext !== "md") return fail("«" + M.label + "» فقط فایل متنی (TXT یا MD) می‌خواند. برای PDF، Word و عکس یکی از مدل‌های Claude یا GPT را انتخاب کنید.");
          if (ext === "txt" || ext === "md") {
            const t = await readFileAsText(st.file);
            if (!t.trim()) return fail("فایل متنی خالی است.");
            body.text = t;
          } else {
            body.file = { media_type: AI_FILE_TYPES[ext], data: await readFileAsB64(st.file) };
          }
          const note = $("note").value.trim();
          if (note) body.topic = note;
        } else {
          const t = $("topic").value.trim();
          if (!t) { $("topic").classList.add("bad"); $("topic").focus(); return fail("موضوع آزمون را بنویسید."); }
          body.topic = t;
        }
      } catch (e) { return fail(e.message); }

      busy = true;
      go.disabled = true;
      go.classList.add("loading");
      $("wait").hidden = false;
      setGenLock(true);
      ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 130000);
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
          throw new Error(e && e.name === "AbortError" ? "ساخت آزمون بیش از حد طول کشید. دوباره تلاش کنید." : "ارتباط با تابع هوش مصنوعی برقرار نشد (مرحله‌ی ساخت سؤال‌ها). جزئیات: " + (e && e.message ? e.message : "نامشخص"));
        }
        let d = null;
        try { d = await res.json(); } catch (e) { /* ignore */ }
        if (!res.ok) {
          if (d && d.detail) console.error("AI detail:", d.detail);
          const base = (d && d.error) || (res.status === 404 ? "بخش هوش مصنوعی هنوز روی سرور راه‌اندازی نشده است." : "خطایی رخ داد (" + res.status + ").");
          throw new Error(base + (d && d.detail ? " (جزئیات فنی: " + d.detail + ")" : ""));
        }
        const questions = normalizeAI(d);
        if (!questions.length) throw new Error("آزمون معتبری ساخته نشد. دوباره تلاش کنید.");
        const secret = randomSecret();
        const title = String((d && d.title) || "").trim().slice(0, LIMITS.title) || "آزمون";
        let id;
        try {
          id = await rpc("create_quiz", {
          p_title: title,
          p_description: String((d && d.description) || "").trim().slice(0, LIMITS.desc),
          p_questions: questions,
          p_secret: secret,
          p_token: tokenOf(),
          p_group: createGroup || null,
          });
        } catch (e2) {
          throw new Error("سؤال‌ها ساخته شد ولی ذخیره‌ی آزمون در پایگاه‌داده نشد: " + e2.message);
        }
        await keepQuiz({ id: id, secret: secret, title: title });
        setGenLock(false);
        location.hash = "#/m/" + encodeURIComponent(id) + "/" + secret + "?new=1";
      } catch (e) {
        setGenLock(false);
        if (ctl && ctl.signal.aborted && !busy) return;
        fail(e.message);
        busy = false;
        go.disabled = false;
        go.classList.remove("loading");
        $("wait").hidden = true;
      } finally {
        clearTimeout(timer);
      }
    });

    return function cleanup() {
      busy = false;
      setGenLock(false);
      if (ctl) ctl.abort();
    };
  }

  /* ---------- شرکت در آزمون ---------- */
  async function viewTake(id, token) {
    setTitle();
    app.innerHTML = '<p class="muted">در حال بارگذاری…</p>';
    let quiz;
    try { quiz = await rpc("get_quiz", { p_id: id, p_token: tokenOf() }); } catch (e) { if (token !== routeToken) return; return showError(e.message, () => viewTake(id, token)); }
    if (token !== routeToken) return;
    if (!quiz || !Array.isArray(quiz.questions)) return showError("این آزمون پیدا نشد.");
    setTitle(quiz.title);

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
      '<div class="ap" role="status" aria-live="polite"><div class="ap-top"><span id="apTxt"></span></div><div class="ap-bar"><i id="apBar"></i></div></div>' +
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
        }
      }
    });

    let skipOk = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fail = (t) => { msg.innerHTML = '<div class="err" role="alert">' + esc(t) + "</div>"; };
      msg.innerHTML = "";
      syncNameCard();
      const name = accName() || nameEl.value.trim();
      if (!name) {
        fail("نام خود را وارد کنید.");
        nameEl.classList.add("bad");
        nameEl.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
        nameEl.focus({ preventScroll: true });
        return;
      }
      nameEl.classList.remove("bad");
      const left = [];
      answers.forEach((a, i) => { if (a === null) left.push(i); });
      form.querySelectorAll(".unanswered").forEach((c) => c.classList.remove("unanswered"));
      if (left.length && !skipOk) {
        skipOk = true;
        left.forEach((i) => { const c = form.querySelector('.qcard[data-i="' + i + '"]'); if (c) c.classList.add("unanswered"); });
        msg.innerHTML = '<div class="warn" role="alert">به ' + faNum(left.length) + " سؤال پاسخ نداده‌اید. اگر می‌خواهید همین‌طور ثبت شود دوباره روی «ثبت پاسخ‌ها» بزنید.</div>";
        const first = form.querySelector('.qcard[data-i="' + left[0] + '"]');
        if (first) first.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
        return;
      }
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      btn.classList.add("loading");
      try {
        const r = await rpc("submit_quiz", { p_id: id, p_name: name, p_answers: answers, p_token: tokenOf() });
        if (token !== routeToken) return;
        if (!accName()) store.set("lastName", name);
        showResult(quiz, qs, answers, r, token);
      } catch (err) {
        btn.disabled = false;
        btn.classList.remove("loading");
        fail(err.message);
      }
    });
  }

  function showResult(quiz, qs, answers, r, token) {
    const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;

    const review = (q, i) => {
      const right = r.correct[i];
      const mine = answers[i];
      const state = mine == null ? '<span class="badge skip">بدون پاسخ</span>' : mine === right ? '<span class="badge okb">درست</span>' : '<span class="badge badb">نادرست</span>';
      const opts = q.options.map((o, j) => {
        const cls = j === right ? "right" : j === mine ? "wrong" : "";
        const tag = j === right ? " ✓ پاسخ درست" : j === mine ? " ✗ پاسخ شما" : "";
        return '<div class="opt ' + cls + '"><span>' + esc(o) + "</span><strong>" + tag + "</strong></div>";
      }).join("");
      return '<div class="card"><div class="rv-top">' + state + "</div><h2>" + faNum(i + 1) + ". " + esc(q.text) + "</h2>" + opts + "</div>";
    };

    app.innerHTML =
      '<div class="card"><p class="muted center">نمره‌ی شما</p><div class="score">' + faNum(r.score) + " از " + faNum(r.total) + '</div><p class="muted center">' + faNum(pct) + "٪</p></div>" +
      "<h2>مرور پاسخ‌ها</h2>" + qs.map(review).join("") +
      '<div class="actions"><button class="btn" type="button" id="again">شرکت دوباره</button><a class="btn ghost" href="#/create">ساخت آزمون خودم</a></div>';
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

    const take = baseUrl() + "#/q/" + id;
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

    app.innerHTML =
      "<h1>" + esc(d.title) + "</h1>" +
      (d.group_name ? groupChip(d.group_name) + '<p class="hint" style="margin-top:-6px">این آزمون فقط برای اعضای گروه باز می‌شود.</p>' : "") +
      (isNew ? '<div class="card created"><strong>آزمون ساخته شد 🎉</strong><div class="hint">اگر سؤالی یا پاسخ درستی اشتباه است، با دکمه‌ی «ویرایش آزمون» در همین صفحه اصلاحش کنید.</div></div>' : "") +
      (flags.updated ? '<div class="card created"><strong>تغییرات ذخیره شد ✅</strong>' + (flags.cleared ? '<div class="hint">' + faNum(flags.cleared) + " نتیجه‌ی قبلی پاک شد.</div>" : "") + "</div>" : "") +
      '<div class="card"><h2>لینک آزمون</h2>' +
      '<div class="linkbox"><input id="l1" type="text" readonly value="' + esc(take) + '" aria-label="لینک آزمون"><button class="btn small" type="button" data-copy="#l1">کپی</button></div>' +
      '<div class="actions"><a class="btn ghost small" href="#/q/' + encodeURIComponent(id) + '">پیش‌نمایش آزمون</a>' +
      '<a class="btn small" href="#/edit/' + encodeURIComponent(id) + "/" + secret + '">ویرایش آزمون</a>' +
      (navigator.share ? '<button class="btn small" type="button" id="shareBtn">اشتراک‌گذاری</button>' : "") + "</div></div>" +
      '<div class="stats"><div class="stat"><b>' + faNum(subs.length) + "</b><span>شرکت‌کننده</span></div>" +
      '<div class="stat"><b>' + faNum(Math.round(avg * 100)) + "٪</b><span>میانگین</span></div>" +
      '<div class="stat"><b>' + faNum(Math.round(best * 100)) + "٪</b><span>بهترین نمره</span></div></div>" +
      '<div class="card"><h2>نتایج</h2>' +
      (subs.length
        ? '<div style="overflow-x:auto"><table class="rtbl"><thead><tr><th>نام</th><th>نمره</th><th>زمان</th><th></th></tr></thead><tbody>' +
          subs.map((s, i) => '<tr class="srow"><td class="c-name">' + esc(s.name) + '</td><td class="c-score" data-l="نمره">' + faNum(s.score) + " از " + faNum(s.total) + '</td><td class="c-time" data-l="زمان">' + esc(when(s.created_at)) + '</td><td class="det-cell"><button class="btn ghost small" type="button" data-det="' + i + '" aria-haspopup="dialog">مشاهده جزئیات</button></td></tr>').join("") +
          '</tbody></table></div><div class="actions"><button class="btn ghost small" type="button" id="csv">دانلود CSV</button><button class="btn ghost small" type="button" id="refresh">به‌روزرسانی</button></div>'
        : '<p class="muted">هنوز کسی شرکت نکرده است. لینک آزمون را برای دیگران بفرستید.</p><button class="btn ghost small" type="button" id="refresh">به‌روزرسانی</button>') +
      "</div>" +
      (subs.length && qs.length ? '<div class="card"><h2>آمار هر سؤال <span class="hint">(درصد پاسخ درست)</span></h2>' + qstat + "</div>" : "") +
      '<div class="actions"><a class="btn ghost" href="#/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a></div>";

    /* جزئیات پاسخ هر شرکت‌کننده (فقط در سایت؛ در CSV نیست) */
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
    const csv = document.getElementById("csv");
    if (csv) csv.addEventListener("click", () => {
      const cell = (v) => {
        let t = String(v);
        if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; /* جلوگیری از اجرای فرمول در اکسل */
        return '"' + t.replace(/"/g, '""') + '"';
      };
      const lines = [["نام", "نمره", "از", "زمان"].map(cell).join(",")].concat(
        subs.map((s) => [s.name, s.score, s.total, s.created_at].map(cell).join(","))
      );
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "results-" + id + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }


  /* ---------- ثبت‌نام و ورود با شماره‌ی موبایل ---------- */
  const AUTH_FN = "auth-otp";
  const auth = {
    get() {
      const v = store.get("session", null);
      return v && typeof v.token === "string" && typeof v.phone === "string" ? v : null;
    },
    set(v) { store.set("session", v); syncAuthBtn(); window.dispatchEvent(new Event("authchange")); },
    clear() { store.del("session"); syncAuthBtn(); window.dispatchEvent(new Event("authchange")); },
  };

  const cleanName = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const validName = (n) => n.length >= 2 && n.length <= 60;
  const initialOf = (n) => { const c = Array.from(cleanName(n))[0]; return c ? c.toUpperCase() : ""; };
  const USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.9-3.6 3.8-5.4 7.2-5.4s6.3 1.8 7.2 5.4"/></svg>';

  async function doLogout(btn) {
    if (btn) { btn.disabled = true; btn.classList.add("loading"); }
    const cur = auth.get();
    /* خروج فوری: نشست روی دستگاه همین حالا پاک می‌شود و ابطال سمت سرور در پس‌زمینه انجام می‌شود */
    if (cur) { try { authCall({ action: "logout", token: cur.token }).catch(() => {}); } catch (e) { /* بی‌اهمیت */ } }
    auth.clear();
    location.hash = "#/";
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
    wrap.innerHTML =
      '<button class="prof-btn" id="profBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="profPop" aria-label="پروفایل' + (nm ? "؛ " + esc(nm) : "") + '">' + av + "</button>" +
      '<div class="prof-pop" id="profPop" role="dialog" aria-label="اطلاعات حساب" hidden>' +
      '<div class="prof-av">' + av + "</div>" +
      '<div class="prof-name">' + (nm ? esc(nm) : "کاربر پازمونک") + "</div>" +
      '<div class="prof-phone" dir="ltr">' + showPhone(s.phone) + "</div>" +
      '<button class="btn ghost small wide" id="profOut" type="button">خروج از حساب</button></div>';
    document.getElementById("profBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      const pop = document.getElementById("profPop");
      if (pop.hidden) openProfile(); else closeProfile();
    });
    document.getElementById("profPop").addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("profOut").addEventListener("click", (e) => { closeProfile(); doLogout(e.currentTarget); });
  }
  document.addEventListener("click", closeProfile);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const pop = document.getElementById("profPop"); if (pop && !pop.hidden) { closeProfile(); const b = document.getElementById("profBtn"); if (b) b.focus(); } } });
  window.addEventListener("resize", closeProfile);
  window.addEventListener("hashchange", closeProfile);

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
  const showPhone = (p) => faNum(p.slice(0, 4) + " " + p.slice(4, 7) + " " + p.slice(7));
  const mmss = (sec) => faNum(Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"));

  const LOGO_CHECK = '<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M70.2 4.0C68.5 3.1 66.8 2.4 65.4 1.9C64.0 1.4 63.4 1.3 62.0 1.0C60.6 0.7 58.9 0.3 57.1 0.2C55.3 0.0 57.7 -0.3 51.1 0.0C44.6 0.3 23.8 1.3 17.8 1.8C11.7 2.3 15.7 2.3 14.8 2.8C13.9 3.4 13.1 4.0 12.5 5.1C11.9 6.2 11.5 -1.3 11.3 9.2C11.2 19.7 10.9 59.6 11.5 68.2C12.1 76.8 13.6 63.2 15.0 60.9C16.4 58.7 18.0 56.6 19.7 54.8C21.4 53.0 22.9 51.6 25.0 50.0C27.2 48.4 31.4 49.6 32.7 45.4C34.0 41.1 32.6 28.5 32.7 24.7C32.8 21.0 32.9 23.2 33.3 22.6C33.7 22.0 34.2 21.3 34.9 20.9C35.6 20.5 35.1 20.3 37.4 20.1C39.8 19.9 46.2 19.9 49.0 19.9C51.8 19.9 52.8 19.9 54.3 20.1C55.8 20.3 56.8 20.5 58.0 21.0C59.2 21.4 60.5 22.1 61.5 22.9C62.5 23.7 63.3 24.6 64.0 25.7C64.8 26.7 65.4 28.0 65.8 29.3C66.2 30.5 66.4 31.8 66.5 33.1C66.6 34.3 66.4 35.6 66.3 36.7C66.1 37.8 65.8 38.7 65.3 39.7C64.9 40.7 64.1 42.0 63.3 42.9C62.5 43.8 62.0 44.4 60.7 45.1C59.4 45.8 57.8 46.7 55.5 47.1C53.3 47.5 49.7 47.5 47.3 47.7C45.0 48.0 43.8 48.1 41.5 48.8C39.2 49.4 36.1 50.3 33.4 51.5C30.6 52.8 27.1 55.0 25.1 56.4C23.0 57.8 22.5 58.3 21.1 59.7C19.7 61.1 17.8 63.1 16.6 64.8C15.3 66.4 14.4 68.0 13.6 69.6C12.8 71.3 12.2 73.5 11.8 74.9C11.4 76.3 11.4 75.5 11.3 77.9C11.2 80.2 11.2 86.4 11.3 88.8C11.4 91.2 11.6 91.2 11.8 92.2C12.1 93.2 12.5 94.0 12.9 94.7C13.3 95.5 13.6 95.9 14.2 96.6C14.9 97.3 15.8 98.2 16.9 98.7C17.9 99.2 19.2 99.7 20.6 99.9C22.0 100.0 23.9 100.0 25.4 99.6C26.8 99.2 28.2 98.5 29.3 97.6C30.4 96.8 31.4 95.4 32.0 94.5C32.7 93.5 32.9 92.7 33.2 91.7C33.5 90.7 33.8 92.3 33.9 88.5C34.0 84.7 33.7 72.3 33.8 68.7C33.9 65.2 34.1 67.6 34.5 67.3C34.9 67.1 34.0 66.9 36.2 67.2C38.3 67.4 44.4 68.4 47.5 68.7C50.5 69.0 52.3 68.9 54.5 68.8C56.7 68.7 58.8 68.4 60.6 68.1C62.5 67.7 63.5 67.5 65.3 66.8C67.2 66.1 69.8 65.0 71.6 64.0C73.4 63.1 74.7 62.1 76.2 60.9C77.6 59.7 78.9 58.5 80.2 56.9C81.6 55.4 83.0 53.6 84.1 51.6C85.2 49.6 86.3 47.2 87.0 45.0C87.8 42.8 88.2 40.6 88.4 38.4C88.7 36.2 88.7 33.9 88.5 31.7C88.3 29.4 87.8 27.0 87.1 24.8C86.4 22.6 85.4 20.2 84.3 18.2C83.2 16.1 82.0 14.4 80.5 12.6C79.0 10.8 77.0 8.8 75.3 7.4C73.5 5.9 71.8 4.9 70.2 4.0Z"/></svg>';

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
    if (auth.get()) { location.hash = signupNext ? "#/" + signupNext : "#/account"; return null; }
    const nextHash = signupNext ? "#/" + signupNext : "#/";

    app.innerHTML =
      '<div class="auth-wrap"><div class="card auth-card">' +
      '<div class="auth-logo">' + LOGO_CHECK + "</div>" +
      '<div id="authStep"></div></div>' +
      '<div class="actions" style="justify-content:center"><a class="back" href="#/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a></div></div>";
    const box = document.getElementById("authStep");

    let alive = true;
    let raf = 0;
    let navTimer = 0;
    let phone = "";
    let fullName = "";

    const stopTimers = () => { cancelAnimationFrame(raf); raf = 0; };
    const mount = (html) => { stopTimers(); box.innerHTML = '<div class="auth-step">' + html + "</div>"; return box.firstChild; };

    /* ----- مرحله‌ی ۱: شماره ----- */
    function stepPhone(prefill) {
      mount(
        "<h1>ثبت‌نام</h1>" +
        '<p class="sub">شماره‌ی موبایل‌تان را وارد کنید تا یک کد تأیید برایتان بفرستیم. اگر قبلاً ثبت‌نام کرده‌اید، وارد حساب‌تان می‌شوید.</p>' +
        '<form id="phoneForm" novalidate><label for="nm">نام و نام خانوادگی</label>' +
        '<input id="nm" class="auth-input auth-name" type="text" autocomplete="name" maxlength="60" placeholder="مثلاً علی رضایی" aria-describedby="phMsg">' +
        '<label for="ph">شماره‌ی موبایل</label>' +
        '<input id="ph" class="auth-input" type="text" inputmode="numeric" autocomplete="tel" maxlength="14" placeholder="۰۹۱۲۳۴۵۶۷۸۹" aria-describedby="phMsg">' +
        '<div class="auth-msg" id="phMsg" role="alert"></div>' +
        '<button class="btn wide" id="phGo" type="submit">دریافت کد</button></form>'
      );
      const ph = document.getElementById("ph");
      const nmEl = document.getElementById("nm");
      const msg = document.getElementById("phMsg");
      const go = document.getElementById("phGo");
      ph.value = faNum(prefill || "");
      nmEl.value = fullName;
      nmEl.addEventListener("input", () => { nmEl.classList.remove("bad"); msg.textContent = ""; });
      ph.addEventListener("input", () => {
        const c = cleanPhone(ph.value);
        ph.value = faNum(c);
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
        if (r.ok) { phone = p; fullName = n; stepCode(r); return; }
        msg.className = "auth-msg m-err";
        msg.textContent = r.message || "ارسال کد ناموفق بود.";
        if (r.retry_in) msg.textContent += " (" + faNum(r.retry_in) + " ثانیه)";
      });
      const first = fullName ? ph : nmEl;
      if (!reduceMotion()) setTimeout(() => { if (alive) first.focus({ preventScroll: true }); }, 350);
      else first.focus({ preventScroll: true });
    }

    /* ----- مرحله‌ی ۲: کد + ساعت دایره‌ای ----- */
    function stepCode(info) {
      mount(
        "<h1>کد تأیید</h1>" +
        '<p class="sub">کد ۵ رقمی به شماره‌ی <span class="auth-phone">' + showPhone(phone) + "</span> ارسال شد. " +
        '<button class="auth-link" id="editPh" type="button">ویرایش شماره</button></p>' +
        '<div class="ring" id="ring" role="timer" aria-label="زمان باقی‌مانده تا انقضای کد">' + ringSvg() +
        '<div class="ring-t"><b id="ringT">۲:۰۰</b><span>زمان باقی‌مانده</span></div></div>' +
        '<div class="otp" id="otp" role="group" aria-label="کد ۵ رقمی">' +
        [0, 1, 2, 3, 4].map((i) => '<input type="text" inputmode="numeric" maxlength="1" autocomplete="' + (i === 0 ? "one-time-code" : "off") + '" aria-label="رقم ' + faNum(i + 1) + '">').join("") +
        "</div>" +
        (info.dev_code ? '<div class="auth-dev">حالت آزمایشی (ارسال پیامک هنوز فعال نیست): کد شما <b>' + faNum(info.dev_code) + "</b></div>" : "") +
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
        const r = await authCall({ action: "verify", phone: phone, code: code, name: fullName });
        if (!alive) return;
        busy = false;
        if (r.ok) { auth.set({ token: r.token, phone: r.phone, name: cleanName(r.name || fullName) }); stepWelcome(!!r.created); return; }
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
        const r = await authCall({ action: "send", phone: phone });
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
      document.getElementById("editPh").addEventListener("click", () => stepPhone(phone));

      paint();
      if (!reduceMotion()) setTimeout(() => { if (alive && !expired) boxes[0].focus({ preventScroll: true }); }, 350);
      else boxes[0].focus({ preventScroll: true });
    }

    /* ----- موفقیت: خودکار وارد می‌شود ----- */
    function stepWelcome(created) {
      mount(
        '<div class="auth-welcome"><div class="ring done" id="ring">' + ringSvg() +
        '<div class="okmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>' +
        "<h1>" + (created ? "ثبت‌نام شما انجام شد 🎉" : "خوش آمدید 👋") + "</h1>" +
        (fullName ? '<p class="auth-hello">' + esc(fullName) + "</p>" : "") +
        '<p class="sub">' + (created ? "به پازمونک خوش آمدید." : "با موفقیت وارد شدید.") + " در حال انتقال به " + (/^q\//.test(signupNext) ? "آزمون…" : /^(groups|g\/)/.test(signupNext) ? "گروه‌ها…" : signupNext ? "صفحه‌ی ساخت آزمون…" : "صفحه‌ی اصلی…") + "</p>" +
        '<a class="btn wide" href="' + nextHash + '">' + (/^q\//.test(signupNext) ? "ادامه و شرکت در آزمون" : /^(groups|g\/)/.test(signupNext) ? "ادامه" : signupNext ? "ادامه و ساخت آزمون" : "ورود به سایت") + "</a></div>"
      );
      const prog = document.getElementById("ringProg");
      prog.style.strokeDashoffset = "100";
      requestAnimationFrame(() => requestAnimationFrame(() => { prog.style.strokeDashoffset = "0"; }));
      navTimer = setTimeout(() => { if (alive) location.hash = nextHash; }, 1700);
    }

    stepPhone("");
    return function cleanup() { alive = false; stopTimers(); clearTimeout(navTimer); };
  }

  function viewAccount() {
    setTitle("حساب من");
    const s = auth.get();
    if (!s) { location.hash = "#/signup"; return null; }
    app.innerHTML =
      '<div class="auth-wrap"><div class="card auth-card"><div class="auth-logo">' + LOGO_CHECK + "</div>" +
      '<div class="auth-step"><h1>حساب من</h1><p class="sub">' + (cleanName(s.name) ? "<strong>" + esc(cleanName(s.name)) + "</strong><br>" : "") + "با این شماره وارد شده‌اید:</p>" +
      '<div class="acc-phone">' + showPhone(s.phone) + "</div>" +
      '<a class="btn wide" href="#/create">ساخت آزمون</a>' +
      '<button class="btn ghost wide" id="logout" type="button">خروج از حساب</button></div></div></div>';
    document.getElementById("logout").addEventListener("click", (e) => doLogout(e.currentTarget));
    return null;
  }

  async function validateSession() {
    const s = auth.get();
    if (!s || !cfg.SUPABASE_URL) return;
    const r = await authCall({ action: "me", token: s.token });
    if (r && r.ok === false && r.error === "no_session") { auth.clear(); if (/^#\/account/.test(location.hash)) location.hash = "#/signup"; }
    else if (r && r.ok && cleanName(r.name) !== cleanName(s.name)) auth.set({ token: s.token, phone: s.phone, name: cleanName(r.name) });
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
        window.removeEventListener("hashchange", onHash);
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
      window.addEventListener("hashchange", onHash);
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
    const g = document.getElementById("grpBtn");
    if (g) g.setAttribute("aria-label", n > 0 ? "گروه‌ها؛ " + faNum(n) + " دعوت جدید" : "گروه‌ها");
  }
  function inviteToast(text) {
    const box = document.getElementById("toasts");
    if (!box) return;
    const t = el("div", { class: "toast inv-toast", role: "alert" });
    t.appendChild(el("span", { text: text }));
    t.appendChild(el("a", { href: "#/groups", text: "مشاهده", onclick: () => t.remove() }));
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
      if (!inv.seen) inv.seen = new Set(store.get("seenInv", []));
      const fresh = list.filter((x) => !inv.seen.has(x.group_id));
      if (fresh.length) {
        fresh.forEach((x) => inv.seen.add(x.group_id));
        store.set("seenInv", Array.from(inv.seen).slice(-200));
        if (!/^#\/groups/.test(location.hash)) {
          inviteToast(fresh.length === 1 ? "دعوت جدید به گروه «" + fresh[0].group_name + "»" : faNum(fresh.length) + " دعوت جدید به گروه دارید");
        }
      }
    } catch (e) { /* اتصال ضعیف؛ دفعه‌ی بعد */ } finally { inv.busy = false; }
  }
  function syncInviteWatch() {
    clearInterval(inv.timer);
    inv.timer = 0;
    const g = document.getElementById("grpBtn");
    if (g) g.hidden = !auth.get();
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
  const grpMeta = (g) => (g.role === "owner" ? "مدیر" : "عضو") + " · " + faNum(g.members) + " عضو · " + faNum(g.quizzes) + " آزمون";

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
        '<a class="back" href="#/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a>" +
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
              '<a class="grp-row" href="#/g/' + esc(g.id) + '"><span class="av-s" aria-hidden="true">' + esc(gInitial(g.name)) + '</span><div class="grp-t"><strong>' + esc(g.name) + "</strong><small>" + esc(grpMeta(g)) + "</small></div>" + '<span class="grp-go">' + ICONS.back + "</span></a>"
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
      const go = async () => {
        const nm = cleanName(inp.value);
        if (nm.length < 2) { msg.innerHTML = '<div class="err" role="alert">نام گروه را بنویسید (حداقل ۲ حرف).</div>'; inp.focus(); return; }
        mk.disabled = true; mk.classList.add("loading"); msg.innerHTML = "";
        try {
          const r = await gcall("group_create", { p_name: nm });
          groupsCache = null;
          if (r && r.id) location.hash = "#/g/" + r.id; else { showForm = false; load(true); }
        } catch (e) {
          if (!ok()) return;
          mk.disabled = false; mk.classList.remove("loading");
          msg.innerHTML = '<div class="err" role="alert">' + esc(e.message) + "</div>";
        }
      };
      mk.addEventListener("click", go);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
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
        : { title: "دعوت رد شود؟", text: "دعوت به گروه «" + item.group_name + "» رد می‌شود و پاک می‌شود. برای عضویت دوباره، مدیر باید دوباره دعوتتان کند.", yes: "بله، رد کن", danger: true });
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

  /* ---------- صفحه‌ی یک گروه ---------- */
  function viewGroup(gid, token) {
    setTitle("گروه");
    let g = null;
    let tab = "quizzes";
    let phoneVal = "";
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

    const quizzesTab = () => {
      const qs = g.quizzes || [];
      return (owner() ? '<div class="actions" style="margin-top:6px"><a class="btn" href="#/create?g=' + esc(g.id) + '">' + ICONS.plus + " آزمون جدید برای این گروه</a></div>" : "") +
        '<div class="card">' +
        (qs.length
          ? qs.map((q) =>
              '<div class="mine-row"><span class="mine-t">' + esc(q.title) + (owner() && q.participants != null ? '<small class="mine-n">' + faNum(q.participants) + " شرکت‌کننده</small>" : "") + "</span>" +
              (owner()
                ? '<a class="btn small ghost" href="#/q/' + encodeURIComponent(q.id) + '">باز کردن</a>' + (q.secret ? '<a class="btn small" href="#/m/' + encodeURIComponent(q.id) + "/" + encodeURIComponent(q.secret) + '">نتایج</a>' : "")
                : '<a class="btn small" href="#/q/' + encodeURIComponent(q.id) + '">شروع آزمون</a>') + "</div>"
            ).join("")
          : '<p class="muted" style="margin:0">' + (owner() ? "هنوز آزمونی برای این گروه نساخته‌اید. با دکمه‌ی بالا اولین آزمون را بسازید." : "هنوز آزمونی در این گروه نیست. وقتی مدیر آزمون بسازد، اینجا می‌بینید.") + "</p>") +
        "</div>";
    };

    const membersTab = () => {
      const ms = g.members || [];
      const pend = g.invites || [];
      return (owner()
          ? '<div class="card"><h2>دعوت با شماره‌ی موبایل</h2><p class="hint" style="margin-top:0">شخص فوراً عضو نمی‌شود؛ دعوت را داخل پازمونک می‌بیند و خودش می‌پذیرد یا رد می‌کند.</p>' +
            '<div class="grp-add"><input id="gPhone" type="text" inputmode="tel" dir="ltr" maxlength="16" autocomplete="off" placeholder="09123456789" aria-label="شماره‌ی موبایل" value="' + esc(phoneVal) + '"><button class="btn" type="button" id="gInv">دعوت</button></div><div id="gMsg"></div></div>'
          : "") +
        '<div class="card"><div class="sec-t"><h2>اعضا</h2><span class="badge">' + faNum(ms.length) + "</span></div>" +
        ms.map((m) =>
          '<div class="grp-row"><span class="av-s" aria-hidden="true">' + esc(gInitial(m.name)) + '</span><div class="grp-t"><strong>' + esc(m.name) + (m.role === "owner" ? ' <span class="badge">مدیر</span>' : "") + "</strong>" +
          (owner() && m.phone ? '<small><bdi class="grp-ph">' + esc(showPhone(m.phone)) + "</bdi></small>" : "") + "</div>" +
          (owner() && m.role === "member" && m.user_id ? '<button class="btn small danger" type="button" data-act="rm" data-u="' + esc(m.user_id) + '" data-n="' + esc(m.name) + '">حذف</button>' : "") + "</div>"
        ).join("") + "</div>" +
        (owner() && pend.length
          ? '<div class="card"><div class="sec-t"><h2>منتظر پاسخ</h2><span class="badge">' + faNum(pend.length) + "</span></div>" +
            pend.map((p) =>
              '<div class="grp-row"><span class="av-s" aria-hidden="true">' + USERS_ICON + '</span><div class="grp-t"><strong><bdi class="grp-ph">' + esc(showPhone(p.phone)) + "</bdi></strong><small>دعوت فرستاده شده</small></div>" +
              '<button class="btn small ghost" type="button" data-act="cancel" data-p="' + esc(p.phone) + '">لغو دعوت</button></div>'
            ).join("") + "</div>"
          : "");
    };

    const draw = (errMsg) => {
      app.innerHTML =
        '<a class="back" href="#/groups">' + ICONS.back + " گروه‌ها</a>" +
        '<div class="page-head"><h1>' + esc(g.name) + '</h1><span class="badge">' + (owner() ? "مدیر" : "عضو") + "</span></div>" +
        (errMsg ? '<div class="err" role="alert">' + esc(errMsg) + "</div>" : "") +
        '<div class="grp-tabs"><div class="seg" role="group" aria-label="بخش‌های گروه">' +
        '<button type="button" data-tab="quizzes" aria-pressed="' + (tab === "quizzes") + '">آزمون‌ها (' + faNum((g.quizzes || []).length) + ")</button>" +
        '<button type="button" data-tab="members" aria-pressed="' + (tab === "members") + '">اعضا (' + faNum((g.members || []).length) + ")</button></div></div>" +
        (tab === "quizzes" ? quizzesTab() : membersTab()) +
        '<div class="actions"><button class="btn danger" type="button" data-act="' + (owner() ? "del" : "leave") + '">' + (owner() ? "حذف گروه" : "ترک گروه") + "</button></div>";
      const inp = document.getElementById("gPhone");
      if (inp) {
        inp.addEventListener("input", () => { phoneVal = inp.value; });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); invite(); } });
      }
      const ib = document.getElementById("gInv");
      if (ib) ib.addEventListener("click", invite);
    };

    const invite = async () => {
      const inp = document.getElementById("gPhone"), msg = document.getElementById("gMsg"), btn = document.getElementById("gInv");
      if (!inp) return;
      const p = cleanPhone(inp.value);
      if (!validPhone(p)) { msg.innerHTML = '<div class="err" role="alert">شماره‌ی موبایل معتبر نیست. مثل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.</div>'; inp.focus(); return; }
      msg.innerHTML = "";
      const yes = await askConfirm({ title: "دعوت فرستاده شود؟", text: "برای شماره‌ی " + showPhone(p) + " دعوت‌نامه‌ی گروه «" + g.name + "» فرستاده می‌شود. اگر شماره را اشتباه زده‌اید، «برگشت» را بزنید.", yes: "بله، دعوت را بفرست" });
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
      if (act === "rm") {
        const nm = b.dataset.n, uid = b.dataset.u;
        if (!(await askConfirm({ title: "«" + nm + "» از گروه حذف شود؟", text: "این شخص دیگر آزمون‌های گروه را نمی‌بیند. نتایجی که قبلاً داده می‌ماند.", yes: "بله، حذف کن", danger: true })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        run(() => gcall("group_member_remove", { p_group: gid, p_user: uid }), "عضو حذف شد");
      } else if (act === "cancel") {
        const ph = b.dataset.p;
        if (!(await askConfirm({ title: "دعوت لغو شود؟", text: "دعوت برای شماره‌ی " + showPhone(ph) + " لغو می‌شود و او دیگر آن را نمی‌بیند.", yes: "بله، لغو کن", danger: true })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        run(() => gcall("group_invite_cancel", { p_group: gid, p_phone: ph }), "دعوت لغو شد");
      } else if (act === "leave") {
        if (!(await askConfirm({ title: "گروه را ترک می‌کنید؟", text: "دیگر آزمون‌های گروه «" + g.name + "» را نمی‌بینید. برای برگشتن، مدیر باید دوباره دعوتتان کند.", yes: "بله، ترک می‌کنم", danger: true })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        try { await gcall("group_leave", { p_group: gid }); groupsCache = null; if (ok()) location.hash = "#/groups"; }
        catch (err) { if (ok()) { b.disabled = false; b.classList.remove("loading"); draw(err.message); } }
      } else if (act === "del") {
        if (!(await askConfirm({ title: "گروه «" + g.name + "» حذف شود؟", text: "گروه، همه‌ی آزمون‌های گروه و نتایجشان برای همیشه پاک می‌شود و برگشت ندارد.", yes: "بله، همه را حذف کن", danger: true })) || !ok()) return;
        b.disabled = true; b.classList.add("loading");
        try { await gcall("group_delete", { p_group: gid }); groupsCache = null; if (ok()) location.hash = "#/groups"; }
        catch (err) { if (ok()) { b.disabled = false; b.classList.remove("loading"); draw(err.message); } }
      }
    }
    app.addEventListener("click", onClick);
    load(false);
    return function cleanup() { app.removeEventListener("click", onClick); };
  }

  /* نام گروه روی نشانک بالای صفحه‌ی ساخت آزمون؛ اگر گروه معتبر نبود هشدار می‌دهد */
  function fillGroupChip() {
    const gid = createGroup;
    if (!gid) return;
    ensureGroups().then((gs) => {
      const bx = document.getElementById("grpChipBox");
      if (!bx || gid !== createGroup) return;
      const g = gs.find((x) => x.id === gid && x.role === "owner");
      bx.innerHTML = g ? groupChip(g.name) : '<div class="err" role="alert">این گروه پیدا نشد یا شما مدیر آن نیستید؛ آزمون ساخته نمی‌شود. با «بازگشت» یک گروه دیگر یا حالت عمومی را انتخاب کنید.</div>';
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
    if (e.key === "Escape") { e.preventDefault(); location.hash = "#/"; }
  }

  function viewGate(target, token) {
    const take = /^q\//.test(target);
    const grp = /^(groups|g\/)/.test(target);
    setTitle(grp ? "ورود برای گروه‌ها" : take ? "ورود برای شرکت در آزمون" : "ورود برای ساخت آزمون");
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
      '<h2 id="gateT">' + (grp ? "برای دیدن گروه‌ها وارد شوید" : take ? "برای شرکت در آزمون وارد شوید" : "برای ساخت آزمون وارد شوید") + "</h2>" +
      '<p id="gateD">' + (grp ? "گروه‌ها" : take ? "شرکت در آزمون" : "ساخت آزمون") + " فقط برای کاربران ثبت‌نام‌شده است. ثبت‌نام با شماره‌ی موبایل است و کمتر از یک دقیقه طول می‌کشد." + (take ? " بعد از ورود، مستقیم به همین آزمون برمی‌گردید." : grp ? " بعد از ورود، مستقیم به همین صفحه برمی‌گردید." : "") + "</p>" +
      '<a class="btn wide" id="gateGo" href="#/signup?next=' + target + '">ثبت‌نام / ورود</a>' +
      '<a class="gate-back" href="#/">بازگشت به صفحه‌ی اصلی</a></div>';
    document.body.appendChild(g);
    document.addEventListener("keydown", onGateKey, true);
    setTimeout(() => { if (token === routeToken) { const b = document.getElementById("gateGo"); if (b) b.focus({ preventScroll: true }); } }, 30);
    return function () { closeGate(); };
  }

  /* ---------- مسیریابی ---------- */
  let routeToken = 0;
  let cleanup = null;
  let first = true;

  function route() {
    if (gateOn) closeGate();
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    const token = ++routeToken;
    const initial = first;
    first = false;

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) { showSetup(); return; }

    const parts0 = location.hash.replace(/^#/, "").split("?");
    const path = parts0[0];
    const query = parts0[1] || "";
    const parts = path.split("/").filter(Boolean).map(safeDecode);
    const okId = (s) => /^[A-Za-z0-9_-]{1,64}$/.test(s || "");

    createGroup = parts[0] === "create" ? ((/(^|&)g=([0-9a-f]{8})(&|$)/.exec(query) || [])[2] || "") : "";

    if (!initial) window.scrollTo(0, 0);
    const hb = document.getElementById("homeBtn");
    if (hb) { if (parts.length === 0) hb.setAttribute("aria-current", "page"); else hb.removeAttribute("aria-current"); }

    if (parts[0] === "q") {
      if (!okId(parts[1])) showError("لینک آزمون نامعتبر است.");
      else if (!auth.get()) cleanup = viewGate("q/" + parts[1], token);
      else viewTake(parts[1], token);
    } else if (parts[0] === "m") {
      if (!okId(parts[1]) || !/^[A-Za-z0-9]{16,128}$/.test(parts[2] || "")) showError("لینک مدیریت نامعتبر است.");
      else viewManage(parts[1], parts[2], /(^|&)new=1(&|$)/.test(query), token, { updated: /(^|&)updated=1(&|$)/.test(query), cleared: +((/(^|&)cleared=(\d+)/.exec(query) || [])[2] || 0) });
    } else if (parts[0] === "edit") {
      if (!okId(parts[1]) || !/^[A-Za-z0-9]{16,128}$/.test(parts[2] || "")) showError("لینک مدیریت نامعتبر است.");
      else viewEdit(parts[1], parts[2], token);
    } else if (parts[0] === "groups") {
      cleanup = auth.get() ? viewGroups(token) : viewGate("groups", token);
    } else if (parts[0] === "g") {
      if (!GROUP_ID_RE.test(parts[1] || "")) showError("لینک گروه نامعتبر است.");
      else cleanup = auth.get() ? viewGroup(parts[1], token) : viewGate("g/" + parts[1], token);
    } else if (parts[0] === "signup") {
      const nx = ((/(^|&)next=([^&]*)/.exec(query) || [])[2] || "");
      signupNext = /^(create(\/(tf|mcq|mixed|ai))?|q\/[A-Za-z0-9_-]{1,64}|groups|g\/[0-9a-f]{8})$/.test(nx) ? nx : "";
      cleanup = viewSignup();
    } else if (parts[0] === "account") {
      cleanup = viewAccount();
    } else if (parts[0] === "create" && !auth.get()) {
      cleanup = viewGate(parts.slice(0, 2).join("/"), token);
    } else if (parts[0] === "create") {
      if (parts[1] === "ai") cleanup = viewAI();
      else if (ACTIVE_MODES.indexOf(parts[1]) >= 0) cleanup = viewBuild(parts[1], /(^|&)draft=1(&|$)/.test(query));
      else viewChoose();
    } else {
      viewHome();
    }
    if (!initial) app.focus({ preventScroll: true });
  }

  window.addEventListener("hashchange", () => {
    if (genLockHash !== null) {
      if (location.hash !== genLockHash) location.replace(genLockHash);
      return;
    }
    route();
  });
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn) homeBtn.addEventListener("click", () => { if (!location.hash || location.hash === "#/" || location.hash === "#") window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" }); });
  window.addEventListener("authchange", syncInviteWatch);
  syncAuthBtn();
  route();
  syncInviteWatch();
  validateSession();
})();
