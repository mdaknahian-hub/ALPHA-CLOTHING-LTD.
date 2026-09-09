/* ═══════════════════════════════════════════════
   pages.js — page renderers
   ═══════════════════════════════════════════════ */

/* ─── Shared UI helpers ─── */
function initialsOf(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] ? w[0].toUpperCase() : "").join("") || "?";
}
function userById(id) { return getData().users.find(u => u.id === id) || getData().users[0]; }
function avatarHTML(user, cls) {
  const u = typeof user === "string" ? userById(user) : user;
  const c = u && u.color ? u.color : "#6366f1";
  return '<span class="' + (cls || "avatar-sm") + '" style="background:linear-gradient(135deg,' + c + "," + shade(c, 35) + ')">' + esc(initialsOf(u && u.name)) + "</span>";
}
function shade(hex, amt) {
  try {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + amt), g = Math.min(255, ((n >> 8) & 255) + amt), b = Math.min(255, (n & 255) + amt);
    return "rgb(" + r + "," + g + "," + b + ")";
  } catch (e) { return hex; }
}
function progressHTML(pct, state) {
  const cls = state === "over" ? "p-red" : state === "warn" ? "p-amber" : "";
  return '<div class="progress"><i class="' + cls + '" style="width:' + Math.min(100, pct) + '%"></i></div>';
}
function emptyHTML(icon, title, hint, btnHTML) {
  return '<div class="empty"><div class="em-ico">' + icon + "</div><b>" + esc(title) + "</b><p>" + esc(hint) + "</p>" + (btnHTML || "") + "</div>";
}
function txRowHTML(x) {
  const cat = catById(x.category);
  const user = userById(x.by);
  const isInc = x.type === "income";
  const m = methodById(x.method);
  const sign = isInc ? "+" : "−";
  return '<button class="tx-row" data-action="edit-tx" data-id="' + x.id + '">' +
    '<span class="tx-ico">' + cat.icon + "</span>" +
    '<span class="tx-info"><span class="tx-cat">' + esc(t("cat." + x.category)) + "</span>" +
    (x.note ? '<span class="tx-note">' + esc(x.note) + "</span>" : "") +
    '<span class="tx-meta"><span class="method-chip">' + m.icon + " " + esc(t("method." + x.method)) + "</span></span></span>" +
    avatarHTML(user) +
    '<span class="tx-right"><span class="tx-amount ' + (isInc ? "c-green" : "c-red") + '">' + sign + " " + fmtMoney(x.amount, { noSymbol: true }) + "</span>" +
    '<span class="tx-time">' + fmtDate(x.date) + " · " + esc(user.name) + "</span></span></button>";
}
/** set % delta (vs previous month) into a stat card's delta element */
function setDelta(elId, cur, prev, goodWhenUp) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!prev && cur) { el.className = "delta up"; el.textContent = "🆕"; return; }
  if (!prev && !cur) { el.className = "delta flat"; el.textContent = "—"; return; }
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  if (!pct) { el.className = "delta flat"; el.textContent = "0%"; return; }
  const up = pct > 0;
  const good = goodWhenUp ? up : !up;
  el.className = "delta " + (good ? "up" : "down");
  el.textContent = (up ? "▲" : "▼") + " " + locDigits(Math.abs(pct)) + "%";
}

/* ═══════════ DASHBOARD ═══════════ */
function renderDashboard() {
  const d = getData();
  const me = userById(getSession() || "u1");
  const h = new Date().getHours();
  const greetKey = h < 12 ? "hi.morning" : h < 17 ? "hi.afternoon" : h < 21 ? "hi.evening" : "hi.night";
  document.getElementById("dashGreeting").textContent = t(greetKey) + ", " + me.name + "!";
  document.getElementById("dashDate").textContent = fmtWeekday(todayISO()) + ", " + fmtDate(todayISO(), "long");

  /* stats */
  const ym = curYM();
  const prevYM = (() => { const dt = new Date(); dt.setMonth(dt.getMonth() - 1); return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1); })();
  const cur = monthTotals(ym), prev = monthTotals(prevYM);
  const allT = totals(d.transactions);
  const balance = allT.income - allT.expense;

  document.getElementById("statBalance").textContent = fmtMoney(balance);
  const net = cur.income - cur.expense;
  const bd = document.getElementById("statBalanceDelta");
  bd.className = "delta " + (net >= 0 ? "up" : "down");
  bd.textContent = (net >= 0 ? "▲ " : "▼ ") + fmtMoney(Math.abs(net)) + " · " + monthLabel(ym, "short");

  document.getElementById("statIncome").textContent = fmtMoney(cur.income);
  setDelta("statIncomeDelta", cur.income, prev.income, true);
  document.getElementById("statExpense").textContent = fmtMoney(cur.expense);
  setDelta("statExpenseDelta", cur.expense, prev.expense, false);
  document.getElementById("statSavings").textContent = fmtMoney(net);
  const sv = document.getElementById("statSavingsDelta");
  sv.className = "delta " + (net >= 0 ? "up" : "down");
  sv.textContent = (net >= 0 ? "📈 " : "📉 ") + (cur.income > 0 ? locDigits(Math.round((net / cur.income) * 100)) + "% " + t("reports.savingsRate") : "—");

  /* charts */
  renderGroupedBars(document.getElementById("dashBar"), lastMonths(6, ym));
  const catExp = byCategory(filterTxs({ ym, type: "expense" }), "expense");
  renderDonut(document.getElementById("dashDonut"),
    catExp.map(c => ({ label: t("cat." + c.category), value: c.total, color: catColor(c.category), icon: catById(c.category).icon })),
    { centerSub: t("chart.total") });

  /* budgets snapshot */
  const bp = budgetProgress();
  document.getElementById("dashBudgets").innerHTML = bp.length
    ? bp.slice(0, 4).map(b => {
        const c = catById(b.category);
        return '<div style="margin-bottom:13px">' +
          '<div style="display:flex;justify-content:space-between;font-size:12.8px;margin-bottom:6px"><b>' + c.icon + " " + esc(t("cat." + b.category)) + '</b><span style="color:var(--muted);font-weight:700">' + fmtMoney(b.spent, { noSymbol: true }) + " / " + fmtMoney(b.limit, { noSymbol: true }) + "</span></div>" +
          progressHTML(b.pct, b.state) + "</div>";
      }).join("")
    : emptyHTML("🎯", t("dash.noBudgets"), t("dash.noBudgetsHint"), '<button class="btn btn-soft-green btn-sm" data-action="goto" data-page="budget">' + t("dash.viewAll") + " →</button>");

  /* recent transactions */
  const recent = filterTxs({}).slice(0, 6);
  document.getElementById("dashRecent").innerHTML = recent.length
    ? '<div class="tx-list">' + recent.map(txRowHTML).join("") + "</div>"
    : emptyHTML("🧾", t("dash.noTx"), t("dash.noTxHint"), '<button class="btn btn-primary btn-sm" data-action="add-tx">' + t("tx.addFirst") + "</button>");

  /* goals snapshot */
  const goals = d.goals.slice().sort((a, b) => (b.saved / (b.target || 1)) - (a.saved / (a.target || 1)));
  document.getElementById("dashGoals").innerHTML = goals.length
    ? goals.slice(0, 3).map(g => {
        const pct = g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
        return '<div style="margin-bottom:13px"><div style="display:flex;justify-content:space-between;font-size:12.8px;margin-bottom:6px"><b>' + g.icon + " " + esc(g.name) + '</b><span style="color:var(--muted);font-weight:700">' + locDigits(pct) + '%</span></div>' +
          progressHTML(pct, pct >= 100 ? "ok" : pct >= 60 ? "ok" : "") +
          '<div style="font-size:11.5px;color:var(--muted);margin-top:5px;font-weight:600">' + fmtMoney(g.saved) + " " + t("goals.of", { v: fmtMoney(g.target) }) + "</div></div>";
      }).join("")
    : emptyHTML("🏆", t("dash.noGoals"), t("dash.noGoalsHint"), '<button class="btn btn-soft-green btn-sm" data-action="goto" data-page="goals">' + t("dash.viewAll") + " →</button>");

  /* members this month */
  document.getElementById("dashMembers").innerHTML =
    '<div class="member-row">' + d.users.map(u => {
      const tt = monthTotals(ym, u.id);
      return avatarHTML(u) +
        '<span class="member-info"><b>' + esc(u.name) + (u.id === me.id ? " · " + t("settings.you") : "") + "</b><span>" + esc(u.email) + "</span></span>" +
        '<span class="member-nums"><span class="c-green">+' + fmtMoney(tt.income, { noSymbol: true }) + '</span><span class="c-red">−' + fmtMoney(tt.expense, { noSymbol: true }) + "</span></span>";
    }).join("</div><div class=\"member-row\">") + "</div>" +
    '<p class="hint" style="margin-top:10px">' + t("dash.membersNote") + "</p>";
}

/* ═══════════ TRANSACTIONS ═══════════ */
const TXF = { search: "", type: "", category: "", userId: "", method: "", from: "", to: "" };

function populateTxFilters() {
  const catSel = document.getElementById("txCategory");
  const memSel = document.getElementById("txMember");
  const mSel = document.getElementById("txMethod");
  const keepC = catSel.value, keepM = memSel.value, keepMe = mSel.value;
  catSel.innerHTML = '<option value="">' + esc(t("tx.allCategories")) + "</option>" +
    '<optgroup label="' + esc(t("common.income")) + '">' + CATEGORIES.income.map(c => '<option value="' + c.id + '">' + c.icon + " " + esc(t("cat." + c.id)) + "</option>").join("") + "</optgroup>" +
    '<optgroup label="' + esc(t("common.expense")) + '">' + CATEGORIES.expense.map(c => '<option value="' + c.id + '">' + c.icon + " " + esc(t("cat." + c.id)) + "</option>").join("") + "</optgroup>";
  memSel.innerHTML = '<option value="">' + esc(t("tx.allMembers")) + "</option>" + getData().users.map(u => '<option value="' + u.id + '">' + esc(u.name) + "</option>").join("");
  mSel.innerHTML = '<option value="">' + esc(t("tx.allMethods")) + "</option>" + METHODS.map(m => '<option value="' + m.id + '">' + m.icon + " " + esc(t("method." + m.id)) + "</option>").join("");
  catSel.value = keepC; memSel.value = keepM; mSel.value = keepMe;
  const s = document.getElementById("txSearch"); if (s && document.activeElement !== s) s.value = TXF.search;
}

function renderTransactions() {
  populateTxFilters();
  const list = filterTxs(TXF);
  const tt = totals(list);

  document.getElementById("txSummary").innerHTML =
    '<span class="tx-pill">' + t("tx.count", { n: locDigits(list.length) }) + "</span>" +
    '<span class="tx-pill c-green">' + t("tx.totalIn", { v: fmtMoney(tt.income) }) + "</span>" +
    '<span class="tx-pill c-red">' + t("tx.totalOut", { v: fmtMoney(tt.expense) }) + "</span>";

  const box = document.getElementById("txList");
  if (!list.length) {
    box.innerHTML = emptyHTML("🔍", t("tx.empty"), t("tx.emptyHint"), '<button class="btn btn-primary btn-sm" data-action="add-tx">' + t("tx.addFirst") + "</button>");
    return;
  }
  /* group by date */
  const groups = {};
  list.forEach(x => { (groups[x.date] = groups[x.date] || []).push(x); });
  const dates = Object.keys(groups).sort().reverse();
  const today = todayISO();
  const yest = isoOf(new Date(Date.now() - 86400000));
  box.innerHTML = dates.map(dt => {
    const g = groups[dt];
    const gT = totals(g);
    const label = dt === today ? t("common.today") : dt === yest ? t("common.yesterday") : fmtWeekday(dt) + ", " + fmtDate(dt);
    return '<div class="date-group"><div class="date-group-head"><span>' + esc(label) + "</span><span>" +
      (gT.income ? '<span class="c-green">+' + fmtMoney(gT.income, { noSymbol: true }) + "</span> " : "") +
      (gT.expense ? '<span class="c-red">−' + fmtMoney(gT.expense, { noSymbol: true }) + "</span>" : "") +
      "</span></div><div class=\"tx-list\">" + g.map(txRowHTML).join("") + "</div></div>";
  }).join("");
}

/* ═══════════ BUDGET ═══════════ */
function renderBudget() {
  const d = getData();
  const bp = budgetProgress();
  /* overall card */
  const totalLimit = bp.reduce((s, b) => s + b.limit, 0);
  const totalSpent = bp.reduce((s, b) => s + b.spent, 0);
  const pct = totalLimit ? Math.min(999, Math.round((totalSpent / totalLimit) * 100)) : 0;
  document.getElementById("budgetOverall").innerHTML =
    '<div class="card overall-card"><div class="oc-row"><h4>🎯 ' + esc(t("budget.overallTitle")) + " — " + monthLabel(curYM()) + '</h4><span class="oc-nums">' +
    t("budget.totalSpent") + ': <b>' + fmtMoney(totalSpent) + "</b> / " + fmtMoney(totalLimit) + "</span></div>" + progressHTML(pct, pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok") +
    '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12.5px;font-weight:700;color:var(--muted)">' +
    "<span>" + t("budget.spent") + ": <b style='color:var(--text)'>" + fmtMoney(totalSpent) + "</b></span>" +
    "<span>" + t("budget.remaining") + ": <b style='color:var(--text)'>" + fmtMoney(Math.max(0, totalLimit - totalSpent)) + "</b></span></div></div>";

  const grid = document.getElementById("budgetGrid");
  if (!bp.length) {
    grid.innerHTML = emptyHTML("🎯", t("budget.empty"), t("budget.emptyHint"), '<button class="btn btn-primary btn-sm" data-action="add-budget">' + t("budget.add") + "</button>");
    return;
  }
  grid.innerHTML = bp.map(b => {
    const c = catById(b.category);
    const badge = b.state === "over" ? '<span class="badge badge-over">' + t("budget.over") + "</span>"
      : b.state === "warn" ? '<span class="badge badge-warn">' + t("budget.nearing") + "</span>"
      : '<span class="badge badge-ok">' + locDigits(b.pct) + "%</span>";
    const foot = b.spent > b.limit
      ? '<span class="c-red">' + t("budget.overBy", { v: fmtMoney(b.spent - b.limit) }) + "</span>"
      : "<span>" + t("budget.left", { v: fmtMoney(b.limit - b.spent) }) + "</span>";
    return '<div class="budget-card"><div class="bc-head"><span class="tx-ico">' + c.icon + "</span>" +
      '<span style="flex:1;min-width:0"><span class="bc-name">' + esc(t("cat." + b.category)) + '</span><br><span class="bc-limit">' + fmtMoney(b.limit) + "</span></span>" + badge + "</div>" +
      progressHTML(b.pct, b.state) +
      '<div class="bc-foot"><span>' + t("budget.spent") + ": " + fmtMoney(b.spent) + "</span>" + foot + "</div>" +
      '<div style="display:flex;gap:7px;margin-top:12px"><button class="btn btn-ghost btn-sm" style="flex:1" data-action="edit-budget" data-id="' + b.id + '">✏️ ' + t("common.edit") + "</button>" +
      '<button class="mini-btn del" data-action="del-budget" data-id="' + b.id + '" title="' + t("common.delete") + '">🗑</button></div></div>';
  }).join("");
}

/* ═══════════ GOALS ═══════════ */
function goalDaysInfo(g) {
  if (!g.deadline) return t("goals.noDeadline");
  const diff = daysBetween(todayISO(), g.deadline);
  if (diff > 0) return t("goals.daysLeft", { n: locDigits(diff) });
  if (diff === 0) return "⏰ " + t("common.today");
  return "⚠️ " + t("goals.overdue", { n: locDigits(-diff) });
}
function renderGoals() {
  const d = getData();
  const totalSaved = d.goals.reduce((s, g) => s + (Number(g.saved) || 0), 0);
  const totalTarget = d.goals.reduce((s, g) => s + (Number(g.target) || 0), 0);
  document.getElementById("goalsSummary").innerHTML = d.goals.length
    ? '<div class="card overall-card"><div class="oc-row"><h4>🏦 ' + esc(t("goals.totalSaved")) + '</h4><span class="oc-nums">' +
      "<b>" + fmtMoney(totalSaved) + "</b> / " + fmtMoney(totalTarget) + "</span></div>" +
      progressHTML(totalTarget ? Math.round((totalSaved / totalTarget) * 100) : 0, "ok") + "</div>"
    : "";

  const grid = document.getElementById("goalGrid");
  if (!d.goals.length) {
    grid.innerHTML = emptyHTML("🏆", t("goals.empty"), t("goals.emptyHint"), '<button class="btn btn-primary btn-sm" data-action="add-goal">' + t("goals.add") + "</button>");
    return;
  }
  grid.innerHTML = d.goals.map(g => {
    const pct = g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
    const done = g.target && g.saved >= g.target;
    return '<div class="goal-card"><div class="goal-top"><span class="goal-ico">' + g.icon + '</span>' +
      '<span style="flex:1;min-width:0"><span class="goal-name">' + esc(g.name) + '</span><br><span class="goal-days">' + goalDaysInfo(g) + '</span></span>' +
      (done ? '<span class="badge badge-ok">' + t("goals.reached") + '</span>' : '') + '</div>' +
      '<div class="goal-nums"><b>' + fmtMoney(g.saved) + '</b><span>' + t("goals.of", { v: fmtMoney(g.target) }) + '</span><span class="goal-pct">' + locDigits(pct) + '%</span></div>' +
      progressHTML(pct, "ok") +
      (g.note ? '<p class="hint" style="margin-top:8px">' + esc(g.note) + '</p>' : '') +
      '<div class="goal-actions"><button class="btn btn-primary btn-sm" style="flex:1" data-action="contribute-goal" data-id="' + g.id + '">💰 ' + t("goals.contribute") + '</button>' +
      '<button class="mini-btn" data-action="edit-goal" data-id="' + g.id + '" title="' + t("common.edit") + '">✏️</button>' +
      '<button class="mini-btn del" data-action="del-goal" data-id="' + g.id + '" title="' + t("common.delete") + '">🗑</button></div></div>';
  }).join("");
}

/* ═══════════ REPORTS ═══════════ */
const REPORT = { ym: curYM(), userId: "" };

function renderReports() {
  const d = getData();
  const monthInput = document.getElementById("reportMonth");
  if (monthInput && document.activeElement !== monthInput) monthInput.value = REPORT.ym;

  /* member chips */
  document.getElementById("reportUserChips").innerHTML =
    '<button class="seg-btn ' + (REPORT.userId === "" ? "active" : "") + '" data-action="report-user" data-id="">' + t("reports.allMembers") + "</button>" +
    d.users.map(u => '<button class="seg-btn ' + (REPORT.userId === u.id ? "active" : "") + '" data-action="report-user" data-id="' + u.id + '">' + esc(u.name) + "</button>").join("");

  const list = filterTxs({ ym: REPORT.ym, userId: REPORT.userId || undefined });
  const tt = totals(list);
  const rate = tt.income > 0 ? Math.round(((tt.income - tt.expense) / tt.income) * 100) : 0;

  document.getElementById("reportSummary").innerHTML =
    statCard("📈", "ico-green", t("reports.income"), fmtMoney(tt.income)) +
    statCard("📉", "ico-red", t("reports.expense"), fmtMoney(tt.expense)) +
    statCard("🏦", "ico-blue", t("reports.savings"), fmtMoney(tt.income - tt.expense)) +
    statCard("⚡", "ico-violet", t("reports.savingsRate"), locDigits(rate) + "%");

  const months = lastMonths(6, REPORT.ym, REPORT.userId || undefined);
  renderGroupedBars(document.getElementById("reportTrend"), months);
  renderLine(document.getElementById("reportLine"),
    months.map(m => ({ label: m.label, value: m.savings, tipTitle: m.label })),
    { color: "#8b5cf6", id: "rep" });

  const catExp = byCategory(list, "expense");
  renderDonut(document.getElementById("reportDonut"),
    catExp.map(c => ({ label: t("cat." + c.category), value: c.total, color: catColor(c.category), icon: catById(c.category).icon })),
    { centerSub: t("chart.total") });

  /* daily spending */
  const [y, mo] = REPORT.ym.split("-").map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const daily = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = REPORT.ym + "-" + pad2(day);
    const v = list.filter(x => x.date === iso && x.type === "expense").reduce((s, x) => s + x.amount, 0);
    daily.push({ value: v, label: locDigits(day), showLabel: day === 1 || day % 5 === 0, tipTitle: fmtDate(iso) });
  }
  renderDailyBars(document.getElementById("reportDaily"), daily);

  /* income sources */
  const inc = byCategory(list, "income");
  const maxInc = inc.length ? inc[0].total : 1;
  document.getElementById("reportIncome").innerHTML = inc.length
    ? inc.map(c => {
        const cat = catById(c.category);
        return '<div class="inc-row"><span class="inc-ico">' + cat.icon + '</span><span class="inc-name">' + esc(t("cat." + c.category)) + "</span>" +
          '<span class="inc-bar">' + progressHTML(Math.round((c.total / maxInc) * 100), "ok") + "</span>" +
          '<span class="inc-val c-green">' + fmtMoney(c.total) + "</span></div>";
      }).join("")
    : emptyHTML("💼", t("reports.noData"), t("reports.noDataHint"));

  /* top 5 expenses */
  const top = list.filter(x => x.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5);
  document.getElementById("reportTop").innerHTML = top.length
    ? '<div class="tx-list">' + top.map(txRowHTML).join("") + "</div>"
    : emptyHTML("🧾", t("reports.noData"), t("reports.noDataHint"));
}
function statCard(icon, cls, label, value) {
  return '<div class="stat-card"><div class="stat-ico ' + cls + '">' + icon + '</div><div class="stat-txt"><span>' + esc(label) + "</span><strong>" + value + "</strong></div></div>";
}

/* ═══════════ SETTINGS ═══════════ */
function renderSettings() {
  const d = getData();
  const me = getSession();
  document.getElementById("sideFamily").textContent = d.settings.familyName;

  const fam = document.getElementById("familyNameInput");
  if (fam && document.activeElement !== fam) fam.value = d.settings.familyName;

  const cur = document.getElementById("currencySelect");
  cur.innerHTML = CURRENCIES.map(c => '<option value="' + c.code + '">' + c.symbol + " " + c.name + " (" + c.code + ")</option>").join("");
  cur.value = d.settings.currency.code;

  /* theme + lang segments */
  document.querySelectorAll('#page-settings [data-action="set-theme"]').forEach(b => b.classList.toggle("active", b.dataset.val === d.settings.theme));
  document.querySelectorAll('#page-settings [data-action="set-lang"]').forEach(b => b.classList.toggle("active", b.dataset.val === d.settings.language));

  document.getElementById("profilesWrap").innerHTML = d.users.map(u =>
    '<div class="profile-card"><div class="pc-head">' + avatarHTML(u, "avatar avatar-lg") +
    '<div><div class="pc-name">' + esc(u.name) + (u.id === me ? ' <span class="badge badge-ok">' + t("settings.you") + "</span>" : "") + '</div><div class="pc-role">' + t("settings.role") + "</div></div></div>" +
    '<div class="pc-rows">' +
    '<div class="pc-row">✉️ <span>' + t("settings.gmail") + ': <b>' + esc(u.email) + "</b></span></div>" +
    '<div class="pc-row">📱 <span>' + t("settings.mobile") + ": <b>" + esc(u.mobile) + "</b></span></div>" +
    '<div class="pc-row">🔑 <span>' + t("settings.pinLbl") + ": <b>••••</b></span></div></div>" +
    '<div class="pc-btns"><button class="btn btn-ghost btn-sm" data-action="edit-profile" data-id="' + u.id + '">✏️ ' + t("settings.editProfile") + "</button>" +
    '<button class="btn btn-ghost btn-sm" data-action="change-pin" data-id="' + u.id + '">🔑 ' + t("settings.changePin") + "</button></div></div>"
  ).join("");
}

/* ═══════════ Central dispatch ═══════════ */
const PAGE_RENDER = {
  dashboard: renderDashboard,
  transactions: renderTransactions,
  budget: renderBudget,
  goals: renderGoals,
  reports: renderReports,
  settings: renderSettings
};
const PAGE_TITLES = {
  dashboard: "nav.dashboard", transactions: "nav.transactions", budget: "nav.budget",
  goals: "nav.goals", reports: "nav.reports", settings: "nav.settings"
};
