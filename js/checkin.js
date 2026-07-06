const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function thaiFullDate(d) {
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function thaiTime(d) {
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

const todayLabelEl = document.getElementById("todayLabel");
const now = new Date();
todayLabelEl.textContent = thaiFullDate(now);

// ---------- state ----------
let currentSubject = null; // subject object
let currentResults = [];
let selectedStudent = null;
let submitting = false;

// ---------- steps ----------
const steps = {
  subject: document.getElementById("step-subject"),
  search: document.getElementById("step-search"),
  confirm: document.getElementById("step-confirm"),
  success: document.getElementById("step-success"),
};

function showStep(name) {
  Object.values(steps).forEach((s) => s.classList.remove("active"));
  steps[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- render subject cards ----------
const juniorGrid = document.getElementById("subjectGridJunior");
const seniorGrid = document.getElementById("subjectGridSenior");

function initials(name) {
  const cleaned = name.replace(/^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง)/, "");
  return cleaned.trim().charAt(0) || "?";
}

SUBJECTS.forEach((subj) => {
  const card = document.createElement("button");
  card.className = "subject-card";
  card.innerHTML = `
    <div class="dot" style="background:${subj.color}">${initials(subj.name)}</div>
    <div class="name">${subj.name}</div>
    <div class="time">${subj.level}${subj.time ? " · " + subj.time : ""}</div>
  `;
  card.addEventListener("click", () => selectSubject(subj));
  if (subj.level.includes("ตอนต้น")) {
    juniorGrid.appendChild(card);
  } else {
    seniorGrid.appendChild(card);
  }
});

function renderSubjectPill(el) {
  el.innerHTML = `<span class="swatch" style="background:${currentSubject.color}"></span> ${currentSubject.name}`;
}

function selectSubject(subj) {
  currentSubject = subj;
  currentResults = STUDENTS[subj.id] || [];
  renderSubjectPill(document.getElementById("subjectPill"));
  document.getElementById("nameInput").value = "";
  renderResults("");
  showStep("search");
  setTimeout(() => document.getElementById("nameInput").focus(), 200);
}

// ---------- search ----------
const nameInput = document.getElementById("nameInput");
const resultList = document.getElementById("resultList");

function normalize(str) {
  return str.replace(/\s+/g, "").toLowerCase();
}

function renderResults(keyword) {
  const kw = normalize(keyword);
  const matches = currentResults.filter((s) => normalize(s.name).includes(kw));
  resultList.innerHTML = "";

  if (kw && matches.length === 0) {
    resultList.innerHTML = `<div class="empty-hint">ไม่พบชื่อนี้ในรายชื่อกิจกรรมนี้<br/>กรุณาตรวจสอบการสะกดชื่อ หรือเลือกกิจกรรมใหม่</div>`;
    return;
  }

  const listToShow = kw ? matches : matches.slice(0, 40);

  listToShow.forEach((s) => {
    const item = document.createElement("button");
    item.className = "result-item";
    item.innerHTML = `<span class="r-name">${s.name}</span><span class="r-class">${s.class}</span>`;
    item.addEventListener("click", () => selectStudent(s));
    resultList.appendChild(item);
  });

  if (!kw && matches.length > 40) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.textContent = `พิมพ์ชื่อเพื่อค้นหา (ทั้งหมด ${matches.length} คน)`;
    resultList.appendChild(hint);
  }
}

nameInput.addEventListener("input", (e) => renderResults(e.target.value));

document.getElementById("backFromSearch").addEventListener("click", () => {
  showStep("subject");
});

// ---------- confirm ----------
function selectStudent(student) {
  selectedStudent = student;
  const submitTime = new Date();

  renderSubjectPill(document.getElementById("subjectPillConfirm"));
  document.getElementById("confirmAvatar").textContent = initials(student.name);
  document.getElementById("confirmName").textContent = student.name;
  document.getElementById("confirmClass").textContent = student.class;
  document.getElementById("confirmSubject").textContent = currentSubject.name;
  document.getElementById("confirmClass2").textContent = student.class;
  document.getElementById("confirmDate").textContent = thaiFullDate(submitTime);
  document.getElementById("confirmTime").textContent = thaiTime(submitTime);

  showStep("confirm");
}

document.getElementById("backFromConfirm").addEventListener("click", () => {
  showStep("search");
});
document.getElementById("reselectBtn").addEventListener("click", () => {
  showStep("search");
});

// ใช้รหัสเอกสารที่คำนวณได้แน่นอนจาก วิชา+วันที่+ชื่อ แล้วเขียนด้วย .set() แทน .add()
// เพื่อให้ Firestore Rules (allow update: if false) เป็นตัวกันการลงชื่อซ้ำให้แบบ atomic
// จริงๆ ในระดับฐานข้อมูล ไม่ใช่แค่เช็กฝั่งหน้าเว็บ (กันกรณีกดยืนยันซ้ำๆ เร็วๆ หรือลงชื่อพร้อมกันจากหลายเครื่อง)
function makeCheckinId(subjectId, dateStr, name) {
  const cleanName = name.replace(/[\/\s]+/g, "");
  return `${subjectId}_${dateStr}_${cleanName}`;
}

document.getElementById("confirmBtn").addEventListener("click", async () => {
  if (submitting || !selectedStudent || !currentSubject) return;
  submitting = true;
  const btn = document.getElementById("confirmBtn");
  const originalText = btn.textContent;
  btn.innerHTML = `<span class="spinner"></span>`;
  btn.disabled = true;

  try {
    const today = dateKey(new Date());
    const checkinId = makeCheckinId(currentSubject.id, today, selectedStudent.name);

    await db.collection("checkins").doc(checkinId).set({
      subject: currentSubject.id,
      subjectName: currentSubject.name,
      name: selectedStudent.name,
      class: selectedStudent.class,
      date: today,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showSuccess();
  } catch (err) {
    if (err && err.code === "permission-denied") {
      // เขียนไม่ผ่านเพราะเอกสารนี้มีอยู่แล้ว (ลงชื่อไปแล้ววันนี้)
      showAlreadyDone();
    } else {
      console.error(err);
      showToast("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
    submitting = false;
  }
});

function showSuccess() {
  document.getElementById("successBadge").className = "success-badge";
  document.getElementById("successBadge").textContent = "✓";
  document.getElementById("successTitle").textContent = "ลงชื่อสำเร็จ";
  document.getElementById("successDetail").innerHTML =
    `<strong>${selectedStudent.name}</strong> (${selectedStudent.class})<br/>` +
    `กิจกรรม: ${currentSubject.name}<br/>เวลา ${thaiTime(new Date())} น.`;
  showStep("success");
}

function showAlreadyDone() {
  document.getElementById("successBadge").className = "success-badge warn";
  document.getElementById("successBadge").textContent = "!";
  document.getElementById("successTitle").textContent = "ลงชื่อไปแล้ววันนี้";
  document.getElementById("successDetail").innerHTML =
    `<strong>${selectedStudent.name}</strong> (${selectedStudent.class})<br/>` +
    `ได้ลงชื่อเข้ากิจกรรม "${currentSubject.name}" ของวันนี้ไปแล้ว`;
  showStep("success");
}

document.getElementById("doneBtn").addEventListener("click", () => {
  selectedStudent = null;
  showStep("subject");
});

// ---------- toast ----------
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
