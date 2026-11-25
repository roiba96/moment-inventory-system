import worker, { verifyToken } from "./worker.js";
const enc = s => Buffer.from(s).toString("base64url");
const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" }, true, ["sign","verify"]);
const pub = await crypto.subtle.exportKey("jwk", kp.publicKey); pub.kid = "k1"; pub.alg = "RS256"; pub.use = "sig";
async function tok(p, kid = "k1", key = kp.privateKey) {
  const h = enc(JSON.stringify({ alg: "RS256", kid })), b = enc(JSON.stringify(p));
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(h + "." + b))).toString("base64url");
  return h + "." + b + "." + sig;
}
const now = Math.floor(Date.now() / 1000);
const good = { aud: "your-project-id", iss: "https://securetoken.google.com/your-project-id", exp: now + 3600, iat: now, email: "owner@example.com", email_verified: true };
let geminiCalls = [];
const fetchFn = async (url, opts) => {
  if (url.includes("jwk")) return new Response(JSON.stringify({ keys: [pub] }));
  geminiCalls.push({ url, body: JSON.parse(opts.body), key: opts.headers["x-goog-api-key"] });
  if (url.includes("gemini-3.5-flash")) return new Response("{}", { status: 404 });
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ doc_no: "DEMO1001", items: [{ model: "חולצת כוכב שחורה", size: "2", qty: 1, unit_price: 110.00 }, { model: "70003", size: "", qty: 2, unit_price: null }], unclear: [] }) }] } }] }));
};
let pass = 0; const ok = (c, m) => { if (!c) { console.log("FAIL", m); process.exit(1); } pass++; console.log("ok -", m); };
ok(await verifyToken(await tok(good), fetchFn) === "owner@example.com", "טוקן תקין");
for (const [bad, m] of [[{ ...good, email: "stranger@example.com" }, "מייל לא מורשה"], [{ ...good, aud: "other" }, "פרויקט אחר"], [{ ...good, exp: now - 10 }, "פג תוקף"], [{ ...good, email_verified: false }, "מייל לא מאומת"]]) {
  let threw = false; try { await verifyToken(await tok(bad), fetchFn); } catch (e) { threw = true; } ok(threw, "נדחה: " + m);
}
const other = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" }, true, ["sign","verify"]);
let threw = false; try { await verifyToken(await tok(good, "k1", other.privateKey), fetchFn); } catch (e) { threw = true; } ok(threw, "נדחה: חתימה מזויפת");
const env = { GEMINI_API_KEY: "TESTKEY" }, O = "https://your-site.example.com";
const req = (t, origin = O, body = { mime: "image/jpeg", image: "A".repeat(200) }) => new Request("https://moment-ocr.x/scan", { method: "POST", headers: { Origin: origin, Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body) });
let r = await worker.fetch(req(await tok(good)), env, {}, fetchFn); let j = await r.json();
ok(r.status === 200 && j.items.length === 2 && j.model_used === "gemini-3-flash-preview", "קריאה מוצלחת עם מעבר למודל הבא כשהראשון לא קיים (" + j.model_used + ")");
ok(r.headers.get("Access-Control-Allow-Origin") === O, "CORS לאתר המורשה");
ok(geminiCalls[0].key === "TESTKEY" && geminiCalls[0].body.contents[0].parts[0].inline_data.mime_type === "image/jpeg", "המפתח נשלח בכותרת והתמונה בגוף הבקשה");
r = await worker.fetch(req(await tok(good), "https://evil.example"), env, {}, fetchFn); ok(r.status === 403, "אתר אחר נחסם");
r = await worker.fetch(req("garbage"), env, {}, fetchFn); ok(r.status === 401, "בלי כניסה נחסם");
r = await worker.fetch(req(await tok(good)), {}, {}, fetchFn); ok(r.status === 500, "בלי מפתח מחזיר שגיאה ברורה");
r = await worker.fetch(new Request("https://x/", { method: "OPTIONS", headers: { Origin: O } }), env, {}, fetchFn); ok(r.status === 204, "בקשת OPTIONS");
console.log("עברו", pass);
