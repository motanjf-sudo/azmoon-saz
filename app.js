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
    if (!res.ok) throw new Error((data && (data.message || data.hint)) || "خطایی رخ داد (" + res.status + ")");
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
  };

  function setTitle(t) {
    document.title = t ? t + " | " + BASE_TITLE : BASE_TITLE + " | ساخت آزمون آنلاین رایگان با هوش مصنوعی";
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
  function viewHome() {
    setTitle();
    const mine = store.get("myQuizzes", []).filter((m) => m && m.id && m.secret);
    if (!mine.length) {
      app.innerHTML =
        '<div class="card empty">' + ICONS.doc +
        "<h2>هنوز آزمونی نساخته‌اید</h2>" +
        '<p class="muted">با چند کلیک اولین آزمون خود را بسازید و لینکش را برای دیگران بفرستید.</p>' +
        '<a class="btn" href="#/create">ساخت اولین آزمون</a></div>';
      return;
    }
    app.innerHTML =
      '<div class="card"><h2>آزمون‌هایی که روی این دستگاه ساخته‌اید</h2>' +
      mine.map((m) =>
        '<div class="mine-row"><span class="mine-t">' + esc(m.title) + "</span>" +
        '<a class="btn small ghost" href="#/q/' + encodeURIComponent(m.id) + '">باز کردن</a>' +
        '<a class="btn small" href="#/m/' + encodeURIComponent(m.id) + "/" + encodeURIComponent(m.secret) + '">نتایج</a></div>'
      ).join("") + "</div>" +
      '<div class="actions"><a class="btn" href="#/create">ساخت آزمون جدید</a></div>';
  }

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
        : '<a class="card type-card" href="#/create/' + m + '">' + inner + "</a>";
    };
    app.innerHTML =
      '<a class="back" href="#/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a>" +
      "<h1>چه مدل آزمونی می‌خواهید؟</h1>" +
      '<p class="muted">یکی از مدل‌ها را انتخاب کنید. در مرحله‌ی بعد سؤال‌ها را می‌نویسید.</p>' +
      (draft
        ? '<div class="card draft"><div><strong>پیش‌نویس ذخیره‌شده دارید</strong><div class="hint">' + (draft.title ? esc(draft.title) + " — " : "") + faNum(draft.questions.length) + ' سؤال</div></div>' +
          '<div class="draft-actions"><a class="btn small" href="#/create/' + draft.type + '?draft=1">ادامه‌ی پیش‌نویس</a>' +
          '<button class="btn small danger" type="button" id="dropDraft">حذف</button></div></div>'
        : "") +
      '<div class="types"><a class="card type-card ai-card" href="#/create/ai"><span class="ti">' + ICONS.spark + '</span><h3>ساخت با هوش مصنوعی <span class="soon-badge ai-badge">جدید</span></h3>' +
      "<p>یک فایل (PDF، متن یا عکس) بدهید یا فقط موضوع را بنویسید؛ آزمون خودکار ساخته می‌شود و لینکش را همان‌جا می‌گیرید.</p></a>" +
      ["tf", "mcq", "essay", "mixed"].map(card).join("") + "</div>";
    const dropBtn = document.getElementById("dropDraft");
    if (dropBtn) dropBtn.addEventListener("click", () => { store.del("quizDraft"); viewChoose(); });
  }

  /* ---------- سازنده‌ی آزمون ---------- */
  function viewBuild(mode, wantDraft, edit) {
    const M = MODES[mode];
    const allowed = M.types;
    const mixed = allowed.length > 1;
    setTitle(edit ? "ویرایش آزمون" : "ساخت آزمون " + M.label);
    const backHref = edit ? "#/m/" + encodeURIComponent(edit.id) + "/" + edit.secret : "#/create";
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
      (edit ? "<h1>ویرایش آزمون</h1>" : "<h1>ساخت آزمون</h1>") +
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
        const text = el("input", { type: "text", maxlength: String(LIMITS.opt), placeholder: "گزینه‌ی " + faNum(i + 1), "aria-label": "متن گزینه‌ی " + faNum(i + 1) });
        text.value = val;
        text.addEventListener("input", () => { q.options[i] = text.value; text.classList.remove("bad"); clearInvalid(card); touch(); });
        const rm = el("button", { class: "btn small danger", type: "button", "aria-label": "حذف گزینه‌ی " + faNum(i + 1), html: "×" });
        rm.disabled = q.options.length <= LIMITS.minOpts;
        rm.addEventListener("click", () => {
          if (q.options.length <= LIMITS.minOpts) return;
          q.options.splice(i, 1);
          if (q.correct === i) q.correct = null; else if (q.correct != null && q.correct > i) q.correct -= 1;
          buildAnswers(card, q);
          const ins = card.querySelectorAll(".opts input[type=text]");
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
        const ins = card.querySelectorAll(".opts input[type=text]");
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
        const inputs = Array.from(card.querySelectorAll(".opts input[type=text]"));
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
          store.addQuiz({ id: edit.id, secret: edit.secret, title: titleEl.value.trim() });
          location.hash = "#/m/" + encodeURIComponent(edit.id) + "/" + edit.secret + "?updated=1" + (r && r.cleared ? "&cleared=" + r.cleared : "");
          return;
        }
        const id = await rpc("create_quiz", {
          p_title: titleEl.value.trim(),
          p_description: descEl.value.trim(),
          p_questions: serialize(),
          p_secret: secret,
        });
        finished = true;
        clearTimeout(draftTimer);
        store.del("quizDraft");
        store.addQuiz({ id: id, secret: secret, title: titleEl.value.trim() });
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

  function viewAI() {
    setTitle("ساخت آزمون با هوش مصنوعی");
    const st = { src: "file", mid: "gem-flash", mode: "mixed", level: "medium", count: 10, file: null };
    let busy = false;
    let ctl = null;

    const seg = (name, items) =>
      '<div class="seg" role="group" data-seg="' + name + '">' +
      items.map((i) => '<button type="button" data-v="' + i[0] + '" aria-pressed="' + String(st[name] === i[0]) + '">' + i[1] + "</button>").join("") + "</div>";

    app.innerHTML =
      '<a class="back" href="#/create">' + ICONS.back + " بازگشت به انتخاب مدل</a>" +
      "<h1>ساخت آزمون با هوش مصنوعی</h1>" +
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
      '<div class="actions"><a class="btn ghost" href="#/create">' + ICONS.back + ' بازگشت</a><button class="btn" id="go" type="button">' + ICONS.spark + ' ساخت آزمون و دریافت لینک</button></div>' +
      '<p class="hint" id="wait" hidden>در حال ساخت آزمون… معمولاً ۱۰ تا ۶۰ ثانیه طول می‌کشد. این صفحه را نبندید.</p>';

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
      ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 130000);
      try {
        let res;
        try {
          res = await fetch(cfg.SUPABASE_URL + "/functions/v1/" + AI_FN, {
            method: "POST",
            signal: ctl.signal,
            headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
            body: JSON.stringify(body),
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
          });
        } catch (e2) {
          throw new Error("سؤال‌ها ساخته شد ولی ذخیره‌ی آزمون در پایگاه‌داده نشد: " + e2.message);
        }
        store.addQuiz({ id: id, secret: secret, title: title });
        location.hash = "#/m/" + encodeURIComponent(id) + "/" + secret + "?new=1";
      } catch (e) {
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
      if (ctl) ctl.abort();
    };
  }

  /* ---------- شرکت در آزمون ---------- */
  async function viewTake(id, token) {
    setTitle();
    app.innerHTML = '<p class="muted">در حال بارگذاری…</p>';
    let quiz;
    try { quiz = await rpc("get_quiz", { p_id: id }); } catch (e) { if (token !== routeToken) return; return showError(e.message, () => viewTake(id, token)); }
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
      (quiz.description ? '<p class="muted">' + esc(quiz.description) + "</p>" : "") +
      '<div class="ap" role="status" aria-live="polite"><div class="ap-top"><span id="apTxt"></span></div><div class="ap-bar"><i id="apBar"></i></div></div>' +
      '<form id="f" novalidate>' +
      '<div class="card"><label for="name">نام شما</label><input id="name" type="text" maxlength="100" autocomplete="name"></div>' +
      qs.map((q, i) => '<fieldset class="card qcard" data-i="' + i + '">' + qHtml(q, i) + "</fieldset>").join("") +
      '<div id="msg"></div><button class="btn" type="submit" id="submitBtn">ثبت پاسخ‌ها</button></form>';

    renderMath(app);
    const form = document.getElementById("f");
    const nameEl = document.getElementById("name");
    const msg = document.getElementById("msg");
    nameEl.value = lastName;

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
      const name = nameEl.value.trim();
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
        const r = await rpc("submit_quiz", { p_id: id, p_name: name, p_answers: answers });
        if (token !== routeToken) return;
        store.set("lastName", name);
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
    const when = (v) => { const t = new Date(v); return isNaN(t) ? "" : t.toLocaleString("fa-IR"); };

    const qstat = qs.map((q, i) => {
      const ok = subs.filter((s) => Array.isArray(s.answers) && s.answers[i] === q.correct).length;
      const p = subs.length ? Math.round((ok / subs.length) * 100) : 0;
      const txt = String(q.text || "");
      return '<div class="qstat"><div class="qs-top"><span class="qs-n">' + faNum(i + 1) + '</span><span class="qs-t">' + esc(txt.length > 90 ? txt.slice(0, 90) + "…" : txt) +
        '</span><span class="badge">' + esc(QTYPES[typeOf(q.type)].short) + '</span><span class="qs-p">' + faNum(p) + '٪</span></div><div class="bar" role="img" aria-label="' + faNum(p) + ' درصد درست"><i style="--w:' + (p / 100) + '"></i></div></div>';
    }).join("");

    app.innerHTML =
      "<h1>" + esc(d.title) + "</h1>" +
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
        ? '<div style="overflow-x:auto"><table><thead><tr><th>نام</th><th>نمره</th><th>زمان</th><th></th></tr></thead><tbody>' +
          subs.map((s, i) => '<tr class="srow"><td>' + esc(s.name) + "</td><td>" + faNum(s.score) + " از " + faNum(s.total) + "</td><td>" + esc(when(s.created_at)) + '</td><td class="det-cell"><button class="btn ghost small" type="button" data-det="' + i + '" aria-haspopup="dialog">مشاهده جزئیات</button></td></tr>').join("") +
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
    set(v) { store.set("session", v); syncAuthBtn(); },
    clear() { store.del("session"); syncAuthBtn(); },
  };

  function syncAuthBtn() {
    const b = document.getElementById("authBtn");
    if (!b) return;
    const on = !!auth.get();
    b.textContent = on ? "حساب من" : "ثبت‌نام";
    b.setAttribute("href", on ? "#/account" : "#/signup");
  }

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

  const LOGO_CHECK = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 21l6.2 6.2L29 13.5"/></svg>';

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
    if (auth.get()) { location.hash = "#/account"; return null; }

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

    const stopTimers = () => { cancelAnimationFrame(raf); raf = 0; };
    const mount = (html) => { stopTimers(); box.innerHTML = '<div class="auth-step">' + html + "</div>"; return box.firstChild; };

    /* ----- مرحله‌ی ۱: شماره ----- */
    function stepPhone(prefill) {
      mount(
        "<h1>ثبت‌نام</h1>" +
        '<p class="sub">شماره‌ی موبایل‌تان را وارد کنید تا یک کد تأیید برایتان بفرستیم. اگر قبلاً ثبت‌نام کرده‌اید، وارد حساب‌تان می‌شوید.</p>' +
        '<form id="phoneForm" novalidate><label for="ph">شماره‌ی موبایل</label>' +
        '<input id="ph" class="auth-input" type="text" inputmode="numeric" autocomplete="tel" maxlength="14" placeholder="۰۹۱۲۳۴۵۶۷۸۹" aria-describedby="phMsg">' +
        '<div class="auth-msg" id="phMsg" role="alert"></div>' +
        '<button class="btn wide" id="phGo" type="submit">دریافت کد</button></form>'
      );
      const ph = document.getElementById("ph");
      const msg = document.getElementById("phMsg");
      const go = document.getElementById("phGo");
      ph.value = faNum(prefill || "");
      ph.addEventListener("input", () => {
        const c = cleanPhone(ph.value);
        ph.value = faNum(c);
        ph.classList.remove("bad");
        msg.textContent = "";
      });
      document.getElementById("phoneForm").addEventListener("submit", async (e) => {
        e.preventDefault();
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
        if (r.ok) { phone = p; stepCode(r); return; }
        msg.className = "auth-msg m-err";
        msg.textContent = r.message || "ارسال کد ناموفق بود.";
        if (r.retry_in) msg.textContent += " (" + faNum(r.retry_in) + " ثانیه)";
      });
      if (!reduceMotion()) setTimeout(() => { if (alive) ph.focus({ preventScroll: true }); }, 350);
      else ph.focus({ preventScroll: true });
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
        const r = await authCall({ action: "verify", phone: phone, code: code });
        if (!alive) return;
        busy = false;
        if (r.ok) { auth.set({ token: r.token, phone: r.phone }); stepWelcome(!!r.created); return; }
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
        '<p class="sub">' + (created ? "به پازمونک خوش آمدید." : "با موفقیت وارد شدید.") + " در حال انتقال به صفحه‌ی اصلی…</p>" +
        '<a class="btn wide" href="#/">ورود به سایت</a></div>'
      );
      const prog = document.getElementById("ringProg");
      prog.style.strokeDashoffset = "100";
      requestAnimationFrame(() => requestAnimationFrame(() => { prog.style.strokeDashoffset = "0"; }));
      navTimer = setTimeout(() => { if (alive) location.hash = "#/"; }, 1700);
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
      '<div class="auth-step"><h1>حساب من</h1><p class="sub">با این شماره وارد شده‌اید:</p>' +
      '<div class="acc-phone">' + showPhone(s.phone) + "</div>" +
      '<a class="btn wide" href="#/create">ساخت آزمون</a>' +
      '<button class="btn ghost wide" id="logout" type="button">خروج از حساب</button></div></div></div>';
    document.getElementById("logout").addEventListener("click", async (e) => {
      const b = e.currentTarget;
      b.disabled = true; b.classList.add("loading");
      const cur = auth.get();
      if (cur) await authCall({ action: "logout", token: cur.token });
      auth.clear();
      location.hash = "#/";
    });
    return null;
  }

  async function validateSession() {
    const s = auth.get();
    if (!s || !cfg.SUPABASE_URL) return;
    const r = await authCall({ action: "me", token: s.token });
    if (r && r.ok === false && r.error === "no_session") { auth.clear(); if (/^#\/account/.test(location.hash)) location.hash = "#/signup"; }
  }

  /* ---------- مسیریابی ---------- */
  let routeToken = 0;
  let cleanup = null;
  let first = true;

  function route() {
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

    if (!initial) window.scrollTo(0, 0);

    if (parts[0] === "q") {
      if (!okId(parts[1])) showError("لینک آزمون نامعتبر است.");
      else viewTake(parts[1], token);
    } else if (parts[0] === "m") {
      if (!okId(parts[1]) || !/^[A-Za-z0-9]{16,128}$/.test(parts[2] || "")) showError("لینک مدیریت نامعتبر است.");
      else viewManage(parts[1], parts[2], /(^|&)new=1(&|$)/.test(query), token, { updated: /(^|&)updated=1(&|$)/.test(query), cleared: +((/(^|&)cleared=(\d+)/.exec(query) || [])[2] || 0) });
    } else if (parts[0] === "edit") {
      if (!okId(parts[1]) || !/^[A-Za-z0-9]{16,128}$/.test(parts[2] || "")) showError("لینک مدیریت نامعتبر است.");
      else viewEdit(parts[1], parts[2], token);
    } else if (parts[0] === "signup") {
      cleanup = viewSignup();
    } else if (parts[0] === "account") {
      cleanup = viewAccount();
    } else if (parts[0] === "create") {
      if (parts[1] === "ai") cleanup = viewAI();
      else if (ACTIVE_MODES.indexOf(parts[1]) >= 0) cleanup = viewBuild(parts[1], /(^|&)draft=1(&|$)/.test(query));
      else viewChoose();
    } else {
      viewHome();
    }
    if (!initial) app.focus({ preventScroll: true });
  }

  window.addEventListener("hashchange", route);
  syncAuthBtn();
  route();
  validateSession();
})();
