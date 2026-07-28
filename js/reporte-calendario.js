const REPORT_TEACHERS_STORAGE_KEY = "prfwb_teacher_records";
const REPORT_SCHEDULE_STORAGE_KEY = "prfwb_schedule_records";

let reportTeachers = [];
let reportSchedule = [];

function reportStorageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

function loadReportLocal(key) {
  const raw = localStorage.getItem(reportStorageKey(key));
  return raw ? JSON.parse(raw) : [];
}

function escapeReportHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getReportTeacher(id) {
  return reportTeachers.find((teacher) => teacher.id === id) || null;
}

function getReportGroupLabel(group) {
  if (group === "ninos") return "Ninos";
  if (group === "juveniles") return "Juveniles";
  return "Ambos";
}

function getReportStatusLabel(status) {
  const labels = {
    "sin-asignar": "Sin asignar",
    asignado: "Asignado",
    confirmado: "Confirmado",
    completado: "Completado"
  };
  return labels[status] || "Sin asignar";
}

async function loadReportData() {
  reportTeachers = loadReportLocal(REPORT_TEACHERS_STORAGE_KEY);
  reportSchedule = loadReportLocal(REPORT_SCHEDULE_STORAGE_KEY);

  if (window.PRFirebase && window.PRFirebase.enabled) {
    const profile = await window.PRFirebase.requireAuth();
    if (!profile) return;

    const [cloudTeachers, cloudSchedule] = await Promise.all([
      window.PRFirebase.getTeachers ? window.PRFirebase.getTeachers() : [],
      window.PRFirebase.getSchedule ? window.PRFirebase.getSchedule() : []
    ]);

    if (cloudTeachers.length) reportTeachers = cloudTeachers;
    if (cloudSchedule.length) reportSchedule = cloudSchedule;
  }

  renderReport();
}

function getFilteredReportEntries() {
  const group = document.getElementById("reportGroupFilter").value;
  const status = document.getElementById("reportStatusFilter").value;

  return reportSchedule
    .filter((entry) => group === "todos" || entry.group === group)
    .filter((entry) => status === "todos" || (entry.status || "sin-asignar") === status)
    .sort((a, b) => new Date(a.dateIso || 0) - new Date(b.dateIso || 0));
}

function renderReportStats(entries) {
  document.getElementById("reportTotal").textContent = entries.length;
  document.getElementById("reportAssigned").textContent = entries.filter((entry) => entry.teacherId).length;
  document.getElementById("reportPending").textContent = entries.filter((entry) => !entry.teacherId || entry.status === "sin-asignar").length;
  document.getElementById("reportConfirmed").textContent = entries.filter((entry) => entry.status === "confirmado").length;
}

function renderReport() {
  const board = document.getElementById("assignmentReport");
  const entries = getFilteredReportEntries();
  renderReportStats(entries);

  document.getElementById("reportDateLabel").textContent = new Date().toLocaleDateString("es-PR", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  if (!entries.length) {
    board.innerHTML = '<div class="empty-inline">No hay asignaciones con esos filtros.</div>';
    return;
  }

  board.innerHTML = `
    <div class="report-table">
      <div class="report-row report-head">
        <span>Fecha</span>
        <span>Grupo</span>
        <span>Clase</span>
        <span>Maestro</span>
        <span>Ayudante</span>
        <span>Estado</span>
      </div>
      ${entries.map((entry) => {
        const teacher = getReportTeacher(entry.teacherId);
        const assistant = getReportTeacher(entry.assistantId);
        return `
          <div class="report-row status-${entry.status || "sin-asignar"}">
            <span>${escapeReportHtml(entry.dateLabel || entry.dateIso)}</span>
            <span>${escapeReportHtml(getReportGroupLabel(entry.group))}</span>
            <span>${escapeReportHtml(entry.lessonTitle || "Clase por confirmar")}</span>
            <span>${teacher ? escapeReportHtml(teacher.name) : "Sin asignar"}</span>
            <span>${assistant ? escapeReportHtml(assistant.name) : "Sin ayudante"}</span>
            <span>${escapeReportHtml(getReportStatusLabel(entry.status))}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("printReport").addEventListener("click", () => window.print());
  document.getElementById("reportGroupFilter").addEventListener("change", renderReport);
  document.getElementById("reportStatusFilter").addEventListener("change", renderReport);
  loadReportData();
});
