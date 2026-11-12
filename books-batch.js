#!/usr/bin/env node
// دانلود و ورود کتاب‌های درسی پایه‌ی هفتم تا دوازدهم (کتاب دانش‌آموز، کتاب کار و همه‌ی رشته‌ها) به معلم هوشمند، با یک دستور.
// برای هر کتاب: دانلود PDF ← پیدا کردن خودکار شماره‌ی صفحه‌ی چاپی ← ساخت خودکار فهرست مطالب ← ورود (ingest.js) ← پاک‌کردن PDF.
// کتاب‌هایی که قبلاً وارد شده‌اند رد می‌شوند؛ پس اگر وسط کار قطع شد، دوباره اجرا کنید تا ادامه دهد.
// اجرا (با env سرور):  set -a; . /etc/pazmoonak/env; set +a; cd /opt/pazmoonak && node /root/books-batch.js
// گزینه‌ها: --only 14199,14200   فقط همین شناسه‌ها    |   --force  دوباره‌ی همه    |   --dry  فقط فهرست را نشان بده
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const LIST = process.env.BATCH_LIST ? JSON.parse(fs.readFileSync(process.env.BATCH_LIST, 'utf8')) : [
  ["14195", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C701.pdf", "آموزش قرآن", "هفتم", "آموزش قرآن"],
  ["14206", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C712.pdf", "تفکر و سبک زندگی (پسران)", "هفتم", "تفکر و سبک زندگی"],
  ["14207", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C713.pdf", "تفکر و سبک زندگی (دختران)", "هفتم", "تفکر و سبک زندگی"],
  ["14199", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C705.pdf", "ریاضی", "هفتم", "ریاضی"],
  ["14204", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C710.pdf", "انگلیسی (1)", "هفتم", "زبان انگلیسی"],
  ["14205", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C711.pdf", "کتاب کار انگلیسی (1)", "هفتم", "زبان انگلیسی"],
  ["14203", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C709.pdf", "عربی", "هفتم", "عربی"],
  ["14200", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C706.pdf", "علوم تجربی", "هفتم", "علوم تجربی"],
  ["14197", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C703.pdf", "فارسی", "هفتم", "فارسی"],
  ["14202", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C708.pdf", "فرهنگ و هنر", "هفتم", "فرهنگ و هنر"],
  ["14201", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C707.pdf", "مطالعات اجتماعی", "هفتم", "مطالعات اجتماعی"],
  ["14198", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C704.pdf", "نگارش", "هفتم", "نگارش"],
  ["14215", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C741.pdf", "تربیت دینی (از من تا خدا)", "هفتم", "دینی"],
  ["14208", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/555/C717.pdf", "کار و فناوری", "هفتم", "کار و فناوری"],
  ["14210", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C801.pdf", "آموزش قرآن", "هشتم", "آموزش قرآن"],
  ["14227", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C812.pdf", "تفکر و سبک زندگی", "هشتم", "تفکر و سبک زندگی"],
  ["14228", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C814.pdf", "تفکر و سبک زندگی (پسران)", "هشتم", "تفکر و سبک زندگی"],
  ["14220", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C805.pdf", "ریاضی", "هشتم", "ریاضی"],
  ["14225", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C810.pdf", "انگلیسی (2)", "هشتم", "زبان انگلیسی"],
  ["14226", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C811.pdf", "کتاب کار انگلیسی (2)", "هشتم", "زبان انگلیسی"],
  ["14224", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C809.pdf", "عربی", "هشتم", "عربی"],
  ["14221", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C806.pdf", "علوم تجربی", "هشتم", "علوم تجربی"],
  ["14218", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C803.pdf", "فارسی", "هشتم", "فارسی"],
  ["14223", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C808.pdf", "فرهنگ و هنر", "هشتم", "فرهنگ و هنر"],
  ["14222", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C807.pdf", "مطالعات اجتماعی", "هشتم", "مطالعات اجتماعی"],
  ["14219", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C804.pdf", "نگارش", "هشتم", "نگارش"],
  ["14217", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C802.pdf", "پیام‌های آسمان", "هشتم", "دینی"],
  ["14234", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C841.pdf", "تربیت دینی (از من تا خدا)", "هشتم", "دینی"],
  ["14229", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/558/C817.pdf", "کار و فناوری", "هشتم", "کار و فناوری"],
  ["15012", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C915.pdf", "آمادگی دفاعی", "نهم", "آمادگی دفاعی"],
  ["14236", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C901.pdf", "آموزش قرآن", "نهم", "آموزش قرآن"],
  ["14240", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C905.pdf", "ریاضی", "نهم", "ریاضی"],
  ["14245", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C910.pdf", "انگلیسی (3)", "نهم", "زبان انگلیسی"],
  ["14246", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C911.pdf", "کتاب کار انگلیسی (3)", "نهم", "زبان انگلیسی"],
  ["14244", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C909.pdf", "عربی", "نهم", "عربی"],
  ["14241", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C906.pdf", "علوم تجربی", "نهم", "علوم تجربی"],
  ["14238", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C903.pdf", "فارسی", "نهم", "فارسی"],
  ["14243", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C908.pdf", "فرهنگ و هنر", "نهم", "فرهنگ و هنر"],
  ["14242", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C907.pdf", "مطالعات اجتماعی", "نهم", "مطالعات اجتماعی"],
  ["14239", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C904.pdf", "نگارش", "نهم", "نگارش"],
  ["14237", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C902.pdf", "پیام‌های آسمان", "نهم", "دینی"],
  ["14967", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C941.pdf", "تربیت دینی (از من تا خدا)", "نهم", "دینی"],
  ["14247", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/556/C917.pdf", "کار و فناوری", "نهم", "کار و فناوری"],
  ["14261", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/40/C110217.pdf", "آزمایشگاه علوم تجربی (1)", "دهم", "آزمایشگاه علوم تجربی"],
  ["14974", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/694/C110215.pdf", "آمادگی دفاعی", "دهم", "آمادگی دفاعی"],
  ["14278", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110226.pdf", "احکام (1) (پسران)", "دهم", "احکام"],
  ["14280", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110232.pdf", "احکام (1) (دختران)", "دهم", "احکام"],
  ["14283", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110235.pdf", "اخلاق اسلامی (1)", "دهم", "اخلاق اسلامی"],
  ["14279", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110227.pdf", "اصول و عقاید (1)", "دهم", "اصول و عقاید"],
  ["14275", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110221.pdf", "اقتصاد", "دهم", "اقتصاد"],
  ["14273", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/37/C110219.pdf", "تاریخ (1) (ایران و جهان باستان)", "دهم", "تاریخ"],
  ["14281", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110233.pdf", "تاریخ اسلام (1)", "دهم", "تاریخ"],
  ["15018", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/693/C110225.pdf", "تفکر و سواد رسانه‌ای", "دهم", "تفکر و سواد رسانه ای"],
  ["14274", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110220.pdf", "جامعه‌شناسی (1)", "دهم", "جامعه‌شناسی"],
  ["14262", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/692/C110218.pdf", "جغرافیای ایران", "دهم", "جغرافیا"],
  ["14269", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/37/C110205.pdf", "دین و زندگی (1)", "دهم", "دین و زندگی"],
  ["14259", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/40/C110211.pdf", "ریاضی (1)", "دهم", "ریاضی"],
  ["14272", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110212.pdf", "ریاضی و آمار (1)", "دهم", "ریاضی و آمار"],
  ["14265", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110230.pdf", "انگلیسی (1)", "دهم", "زبان انگلیسی"],
  ["14266", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110231_0.pdf", "کتاب کار انگلیسی (1)", "دهم", "زبان انگلیسی"],
  ["14268", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/40/C110216.pdf", "زیست‌شناسی (1)", "دهم", "زیست‌شناسی"],
  ["14258", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/40/C110210.pdf", "شیمی (1)", "دهم", "شیمی"],
  ["14257", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/40/C110206.pdf", "عربی، زبان قرآن (1) · ریاضی و تجربی", "دهم", "عربی"],
  ["14271", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/37/C110207.pdf", "عربی، زبان قرآن (1) · علوم انسانی", "دهم", "عربی"],
  ["14277", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110208.pdf", "عربی، زبان قرآن (1) · علوم و معارف اسلامی", "دهم", "عربی"],
  ["14270", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110203.pdf", "علوم و فنون ادبی (1)", "دهم", "علوم و فنون ادبی"],
  ["14282", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110234.pdf", "علوم و معارف قرآنی (1)", "دهم", "علوم و معارف قرآنی"],
  ["14253", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110201.pdf", "فارسی (1)", "دهم", "فارسی"],
  ["14267", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/40/C110214.pdf", "فیزیک (1) · علوم تجربی", "دهم", "فیزیک"],
  ["14284", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/30/C110209.pdf", "فیزیک (1) · ریاضی فیزیک", "دهم", "فیزیک"],
  ["14276", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110223.pdf", "منطق", "دهم", "منطق"],
  ["14255", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110202.pdf", "نگارش (1)", "دهم", "نگارش"],
  ["14260", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/29/C110213.pdf", "هندسه (1)", "دهم", "هندسه"],
  ["14263", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/693/C110222.pdf", "هنر", "دهم", "هنر"],
  ["14264", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C110224.pdf", "کارگاه کارآفرینی و تولید", "دهم", "کارگاه کارآفرینی و تولید"],
  ["14325", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/41/C111217.pdf", "آزمایشگاه علوم تجربی (2)", "یازدهم", "آزمایشگاه علوم تجربی"],
  ["14324", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/30/C111215.pdf", "آمار و احتمال", "یازدهم", "آمار و احتمال"],
  ["14343", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111227.pdf", "احکام (2)", "یازدهم", "احکام"],
  ["14346", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111235.pdf", "اخلاق اسلامی (2)", "یازدهم", "اخلاق اسلامی"],
  ["14344", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111232.pdf", "اصول و عقاید (2)", "یازدهم", "اصول و عقاید"],
  ["14329", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/693/C111268.pdf", "انسان و محیط زیست", "یازدهم", "انسان و محیط زیست"],
  ["14338", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/38/C111219.pdf", "تاریخ (2)", "یازدهم", "تاریخ"],
  ["14976", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111233.pdf", "تاریخ اسلام (2)", "یازدهم", "تاریخ"],
  ["14339", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/38/C111222.pdf", "جامعه‌شناسی (2)", "یازدهم", "جامعه‌شناسی"],
  ["14348", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/38/C111218.pdf", "جغرافیای ناحیه‌ای (2)", "یازدهم", "جغرافیا"],
  ["14323", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/30/C111214.pdf", "حسابان (1)", "یازدهم", "حسابان"],
  ["14335", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/38/C111205.pdf", "دین و زندگی (2)", "یازدهم", "دین و زندگی"],
  ["14340", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111224.pdf", "روان‌شناسی", "یازدهم", "روان‌شناسی"],
  ["14330", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/41/C111211.pdf", "ریاضی (2)", "یازدهم", "ریاضی"],
  ["14337", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111212.pdf", "ریاضی و آمار (2)", "یازدهم", "ریاضی و آمار"],
  ["14327", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111230.pdf", "انگلیسی (2)", "یازدهم", "زبان انگلیسی"],
  ["14349", "http://chap.sch.ir/sites/default/files/lbooks/1404-1405/44/C111231_0.pdf", "کتاب کار انگلیسی (2)", "یازدهم", "زبان انگلیسی"],
  ["14332", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/41/C111237.pdf", "زمین‌شناسی", "یازدهم", "زمین‌شناسی"],
  ["14331", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/41/C111216.pdf", "زیست‌شناسی (2)", "یازدهم", "زیست‌شناسی"],
  ["14321", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/41/C111210.pdf", "شیمی (2)", "یازدهم", "شیمی"],
  ["14320", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/41/C111206.pdf", "عربی، زبان قرآن (2) · ریاضی و تجربی", "یازدهم", "عربی"],
  ["14336", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/38/C111207.pdf", "عربی، زبان قرآن (2) · علوم انسانی", "یازدهم", "عربی"],
  ["14342", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111208.pdf", "عربی، زبان قرآن (2) · علوم و معارف اسلامی", "یازدهم", "عربی"],
  ["14334", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111203.pdf", "علوم و فنون ادبی (2)", "یازدهم", "علوم و فنون ادبی"],
  ["14345", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111234.pdf", "علوم و معارف قرآنی (2)", "یازدهم", "علوم و معارف قرآنی"],
  ["14316", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111201.pdf", "فارسی (2)", "یازدهم", "فارسی"],
  ["14341", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111226.pdf", "فلسفه (1)", "یازدهم", "فلسفه"],
  ["14318", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/30/C111209.pdf", "فیزیک (2) · ریاضی فیزیک", "یازدهم", "فیزیک"],
  ["14333", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/41/C111244.pdf", "فیزیک (2) · علوم تجربی", "یازدهم", "فیزیک"],
  ["14317", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/44/C111202.pdf", "نگارش (2)", "یازدهم", "نگارش"],
  ["14322", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/30/C111213.pdf", "هندسه (2)", "یازدهم", "هندسه"],
  ["14376", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112235.pdf", "اخلاق اسلامی (3)", "دوازدهم", "اخلاق اسلامی"],
  ["14370", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112227.pdf", "اصول عقاید (3)", "دوازدهم", "اصول عقاید"],
  ["14977", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/709/C112219.pdf", "تاریخ (3) - ایران و جهان معاصر", "دوازدهم", "تاریخ"],
  ["14978", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112233.pdf", "تاریخ (3) - ایران در دوره اسلامی", "دوازدهم", "تاریخ"],
  ["14368", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112223.pdf", "تحلیل فرهنگی", "دوازدهم", "تحلیل فرهنگی"],
  ["14367", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/709/C112222.pdf", "جامعه‌شناسی (3)", "دوازدهم", "جامعه‌شناسی"],
  ["14378", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112242.pdf", "جریان شناسی اندیشه‌های معاصر ایران", "دوازدهم", "جریان شناسی اندیشه های معاصر ایران"],
  ["14365", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/709/C112218.pdf", "جغرافیا (3) (کاربردی)", "دوازدهم", "جغرافیا"],
  ["14362", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/711/C112214.pdf", "حسابان (2)", "دوازدهم", "حسابان"],
  ["14353", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/709/C112205.pdf", "دین و زندگی (3)", "دوازدهم", "دین و زندگی"],
  ["14374", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112232.pdf", "روش استنباط احکام (احکام 3)", "دوازدهم", "روش استنباط احکام"],
  ["14359", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/712/C112211.pdf", "ریاضی (3)", "دوازدهم", "ریاضی"],
  ["14360", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112212.pdf", "ریاضی و آمار (3)", "دوازدهم", "ریاضی و آمار"],
  ["14363", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/711/C112215.pdf", "ریاضیات گسسته", "دوازدهم", "ریاضیات گسسته"],
  ["14372", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112230.pdf", "انگلیسی (3)", "دوازدهم", "زبان انگلیسی"],
  ["14373", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112231.pdf", "کتاب کار انگلیسی (3)", "دوازدهم", "زبان انگلیسی"],
  ["14364", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/712/C112216.pdf", "زیست‌شناسی (3)", "دوازدهم", "زیست‌شناسی"],
  ["14358", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/712/C112210.pdf", "شیمی (3)", "دوازدهم", "شیمی"],
  ["14354", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/712/C112206.pdf", "عربی، زبان قرآن (3) · ریاضی و تجربی", "دوازدهم", "عربی"],
  ["14355", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/709/C112207.pdf", "عربی، زبان قرآن (3) · علوم انسانی", "دوازدهم", "عربی"],
  ["14356", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112208.pdf", "عربی، زبان قرآن (3) · علوم و معارف اسلامی", "دوازدهم", "عربی"],
  ["14382", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/43/C112203.pdf", "علوم و فنون ادبی (3)", "دوازدهم", "علوم و فنون ادبی"],
  ["14375", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112234.pdf", "علوم و معارف قرآنی (3)", "دوازدهم", "علوم و معارف قرآنی"],
  ["14350", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112201.pdf", "فارسی (3)", "دوازدهم", "فارسی"],
  ["14369", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112226.pdf", "فلسفه (2)", "دوازدهم", "فلسفه"],
  ["14357", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/711/C112209.pdf", "فیزیک (3) · ریاضی فیزیک", "دوازدهم", "فیزیک"],
  ["14379", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/712/C112244.pdf", "فیزیک (3) · علوم تجربی", "دوازدهم", "فیزیک"],
  ["14351", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/710/C112202.pdf", "نگارش (3)", "دوازدهم", "نگارش"],
  ["14361", "http://chap.sch.ir/sites/default/files/lbooks/1405-1406/711/C112213.pdf", "هندسه (3)", "دوازدهم", "هندسه"]
];

const BOOKS = (process.env.BOOKS_DIR || '/var/lib/pazmoonak-books').replace(/\/+$/, '');
const INGEST = process.env.INGEST_JS || '/opt/pazmoonak/ingest.js';
const TMP = process.env.BATCH_TMP || '/root/books-tmp';
const argv = process.argv.slice(2);
const FORCE = argv.includes('--force'), DRY = argv.includes('--dry');
const manual = new Map(String(argv.includes('--offsets') ? argv[argv.indexOf('--offsets') + 1] || '' : '').split(',').filter(Boolean).map((x) => x.split('=')));   // --offsets 14263=-1,14324=3  (offset دستی)
const only = argv.includes('--only') ? new Set(String(argv[argv.indexOf('--only') + 1] || '').split(',')) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try { require(process.env.SHIM_JS || '/opt/pazmoonak/deno-shim.js'); } catch (e) { /* بدون واسطه‌ی AI_RELAY ادامه می‌دهیم */ }   // fetch را از AI_RELAY عبور می‌دهد، مثل خود سرور
const VISION_URL = process.env.VISION_URL || 'https://api.deepseek.com/chat/completions';
const VISION_MODEL = process.env.VISION_MODEL || 'deepseek-v4-flash-vision-exp';
const BIDI = /[‎‏‪-‮⁦-⁩]/g;
const toAscii = (s) => s.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));

async function download(url, dest) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(300000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; pazmoonak-books)' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      const head = fs.readFileSync(dest).subarray(0, 5).toString('latin1');
      if (head !== '%PDF-') throw new Error('not a pdf');
      return true;
    } catch (e) { await sleep(2000 * (i + 1)); }
  }
  return false;
}

function pageTexts(pdf, from, to) {
  const r = cp.spawnSync('pdftotext', ['-f', String(from), '-l', String(to), '-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) return [];
  const pages = r.stdout.split('\f'); if (pages.length && !pages[pages.length - 1].trim()) pages.pop();
  return pages;
}

// شماره‌ی چاپی = شماره‌ی صفحه‌ی PDF − ۱ − offset. offset از روی شماره‌های پایین (یا بالای) صفحه‌ها پیدا می‌شود.
function detectOffset(pdf) {
  const pages = pageTexts(pdf, 1, 120);
  const votes = new Map(); let total = 0;
  pages.forEach((t, i) => {
    const p = i + 1;
    const lines = t.split('\n').map((l) => toAscii(l.replace(BIDI, '')).trim()).filter(Boolean);
    if (!lines.length) return;
    for (const cand of [lines[lines.length - 1], lines[0], lines[lines.length - 2], lines[1], lines[lines.length - 3]]) {
      if (cand === undefined) continue;
      if (/^\d{1,3}$/.test(cand)) { const k = +cand; if (k >= 1 && k <= p) { const off = p - k - 1; votes.set(off, (votes.get(off) || 0) + 1); total++; break; } }
    }
  });
  let best = null, bc = 0;
  for (const [o, c] of votes) if (c > bc) { best = o; bc = c; }
  if (best === null || bc < 5 || bc / total < 0.6) return null;
  return best;
}


// کتاب‌هایی که متن لایه‌ی PDF ندارند (بیشتر دبستان): از DeepSeek Vision می‌خواهیم شماره‌ی چاپی چند صفحه را بخواند و رأی می‌گیریم.
let VLAST = '';
const asc = (x) => String(x).replace(/[^\x20-\x7e]/g, '?').slice(0, 200);
async function visionOffset(pdf, slug) {
  VLAST = '';
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) { VLAST = 'no DEEPSEEK_API_KEY in env'; return null; }
  const dir = path.join(TMP, slug + '-v');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const votes = new Map(); let total = 0, SAMPLE = '';
  for (const [FIRST, LAST] of [[4, 21], [22, 45]]) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const rr = cp.spawnSync('pdftoppm', ['-f', String(FIRST), '-l', String(LAST), '-scale-to-x', '720', '-scale-to-y', '-1', '-jpeg', '-jpegopt', 'quality=70', pdf, path.join(dir, 'v')], { encoding: 'utf8' });
  const files = rr.status === 0 ? fs.readdirSync(dir).filter((f) => /^v-\d+\.jpg$/.test(f)).sort() : [];
  if (!files.length) VLAST = 'pdftoppm made no images: ' + asc(rr.stderr || rr.error || rr.status);
  for (let i = 0; i < files.length; i += 4) {
    const part = files.slice(i, i + 4);
    const content = [{ type: 'text', text: 'These are pages of an Iranian school textbook, each labeled with its PDF page number. For each labeled page, read the page number that is PRINTED on the page itself (a small number near a bottom or top corner or the bottom center; digits may be Persian like ۱۲). Ignore lesson numbers, exercise numbers and years. If no printed page number is clearly visible, use null. Reply with ONLY a JSON object mapping the PDF page label to the printed number, for example {"4": null, "5": 12}.' }];
    part.forEach((f) => {
      const n = parseInt(f.slice(2, -4), 10);
      content.push({ type: 'text', text: 'PDF page ' + n + ':' });
      content.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64') } });
    });
    try {
      const r = await fetch(VISION_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify({ model: VISION_MODEL, messages: [{ role: 'user', content }], max_tokens: 4000, temperature: 0 }), signal: AbortSignal.timeout(120000) });
      if (!r.ok) { VLAST = 'HTTP ' + r.status + ' ' + asc(await r.text().catch(() => '')); continue; }
      const d = await r.json();
      const msg = (d && d.choices && d.choices[0] && d.choices[0].message) || {};
      const fin = d && d.choices && d.choices[0] && d.choices[0].finish_reason;
      const txt = toAscii(String(msg.content || '') + '\n' + (msg.content ? '' : String(msg.reasoning_content || '')));
      const found = new Map();
      for (const m of txt.matchAll(/["']?\b(\d{1,3})\b["']?\s*[:=]\s*["']?(null|\d{1,3})\b/gi)) found.set(parseInt(m[1], 10), /^null$/i.test(m[2]) ? null : parseInt(m[2], 10));
      if (!found.size) { VLAST = 'no pairs in reply: finish=' + fin + ' keys=' + Object.keys(msg).join('/') + ' len=' + txt.length + ' ' + asc(txt.trim()); continue; }
      if (!SAMPLE) SAMPLE = JSON.stringify([...found]).replace(/null/g, 'n').slice(0, 110);
      for (const [pg, num] of found) {
        if (pg >= FIRST && pg <= LAST && Number.isInteger(num) && num >= 1 && num < pg) { const off = pg - num - 1; votes.set(off, (votes.get(off) || 0) + 1); total++; }
      }
    } catch (e) { VLAST = 'error: ' + asc(e && e.message); }
  }
  if (best_ok(votes, total) !== null) break;
  }
  if (!VLAST && best_ok(votes, total) === null) VLAST = 'votes=' + [...votes].map(([o, c]) => o + ':' + c).join(',') + ' total=' + total + ' sample=' + SAMPLE;
  fs.rmSync(dir, { recursive: true, force: true });
  let best = null, bc = 0;
  for (const [o, c] of votes) if (c > bc) { best = o; bc = c; }
  if (best === null || bc < 3 || bc / total < 0.6) return null;
  return best;
}

function best_ok(votes, total) {
  let best = null, bc = 0;
  for (const [o, c] of votes) if (c > bc) { best = o; bc = c; }
  return (best === null || bc < 3 || bc / total < 0.6) ? null : best;
}

// فهرست مطالب: صفحه‌ی «فهرست» و صفحه‌ی بعدش (متن لایه‌ی PDF)
function makeToc(pdf) {
  const pages = pageTexts(pdf, 1, 14);
  let at = -1;
  for (let i = 0; i < pages.length; i++) {
    const first = pages[i].split('\n').map((l) => l.replace(BIDI, '').trim()).filter(Boolean).slice(0, 3).join(' ');
    if (/فهرست/.test(first)) { at = i; break; }
  }
  if (at < 0) return '';
  const txt = pages.slice(at, at + 2).join('\n').replace(BIDI, '').split('\n').map((l) => l.replace(/\s{2,}/g, '  ').trim()).filter(Boolean).join('\n');
  return txt.slice(0, 6000);
}

function imgCount(slug) { try { return fs.readdirSync(path.join(BOOKS, slug)).filter((f) => /^\d+\.jpg$/.test(f)).length; } catch (e) { return 0; } }

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const items = LIST.map((a) => ({ id: String(a[0]), url: a[1], title: a[2], grade: a[3], subject: a[4] })).filter((b) => !only || only.has(b.id));
  console.log('تعداد کتاب‌ها: ' + items.length);
  if (DRY) { items.forEach((b) => console.log(b.id + ' ' + b.grade + ' ' + b.subject)); return; }
  const done = [], skip = [], fail = [], noOff = [];
  let n = 0;
  for (const b of items) {
    n++;
    const slug = 'b' + b.id;
    const tag = '[' + n + '/' + items.length + '] ' + slug;
    if (!FORCE && imgCount(slug) >= 10) { console.log(tag + ' SKIP already done'); skip.push(b.id); continue; }
    const pdf = path.join(TMP, slug + '.pdf');
    if (!(await download(b.url, pdf))) { console.log(tag + ' FAIL download'); fail.push(b.id + ' download'); continue; }
    let off = manual.has(b.id) ? parseInt(manual.get(b.id), 10) : detectOffset(pdf), how = manual.has(b.id) ? 'manual' : 'text';
    if (off === null || Number.isNaN(off)) off = null;
    if (off === null) { off = await visionOffset(pdf, slug); how = 'vision'; }
    if (off === null) { console.log(tag + ' FAIL page-offset not detected (text and vision both failed) vision: ' + VLAST); noOff.push(b.id); try { fs.unlinkSync(pdf); } catch (e) { /* ignore */ } continue; }
    const toc = makeToc(pdf);
    const tocFile = path.join(TMP, slug + '.toc.txt');
    if (toc) fs.writeFileSync(tocFile, toc);
    const args = [INGEST, pdf, '--slug', slug, '--title', b.title, '--grade', b.grade, '--subject', b.subject, '--offset', String(off)];
    if (toc) args.push('--tocfile', tocFile);
    const r = cp.spawnSync('node', args, { encoding: 'utf8', env: process.env, maxBuffer: 16 * 1024 * 1024 });
    try { fs.unlinkSync(pdf); } catch (e) { /* ignore */ }
    try { fs.unlinkSync(tocFile); } catch (e) { /* ignore */ }
    if (r.status !== 0) { console.log(tag + ' FAIL ingest: ' + String(r.stdout + r.stderr).replace(/\s+/g, ' ').slice(-160)); fail.push(b.id + ' ingest'); continue; }
    console.log(tag + ' OK offset=' + off + '(' + how + ') pages=' + imgCount(slug) + (toc ? ' toc=yes' : ' toc=no'));
    done.push(b.id);
    await sleep(500);
  }
  console.log('=== SUMMARY: ok=' + done.length + ' skipped=' + skip.length + ' failed=' + fail.length + ' no-offset=' + noOff.length);
  if (fail.length) console.log('failed: ' + fail.join(', '));
  if (noOff.length) console.log('no-offset: ' + noOff.join(', '));
  console.log('DONE');
})().catch((e) => { console.error('ERROR ' + (e && e.stack || e)); process.exit(1); });
