// מומנט - ייבוא פתקים ותעודות משלוח מטקסט. עובד בדפדפן וב-node, בלי תלויות.
(function (root) {
  const SIZE_SUFFIX = /\s*[—–\-]\s*(\d{1,2}|XXS|XS|S|M|L|XL|XXL)\s*$/i;
  const num = s => parseFloat(String(s).replace(/[₪,\s]/g, ""));
  const clean = s => String(s).replace(/[‎‏‪-‮]/g, "").replace(/\s+/g, " ").trim();
  const lines = t => String(t).split(/\r?\n/).map(clean).filter(Boolean);

  // "1.9" או "5/9/26" -> {day, month, year|null}
  function parseDate(s) {
    const m = String(s).match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
    if (!m) return null;
    let y = m[3] ? +m[3] : null;
    if (y && y < 100) y += 2000;
    return { day: +m[1], month: +m[2], year: y };
  }

  // פתק מלאי/מכירות בסגנון של בעלת החנות:
  //   סטודיו הדגמה מלאי 1.9
  //   6 אוברול קיצי
  //   מכירות
  //   אוברול דמו חום מידה 1 ו 0
  // כמות יכולה להופיע בכמה צורות בכתב היד: "3 תמר", "תמר 3", "3 x תמר", "תמר x 3", או בלי מספר
  function parseQtyLine(ln) {
    let m;
    // דגם שהוא מספר (קוד), למשל "70003*2": שני הצדדים מספרים. הכמות היא הצד הקצר, ובתיקו הצד הימני (קוד*כמות)
    if ((m = ln.match(/^(\d+)\s*[xX×*]\s*(\d+)$/))) {
      const a = m[1], b = m[2];
      return a.length < b.length ? { qty: +a, model: b } : { qty: +b, model: a };
    }
    if ((m = ln.match(/^(\d+)\s*[xX×*]\s*(.+)$/))) return { qty: +m[1], model: clean(m[2]) };
    if ((m = ln.match(/^(.+?)\s*[xX×*]\s*(\d+)$/))) return { qty: +m[2], model: clean(m[1]) };
    if ((m = ln.match(/^(\d+)\s+(.+)$/))) return { qty: +m[1], model: clean(m[2]) };
    if ((m = ln.match(/^(.+?)\s+(\d+)$/))) return { qty: +m[2], model: clean(m[1]) };
    return { qty: null, model: ln };
  }

  // opts.missingQty: כמות להניח לשורה בלי מספר (ברירת מחדל 1), או null כדי להשאיר ריקה
  function parseNote(text, opts) {
    const missing = opts && opts.missingQty !== undefined && opts.missingQty !== null ? opts.missingQty : 1, assumed = [];
    const out = { designer: null, date: null, received: [], sold: [], flags: [] };
    let mode = "stock";
    lines(text).forEach((ln, i) => {
      const h = ln.match(/^(.*?)\s*מלאי\s+([\d./]+)$/), h2 = ln.match(/^מלאי\s+(.+?)\s+([\d./]+)$/);
      if (h && i === 0) { out.designer = h[1] || null; out.date = parseDate(h[2]); return; }
      if (h2 && i === 0) { out.designer = h2[1]; out.date = parseDate(h2[2]); return; }
      if (/^(מכירות|מכירה)$/.test(ln)) { mode = "sales"; return; }
      if (/^(החזרות|החזרה)$/.test(ln)) { mode = "returns"; return; }
      if (mode === "stock" || mode === "returns") {
        const q = parseQtyLine(ln), target = mode === "stock" ? out.received : (out.returned = out.returned || []);
        if (q.qty != null) target.push({ model: q.model, qty: q.qty, size: null });
        else if (opts && opts.missingQty === null) target.push({ model: q.model, qty: null, size: null, assumed: false });
        else { target.push({ model: q.model, qty: missing, size: null, assumed: true }); assumed.push(q.model); }
      } else {
        const m = ln.match(/^(.*?)\s+מידה\s+(.+)$/);
        if (m) {
          m[2].split(/\s*(?:ו|,|\/)\s*|\s+ו\s+/).map(clean).filter(Boolean).forEach(sz => out.sold.push({ model: m[1], qty: 1, size: sz }));
        } else {
          out.sold.push({ model: ln, qty: 1, size: null });
          out.flags.push(`מכירה בלי מידה: "${ln}"`);
        }
      }
    });
    if (assumed.length) out.flags.push(`${assumed.length} שורות בלי מספר נספרו כיחידה אחת (צריך אישור): ${assumed.join(", ")}`);
    if (!out.date) out.flags.push("אין תאריך בכותרת");
    else if (!out.date.year) out.flags.push(`התאריך ${out.date.day}.${out.date.month} בלי שנה (מניחים השנה הנוכחית, יום.חודש)`);
    return out;
  }

  // תעודת משלוח מודפסת, כשהטקסט הועתק משורות הטבלה.
  // כל שורה: מספר  שם [— מידה]  כמות  מחיר ליחידה  סה"כ שורה (מופרדים בטאב, |, או 2+ רווחים)
  function parseDeliveryNote(text) {
    const out = { docNo: null, date: null, designer: null, items: [], declared: {}, flags: [] };
    const L = lines(text);
    for (const ln of L) {
      let m;
      if ((m = ln.match(/\b([A-Z]{2,}\d{3,})\b/)) && !out.docNo) out.docNo = m[1];
      if ((m = ln.match(/(\d{1,2}\.\d{1,2}\.\d{4})/)) && !out.date && !/הוקם|הופק/.test(ln)) out.date = parseDate(m[1]);
      if (/סכום לפני מע.?מ/.test(ln)) out.declared.net = num(ln.match(/([\d,]+\.\d{2})/)[1]);
      else if (/^מע.?מ\s/.test(ln)) out.declared.vat = num(ln.match(/([\d,]+\.\d{2})/)[1]);
      else if (/סה.?כ לתשלום/.test(ln)) out.declared.total = num(ln.match(/([\d,]+\.\d{2})/)[1]);
      if (/-\s*[A-Z]{3,}/.test(ln) && !out.designer && !/\d{3,}/.test(ln)) out.designer = ln;
    }
    const rowRe = /^(\d+)\s*[\t|]?\s*(.+?)\s*[\t|]\s*(\d+)\s*[\t|]\s*₪?([\d,.]+)\s*[\t|]\s*₪?([\d,.]+)$|^(\d+)\s+(.+?)\s{2,}(\d+)\s+₪?([\d,.]+)\s+₪?([\d,.]+)$/;
    for (const raw of String(text).split(/\r?\n/)) {
      const ln = raw.replace(/[‎‏‪-‮]/g, "").trim();
      const m = ln.match(rowRe);
      if (!m) continue;
      const g = m[1] ? m.slice(1, 6) : m.slice(6, 11);
      let name = clean(g[1]), size = null;
      const sm = name.match(SIZE_SUFFIX);
      if (sm) { size = sm[1]; name = clean(name.replace(SIZE_SUFFIX, "")); }
      const qty = +g[2], unit = num(g[3]), line = num(g[4]);
      if (Math.abs(qty * unit - line) > 0.02) out.flags.push(`שורה ${g[0]}: כמות×מחיר (${(qty * unit).toFixed(2)}) שונה מסה"כ השורה (${line})`);
      out.items.push({ row: +g[0], model: name, size, qty, unit, line });
    }
    const rows = out.items.map(i => i.row);
    for (let i = 1; i <= Math.max(0, ...rows); i++) if (!rows.includes(i)) out.flags.push(`שורה ${i} חסרה (אולי לא הועתקה)`);
    out.net = +out.items.reduce((s, i) => s + i.line, 0).toFixed(2);
    out.units = out.items.reduce((s, i) => s + i.qty, 0);
    if (out.declared.net != null && Math.abs(out.net - out.declared.net) > 0.02) out.flags.push(`סכום השורות ${out.net} שונה מהסכום בתעודה ${out.declared.net}`);
    if (out.declared.net != null && out.declared.vat != null && Math.abs(out.declared.net * 0.18 - out.declared.vat) > 0.02) out.flags.push("המע\"מ בתעודה לא תואם 18%");
    const withSize = out.items.filter(i => i.size).length;
    out.sizedRows = withSize;
    return out;
  }

  // איחוד שורות זהות (דגם+מידה)
  function merge(items) {
    const map = new Map();
    items.forEach(i => {
      const k = i.model + "|" + (i.size || "");
      const e = map.get(k) || { model: i.model, size: i.size || null, qty: 0 };
      e.qty += i.qty == null ? 0 : i.qty;
      map.set(k, e);
    });
    return [...map.values()];
  }

  // התאמה לשמות קיימים במערכת
  const STOP = new Set(["חולצת", "אוברול", "גולף", "שמלת", "מכנסי"]);
  const toks = s => clean(s).split(" ").filter(Boolean);
  function match(name, catalog) {
    const n = clean(name);
    const exact = catalog.find(c => clean(c) === n);
    if (exact) return { status: "exact", match: exact };
    const t = new Set(toks(n));
    let best = null, bs = 0;
    catalog.forEach(c => {
      const ct = toks(c);
      const inter = ct.filter(x => t.has(x)).length;
      const sc = inter / Math.max(ct.length, t.size);
      if (sc > bs) { bs = sc; best = c; }
    });
    // שם קצר ("אוברול דמו") שמוכל בשם ארוך עם צבע ("אוברול דמו חום")
    const contained = catalog.filter(c => clean(c).startsWith(n + " ") || n.startsWith(clean(c) + " "));
    if (contained.length) return { status: "variants", matches: contained };
    if (bs >= 0.5) return { status: "similar", match: best, score: +bs.toFixed(2) };
    return { status: "new" };
  }

  const api = { parseNote, parseDeliveryNote, merge, match, parseDate };
  if (typeof module !== "undefined") module.exports = api; else root.MomentImport = api;
})(typeof window !== "undefined" ? window : this);
