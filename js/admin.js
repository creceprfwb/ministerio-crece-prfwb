// El panel administrativo usa los mismos registros creados por app.js.
const ADMIN_STORAGE_KEY = "prfwb_attendance_records";
const ADMIN_STUDENTS_STORAGE_KEY = "prfwb_student_records";

let attendanceRecords = [];
let studentRecords = [];
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

// Carga datos compartidos desde Firebase y conserva una copia local.
async function loadSharedAdminData() {
  attendanceRecords = loadAttendanceRecords();
  studentRecords = loadStudentRecords();

  if (!window.PRFirebase || !window.PRFirebase.enabled) {
    return;
  }

  try {
    const [cloudAttendance, cloudStudents] = await Promise.all([
      window.PRFirebase.getAttendance(),
      window.PRFirebase.getStudents()
    ]);

    if (cloudAttendance.length) {
      attendanceRecords = cloudAttendance;
      localStorage.setItem(storageKey(ADMIN_STORAGE_KEY), JSON.stringify(attendanceRecords));
    }

    if (cloudStudents.length) {
      studentRecords = cloudStudents;
      localStorage.setItem(storageKey(ADMIN_STUDENTS_STORAGE_KEY), JSON.stringify(studentRecords));
    }
  } catch (error) {
    console.warn("No se pudo cargar la data compartida.", error);
  }
}

// Normaliza texto para que la busqueda sea mas flexible.
function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Filtra por nombre o grupo segun lo que escriba el administrador.
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

  document.getElementById("totalAttendance").textContent = summary.total;
  document.getElementById("totalNinos").textContent = summary.ninos;
  document.getElementById("totalJuveniles").textContent = summary.juveniles;
  document.getElementById("totalStudents").textContent = studentRecords.length;
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
  renderChart(records);
}

// Exporta a Excel usando SheetJS desde CDN.
function exportToExcel() {
  const records = getFilteredRecords();
  const rows = records.map((record) => ({
    Nombre: record.name,
    Numero: record.studentCode || "Manual",
    Edad: record.age || "",
    Grupo: record.groupLabel,
    Encargado: record.guardianName || "",
    Telefono: record.guardianPhone || "",
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
    head: [["Nombre", "Numero", "Edad", "Grupo", "Encargado", "Telefono", "Fecha", "Hora"]],
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

// Conecta botones, busqueda y cierre de sesion.
function setupAdminEvents() {
  document.getElementById("searchInput").addEventListener("input", renderDashboard);
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
