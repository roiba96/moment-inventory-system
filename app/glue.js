/* ---------- real app glue: data layer, auth, persistence ---------- */
var FIREBASE_CONFIG = __FIREBASE_CONFIG__;
var Store, USER = null, MONEY = false, CONN = "loading", RAW_P = [], DEMOSEEDED = false;
var PARAMS = location.search, DEMO = /[?&]demo=1/.test(PARAMS), FAKE = DEMO || /[?&]fake=1/.test(PARAMS);
var LOADED = {designers:0, products:0, moves:0, settings:0};
var seqN = Math.floor(Math.random() * 1000), CURBATCH = "", CLOSED = {};
function uid(){ seqN = (seqN + 1) % 1000; return Date.now() * 1000 + seqN; }
function rid(n){ var a = new Uint8Array(n || 8), s = ""; (window.crypto || window.msCrypto).getRandomValues(a); for (var i = 0; i < a.length; i++) s += (a[i] % 36).toString(36); return s; }
/* count draft survives Safari unloading the tab */
var DRAFT_KEY = "moment-close-draft";
function saveDraft(){ try { localStorage.setItem(DRAFT_KEY, JSON.stringify({cc:S.cc, cs:S.cs, cx:S.cx, clD:S.clD, clM:S.clM, t:Date.now()})); } catch (er){} }
function loadDraft(){ try { var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); if (d && Date.now() - d.t < 14 * 864e5){ S.cc = d.cc || {}; S.cs = d.cs || {}; S.cx = d.cx || {}; if (d.clD) S.clD = d.clD; if (d.clM) S.clM = d.clM; } } catch (er){} }
document.addEventListener("change", function(ev){ if (ev.target && ev.target.id === "clD") setTimeout(saveDraft, 0); }, true);
document.addEventListener("input", function(ev){ var t = ev.target; if (t && t.hasAttribute && (t.hasAttribute("data-cc") || t.hasAttribute("data-cs"))) setTimeout(saveDraft, 0); }, true);
document.addEventListener("click", function(ev){ var t = ev.target && ev.target.closest && ev.target.closest("[data-a=cxt],[data-a=clparse],[data-a=closeapply]"); if (t) setTimeout(saveDraft, 0); }, true);
function persist(c, id, data){ try { var r = Store.save(c, id, data); if (r && r.catch) r.catch(onWriteErr); } catch (er){ onWriteErr(er); } }
function unpersist(c, id){ try { var r = Store.del(c, id); if (r && r.catch) r.catch(onWriteErr); } catch (er){ onWriteErr(er); } }
function onWriteErr(er){ toast(er && er.code === "permission-denied" ? "אין הרשאה לשמור. צריך להיכנס עם החשבון המורשה." : "השמירה נכשלה. בדקי חיבור לאינטרנט."); }
function persistDes(id){ var d = desg(id); if (d) persist("designers", d.id, {name:d.name, type:d.type, mult:d.mult, scale:d.scale || "L", created:d.created || Date.now()}); }
function rebuildP(){ P = RAW_P.filter(function(p){ return !!desg(p.d); }); }
function busy(){
  var a = document.activeElement;
  return !!(a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && (document.getElementById("view").contains(a) || document.getElementById("sheetRoot").contains(a)));
}
function softRender(){ if (busy()){ S.pending = true; return; } render(); if (S.sheet) renderSheet(); }
document.addEventListener("focusout", function(){
  if (!S.pending) return;
  setTimeout(function(){ if (busy()) return; S.pending = false; render(); if (S.sheet) renderSheet(); }, 0);
});
function changed(){
  if (!(LOADED.designers && LOADED.products && LOADED.moves && LOADED.settings)) return;
  var first = !S.ready; S.ready = true;
  if (first) render(); else softRender();
}
function startWatch(){
  Store.watch({
    designers:function(list){
      DESIGNERS = list.map(function(x){ return {id:x._id, name:x.name || "", type:x.type || "c", mult:x.mult || 2.2, scale:x.scale || "L", created:x.created || 0}; })
        .sort(function(a, b){ return a.created - b.created || (a.name < b.name ? -1 : 1); });
      LOADED.designers = 1; rebuildP(); changed();
    },
    products:function(list){
      RAW_P = list.map(function(x){ return {id:x._id, d:x.d, name:x.name, w:x.w || 0, img:x.img}; });
      LOADED.products = 1; rebuildP(); changed();
    },
    moves:function(list){
      M = list.map(function(x){ var m = {}; Object.keys(x).forEach(function(k){ if (k !== "_id") m[k] = x[k]; }); m.id = Number(x.id || x._id); m.size = m.size || ""; return m; })
        .sort(function(a, b){ return a.id - b.id; });
      LOADED.moves = 1; changed();
    },
    settings:function(list){
      var m = list.filter(function(x){ return x._id === "main"; })[0]; MONEY = !!(m && m.money);
      CLOSED = {}; list.forEach(function(x){ if (/^close_/.test(x._id)) CLOSED[x._id] = x; });
      LOADED.settings = 1; changed();
    },
    status:function(fromCache){ CONN = fromCache ? "offline" : "online"; updateBadge(); },
    error:function(er){ S.err = er; S.ready = false; render(); }
  });
}
function updateBadge(){
  var b = document.getElementById("connBadge"); if (!b) return;
  b.textContent = DEMO ? "הדגמה, לא נשמר" : !S.ready ? "" : CONN === "offline" ? "לא מחובר, נשמר במכשיר" : "מחובר";
  b.className = "badge" + (!DEMO && CONN === "offline" ? " warnb" : "");
}
function seedDemo(){
  DEMOSEEDED = true;
  DESIGNERS = JSON.parse(JSON.stringify(DEMO_DESIGNERS));
  DESIGNERS.forEach(function(d, i){ d.created = i + 1; persistDes(d.id); });
  seed(); MONEY = true; persist("settings", "main", {money:true});
}
function boot(){
  var sdk = FAKE ? MomentLib.fakeSdk({email:"demo@example.com", signedIn:!/[?&]signedout=1/.test(PARAMS)}) : MomentLib.realSdk;
  if (FAKE) window.__sdk = sdk;
  Store = MomentLib.createStore(sdk);
  try { Store.init(FIREBASE_CONFIG); } catch (er){ S.auth = "error"; S.errMsg = String(er && er.message || er); render(); return; }
  loadDraft(); S.auth = "loading"; render();
  Store.onAuth(function(u){
    USER = u; S.auth = u ? "in" : "out";
    if (u){ if (DEMO && !DEMOSEEDED) seedDemo(); startWatch(); }
    render();
  });
}
function gateHtml(){
  if (S.err){
    var denied = S.err.code === "permission-denied";
    return '<div class="card"><h2 class="sec-title" style="margin-top:0">' + (denied ? "אין הרשאה לחשבון הזה" : "שגיאת חיבור") + '</h2><p>' +
      (denied ? "נכנסת עם " + e(USER ? USER.email : "") + ", והחשבון הזה לא מורשה למערכת. צריך להוסיף את המייל לכללי האבטחה, או להיכנס עם חשבון אחר." : "לא הצלחנו לטעון את הנתונים. בדקי חיבור לאינטרנט ונסי שוב.") + '</p><button class="btn full" type="button" data-a="signout">יציאה</button></div>';
  }
  if (S.auth === "error") return '<div class="card"><h2 class="sec-title" style="margin-top:0">שגיאת הגדרה</h2><p>' + e(S.errMsg || "") + '</p></div>';
  if (S.auth === "out") return '<div class="card"><h2 class="sec-title" style="margin-top:0">כניסה למערכת</h2><p>הכניסה היא עם חשבון Google מורשה בלבד.</p><button class="btn full" type="button" data-a="signin">כניסה עם Google</button></div>';
  return '<div class="card empty">טוען...</div>';
}
function money(x){ return MONEY ? x : ""; }
/* export */
function download(name, text, type){
  var b = new Blob([text], {type:type}), a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csvCell(v){ v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function exportCsv(){
  var rows = [["מעצבת", "דגם", "מידה", "כמות"]];
  P.forEach(function(p){ SZ.forEach(function(z){ var n = stockSize(p.id, z); if (n) rows.push([desg(p.d).name, p.name, sizeLabel(z), n]); }); });
  download("מלאי-מומנט-" + today() + ".csv", "﻿" + rows.map(function(r){ return r.map(csvCell).join(","); }).join("\n"), "text/csv;charset=utf-8");
}
function exportJson(){
  var out = {exported:new Date().toISOString(), version:2, designers:DESIGNERS, products:RAW_P.map(function(p){ return {id:p.id, d:p.d, name:p.name, w:p.w, img:p.img}; }), moves:M, settings:{money:MONEY, closes:CLOSED}};
  download("גיבוי-מומנט-" + today() + ".json", JSON.stringify(out, null, 1), "application/json");
}
function subBackup(){
  var st = DEMO ? "מצב הדגמה: הנתונים לא נשמרים." : CONN === "offline" ? "אין חיבור כרגע. השינויים נשמרים במכשיר ויישלחו כשהחיבור יחזור." : "מחובר, והשינויים נשמרים בענן.";
  return '<div class="card"><div class="al" style="border:0;padding:0"><span class="t"><b>' + e(USER ? USER.email : "") + '</b><br><span class="muted small">' + st + '</span></span><button class="btn alt mini" type="button" data-a="signout">יציאה</button></div></div>' +
    '<h2 class="sec-title">גיבוי</h2><div class="card"><p class="small muted" style="margin-top:0">כדאי להוריד גיבוי בסוף כל חודש. הקובץ נשמר במכשיר.</p>' +
    '<button class="btn alt full" type="button" data-a="expcsv">הורדת המלאי הנוכחי (קובץ אקסל)</button><div style="height:8px"></div>' +
    '<button class="btn alt full" type="button" data-a="expjson">הורדת גיבוי מלא (כל התנועות)</button></div>' +
    '<h2 class="sec-title">בדיקת חיבור</h2><div class="card"><button class="btn alt full" type="button" data-a="ping">בדיקת שמירה בענן</button><div class="small muted" id="pingOut" style="margin-top:8px">' + (S.pingMsg ? e(S.pingMsg) : "") + '</div></div>';
}
/* receive: paste a delivery note or a stock list */
function rcParse(){
  var t = S.rcPaste || "", sc = sizesOf(S.rd), by = {}, add = [], msgs = [], info = "";
  var dn = MomentImport.parseDeliveryNote(t);
  function line(name, w){ if (!by[name]){ by[name] = {name:name, qty:0, w:w || 0, sizes:{}}; add.push(by[name]); } return by[name]; }
  if (dn.items.length){
    dn.items.forEach(function(it){
      var l = line(it.model, it.unit); l.qty += it.qty;
      if (it.size){ if (sc.indexOf(it.size) > -1) l.sizes[it.size] = (l.sizes[it.size] || 0) + it.qty; else msgs.push('המידה "' + it.size + '" של "' + it.model + '" לא קיימת בשיטת המידות של המעצבת, מסמנים ידנית.'); }
    });
    if (dn.docNo) S.docNo = dn.docNo;
    if (dn.declared.net != null) S.docTotal = String(dn.declared.net);
    info = "זוהתה תעודה: " + dn.items.length + " שורות, " + dn.units + " פריטים.";
    dn.flags.forEach(function(f){ msgs.push(f); });
  } else {
    var nt = MomentImport.parseNote(t);
    nt.received.forEach(function(it){ if (it.qty) line(it.model, 0).qty += it.qty; });
    if (add.length) info = "זוהתה רשימה: " + add.length + " דגמים.";
    nt.flags.forEach(function(f){ if (!/אין תאריך|בלי שנה/.test(f)) msgs.push(f); });
  }
  if (!add.length){ S.rcMsg = '<div class="note" style="background:var(--warn-soft);color:var(--warn)">לא זוהו שורות. אפשר להדביק תעודה מודפסת, או רשימה בצורה "3 שם הדגם".</div>'; return; }
  S.rl = S.rl.concat(add); S.rcPaste = "";
  S.rcMsg = '<div class="note">' + e(info) + ' בודקים ומשלימים מידות בשורות למטה.</div>' + msgs.map(function(m){ return '<div class="note" style="background:var(--warn-soft);color:var(--warn)">' + e(m) + '</div>'; }).join("");
}
function confirmRecv(){
  var n = 0, units = 0, rest = 0, bid = "b" + Date.now() + Math.floor(Math.random() * 1000), ref = S.opening ? "מלאי פתיחה" : S.docNo;
  CURBATCH = bid;
  S.rl.forEach(function(l){
    if (l.qty <= 0) return;
    var p = P.filter(function(x){ return x.d === S.rd && x.name === l.name; })[0];
    if (!p){ p = {id:"p" + Date.now().toString(36) + rid(8), d:S.rd, name:l.name, w:l.w || 0}; RAW_P.push(p); P.push(p); persist("products", p.id, {d:p.d, name:p.name, w:p.w}); }
    else if (l.w && !p.w){ p.w = l.w; persist("products", p.id, {w:p.w}); }
    Object.keys(l.sizes).forEach(function(z){ addMove("receive", p.id, l.sizes[z], today(), z, l.w, ref); });
    var r = l.qty - lineAssigned(l);
    if (r > 0){ addMove("receive", p.id, r, today(), "", l.w, ref); rest += r; }
    n++; units += l.qty;
  });
  CURBATCH = "";
  S.rl = []; S.docNo = ""; S.docTotal = ""; S.opening = false; S.rcMsg = "";
  toast("נקלטו " + units + " פריטים ב-" + n + " דגמים." + (rest ? " " + rest + " נרשמו ללא מידה, אפשר להשלים בספירה." : " המלאי עודכן לפי מידה."));
}
function onboardHtml(){
  return '<div class="card"><h2 class="sec-title" style="margin-top:0">איך מתחילים</h2><ol style="margin:0;padding-inline-start:20px;line-height:1.8"><li>בלשונית <b>עוד ← מעצבות</b> מוסיפים את המעצבות ובוחרים לכל אחת שיטת מידות.</li><li>בלשונית <b>קליטה</b> מסמנים "מלאי פתיחה" ומדביקים את רשימת המלאי של כל מעצבת.</li><li>מכאן: קליטות והחזרות במהלך החודש, ובסוף החודש ספירה ב<b>עוד ← סגירת חודש</b>.</li></ol></div>';
}
function fixSel(){
  var first = DESIGNERS[0] ? DESIGNERS[0].id : "";
  ["clD", "repD", "rd"].forEach(function(k){ if (!desg(S[k])) S[k] = first; });
  if (S.sd && !desg(S.sd)) S.sd = "";
}
function tabHome(){
  var tds = today(), sales = M.filter(function(m){ return m.type === "sale" && m.date === tds; }), sum = 0;
  sales.forEach(function(m){ sum += m.price; });
  var units = 0, zero = 0; P.forEach(function(p){ var n = stock(p.id); units += Math.max(0, n); if (n <= 0) zero++; });
  if (!DESIGNERS.length) return onboardHtml();
  var dline = '<p class="today">' + new Date().toLocaleDateString("he-IL", {weekday:"long", day:"numeric", month:"long"}) + '</p>';
  var sa = sizeAlerts(), ra = reorderAlerts(), stuck = stuckList(S.X), dt = parseFloat(S.closeTotal);
  var tiles = '<div class="tiles"><div class="tile"><b>' + sales.length + '</b><span>נמכרו היום</span></div><div class="tile"><b>' + units + '</b><span>פריטים בחנות</span></div><div class="tile"><b>' + zero + '</b><span>דגמים שאזלו</span></div></div>';
  var alerts = sa.map(function(o){
    return '<div class="al"><span class="t"><b>' + e(o.p.name) + '</b><br><span class="muted small">נשאר רק במידה ' + o.size + ' (' + o.n + ')</span></span><span class="pill warn">מידה אחרונה</span></div>';
  }).concat(ra.map(function(o){
    return '<div class="al"><span class="t"><b>' + e(o.p.name) + '</b><br><span class="muted small">נמכרו ' + o.sold + ' בחודש האחרון ונשארו ' + o.left + '. כדאי לפנות ל' + e(desg(o.p.d).name) + '.</span></span><span class="pill ' + (o.left ? "warn" : "crit") + '">' + (o.left ? "להזמין" : "אזל") + '</span></div>';
  }));
  var alertSec = '<h2 class="sec-title">התראות</h2><div class="card">' + (alerts.length ? alerts.join("") : '<div class="empty small">אין התראות עכשיו.</div>') + '</div>';
  var stuckSec = '<div class="card"><div class="al" style="border:0;padding:0"><span class="t"><b>דגמים תקועים</b><br><span class="muted small">' + stuck.length + ' דגמים לא זזו ' + S.X + ' ימים ויותר</span></span><button class="btn alt mini" type="button" data-a="gostuck">הצגה</button></div></div>';
  var closing = "";
  if (MONEY){
    var diff = isNaN(dt) ? null : Math.round((sum - dt) * 100) / 100;
    closing = '<h2 class="sec-title">סיכום סגירה</h2><div class="card"><div class="total" style="margin:0 0 8px;font-size:16px"><span>במערכת היום (' + sales.length + ' פריטים)</span><b style="font-size:22px">' + fm0(sum) + '</b></div>' +
      '<div class="field"><label for="closeTotal">סכום בדוח המסוף של היום</label><input id="closeTotal" type="number" inputmode="decimal" value="' + e(S.closeTotal) + '"></div><div id="closeDiff">' + closeDiff(diff) + '</div></div>';
  }
  return dline + tiles + alertSec + stuckSec + closing;
}
function tabMore(){
  var subs = [["history", "היסטוריה"], ["close", "סגירת חודש"], ["report", "דוח חודשי"], ["designers", "מעצבות"], ["backup", "גיבוי"]];
  var bar = '<div class="chips" style="margin-top:0">' + subs.map(function(x){ return '<button type="button" class="chip' + (S.sub === x[0] ? " on" : "") + '" data-a="sub" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join("") + '</div>';
  return bar + {history:subHistory, close:tabClose, report:tabReport, designers:subDesigners, backup:subBackup}[S.sub]();
}
function subDesigners(){
  var toggle = '<div class="card"><label class="chk"><input type="checkbox" data-a="moneytoggle"' + (MONEY ? " checked" : "") + '> חישוב מחירים ותשלום למעצבות</label><div class="small muted">כבוי כברירת מחדל. כשמפעילים מופיעים מכפיל, מחיר תווית, הנחה בעת מכירה וחישוב התשלום בדוח החודשי.</div></div>';
  var cards = DESIGNERS.map(function(d){
    var cur = scaleKeys(d.id), so = Object.keys(SCALES).map(function(k){ return '<label class="chk" style="margin:2px 0;font-size:15px"><input type="checkbox" data-dsc="' + d.id + '|' + k + '"' + (cur.indexOf(k) > -1 ? " checked" : "") + '> ' + SCALES[k].name + '</label>'; }).join("");
    return '<div class="card"><div class="field"><label>שם המעצבת</label><input type="text" data-dn="' + d.id + '" value="' + e(d.name) + '"></div>' +
      '<div class="row2"><div class="field"><label>סוג</label><select data-dt="' + d.id + '"><option value="c"' + (d.type === "c" ? " selected" : "") + '>קונסיגנציה</option><option value="p"' + (d.type === "p" ? " selected" : "") + '>קנייה</option></select></div>' +
      (MONEY ? '<div class="field"><label>מכפיל</label><input type="number" step="0.05" min="1" inputmode="decimal" data-dm="' + d.id + '" value="' + d.mult + '"></div>' : '<div></div>') + '</div>' +
      '<div class="field"><label>מידות (אפשר לסמן כמה)</label>' + so + '<div class="small muted">המידות במכירה ובקליטה: ' + sizesOf(d.id).map(function(z){ return z === "OS" ? "מידה אחת" : z; }).join(", ") + '</div></div>' +
      (MONEY ? '<div class="small muted" id="dx-' + d.id + '">' + exampleTag(d) + '</div>' : "") +
      '<div style="text-align:end;margin-top:6px"><button class="linkbtn" style="color:var(--crit,#b42318)" type="button" data-a="deldes" data-d="' + d.id + '">מחיקת המעצבת</button></div></div>';
  }).join("");
  var add = '<h2 class="sec-title">מעצבת חדשה</h2><div class="card"><div class="field"><label for="ndName">שם</label><input id="ndName" type="text"></div><div class="row2"><div class="field"><label for="ndMult">מכפיל</label><input id="ndMult" type="number" step="0.05" value="2.2" inputmode="decimal"></div><div class="field"><label for="ndScale">שיטת מידות</label><select id="ndScale">' + Object.keys(SCALES).map(function(k){ return '<option value="' + k + '">' + SCALES[k].name + '</option>'; }).join("") + '</select></div></div><button class="btn full" type="button" data-a="adddes">הוספת מעצבת</button></div>';
  return toggle + cards + add;
}
/* ---------- month close with per-size counting ---------- */
function validNum(v){ return v !== "" && v !== undefined && v !== null && !isNaN(parseInt(v, 10)); }
function gridOn(pid){ var g = S.cs[pid]; return !!(g && Object.keys(g).some(function(k){ return validNum(g[k]); })); }
function closePlan(p){
  var exp = {}, total = stock(p.id);
  SZ.forEach(function(z){ var n = stockSize(p.id, z); if (n) exp[z] = n; });
  if (gridOn(p.id)){
    var g = S.cs[p.id], cnt = {}, delta = {}, ops = [], relabel = 0, sold = 0, found = 0, counted = 0;
    Object.keys(exp).concat(Object.keys(g)).forEach(function(z){ cnt[z] = validNum(g[z]) ? parseInt(g[z], 10) : 0; });
    Object.keys(cnt).forEach(function(z){ delta[z] = cnt[z] - (exp[z] || 0); counted += cnt[z]; });
    if (delta[""] < 0){
      Object.keys(delta).forEach(function(z){
        if (z === "" || delta[z] <= 0 || delta[""] >= 0) return;
        var t = Math.min(delta[z], -delta[""]);
        ops.push({type:"adjust", size:"", n:-t, ref:"שיוך מידות"}, {type:"adjust", size:z, n:t, ref:"שיוך מידות"});
        delta[z] -= t; delta[""] += t; relabel += t;
      });
    }
    Object.keys(delta).forEach(function(z){
      if (delta[z] < 0){ for (var k = 0; k < -delta[z]; k++) ops.push({type:"sale", size:z, n:-1}); sold += -delta[z]; }
      else if (delta[z] > 0){ ops.push({type:"adjust", size:z, n:delta[z], ref:"ספירה"}); found += delta[z]; }
    });
    return {mode:"grid", sold:sold, relabel:relabel, found:found, ops:ops, counted:counted};
  }
  var c = S.cc[p.id];
  if (validNum(c)){ var diff = total - parseInt(c, 10); return {mode:"total", sold:Math.max(0, diff), relabel:0, found:Math.max(0, -diff), diff:diff, counted:parseInt(c, 10)}; }
  return null;
}
function planPill(pl){
  if (!pl) return "";
  var parts = [];
  if (pl.sold) parts.push("נמכר " + pl.sold);
  if (pl.relabel) parts.push("שויכו " + pl.relabel);
  if (pl.found) parts.push(pl.found + " יותר מהצפוי");
  if (!parts.length) return '<span class="pill plain">ללא שינוי</span>';
  return '<span class="pill ' + (pl.found ? "warn" : "ok") + '">' + parts.join(" · ") + '</span>';
}
function closeTotals(){
  var d = desg(S.clD), n = 0, all = 0, implied = 0, more = 0, relabel = 0, rec = 0;
  P.filter(function(p){ return p.d === d.id; }).forEach(function(p){
    all++; rec += monthRow(p, S.clM).sold;
    var pl = closePlan(p); if (!pl) return;
    n++; implied += pl.sold; more += pl.found; relabel += pl.relabel;
  });
  return {n:n, all:all, implied:implied, more:more, relabel:relabel, recorded:rec};
}
function closeSummary(){
  var t = closeTotals();
  return '<div class="card"><div class="total" style="margin:0 0 8px"><span>נספרו ' + t.n + ' מתוך ' + t.all + ' דגמים</span><b>' + (t.recorded + t.implied) + '</b></div>' +
    '<div class="small muted">נמכר החודש עד כה: ' + (t.recorded + t.implied) + ' פריטים (מתועדים ' + t.recorded + ', לפי ספירה ' + t.implied + ').' + (t.relabel ? ' שויכו ' + t.relabel + ' פריטים ממלאי ללא מידה למידה מסוימת.' : '') + (t.more ? ' ב-' + t.more + ' פריטים נספר יותר מהצפוי. כנראה קליטה או החזרה שלא נרשמה.' : '') + '</div>' +
    '<button class="btn full" style="margin-top:10px" type="button" data-a="closeapply"' + (t.n ? "" : " disabled") + '>אישור סגירת חודש</button></div>';
}
function closeRow(p){
  var r = monthRow(p, S.clM), exp = stock(p.id), open = !!S.cx[p.id];
  var sub = 'פתיחה ' + r.open + ' · נקלט ' + r.rec + ' · הוחזר ' + r.ret + (r.sold ? ' · נמכר ' + r.sold : '') + ' · צפוי ' + exp;
  var tog = '<button class="linkbtn" type="button" data-a="cxt" data-p="' + p.id + '">' + (open ? "ספירה כוללת" : "ספירה לפי מידה") + '</button>';
  if (!open){
    var c = S.cc[p.id];
    return '<div class="rline"><div class="recent" style="border:0;padding:0">' + nameCell(p, sub) + '<span class="sumrow"><input class="cnt" type="number" inputmode="numeric" min="0" data-cc="' + p.id + '" value="' + (c === undefined ? "" : e(c)) + '" placeholder="' + exp + '" aria-label="ספירה ל' + e(p.name) + '"><span id="cd-' + p.id + '">' + planPill(closePlan(p)) + '</span></span></div><div style="text-align:end">' + tog + '</div></div>';
  }
  var sizes = sizesOf(p.d).slice(); SZ.forEach(function(z){ if (z !== "" && sizes.indexOf(z) < 0 && stockSize(p.id, z) > 0) sizes.push(z); }); sizes.push("");
  var g = S.cs[p.id] || {};
  var cells = sizes.map(function(z){
    var st = stockSize(p.id, z);
    return '<label class="gcell"><span class="sl">' + (z === "" ? "ללא" : z) + '</span><input class="cnt" type="number" inputmode="numeric" min="0" data-cs="' + p.id + '|' + z + '" value="' + (g[z] === undefined ? "" : e(g[z])) + '" placeholder="0" aria-label="' + sizeLabel(z) + '"><span class="st">צפוי ' + st + '</span></label>';
  }).join("");
  return '<div class="rline"><div class="recent" style="border:0;padding:0">' + nameCell(p, sub) + '<span id="cd-' + p.id + '">' + planPill(closePlan(p)) + '</span></div><div class="gcells">' + cells + '</div><div class="small muted">ריק נחשב 0. מה שחסר מ"ללא מידה" ומופיע במידה מסוימת נחשב שיוך ולא מכירה.</div><div style="text-align:end">' + tog + '</div></div>';
}
function tabClose(){
  var d = desg(S.clD), month = S.clM || (S.clM = defaultMonth());
  var dopts = DESIGNERS.map(function(x){ return '<option value="' + x.id + '"' + (S.clD === x.id ? " selected" : "") + '>' + e(x.name) + '</option>'; }).join("");
  var ps = P.filter(function(p){ return p.d === d.id; });
  var rows = ps.map(closeRow).join("");
  return '<div class="note">כך בעלת החנות עובדת היום: מלאי פתיחה + נקלט − הוחזר − ספירה = נמכר. לא צריך לרשום כל מכירה במהלך החודש. ספירת הסוף היא שמגלה מה נמכר. אם בכל זאת נרשמו מכירות בלשונית מכירה, הן נספרות ולא נכפלות.</div>' +
    '<div class="row2"><div class="field"><label for="clD">מעצבת</label><select id="clD">' + dopts + '</select></div><div class="field"><label>חודש</label><input type="text" value="' + monthName(month) + '" readonly></div></div>' +
    '<div class="card"><label class="lab" for="clPaste" style="display:block">הדבקת רשימת ספירה (כמו הפתק של בעלת החנות)</label>' +
    '<textarea id="clPaste" rows="5" placeholder="מלאי בית דמו 28.10&#10;3 x תמר&#10;אפרסק x 4">' + e(S.clPaste) + '</textarea>' +
    '<button class="btn full" style="margin-top:8px" type="button" data-a="clparse">זיהוי מהרשימה</button>' + (S.clMsg || "") + '</div>' +
    '<h2 class="sec-title">ספירה לפי דגם</h2><div class="card">' + (rows || '<div class="empty">אין דגמים למעצבת הזו.</div>') + '</div>' +
    '<div id="clSum">' + closeSummary() + '</div>';
}
function closeApply(){
  var d = desg(S.clD), month = S.clM, date = monthEnd(month), sold = 0, found = 0, relabel = 0, ck = "close_" + d.id + "_" + month;
  if (!FAKE && CONN === "offline"){ toast("סגירת חודש דורשת חיבור לאינטרנט, כדי שלא תיסגר פעמיים משני מכשירים. הספירה נשמרה, אפשר לאשר כשהחיבור יחזור."); return; }
  if (CLOSED[ck] && !confirm("החודש הזה כבר נסגר ל" + d.name + " (" + (CLOSED[ck].by || "") + "). סגירה נוספת תוסיף רק את ההפרשים מהספירה החדשה. להמשיך?")) return;
  P.filter(function(p){ return p.d === d.id; }).forEach(function(p){
    var pl = closePlan(p); if (!pl) return;
    var price = MONEY ? tag(p) : 0;
    if (pl.mode === "total"){
      if (pl.diff > 0){ for (var k = 0; k < pl.diff; k++) addMove("sale", p.id, -1, date, takeSize(p.id), price, "ספירה", price); }
      else if (pl.diff < 0) addMove("adjust", p.id, -pl.diff, date, "", 0, "ספירה");
    } else {
      pl.ops.forEach(function(o){
        if (o.type === "sale") addMove("sale", p.id, -1, date, o.size, price, "ספירה", price);
        else addMove("adjust", p.id, o.n, date, o.size, 0, o.ref);
      });
    }
    sold += pl.sold; found += pl.found; relabel += pl.relabel;
  });
  CLOSED[ck] = {at:Date.now(), by:USER ? USER.email : "", sold:sold, found:found};
  persist("settings", ck, CLOSED[ck]);
  S.cc = {}; S.cs = {}; S.cx = {}; S.clMsg = ""; S.repD = d.id; S.repM = month; saveDraft();
  toast("החודש נסגר ל" + d.name + ". נמכר לפי ספירה: " + sold + (relabel ? ". שויכו " + relabel + " פריטים למידה" : "") + (found ? ". תוקנו " + found + " פריטים שנספרו מעל הצפוי" : "") + ". הפירוט בדוח חודשי.");
}

/* 08.11: several size scales per designer */
document.addEventListener("change", function(ev){
  var t = ev.target; if (!t || !t.hasAttribute || !t.hasAttribute("data-dsc")) return;
  var kv = t.getAttribute("data-dsc").split("|"), d = desg(kv[0]); if (!d) return;
  var keys = scaleKeys(d.id).filter(function(k){ return k !== kv[1]; });
  if (t.checked) keys.push(kv[1]);
  keys = Object.keys(SCALES).filter(function(k){ return keys.indexOf(k) > -1; });
  if (!keys.length){ t.checked = true; toast("צריך לבחור לפחות שיטת מידות אחת."); return; }
  d.scale = keys.join(","); persist("designers", d.id, {scale:d.scale});
  toast("המידות של " + d.name + " עודכנו. מלאי קיים במידות אחרות ממשיך להופיע."); render();
}, true);

/* 08.11: fix a size after receiving (e.g. size 4 -> size 5) */
function sizeFixHtml(p){
  var from = SZ.filter(function(z){ return stockSize(p.id, z) > 0; });
  if (!from.length) return "";
  var to = sizesOf(p.d).slice(); to.push("");
  var opt = function(list, withSt){ return list.map(function(z){ return '<option value="' + z + '">' + (z === "" ? "ללא מידה" : z === "OS" ? "מידה אחת" : "מידה " + z) + (withSt ? " (יש " + stockSize(p.id, z) + ")" : "") + '</option>'; }).join(""); };
  return '<details style="margin-top:16px"><summary class="lab" style="cursor:pointer">תיקון מידה (נקלט במידה הלא נכונה)</summary>' +
    '<div class="row2" style="margin-top:8px"><div class="field"><label for="sfFrom">ממידה</label><select id="sfFrom">' + opt(from, true) + '</select></div>' +
    '<div class="field"><label for="sfTo">למידה</label><select id="sfTo">' + opt(to, false) + '</select></div></div>' +
    '<div class="row2"><div class="field"><label for="sfQty">כמה יחידות</label><input id="sfQty" type="number" inputmode="numeric" min="1" value="1"></div>' +
    '<div class="field"><label>&nbsp;</label><button class="btn alt full" type="button" data-a="sizefix">העברה</button></div></div>' +
    '<div class="small muted">הכמות הכוללת לא משתנה, רק המידה.</div></details>';
}
document.addEventListener("click", function(ev){
  var t = ev.target && ev.target.closest && ev.target.closest("[data-a=sizefix]"); if (!t) return;
  ev.stopPropagation();
  var p = prod(S.sheet); if (!p) return;
  var from = document.getElementById("sfFrom").value, to = document.getElementById("sfTo").value, q = parseInt(document.getElementById("sfQty").value, 10);
  if (from === to){ toast("בחרי מידה אחרת לשם ההעברה."); return; }
  if (!(q > 0)){ toast("צריך כמות של יחידה אחת לפחות."); return; }
  if (q > stockSize(p.id, from)){ toast("במידה הזו יש רק " + stockSize(p.id, from) + "."); return; }
  var d = today();
  addMove("adjust", p.id, -q, d, from, 0, "תיקון מידה");
  addMove("adjust", p.id, q, d, to, 0, "תיקון מידה");
  toast("הועברו " + q + " מ" + sizeLabel(from) + " ל" + sizeLabel(to) + ".");
  renderSheet(); render();
}, true);

/* 10.11: delete a designer (with her models and movements, after confirmation) */
document.addEventListener("click", function(ev){
  var t = ev.target && ev.target.closest && ev.target.closest("[data-a=deldes]"); if (!t) return;
  ev.stopPropagation();
  var d = desg(t.getAttribute("data-d")); if (!d) return;
  var ps = RAW_P.filter(function(p){ return p.d === d.id; }), ids = ps.map(function(p){ return p.id; });
  var mv = M.filter(function(m){ return ids.indexOf(m.p) > -1; }), units = 0;
  ps.forEach(function(p){ units += Math.max(0, stock(p.id)); });
  var msg = mv.length
    ? "למחוק את " + d.name + "?\n\nיימחקו גם " + ps.length + " דגמים, " + units + " פריטים במלאי וכל ההיסטוריה שלה (" + mv.length + " רישומים).\nאי אפשר לבטל את זה. כדאי להוריד גיבוי קודם (עוד ← גיבוי)."
    : "למחוק את " + d.name + "?" + (ps.length ? " יימחקו גם " + ps.length + " דגמים בלי מלאי." : "");
  if (!confirm(msg)) return;
  if (mv.length && !confirm("בטוח? המחיקה של " + d.name + " סופית.")) return;
  mv.forEach(function(m){ unpersist("moves", m.id); });
  ps.forEach(function(p){ unpersist("products", p.id); });
  unpersist("designers", d.id);
  M = M.filter(function(m){ return ids.indexOf(m.p) < 0; });
  RAW_P = RAW_P.filter(function(p){ return p.d !== d.id; });
  DESIGNERS = DESIGNERS.filter(function(x){ return x.id !== d.id; });
  rebuildP(); fixSel();
  toast(d.name + " נמחקה.");
  render();
}, true);

/* 10.11: remember which designer groups are open in the stock view */
var GRP_KEY = "moment-stock-open";
function grpLoad(){ try { return JSON.parse(localStorage.getItem(GRP_KEY) || "{}") || {}; } catch (er){ return {}; } }
function grpSave(){ try { var o = grpLoad(); Object.keys(S.open).forEach(function(k){ o[k] = !!S.open[k]; }); localStorage.setItem(GRP_KEY, JSON.stringify(o)); } catch (er){} }
function grpOpenSaved(id){ var o = grpLoad(); return o[id] === true || (o[id] === undefined && DESIGNERS.length === 1); }
function grpIsOpen(id){ return S.open[id] === undefined ? grpOpenSaved(id) : !!S.open[id]; }
document.addEventListener("toggle", function(ev){ var t = ev.target; if (t && t.matches && t.matches("details[data-d]") && !S.iq.trim()){ S.open[t.getAttribute("data-d")] = t.open; grpSave(); var b = document.querySelector("[data-a=grpall]"); if (b) b.textContent = DESIGNERS.every(function(d){ return grpIsOpen(d.id); }) ? "סגירת הכל" : "פתיחת הכל"; } }, true);
document.addEventListener("click", function(ev){
  var t = ev.target && ev.target.closest && ev.target.closest("[data-a=grpall]"); if (!t) return;
  ev.stopPropagation();
  var all = DESIGNERS.every(function(d){ return grpIsOpen(d.id); });
  DESIGNERS.forEach(function(d){ S.open[d.id] = !all; }); grpSave(); render();
}, true);

/* 11.11: return to designer. Same screen idea as receiving, in reverse. */
S.rmode = S.rmode || "recv";
S.rt = S.rt || {d:"", date:"", lines:[], paste:"", msg:"", name:""};
function tabReceiveOrReturn(){
  var bar = '<div class="chips" style="margin-top:0"><button type="button" class="chip' + (S.rmode !== "ret" ? " on" : "") + '" data-a="rmode" data-v="recv">קליטה</button><button type="button" class="chip' + (S.rmode === "ret" ? " on" : "") + '" data-a="rmode" data-v="ret">החזרה למעצבת</button></div>';
  return bar + (S.rmode === "ret" ? tabReturn() : tabReceive());
}
function rtD(){ if (!desg(S.rt.d)) S.rt.d = S.rd && desg(S.rd) ? S.rd : (DESIGNERS[0] ? DESIGNERS[0].id : ""); return S.rt.d; }
function rtLine(pid){ var l = S.rt.lines.filter(function(x){ return x.pid === pid; })[0]; if (!l){ var p = prod(pid); l = {pid:pid, name:p.name, sz:{}}; S.rt.lines.push(l); } return l; }
function rtQty(l){ var n = 0; Object.keys(l.sz).forEach(function(z){ n += l.sz[z]; }); return n; }
// how many units can come out of size z (a sized unit may come out of "no size" stock too)
function rtAvail(pid, z){ return stockSize(pid, z) + (z !== "" ? stockSize(pid, "") : 0); }
function rtShort(l){
  var noSz = stockSize(l.pid, ""), short = 0, usedNo = 0;
  Object.keys(l.sz).forEach(function(z){ if (z === "") return; var over = l.sz[z] - stockSize(l.pid, z); if (over > 0) usedNo += over; });
  usedNo += l.sz[""] || 0;
  if (usedNo > noSz){
    // unsized request may also come out of sized stock that is not otherwise requested
    var spare = 0; SZ.forEach(function(z){ if (z !== "") spare += Math.max(0, stockSize(l.pid, z) - (l.sz[z] || 0)); });
    short = Math.max(0, usedNo - noSz - Math.min(spare, l.sz[""] || 0));
  }
  return short;
}
function tabReturn(){
  var did = rtD(), d = desg(did);
  if (!d) return '<div class="card empty">אין מעצבות עדיין.</div>';
  if (!S.rt.date) S.rt.date = today();
  var opts = DESIGNERS.map(function(x){ return '<option value="' + x.id + '"' + (did === x.id ? " selected" : "") + '>' + e(x.name) + '</option>'; }).join("");
  var total = 0, bad = 0;
  var rows = S.rt.lines.map(function(l, i){
    var q = rtQty(l), short = rtShort(l); total += q; if (short) bad++;
    var sizes = sizesOf(did).slice(); SZ.forEach(function(z){ if (z !== "" && sizes.indexOf(z) < 0 && (stockSize(l.pid, z) > 0 || l.sz[z])) sizes.push(z); }); sizes.push("");
    var chips = sizes.map(function(z){
      var c = l.sz[z] || 0, st = stockSize(l.pid, z);
      return '<span class="sizecol"><button type="button" class="sizebtn sm' + (c ? " on" : "") + (st <= 0 && !c ? " none" : "") + '" data-a="rtsz" data-i="' + i + '" data-s="' + z + '"><span class="sl">' + (z === "" ? "ללא" : z) + '</span><span class="st">' + (c ? c + "/" : "") + st + '</span></button><button type="button" class="mbtn' + (c ? "" : " ph") + '" data-a="rtszm" data-i="' + i + '" data-s="' + z + '" aria-label="הסרה">−</button></span>';
    }).join("");
    return '<div class="rline"><div class="recent" style="border:0;padding:0"><span class="t"><b>' + e(l.name) + '</b> <span class="muted small">במלאי ' + stock(l.pid) + '</span></span><span class="sumrow"><span class="pill ' + (short ? "crit" : q ? "ok" : "plain") + '">' + (short ? "חסרים " + short + " במלאי" : "מחזירים " + q) + '</span><button class="xbtn" type="button" data-a="rtdel" data-i="' + i + '" aria-label="הסרת השורה">×</button></span></div>' +
      '<div class="chips sz" style="margin:8px 0 2px">' + chips + '</div></div>';
  }).join("");
  var list = S.rt.lines.length ?
    '<div class="note">לכל פריט שחוזר לוחצים על המידה שלו. המספר מתחת למידה הוא כמה יש במלאי. פריט שנקלט "ללא מידה" יורד משם אוטומטית.</div><div class="card">' + rows +
    '<div class="field" style="margin-top:10px"><label for="rtDoc">מספר תעודת החזרה (לא חובה)</label><input id="rtDoc" type="text" value="' + e(S.rt.doc || "") + '"></div></div>' +
    (bad ? '<div class="note" style="background:var(--crit-soft);color:var(--crit)">ב-' + bad + ' שורות מחזירים יותר ממה שיש במלאי. צריך לתקן לפני האישור.</div>' : "") +
    '<button class="btn full" type="button" data-a="rtconfirm"' + (total && !bad ? "" : " disabled") + '>אישור החזרה (' + total + ' פריטים)</button>'
    : '<div class="card empty">אין פריטים להחזרה עדיין. אפשר להדביק תעודת החזרה או להוסיף דגם ידנית.</div>';
  return '<div class="row2"><div class="field"><label for="rtD">למי מחזירים?</label><select id="rtD">' + opts + '</select></div>' +
    '<div class="field"><label for="rtDate">תאריך ההחזרה</label><input id="rtDate" type="date" value="' + e(S.rt.date) + '" max="' + today() + '"></div></div>' +
    '<div class="card">' + scanBtn("ret") + '<label class="lab" for="rtPaste" style="display:block">הדבקת תעודת החזרה</label><textarea id="rtPaste" rows="5" placeholder="אותה תבנית כמו תעודת קליטה">' + e(S.rt.paste) + '</textarea>' +
    '<button class="btn full" style="margin-top:8px" type="button" data-a="rtparse">זיהוי מהטקסט</button>' + (S.rt.msg || "") + '</div>' +
    list +
    '<h2 class="sec-title">הוספת דגם ידנית</h2><div class="card"><div class="field"><label for="rtName">דגם</label><input id="rtName" type="text" list="rtModels" value="' + e(S.rt.name) + '" autocomplete="off"></div>' +
    '<button class="btn alt" type="button" data-a="rtadd">הוספה להחזרה</button>' +
    '<datalist id="rtModels">' + P.filter(function(p){ return p.d === did && stock(p.id) > 0; }).map(function(p){ return '<option value="' + e(p.name) + '">'; }).join("") + '</datalist></div>' +
    recentReturns();
}
function rtFind(did, name){
  var n = String(name).trim(), ps = P.filter(function(p){ return p.d === did; });
  var ex = ps.filter(function(p){ return p.name === n; })[0]; if (ex) return ex;
  var m = MomentImport.match(n, ps.map(function(p){ return p.name; }));
  if (m.status === "similar") return ps.filter(function(p){ return p.name === m.match; })[0];
  return null;
}
function rtParse(){
  var did = rtD(), t = S.rt.paste || "", items = [], miss = [], msgs = [];
  var dn = MomentImport.parseDeliveryNote(t);
  if (dn.items.length){ dn.items.forEach(function(it){ items.push({model:it.model, size:it.size || "", qty:it.qty}); }); if (dn.docNo) S.rt.doc = dn.docNo; dn.flags.forEach(function(f){ msgs.push(f); }); }
  else MomentImport.parseNote(t).received.forEach(function(it){ if (it.qty) items.push({model:it.model, size:"", qty:it.qty}); });
  if (!items.length){ S.rt.msg = '<div class="note" style="background:var(--warn-soft);color:var(--warn)">לא זוהו שורות. אפשר להדביק את התעודה כמו בקליטה, או שורות בצורה "3 שם הדגם".</div>'; return; }
  var n = 0;
  items.forEach(function(it){
    var p = rtFind(did, it.model);
    if (!p){ miss.push(it.model); return; }
    var l = rtLine(p.id), z = it.size;
    if (z && sizesOf(did).indexOf(z) < 0 && stockSize(p.id, z) <= 0) msgs.push('המידה "' + z + '" של "' + p.name + '" לא קיימת אצל המעצבת.');
    l.sz[z] = (l.sz[z] || 0) + it.qty; n += it.qty;
  });
  S.rt.paste = "";
  S.rt.msg = '<div class="note">זוהו ' + n + ' פריטים להחזרה. בודקים את הרשימה למטה.</div>' +
    (miss.length ? '<div class="note" style="background:var(--warn-soft);color:var(--warn)">לא נמצאו אצל ' + e(desg(did).name) + ': ' + e(miss.join(", ")) + '. אולי השם כתוב אחרת, אפשר להוסיף ידנית.</div>' : "") +
    msgs.map(function(m){ return '<div class="note" style="background:var(--warn-soft);color:var(--warn)">' + e(m) + '</div>'; }).join("");
}
function rtConfirm(){
  var date = S.rt.date || today(), ref = "החזרה" + (S.rt.doc ? " " + S.rt.doc : ""), units = 0, models = 0;
  if (S.rt.lines.some(rtShort)) { toast("יש שורות עם יותר ממה שיש במלאי."); return; }
  CURBATCH = "r" + Date.now() + Math.floor(Math.random() * 1000);
  S.rt.lines.forEach(function(l){
    var q = rtQty(l); if (!q) return; models++; units += q;
    var take = {}, add = function(z, k){ if (k > 0) take[z] = (take[z] || 0) + k; };
    var free = {}; SZ.forEach(function(z){ free[z] = stockSize(l.pid, z); });
    Object.keys(l.sz).forEach(function(z){ if (z === "") return; var k = Math.min(l.sz[z], free[z]); add(z, k); free[z] -= k; var rest = l.sz[z] - k; if (rest){ add("", rest); free[""] -= rest; } });
    var u = l.sz[""] || 0, k0 = Math.min(u, Math.max(0, free[""])); add("", k0); free[""] -= k0; u -= k0;
    SZ.forEach(function(z){ if (u > 0 && z !== "" && free[z] > 0){ var k = Math.min(u, free[z]); add(z, k); free[z] -= k; u -= k; } });
    Object.keys(take).forEach(function(z){ addMove("return", l.pid, -take[z], date, z, 0, ref); });
  });
  CURBATCH = "";
  S.rt.lines = []; S.rt.msg = ""; S.rt.doc = ""; S.rt.date = today();
  toast("נרשמה החזרה של " + units + " פריטים (" + models + " דגמים) ל" + desg(rtD()).name + ".");
}
function recentReturns(){
  var seen = {}, rows = [];
  M.slice().reverse().forEach(function(m){ if (m.type !== "return" || !m.batch || Date.now() - (parseInt(m.batch.slice(1, 14), 10) || 0) > 7 * 864e5) return; if (!seen[m.batch]){ seen[m.batch] = {u:0, ref:m.ref, date:m.date, d:(prod(m.p) || {}).d}; rows.push(m.batch); } seen[m.batch].u += -m.delta; });
  if (!rows.length) return "";
  return '<h2 class="sec-title">החזרות מהשבוע האחרון</h2><div class="card">' + rows.slice(0, 5).map(function(b){ var s = seen[b];
    return '<div class="recent"><span class="t"><b>' + e((desg(s.d) || {}).name || "") + '</b> <span class="muted small">' + s.u + ' פריטים · ' + s.date.split("-").reverse().slice(0, 2).join(".") + '</span></span><button class="linkbtn" type="button" data-a="rtcancel" data-b="' + b + '">ביטול החזרה</button></div>'; }).join("") + '</div>';
}
document.addEventListener("click", function(ev){
  var t = ev.target && ev.target.closest && ev.target.closest("[data-a=rmode],[data-a=rtsz],[data-a=rtszm],[data-a=rtdel],[data-a=rtparse],[data-a=rtadd],[data-a=rtconfirm],[data-a=rtcancel]"); if (!t) return;
  ev.stopPropagation();
  var a = t.getAttribute("data-a"), i = +t.getAttribute("data-i"), z = t.getAttribute("data-s");
  if (a === "rmode"){ S.rmode = t.getAttribute("data-v"); }
  else if (a === "rtsz"){ var l = S.rt.lines[i], tmp = Object.assign({}, l.sz); tmp[z] = (tmp[z] || 0) + 1; if (rtShort({pid:l.pid, sz:tmp})){ toast("אין עוד במלאי במידה הזו."); return; } l.sz = tmp; }
  else if (a === "rtszm"){ var l2 = S.rt.lines[i]; if (l2.sz[z]){ l2.sz[z]--; if (!l2.sz[z]) delete l2.sz[z]; } }
  else if (a === "rtdel"){ S.rt.lines.splice(i, 1); }
  else if (a === "rtparse"){ var ta = document.getElementById("rtPaste"); if (ta) S.rt.paste = ta.value; rtParse(); }
  else if (a === "rtadd"){ var inp = document.getElementById("rtName"), p = inp ? rtFind(rtD(), inp.value) : null; if (!p){ toast("לא נמצא דגם כזה אצל המעצבת."); return; } rtLine(p.id); S.rt.name = ""; }
  else if (a === "rtconfirm"){ var dt = document.getElementById("rtDate"), dc = document.getElementById("rtDoc"); if (dt && dt.value) S.rt.date = dt.value; if (dc) S.rt.doc = dc.value; rtConfirm(); }
  else if (a === "rtcancel"){
    var b = t.getAttribute("data-b"), mv = M.filter(function(m){ return m.batch === b; });
    if (!confirm("לבטל את ההחזרה? הפריטים יחזרו למלאי.")) return;
    mv.forEach(function(m){ unpersist("moves", m.id); }); M = M.filter(function(m){ return m.batch !== b; }); toast("ההחזרה בוטלה והפריטים חזרו למלאי.");
  }
  render();
}, true);
document.addEventListener("change", function(ev){
  var t = ev.target; if (!t || !t.id) return;
  if (t.id === "rtD"){ S.rt.d = t.value; S.rt.lines = []; S.rt.msg = ""; render(); }
  else if (t.id === "rtDate"){ S.rt.date = t.value; }
  else if (t.id === "rtDoc"){ S.rt.doc = t.value; }
}, true);
document.addEventListener("input", function(ev){
  var t = ev.target; if (!t || !t.id) return;
  if (t.id === "rtPaste") S.rt.paste = t.value; else if (t.id === "rtName") S.rt.name = t.value; else if (t.id === "rtDoc") S.rt.doc = t.value;
}, true);

/* 17.11: read a delivery/return note from a photo (Cloudflare Worker + Gemini) */
var OCR_URL = __OCR_URL__;
S.scan = S.scan || {busy:false, msg:""};
function scanBtn(mode){
  if (!OCR_URL || DEMO) return "";
  return '<label class="btn full" style="display:flex;justify-content:center;gap:8px;cursor:pointer' + (S.scan.busy ? ';opacity:.6;pointer-events:none' : '') + '">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/></svg>' +
    (S.scan.busy ? 'קוראת את התעודה...' : 'צילום תעודה') + '<input type="file" accept="image/*" data-scan="' + mode + '" hidden' + (S.scan.busy ? " disabled" : "") + '></label>' +
    (S.scan.msg && S.scan.mode === mode ? S.scan.msg : '') + '<div class="small muted" style="text-align:center;margin:8px 0">או</div>';
}
function shrinkImage(file, cb){
  var fr = new FileReader();
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){
      var sc = Math.min(1, 1800 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.onerror = function(){ cb(null); };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
// turn the AI answer into the same text the paste box already understands
function scanToText(res){
  var clean = function(s){ return String(s || "").replace(/[\t\r\n]+/g, " ").trim(); };
  var lines = (res.items || []).filter(function(it){ return clean(it.model) && it.qty > 0; }).map(function(it, i){
    var u = typeof it.unit_price === "number" && it.unit_price > 0 ? it.unit_price : 0;
    return (i + 1) + "\t" + clean(it.model) + (clean(it.size) ? " — " + clean(it.size) : "") + "\t" + it.qty + "\t₪" + u.toFixed(2) + "\t₪" + (u * it.qty).toFixed(2);
  });
  return (res.doc_no ? "מספר מסמך " + clean(res.doc_no) + "\n" : "") + lines.join("\n");
}
function scanNote(cls, text){ return '<div class="note"' + (cls ? ' style="background:var(--' + cls + '-soft);color:var(--' + cls + ')"' : '') + '>' + e(text) + '</div>'; }
function runScan(file, mode){
  S.scan = {busy:true, msg:"", mode:mode}; render();
  shrinkImage(file, function(b64){
    if (!b64){ S.scan = {busy:false, mode:mode, msg:scanNote("warn", "לא הצלחתי לפתוח את התמונה. נסי לצלם שוב.")}; render(); return; }
    Store.idToken().then(function(tk){
      return fetch(OCR_URL, {method:"POST", headers:{"Content-Type":"application/json", "Authorization":"Bearer " + tk}, body:JSON.stringify({mime:"image/jpeg", image:b64})});
    }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok, status:r.status, j:j}; }); }).then(function(x){
      if (!x.ok) throw new Error(x.j && x.j.error === "auth" ? "auth" : (x.j && (x.j.detail || x.j.error)) || ("status " + x.status));
      var res = x.j, n = (res.items || []).length;
      if (!n){ S.scan = {busy:false, mode:mode, msg:scanNote("warn", "לא מצאתי שורות פריטים בתמונה. אפשר לנסות לצלם קרוב וישר יותר.")}; render(); return; }
      var txt = scanToText(res), extra = (res.unclear || []).length ? scanNote("warn", "שורות שהיה קשה לקרוא, כדאי לבדוק: " + res.unclear.join(", ")) : "";
      if (mode === "ret"){ S.rt.paste = txt; rtParse(); }
      else { S.rcPaste = txt; rcParse(); }
      S.scan = {busy:false, mode:mode, msg:scanNote("", "נקראו " + n + " שורות מהצילום. חשוב לבדוק אותן מול התעודה לפני האישור.") + extra};
      render();
    }).catch(function(er){
      var m = String(er && er.message || er);
      S.scan = {busy:false, mode:mode, msg:scanNote("warn", m === "auth" ? "צריך להיות מחוברת עם החשבון המורשה. נסי לצאת ולהיכנס שוב." : /Failed to fetch|NetworkError|Load failed/.test(m) ? "אין חיבור לשרת הקריאה. בדקי אינטרנט ונסי שוב." : "הקריאה נכשלה: " + m.slice(0, 160))};
      render();
    });
  });
}
document.addEventListener("change", function(ev){
  var t = ev.target; if (!t || !t.hasAttribute || !t.hasAttribute("data-scan")) return;
  ev.stopPropagation();
  var f = t.files && t.files[0]; if (f) runScan(f, t.getAttribute("data-scan"));
}, true);

/* 17.11: history by date (receipts, returns, sales, adjustments), with cancel for the last week */
S.hist = S.hist || {range:"today", from:"", to:"", type:"all", d:"", open:{}};
function dAdd(ds, n){ var p = ds.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function histRange(){
  var h = S.hist, t = today();
  if (h.range === "today") return [t, t];
  if (h.range === "yesterday"){ var y = dAdd(t, -1); return [y, y]; }
  if (h.range === "week") return [dAdd(t, -6), t];
  if (h.range === "month") return [t.slice(0, 8) + "01", t];
  var f = h.from || t, to = h.to || t; return f <= to ? [f, to] : [to, f];
}
var HTYPE = {receive:"קליטה", "return":"החזרה למעצבת", sale:"מכירות", adjust:"תיקון"};
function histGroups(){
  var r = histRange(), h = S.hist, groups = {}, order = [];
  M.forEach(function(m){
    if (m.date < r[0] || m.date > r[1]) return;
    if (h.type !== "all" && m.type !== h.type) return;
    var p = prod(m.p); if (!p) return;
    if (h.d && p.d !== h.d) return;
    var key = m.batch ? m.batch : m.date + "|" + m.type + "|" + p.d + "|" + (m.ref || "");
    var g = groups[key];
    if (!g){ g = groups[key] = {key:key, batch:m.batch || "", date:m.date, type:m.type, d:p.d, ref:m.ref || "", units:0, lines:{}, id:m.id}; order.push(key); }
    var q = m.type === "adjust" ? m.delta : Math.abs(m.delta);
    g.units += q; g.id = Math.max(g.id, m.id);
    var lk = p.id + "|" + (m.size || "");
    g.lines[lk] = g.lines[lk] || {name:p.name, size:m.size || "", q:0};
    g.lines[lk].q += q;
  });
  return order.map(function(k){ return groups[k]; }).sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id; });
}
function subHistory(){
  var h = S.hist, r = histRange(), gs = histGroups(), tot = {receive:0, "return":0, sale:0, adjust:0};
  gs.forEach(function(g){ tot[g.type] += g.units; });
  var chip = function(k, v, label){ return '<button type="button" class="chip' + (h[k] === v ? " on" : "") + '" data-a="hset" data-k="' + k + '" data-v="' + v + '">' + label + '</button>'; };
  var dsel = '<select id="hD"><option value="">כל המעצבות</option>' + DESIGNERS.map(function(d){ return '<option value="' + d.id + '"' + (h.d === d.id ? " selected" : "") + '>' + e(d.name) + '</option>'; }).join("") + '</select>';
  var fmt = function(ds){ var p = ds.split("-"); return +p[2] + "." + +p[1]; };
  var head = '<div class="chips" style="margin-top:0">' + chip("range", "today", "היום") + chip("range", "yesterday", "אתמול") + chip("range", "week", "שבוע אחרון") + chip("range", "month", "החודש") + chip("range", "custom", "טווח תאריכים") + '</div>' +
    (h.range === "custom" ? '<div class="row2"><div class="field"><label for="hFrom">מתאריך</label><input id="hFrom" type="date" value="' + e(r[0]) + '" max="' + today() + '"></div><div class="field"><label for="hTo">עד תאריך</label><input id="hTo" type="date" value="' + e(r[1]) + '" max="' + today() + '"></div></div>' : '') +
    '<div class="chips">' + chip("type", "all", "הכל") + chip("type", "receive", "קליטות") + chip("type", "return", "החזרות") + chip("type", "sale", "מכירות") + chip("type", "adjust", "תיקונים") + '</div>' +
    '<div class="field"><label for="hD">מעצבת</label>' + dsel + '</div>';
  var sum = '<div class="tiles"><div class="tile"><b>' + tot.receive + '</b><span>נקלטו</span></div><div class="tile"><b>' + tot["return"] + '</b><span>הוחזרו</span></div><div class="tile"><b>' + tot.sale + '</b><span>נמכרו</span></div></div>' +
    '<div class="small muted" style="margin:-4px 0 10px">' + (r[0] === r[1] ? fmt(r[0]) : fmt(r[0]) + " עד " + fmt(r[1])) + (tot.adjust ? ' · תיקונים: ' + (tot.adjust > 0 ? "+" : "") + tot.adjust : '') + '</div>';
  if (!gs.length) return head + sum + '<div class="card empty">אין פעולות בטווח הזה.</div>';
  var html = "", last = "";
  gs.forEach(function(g){
    if (g.date !== last){ html += '<h2 class="sec-title">' + new Date(g.date + "T12:00:00").toLocaleDateString("he-IL", {weekday:"long", day:"numeric", month:"numeric"}) + '</h2>'; last = g.date; }
    var open = !!h.open[g.key], d = desg(g.d);
    var recent = g.batch && Date.now() - (parseInt(g.batch.slice(1, 14), 10) || 0) <= 7 * 864e5;
    var cancel = recent && (g.type === "receive" || g.type === "return") ? '<button class="linkbtn" type="button" data-a="' + (g.type === "receive" ? "cancelrecv" : "rtcancel") + '" data-b="' + g.batch + '">' + (g.type === "receive" ? "ביטול קליטה" : "ביטול החזרה") + '</button>' : '';
    var lines = Object.keys(g.lines).map(function(k){ return g.lines[k]; }).sort(function(a, b){ return a.name.localeCompare(b.name, "he", {numeric:true}); }).map(function(l){
      return '<div class="recent"><span class="t">' + e(l.name) + ' <span class="muted small">' + (l.size === "" ? "ללא מידה" : l.size === "OS" ? "מידה אחת" : "מידה " + e(l.size)) + '</span></span><b>' + (g.type === "adjust" && l.q > 0 ? "+" : "") + l.q + '</b></div>';
    }).join("");
    html += '<div class="card" style="padding:12px 14px"><button type="button" class="al" data-a="hopen" data-k="' + e(g.key) + '" style="all:unset;display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;cursor:pointer;box-sizing:border-box">' +
      '<span class="t"><b>' + HTYPE[g.type] + ' · ' + e(d ? d.name : "") + '</b><br><span class="muted small">' + (g.ref ? e(g.ref) + " · " : "") + Object.keys(g.lines).length + ' שורות</span></span>' +
      '<span class="pill ' + (g.type === "receive" ? "ok" : g.type === "sale" ? "plain" : "warn") + '">' + (g.type === "adjust" && g.units > 0 ? "+" : "") + g.units + ' פריטים ' + (open ? "▴" : "▾") + '</span></button>' +
      (open ? '<div style="margin-top:8px;border-top:1px solid var(--line);padding-top:6px">' + lines + (cancel ? '<div style="text-align:end;margin-top:6px">' + cancel + '</div>' : '') + '</div>' : '') + '</div>';
  });
  return head + sum + html;
}
document.addEventListener("click", function(ev){
  var t = ev.target && ev.target.closest && ev.target.closest("[data-a=hset],[data-a=hopen]"); if (!t) return;
  ev.stopPropagation();
  if (t.getAttribute("data-a") === "hset"){ S.hist[t.getAttribute("data-k")] = t.getAttribute("data-v"); if (t.getAttribute("data-k") === "range" && t.getAttribute("data-v") === "custom" && !S.hist.from){ S.hist.from = dAdd(today(), -6); S.hist.to = today(); } }
  else { var k = t.getAttribute("data-k"); S.hist.open[k] = !S.hist.open[k]; }
  render();
}, true);
document.addEventListener("change", function(ev){
  var t = ev.target; if (!t || !t.id) return;
  if (t.id === "hD"){ S.hist.d = t.value; render(); }
  else if (t.id === "hFrom"){ S.hist.from = t.value; render(); }
  else if (t.id === "hTo"){ S.hist.to = t.value; render(); }
}, true);
