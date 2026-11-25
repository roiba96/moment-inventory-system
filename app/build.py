import re, shutil, subprocess, json, sys, os
H = os.path.dirname(os.path.abspath(__file__))
SK = os.path.join(H, "..", "moment-inventory.html")
s = open(SK, encoding="utf-8").read()

def rep(a, b, cnt=1):
    global s
    assert s.count(a) == cnt, (a[:90], s.count(a))
    s = s.replace(a, b)

def replace_func(name, new):
    global s
    i = s.index("function %s(" % name)
    j = s.index("\n}\n", i) + 3
    s = s[:i] + new.rstrip("\n") + "\n" + s[j:]

# --- review fixes (01.11): only recent receipts can be cancelled, with confirmation
rep('if (!m.batch) return;', 'if (!m.batch || Date.now() - (parseInt(m.batch.slice(1, 14), 10) || 0) > 7 * 864e5) return;')
rep('<h2 class="sec-title">קליטות שנרשמו עכשיו</h2>', '<h2 class="sec-title">קליטות מהשבוע האחרון</h2>')
rep('''if (!ok){ toast("אי אפשר לבטל: חלק מהפריטים כבר נמכרו. אפשר לתקן בספירה."); return; }''', '''if (!ok){ toast("אי אפשר לבטל: חלק מהפריטים כבר נמכרו. אפשר לתקן בספירה."); return; }
    if (!confirm("לבטל את הקליטה הזו? הפריטים יירדו מהמלאי.")) return;''')

# --- 08.11: sizes per designer can combine several scales (e.g. numbers + OS), and numbers 1-5 / 0-6
rep('var SCALES = {L:{name:"אותיות (XS עד XL)", sizes:SIZES}, N:{name:"מספרים (0 עד 4)", sizes:["0","1","2","3","4"]}, OS:{name:"מידה אחת (OS)", sizes:["OS"]}};',
    'var SCALES = {L:{name:"אותיות (XS עד XL)", sizes:SIZES}, N:{name:"מספרים (0 עד 4)", sizes:["0","1","2","3","4"]}, N15:{name:"מספרים (1 עד 5)", sizes:["1","2","3","4","5"]}, N06:{name:"מספרים (0 עד 6)", sizes:["0","1","2","3","4","5","6"]}, OS:{name:"מידה אחת (OS)", sizes:["OS"]}};\nfunction scaleKeys(d){ var k = String((desg(d) || {}).scale || "L").split(",").filter(function(x){ return SCALES[x]; }); return k.length ? k : ["L"]; }')
rep('function sizesOf(d){ return SCALES[desg(d).scale || "L"].sizes; }',
    'function sizesOf(d){ var out = []; scaleKeys(d).forEach(function(k){ SCALES[k].sizes.forEach(function(z){ if (out.indexOf(z) < 0) out.push(z); }); }); return out.filter(function(z){ return z !== "OS"; }).sort(function(a, b){ return SZ.indexOf(a) - SZ.indexOf(b); }).concat(out.indexOf("OS") > -1 ? ["OS"] : []); }')
rep('function mapSz(d, z){ var sc = desg(d).scale || "L";', 'function mapSz(d, z){ var sc = scaleKeys(d)[0];')

# --- 08.11: move units between sizes from the product sheet
rep('''    '</div></div>';
}
function renderSheet''', '''    sizeFixHtml(p) + '</div></div>';
}
function renderSheet''')

# --- 10.11: branded header + stock view grouped by designer, collapsed by default
rep('<h1>מלאי מומנט</h1>', '<h1 class="brand"><svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="10" fill="var(--accent)"/><text x="20" y="27.5" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="22" fill="var(--accent-fg)">M</text><rect x="12" y="32" width="16" height="1.6" rx=".8" fill="var(--accent-fg)" opacity=".7"/></svg><span>מומנט<small>בוטיק · ניהול מלאי</small></span></h1>')
rep("</style>", """.brand{display:flex; align-items:center; gap:10px}
.brand .logo{width:38px; height:38px; flex:none}
.brand small{display:block; font-family:var(--font-body); font-size:12px; font-weight:500; color:var(--muted); letter-spacing:.02em; margin-top:1px}
.today{color:var(--muted); font-size:14px; margin:0 0 10px}
details.grp>summary .chev{display:inline-block; transition:transform .15s; color:var(--muted); margin-inline-end:8px}
details.grp[open]>summary .chev{transform:rotate(-90deg)}
.grpbar{display:flex; justify-content:space-between; align-items:center; margin:2px 0 8px}
</style>""")
replace_func("stockGroups", r"""function stockGroups(){
  var q = S.iq.trim(), html = "", n = 0, cmp = function(a, b){ return a.name.localeCompare(b.name, "he", {numeric:true}); };
  DESIGNERS.forEach(function(d){
    var ps = P.filter(function(p){ return p.d === d.id && (!q || (p.name + " " + d.name).indexOf(q) > -1); }).sort(cmp);
    if (!ps.length) return;
    n++;
    var units = 0, out = 0; ps.forEach(function(p){ var k = stock(p.id); units += Math.max(0, k); if (k <= 0) out++; });
    var open = !!q || (S.open[d.id] === undefined ? grpOpenSaved(d.id) : S.open[d.id]);
    var rows = ps.map(function(p){
      var k = stock(p.id), c = S.counts[p.id], right;
      if (S.count){
        var diff = (c === undefined || c === "") ? null : parseInt(c, 10) - k;
        right = '<span class="sumrow"><input class="cnt" type="number" inputmode="numeric" data-count="' + p.id + '" value="' + (c === undefined ? "" : e(c)) + '" placeholder="' + k + '" aria-label="ספירה ל' + e(p.name) + '"><span id="df-' + p.id + '">' + diffPill(diff) + '</span></span>';
      } else right = stockPill(k);
      return '<div class="recent">' + nameCell(p, sizeBreak(p.id)) + right + '</div>';
    }).join("");
    html += '<details class="grp" data-d="' + d.id + '"' + (open ? " open" : "") + '><summary><span><span class="chev">‹</span>' + e(d.name) + ' <span class="muted small">' + ps.length + ' דגמים' + (d.type === "c" ? "" : " · קנייה") + '</span></span><span>' + (out ? '<span class="pill warn" style="margin-inline-end:6px">' + out + ' אזלו</span>' : '') + '<span class="pill plain">' + units + ' פריטים</span></span></summary><div class="inner">' + rows + '</div></details>';
  });
  if (!html) return '<div class="empty">לא נמצא דגם.</div>';
  var bar = n > 1 && !q ? '<div class="grpbar"><span class="small muted">לחיצה על מעצבת פותחת את הרשימה שלה</span><button class="linkbtn" type="button" data-a="grpall">' + (DESIGNERS.every(function(d){ return grpIsOpen(d.id); }) ? "סגירת הכל" : "פתיחת הכל") + '</button></div>' : '';
  return bar + html;
}""")

# --- 11.11: return to designer (mode inside the receive tab)
rep('receive:tabReceive, stock:tabStock', 'receive:tabReceiveOrReturn, stock:tabStock')
rep('if (!m.batch || Date.now() - (parseInt(m.batch.slice(1, 14), 10) || 0) > 7 * 864e5) return;', 'if (!m.batch || m.type !== "receive" || Date.now() - (parseInt(m.batch.slice(1, 14), 10) || 0) > 7 * 864e5) return;')

# --- bundle firebase layer
subprocess.check_call([shutil.which("npx"), "esbuild", "entry.js", "--bundle", "--minify", "--format=iife", "--outfile=dist/lib.js", "--log-level=error"], cwd=H)
lib = open(os.path.join(H, "dist", "lib.js"), encoding="utf-8").read()
assert "</script" not in lib.lower()
# The values come from environment variables (see .env.example). Without them the build uses
# placeholders, and the demo (?demo=1) works, because it never contacts Firebase.
E = os.environ.get
PROJECT = E("FIREBASE_PROJECT_ID", "your-project-id")
config = {
  "apiKey": E("FIREBASE_API_KEY", "your-firebase-api-key"),
  "authDomain": E("FIREBASE_AUTH_DOMAIN", PROJECT + ".firebaseapp.com"),
  "projectId": PROJECT,
  "storageBucket": E("FIREBASE_STORAGE_BUCKET", PROJECT + ".firebasestorage.app"),
  "messagingSenderId": E("FIREBASE_SENDER_ID", "your-sender-id"),
  "appId": E("FIREBASE_APP_ID", "your-app-id"),
}
OCR_URL = E("OCR_URL", "https://ocr.example.com/")
glue = open(os.path.join(H, "glue.js"), encoding="utf-8").read().replace("__FIREBASE_CONFIG__", json.dumps(config)).replace("__OCR_URL__", json.dumps(OCR_URL))

# --- header
rep('''    <span class="badge">סקיצה, נתוני דוגמה</span>
  </header>
  <p class="sub">הדגמה של איך תיראה מכירה, קליטה ודוח סוף חודש. המעצבות והמחירים כאן בדויים. <button class="linkbtn" data-a="reset" type="button">איפוס נתוני הדוגמה</button></p>''',
'''    <span class="badge" id="connBadge"></span>
  </header>
  <p class="sub" id="subLine"></p>''')
rep("</style>", ".chk{display:flex; gap:10px; align-items:center; margin:4px 0 8px; font-size:16px}\n.chk input{width:22px; height:22px; flex:none}\n.badge.warnb{background:var(--warn-soft); color:var(--warn)}\n</style>")

# --- designers: demo only
i = s.index("var DESIGNERS = [")
j = s.index("];", i) + 2
demo_des = s[i:j].replace("var DESIGNERS = [", "var DEMO_DESIGNERS = [")
s = s[:i] + demo_des + "\nvar DESIGNERS = [];" + s[j:]

# --- addMove
rep('''function addMove(type, p, delta, date, size, price, ref, tg, cu){
  M.push({id:++mid, type:type, p:p, delta:delta, date:date, size:size || "", price:price || 0, ref:ref || "", tag:tg || 0, cust:cu || ""});
}''', '''function addMove(type, p, delta, date, size, price, ref, tg, cu){
  var m = {id:uid(), type:type, p:p, delta:delta, date:date, size:size || "", price:price || 0, ref:ref || "", tag:tg || 0};
  if (CURBATCH) m.batch = CURBATCH;
  M.push(m); persist("moves", m.id, m);
}''')
rep('''P.push({id:id, d:r[0], name:r[1], w:r[2]});''', '''P.push({id:id, d:r[0], name:r[1], w:r[2]}); persist("products", id, {d:r[0], name:r[1], w:r[2]});''')

# --- glue before sell section
rep("/* ---------- sell ---------- */", glue + "\n/* ---------- sell ---------- */")

# --- replace confirmRecv / tabHome / tabMore / subDesigners with glue versions (remove old)
def drop_func(name):
    global s
    i = s.index("function %s(" % name)
    j = s.index("\n}\n", i) + 3
    s = s[:i] + s[j:]
for fn in ["confirmRecv", "tabHome", "tabMore", "subDesigners", "tabClose", "closeTotals", "closeSummary", "closeApply"]:
    # glue defines the new one after; remove the OLD occurrence (the first one, which precedes glue? glue is before sell, old ones come later)
    first = s.index("function %s(" % fn)
    second = s.index("function %s(" % fn, first + 5)
    i = second
    j = s.index("\n}\n", i) + 3
    s = s[:i] + s[j:]

# --- sell list: price only with MONEY
rep("nameCell(p, e(desg(p.d).name) + ' · ' + fm0(tag(p)))", "nameCell(p, e(desg(p.d).name) + (MONEY ? ' · ' + fm0(tag(p)) : ''))")

# --- sale sheet: no customers, money block optional
i = s.index("    custSel + '<div class=\"lab\" style=\"margin-top:14px\">הנחה ללקוחה</div>")
j = s.index("'<div class=\"row2\"><button class=\"btn alt\" type=\"button\" data-a=\"closesheet\">ביטול</button>", i)
money_block = '''    (MONEY ? '<div class="lab" style="margin-top:14px">הנחה ללקוחה</div><div class="chips">' + [0,10,20,30,40].map(function(x){ return '<button type="button" class="chip' + (S.disc === x ? " on" : "") + '" data-a="disc" data-v="' + x + '">' + (x ? x + "%" : "ללא") + '</button>'; }).join("") + '</div>' +
    '<div class="field"><label for="sheetPrice">מחיר ליחידה ללקוחה, כולל מע״מ</label><input id="sheetPrice" type="number" inputmode="decimal" value="' + S.price + '"></div>' +
    '<div class="small muted">מחיר בתווית ' + fm0(tag(p)) + ' (מחיר המעצבת ×' + desg(p.d).mult + '). <span id="sheetDes">' + desText(p) + '</span></div>' +
    '<div class="total"><span>סה״כ ' + total + ' יחידות</span><b id="sheetTotal">' + fm0(total * (parseFloat(S.price) || 0)) + '</b></div>' : '<div class="total"><span>סה״כ ' + total + ' יחידות</span></div>') + 
    '''
s = s[:i] + money_block + s[j:]

# sell handler: money off => no price
rep('''var p = prod(S.sheet), price = parseFloat(S.price) || 0, c = 0, bad = null;''', '''var p = prod(S.sheet), price = MONEY ? (parseFloat(S.price) || 0) : 0, c = 0, bad = null;''')
rep('''addMove("sale", p.id, -1, today(), k === "x" ? "" : k, price, "", tag(p), S.saleCust);''', '''addMove("sale", p.id, -1, today(), k === "x" ? "" : k, price, "", MONEY ? tag(p) : 0);''')
rep('''var who = S.saleCust ? cust(S.saleCust) : null;
    if (who) W.forEach(function(w){ if (w.cust === who.id && w.p === p.id && w.status !== "done") w.status = "done"; });
    S.saleCust = "";''', '''var who = null;''')
rep('''". נשארו " + stock(p.id) + " במלאי." + (who ? " נשמר בכרטיס של " + who.name + "." : ""));''', '''". נשארו " + stock(p.id) + " במלאי.");''')
rep('''var custSel = '<div class="field" style="margin-top:14px"><label for="saleCust">לקוחה (לא חובה)</label>''', '''var custSel0 = '<div class="field" style="margin-top:14px"><label for="saleCust">לקוחה (לא חובה)</label>''')

# --- undo / cancel receipt persist
rep('''M = M.filter(function(m){ return m.id !== id; }); toast("המכירה בוטלה והמלאי הוחזר."); }''', '''M = M.filter(function(m){ return m.id !== id; }); unpersist("moves", id); toast("המכירה בוטלה והמלאי הוחזר."); }''')
rep('''M = M.filter(function(m){ return m.batch !== b; }); toast("הקליטה בוטלה והמלאי הוחזר."); render();''', '''mv.forEach(function(m){ unpersist("moves", m.id); }); M = M.filter(function(m){ return m.batch !== b; }); toast("הקליטה בוטלה והמלאי הוחזר."); render();''')

# --- photo
rep('''readPhoto(fl, function(url){ prod(S.sheet).img = url; renderSheet(); render(); });''', '''readPhoto(fl, function(url){ var pp = prod(S.sheet); pp.img = url; persist("products", pp.id, {img:url}); renderSheet(); render(); });''')

# --- receive tab changes
rep('''    '<button class="btn alt full" type="button" data-a="loadsample">טעינת תעודה לדוגמה</button>' +
    '<div class="note">בגרסה האמיתית: תעודה מודפסת או קובץ PDF ייקראו אוטומטית. תעודה בכתב יד תצטרך הקלדה או בדיקה.</div>' +''',
'''    '<div class="card">' + scanBtn("recv") + '<label class="lab" for="rcPaste" style="display:block">הדבקת תעודה מודפסת או רשימת מלאי</label>' +
    '<textarea id="rcPaste" rows="4" placeholder="אפשר להעתיק את הטקסט מתעודה דיגיטלית, או להקליד שורה לכל דגם: 6 אוברול קיצי">' + e(S.rcPaste || "") + '</textarea>' +
    '<button class="btn alt full" style="margin-top:8px" type="button" data-a="rcparse">זיהוי מהטקסט</button>' + (S.rcMsg || "") + '</div>' +''')
rep('''    '<div class="card empty">אין שורות עדיין. אפשר לטעון תעודה לדוגמה, או להוסיף שורה ידנית.</div>';''', '''    '<div class="card empty">אין שורות עדיין. אפשר להדביק טקסט למעלה, או להוסיף שורה ידנית למטה.</div>';''')
rep('''    '<button class="btn full" type="button" data-a="confirmrecv">אישור קליטה</button>' :''', '''    '<label class="chk"><input type="checkbox" data-a="opentoggle"' + (S.opening ? " checked" : "") + '> זו קליטת מלאי פתיחה (לא תעודת משלוח)</label>' +
    '<button class="btn full" type="button" data-a="confirmrecv">אישור קליטה</button>' :''')
rep('''<label for="newPrice">מחיר, לפני מע״מ</label>''', '''<label for="newPrice">מחיר, לפני מע״מ (לא חובה)</label>''')
rep('''    var nm = S.newName.trim(), w = parseFloat(S.newPrice);
    if (!nm || isNaN(w)){ toast("צריך שם דגם ומחיר כדי להוסיף שורה."); return; }''', '''    var nm = S.newName.trim(), w = parseFloat(S.newPrice); if (isNaN(w)) w = 0;
    if (!nm){ toast("צריך שם דגם כדי להוסיף שורה."); return; }''')
rep('''else if (a === "loadsample"){ loadSample(); render(); }''', '''else if (a === "rcparse"){ rcParse(); render(); }''')

# --- report: money off
rep('''  if (d.type === "p") return head + movesCard +''', '''  if (!MONEY){
    var sd = data.rows.filter(function(r){ return r.sold > 0; });
    return head + movesCard + '<h2 class="sec-title">מה נמכר</h2><div class="card">' + (sd.length ? sd.map(function(r){ return '<div class="recent"><span class="t">' + e(soldText(r)) + '</span><b>' + r.sold + '</b></div>'; }).join("") : '<div class="empty">לא נמכר דבר בחודש הזה.</div>') + '</div>' +
      (sd.length ? '<button class="btn full" type="button" data-a="copyrep">העתקת הרשימה למעצבת</button>' : "") + '<div class="note">חישוב התשלום למעצבות כבוי. אפשר להפעיל אותו במסך מעצבות.</div>';
  }
  if (d.type === "p") return head + movesCard +''')

# --- click handlers
rep('''else if (a === "reset"){ seed(); seedPeople(); S.rl = []; S.counts = {}; S.count = false; S.repM = ""; S.cc = {}; S.clM = ""; S.clMsg = ""; S.clPaste = ""; toast("נתוני הדוגמה אופסו."); }''',
'''else if (a === "reset"){ location.reload(); }
  else if (a === "signin"){ Store.signIn().catch(function(er){ toast("ההתחברות נכשלה: " + (er && (er.code || er.message))); }); }
  else if (a === "signout"){ S.err = null; Store.signOut().then(function(){ location.reload(); }); }
  else if (a === "expcsv"){ exportCsv(); }
  else if (a === "expjson"){ exportJson(); }
  else if (a === "ping"){
    S.pingMsg = "בודק..."; render();
    Store.ping().then(function(ms){ S.pingMsg = "השמירה בענן עובדת (" + ms + " מילישניות)."; render(); }, function(er){ S.pingMsg = er && er.message === "timeout" ? "אין תשובה מהשרת. ייתכן שאין חיבור לאינטרנט." : "השמירה נכשלה: " + (er && (er.code || er.message)); render(); });
  }''')
rep('''    DESIGNERS.push({id:"d" + Date.now(), name:nm2, type:"c", mult:ml, scale:document.getElementById("ndScale").value});''', '''    var nd = {id:"d" + Date.now().toString(36), name:nm2, type:"c", mult:ml, scale:document.getElementById("ndScale").value, created:Date.now()}; DESIGNERS.push(nd); persistDes(nd.id);''')
rep('''else if (ev.target.hasAttribute("data-dt")){ desg(ev.target.getAttribute("data-dt")).type = ev.target.value; render(); }
  else if (ev.target.hasAttribute("data-ds")){ desg(ev.target.getAttribute("data-ds")).scale = ev.target.value; toast("שיטת המידות עודכנה. מלאי קיים במידות מהשיטה הקודמת ממשיך להופיע."); render(); }''',
'''else if (ev.target.hasAttribute("data-dt")){ desg(ev.target.getAttribute("data-dt")).type = ev.target.value; persistDes(ev.target.getAttribute("data-dt")); render(); }
  else if (ev.target.hasAttribute("data-ds")){ desg(ev.target.getAttribute("data-ds")).scale = ev.target.value; persistDes(ev.target.getAttribute("data-ds")); toast("שיטת המידות עודכנה. מלאי קיים במידות מהשיטה הקודמת ממשיך להופיע."); render(); }
  else if (ev.target.hasAttribute("data-dn")){ persistDes(ev.target.getAttribute("data-dn")); }
  else if (ev.target.hasAttribute("data-dm")){ persistDes(ev.target.getAttribute("data-dm")); }
  else if (ev.target.getAttribute("data-a") === "moneytoggle"){ MONEY = ev.target.checked; persist("settings", "main", {money:MONEY}); render(); }
  else if (ev.target.getAttribute("data-a") === "opentoggle"){ S.opening = ev.target.checked; }''')
rep('''  else if (id === "clPaste") S.clPaste = t.value;''', '''  else if (id === "clPaste") S.clPaste = t.value;
  else if (id === "rcPaste") S.rcPaste = t.value;''')

# --- render with gate
rep('''function render(){
  document.getElementById("tabs").innerHTML =''', '''function render(){
  var sub = document.getElementById("subLine");
  sub.innerHTML = DEMO ? 'מצב הדגמה: הנתונים כאן בדויים ולא נשמרים. <button class="linkbtn" data-a="reset" type="button">איפוס</button>' : "";
  updateBadge();
  document.querySelector("nav.tabs").hidden = !S.ready;
  if (!S.ready){ document.getElementById("tabs").innerHTML = ""; document.getElementById("view").innerHTML = gateHtml(); return; }
  fixSel();
  if (!DESIGNERS.length && S.tab === "more" && S.sub !== "backup") S.sub = "designers";
  var setupOnly = S.tab === "more" && (S.sub === "designers" || S.sub === "backup");
  if (!DESIGNERS.length && S.tab !== "home" && !setupOnly){
    document.getElementById("tabs").innerHTML = TABS.map(function(t){ return '<button type="button" class="' + (S.tab === t[0] ? "on" : "") + '" data-a="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join("");
    document.getElementById("view").innerHTML = onboardHtml(); return;
  }
  document.getElementById("tabs").innerHTML =''')


# --- per-size close
rep('clD:"d0",', 'clD:"d0", cs:{}, cx:{},')
rep("</style>", ".gcells{display:flex; flex-wrap:wrap; gap:8px; margin:8px 0; direction:ltr; justify-content:flex-end}\n.gcell{display:grid; justify-items:center; gap:2px}\n.gcell .sl{font-weight:700; font-size:14px}\n.gcell .cnt{width:58px}\n.gcell .st{color:var(--muted); font-size:11px}\n</style>")
rep('''  else if (t.hasAttribute("data-cc")){
    var cp = t.getAttribute("data-cc"); S.cc[cp] = t.value;
    document.getElementById("cd-" + cp).innerHTML = closeInfo(stock(cp), t.value);
    document.getElementById("clSum").innerHTML = closeSummary();
  }''', '''  else if (t.hasAttribute("data-cc")){
    var cp = t.getAttribute("data-cc"); S.cc[cp] = t.value;
    document.getElementById("cd-" + cp).innerHTML = planPill(closePlan(prod(cp)));
    document.getElementById("clSum").innerHTML = closeSummary();
  }
  else if (t.hasAttribute("data-cs")){
    var kv = t.getAttribute("data-cs").split("|"); S.cs[kv[0]] = S.cs[kv[0]] || {}; S.cs[kv[0]][kv[1]] = t.value;
    document.getElementById("cd-" + kv[0]).innerHTML = planPill(closePlan(prod(kv[0])));
    document.getElementById("clSum").innerHTML = closeSummary();
  }''')
rep('''else if (id === "clD"){ S.clD = ev.target.value; S.cc = {}; S.clMsg = ""; render(); }''', '''else if (id === "clD"){ S.clD = ev.target.value; S.cc = {}; S.cs = {}; S.cx = {}; S.clMsg = ""; render(); }''')
rep('''  else if (a === "closeapply"){ closeApply(); render(); }''', '''  else if (a === "closeapply"){ closeApply(); render(); }
  else if (a === "cxt"){ var cpid = el.getAttribute("data-p"); S.cx[cpid] = !S.cx[cpid]; render(); }''')

# --- boot
rep('''seed(); seedPeople();
render();''', '''boot();''')
# --- scripts: lib before main script
rep("<script>\ndocument.documentElement.lang", "<script>" + lib.replace("\\", "\\\\") .replace("\\\\", "\\") + "</script>\n<script>\ndocument.documentElement.lang")
head = ['<!doctype html>', '<html lang="he" dir="rtl">', '<head>', '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">', '<style>:root{color-scheme:light dark}body{margin:0}[hidden]{display:none!important}</style>']
s = "\n".join(head) + "\n" + s + "\n</html>\n"
# 10.11: home-screen icon and name (opens in Safari, keeps Google sign-in working)
assert s.count("<title>מלאי מומנט</title>") == 1
s = s.replace("<title>מלאי מומנט</title>", """<title>מומנט</title>
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-title" content="מומנט">
<meta name="application-name" content="מומנט">
<meta name="theme-color" content="#3B3FA0">""")
os.makedirs(os.path.join(H, "dist", "site"), exist_ok=True)
for f in ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "manifest.webmanifest"]:
    shutil.copy(os.path.join(H, "icons", f), os.path.join(H, "dist", "site", f))
open(os.path.join(H, "dist", "moment-app.html"), "w", encoding="utf-8", newline="\n").write(s)
os.makedirs(os.path.join(H, "dist", "site"), exist_ok=True)
open(os.path.join(H, "dist", "site", "index.html"), "w", encoding="utf-8", newline="\n").write(s)
print("built", len(s))
