// El panel administrativo usa los mismos registros creados por app.js.
const ADMIN_STORAGE_KEY = "prfwb_attendance_records";
const ADMIN_STUDENTS_STORAGE_KEY = "prfwb_student_records";
const ADMIN_TEACHERS_STORAGE_KEY = "prfwb_teacher_records";

let attendanceRecords = [];
let studentRecords = [];
let teacherRecords = [];
let groupChart = null;

function storageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

// Obtiene registros locales y los ordena del mas reciente al mas antiguo.
function loadAttendanceRecords() {
  const rawRecords = localStorage.getItem(storageKey(ADMIN_STORAGE_KEY));
  const records = rawRecords ? JSON.parse(rawRecords) : [];

  return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Obtiene los estudiantes registrados por la maestra.
function loadStudentRecords() {
  const rawStudents = localStorage.getItem(storageKey(ADMIN_STUDENTS_STORAGE_KEY));
  return rawStudents ? JSON.parse(rawStudents) : [];
}

function loadTeacherRecords() {
  const rawTeachers = localStorage.getItem(storageKey(ADMIN_TEACHERS_STORAGE_KEY));
  return rawTeachers ? JSON.parse(rawTeachers) : [];
}

// Carga datos compartidos desde Firebase y conserva una copia local.
async function loadSharedAdminData() {
  attendanceRecords = loadAttendanceRecords();
  studentRecords = loadStudentRecords();
  teacherRecords = loadTeacherRecords();

  if (!window.PRFirebase || !window.PRFirebase.enabled) {
    return;
  }

  try {
    const [cloudAttendance, cloudStudents, cloudTeachers] = await Promise.all([
      window.PRFirebase.getAttendance(),
      window.PRFirebase.getStudents(),
      window.PRFirebase.getTeachers ? window.PRFirebase.getTeachers() : []
    ]);

    if (cloudAttendance.length) {
      attendanceRecords = cloudAttendance;
      localStorage.setItem(storageKey(ADMIN_STORAGE_KEY), JSON.stringify(attendanceRecords));
    }

    if (cloudStudents.length) {
      studentRecords = cloudStudents;
      localStorage.setItem(storageKey(ADMIN_STUDENTS_STORAGE_KEY), JSON.stringify(studentRecords));
    }

    if (cloudTeachers.length) {
      teacherRecords = cloudTeachers;
      localStorage.setItem(storageKey(ADMIN_TEACHERS_STORAGE_KEY), JSON.stringify(teacherRecords));
    }
  } catch (error) {
    console.warn("No se pudo cargar la data compartida.", error);
  }
}

// Normaliza texto para que la búsqueda sea más flexible.
function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStudentDisplayName(student) {
  return String(student.fullName || `${student.name || ""} ${student.lastName || ""}`).trim();
}

function getRelationshipLabel(value) {
  const labels = {
    padre_madre: "Padre / Madre",
    abuelo_abuela: "Abuelo / Abuela",
    tio_tia: "Tio / Tia",
    padrino_madrina: "Padrino / Madrina",
    tutor: "Tutor legal",
    otro: "Otro"
  };

  return labels[value] || "Padre / Madre";
}

function getStudentStatusLabel(value) {
  const labels = {
    regular: "Estudiante regular",
    firstTime: "Primera vez",
    visitor: "Visita"
  };

  return labels[value] || "Estudiante regular";
}

function getIdDeliveryLabel(value) {
  const labels = {
    none: "No entregado",
    wristband: "Pulserita entregada",
    id: "ID entregado",
    both: "Pulserita e ID entregados"
  };

  return labels[value] || "No entregado";
}

function formatDate(value) {
  if (!value) {
    return "No registrada";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function normalizeRewardData(student) {
  return {
    ...student,
    rewardPoints: Number(student.rewardPoints || 0),
    rewardHistory: Array.isArray(student.rewardHistory) ? student.rewardHistory : []
  };
}

function getStudentAttendance(student) {
  const studentCode = String(student.code || "").toUpperCase();

  return attendanceRecords
    .filter((record) => String(record.studentCode || "").toUpperCase() === studentCode)
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
}

function getFilteredStudents() {
  const searchInput = document.getElementById("studentProfileSearch");
  const groupSelect = document.getElementById("studentProfileGroup");
  const query = normalizeText(searchInput ? searchInput.value : "");
  const selectedGroup = groupSelect ? groupSelect.value : "";

  return studentRecords
    .map(normalizeRewardData)
    .filter((student) => {
      const matchesGroup = !selectedGroup || student.group === selectedGroup;
      const searchText = normalizeText([
        student.code,
        getStudentDisplayName(student),
        student.guardianName,
        student.guardianPhone,
        student.emergencyPhone,
        student.guardianEmail,
        student.guardianEmailSecondary,
        getRelationshipLabel(student.guardianRelationship),
        getStudentStatusLabel(student.studentStatus),
        getIdDeliveryLabel(student.idDeliveryStatus),
        student.groupLabel
      ].join(" "));

      return matchesGroup && (!query || searchText.includes(query));
    });
}

// Filtra por nombre o grupo según lo que escriba el administrador.
function getFilteredRecords() {
  const searchInput = document.getElementById("searchInput");
  const query = normalizeText(searchInput ? searchInput.value : "");

  if (!query) {
    return attendanceRecords;
  }

  return attendanceRecords.filter((record) => {
    return normalizeText(record.name).includes(query)
      || normalizeText(record.studentCode).includes(query)
      || normalizeText(record.groupLabel).includes(query);
  });
}

// Calcula totales para las tarjetas superiores y la grafica.
function getSummary(records) {
  return {
    total: records.length,
    ninos: records.filter((record) => record.group === "ninos").length,
    juveniles: records.filter((record) => record.group === "juveniles").length
  };
}

// Pinta las tarjetas de metricas.
function renderStats(records) {
  const summary = getSummary(records);
  const activeStudents = studentRecords.filter((student) => student.active !== false);

  document.getElementById("totalAttendance").textContent = summary.total;
  document.getElementById("totalNinos").textContent = summary.ninos;
  document.getElementById("totalJuveniles").textContent = summary.juveniles;
  document.getElementById("totalStudents").textContent = activeStudents.length;

  const totalTeachers = document.getElementById("totalTeachers");
  if (totalTeachers) {
    totalTeachers.textContent = teacherRecords.filter((teacher) => teacher.active !== false).length;
  }
}

// Pinta la tabla historica.
function renderTable(records) {
  const tableBody = document.getElementById("attendanceTable");

  if (!records.length) {
    tableBody.innerHTML = `
      <tr>
      <td colspan="8" class="text-center text-muted py-4">No hay registros para mostrar.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = records.map((record) => `
    <tr>
      <td><strong>${record.name}</strong></td>
      <td>${record.studentCode || "Manual"}</td>
      <td>${record.age || ""}</td>
      <td>${record.groupLabel}</td>
      <td>${record.guardianName || ""}</td>
      <td>${record.guardianPhone || ""}</td>
      <td>${record.date}</td>
      <td>${record.time}</td>
    </tr>
  `).join("");
}

function renderStudentProfiles() {
  const container = document.getElementById("studentProfiles");

  if (!container) {
    return;
  }

  const filteredStudents = getFilteredStudents();

  if (!filteredStudents.length) {
    container.innerHTML = `
      <div class="empty-state admin-profile-empty">
        <i class="bi bi-person-vcard"></i>
        <span>No hay expedientes para mostrar.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredStudents.map((student) => {
    const attendance = getStudentAttendance(student);
    const latestAttendance = attendance[0];
    const hasAlerts = student.allergies || student.medicalNotes || student.careNotes || student.visitNotes || (student.idDeliveryStatus && student.idDeliveryStatus !== "none");

    return `
      <article class="admin-profile-card ${student.active === false ? "inactive-student" : ""}">
        <div class="admin-profile-head">
          <div class="profile-avatar">${escapeHtml((student.name || "?").charAt(0))}</div>
          <div>
            <span class="profile-code">${escapeHtml(student.code || "")}</span>
            <h3>${escapeHtml(getStudentDisplayName(student))}</h3>
            <p>${escapeHtml(student.groupLabel || "")} - ${escapeHtml(student.age || "")} anos - Nacimiento: ${escapeHtml(formatDate(student.birthDate))}</p>
          </div>
        </div>

        <div class="admin-profile-metrics">
          <span><strong>${attendance.length}</strong> asistencias</span>
          <span><strong>${student.rewardPoints}</strong> puntos</span>
          <span>${escapeHtml(getStudentStatusLabel(student.studentStatus))}</span>
        </div>

        <div class="admin-profile-details">
          <p><strong>Encargado:</strong> ${escapeHtml(student.guardianName || "No registrado")}</p>
          <p><strong>Parentesco:</strong> ${escapeHtml(getRelationshipLabel(student.guardianRelationship))}</p>
          <p><strong>Telefono:</strong> ${escapeHtml(student.guardianPhone || "No registrado")}</p>
          <p><strong>Alterno:</strong> ${escapeHtml(student.emergencyPhone || "No registrado")}</p>
          <p><strong>Email principal:</strong> ${escapeHtml(student.guardianEmail || "No registrado")}</p>
          <p><strong>Segundo email:</strong> ${escapeHtml(student.guardianEmailSecondary || "No registrado")}</p>
          <p><strong>Recoge:</strong> ${escapeHtml(student.authorizedPickup || "No registrado")}</p>
          <p><strong>Pulserita / ID:</strong> ${escapeHtml(getIdDeliveryLabel(student.idDeliveryStatus))}</p>
          <p><strong>Grupo:</strong> ${escapeHtml(student.groupOverride ? `${student.groupLabel} asignado manualmente` : `${student.groupLabel} por edad`)}</p>
          <p><strong>Ultima asistencia:</strong> ${escapeHtml(latestAttendance ? `${latestAttendance.date} ${latestAttendance.time}` : "Sin asistencia")}</p>
        </div>

        <div class="admin-profile-notes ${hasAlerts ? "has-alerts" : ""}">
          <p><strong>Notas de visita:</strong> ${escapeHtml(student.visitNotes || "No registradas")}</p>
          <p><strong>Alergias:</strong> ${escapeHtml(student.allergies || "No registradas")}</p>
          <p><strong>Notas medicas:</strong> ${escapeHtml(student.medicalNotes || "No registradas")}</p>
          <p><strong>Notas de clase:</strong> ${escapeHtml(student.careNotes || "No registradas")}</p>
        </div>

        <div class="admin-profile-actions">
          <button class="btn btn-sm btn-primary admin-edit-student" type="button" data-code="${escapeHtml(student.code)}">
            <i class="bi bi-pencil-square"></i>
            Editar
          </button>
          <button class="btn btn-sm btn-outline-secondary admin-view-attendance" type="button" data-code="${escapeHtml(student.code)}">
            <i class="bi bi-clock-history"></i>
            Ver asistencia
          </button>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll(".admin-edit-student").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("crece_edit_student_code", button.dataset.code);
      window.location.href = "maestro.html";
    });
  });

  container.querySelectorAll(".admin-view-attendance").forEach((button) => {
    const student = studentRecords.find((record) => record.code === button.dataset.code);
    button.addEventListener("click", () => {
      const searchInput = document.getElementById("searchInput");
      searchInput.value = student ? student.code : button.dataset.code;
      renderDashboard();
      document.getElementById("attendanceTable").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// Crea o actualiza la grafica de asistencia por grupo.
function renderChart(records) {
  const canvas = document.getElementById("groupChart");
  const summary = getSummary(records);

  if (!canvas || !window.Chart) {
    return;
  }

  if (groupChart) {
    groupChart.destroy();
  }

  groupChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Niños", "Juveniles"],
      datasets: [{
        data: [summary.ninos, summary.juveniles],
        backgroundColor: ["#0B3D91", "#38BDF8"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      cutout: "62%"
    }
  });
}

// Refresca todo el dashboard usando los datos filtrados.
function renderDashboard() {
  const records = getFilteredRecords();
  renderStats(records);
  renderTable(records);
  renderStudentProfiles();
  renderChart(records);
}

// Exporta a Excel usando SheetJS desde CDN.
function exportToExcel() {
  const records = getFilteredRecords();
  const rows = records.map((record) => ({
    Nombre: record.name,
    Número: record.studentCode || "Manual",
    Edad: record.age || "",
    Grupo: record.groupLabel,
    Encargado: record.guardianName || "",
    Teléfono: record.guardianPhone || "",
    Fecha: record.date,
    Hora: record.time
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");
  XLSX.writeFile(workbook, "asistencia-prfwb.xlsx");
}

// Exporta a PDF usando jsPDF y AutoTable desde CDN.
function exportToPdf() {
  const records = getFilteredRecords();
  const { jsPDF } = window.jspdf;
  const documentPdf = new jsPDF();

  documentPdf.setFontSize(16);
  documentPdf.text("Asistencia Ministerio CRECE PRFWB", 14, 18);

  documentPdf.autoTable({
    startY: 28,
    head: [["Nombre", "Número", "Edad", "Grupo", "Encargado", "Teléfono", "Fecha", "Hora"]],
    body: records.map((record) => [
      record.name,
      record.studentCode || "Manual",
      record.age || "",
      record.groupLabel,
      record.guardianName || "",
      record.guardianPhone || "",
      record.date,
      record.time
    ])
  });

  documentPdf.save("asistencia-prfwb.pdf");
}

// Borra solamente la data local de demostracion.
function clearLocalRecords() {
  const confirmed = window.confirm("¿Deseas borrar todos los registros locales?");

  if (!confirmed) {
    return;
  }

  localStorage.removeItem(storageKey(ADMIN_STORAGE_KEY));
  attendanceRecords = [];
  renderDashboard();
}

// Conecta botones, búsqueda y cierre de sesion.
function setupAdminEvents() {
  document.getElementById("searchInput").addEventListener("input", renderDashboard);
  document.getElementById("studentProfileSearch").addEventListener("input", renderStudentProfiles);
  document.getElementById("studentProfileGroup").addEventListener("change", renderStudentProfiles);
  document.getElementById("exportExcel").addEventListener("click", exportToExcel);
  document.getElementById("exportPdf").addEventListener("click", exportToPdf);
  document.getElementById("clearDemoData").addEventListener("click", clearLocalRecords);
  document.getElementById("logoutAdmin").addEventListener("click", () => window.PRFirebase.logout());
}

// Punto de entrada del panel administrativo.
document.addEventListener("DOMContentLoaded", async () => {
  if (window.PRFirebase && typeof window.PRFirebase.requireAuth === "function") {
    const profile = await window.PRFirebase.requireAuth({ adminOnly: true });
    if (!profile) {
      return;
    }
  } else {
    window.location.href = "login.html";
  }

  await loadSharedAdminData();
  setupAdminEvents();
  renderDashboard();
});
