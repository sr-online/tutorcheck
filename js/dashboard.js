const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function thaiFullDate(d) {
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function thaiShortDate(d) {
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`;
}
function thaiTime(d) {
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

const SUBJECT_MAP = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));
const todayKey = dateKey(new Date());

// ---------------- PASSWORD GATE ----------------
// กันไม่ให้คนทั่วไปเปิดดูง่ายเกินไป (ไม่ใช่ระบบความปลอดภัยจริงจัง เพราะข้อมูลไม่ได้อ่อนไหวมาก)
const GATE_PASSWORD = "admin";
const GATE_SESSION_KEY = "dashboardUnlocked";

const gateShell = document.getElementById("gateShell");
const dashShell = document.getElementById("dashShell");
const gateBtn = document.getElementById("gateBtn");
const gatePasswordInput = document.getElementById("gatePassword");
const gateError = document.getElementById("gateError");

function unlockDashboard() {
  gateShell.classList.add("hidden");
  dashShell.classList.remove("hidden");
  boot();
}

function tryUnlock() {
  const value = gatePasswordInput.value;
  if (value === GATE_PASSWORD) {
    sessionStorage.setItem(GATE_SESSION_KEY, "1");
    gateError.textContent = "";
    unlockDashboard();
  } else {
    gateError.textContent = "รหัสผ่านไม่ถูกต้อง";
  }
}

gateBtn.addEventListener("click", tryUnlock);
gatePasswordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});

// ---------------- STATE ----------------
let selectedSubject = "all";
let selectedDateStr = todayKey;
let viewMode = "checked"; // checked | absent
let searchKw = "";
let dayRecords = []; // records for selectedDateStr
let trendRecords = []; // records for last 14 days

document.getElementById("datePicker").value = todayKey;
document.getElementById("dashDate").textContent = thaiFullDate(new Date());

function boot() {
  renderTabs();
  bindStaticEvents();
  refreshAll();
}

function bindStaticEvents() {
  document.getElementById("datePicker").addEventListener("change", (e) => {
    selectedDateStr = e.target.value || todayKey;
    loadDay();
  });
  document.getElementById("refreshBtn").addEventListener("click", refreshAll);
  document.getElementById("tableSearch").addEventListener("input", (e) => {
    searchKw = e.target.value.trim();
    renderTable();
  });
  document.getElementById("exportBtn").addEventListener("click", exportCsv);
}

async function refreshAll() {
  await Promise.all([loadDay(), loadTrend()]);
}

// ---------------- DATA LOADING ----------------
async function loadDay() {
  const snap = await db.collection("checkins").where("date", "==", selectedDateStr).get();
  dayRecords = snap.docs.map((d) => normalizeRecord(d));
  dayRecords.sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
  renderStatGrid();
  renderTable();
}

async function loadTrend() {
  const startKey = dateKey(new Date(Date.now() - 13 * 86400000));
  const snap = await db.collection("checkins").where("date", ">=", startKey).orderBy("date").get();
  trendRecords = snap.docs.map((d) => normalizeRecord(d));
  renderChart();
}

function normalizeRecord(doc) {
  const data = doc.data();
  const createdAtMs = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().getTime() : 0;
  return {
    id: doc.id,
    subject: data.subject,
    subjectName: data.subjectName || (SUBJECT_MAP[data.subject] || {}).name || data.subject,
    name: data.name,
    class: data.class,
    date: data.date,
    createdAtMs,
  };
}

// ---------------- TABS ----------------
function renderTabs() {
  const wrap = document.getElementById("subjectTabs");
  wrap.innerHTML = "";
  const allBtn = makeTab("ทั้งหมด", "all", null);
  wrap.appendChild(allBtn);
  SUBJECTS.forEach((s) => wrap.appendChild(makeTab(s.name, s.id, s.color)));
}

function makeTab(label, id, color) {
  const btn = document.createElement("button");
  btn.className = "tab-btn" + (selectedSubject === id ? " active" : "");
  btn.innerHTML = color
    ? `<span class="swatch" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;"></span>${label}`
    : label;
  btn.addEventListener("click", () => {
    selectedSubject = id;
    viewMode = "checked";
    renderTabs();
    renderStatGrid();
    renderChart();
    renderTable();
  });
  return btn;
}

// ---------------- STAT GRID ----------------
function renderStatGrid() {
  const grid = document.getElementById("statGrid");
  grid.innerHTML = "";

  if (selectedSubject === "all") {
    SUBJECTS.forEach((s) => {
      const total = STUDENTS[s.id].length;
      const checked = dayRecords.filter((r) => r.subject === s.id).length;
      const pct = total ? Math.round((checked / total) * 100) : 0;
      grid.appendChild(
        statCard(s.name, `${checked}`, `จาก ${total} คน (${pct}%)`, s.color)
      );
    });
  } else {
    const s = SUBJECT_MAP[selectedSubject];
    const total = STUDENTS[selectedSubject].length;
    const checked = dayRecords.filter((r) => r.subject === selectedSubject).length;
    const pct = total ? Math.round((checked / total) * 100) : 0;
    grid.appendChild(statCard("ลงชื่อแล้ว", `${checked}`, dateLabelShort(), s.color));
    grid.appendChild(statCard("นักเรียนทั้งหมดในกิจกรรม", `${total}`, "คน", s.color));
    grid.appendChild(statCard("อัตราการเข้าร่วม", `${pct}%`, `${checked}/${total} คน`, s.color));
  }
}

function statCard(label, value, sub, color) {
  const div = document.createElement("div");
  div.className = "stat-card";
  div.innerHTML = `
    <div class="stat-label"><span class="swatch" style="background:${color}"></span>${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-sub">${sub}</div>
  `;
  return div;
}

function dateLabelShort() {
  return selectedDateStr === todayKey ? "วันนี้" : thaiShortDate(keyToDate(selectedDateStr));
}

// ---------------- CHART ----------------
function renderChart() {
  const wrap = document.getElementById("chartWrap");
  const legend = document.getElementById("chartLegend");
  wrap.innerHTML = "";
  legend.innerHTML = "";

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push({ key: dateKey(d), label: thaiShortDate(d) });
  }

  let series;
  if (selectedSubject === "all") {
    series = SUBJECTS.map((s) => ({
      id: s.id,
      color: s.color,
      values: days.map((day) => trendRecords.filter((r) => r.subject === s.id && r.date === day.key).length),
    }));
    legend.innerHTML = SUBJECTS.map(
      (s) => `<span class="item"><span class="swatch" style="background:${s.color}"></span>${s.name}</span>`
    ).join("");
  } else {
    const s = SUBJECT_MAP[selectedSubject];
    series = [
      {
        id: s.id,
        color: s.color,
        values: days.map((day) => trendRecords.filter((r) => r.subject === s.id && r.date === day.key).length),
      },
    ];
  }

  drawStackedBarChart(wrap, days, series);
}

function drawStackedBarChart(container, days, series) {
  const totals = days.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
  const maxTotal = Math.max(1, ...totals);
  const niceMax = niceCeil(maxTotal);

  const barSlot = 42;
  const barWidth = 24;
  const leftPad = 34;
  const rightPad = 8;
  const topPad = 14;
  const chartHeight = 170;
  const bottomPad = 26;
  const width = leftPad + days.length * barSlot + rightPad;
  const height = topPad + chartHeight + bottomPad;
  const baseline = topPad + chartHeight;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // gridlines + y labels
  for (let g = 0; g <= 4; g++) {
    const val = Math.round((niceMax * g) / 4);
    const y = baseline - (chartHeight * g) / 4;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", leftPad);
    line.setAttribute("x2", width - rightPad);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "var(--border)");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);

    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", leftPad - 8);
    text.setAttribute("y", y + 4);
    text.setAttribute("text-anchor", "end");
    text.setAttribute("font-size", "10.5");
    text.setAttribute("fill", "var(--text-muted)");
    text.textContent = val;
    svg.appendChild(text);
  }

  const tooltip = document.createElement("div");
  tooltip.className = "bar-tooltip";
  container.style.position = "relative";

  days.forEach((day, i) => {
    const x = leftPad + i * barSlot + (barSlot - barWidth) / 2;
    let cursorY = baseline;
    const total = totals[i];

    // hit area (bigger than visual bar) for hover
    const hit = document.createElementNS(ns, "rect");
    hit.setAttribute("x", leftPad + i * barSlot);
    hit.setAttribute("y", topPad);
    hit.setAttribute("width", barSlot);
    hit.setAttribute("height", chartHeight);
    hit.setAttribute("fill", "transparent");
    hit.style.cursor = "pointer";

    series.forEach((s) => {
      const v = s.values[i];
      if (v <= 0) return;
      const segH = Math.max(2, (chartHeight * v) / niceMax);
      const y = cursorY - segH;
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width", barWidth);
      rect.setAttribute("height", Math.max(0, segH - (series.length > 1 ? 1.5 : 0)));
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", s.color);
      svg.appendChild(rect);
      cursorY = y;
    });

    if (total === 0) {
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", baseline - 2);
      rect.setAttribute("width", barWidth);
      rect.setAttribute("height", 2);
      rect.setAttribute("rx", "1");
      rect.setAttribute("fill", "var(--border)");
      svg.appendChild(rect);
    }

    // x label every other day if crowded
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", x + barWidth / 2);
    label.setAttribute("y", height - 8);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", "var(--text-muted)");
    label.textContent = day.label;
    svg.appendChild(label);

    hit.addEventListener("mouseenter", () => {
      tooltip.classList.add("show");
    });
    hit.addEventListener("mousemove", (evt) => {
      const rectBox = container.getBoundingClientRect();
      tooltip.style.left = evt.clientX - rectBox.left + "px";
      tooltip.style.top = evt.clientY - rectBox.top + "px";
      const breakdown =
        series.length > 1
          ? series
              .filter((s) => s.values[i] > 0)
              .map((s) => `${SUBJECT_MAP[s.id].name}: ${s.values[i]}`)
              .join(" · ")
          : `${total} คน`;
      tooltip.textContent = `${day.label} — ${breakdown || "ไม่มีข้อมูล"}`;
      tooltip.style.opacity = "1";
    });
    hit.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
    });

    svg.appendChild(hit);
  });

  container.appendChild(svg);
  container.appendChild(tooltip);
}

function niceCeil(n) {
  if (n <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const mult = n / pow;
  let nice;
  if (mult <= 1) nice = 1;
  else if (mult <= 2) nice = 2;
  else if (mult <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

// ---------------- TABLE ----------------
function renderTable() {
  const head = document.getElementById("tableHead");
  const body = document.getElementById("tableBody");
  const title = document.getElementById("tableTitle");
  const viewTabsWrap = document.getElementById("viewTabs");

  title.textContent = `รายชื่อ${selectedSubject === "all" ? "ที่ลงชื่อ" : ""} ${
    selectedDateStr === todayKey ? "วันนี้" : "วันที่ " + thaiShortDate(keyToDate(selectedDateStr))
  }`;

  if (selectedSubject === "all") {
    viewTabsWrap.innerHTML = "";
    renderCheckedTable(head, body, dayRecords, true);
    return;
  }

  const checkedNames = new Set(dayRecords.filter((r) => r.subject === selectedSubject).map((r) => r.name));
  const roster = STUDENTS[selectedSubject];
  const absentList = roster.filter((s) => !checkedNames.has(s.name));

  viewTabsWrap.innerHTML = "";
  const checkedTab = document.createElement("button");
  checkedTab.className = "tab-btn" + (viewMode === "checked" ? " active" : "");
  checkedTab.textContent = `ลงชื่อแล้ว (${checkedNames.size})`;
  checkedTab.addEventListener("click", () => {
    viewMode = "checked";
    renderTable();
  });
  const absentTab = document.createElement("button");
  absentTab.className = "tab-btn" + (viewMode === "absent" ? " active" : "");
  absentTab.textContent = `ยังไม่ลงชื่อ (${absentList.length})`;
  absentTab.addEventListener("click", () => {
    viewMode = "absent";
    renderTable();
  });
  viewTabsWrap.appendChild(checkedTab);
  viewTabsWrap.appendChild(absentTab);

  if (viewMode === "checked") {
    renderCheckedTable(head, body, dayRecords.filter((r) => r.subject === selectedSubject), false);
  } else {
    renderAbsentTable(head, body, absentList);
  }
}

function renderCheckedTable(head, body, records, showSubjectCol) {
  head.innerHTML = `<tr><th>เวลา</th><th>ชื่อ-สกุล</th><th>ชั้น</th>${showSubjectCol ? "<th>กิจกรรม</th>" : ""}</tr>`;
  const kw = normalizeSearch(searchKw);
  const filtered = records.filter((r) => !kw || normalizeSearch(r.name).includes(kw));
  body.innerHTML = "";

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="${showSubjectCol ? 4 : 3}"><div class="empty-row">ยังไม่มีการลงชื่อ</div></td></tr>`;
    return;
  }

  filtered
    .slice()
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .forEach((r) => {
      const tr = document.createElement("tr");
      const timeStr = r.createdAtMs ? thaiTime(new Date(r.createdAtMs)) : "-";
      const subjColor = (SUBJECT_MAP[r.subject] || {}).color || "#999";
      tr.innerHTML = `
        <td>${timeStr}</td>
        <td>${r.name}</td>
        <td>${r.class}</td>
        ${showSubjectCol ? `<td><span class="badge" style="background:${subjColor}22;color:${subjColor}"><span class="dot" style="background:${subjColor}"></span>${r.subjectName}</span></td>` : ""}
      `;
      body.appendChild(tr);
    });
}

function renderAbsentTable(head, body, list) {
  head.innerHTML = `<tr><th>ชื่อ-สกุล</th><th>ชั้น</th></tr>`;
  const kw = normalizeSearch(searchKw);
  const filtered = list.filter((s) => !kw || normalizeSearch(s.name).includes(kw));
  body.innerHTML = "";

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="2"><div class="empty-row">ลงชื่อครบทุกคนแล้ว 🎉</div></td></tr>`;
    return;
  }

  filtered.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.name}</td><td>${s.class}</td>`;
    body.appendChild(tr);
  });
}

function normalizeSearch(str) {
  return (str || "").replace(/\s+/g, "").toLowerCase();
}

// ---------------- EXPORT ----------------
function exportCsv() {
  const rows = [];
  if (selectedSubject === "all") {
    rows.push(["เวลา", "ชื่อ-สกุล", "ชั้น", "กิจกรรม", "วันที่"]);
    dayRecords.forEach((r) => {
      rows.push([r.createdAtMs ? thaiTime(new Date(r.createdAtMs)) : "", r.name, r.class, r.subjectName, r.date]);
    });
  } else if (viewMode === "checked") {
    rows.push(["เวลา", "ชื่อ-สกุล", "ชั้น", "วันที่"]);
    dayRecords
      .filter((r) => r.subject === selectedSubject)
      .forEach((r) => {
        rows.push([r.createdAtMs ? thaiTime(new Date(r.createdAtMs)) : "", r.name, r.class, r.date]);
      });
  } else {
    rows.push(["ชื่อ-สกุล", "ชั้น"]);
    const checkedNames = new Set(dayRecords.filter((r) => r.subject === selectedSubject).map((r) => r.name));
    STUDENTS[selectedSubject]
      .filter((s) => !checkedNames.has(s.name))
      .forEach((s) => rows.push([s.name, s.class]));
  }

  const csv = "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `checkin-${selectedSubject}-${selectedDateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------- GATE AUTO-CHECK ----------------
// วางไว้ท้ายไฟล์ เพื่อให้ตัวแปร/ฟังก์ชันด้านบนถูกประกาศครบก่อน unlockDashboard() จะถูกเรียก
if (sessionStorage.getItem(GATE_SESSION_KEY) === "1") {
  unlockDashboard();
} else {
  gatePasswordInput.focus();
}
