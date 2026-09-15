/* ═══════════════════════════════════════════════
   charts.js — dependency-free charts (CSS bars, SVG donut, SVG line)
   ═══════════════════════════════════════════════ */

/* ─── Global tooltip (any element with data-tip) ─── */
function tipEl() { return document.getElementById("chartTooltip"); }
function showTip(html, ev) {
  const el = tipEl();
  if (!el) return;
  el.innerHTML = html;
  el.classList.add("show");
  moveTip(ev);
}
function moveTip(ev) {
  const el = tipEl();
  if (!el || !el.classList.contains("show")) return;
  const pad = 14;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  const r = el.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
  el.style.left = x + "px";
  el.style.top = y + "px";
}
function hideTip() { const el = tipEl(); if (el) { el.classList.remove("show"); el.innerHTML = ""; } }
function initTooltip() {
  document.addEventListener("mouseover", e => {
    const el = e.target.closest("[data-tip]");
    if (el) showTip(el.getAttribute("data-tip"), e);
  });
  document.addEventListener("mousemove", e => { if (e.target.closest && e.target.closest("[data-tip]")) moveTip(e); });
  document.addEventListener("mouseout", e => { if (e.target.closest && e.target.closest("[data-tip]")) hideTip(); });
  document.addEventListener("scroll", hideTip, true);
}

/* ─── Grouped bar chart (income vs expense vs savings) ───
   el, months: [{label, income, expense}], colors: {a:'#22c55e', b:'#f43f5e'} */
function renderGroupedBars(el, months, opts) {
  if (!el) return;
  opts = opts || {};
  const series = opts.series || [
    { key: "income", cls: "bar-green", name: t("common.income") },
    { key: "expense", cls: "bar-red", name: t("common.expense") }
  ];
  const max = Math.max.apply(null, [1].concat(months.flatMap(m => series.map(s => m[s.key] || 0))));
  if (!months.length) { el.innerHTML = emptyChartHTML(); return; }
  el.innerHTML = months.map(m => {
    const bars = series.map(s => {
      const v = m[s.key] || 0;
      const h = Math.max(2.5, (v / max) * 100);
      const tip = "<b>" + esc(m.tipTitle || m.label) + "</b><br>" +
        series.map(s2 => "<b>" + esc(s2.name || t("common." + s2.key)) + ":</b> " + fmtMoney(m[s2.key] || 0)).join("<br>");
      return '<div class="bar ' + s.cls + '" style="height:' + h.toFixed(1) + '%" data-tip="' + tip + '"></div>';
    }).join("");
    return '<div class="bar-group"><div class="bar-pair">' + bars + '</div><span class="bar-label">' + esc(m.label) + "</span></div>";
  }).join("");
}

/* ─── Donut chart ───
   el, items: [{label, value, color, icon}], opts: {centerTitle, centerSub} */
function renderDonut(el, items, opts) {
  if (!el) return;
  opts = opts || {};
  const total = items.reduce((s, x) => s + x.value, 0);
  if (!items.length || total <= 0) {
    el.innerHTML = '<div class="empty" style="width:100%">' + emptyChartHTML() + "</div>";
    return;
  }
  const R = 70, C = 2 * Math.PI * R, GAP = items.length > 1 ? 2.2 : 0;
  let acc = 0;
  const segs = items.map(it => {
    const frac = it.value / total;
    const len = Math.max(0, frac * C - GAP);
    const seg = '<circle class="donut-seg" cx="90" cy="90" r="' + R + '" fill="none" stroke="' + it.color +
      '" stroke-width="26" stroke-linecap="butt" stroke-dasharray="' + len.toFixed(2) + " " + (C - len).toFixed(2) +
      '" stroke-dashoffset="' + (-acc * C + C * 0.25).toFixed(2) +
      '" data-tip="<b>' + esc(it.label) + "</b><br>" + fmtMoney(it.value) + " · " + Math.round(frac * 100) + '%"></circle>';
    acc += frac;
    return seg;
  }).join("");
  const legend = '<div class="donut-legend">' + items.slice(0, 7).map(it => {
    const pct = Math.round((it.value / total) * 100);
    return '<div class="dl-row"><i class="dot" style="background:' + it.color + '"></i>' +
      '<span class="dl-name">' + (it.icon ? it.icon + " " : "") + esc(it.label) + "</span>" +
      '<span class="dl-val">' + fmtCompact(it.value) + '</span><span class="dl-pct">' + locDigits(pct) + "%</span></div>";
  }).join("") + (items.length > 7 ? '<div class="dl-row" style="color:var(--muted)">+' + locDigits(items.length - 7) + "…</div>" : "") + "</div>";

  el.innerHTML =
    '<div class="donut-box"><svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="70" fill="none" stroke="var(--track)" stroke-width="26"/>' + segs + "</svg>" +
    '<div class="donut-center"><div><b>' + (opts.centerHTML || fmtMoney(total)) + "</b><span>" + esc(opts.centerSub || t("chart.total")) + "</span></div></div></div>" + legend;
}

/* ─── Line chart (SVG, measured to container) ─── */
function renderLine(el, points, opts) {
  if (!el) return;
  opts = opts || {};
  const W = Math.max(280, el.clientWidth || 480), H = 215;
  const padL = 48, padR = 14, padT = 16, padB = 30;
  const iw = W - padL - padR, ih = H - padT - padB;
  if (!points.length) { el.innerHTML = emptyChartHTML(); return; }
  const vals = points.map(p => p.value);
  let max = Math.max.apply(null, vals.concat([1]));
  let min = Math.min.apply(null, vals.concat([0]));
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  const span = (max - min) || 1;
  max += span * 0.12; min -= span * 0.08;
  const sp = (max - min) || 1;
  const X = i => padL + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const Y = v => padT + ih - ((v - min) / sp) * ih;
  const zeroY = Y(0);

  let grid = "", labels = "";
  for (let g = 0; g <= 3; g++) {
    const v = min + (sp * g) / 3;
    const y = Y(v);
    grid += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="var(--track)" stroke-width="1" stroke-dasharray="3 5"/>' +
      '<text x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="var(--muted)" font-weight="700">' + fmtCompact(v) + "</text>";
  }
  points.forEach((p, i) => {
    if (points.length > 12 && i % 2 === 1) return;
    labels += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="var(--muted)" font-weight="700">' + esc(p.label) + "</text>";
  });

  const path = points.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.value).toFixed(1)).join(" ");
  const area = path + " L " + X(points.length - 1).toFixed(1) + " " + zeroY.toFixed(1) + " L " + X(0).toFixed(1) + " " + zeroY.toFixed(1) + " Z";
  const dots = points.map((p, i) =>
    '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.value).toFixed(1) + '" r="4.2" fill="var(--card-solid)" stroke="' + (opts.color || "#8b5cf6") +
    '" stroke-width="2.4" data-tip="<b>' + esc(p.tipTitle || p.label) + "</b><br>" + fmtMoney(p.value) + '"/>'
  ).join("");

  el.innerHTML =
    '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">' +
    '<defs><linearGradient id="lg_' + (opts.id || "g") + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + (opts.color || "#8b5cf6") + '" stop-opacity=".32"/>' +
    '<stop offset="1" stop-color="' + (opts.color || "#8b5cf6") + '" stop-opacity="0"/></linearGradient></defs>' +
    grid + labels +
    '<path d="' + area + '" fill="url(#lg_' + (opts.id || "g") + ')"/>' +
    '<path d="' + path + '" fill="none" stroke="' + (opts.color || "#8b5cf6") + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    dots + "</svg>";
}

/* ─── Daily bars (many thin bars) ─── */
function renderDailyBars(el, days) {
  if (!el) return;
  const max = Math.max.apply(null, [1].concat(days.map(d => d.value)));
  if (!days.length) { el.innerHTML = emptyChartHTML(); return; }
  el.classList.add("dense");
  el.innerHTML = days.map(d =>
    '<div class="bar-group"><div class="bar-pair"><div class="bar bar-blue" style="height:' + Math.max(2, (d.value / max) * 100).toFixed(1) +
    '%" data-tip="<b>' + esc(d.tipTitle) + "</b><br>" + fmtMoney(d.value) + '"></div></div>' +
    (d.showLabel ? '<span class="bar-label">' + esc(d.label) + "</span>" : '<span class="bar-label">&nbsp;</span>') + "</div>"
  ).join("");
}

function emptyChartHTML() {
  return '<div class="empty" style="padding:28px 10px"><div class="em-ico">📊</div><b>—</b></div>';
}
