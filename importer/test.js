const I = require("./importer.js");
const assert = require("assert");
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log("ok -", m); };

// 1. פתק של סטודיו הדגמה
const note1 = `סטודיו הדגמה מלאי 1.9
6 אוברול קיצי
6 אוברול דמו
9 חולצת רחבה
8 מכנסי דמו
5 חולצת כתף

מכירות
אוברול דמו חום מידה 1 ו 0
מכנסי דמו חום מידה 2 ו 1
רחבה חום`;
const n1 = I.parseNote(note1);
ok(n1.designer === "סטודיו הדגמה", "מעצבת זוהתה");
ok(n1.date.day === 1 && n1.date.month === 9, "תאריך 1.9");
ok(n1.received.reduce((s, x) => s + x.qty, 0) === 34, "34 פריטים התקבלו");
ok(n1.sold.length === 5, "5 מכירות (2+2+1)");
ok(n1.sold.filter(x => x.size).length === 4 && n1.flags.some(f => f.includes("רחבה חום")), "רחבה חום סומן כמכירה בלי מידה");
const cat = n1.received.map(x => x.model);
console.log(" התאמה:", I.match("אוברול דמו חום", cat), I.match("רחבה חום", cat), I.match("מכנסי דמו חום", cat));

// 2. פתק "בית דמו" - 22 שורות, חלקן בלי כמות
const note2 = `בית דמו מלאי 1.9
2 ברוש
3 תמר
3 שקד
3 רימון
2 אקליפטוס
לימון
2 זית
תאנה
3 אגוז
2 קוקוס
5 ערבה
2 אורן
3 דקל
גפן
חרוב
צאלון
2 אשכולית
תפוז
4 אפרסק
משמש
4 שזיף
3 אננס
קיווי`;
const n2 = I.parseNote(note2);
ok(n2.received.length === 23, "23 שורות בפתק");
const noQty = n2.received.filter(x => x.assumed).length;
ok(noQty === 8, "8 שורות בלי מספר נספרו כיחידה אחת וסומנו לאישור (" + noQty + ")");
ok(n2.received.reduce((s, x) => s + x.qty, 0) === 8 + (2+3+3+3+2+2+3+2+5+2+3+2+4+4+3), "סכום כולל נכון עם ההנחה");
ok(I.parseNote(note2, { missingQty: null }).received.filter(x => x.qty == null).length === 8, "אפשר גם להשאיר שורות בלי מספר ריקות");

// כמה צורות כתיבה של כמות, וכותרת "מלאי <מעצבת> תאריך"
const n3 = I.parseNote(`מלאי בית דמו 28.10.26
3 x תמר
תמר x 3
2x אפרסק
אפרסק 2
3 שקד
שקד 3
גפן`);
ok(n3.designer === "בית דמו" && n3.date.day === 28 && n3.date.month === 10 && n3.date.year === 2026, "כותרת בצורה 'מלאי מעצבת תאריך'");
ok(JSON.stringify(n3.received.map(x => x.qty)) === "[3,3,2,2,3,3,1]", "כל צורות הכמות נקראות: " + n3.received.map(x => x.qty));
ok(n3.received.every(x => !/[xX\d]/.test(x.model)), "שם הדגם נקי ממספרים ומ-x");

// השוואת פתק פתיחה לפתק סוף חודש -> מה נמכר
const open = I.parseNote("בית דמו מלאי 1.9\n4 אפרסק\n3 תמר\n3 אננס");
const close = I.parseNote("מלאי בית דמו 28.10.26\nאפרסק x 3\nתמר x 3\nאננס x 2");
const op = Object.fromEntries(open.received.map(x => [x.model, x.qty]));
const sold = close.received.map(x => [x.model, op[x.model] - x.qty]);
ok(JSON.stringify(sold) === JSON.stringify([["אפרסק",1],["תמר",0],["אננס",1]]), "פתיחה פחות סוף חודש נותן מכירות: " + JSON.stringify(sold));

// 3. תעודת משלוח מודפסת (סטודיו דוגמה - DEMO BRAND), 27 שורות
const rows = [
["גולף לדוגמה שחור",100.00],["חולצת ירח לבן מנומר",100.00],["חולצת כיס ארוכה פס שחור",100.00],["חולצת כוכב שחורה — 2",110.00],
["חולצת שמש ארוכה פס דק שחור",100.00],["חולצת גשם פסים אפורים — 1",100.00],["חולצת שמש ארוכה פס דק אפור",100.00],["חולצת שמש ארוכה בורדו אפור",100.00],
["חולצת ענן בז' — 1",100.00],["חולצת ירח שחור פוטנייל",100.00],["חולצת כיס ארוכה אפורה טקסטורה",100.00],["חולצת ענן שוקולד — 1",100.00],
["חולצת ירח לבן פוטנייל",100.00],["חולצת כוכב פס חום — 2",110.00],["חולצת ירח פס חום",100.00],["חולצת כוכב פס שחור — 1",110.00],
["חולצת כוכב פס שחור — 2",110.00],["חולצת ענן בז' — 2",100.00],["חולצת גשם אבן — 1",100.00],["חולצת ירח אפור פונטייל",100.00],
["חולצת כוכב פס חום — 1",110.00],["חולצת כוכב שחורה — 1",110.00],["חולצת ירח פס קאמל",100.00],["חולצת שמש ארוכה מחורר לבן",100.00],
["חולצת גשם אבן — 2",100.00],["חולצת ענן שוקולד — 2",100.00],["חולצת גשם פסים אפורים — 2",100.00]];
const doc = `תעודת העברה בין מחסנים קונסגנציה
סטודיו דוגמה - DEMO BRAND
מספר מסמך DEMO1001
תאריך 15.06.2026
לקוח מומנט
` + rows.map((r, i) => `${i + 1}\t${r[0]}\t1\t₪${r[1]}\t₪${r[1]}`).join("\n") + `
סכום לפני מע"מ ₪2,760.00
מע"מ ₪496.80
סה"כ לתשלום ₪3,256.80
הופק: 20.06.2026`;
const d = I.parseDeliveryNote(doc);
ok(d.docNo === "DEMO1001", "מספר תעודה");
ok(d.date.day === 15 && d.date.month === 6 && d.date.year === 2026, "תאריך תעודה 15.06.2026 (ולא תאריך ההפקה)");
ok(d.items.length === 27 && d.units === 27, "27 פריטים");
ok(d.net === 2760, "סכום השורות תואם לתעודה: " + d.net);
ok(d.flags.length === 0, "אין אזהרות: " + JSON.stringify(d.flags));
ok(d.sizedRows === 14, "שורות עם סיומת מידה: " + d.sizedRows);
const m = I.merge(d.items);
const models = new Set(d.items.map(i => i.model));
console.log(" דגמים שונים:", models.size, " שורות דגם+מידה:", m.length);
ok(m.find(x => x.model === "חולצת כוכב שחורה" && x.size === "1").qty === 1, "כוכב שחורה מידה 1 = 1");

// טעות בכוונה: שורה חסרה וסכום לא תואם
const bad = I.parseDeliveryNote(doc.replace(/^5\t.*\n/m, "").replace("2,760.00", "2,700.00"));
ok(bad.flags.length >= 2, "שגיאות מדומות נתפסות: " + JSON.stringify(bad.flags));
// קודים מספריים (יבוא לדוגמה)
const rn = I.parseNote("7001\n7002\n\u200f70003*2\n\u200f7004\n\u200f7005*3 \n\u200f 7006*2\n\u200f7007*2 \n\u200f700008\n\u200f700009\n\u200f700010\n\u200f711\n\u200f712*2\n\u200f713*2\n\u200f7014\n\u200f7015\n700016");
ok(rn.received.reduce((s, x) => s + x.qty, 0) === 23 && rn.received.find(x => x.model === "70003").qty === 2 && rn.received.find(x => x.model === "7005").qty === 3, "קודים מספריים: 16 דגמים, 23 פריטים, 70003*2 = שתיים");
ok(I.parseNote("2 x 7005").received[0].qty === 2 && I.parseNote("7005 x 2").received[0].qty === 2, "כמות לפני או אחרי קוד");
console.log("\nעברו", pass, "בדיקות");
