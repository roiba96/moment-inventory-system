// שכבת הנתונים של מלאי מומנט. עוטפת את Firebase (Auth + Firestore), ומאפשרת הזרקת SDK מדומה לבדיקות ולמצב הדגמה.
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

export const realSdk = {
  initializeApp, getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot
};

const COLLS = ["designers", "products", "moves", "settings"];
const strip = o => { const r = {}; Object.keys(o).forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };

export function createStore(sdk) {
  let app, auth, db, user = null, watching = false;
  const store = {
    init(config) {
      app = sdk.initializeApp(config);
      auth = sdk.getAuth(app);
      try {
        db = sdk.initializeFirestore(app, { localCache: sdk.persistentLocalCache({ tabManager: sdk.persistentMultipleTabManager() }) });
      } catch (e) {
        db = sdk.getFirestore(app);
      }
    },
    onAuth(cb) {
      sdk.onAuthStateChanged(auth, u => { user = u; cb(u ? { email: u.email, name: u.displayName } : null); });
    },
    async signIn() {
      const provider = new sdk.GoogleAuthProvider();
      try {
        await sdk.signInWithPopup(auth, provider);
      } catch (e) {
        const redirectCodes = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"];
        const quiet = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];
        if (redirectCodes.indexOf(e.code) > -1) return sdk.signInWithRedirect(auth, provider);
        if (quiet.indexOf(e.code) > -1) return;
        throw e;
      }
    },
    signOut() { return sdk.signOut(auth); },
    // טוקן כניסה לשרת קריאת התעודות
    idToken() { return auth && auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve("fake-token"); },
    // handlers: {designers(list), products(list), moves(list), settings(list), status(fromCache), error(err, coll)}
    watch(handlers) {
      if (watching) return;
      watching = true;
      COLLS.forEach(c => {
        sdk.onSnapshot(sdk.collection(db, c), snap => {
          const list = [];
          snap.forEach(d => list.push(Object.assign({}, d.data(), { _id: d.id })));
          handlers[c](list);
          if (handlers.status) handlers.status(!!(snap.metadata && snap.metadata.fromCache));
        }, err => handlers.error && handlers.error(err, c));
      });
    },
    save(c, id, data) { return sdk.setDoc(sdk.doc(db, c, String(id)), strip(data), { merge: true }); },
    del(c, id) { return sdk.deleteDoc(sdk.doc(db, c, String(id))); },
    async ping() {
      const t = Date.now();
      const write = sdk.setDoc(sdk.doc(db, "_ping", "last"), { t, by: user ? user.email : "" });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000));
      await Promise.race([write, timeout]);
      return Date.now() - t;
    }
  };
  return store;
}

// SDK מדומה בזיכרון: למצב הדגמה (?demo=1) ולבדיקות. אינו כותב לשום מקום.
export function fakeSdk(opts) {
  opts = opts || {};
  const data = {}, listeners = {};
  let authCb = null, current = null;
  const get = c => data[c] || (data[c] = {});
  const emit = c => (listeners[c] || []).forEach(fn => fn());
  const snapOf = c => ({ metadata: { fromCache: false }, forEach(f) { Object.keys(get(c)).forEach(id => f({ id, data: () => JSON.parse(JSON.stringify(get(c)[id])) })); } });
  return {
    _data: data,
    initializeApp: () => ({}), getAuth: () => ({}),
    initializeFirestore: () => ({}), persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}), getFirestore: () => ({}),
    GoogleAuthProvider: function () {},
    signInWithPopup: async () => { current = { email: opts.email || "demo@example.com", displayName: "הדגמה" }; authCb && authCb(current); },
    signInWithRedirect: async () => {},
    signOut: async () => { current = null; authCb && authCb(null); },
    onAuthStateChanged: (_a, cb) => { authCb = cb; setTimeout(() => cb(opts.signedIn === false ? null : (current = { email: opts.email || "demo@example.com", displayName: "הדגמה" })), 0); },
    collection: (_db, c) => c,
    doc: (_db, c, id) => ({ c, id }),
    setDoc: async (ref, d, o) => { if (opts.denyWrites) { const e = new Error("denied"); e.code = "permission-denied"; throw e; } const col = get(ref.c); col[ref.id] = (o && o.merge && col[ref.id]) ? Object.assign({}, col[ref.id], d) : Object.assign({}, d); emit(ref.c); },
    deleteDoc: async ref => { delete get(ref.c)[ref.id]; emit(ref.c); },
    onSnapshot: (c, ok, err) => {
      if (opts.denyReads) { setTimeout(() => err({ code: "permission-denied" }), 0); return () => {}; }
      const fn = () => ok(snapOf(c));
      (listeners[c] = listeners[c] || []).push(fn);
      setTimeout(fn, 0);
      return () => {};
    }
  };
}
