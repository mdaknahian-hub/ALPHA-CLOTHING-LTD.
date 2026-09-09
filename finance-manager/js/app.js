/* ═══════════════════════════════════════════════
   app.js — core: auth, router, modals, events
   ═══════════════════════════════════════════════ */

let CURRENT_PAGE = "dashboard";

/* ─────────── Toast ─────────── */
function toast(msg, type) {
  const root = document.getElementById("toastRoot");
  const el = document.createElement("div");
  el.className = "toast " + (type || "info");
  const ico = type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️";
  el.innerHTML = '<span class="t-ico">' + ico + "</span><span>" + msg + "</span>";
  root.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, 3200);
}

/* ─────────── Modals ─────────── */
function openModal(opts) {
  const root = document.getElementById("modalRoot");
  const ov = document.createElement("div");
  ov.className = "modal-overlay";
  ov.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true">' +
    '<div class="modal-head"><h3>' + (opts.title || "") + '</h3><button class="modal-x" data-action="modal-close" type="button">✕</button></div>' +
    '<div class="modal-body">' + (opts.body || "") + "</div>" +
    "</div>";
  root.appendChild(ov);
  ov.addEventListener("mousedown", e => { if (e.target === ov) closeTopModal(); });
  if (opts.onMount) opts.onMount(ov);
  const focusEl = ov.querySelector("[data-autofocus]");
  if (focusEl) setTimeout(() => focusEl.focus(), 60);
  return ov;
}
function closeTopModal() {
  const root = document.getElementById("modalRoot");
  if (root.lastElementChild) root.removeChild(root.lastElementChild);
}
function closeAllModals() {
  document.getElementById("modalRoot").innerHTML = "";
}
function confirmModal(opts) {
  openModal({
    title: opts.title || t("modal.deleteTitle"),
    body:
      '<div class="confirm-ico ' + (opts.danger ? "red" : "violet") + '">' + (opts.icon || "⚠️") + "</div>" +
      '<p class="confirm-text">' + (opts.text || "") + "</p>",
    onMount(ov) {
      const f = document.createElement("div");
      f.className = "modal-foot";
      f.innerHTML =
        '<button class="btn btn-ghost" data-action="modal-close" type="button">' + t("common.cancel") + "</button>" +
        '<button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" id="cfYes" type="button">' + (opts.confirmLabel || t("modal.confirm")) + "</button>";
      ov.querySelector(".modal").appendChild(f);
      f.querySelector("#cfYes").addEventListener("click", () => {
        closeTopModal();
        if (opts.onConfirm) opts.onConfirm();
      });
    }
  });
}

/* ─────────── Theme & language ─────────── */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const icon = theme === "dark" ? "🌙" : "☀️";
  const t1 = document.getElementById("themeIcon"), t2 = document.getElementById("loginThemeIcon");
  if (t1) t1.textContent = icon;
  if (t2) t2.textContent = icon;
}
function applyLanguage(lang) {
  const d = getData();
  d.settings.language = lang === "bn" ? "bn" : "en";
  saveData();
  setLang(d.settings.language);
  applyI18n(document);
  document.querySelectorAll(".lang-label").forEach(el => el.textContent = d.settings.language === "bn" ? "বাং" : "EN");
  renderDemoHint();
  if (document.getElementById("app").classList.contains("hidden")) return;
  renderUserChrome();
  renderCurrentPage();
}

/* ─────────── User chrome (avatars, sidebar, dropdown) ─────────── */
function currentUser() { return userById(getSession() || "u1"); }
function renderUserChrome() {
  const u = currentUser();
  const d = getData();
  document.getElementById("sideFamily").textContent = d.settings.familyName;
  document.getElementById("topAvatar").innerHTML = esc(initialsOf(u.name));
  document.getElementById("topAvatar").style.background = "linear-gradient(135deg," + u.color + "," + shade(u.color, 40) + ")";
  document.getElementById("dropdownHead").innerHTML = avatarHTML(u, "avatar") +
    '<div style="min-width:0"><b>' + esc(u.name) + '</b><span>' + esc(u.email) + "</span></div>";
  document.getElementById("sideUser").innerHTML = avatarHTML(u, "avatar") +
    '<div style="min-width:0"><div class="su-name">' + esc(u.name) + '</div><div class="su-mail">' + esc(u.email) + "</div></div>";
}

/* ─────────── Router ─────────── */
function navigate(page) {
  CURRENT_PAGE = page;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");
  document.querySelectorAll(".nav-item, .bn-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  document.getElementById("pageTitle").textContent = t(PAGE_TITLES[page]);
  closeSidebar();
  renderCurrentPage();
  window.scrollTo({ top: 0 });
}
function renderCurrentPage() {
  const titleEl = document.getElementById("pageTitle");
  if (titleEl && PAGE_TITLES[CURRENT_PAGE]) titleEl.textContent = t(PAGE_TITLES[CURRENT_PAGE]);
  const fn = PAGE_RENDER[CURRENT_PAGE];
  if (fn) fn();
}
function commit() {
  saveData();
  renderCurrentPage();
}

/* ─────────── Login / auth ─────────── */
function renderDemoHint() {
  const box = document.getElementById("demoHint");
  if (!box) return;
  const d = getData();
  box.innerHTML =
    '<div class="dh-title">👤 ' + t("demo.title") + "</div>" +
    d.users.map(u =>
      '<div class="dh-row">' + avatarHTML(u) + "<span><b>" + esc(u.name) + "</b> · " + esc(u.email) + " · " + esc(u.mobile) + "</span>" +
      '<span class="dh-pin">PIN ' + u.pin + "</span></div>"
    ).join("") +
    '<div style="font-size:11.5px">' + t("demo.tip") + "</div>";
}
function doLogin(identifier, pin) {
  const u = findUserByIdentifier(identifier);
  if (!u || String(u.pin) !== String(pin).trim()) {
    toast(t("toast.wrongCreds"), "error");
    return false;
  }
  setSession(u.id);
  enterApp();
  toast(t("toast.welcome", { name: esc(u.name) }), "success");
  return true;
}
function enterApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  renderUserChrome();
  navigate("dashboard");
}
function logout() {
  clearSession();
  closeAllModals();
  document.getElementById("app").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  const p = document.getElementById("loginPin");
  if (p) p.value = "";
  renderDemoHint();
  toast(t("toast.logout"), "info");
}
function pinModal(user, purpose) {
  openModal({
    title: t("modal.pinFor", { name: esc(user.name) }),
    body:
      '<form id="pinForm"><label class="field"><span>' + t("login.pin") + '</span>' +
      '<div class="input-wrap"><span class="input-lead">🔑</span><input id="pinInput" type="password" inputmode="numeric" maxlength="6" data-autofocus required></div></label>' +
      '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-action="modal-close">' + t("common.cancel") + '</button>' +
      '<button type="submit" class="btn btn-primary">' + t("login.btn") + "</button></div></form>",
    onMount(ov) {
      ov.querySelector("#pinForm").addEventListener("submit", e => {
        e.preventDefault();
        const val = ov.querySelector("#pinInput").value.trim();
        if (String(user.pin) !== val) { toast(t("toast.pinWrong"), "error"); return; }
        closeAllModals();
        purpose();
      });
    }
  });
}
function googleModal() {
  const d = getData();
  openModal({
    title: t("modal.googleTitle"),
    body:
      '<p class="hint" style="margin:-6px 0 14px">' + t("modal.googleNote") + "</p>" +
      d.users.map(u =>
        '<button class="google-row" data-google="' + u.id + '" type="button">' + avatarHTML(u, "avatar") +
        "<span><b>" + esc(u.name) + "</b><span>" + esc(u.email) + "</span></span></button>"
      ).join(""),
    onMount(ov) {
      ov.querySelectorAll("[data-google]").forEach(b => b.addEventListener("click", () => {
        const u = userById(b.getAttribute("data-google"));
        closeAllModals();
        pinModal(u, () => {
          setSession(u.id);
          enterApp();
          toast(t("toast.welcome", { name: esc(u.name) }), "success");
        });
      }));
    }
  });
}

/* ─────────── Transaction modal ─────────── */
function openTxModal(tx, presetType) {
  const isEdit = !!tx;
  const type = tx ? tx.type : (presetType || "expense");
  const users = getData().users;
  openModal({
    title: t(isEdit ? "form.editTitle" : "form.addTitle"),
    body:
      '<form id="txForm">' +
      '<div class="type-toggle">' +
      '<button type="button" class="type-btn expense ' + (type === "expense" ? "active" : "") + '" data-t="expense">− ' + t("common.expense") + "</button>" +
      '<button type="button" class="type-btn income ' + (type === "income" ? "active" : "") + '" data-t="income">＋ ' + t("common.income") + "</button></div>" +
      '<div class="field amount-input"><span>' + t("form.amount") + '</span><div class="input-wrap"><span class="input-lead">' + getData().settings.currency.symbol + "</span>" +
      '<input id="txAmount" type="number" step="any" min="0" placeholder="' + t("form.amountPh") + '" value="' + (tx ? tx.amount : "") + '" data-autofocus required></div></div>' +
      '<div class="field"><span>' + t("form.category") + '</span><div class="chip-grid" id="txCats"></div></div>' +
      '<div class="form-grid">' +
      '<label class="field"><span>' + t("form.date") + '</span><div class="input-wrap"><input id="txDate" type="date" value="' + (tx ? tx.date : todayISO()) + '" required></div></label>' +
      '<label class="field"><span>' + t("form.method") + '</span><select id="txMethod" class="sel" style="width:100%">' +
      METHODS.map(m => '<option value="' + m.id + '"' + ((tx ? tx.method : "cash") === m.id ? " selected" : "") + ">" + m.icon + " " + esc(t("method." + m.id)) + "</option>").join("") + "</select></label></div>" +
      '<div class="form-grid">' +
      '<label class="field"><span>' + t("form.paidBy") + '</span><select id="txBy" class="sel" style="width:100%">' +
      users.map(u => '<option value="' + u.id + '"' + ((tx ? tx.by : currentUser().id) === u.id ? " selected" : "") + ">" + esc(u.name) + "</option>").join("") + "</select></label>" +
      '<label class="field"><span>' + t("form.note") + '</span><div class="input-wrap"><input id="txNote" type="text" maxlength="120" placeholder="' + t("form.notePh") + '" value="' + (tx ? esc(tx.note) : "") + '"></div></label></div>' +
      '<div class="modal-foot">' +
      (isEdit ? '<button type="button" class="btn btn-danger-ghost" id="txDelete" data-id="' + tx.id + '">🗑 ' + t("common.delete") + "</button>" : "") +
      '<button type="button" class="btn btn-ghost" data-action="modal-close">' + t("common.cancel") + "</button>" +
      '<button type="submit" class="btn btn-primary">' + t("common.save") + "</button></div></form>",
    onMount(ov) {
      let curType = type;
      let curCat = tx ? tx.category : "";
      const catBox = ov.querySelector("#txCats");

      function drawCats() {
        catBox.innerHTML = CATEGORIES[curType].map(c =>
          '<button type="button" class="chip ' + (curCat === c.id ? "active" : "") + '" data-c="' + c.id + '"><span class="ch-ico">' + c.icon + "</span>" + esc(t("cat." + c.id)) + "</button>"
        ).join("");
      }
      drawCats();
      catBox.addEventListener("click", e => {
        const ch = e.target.closest(".chip");
        if (!ch) return;
        curCat = ch.getAttribute("data-c");
        catBox.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
        ch.classList.add("active");
      });
      ov.querySelectorAll(".type-btn").forEach(b => b.addEventListener("click", () => {
        curType = b.getAttribute("data-t");
        ov.querySelectorAll(".type-btn").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        curCat = "";
        drawCats();
      }));

      const del = ov.querySelector("#txDelete");
      if (del) del.addEventListener("click", () => {
        confirmModal({
          danger: true, icon: "🗑", text: t("modal.deleteTx"), confirmLabel: t("common.delete"),
          onConfirm() { deleteTx(del.getAttribute("data-id")); closeAllModals(); toast(t("toast.deleted"), "info"); commit(); }
        });
      });

      ov.querySelector("#txForm").addEventListener("submit", e => {
        e.preventDefault();
        const amount = parseFloat(ov.querySelector("#txAmount").value);
        if (!(amount > 0)) { toast(t("toast.badAmount"), "error"); return; }
        if (!curCat) { toast(t("toast.fillFields"), "error"); return; }
        const payload = {
          type: curType, category: curCat, amount: Math.round(amount * 100) / 100,
          date: ov.querySelector("#txDate").value || todayISO(),
          method: ov.querySelector("#txMethod").value,
          by: ov.querySelector("#txBy").value,
          note: ov.querySelector("#txNote").value.trim()
        };
        if (isEdit) updateTx(tx.id, payload); else addTx(payload);
        closeAllModals();
        toast(t("toast.saved"), "success");
        commit();
      });
    }
  });
}

/* ─────────── Budget modal ─────────── */
function openBudgetModal(budget) {
  const isEdit = !!budget;
  const taken = getData().budgets.map(b => b.category).filter(c => !isEdit || c !== budget.category);
  const avail = CATEGORIES.expense.filter(c => !taken.includes(c.id));
  if (!isEdit && !avail.length) { toast(t("budget.exists"), "error"); return; }
  openModal({
    title: t(isEdit ? "budget.editTitle" : "budget.addTitle"),
    body:
      '<form id="budgetForm">' +
      '<label class="field"><span>' + t("form.category") + '</span><select id="bCat" class="sel" style="width:100%" ' + (isEdit ? "disabled" : "") + ">" +
      (isEdit
        ? (() => { const c = catById(budget.category); return '<option value="' + c.id + '">' + c.icon + " " + esc(t("cat." + c.id)) + "</option>"; })()
        : avail.map(c => '<option value="' + c.id + '">' + c.icon + " " + esc(t("cat." + c.id)) + "</option>").join("")
      ) + "</select></label>" +
      '<label class="field"><span>' + t("budget.limit") + '</span><div class="input-wrap"><span class="input-lead">' + getData().settings.currency.symbol + "</span>" +
      '<input id="bLimit" type="number" step="any" min="1" value="' + (isEdit ? budget.limit : "") + '" data-autofocus required></div></label>' +
      '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-action="modal-close">' + t("common.cancel") + "</button>" +
      '<button type="submit" class="btn btn-primary">' + t("common.save") + "</button></div></form>",
    onMount(ov) {
      ov.querySelector("#budgetForm").addEventListener("submit", e => {
        e.preventDefault();
        const limit = parseFloat(ov.querySelector("#bLimit").value);
        if (!(limit > 0)) { toast(t("toast.badAmount"), "error"); return; }
        if (isEdit) updateBudget(budget.id, { limit: Math.round(limit) });
        else addBudget(ov.querySelector("#bCat").value, Math.round(limit));
        closeAllModals();
        toast(t("toast.saved"), "success");
        commit();
      });
    }
  });
}

/* ─────────── Goal modals ─────────── */
const GOAL_ICONS = ["🛟", "🎉", "💻", "🏠", "🚗", "✈️", "🎓", "💍", "👶", "🕌", "📱", "🏝️", "🚲", "🪙"];
function openGoalModal(goal) {
  const isEdit = !!goal;
  openModal({
    title: t(isEdit ? "goals.editTitle" : "goals.addTitle"),
    body:
      '<form id="goalForm">' +
      '<label class="field"><span>' + t("goals.name") + '</span><div class="input-wrap"><input id="gName" type="text" maxlength="50" placeholder="' + t("goals.namePh") + '" value="' + (goal ? esc(goal.name) : "") + '" data-autofocus required></div></label>' +
      '<div class="field"><span>Icon</span><div class="chip-grid" id="gIcons">' +
      GOAL_ICONS.map(ic => '<button type="button" class="chip ' + ((goal ? goal.icon : "🛟") === ic ? "active" : "") + '" data-i="' + ic + '"><span class="ch-ico">' + ic + "</span></button>").join("") + "</div></div>" +
      '<div class="form-grid">' +
      '<label class="field"><span>' + t("goals.targetAmt") + '</span><div class="input-wrap"><span class="input-lead">' + getData().settings.currency.symbol + '</span><input id="gTarget" type="number" step="any" min="1" value="' + (goal ? goal.target : "") + '" required></div></label>' +
      '<label class="field"><span>' + t("goals.alreadySaved") + '</span><div class="input-wrap"><span class="input-lead">' + getData().settings.currency.symbol + '</span><input id="gSaved" type="number" step="any" min="0" value="' + (goal ? goal.saved : 0) + '"></div></label></div>' +
      '<div class="form-grid">' +
      '<label class="field"><span>' + t("goals.deadline") + '</span><div class="input-wrap"><input id="gDeadline" type="date" value="' + (goal && goal.deadline ? goal.deadline : "") + '"></div></label>' +
      '<label class="field"><span>' + t("form.note") + '</span><div class="input-wrap"><input id="gNote" type="text" maxlength="120" value="' + (goal ? esc(goal.note || "") : "") + '"></div></label></div>' +
      '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-action="modal-close">' + t("common.cancel") + "</button>" +
      '<button type="submit" class="btn btn-primary">' + t("common.save") + "</button></div></form>",
    onMount(ov) {
      let icon = goal ? goal.icon : "🛟";
      ov.querySelector("#gIcons").addEventListener("click", e => {
        const ch = e.target.closest(".chip");
        if (!ch) return;
        icon = ch.getAttribute("data-i");
        ov.querySelectorAll("#gIcons .chip").forEach(x => x.classList.remove("active"));
        ch.classList.add("active");
      });
      ov.querySelector("#goalForm").addEventListener("submit", e => {
        e.preventDefault();
        const name = ov.querySelector("#gName").value.trim();
        const target = parseFloat(ov.querySelector("#gTarget").value);
        const saved = parseFloat(ov.querySelector("#gSaved").value) || 0;
        if (!name || !(target > 0)) { toast(t("toast.fillFields"), "error"); return; }
        const payload = {
          name, icon, target: Math.round(target), saved: Math.max(0, Math.round(saved)),
          deadline: ov.querySelector("#gDeadline").value || "",
          note: ov.querySelector("#gNote").value.trim()
        };
        if (isEdit) updateGoal(goal.id, payload); else addGoal(payload);
        closeAllModals();
        toast(t("toast.saved"), "success");
        commit();
      });
    }
  });
}
function openContributeModal(goal) {
  openModal({
    title: t("modal.contribution", { name: esc(goal.name) }),
    body:
      '<form id="conForm">' +
      '<div class="goal-nums" style="margin-bottom:14px"><b>' + fmtMoney(goal.saved) + "</b><span>" + t("goals.of", { v: fmtMoney(goal.target) }) + "</span></div>" +
      progressHTML(goal.target ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0, "ok") +
      '<label class="field" style="margin-top:16px"><span>' + t("goals.amount") + '</span><div class="input-wrap"><span class="input-lead">' + getData().settings.currency.symbol + "</span>" +
      '<input id="conAmt" type="number" step="any" min="0" data-autofocus required></div></label>' +
      '<div class="modal-foot"><button type="button" class="btn btn-soft-red" id="conSub">' + t("goals.withdraw") + "</button>" +
      '<button type="submit" class="btn btn-primary">' + t("goals.addMoney") + "</button></div></form>",
    onMount(ov) {
      ov.querySelector("#conSub").addEventListener("click", () => {
        const v = parseFloat(ov.querySelector("#conAmt").value);
        if (!(v > 0)) { toast(t("toast.badAmount"), "error"); return; }
        updateGoal(goal.id, { saved: Math.max(0, goal.saved - Math.round(v)) });
        closeAllModals(); toast(t("toast.contribution"), "success"); commit();
      });
      ov.querySelector("#conForm").addEventListener("submit", e => {
        e.preventDefault();
        const v = parseFloat(ov.querySelector("#conAmt").value);
        if (!(v > 0)) { toast(t("toast.badAmount"), "error"); return; }
        const newSaved = goal.saved + Math.round(v);
        updateGoal(goal.id, { saved: newSaved });
        closeAllModals();
        if (newSaved >= goal.target) toast(t("toast.goalDone"), "success");
        else toast(t("toast.contribution"), "success");
        commit();
      });
    }
  });
}

/* ─────────── Profile & PIN modals ─────────── */
const PROFILE_COLORS = ["#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#06b6d4", "#f43f5e"];
function openProfileModal(user) {
  openModal({
    title: t("settings.profileTitle"),
    body:
      '<form id="profForm">' +
      '<label class="field"><span>' + t("common.name") + '</span><div class="input-wrap"><input id="pName" type="text" maxlength="30" value="' + esc(user.name) + '" data-autofocus required></div></label>' +
      '<label class="field"><span>' + t("settings.gmail") + ' (login)</span><div class="input-wrap"><span class="input-lead">✉️</span><input id="pEmail" type="email" value="' + esc(user.email) + '" required></div></label>' +
      '<label class="field"><span>' + t("settings.mobile") + ' (login)</span><div class="input-wrap"><span class="input-lead">📱</span><input id="pMobile" type="tel" value="' + esc(user.mobile) + '" required></div></label>' +
      '<div class="field"><span>Avatar color</span><div class="chip-grid" id="pColors">' +
      PROFILE_COLORS.map(c => '<button type="button" class="chip ' + (user.color === c ? "active" : "") + '" data-c="' + c + '" style="justify-content:center"><span class="ch-ico" style="font-size:16px;color:' + c + '">●</span></button>').join("") + "</div></div>" +
      '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-action="modal-close">' + t("common.cancel") + "</button>" +
      '<button type="submit" class="btn btn-primary">' + t("common.save") + "</button></div></form>",
    onMount(ov) {
      let color = user.color;
      ov.querySelector("#pColors").addEventListener("click", e => {
        const ch = e.target.closest(".chip");
        if (!ch) return;
        color = ch.getAttribute("data-c");
        ov.querySelectorAll("#pColors .chip").forEach(x => x.classList.remove("active"));
        ch.classList.add("active");
      });
      ov.querySelector("#profForm").addEventListener("submit", e => {
        e.preventDefault();
        const name = ov.querySelector("#pName").value.trim();
        const email = ov.querySelector("#pEmail").value.trim();
        const mobile = ov.querySelector("#pMobile").value.trim();
        if (!name || !email || !mobile) { toast(t("toast.fillFields"), "error"); return; }
        updateUser(user.id, { name, email, mobile, color });
        closeAllModals();
        toast(t("toast.profileSaved"), "success");
        renderUserChrome(); commit();
      });
    }
  });
}
function openPinModal(user) {
  openModal({
    title: t("settings.pinTitle") + " — " + esc(user.name),
    body:
      '<form id="cpForm">' +
      '<label class="field"><span>' + t("settings.currentPin") + '</span><div class="input-wrap"><input id="cpOld" type="password" inputmode="numeric" maxlength="6" data-autofocus required></div></label>' +
      '<label class="field"><span>' + t("settings.newPin") + '</span><div class="input-wrap"><input id="cpNew" type="password" inputmode="numeric" maxlength="6" required></div></label>' +
      '<label class="field"><span>' + t("settings.confirmPin") + '</span><div class="input-wrap"><input id="cpNew2" type="password" inputmode="numeric" maxlength="6" required></div></label>' +
      '<div class="modal-foot"><button type="button" class="btn btn-ghost" data-action="modal-close">' + t("common.cancel") + "</button>" +
      '<button type="submit" class="btn btn-primary">' + t("common.save") + "</button></div></form>",
    onMount(ov) {
      ov.querySelector("#cpForm").addEventListener("submit", e => {
        e.preventDefault();
        const old = ov.querySelector("#cpOld").value.trim();
        const nw = ov.querySelector("#cpNew").value.trim();
        const nw2 = ov.querySelector("#cpNew2").value.trim();
        if (String(user.pin) !== old) { toast(t("toast.pinWrong"), "error"); return; }
        if (!/^\d{4,6}$/.test(nw)) { toast(t("toast.fillFields"), "error"); return; }
        if (nw !== nw2) { toast(t("toast.pinMismatch"), "error"); return; }
        updateUser(user.id, { pin: nw });
        closeAllModals();
        toast(t("toast.pinChanged"), "success");
        renderDemoHint();
      });
    }
  });
}

/* ─────────── Sidebar (mobile) ─────────── */
function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebarBackdrop").classList.add("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarBackdrop").classList.remove("show");
}

/* ─────────── Data actions ─────────── */
function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importJSON(reader.result);
      const d = getData();
      setLang(d.settings.language === "bn" ? "bn" : "en");
      applyTheme(d.settings.theme === "light" ? "light" : "dark");
      applyI18n(document);
      renderUserChrome(); renderCurrentPage(); renderDemoHint();
      toast(t("toast.imported"), "success");
    } catch (err) { toast(t("toast.importBad"), "error"); }
  };
  reader.readAsText(file);
}

/* ─────────── Global action dispatch ─────────── */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  /* avatar dropdown: toggle on its button, close on any other click */
  const wrap = document.getElementById("avatarWrap");
  if (wrap) {
    if (el && el.getAttribute("data-action") === "avatar-menu") wrap.classList.toggle("open");
    else wrap.classList.remove("open");
  }
  if (!el) return;
  const act = el.getAttribute("data-action");
  const id = el.getAttribute("data-id");

  switch (act) {
    case "nav": case "goto": navigate(el.getAttribute("data-page")); break;
    case "open-sidebar": openSidebar(); break;
    case "close-sidebar": closeSidebar(); break;
    case "modal-close": closeTopModal(); break;

    case "lang-toggle": { const d = getData(); applyLanguage(d.settings.language === "bn" ? "en" : "bn"); break; }
    case "theme-toggle": { const d = getData(); const th = d.settings.theme === "dark" ? "light" : "dark"; d.settings.theme = th; saveData(); applyTheme(th); break; }
    case "set-theme": { const th = el.getAttribute("data-val"); getData().settings.theme = th; saveData(); applyTheme(th); renderSettings(); break; }
    case "set-lang": applyLanguage(el.getAttribute("data-val")); renderSettings(); break;
    case "toggle-pin": {
      const inp = document.getElementById("loginPin");
      if (inp) inp.type = inp.type === "password" ? "text" : "password";
      break;
    }

    case "login": break; /* handled by form submit */
    case "google-login": googleModal(); break;
    case "logout": logout(); break;
    case "switch-user": {
      const other = getData().users.find(u => u.id !== getSession());
      if (other) {
        closeAllModals();
        pinModal(other, () => {
          setSession(other.id);
          renderUserChrome();
          renderCurrentPage();
          toast(t("toast.switched", { name: esc(other.name) }), "success");
        });
      }
      break;
    }

    case "add-tx": openTxModal(null, "expense"); break;
    case "add-income": openTxModal(null, "income"); break;
    case "add-expense": openTxModal(null, "expense"); break;
    case "edit-tx": openTxModal(getData().transactions.find(x => x.id === id)); break;

    case "add-budget": openBudgetModal(null); break;
    case "edit-budget": openBudgetModal(getData().budgets.find(x => x.id === id)); break;
    case "del-budget":
      confirmModal({ danger: true, icon: "🗑", text: t("modal.deleteBudget"), confirmLabel: t("common.delete"), onConfirm() { deleteBudget(id); toast(t("toast.deleted"), "info"); commit(); } });
      break;

    case "add-goal": openGoalModal(null); break;
    case "edit-goal": openGoalModal(getData().goals.find(x => x.id === id)); break;
    case "del-goal":
      confirmModal({ danger: true, icon: "🗑", text: t("modal.deleteGoal"), confirmLabel: t("common.delete"), onConfirm() { deleteGoal(id); toast(t("toast.deleted"), "info"); commit(); } });
      break;
    case "contribute-goal": openContributeModal(getData().goals.find(x => x.id === id)); break;

    case "edit-profile": openProfileModal(userById(id)); break;
    case "change-pin": openPinModal(userById(id)); break;

    case "report-user": REPORT.userId = id; renderReports(); break;

    case "tx-clear":
      TXF.search = ""; TXF.type = ""; TXF.category = ""; TXF.userId = ""; TXF.method = ""; TXF.from = ""; TXF.to = "";
      ["txSearch", "txType", "txCategory", "txMember", "txMethod", "txFrom", "txTo"].forEach(i => { const n = document.getElementById(i); if (n) n.value = ""; });
      renderTransactions();
      break;

    case "export-json": exportJSON(); toast(t("toast.exported"), "success"); break;
    case "export-csv": exportCSV(); toast(t("toast.exported"), "success"); break;
    case "report-export-csv": exportCSV(REPORT.ym, REPORT.userId || undefined); toast(t("reports.exported"), "success"); break;
    case "import-json": document.getElementById("importFile").click(); break;
    case "load-demo":
      confirmModal({ icon: "🎲", text: t("modal.loadDemo"), onConfirm() { loadDemoData(); renderUserChrome(); renderCurrentPage(); renderDemoHint(); toast(t("toast.demoLoaded"), "success"); } });
      break;
    case "clear-all":
      confirmModal({
        danger: true, icon: "🧹", text: t("modal.clearAll"), confirmLabel: t("settings.clearAll"),
        onConfirm() { clearAllData(); renderUserChrome(); renderCurrentPage(); renderDemoHint(); toast(t("toast.cleared"), "info"); }
      });
      break;
  }
});

/* ─────────── Inputs (change / input events) ─────────── */
document.addEventListener("change", e => {
  const id = e.target.id;
  if (id === "txType") { TXF.type = e.target.value; renderTransactions(); }
  else if (id === "txCategory") { TXF.category = e.target.value; renderTransactions(); }
  else if (id === "txMember") { TXF.userId = e.target.value; renderTransactions(); }
  else if (id === "txMethod") { TXF.method = e.target.value; renderTransactions(); }
  else if (id === "txFrom") { TXF.from = e.target.value; renderTransactions(); }
  else if (id === "txTo") { TXF.to = e.target.value; renderTransactions(); }
  else if (id === "reportMonth") { REPORT.ym = e.target.value || curYM(); renderReports(); }
  else if (id === "familyNameInput") {
    getData().settings.familyName = e.target.value.trim() || "Alpha Family";
    saveData(); document.getElementById("sideFamily").textContent = getData().settings.familyName;
    toast(t("toast.saved"), "success");
  }
  else if (id === "currencySelect") {
    const c = CURRENCIES.find(x => x.code === e.target.value);
    if (c) { getData().settings.currency = c; saveData(); toast(t("toast.saved"), "success"); renderCurrentPage(); }
  }
  else if (id === "importFile") {
    if (e.target.files && e.target.files[0]) handleImportFile(e.target.files[0]);
    e.target.value = "";
  }
});

let searchTimer = null;
document.addEventListener("input", e => {
  if (e.target.id === "txSearch") {
    TXF.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderTransactions, 160);
  }
});

/* keyboard: Esc closes top modal */
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    const root = document.getElementById("modalRoot");
    if (root.lastElementChild) closeTopModal();
  }
});

/* re-render charts on resize */
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (CURRENT_PAGE === "dashboard" || CURRENT_PAGE === "reports") renderCurrentPage();
  }, 280);
});

/* ─────────── Boot ─────────── */
function setFavicon() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><text x="32" y="43" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">৳</text></svg>';
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  document.head.appendChild(link);
}

document.addEventListener("DOMContentLoaded", () => {
  const d = loadData();
  setFavicon();
  setLang(d.settings.language === "bn" ? "bn" : "en");
  applyTheme(d.settings.theme === "light" ? "light" : "dark");
  applyI18n(document);
  document.querySelectorAll(".lang-label").forEach(el => el.textContent = d.settings.language === "bn" ? "বাং" : "EN");
  initTooltip();
  renderDemoHint();

  document.getElementById("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    doLogin(document.getElementById("loginIdentifier").value, document.getElementById("loginPin").value);
  });

  if (getSession()) enterApp();
});
