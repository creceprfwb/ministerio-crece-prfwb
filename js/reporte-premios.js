const REWARD_REPORT_STUDENTS_KEY = "prfwb_student_records";
const REWARD_REPORT_PRIZE_POINTS = 25;

let rewardReportStudents = [];

function rewardReportStorageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

function loadRewardReportLocal(key) {
  const raw = localStorage.getItem(rewardReportStorageKey(key));
  return raw ? JSON.parse(raw) : [];
}

function escapeRewardReportHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeRewardReportStudent(student) {
  return {
    ...student,
    rewardPoints: Number(student.rewardPoints || 0),
    rewardHistory: Array.isArray(student.rewardHistory) ? student.rewardHistory : []
  };
}

function getRewardReportDeliveredCount(student) {
  return student.rewardHistory.filter((entry) => entry.deliveredPrize || entry.reason === "Premio entregado").length;
}

function getRewardReportAvailableCount(student) {
  return Math.floor(Number(student.rewardPoints || 0) / REWARD_REPORT_PRIZE_POINTS);
}

function getRewardReportPointsToNext(student) {
  const points = Number(student.rewardPoints || 0);
  const remainder = points % REWARD_REPORT_PRIZE_POINTS;
  return remainder === 0 && points > 0 ? 0 : REWARD_REPORT_PRIZE_POINTS - remainder;
}

function getRewardReportGroupLabel(group) {
  if (group === "ninos") return "Ninos";
  if (group === "juveniles") return "Juveniles";
  return "Sin grupo";
}

function getLastDeliveredPrizeDate(student) {
  const entry = student.rewardHistory.find((item) => item.deliveredPrize || item.reason === "Premio entregado");
  return entry && entry.createdAt
    ? new Date(entry.createdAt).toLocaleDateString("es-PR")
    : "No entregado";
}

async function loadRewardReportData() {
  rewardReportStudents = loadRewardReportLocal(REWARD_REPORT_STUDENTS_KEY).map(normalizeRewardReportStudent);

  try {
    if (window.PRFirebase && window.PRFirebase.enabled && typeof window.PRFirebase.getStudents === "function") {
      const profile = await window.PRFirebase.requireAuth();

      if (!profile) {
        renderRewardReport("Inicia sesion para ver los premios guardados en la nube.");
        return;
      }

      const cloudStudents = await window.PRFirebase.getStudents();

      if (cloudStudents.length) {
        rewardReportStudents = cloudStudents.map(normalizeRewardReportStudent);
        localStorage.setItem(rewardReportStorageKey(REWARD_REPORT_STUDENTS_KEY), JSON.stringify(rewardReportStudents));
      }
    }
  } catch (error) {
    console.warn("No se pudo cargar el reporte de premios desde Firebase.", error);
  }

  renderRewardReport();
}

function getFilteredRewardReportStudents() {
  const group = document.getElementById("rewardReportGroupFilter").value;
  const view = document.getElementById("rewardReportViewFilter").value;

  return rewardReportStudents
    .filter((student) => student.active !== false)
    .filter((student) => group === "todos" || student.group === group)
    .filter((student) => {
      const available = getRewardReportAvailableCount(student);
      const close = getRewardReportPointsToNext(student) <= 5 && available < 1;

      if (view === "disponibles") return available > 0;
      if (view === "cerca") return close;
      return true;
    })
    .sort((a, b) => Number(b.rewardPoints || 0) - Number(a.rewardPoints || 0));
}

function renderRewardReportStats(students) {
  document.getElementById("rewardReportTotal").textContent = students.length;
  document.getElementById("rewardReportReady").textContent = students.filter((student) => getRewardReportAvailableCount(student) > 0).length;
  document.getElementById("rewardReportClose").textContent = students.filter((student) => getRewardReportPointsToNext(student) <= 5 && getRewardReportAvailableCount(student) < 1).length;
  document.getElementById("rewardReportDelivered").textContent = students.reduce((total, student) => total + getRewardReportDeliveredCount(student), 0);
}

function renderRewardReport(message = "") {
  const board = document.getElementById("rewardReportBoard");
  const students = getFilteredRewardReportStudents();
  renderRewardReportStats(students);

  document.getElementById("rewardReportDateLabel").textContent = `Actualizado: ${new Date().toLocaleDateString("es-PR")}`;

  if (!students.length) {
    board.innerHTML = `<div class="empty-inline">${message || "No hay estudiantes con esos filtros."}</div>`;
    return;
  }

  board.innerHTML = `
    <div class="report-table reward-report-table">
      <div class="report-row reward-report-row report-head">
        <span>Estudiante</span>
        <span>Grupo</span>
        <span>Puntos</span>
        <span>Premio</span>
        <span>Faltan</span>
        <span>Entregados</span>
        <span>Ultima entrega</span>
      </div>
      ${students.map((student) => {
        const available = getRewardReportAvailableCount(student);
        const delivered = getRewardReportDeliveredCount(student);
        const pointsToNext = getRewardReportPointsToNext(student);
        const hasPrize = available > 0;

        return `
          <div class="report-row reward-report-row ${hasPrize ? "reward-ready-row" : ""}">
            <span><strong>${escapeRewardReportHtml(student.name)}</strong><small>${escapeRewardReportHtml(student.code)}</small></span>
            <span>${escapeRewardReportHtml(getRewardReportGroupLabel(student.group))}</span>
            <span>${student.rewardPoints}</span>
            <span><strong class="assignment-pill ${hasPrize ? "assigned" : "vacant"}">${hasPrize ? `${available} disponible` : "No ganado"}</strong></span>
            <span>${hasPrize ? "0" : pointsToNext}</span>
            <span>${delivered}</span>
            <span>${escapeRewardReportHtml(getLastDeliveredPrizeDate(student))}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("printRewardsReport").addEventListener("click", () => window.print());
  document.getElementById("rewardReportGroupFilter").addEventListener("change", renderRewardReport);
  document.getElementById("rewardReportViewFilter").addEventListener("change", renderRewardReport);
  loadRewardReportData();
});
