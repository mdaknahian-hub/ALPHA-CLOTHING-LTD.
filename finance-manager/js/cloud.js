/* ═══════════════════════════════════════════════
   cloud.js — optional Firebase cloud sync
   Real-time shared ledger between 2 devices:
   - offline-first: localStorage stays the source of truth
   - when connected, every change is mirrored to Firestore
     and pulled live on the other member's device
   - real Google (Gmail) sign-in via Firebase Auth
   ═══════════════════════════════════════════════ */

const CLOUD_KEY = "alphaFinanceCloud_v1";
const CLOUD_SDK_VERSION = "10.12.2";

/* Firebase web config shipped with this repository (public by design;
   access is controlled by Firestore security rules). Users may paste
   their own project config when connecting. */
const DEFAULT_FIREBASE_CONFIG = {
  projectId: "imposing-volt-485521-v3",
  appId: "1:361430844601:web:f63ad077c41449ee8b8768",
  apiKey: "AIzaSyAP8ou5d2ZNF7rcicwFbe2ze3nHaPD6gGk",
  authDomain: "imposing-volt-485521-v3.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-b5dbb28e-3117-4f04-ac33-c298c778955d",
  storageBucket: "imposing-volt-485521-v3.firebasestorage.app",
  messagingSenderId: "361430844601",
  measurementId: ""
};

/* Cloud runtime state */
const Cloud = {
  api: null,        /* { A: appMod, Au: authMod, Fs: firestoreMod } */
  app: null, auth: null, db: null,
  unsub: null,
  status: "off",    /* off | ok | syncing | needsLogin | error */
  pushTimer: null,
  dirty: false,     /* local changes not yet pushed */
  lastPushedAt: 0,
  lastRemoteAt: 0
};

/* ── Config storage ── */
function cloudCfg() {
  try { const c = JSON.parse(localStorage.getItem(CLOUD_KEY)); return (c && c.config && c.familyId) ? c : null; }
  catch (e) { return null; }
}
function cloudCfgSave(cfg) { localStorage.setItem(CLOUD_KEY, JSON.stringify(cfg)); }
function cloudCfgClear() { localStorage.removeItem(CLOUD_KEY); }
function cloudConfigured() { return !!cloudCfg(); }
function cloudLastSync() {
  const c = cloudCfg();
  return (c && c.lastSync) ? c.lastSync : 0;
}
function cloudLastSyncSave(ts) {
  const c = cloudCfg();
  if (c) { c.lastSync = ts; cloudCfgSave(c); }
}

/* ── Helpers ── */
function cloudFamilyCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return "AF-" + s;
}
/** Lenient parser: accepts raw JSON or the JS `firebaseConfig = {...};` snippet */
function parseFirebaseConfig(text) {
  let s = String(text || "").trim();
  const i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i < 0 || j < 0 || j <= i) return null;
  s = s.slice(i, j + 1);
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  s = s.replace(/'/g, '"');
  s = s.replace(/,(\s*[}\]])/g, "$1");
  try {
    const o = JSON.parse(s);
    return (o && o.apiKey && o.projectId) ? o : null;
  } catch (e) { return null; }
}
/** deep copy of data with PINs stripped (cloud never stores local PINs) */
function cloudSanitizeData(d) {
  const copy = JSON.parse(JSON.stringify(d));
  copy.users = copy.users.map(u => Object.assign({}, u, { pin: "" }));
  return copy;
}

/* ── Merge / apply remote ── */
/** union-merge (rescue mode, used only when local has unpushed changes) */
function mergeLedgerData(local, remote) {
  const merged = JSON.parse(JSON.stringify(remote));
  const mergeById = (ra, la) => {
    const m = {};
    const put = x => { const c = m[x.id]; if (!c || (x._editedAt || 0) >= (c._editedAt || 0)) m[x.id] = x; };
    ra.forEach(put); la.forEach(put);
    return Object.values(m);
  };
  merged.transactions = mergeById(remote.transactions, local.transactions)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  merged.budgets = mergeById(remote.budgets, local.budgets);
  merged.goals = mergeById(remote.goals, local.goals);
  /* users: remote fields win, but local PINs are preserved */
  const localUsers = {};
  local.users.forEach(u => { localUsers[u.id] = u; });
  merged.users = mergeById(remote.users, local.users).map(u => {
    const lu = localUsers[u.id];
    if (lu) u.pin = lu.pin || u.pin || "1234";
    return u;
  });
  merged.settings = ((local.settings && local.settings._editedAt) || 0) > ((remote.settings && remote.settings._editedAt) || 0)
    ? local.settings : remote.settings;
  return merged;
}
/** wholesale apply (normal mode — deletions propagate), local PINs kept */
function applyRemote(remoteData) {
  const local = getData();
  const d = JSON.parse(JSON.stringify(remoteData));
  d.users = d.users.map(u => {
    const lu = local.users.find(x => x.id === u.id);
    return lu ? Object.assign({}, u, { pin: lu.pin || u.pin }) : u;
  });
  replaceData(d);
}

/* ── SDK ── */
async function cloudEnsureSDK(cfg) {
  if (Cloud.db) return Cloud;
  const base = "https://www.gstatic.com/firebasejs/" + CLOUD_SDK_VERSION + "/";
  const [A, Au, Fs] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-auth.js"),
    import(base + "firebase-firestore.js")
  ]);
  const app = A.getApps().length ? A.getApp() : A.initializeApp(cfg.config || cfg);
  const auth = Au.getAuth(app);
  const db = (cfg.config && cfg.config.firestoreDatabaseId)
    ? Fs.getFirestore(app, cfg.config.firestoreDatabaseId)
    : Fs.getFirestore(app);
  Cloud.api = { A: A, Au: Au, Fs: Fs };
  Cloud.app = app; Cloud.auth = auth; Cloud.db = db;
  return Cloud;
}

/* ── Google sign-in ── */
async function cloudSignIn() {
  const Au = Cloud.api.Au;
  const provider = new Au.GoogleAuthProvider();
  try {
    const cred = await Au.signInWithPopup(Cloud.auth, provider);
    return cred.user;
  } catch (e) {
    const code = (e && e.code) || "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") throw { code: "popup-blocked" };
    if (code === "auth/unauthorized-domain") throw { code: "unauthorized-domain" };
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") throw { code: "cancelled" };
    throw { code: "auth", message: (e && e.message) || code };
  }
}
function cloudHandleAuthError(err) {
  const code = (err && err.code) || "";
  if (code === "popup-blocked") toast(t("cloud.errPopup"), "error");
  else if (code === "unauthorized-domain") toast(t("cloud.errDomain"), "error");
  else if (code === "cancelled") toast(t("cloud.errCancelled"), "info");
  else if (code === "email-mismatch") toast(t("cloud.errEmailMember"), "error");
  else if (code === "family-not-found") toast(t("cloud.errNotFound"), "error");
  else if (code === "join-denied") toast(t("cloud.errJoinDenied"), "error");
  else toast(t("cloud.errAuth", { msg: esc((err && err.message) || code) }), "error");
}

/* ── Status indicator ── */
function cloudSetStatus(st) { Cloud.status = st; cloudIndicator(); }
function cloudIndicator() {
  const btn = document.getElementById("cloudBtn");
  if (btn) {
    btn.classList.remove("st-off", "st-ok", "st-syncing", "st-error", "st-needsLogin");
    btn.classList.add("st-" + (Cloud.status === "needsLogin" ? "needsLogin" : Cloud.status));
    btn.title = cloudStatusLabel();
  }
  const tag = document.getElementById("googleTag");
  if (tag) tag.textContent = cloudConfigured() ? "Gmail" : "demo";
  const box = document.getElementById("cloudStatusBox");
  if (box && CURRENT_PAGE === "settings") renderCloudBox();
}
function cloudStatusLabel() {
  const map = {
    off: "☁️ " + t("cloud.off"),
    ok: "☁️ " + t("cloud.ok"),
    syncing: "☁️ " + t("cloud.syncing"),
    needsLogin: "☁️ " + t("cloud.needsLogin"),
    error: "☁️ " + t("cloud.error")
  };
  return map[Cloud.status] || map.off;
}

/* ── Settings box ── */
function renderCloudBox() {
  const box = document.getElementById("cloudStatusBox");
  if (!box) return;
  const cfg = cloudCfg();
  if (!cfg) {
    box.innerHTML =
      '<p class="hint" style="margin:0 0 12px">' + t("cloud.desc") + "</p>" +
      '<button class="btn btn-primary btn-sm" data-action="cloud-connect">☁️ ' + t("cloud.connect") + "</button>";
    return;
  }
  const last = cloudLastSync();
  const badge = Cloud.status === "ok" ? '<span class="badge badge-ok">' + t("cloud.ok") + "</span>"
    : Cloud.status === "syncing" ? '<span class="badge badge-warn">' + t("cloud.syncing") + "</span>"
    : Cloud.status === "needsLogin" ? '<span class="badge badge-warn">' + t("cloud.needsLogin") + "</span>"
    : '<span class="badge badge-over">' + t("cloud.error") + "</span>";
  box.innerHTML =
    '<div class="pc-rows" style="margin-bottom:12px">' +
    '<div class="pc-row">📤 <span>' + t("cloud.familyCode") + ': <b>' + esc(cfg.familyId) + '</b> <button class="mini-btn" data-action="cloud-copy-code" title="Copy">📋</button></span></div>' +
    '<div class="pc-row">✉️ <span>' + t("cloud.account") + ": <b>" + esc(cfg.email) + "</b></span></div>" +
    '<div class="pc-row">🕒 <span>' + t("cloud.lastSync") + ": <b>" + (last ? fmtDate(isoOf(new Date(last))) + " " + locDigits(new Date(last).toTimeString().slice(0, 5)) : t("cloud.never")) + "</b></span></div>" +
    '<div class="pc-row">' + badge + "</div></div>" +
    '<p class="hint" style="margin:0 0 12px">' + t("cloud.joinHint") + "</p>" +
    '<div class="pc-btns">' +
    '<button class="btn btn-ghost btn-sm" data-action="cloud-sync-now">🔄 ' + t("cloud.syncNow") + "</button>" +
    (Cloud.status === "needsLogin" ? '<button class="btn btn-primary btn-sm" data-action="cloud-reauth">🔑 ' + t("cloud.reauth") + "</button>" : "") +
    '<button class="btn btn-danger-ghost btn-sm" data-action="cloud-disconnect">⏏ ' + t("cloud.disconnect") + "</button></div>";
}

/* ── Status modal (topbar cloud button, when configured) ── */
function cloudStatusModal() {
  const cfg = cloudCfg();
  if (!cfg) { cloudConnectModal(); return; }
  const last = cloudLastSync();
  openModal({
    title: "☁️ " + t("cloud.cardTitle"),
    body:
      '<div class="pc-rows">' +
      '<div class="pc-row">📤 <span>' + t("cloud.familyCode") + ': <b>' + esc(cfg.familyId) + '</b> <button class="mini-btn" data-action="cloud-copy-code" title="Copy">📋</button></span></div>' +
      '<div class="pc-row">✉️ <span>' + t("cloud.account") + ": <b>" + esc(cfg.email) + "</b></span></div>" +
      '<div class="pc-row">🕒 <span>' + t("cloud.lastSync") + ": <b>" + (last ? fmtDate(isoOf(new Date(last))) + " " + locDigits(new Date(last).toTimeString().slice(0, 5)) : t("cloud.never")) + "</b></span></div>" +
      '<div class="pc-row">' + cloudStatusLabel() + "</div></div>" +
      '<p class="hint" style="margin:0 0 14px">' + t("cloud.joinHint") + "</p>",
    onMount(ov) {
      const f = document.createElement("div");
      f.className = "modal-foot";
      f.innerHTML =
        '<button class="btn btn-danger-ghost" data-action="cloud-disconnect" data-close="1">⏏ ' + t("cloud.disconnect") + "</button>" +
        '<button class="btn btn-ghost" data-action="cloud-sync-now" data-close="1">🔄 ' + t("cloud.syncNow") + "</button>" +
        '<button class="btn btn-primary" data-action="modal-close">' + t("common.close") + "</button>";
      ov.querySelector(".modal").appendChild(f);
      f.addEventListener("click", e => {
        const b = e.target.closest("[data-close]");
        if (b) closeTopModal();
      });
    }
  });
}

/* ── Connect flow ── */
function cloudConnectModal() {
  openModal({
    title: "☁️ " + t("cloud.setupTitle"),
    body:
      '<div class="cloud-steps">' +
      "<b>1.</b> " + t("cloud.step1") + "<br><b>2.</b> " + t("cloud.step2") + "<br><b>3.</b> " + t("cloud.step3") +
      "<br><b>4.</b> " + t("cloud.step4") + "<br><b>5.</b> " + t("cloud.step5") +
      "</div>" +
      '<label class="field" style="margin-top:14px"><span>' + t("cloud.configLabel") + "</span>" +
      '<textarea id="cfCfg" class="ta" rows="6" placeholder="' + t("cloud.pastePh") + '"></textarea></label>' +
      '<p class="hint" style="margin:-8px 0 12px">' + t("cloud.defaultCfgNote") + "</p>" +
      '<div class="seg" style="margin-bottom:12px">' +
      '<button type="button" class="seg-btn active" data-cloudmode="create" id="cfModeCreate">🆕 ' + t("cloud.create") + "</button>" +
      '<button type="button" class="seg-btn" data-cloudmode="join" id="cfModeJoin">🔗 ' + t("cloud.join") + "</button></div>" +
      '<label class="field hidden" id="cfCodeWrap"><span>' + t("cloud.familyCode") + "</span>" +
      '<div class="input-wrap"><input id="cfCode" type="text" maxlength="12" placeholder="' + t("cloud.codePh") + '" style="text-transform:uppercase"></div></label>' +
      '<div class="pc-row" style="margin-bottom:14px">📧 <span>' + esc(t("cloud.authorized")) + " <b>" + getData().users.map(u => esc(u.email)).join(", ") + "</b></span></div>" +
      '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-action="modal-close">' + t("common.cancel") + "</button>" +
      '<button type="button" class="btn btn-primary" id="cfGo">☁️ ' + t("cloud.connect") + "</button></div>",
    onMount(ov) {
      const ta = ov.querySelector("#cfCfg");
      ta.value = JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2);
      let mode = "create";
      ov.querySelectorAll("[data-cloudmode]").forEach(b => b.addEventListener("click", () => {
        mode = b.getAttribute("data-cloudmode");
        ov.querySelectorAll("[data-cloudmode]").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        ov.querySelector("#cfCodeWrap").classList.toggle("hidden", mode !== "join");
      }));
      ov.querySelector("#cfGo").addEventListener("click", async () => {
        const raw = ta.value;
        const code = ov.querySelector("#cfCode").value.trim().toUpperCase();
        if (mode === "join" && !code) { toast(t("toast.fillFields"), "error"); return; }
        const go = ov.querySelector("#cfGo");
        go.disabled = true;
        go.textContent = "… " + t("cloud.connecting");
        try {
          await cloudConnect(mode, raw, code);
          closeAllModals();
          toast(t("toast.cloudConnected"), "success");
        } catch (err) {
          cloudHandleAuthError(err);
          go.disabled = false;
          go.textContent = "☁️ " + t("cloud.connect");
        }
      });
    }
  });
}

async function cloudConnect(mode, rawConfig, joinCode) {
  const cfgObj = parseFirebaseConfig(rawConfig);
  if (!cfgObj) throw { code: "bad-config" };
  await cloudEnsureSDK({ config: cfgObj });

  const user = await cloudSignIn();
  const email = (user.email || "").toLowerCase();
  const members = getData().users.map(u => (u.email || "").toLowerCase()).filter(Boolean);
  if (members.indexOf(email) === -1) throw { code: "email-mismatch" };

  const Fs = Cloud.api.Fs;
  if (mode === "create") {
    const familyId = cloudFamilyCode();
    await Fs.setDoc(Fs.doc(Cloud.db, "ledgers", familyId), {
      members: members,
      updatedAt: Date.now(),
      updatedBy: currentUser().name,
      data: cloudSanitizeData(getData())
    });
    cloudCfgSave({ config: cfgObj, familyId: familyId, email: email, lastSync: Date.now() });
    Cloud.dirty = false;
    cloudStartSync();
    return;
  }

  /* join */
  const dref = Fs.doc(Cloud.db, "ledgers", joinCode);
  let snap;
  try {
    snap = await Fs.getDoc(dref);
  } catch (e) {
    throw { code: "join-denied" };
  }
  if (!snap.exists()) throw { code: "family-not-found" };
  const remote = snap.data();
  /* merge remote into local (keeps unsynced local additions), then push back */
  const localHasData = getData().transactions.length > 0;
  if (remote.data && localHasData) {
    applyRemote(mergeLedgerData(getData(), remote.data));
  } else if (remote.data) {
    applyRemote(remote.data);
  }
  cloudCfgSave({ config: cfgObj, familyId: joinCode, email: email, lastSync: Date.now() });
  cloudStartSync();
  renderUserChrome();
  renderCurrentPage();
  await cloudPushNow();
}

/* ── Sync engine ── */
function cloudStartSync() {
  const cfg = cloudCfg();
  if (!cfg || !Cloud.db) return;
  if (Cloud.unsub) return;
  cloudSetStatus("syncing");
  const Fs = Cloud.api.Fs;
  Cloud.unsub = Fs.onSnapshot(Fs.doc(Cloud.db, "ledgers", cfg.familyId), snap => {
    if (!snap.exists()) { cloudPushNow(); return; }
    const remote = snap.data();
    Cloud.lastRemoteAt = remote.updatedAt || 0;
    if (remote.updatedAt && remote.updatedAt === Cloud.lastPushedAt) {
      cloudSetStatus("ok");
      return;
    }
    if (remote.data) {
      if (Cloud.dirty) {
        /* rescue merge: keep unsynced local changes */
        replaceData(mergeLedgerData(getData(), remote.data));
        cloudPushNow();
      } else {
        applyRemote(remote.data);
      }
      if (!document.getElementById("app").classList.contains("hidden")) {
        renderUserChrome();
        renderCurrentPage();
      }
    }
    cloudLastSyncSave(Date.now());
    cloudSetStatus("ok");
  }, err => {
    cloudSetStatus("error");
  });
}

function cloudMarkDirty() {
  Cloud.dirty = true;
  cloudPush();
}
function cloudPush() {
  if (!Cloud.db || !cloudCfg()) return;
  clearTimeout(Cloud.pushTimer);
  Cloud.pushTimer = setTimeout(cloudPushNow, 1200);
}
async function cloudPushNow() {
  const cfg = cloudCfg();
  if (!cfg || !Cloud.db) return;
  clearTimeout(Cloud.pushTimer);
  cloudSetStatus("syncing");
  try {
    const payload = {
      members: getData().users.map(u => (u.email || "").toLowerCase()).filter(Boolean),
      updatedAt: Date.now(),
      updatedBy: currentUser().name,
      data: cloudSanitizeData(getData())
    };
    await Cloud.api.Fs.setDoc(Cloud.api.Fs.doc(Cloud.db, "ledgers", cfg.familyId), payload);
    Cloud.lastPushedAt = payload.updatedAt;
    Cloud.dirty = false;
    cloudLastSyncSave(payload.updatedAt);
    cloudSetStatus("ok");
  } catch (e) {
    cloudSetStatus("error");
  }
}
function cloudDisconnect() {
  if (Cloud.unsub) { Cloud.unsub(); Cloud.unsub = null; }
  if (Cloud.auth && Cloud.api) {
    try { Cloud.api.Au.signOut(Cloud.auth); } catch (e) {}
  }
  cloudCfgClear();
  Cloud.dirty = false;
  Cloud.status = "off";
  cloudIndicator();
  toast(t("toast.cloudDisconnected"), "info");
}

/* ── Re-auth (when session expired) ── */
async function cloudReauth() {
  const cfg = cloudCfg();
  if (!cfg) return;
  try {
    await cloudEnsureSDK(cfg);
    const user = await cloudSignIn();
    if ((user.email || "").toLowerCase() !== cfg.email) { toast(t("cloud.errEmailMember"), "error"); return; }
    cloudStartSync();
    await cloudPushNow();
    toast(t("toast.cloudSynced"), "success");
  } catch (err) { cloudHandleAuthError(err); }
}

/* ── Real Google login from the login screen (when configured) ── */
async function cloudGoogleLogin() {
  const cfg = cloudCfg();
  if (!cfg) return false; /* not configured → caller falls back to demo picker */
  try {
    await cloudEnsureSDK(cfg);
    const user = await cloudSignIn();
    const email = (user.email || "").toLowerCase();
    const u = getData().users.find(x => (x.email || "").toLowerCase() === email);
    if (!u) { toast(t("cloud.errEmailMember"), "error"); return true; }
    setSession(u.id);
    enterApp();
    toast(t("toast.welcome", { name: esc(u.name) }), "success");
    cloudStartSync();
    return true;
  } catch (err) {
    cloudHandleAuthError(err);
    return true;
  }
}

/* ── Boot (silent restore) ── */
async function cloudInit() {
  cloudIndicator();
  const cfg = cloudCfg();
  if (!cfg) return;
  try {
    await cloudEnsureSDK(cfg);
    Cloud.api.Au.onAuthStateChanged(Cloud.auth, user => {
      if (user && (user.email || "").toLowerCase() === cfg.email) {
        cloudStartSync();
      } else {
        cloudSetStatus("needsLogin");
      }
    });
  } catch (e) {
    cloudSetStatus("error");
  }
}

/* flush pending push when tab hides/closes */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && Cloud.dirty) cloudPushNow();
});
window.addEventListener("beforeunload", () => {
  if (Cloud.dirty && Cloud.pushTimer) { clearTimeout(Cloud.pushTimer); cloudPushNow(); }
});
