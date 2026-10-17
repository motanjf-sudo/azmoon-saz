/* آزمون‌ساز: منطق برنامه
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
  const BASE_TITLE = "آزمون‌ساز";
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
    document.title = t ? t + " | " + BASE_TITLE : BASE_TITLE + " | آزمون بسازید، لینک بدهید، نتیجه ببینید";
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
      '<div class="types">' + ["tf", "mcq", "essay", "mixed"].map(card).join("") + "</div>";
    const dropBtn = document.getElementById("dropDraft");
    if (dropBtn) dropBtn.addEventListener("click", () => { store.del("quizDraft"); viewChoose(); });
  }

  /* ---------- سازنده‌ی آزمون ---------- */
  function viewBuild(mode, wantDraft) {
    const M = MODES[mode];
    const allowed = M.types;
    const mixed = allowed.length > 1;
    setTitle("ساخت آزمون " + M.label);

    let uid = 0;
    const questions = [];
    const newQ = (t) => ({ id: ++uid, type: t, text: "", options: ["", "", "", ""], correct: null, tf: null });
    let titleVal = "";
    let descVal = "";
    let restored = false;

    if (wantDraft) {
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
      '<a class="back" href="#/create">' + ICONS.back + " بازگشت به انتخاب مدل</a>" +
      "<h1>ساخت آزمون</h1>" +
      '<p class="muted">مدل انتخابی: <span class="badge">' + esc(M.label) + "</span> — سؤال‌ها را بنویسید و پاسخ درست را مشخص کنید. پیش‌نویس شما خودکار ذخیره می‌شود.</p>" +
      (restored ? '<div class="card draft" id="restoredNote"><div><strong>پیش‌نویس قبلی بازیابی شد</strong></div><div class="draft-actions"><button class="btn small danger" type="button" id="freshBtn">شروع تازه</button></div></div>' : "") +
      '<div class="card" id="meta">' +
      '<label for="title">عنوان آزمون</label><input id="title" type="text" maxlength="' + LIMITS.title + '" autocomplete="off">' +
      '<label for="desc">توضیح (اختیاری)</label><textarea id="desc" maxlength="' + LIMITS.desc + '"></textarea></div>' +
      '<div id="qs"></div>' +
      '<div class="card add-card"><span class="add-lbl">افزودن سؤال:</span><div class="add-btns" id="addBtns"></div></div>' +
      '<div id="msg"></div>' +
      '<div class="actions"><a class="btn ghost" href="#/create">' + ICONS.back + ' بازگشت</a><button class="btn" id="save" type="button">ساخت آزمون و دریافت لینک</button></div>';

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
      if (finished) return;
      if (hasContent()) store.set("quizDraft", draftPayload());
    };
    const touch = () => { if (finished) return; clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400); };
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
      const secret = randomSecret();
      saveBtn.disabled = true;
      saveBtn.classList.add("loading");
      try {
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
      if (!finished && hasContent()) store.set("quizDraft", draftPayload());
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
    document.getElementById("again").addEventListener("click", () => { viewTake(quiz.id, token); window.scrollTo(0, 0); });
    window.scrollTo(0, 0);
  }

  /* ---------- مدیریت و نتایج ---------- */
  async function viewManage(id, secret, isNew, token) {
    setTitle();
    app.innerHTML = '<p class="muted">در حال بارگذاری…</p>';
    let d;
    try { d = await rpc("get_results", { p_id: id, p_secret: secret }); } catch (e) { if (token !== routeToken) return; return showError(e.message, () => viewManage(id, secret, isNew, token)); }
    if (token !== routeToken) return;
    setTitle("نتایج: " + d.title);

    const take = baseUrl() + "#/q/" + id;
    const manage = baseUrl() + "#/m/" + id + "/" + secret;
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
      (isNew ? '<div class="card created"><strong>آزمون ساخته شد 🎉</strong></div>' : "") +
      '<div class="card"><h2>لینک آزمون <span class="hint">(این را برای شرکت‌کنندگان بفرستید)</span></h2>' +
      '<div class="linkbox"><input id="l1" type="text" readonly value="' + esc(take) + '" aria-label="لینک آزمون"><button class="btn small" type="button" data-copy="#l1">کپی</button></div>' +
      '<h2 style="margin-top:18px">لینک مدیریت <span class="hint">(فقط برای خودتان)</span></h2>' +
      '<div class="linkbox"><input id="l2" type="text" readonly value="' + esc(manage) + '" aria-label="لینک مدیریت"><button class="btn small" type="button" data-copy="#l2">کپی</button></div>' +
      '<div class="warn">لینک مدیریت را نگه دارید و به کسی ندهید. فقط با همین لینک می‌توانید نتایج را ببینید و اگر گم شود قابل بازیابی نیست.</div>' +
      '<div class="actions"><a class="btn ghost small" href="#/q/' + encodeURIComponent(id) + '">پیش‌نمایش آزمون</a>' +
      (navigator.share ? '<button class="btn small" type="button" id="shareBtn">اشتراک‌گذاری</button>' : "") + "</div></div>" +
      '<div class="stats"><div class="stat"><b>' + faNum(subs.length) + "</b><span>شرکت‌کننده</span></div>" +
      '<div class="stat"><b>' + faNum(Math.round(avg * 100)) + "٪</b><span>میانگین</span></div>" +
      '<div class="stat"><b>' + faNum(Math.round(best * 100)) + "٪</b><span>بهترین نمره</span></div></div>" +
      '<div class="card"><h2>نتایج</h2>' +
      (subs.length
        ? '<div style="overflow-x:auto"><table><thead><tr><th>نام</th><th>نمره</th><th>زمان</th></tr></thead><tbody>' +
          subs.map((s) => "<tr><td>" + esc(s.name) + "</td><td>" + faNum(s.score) + " از " + faNum(s.total) + "</td><td>" + esc(when(s.created_at)) + "</td></tr>").join("") +
          '</tbody></table></div><div class="actions"><button class="btn ghost small" type="button" id="csv">دانلود CSV</button><button class="btn ghost small" type="button" id="refresh">به‌روزرسانی</button></div>'
        : '<p class="muted">هنوز کسی شرکت نکرده است. لینک آزمون را برای دیگران بفرستید.</p><button class="btn ghost small" type="button" id="refresh">به‌روزرسانی</button>') +
      "</div>" +
      (subs.length && qs.length ? '<div class="card"><h2>آمار هر سؤال <span class="hint">(درصد پاسخ درست)</span></h2>' + qstat + "</div>" : "") +
      '<div class="actions"><a class="btn ghost" href="#/">' + ICONS.back + " بازگشت به صفحه‌ی اصلی</a></div>";

    copyHandlers(app);
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
      else viewManage(parts[1], parts[2], /(^|&)new=1(&|$)/.test(query), token);
    } else if (parts[0] === "create") {
      if (ACTIVE_MODES.indexOf(parts[1]) >= 0) cleanup = viewBuild(parts[1], /(^|&)draft=1(&|$)/.test(query));
      else viewChoose();
    } else {
      viewHome();
    }
    if (!initial) app.focus({ preventScroll: true });
  }

  window.addEventListener("hashchange", route);
  route();
})();
