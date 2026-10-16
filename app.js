(function () {
  "use strict";

  const cfg = window.AZMOON_CONFIG || {};
  const app = document.getElementById("app");

  /* ---------- ابزارها ---------- */
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const faNum = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

  function randomSecret() {
    const a = new Uint8Array(24);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function baseUrl() {
    return location.origin + location.pathname;
  }

  async function rpc(name, args) {
    const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(args),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && (data.message || data.hint)) || "خطای ارتباط با سرور");
    return data;
  }

  const store = {
    get() {
      try { return JSON.parse(localStorage.getItem("myQuizzes") || "[]"); } catch { return []; }
    },
    add(item) {
      try {
        const l = this.get().filter((x) => x.id !== item.id);
        l.unshift(item);
        localStorage.setItem("myQuizzes", JSON.stringify(l.slice(0, 50)));
      } catch { /* ذخیره‌سازی در دسترس نیست */ }
    },
  };

  function copyBtnHandlers(root) {
    root.querySelectorAll("[data-copy]").forEach((b) => {
      b.addEventListener("click", async () => {
        const input = root.querySelector(b.dataset.copy);
        try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand("copy"); }
        const old = b.textContent;
        b.textContent = "کپی شد ✓";
        setTimeout(() => (b.textContent = old), 1500);
      });
    });
  }

  /* ---------- صفحه‌ی ساخت آزمون ---------- */
  function viewCreate() {
    const mine = store.get();
    app.innerHTML = `
      <h1>یک آزمون بسازید</h1>
      <p class="muted">سؤال‌ها را وارد کنید، لینک آزمون را بگیرید و برای دیگران بفرستید.</p>
      <form id="f" class="card" novalidate>
        <label for="title">عنوان آزمون</label>
        <input id="title" type="text" maxlength="200" required>
        <label for="desc">توضیح (اختیاری)</label>
        <textarea id="desc" maxlength="2000"></textarea>
      </form>
      <div id="qs"></div>
      <div class="actions">
        <button type="button" class="btn ghost" id="add">+ افزودن سؤال</button>
        <button type="button" class="btn" id="save">ساخت آزمون و دریافت لینک</button>
      </div>
      <div id="msg"></div>
      ${mine.length ? `
        <div class="card">
          <h2>آزمون‌هایی که روی این دستگاه ساخته‌اید</h2>
          ${mine.map((m) => `<div class="row"><span style="flex:1">${esc(m.title)}</span>
            <a class="btn small ghost" href="#/m/${esc(m.id)}/${esc(m.secret)}">نتایج</a></div>`).join("")}
        </div>` : ""}
    `;

    const qsBox = document.getElementById("qs");
    let counter = 0;

    function addQuestion(prefill) {
      const id = ++counter;
      const el = document.createElement("div");
      el.className = "card q";
      el.dataset.id = id;
      el.innerHTML = `
        <div class="row"><h2 style="flex:1" class="qnum"></h2>
          <button type="button" class="btn small danger rm">حذف</button></div>
        <label>متن سؤال</label>
        <textarea class="qtext" maxlength="500"></textarea>
        <label>گزینه‌ها <span class="hint">(دایره‌ی کنار گزینه‌ی درست را انتخاب کنید)</span></label>
        <div class="opts"></div>
        <button type="button" class="btn small ghost addopt">+ گزینه</button>`;
      qsBox.appendChild(el);

      const opts = el.querySelector(".opts");
      const addOpt = (val = "", checked = false) => {
        const r = document.createElement("div");
        r.className = "row";
        r.innerHTML = `<input type="radio" name="c${id}" aria-label="گزینه‌ی درست">
          <input type="text" maxlength="300" placeholder="گزینه" value="${esc(val)}">
          <button type="button" class="btn small danger" aria-label="حذف گزینه">×</button>`;
        r.querySelector("input[type=radio]").checked = checked;
        r.querySelector("button").addEventListener("click", () => {
          if (opts.children.length > 2) r.remove();
        });
        opts.appendChild(r);
      };
      for (let i = 0; i < 4; i++) addOpt("", i === 0);
      el.querySelector(".addopt").addEventListener("click", () => { if (opts.children.length < 8) addOpt(); });
      el.querySelector(".rm").addEventListener("click", () => {
        if (qsBox.children.length > 1) { el.remove(); renumber(); }
      });
      renumber();
    }

    function renumber() {
      qsBox.querySelectorAll(".qnum").forEach((h, i) => (h.textContent = `سؤال ${faNum(i + 1)}`));
    }

    addQuestion();
    document.getElementById("add").addEventListener("click", () => {
      if (qsBox.children.length < 100) addQuestion();
    });

    document.getElementById("save").addEventListener("click", async (ev) => {
      const msg = document.getElementById("msg");
      msg.innerHTML = "";
      const fail = (t) => { msg.innerHTML = `<div class="err" role="alert">${esc(t)}</div>`; };

      const title = document.getElementById("title").value.trim();
      if (!title) return fail("عنوان آزمون را وارد کنید.");

      const questions = [];
      for (const [i, el] of [...qsBox.children].entries()) {
        const text = el.querySelector(".qtext").value.trim();
        if (!text) return fail(`متن سؤال ${faNum(i + 1)} خالی است.`);
        const rows = [...el.querySelectorAll(".opts .row")];
        const options = rows.map((r) => r.querySelector("input[type=text]").value.trim());
        if (options.some((o) => !o)) return fail(`همه‌ی گزینه‌های سؤال ${faNum(i + 1)} را پر کنید.`);
        const correct = rows.findIndex((r) => r.querySelector("input[type=radio]").checked);
        if (correct < 0) return fail(`گزینه‌ی درست سؤال ${faNum(i + 1)} را مشخص کنید.`);
        questions.push({ text, options, correct });
      }

      const secret = randomSecret();
      ev.target.disabled = true;
      try {
        const id = await rpc("create_quiz", {
          p_title: title,
          p_description: document.getElementById("desc").value.trim(),
          p_questions: questions,
          p_secret: secret,
        });
        store.add({ id, secret, title });
        location.hash = `#/m/${id}/${secret}?new=1`;
      } catch (e) {
        ev.target.disabled = false;
        fail(e.message);
      }
    });
  }

  /* ---------- صفحه‌ی شرکت در آزمون ---------- */
  async function viewTake(id) {
    app.innerHTML = `<p class="muted">در حال بارگذاری…</p>`;
    let quiz;
    try { quiz = await rpc("get_quiz", { p_id: id }); } catch (e) { return showError(e.message); }
    if (!quiz) return showError("این آزمون پیدا نشد.");

    app.innerHTML = `
      <h1>${esc(quiz.title)}</h1>
      ${quiz.description ? `<p class="muted">${esc(quiz.description)}</p>` : ""}
      <form id="f" novalidate>
        <div class="card">
          <label for="name">نام شما</label>
          <input id="name" type="text" maxlength="100" autocomplete="name">
        </div>
        ${quiz.questions.map((q, i) => `
          <fieldset class="card" style="border:1px solid var(--line)">
            <legend class="badge">سؤال ${faNum(i + 1)} از ${faNum(quiz.questions.length)}</legend>
            <h2>${esc(q.text)}</h2>
            ${q.options.map((o, j) => `
              <label class="opt"><input type="radio" name="q${i}" value="${j}"><span>${esc(o)}</span></label>`).join("")}
          </fieldset>`).join("")}
        <div id="msg"></div>
        <button class="btn" type="submit">ثبت پاسخ‌ها</button>
      </form>`;

    document.getElementById("f").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const msg = document.getElementById("msg");
      const name = document.getElementById("name").value.trim();
      const answers = quiz.questions.map((_, i) => {
        const c = document.querySelector(`input[name=q${i}]:checked`);
        return c ? Number(c.value) : null;
      });
      const fail = (t) => { msg.innerHTML = `<div class="err" role="alert">${esc(t)}</div>`; };
      if (!name) return fail("نام خود را وارد کنید.");
      const unanswered = answers.findIndex((a) => a === null);
      if (unanswered >= 0 && !confirm(`به ${faNum(answers.filter((a) => a === null).length)} سؤال پاسخ نداده‌اید. ثبت شود؟`)) return;

      const btn = ev.submitter; if (btn) btn.disabled = true;
      try {
        const r = await rpc("submit_quiz", { p_id: id, p_name: name, p_answers: answers });
        showResult(quiz, answers, r);
      } catch (e) {
        if (btn) btn.disabled = false;
        fail(e.message);
      }
    });
  }

  function showResult(quiz, answers, r) {
    const pct = Math.round((r.score / r.total) * 100);
    app.innerHTML = `
      <div class="card">
        <p class="muted" style="text-align:center;margin:0">نمره‌ی شما</p>
        <div class="score">${faNum(r.score)} از ${faNum(r.total)}</div>
        <p style="text-align:center;margin:0" class="muted">${faNum(pct)}٪</p>
      </div>
      <h2>مرور پاسخ‌ها</h2>
      ${quiz.questions.map((q, i) => `
        <div class="card">
          <h2>${faNum(i + 1)}. ${esc(q.text)}</h2>
          ${q.options.map((o, j) => {
            const cls = j === r.correct[i] ? "right" : j === answers[i] ? "wrong" : "";
            const tag = j === r.correct[i] ? " ✓ پاسخ درست" : j === answers[i] ? " ✗ پاسخ شما" : "";
            return `<div class="opt ${cls}">${esc(o)}<strong>${tag}</strong></div>`;
          }).join("")}
        </div>`).join("")}
      <a class="btn ghost" href="#/">ساخت آزمون خودم</a>`;
    window.scrollTo(0, 0);
  }

  /* ---------- صفحه‌ی مدیریت و نتایج ---------- */
  async function viewManage(id, secret, isNew) {
    app.innerHTML = `<p class="muted">در حال بارگذاری…</p>`;
    let d;
    try { d = await rpc("get_results", { p_id: id, p_secret: secret }); } catch (e) { return showError(e.message); }

    const take = `${baseUrl()}#/q/${id}`;
    const manage = `${baseUrl()}#/m/${id}/${secret}`;
    const subs = d.submissions;
    const avg = subs.length ? subs.reduce((a, s) => a + s.score / s.total, 0) / subs.length : 0;

    app.innerHTML = `
      <h1>${esc(d.title)}</h1>
      ${isNew ? `<div class="card" style="border-color:var(--ok)"><strong>آزمون ساخته شد 🎉</strong></div>` : ""}
      <div class="card">
        <h2>لینک آزمون <span class="hint">(این را برای شرکت‌کنندگان بفرستید)</span></h2>
        <div class="linkbox"><input id="l1" type="text" readonly value="${esc(take)}">
          <button class="btn small" data-copy="#l1">کپی</button></div>
        <h2 style="margin-top:18px">لینک مدیریت <span class="hint">(فقط برای خودتان)</span></h2>
        <div class="linkbox"><input id="l2" type="text" readonly value="${esc(manage)}">
          <button class="btn small" data-copy="#l2">کپی</button></div>
        <div class="warn">لینک مدیریت را نگه دارید و به کسی ندهید. فقط با همین لینک می‌توانید نتایج را ببینید و اگر گم شود قابل بازیابی نیست.</div>
        <a class="btn ghost small" href="#/q/${esc(id)}">پیش‌نمایش آزمون</a>
      </div>
      <div class="card">
        <h2>نتایج <span class="badge">${faNum(subs.length)} شرکت‌کننده</span>
          ${subs.length ? `<span class="badge">میانگین ${faNum(Math.round(avg * 100))}٪</span>` : ""}</h2>
        ${subs.length ? `
          <div style="overflow-x:auto"><table>
            <thead><tr><th>نام</th><th>نمره</th><th>زمان</th></tr></thead>
            <tbody>${subs.map((s) => `<tr><td>${esc(s.name)}</td>
              <td>${faNum(s.score)} از ${faNum(s.total)}</td>
              <td>${esc(new Date(s.created_at).toLocaleString("fa-IR"))}</td></tr>`).join("")}</tbody>
          </table></div>
          <div class="actions"><button class="btn ghost small" id="csv">دانلود CSV</button>
            <button class="btn ghost small" id="refresh">به‌روزرسانی</button></div>`
        : `<p class="muted">هنوز کسی شرکت نکرده است.</p>
           <button class="btn ghost small" id="refresh">به‌روزرسانی</button>`}
      </div>`;
    copyBtnHandlers(app);
    document.getElementById("refresh").addEventListener("click", () => viewManage(id, secret, false));
    const csv = document.getElementById("csv");
    if (csv) csv.addEventListener("click", () => {
      // جلوگیری از اجرای فرمول در اکسل
      const cell = (v) => {
        let t = String(v);
        if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
        return '"' + t.replace(/"/g, '""') + '"';
      };
      const lines = [["نام", "نمره", "از", "زمان"].map(cell).join(",")].concat(
        subs.map((s) => [s.name, s.score, s.total, s.created_at].map(cell).join(","))
      );
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `results-${id}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  function showError(text) {
    app.innerHTML = `<div class="err" role="alert">${esc(text)}</div><a class="btn ghost" href="#/">بازگشت به صفحه‌ی اصلی</a>`;
  }

  function showSetup() {
    app.innerHTML = `
      <h1>راه‌اندازی لازم است</h1>
      <div class="warn">مقدارهای <code>SUPABASE_URL</code> و <code>SUPABASE_ANON_KEY</code> در فایل <code>config.js</code> پر نشده‌اند.
      مراحل در فایل README.md توضیح داده شده است.</div>`;
  }

  /* ---------- مسیریابی ---------- */
  function route() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return showSetup();
    const [path, query] = location.hash.replace(/^#/, "").split("?");
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "q" && parts[1]) return viewTake(decodeURIComponent(parts[1]));
    if (parts[0] === "m" && parts[1] && parts[2])
      return viewManage(decodeURIComponent(parts[1]), decodeURIComponent(parts[2]), /(^|&)new=1/.test(query || ""));
    viewCreate();
  }
  window.addEventListener("hashchange", route);
  route();
})();
