// מומנט - קריאת תעודות מצילום (Cloudflare Worker)
// מקבל תמונה מהאפליקציה, בודק שהשולח מחובר עם מייל מורשה, ושולח ל-Gemini לקריאה.
// משתני סביבה ב-Cloudflare:
//   GEMINI_API_KEY  (Secret, חובה)  המפתח מ-Google AI Studio
//   MODEL           (לא חובה)       שם מודל אחר, אם המודלים כאן יפסיקו לעבוד
const PROJECT = "your-project-id";
const ALLOWED = ["owner@example.com"];
const ORIGINS = ["https://your-site.example.com"];
const MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];
const JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const PROMPT = `זו תמונה של תעודת משלוח, תעודת החזרה או רשימת מלאי של בוטיק בגדים.
החזר JSON בלבד לפי הסכמה. בכל שורת פריט:
- model: שם הדגם או מספר הפריט בדיוק כפי שכתוב (כולל צבע אם הוא חלק מהשם). בלי המידה.
- size: המידה אם כתובה (למשל XS, S, M, L, XL, 0-6, OS). אם המידה כתובה כסיומת אחרי מקף ("— 2"), זו המידה. אם אין, מחרוזת ריקה.
- qty: כמות (מספר שלם). אם יש טבלת מידות עם כמות לכל מידה, צור שורה נפרדת לכל מידה עם כמות גדולה מ-0.
- unit_price: מחיר ליחידה לפני מע"מ אם מופיע, אחרת null.
אל תכלול שורות סיכום, מע"מ או סה"כ. אל תמציא שורות שלא מופיעות. אם קשה לקרוא שורה, כתוב את מה שאתה רואה והוסף אותה ל-unclear.
doc_no: מספר המסמך אם מופיע. date: התאריך כפי שכתוב, אם מופיע.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    doc_no: { type: "STRING" },
    date: { type: "STRING" },
    items: { type: "ARRAY", items: { type: "OBJECT", properties: {
      model: { type: "STRING" }, size: { type: "STRING" }, qty: { type: "INTEGER" }, unit_price: { type: "NUMBER", nullable: true }
    }, required: ["model", "qty"] } },
    unclear: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["items"]
};

const b64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const json = (o, status, origin) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors(origin)) });
function cors(origin) {
  return ORIGINS.indexOf(origin) > -1 ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" } : {};
}

let keyCache = { at: 0, keys: null };
async function googleKeys(fetchFn) {
  if (keyCache.keys && Date.now() - keyCache.at < 3600e3) return keyCache.keys;
  const r = await fetchFn(JWKS);
  if (!r.ok) throw new Error("keys " + r.status);
  keyCache = { at: Date.now(), keys: (await r.json()).keys };
  return keyCache.keys;
}

// בדיקת טוקן הכניסה של Firebase: חתימה, פרויקט, תוקף ומייל מורשה
export async function verifyToken(token, fetchFn, nowSec) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("bad token");
  const dec = new TextDecoder();
  const header = JSON.parse(dec.decode(b64url(parts[0]))), payload = JSON.parse(dec.decode(b64url(parts[1])));
  if (header.alg !== "RS256") throw new Error("alg");
  const jwk = (await googleKeys(fetchFn)).find(k => k.kid === header.kid);
  if (!jwk) throw new Error("kid");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("signature");
  const now = nowSec || Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT || payload.iss !== "https://securetoken.google.com/" + PROJECT) throw new Error("project");
  if (!(payload.exp > now) || payload.iat > now + 300) throw new Error("expired");
  if (payload.email_verified !== true || ALLOWED.indexOf(payload.email) < 0) throw new Error("not allowed");
  return payload.email;
}

const apiKey = env => env.GEMINI_API_KEY || "";
async function askGemini(env, mime, data, fetchFn) {
  const models = env.MODEL ? [env.MODEL] : MODELS;
  let last = "";
  for (const m of models) {
    const r = await fetchFn("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey(env) },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA }
      })
    });
    const txt = await r.text();
    if (r.status === 404) { last = m + ": not found"; continue; }
    if (!r.ok) throw new Error("gemini " + r.status + " " + txt.slice(0, 300));
    const out = JSON.parse(txt);
    const part = (((out.candidates || [])[0] || {}).content || {}).parts || [];
    const text = part.map(p => p.text || "").join("");
    const res = JSON.parse(text);
    res.model_used = m;
    return res;
  }
  throw new Error("no model available (" + last + ")");
}

export default {
  async fetch(request, env, ctx, fetchFn) {
    fetchFn = fetchFn || fetch;
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== "POST") return json({ error: "method" }, 405, origin);
    if (ORIGINS.indexOf(origin) < 0) return json({ error: "origin" }, 403, origin);
    if (!apiKey(env)) return json({ error: "missing GEMINI_API_KEY" }, 500, origin);
    try {
      await verifyToken((request.headers.get("Authorization") || "").replace(/^Bearer\s+/, ""), fetchFn);
    } catch (e) { return json({ error: "auth", detail: String(e.message) }, 401, origin); }
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "body" }, 400, origin); }
    const mime = body.mime || "image/jpeg", data = String(body.image || "");
    if (!/^image\/(jpeg|png|webp|heic)$/.test(mime) || data.length < 100 || data.length > 8e6) return json({ error: "image" }, 400, origin);
    try {
      return json(await askGemini(env, mime, data, fetchFn), 200, origin);
    } catch (e) { return json({ error: "ai", detail: String(e.message).slice(0, 400) }, 502, origin); }
  }
};
