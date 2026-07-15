// Claves usadas por la aplicacion para guardar datos locales durante el prototipo.
const ATTENDANCE_STORAGE_KEY = "prfwb_attendance_records";
const STUDENTS_STORAGE_KEY = "prfwb_student_records";

function storageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

// Etiquetas oficiales para los grupos.
const GROUP_LABELS = {
  ninos: "Niños",
  juveniles: "Juveniles"
};

// Lee todos los registros de asistencia guardados en el navegador.
function getAttendanceRecords() {
  const rawRecords = localStorage.getItem(storageKey(ATTENDANCE_STORAGE_KEY));
  return rawRecords ? JSON.parse(rawRecords) : [];
}

// Guarda todos los registros de asistencia.
function saveAttendanceRecords(records) {
  localStorage.setItem(storageKey(ATTENDANCE_STORAGE_KEY), JSON.stringify(records));
}

// Baja la asistencia de Firestore para validar duplicados con la data mas reciente.
async function syncAttendanceFromCloud() {
  if (!window.PRFirebase || !window.PRFirebase.enabled || typeof window.PRFirebase.getAttendance !== "function") {
    return;
  }

  try {
    const cloudAttendance = await window.PRFirebase.getAttendance();

    if (cloudAttendance.length) {
      localStorage.setItem(storageKey(ATTENDANCE_STORAGE_KEY), JSON.stringify(cloudAttendance));
    }
  } catch (error) {
    console.warn("No se pudo cargar la asistencia compartida.", error);
  }
}

// Lee los estudiantes creados desde el panel de maestra.
function getStudentRecords() {
  const rawStudents = localStorage.getItem(storageKey(STUDENTS_STORAGE_KEY));
  return rawStudents ? JSON.parse(rawStudents) : [];
}

// Baja los estudiantes de Firestore cuando Firebase este configurado.
async function syncStudentsFromCloud() {
  if (!window.PRFirebase || !window.PRFirebase.enabled || typeof window.PRFirebase.getStudents !== "function") {
    return;
  }

  try {
    const cloudStudents = await window.PRFirebase.getStudents();

    if (cloudStudents.length) {
      localStorage.setItem(storageKey(STUDENTS_STORAGE_KEY), JSON.stringify(cloudStudents));
    }
  } catch (error) {
    console.warn("No se pudieron cargar estudiantes compartidos.", error);
  }
}

// Limpia el valor escaneado o escrito para que el codigo funcione aunque venga con espacios.
function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

// Normaliza texto para busquedas por nombre sin importar acentos o mayusculas.
function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isActiveStudent(student) {
  return student && student.active !== false;
}

// Crea una fecha estable para evitar asistencia duplicada el mismo dia.
function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Busca un estudiante por su numero.
function findStudentByCode(code) {
  const cleanCode = normalizeCode(code);
  return getStudentRecords().find((student) => isActiveStudent(student) && normalizeCode(student.code) === cleanCode);
}

// Busca estudiantes por nombre cuando perdieron el numero o QR.
function findStudentsByName(query) {
  const cleanQuery = normalizeText(query);

  if (cleanQuery.length < 2) {
    return [];
  }

  return getStudentRecords()
    .filter((student) => isActiveStudent(student) && normalizeText(student.name).includes(cleanQuery))
    .slice(0, 8);
}

// Crea un registro de asistencia usando el estudiante ya registrado.
function buildAttendanceRecord(student) {
  const now = new Date();
  const dateKey = getDateKey(now);

  return {
    id: `${normalizeCode(student.code)}_${dateKey}`,
    studentId: student.id,
    studentCode: student.code,
    name: student.name,
    age: student.age,
    guardianName: student.guardianName || "",
    guardianPhone: student.guardianPhone || "",
    emergencyPhone: student.emergencyPhone || "",
    group: student.group,
    groupLabel: student.groupLabel,
    dateKey,
    date: now.toLocaleDateString("es-PR"),
    time: now.toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" }),
    createdAt: now.toISOString()
  };
}

// Verifica si ya existe asistencia para este estudiante en el dia actual.
function hasAttendanceToday(student) {
  const todayKey = getDateKey();
  const todayLabel = new Date().toLocaleDateString("es-PR");
  const studentCode = normalizeCode(student.code);

  return getAttendanceRecords().some((record) => {
    return normalizeCode(record.studentCode) === studentCode
      && (record.dateKey === todayKey || record.date === todayLabel);
  });
}

// Muestra los datos del estudiante antes de guardar la asistencia.
function showStudentPreview(student) {
  const preview = document.getElementById("studentPreview");

  if (!preview) {
    return;
  }

  if (!student) {
    preview.classList.remove("d-none");
    preview.innerHTML = `
      <i class="bi bi-exclamation-circle"></i>
      <div>
        <strong>Estudiante no encontrado</strong>
        <span>Verifica el numero o registralo primero en el panel de maestra.</span>
      </div>
    `;
    return;
  }

  preview.classList.remove("d-none");
  preview.innerHTML = `
    <i class="bi bi-person-check"></i>
    <div>
      <strong>${student.name}</strong>
      <span>${student.code} · ${student.age} años · ${student.groupLabel}</span>
    </div>
  `;
}

// Muestra una notificacion corta si Bootstrap esta disponible.
function showToast(message, variant = "primary") {
  const toastElement = document.getElementById("appToast");
  const toastBody = toastElement ? toastElement.querySelector(".toast-body") : null;

  if (toastElement && window.bootstrap) {
    toastElement.className = `toast align-items-center text-bg-${variant} border-0`;
    if (toastBody) {
      toastBody.textContent = message;
    }
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
  }
}

// Muestra la fecha del dia en la pantalla de asistencia.
function showCurrentAttendanceDate() {
  const dateBox = document.getElementById("currentAttendanceDate");

  if (!dateBox) {
    return;
  }

  const today = new Date();
  const formattedDate = today.toLocaleDateString("es-PR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  dateBox.innerHTML = `
    <i class="bi bi-calendar-event"></i>
    <span>${formattedDate}</span>
  `;
}

// Activa el lector de QR usando la camara del dispositivo cuando el navegador lo permite.
function setupQrScanner() {
  const scanButton = document.getElementById("scanQrButton");
  const scannerPanel = document.getElementById("scannerPanel");
  const codeInput = document.getElementById("studentCode");

  if (!scanButton || !scannerPanel || !codeInput || !window.Html5Qrcode) {
    return;
  }

  let scanner = null;
  let isRunning = false;

  scanButton.addEventListener("click", async () => {
    if (isRunning && scanner) {
      await scanner.stop();
      scannerPanel.classList.add("d-none");
      scanButton.innerHTML = '<i class="bi bi-camera"></i> ESCANEAR QR';
      isRunning = false;
      return;
    }

    scannerPanel.classList.remove("d-none");
    scanner = new Html5Qrcode("qrReader");

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      async (decodedText) => {
        codeInput.value = normalizeCode(decodedText);
        showStudentPreview(findStudentByCode(decodedText));
        await scanner.stop();
        scannerPanel.classList.add("d-none");
        scanButton.innerHTML = '<i class="bi bi-camera"></i> ESCANEAR QR';
        isRunning = false;
      }
    );

    scanButton.innerHTML = '<i class="bi bi-x-circle"></i> DETENER CAMARA';
    isRunning = true;
  });
}

// Permite seleccionar un estudiante por nombre y copia su numero al campo principal.
function setupNameSearch() {
  const searchInput = document.getElementById("studentNameSearch");
  const resultsPanel = document.getElementById("nameSearchResults");
  const codeInput = document.getElementById("studentCode");

  if (!searchInput || !resultsPanel || !codeInput) {
    return;
  }

  searchInput.addEventListener("input", () => {
    const results = findStudentsByName(searchInput.value);

    if (!results.length) {
      resultsPanel.classList.toggle("d-none", normalizeText(searchInput.value).length < 2);
      resultsPanel.innerHTML = normalizeText(searchInput.value).length >= 2
        ? '<div class="text-muted small">No se encontraron estudiantes.</div>'
        : "";
      return;
    }

    resultsPanel.classList.remove("d-none");
    resultsPanel.innerHTML = results.map((student) => `
      <button class="student-result-button" type="button" data-code="${student.code}">
        <span>
          <strong>${student.name}</strong>
          <span>${student.code} · ${student.age} años · ${student.groupLabel}</span>
        </span>
        <i class="bi bi-chevron-right"></i>
      </button>
    `).join("");

    resultsPanel.querySelectorAll(".student-result-button").forEach((button) => {
      button.addEventListener("click", () => {
        const student = findStudentByCode(button.dataset.code);
        codeInput.value = student.code;
        searchInput.value = student.name;
        resultsPanel.classList.add("d-none");
        showStudentPreview(student);
      });
    });
  });
}

// Controla el formulario principal de asistencia.
async function setupAttendanceForm() {
  const form = document.getElementById("attendanceForm");
  const codeInput = document.getElementById("studentCode");

  if (!form || !codeInput) {
    return;
  }

  if (window.PRFirebase && typeof window.PRFirebase.requireAuth === "function") {
    const profile = await window.PRFirebase.requireAuth();
    if (!profile) {
      return;
    }
  }

  await syncStudentsFromCloud();
  await syncAttendanceFromCloud();
  showCurrentAttendanceDate();
  setupQrScanner();
  setupNameSearch();

  codeInput.addEventListener("input", () => {
    const code = normalizeCode(codeInput.value);
    if (code.length >= 5) {
      showStudentPreview(findStudentByCode(code));
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    await syncStudentsFromCloud();
    await syncAttendanceFromCloud();
    const student = findStudentByCode(codeInput.value);

    if (!student) {
      showStudentPreview(null);
      return;
    }

    if (hasAttendanceToday(student)) {
      showStudentPreview(student);
      showToast("Este estudiante ya tiene asistencia registrada hoy.", "warning");
      form.reset();
      return;
    }

    const record = buildAttendanceRecord(student);
    const records = getAttendanceRecords();
    records.unshift(record);
    saveAttendanceRecords(records);

    // Si se configura Firebase en js/firebase.js, esta funcion tambien guardara el registro en la nube.
    if (window.PRFirebase && typeof window.PRFirebase.saveAttendance === "function") {
      await window.PRFirebase.saveAttendance(record);
    }

    showToast("Asistencia registrada correctamente.", "primary");
    form.reset();
    showStudentPreview(student);
  });
}

document.addEventListener("DOMContentLoaded", setupAttendanceForm);
