#!/usr/bin/env node
// فهرست همه‌ی کتاب‌های درسی سایت chap.sch.ir را (بدون دانلود PDF) می‌سازد: /root/books.list
// هر خط:  شناسه | آدرس-PDF | عنوان | مسیر-دسته‌بندی
// اجرا:  node crawl-books.js           (چند دقیقه طول می‌کشد؛ آرام و با فاصله درخواست می‌دهد)
'use strict';
const fs = require('fs');
const BASE = (process.env.CRAWL_BASE || 'http://chap.sch.ir').replace(/\/+$/, '');
const OUT = process.env.CRAWL_OUT || '/root/books.list';
const CONC = 3, DELAY = 250, MAX_PAGES = 4000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) {
  const url = path.startsWith('http') ? path : BASE + path;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; pazmoonak-books)' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) { await sleep(1500 * (i + 1)); }
  }
  return null;
}
const dec = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
const hrefs = (html) => Array.from(html.matchAll(/href="([^"#]+)"/g), (m) => m[1].replace(/&amp;/g, '&'));
const txt = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

(async () => {
  const seenPages = new Set(), books = new Map();   // id -> مسیر دسته‌بندی
  const queue = ['/books'];
  let fetched = 0;
  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      if (!p || seenPages.has(p) || fetched >= MAX_PAGES) continue;
      seenPages.add(p); fetched++;
      const html = await get(p); await sleep(DELAY);
      if (!html) continue;
      const catPath = dec(p.replace(/\?.*$/, '')).replace(/^\/category\//, '').replace(/\/\d+$/, '');
      for (let h of hrefs(html)) {
        h = h.replace(/^https?:\/\/chap\.sch\.ir/i, '');
        let m;
        if ((m = /^\/books\/(\d+)$/.exec(h))) { if (!books.has(m[1]) || catPath.length > books.get(m[1]).length) books.set(m[1], p.startsWith('/category/') ? catPath : (books.get(m[1]) || '')); }
        else if (/^\/category\/[^?]+$/.test(h) || /^(\/category\/[^?]+)?\?page=\d+$/.test(h) || /^\/books\?page=\d+$/.test(h)) {
          const full = h.startsWith('?') ? p.replace(/\?.*$/, '') + h : h;
          if (!seenPages.has(full)) queue.push(full);
        }
      }
      if (fetched % 50 === 0) console.log('صفحه‌ی بررسی‌شده: ' + fetched + ' | کتاب پیدا شده: ' + books.size + ' | در صف: ' + queue.length);
    }
  }
  // کارگرها تا خالی‌شدن صف ادامه می‌دهند
  for (let round = 0; round < 50; round++) {
    await Promise.all(Array.from({ length: CONC }, worker));
    if (!queue.length) break;
  }
  console.log('پایان بررسی دسته‌ها. کتاب‌ها: ' + books.size + '  — حالا صفحه‌ی هر کتاب...');
  const ids = Array.from(books.keys());
  const lines = []; let miss = 0, i = 0;
  async function bw() {
    while (i < ids.length) {
      const id = ids[i++];
      const html = await get('/books/' + id); await sleep(DELAY);
      if (!html) { miss++; continue; }
      const pdf = (html.match(/href="([^"]+\/lbooks\/[^"]+\.pdf)"/i) || html.match(/href="([^"]+\.pdf)"/i) || [])[1];
      if (!pdf) { miss++; continue; }
      const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
      const tt = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
      const title = txt(h1 || (tt || '').split('|')[0] || '').slice(0, 120);
      const url = pdf.startsWith('http') ? pdf : BASE + (pdf.startsWith('/') ? '' : '/') + pdf;
      lines.push([id, url, title, books.get(id)].join(' | '));
      if (lines.length % 50 === 0) console.log('کتاب خوانده‌شده: ' + lines.length + '/' + ids.length);
    }
  }
  await Promise.all(Array.from({ length: CONC }, bw));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log('تمام شد: ' + lines.length + ' کتاب با لینک PDF در ' + OUT + ' ذخیره شد' + (miss ? ' (' + miss + ' صفحه بدون PDF)' : '') + '.');
})().catch((e) => { console.error('❌ ' + (e && e.stack || e)); process.exit(1); });
