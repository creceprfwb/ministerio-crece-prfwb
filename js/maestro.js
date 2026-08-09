// Clave local para guardar estudiantes hasta conectar Firebase, Supabase o Google Sheets.
const STUDENTS_STORAGE_KEY = "prfwb_student_records";
const ATTENDANCE_STORAGE_KEY = "prfwb_attendance_records";
const REWARD_ACTIONS = [
  { id: "asistencia", label: "Asistencia del domingo", points: 5, icon: "bi-calendar-check" },
  { id: "biblia", label: "Trajo Biblia", points: 3, icon: "bi-book" },
  { id: "versículo", label: "Memorizó versículo", points: 3, icon: "bi-chat-quote" },
  { id: "tarea", label: "Completo tarea del hogar", points: 2, icon: "bi-house-check" },
  { id: "participacion", label: "Participo con respeto", points: 2, icon: "bi-hand-thumbs-up" },
  { id: "invitado", label: "Trajo invitado", points: 2, icon: "bi-person-plus" },
  { id: "servicio", label: "Ayudo o sirvio a otro", points: 1, icon: "bi-heart" },
  { id: "canje", label: "Canje de premio", points: -25, icon: "bi-gift" }
];

const REWARD_LEVELS = [
  { name: "Semilla CRECE", points: 0 },
  { name: "Brote CRECE", points: 25 },
  { name: "Raiz Firme", points: 50 },
  { name: "Luz CRECE", points: 100 },
  { name: "Discipulo CRECE", points: 150 },
  { name: "Embajador CRECE", points: 200 }
];

const REWARD_PRIZE_POINTS = 25;

let students = [];
let selectedQrStudent = null;
let editingStudentCode = null;
let selectedRewardStudentCode = null;
let selectedInlineQrCode = null;

function storageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

// Determina automáticamente el grupo según la edad.
function getGroupByAge(age) {
  if (age >= 3 && age <= 10) {
    return { group: "ninos", groupLabel: "Niños" };
  }

  if (age >= 11 && age <= 16) {
    return { group: "juveniles", groupLabel: "Juveniles" };
  }

  return null;
}

function getGroupByOverride(group) {
  if (group === "ninos") {
    return { group: "ninos", groupLabel: "Ninos" };
  }

  if (group === "juveniles") {
    return { group: "juveniles", groupLabel: "Juveniles" };
  }

  return null;
}

// Lee los estudiantes guardados localmente.
function loadStudents() {
  const rawStudents = localStorage.getItem(storageKey(STUDENTS_STORAGE_KEY));
  return rawStudents ? JSON.parse(rawStudents) : [];
}

// Guarda la lista completa de estudiantes.
function saveStudents(records) {
  localStorage.setItem(storageKey(STUDENTS_STORAGE_KEY), JSON.stringify(records));
}

// Carga estudiantes desde Firestore si ya se configuro Firebase.
async function loadSharedStudents() {
  students = loadStudents();

  if (!window.PRFirebase || !window.PRFirebase.enabled || typeof window.PRFirebase.getStudents !== "function") {
    return;
  }

  try {
    const cloudStudents = await window.PRFirebase.getStudents();

    if (cloudStudents.length) {
      students = cloudStudents;
      saveStudents(students);
    }
  } catch (error) {
    console.warn("No se pudieron cargar estudiantes compartidos.", error);
  }
}

// Genera un número fácil de leer para el estudiante.
function createStudentCode() {
  const number = Math.floor(100000 + Math.random() * 900000);
  return `PRF-${number}`;
}

// Evita repetir codigos en el navegador actual.
function createUniqueStudentCode() {
  let code = createStudentCode();

  while (students.some((student) => student.code === code)) {
    code = createStudentCode();
  }

  return code;
}

// Normaliza texto para busquedas.
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

function formatPhoneNumber(value) {
  const rawValue = String(value || "").trim();
  const digits = rawValue.replace(/\D/g, "");

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return rawValue;
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

function calculateAgeFromBirthDate(value) {
  if (!value) {
    return "";
  }

  const birthDate = new Date(`${value}T00:00:00`);
  const today = new Date();

  if (Number.isNaN(birthDate.getTime())) {
    return "";
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function loadAttendanceRecords() {
  const rawRecords = localStorage.getItem(storageKey(ATTENDANCE_STORAGE_KEY));
  return rawRecords ? JSON.parse(rawRecords) : [];
}

function getAttendanceForStudent(student) {
  const studentCode = String(student.code || "").toUpperCase();

  return loadAttendanceRecords()
    .filter((record) => String(record.studentCode || "").toUpperCase() === studentCode)
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
}

function getProfileFlags(student) {
  const flags = [];

  if (student.allergies) {
    flags.push("Alergias");
  }

  if (student.medicalNotes) {
    flags.push("Condicion");
  }

  if (student.careNotes) {
    flags.push("Notas");
  }

  if (student.studentStatus === "visitor") {
    flags.push("Visita");
  }

  if (student.studentStatus === "firstTime") {
    flags.push("Primera vez");
  }

  if (student.idDeliveryStatus && student.idDeliveryStatus !== "none") {
    flags.push("ID/Pulsera");
  }

  return flags;
}

function normalizeRewardData(student) {
  return {
    ...student,
    rewardPoints: Number(student.rewardPoints || 0),
    rewardHistory: Array.isArray(student.rewardHistory) ? student.rewardHistory : []
  };
}

function getRewardLevel(points) {
  return REWARD_LEVELS.reduce((currentLevel, level) => {
    return points >= level.points ? level : currentLevel;
  }, REWARD_LEVELS[0]);
}

function getNextRewardLevel(points) {
  return REWARD_LEVELS.find((level) => points < level.points) || null;
}

function getRewardProgress(points) {
  const currentLevel = getRewardLevel(points);
  const nextLevel = getNextRewardLevel(points);

  if (!nextLevel) {
    return 100;
  }

  const levelRange = nextLevel.points - currentLevel.points;
  const progress = ((points - currentLevel.points) / levelRange) * 100;
  return Math.max(0, Math.min(100, progress));
}

function getDeliveredPrizeCount(student) {
  return (student.rewardHistory || []).filter((entry) => {
    return entry.deliveredPrize || entry.reason === "Premio entregado" || entry.reason === "Canje de premio";
  }).length;
}

function getAvailablePrizeCount(student) {
  return Math.floor(Number(student.rewardPoints || 0) / REWARD_PRIZE_POINTS);
}

function getRewardHistoryDate(entry) {
  return entry.createdAt
    ? new Date(entry.createdAt).toLocaleDateString("es-PR")
    : "";
}

// Crea el objeto del estudiante registrado.
function buildStudentRecord(formData) {
  const age = Number(formData.get("studentAge"));
  const groupOverride = String(formData.get("studentGroupOverride") || "");
  const groupInfo = getGroupByOverride(groupOverride) || getGroupByAge(age);

  if (!groupInfo) {
    throw new Error("La edad debe estar entre 3 y 16 años.");
  }

  const now = new Date();

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    code: createUniqueStudentCode(),
    name: String(formData.get("studentName") || "").trim(),
    lastName: String(formData.get("studentLastName") || "").trim(),
    fullName: String(`${formData.get("studentName") || ""} ${formData.get("studentLastName") || ""}`).trim(),
    age,
    birthDate: String(formData.get("studentBirthDate") || "").trim(),
    group: groupInfo.group,
    groupLabel: groupInfo.groupLabel,
    groupOverride,
    studentStatus: String(formData.get("studentStatus") || "regular"),
    guardianName: String(formData.get("guardianName") || "").trim(),
    guardianRelationship: String(formData.get("guardianRelationship") || "padre_madre"),
    guardianPhone: formatPhoneNumber(formData.get("guardianPhone")),
    emergencyPhone: formatPhoneNumber(formData.get("emergencyPhone")),
    guardianEmail: String(formData.get("guardianEmail") || "").trim(),
    guardianEmailSecondary: String(formData.get("guardianEmailSecondary") || "").trim(),
    authorizedPickup: String(formData.get("authorizedPickup") || "").trim(),
    idDeliveryStatus: String(formData.get("idDeliveryStatus") || "none"),
    visitNotes: String(formData.get("visitNotes") || "").trim(),
    allergies: String(formData.get("allergies") || "").trim(),
    medicalNotes: String(formData.get("medicalNotes") || "").trim(),
    careNotes: String(formData.get("careNotes") || "").trim(),
    active: true,
    rewardPoints: 0,
    rewardHistory: [],
    createdAt: now.toISOString()
  };
}

// Actualiza un estudiante existente sin cambiar su número ni QR.
function buildUpdatedStudentRecord(existingStudent, formData) {
  const age = Number(formData.get("studentAge"));
  const groupOverride = String(formData.get("studentGroupOverride") || "");
  const groupInfo = getGroupByOverride(groupOverride) || getGroupByAge(age);

  if (!groupInfo) {
    throw new Error("La edad debe estar entre 3 y 16 años.");
  }

  return {
    ...existingStudent,
    name: String(formData.get("studentName") || "").trim(),
    lastName: String(formData.get("studentLastName") || "").trim(),
    fullName: String(`${formData.get("studentName") || ""} ${formData.get("studentLastName") || ""}`).trim(),
    age,
    birthDate: String(formData.get("studentBirthDate") || "").trim(),
    group: groupInfo.group,
    groupLabel: groupInfo.groupLabel,
    groupOverride,
    studentStatus: String(formData.get("studentStatus") || "regular"),
    guardianName: String(formData.get("guardianName") || "").trim(),
    guardianRelationship: String(formData.get("guardianRelationship") || "padre_madre"),
    guardianPhone: formatPhoneNumber(formData.get("guardianPhone")),
    emergencyPhone: formatPhoneNumber(formData.get("emergencyPhone")),
    guardianEmail: String(formData.get("guardianEmail") || "").trim(),
    guardianEmailSecondary: String(formData.get("guardianEmailSecondary") || "").trim(),
    authorizedPickup: String(formData.get("authorizedPickup") || "").trim(),
    idDeliveryStatus: String(formData.get("idDeliveryStatus") || "none"),
    visitNotes: String(formData.get("visitNotes") || "").trim(),
    allergies: String(formData.get("allergies") || "").trim(),
    medicalNotes: String(formData.get("medicalNotes") || "").trim(),
    careNotes: String(formData.get("careNotes") || "").trim(),
    active: existingStudent.active !== false,
    rewardPoints: Number(existingStudent.rewardPoints || 0),
    rewardHistory: Array.isArray(existingStudent.rewardHistory) ? existingStudent.rewardHistory : [],
    updatedAt: new Date().toISOString()
  };
}

function getStudentByCode(code) {
  return students.find((student) => student.code === code);
}

function fillStudentForm(student) {
  document.getElementById("studentName").value = student.name || "";
  document.getElementById("studentLastName").value = student.lastName || "";
  document.getElementById("studentAge").value = student.age || "";
  document.getElementById("studentBirthDate").value = student.birthDate || "";
  document.getElementById("studentGroupOverride").value = student.groupOverride || "";
  document.getElementById("studentStatus").value = student.studentStatus || "regular";
  document.getElementById("guardianName").value = student.guardianName || "";
  document.getElementById("guardianPhone").value = student.guardianPhone || "";
  document.getElementById("emergencyPhone").value = student.emergencyPhone || "";
  document.getElementById("guardianEmail").value = student.guardianEmail || "";
  document.getElementById("guardianEmailSecondary").value = student.guardianEmailSecondary || "";
  document.getElementById("guardianRelationship").value = student.guardianRelationship || "padre_madre";
  document.getElementById("authorizedPickup").value = student.authorizedPickup || "";
  document.getElementById("idDeliveryStatus").value = student.idDeliveryStatus || "none";
  document.getElementById("visitNotes").value = student.visitNotes || "";
  document.getElementById("allergies").value = student.allergies || "";
  document.getElementById("medicalNotes").value = student.medicalNotes || "";
  document.getElementById("careNotes").value = student.careNotes || "";
}

function setStudentFormMode(mode) {
  const isEditing = mode === "edit";
  const title = document.getElementById("studentFormTitle");
  const help = document.getElementById("studentFormHelp");
  const submitButton = document.getElementById("studentSubmitButton");
  const cancelButton = document.getElementById("cancelStudentEdit");

  title.textContent = isEditing ? "Editar estudiante" : "Nuevo estudiante";
  help.textContent = isEditing
    ? "Actualiza la información sin cambiar el número ni el QR."
    : "Al guardar se genera un número y código QR.";
  submitButton.innerHTML = isEditing
    ? '<i class="bi bi-save"></i> GUARDAR CAMBIOS'
    : '<i class="bi bi-person-plus"></i> REGISTRAR Y CREAR QR';
  cancelButton.classList.toggle("d-none", !isEditing);
}

function resetStudentForm(form) {
  editingStudentCode = null;
  form.reset();
  setStudentFormMode("create");
}

// Dibuja el QR del estudiante seleccionado.
function renderQr(student) {
  const result = document.getElementById("qrResult");
  const downloadButton = document.getElementById("downloadQr");

  selectedQrStudent = student;
  result.innerHTML = "";
  result.classList.remove("empty-state");

  const title = document.createElement("strong");
  title.textContent = getStudentDisplayName(student);

  const code = document.createElement("span");
  code.textContent = `${student.code} · ${student.groupLabel}`;

  const qrHolder = document.createElement("div");
  qrHolder.className = "qr-holder";

  result.append(title, code, qrHolder);

  new QRCode(qrHolder, {
    text: student.code,
    width: 180,
    height: 180,
    colorDark: "#0B3D91",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  downloadButton.disabled = false;
}

function renderInlineQr(student) {
  const holder = document.querySelector(`[data-inline-qr="${student.code}"]`);

  if (!holder) {
    return;
  }

  holder.innerHTML = "";

  new QRCode(holder, {
    text: student.code,
    width: 142,
    height: 142,
    colorDark: "#0B3D91",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function downloadQrCanvas(canvas, student) {
  if (!canvas || !student) {
    return;
  }

  const link = document.createElement("a");
  link.download = `${student.code}-${getStudentDisplayName(student)}.png`.replace(/\s+/g, "-");
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function buildProfileNote(label, value, icon, tone = "") {
  return `
    <article class="profile-note ${tone}">
      <i class="bi ${icon}"></i>
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(value || "No registrado")}</span>
      </div>
    </article>
  `;
}

function openStudentProfile(student) {
  const normalizedStudent = normalizeRewardData(student);
  const modalElement = document.getElementById("studentProfileModal");
  const title = document.getElementById("studentProfileTitle");
  const content = document.getElementById("studentProfileContent");
  const editButton = document.getElementById("profileEditStudent");
  const rewardLevel = getRewardLevel(normalizedStudent.rewardPoints);
  const nextLevel = getNextRewardLevel(normalizedStudent.rewardPoints);
  const attendance = getAttendanceForStudent(normalizedStudent);
  const latestAttendance = attendance[0];
  const attendanceRows = attendance.slice(0, 8).map((record) => `
    <tr>
      <td>${escapeHtml(record.date || "")}</td>
      <td>${escapeHtml(record.time || "")}</td>
      <td>${escapeHtml(record.groupLabel || "")}</td>
    </tr>
  `).join("");

  title.textContent = getStudentDisplayName(normalizedStudent);
  editButton.dataset.code = normalizedStudent.code;

  content.innerHTML = `
    <section class="student-profile-grid">
      <article class="student-profile-summary">
        <div class="profile-avatar">${escapeHtml((normalizedStudent.name || "?").charAt(0))}</div>
        <div>
          <span class="profile-code">${escapeHtml(normalizedStudent.code)}</span>
          <h3>${escapeHtml(getStudentDisplayName(normalizedStudent))}</h3>
          <p>${escapeHtml(normalizedStudent.groupLabel || "")} - ${escapeHtml(normalizedStudent.age || "")} anos</p>
          <p>Nacimiento: ${escapeHtml(formatDate(normalizedStudent.birthDate))}</p>
        </div>
      </article>

      <article class="student-profile-progress">
        <div>
          <span>Progreso CRECE</span>
          <strong>${escapeHtml(rewardLevel.name)}</strong>
          <small>${normalizedStudent.rewardPoints} puntos${nextLevel ? ` - proxima meta ${nextLevel.points}` : " - meta mayor alcanzada"}</small>
        </div>
        <div class="reward-progress"><span style="width: ${getRewardProgress(normalizedStudent.rewardPoints)}%"></span></div>
      </article>

      <div class="profile-note-grid">
        ${buildProfileNote("Encargado", normalizedStudent.guardianName, "bi-person-badge")}
        ${buildProfileNote("Parentesco", getRelationshipLabel(normalizedStudent.guardianRelationship), "bi-diagram-3")}
        ${buildProfileNote("Telefono principal", normalizedStudent.guardianPhone, "bi-telephone")}
        ${buildProfileNote("Telefono alterno", normalizedStudent.emergencyPhone, "bi-telephone-plus")}
        ${buildProfileNote("Email principal", normalizedStudent.guardianEmail, "bi-envelope")}
        ${buildProfileNote("Segundo email", normalizedStudent.guardianEmailSecondary, "bi-envelope-plus")}
        ${buildProfileNote("Tipo de registro", getStudentStatusLabel(normalizedStudent.studentStatus), "bi-person-lines-fill", normalizedStudent.studentStatus === "regular" ? "" : "visitor")}
        ${buildProfileNote("Pulserita o ID", getIdDeliveryLabel(normalizedStudent.idDeliveryStatus), "bi-person-badge-fill", normalizedStudent.idDeliveryStatus && normalizedStudent.idDeliveryStatus !== "none" ? "success" : "")}
        ${buildProfileNote("Recogido autorizado", normalizedStudent.authorizedPickup, "bi-shield-check")}
        ${buildProfileNote("Alergias", normalizedStudent.allergies, "bi-exclamation-triangle", normalizedStudent.allergies ? "warning" : "")}
        ${buildProfileNote("Notas medicas", normalizedStudent.medicalNotes, "bi-heart-pulse", normalizedStudent.medicalNotes ? "warning" : "")}
        ${buildProfileNote("Notas de visita", normalizedStudent.visitNotes, "bi-door-open", normalizedStudent.visitNotes ? "visitor" : "")}
        ${buildProfileNote("Notas para la clase", normalizedStudent.careNotes, "bi-journal-text", normalizedStudent.careNotes ? "note" : "")}
      </div>

      <article class="student-attendance-card">
        <div class="attendance-metric">
          <span>Asistencias</span>
          <strong>${attendance.length}</strong>
          <small>Ultima: ${escapeHtml(latestAttendance ? latestAttendance.date : "Sin asistencia")}</small>
        </div>
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Grupo</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceRows || '<tr><td colspan="3" class="text-muted">Todavia no tiene asistencia registrada.</td></tr>'}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;

  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  modal.show();
}

function editStudentFromProfile(code) {
  const student = getStudentByCode(code);

  if (!student) {
    return;
  }

  editingStudentCode = student.code;
  fillStudentForm(student);
  setStudentFormMode("edit");
  bootstrap.Modal.getOrCreateInstance(document.getElementById("studentProfileModal")).hide();
  document.getElementById("studentForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Pinta la tabla de estudiantes registrados.
function renderStudentsTable() {
  const tableBody = document.getElementById("studentsTable");
  const search = normalizeText(document.getElementById("studentSearch").value);
  const visibleStudents = students.filter((student) => {
    return !search || normalizeText(`${student.code} ${getStudentDisplayName(student)} ${student.guardianName} ${student.guardianPhone} ${student.emergencyPhone} ${student.guardianEmail} ${student.guardianEmailSecondary} ${student.groupLabel} ${getRelationshipLabel(student.guardianRelationship)} ${getStudentStatusLabel(student.studentStatus)}`).includes(search);
  });

  if (!visibleStudents.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center text-muted py-4">No hay estudiantes registrados.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = visibleStudents.map((rawStudent) => {
    const student = normalizeRewardData(rawStudent);
    const rewardLevel = getRewardLevel(student.rewardPoints);
    const profileFlags = getProfileFlags(student);

    const inlineQrRow = selectedInlineQrCode === student.code ? `
    <tr class="inline-qr-row">
      <td colspan="11">
        <div class="inline-qr-card">
          <div>
            <p class="section-kicker mb-1">Codigo QR</p>
            <h3>${escapeHtml(getStudentDisplayName(student))}</h3>
            <span>${escapeHtml(student.code)} - ${escapeHtml(student.groupLabel)}</span>
          </div>
          <div class="inline-qr-holder" data-inline-qr="${escapeHtml(student.code)}"></div>
          <div class="inline-qr-actions">
            <button class="btn btn-sm btn-outline-primary download-inline-qr" type="button" data-code="${escapeHtml(student.code)}">
              <i class="bi bi-download"></i>
              Descargar
            </button>
            <button class="btn btn-sm btn-outline-secondary close-inline-qr" type="button" data-code="${escapeHtml(student.code)}">
              Cerrar
            </button>
          </div>
        </div>
      </td>
    </tr>
  ` : "";

    return `
    <tr class="${student.active === false ? "inactive-student" : ""}">
      <td><strong>${escapeHtml(student.code)}</strong></td>
      <td>
        <button class="student-name-button view-student-profile" type="button" data-code="${escapeHtml(student.code)}">
          ${escapeHtml(getStudentDisplayName(student))}
        </button>
      </td>
      <td>
        <strong>${escapeHtml(student.age)}</strong>
        <span class="table-subtext">${escapeHtml(formatDate(student.birthDate))}</span>
      </td>
      <td>${escapeHtml(student.groupLabel)}</td>
      <td>${escapeHtml(student.guardianName || "")}</td>
      <td>
        ${profileFlags.length
          ? `<span class="badge text-bg-warning">${escapeHtml(profileFlags.join(" / "))}</span>`
          : '<span class="text-muted small">Sin notas</span>'}
      </td>
      <td>${escapeHtml(student.guardianPhone || "")}</td>
      <td>
        <button class="reward-pill manage-rewards" type="button" data-code="${escapeHtml(student.code)}">
          <strong>${student.rewardPoints}</strong>
          <span>${escapeHtml(rewardLevel.name)}</span>
        </button>
      </td>
      <td>
        <span class="badge ${student.active === false ? "text-bg-secondary" : "text-bg-success"}">
          ${student.active === false ? "Inactivo" : "Activo"}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary show-qr" type="button" data-code="${student.code}">
          <i class="bi bi-qr-code"></i> ${selectedInlineQrCode === student.code ? "Ocultar" : "Ver"}
        </button>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-outline-secondary edit-student" type="button" data-code="${student.code}">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="btn btn-sm ${student.active === false ? "btn-outline-success" : "btn-outline-warning"} toggle-student" type="button" data-code="${student.code}">
            <i class="bi ${student.active === false ? "bi-check-circle" : "bi-slash-circle"}"></i>
          </button>
        </div>
      </td>
    </tr>
    ${inlineQrRow}
  `;
  }).join("");

  if (selectedInlineQrCode) {
    const selectedStudent = getStudentByCode(selectedInlineQrCode);
    if (selectedStudent) {
      renderInlineQr(selectedStudent);
    }
  }

  tableBody.querySelectorAll(".show-qr").forEach((button) => {
    button.addEventListener("click", () => {
      selectedInlineQrCode = selectedInlineQrCode === button.dataset.code ? null : button.dataset.code;
      renderStudentsTable();
    });
  });

  tableBody.querySelectorAll(".close-inline-qr").forEach((button) => {
    button.addEventListener("click", () => {
      if (selectedInlineQrCode === button.dataset.code) {
        selectedInlineQrCode = null;
      }

      renderStudentsTable();
    });
  });

  tableBody.querySelectorAll(".download-inline-qr").forEach((button) => {
    button.addEventListener("click", () => {
      const student = getStudentByCode(button.dataset.code);
      const row = button.closest(".inline-qr-row");
      const canvas = row ? row.querySelector("canvas") : null;
      downloadQrCanvas(canvas, student);
    });
  });

  tableBody.querySelectorAll(".view-student-profile").forEach((button) => {
    button.addEventListener("click", () => {
      const student = getStudentByCode(button.dataset.code);
      openStudentProfile(student);
    });
  });

  tableBody.querySelectorAll(".edit-student").forEach((button) => {
    button.addEventListener("click", () => {
      const student = getStudentByCode(button.dataset.code);
      editingStudentCode = student.code;
      fillStudentForm(student);
      setStudentFormMode("edit");
      document.getElementById("studentForm").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  tableBody.querySelectorAll(".manage-rewards").forEach((button) => {
    button.addEventListener("click", () => {
      selectedRewardStudentCode = button.dataset.code;
      renderRewardManager();
      document.getElementById("rewardsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  tableBody.querySelectorAll(".toggle-student").forEach((button) => {
    button.addEventListener("click", async () => {
      const student = getStudentByCode(button.dataset.code);
      const updatedStudent = {
        ...student,
        active: student.active === false,
        updatedAt: new Date().toISOString()
      };

      students = students.map((item) => item.code === updatedStudent.code ? updatedStudent : item);
      saveStudents(students);

      if (window.PRFirebase && typeof window.PRFirebase.saveStudent === "function") {
        await window.PRFirebase.saveStudent(updatedStudent);
      }

      renderStudentsTable();
    });
  });
}

function populateRewardControls() {
  const reasonSelect = document.getElementById("rewardReason");
  const quickActions = document.getElementById("rewardQuickActions");

  if (!reasonSelect || !quickActions) {
    return;
  }

  reasonSelect.innerHTML = REWARD_ACTIONS.map((action) => `
    <option value="${action.id}" data-points="${action.points}">
      ${action.label} (${action.points > 0 ? "+" : ""}${action.points})
    </option>
  `).join("");

  quickActions.innerHTML = REWARD_ACTIONS.filter((action) => action.points > 0).map((action) => `
    <button class="reward-chip" type="button" data-action="${action.id}">
      <i class="bi ${action.icon}"></i>
      <span>${action.label}</span>
      <strong>+${action.points}</strong>
    </button>
  `).join("");

  reasonSelect.addEventListener("change", () => {
    const selectedOption = reasonSelect.selectedOptions[0];
    document.getElementById("rewardPoints").value = selectedOption ? selectedOption.dataset.points : "5";
  });

  quickActions.querySelectorAll(".reward-chip").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = REWARD_ACTIONS.find((item) => item.id === button.dataset.action);
      if (!action) {
        return;
      }

      await addRewardPoints(action.points, action.label, "");
    });
  });
}

function renderRewardManager() {
  const emptyState = document.getElementById("rewardEmptyState");
  const manager = document.getElementById("rewardManager");
  const student = selectedRewardStudentCode ? normalizeRewardData(getStudentByCode(selectedRewardStudentCode)) : null;

  if (!emptyState || !manager) {
    return;
  }

  if (!student) {
    emptyState.classList.remove("d-none");
    manager.classList.add("d-none");
    return;
  }

  const level = getRewardLevel(student.rewardPoints);
  const nextLevel = getNextRewardLevel(student.rewardPoints);

  emptyState.classList.add("d-none");
  manager.classList.remove("d-none");

  document.getElementById("rewardStudentName").textContent = getStudentDisplayName(student);
  document.getElementById("rewardStudentMeta").textContent = `${student.code} · ${student.groupLabel}`;
  document.getElementById("rewardStudentPoints").textContent = student.rewardPoints;
  document.getElementById("rewardStudentLevel").textContent = level.name;
  document.getElementById("rewardNextLevel").textContent = nextLevel
    ? `Próxima meta: ${nextLevel.name} a ${nextLevel.points} puntos`
    : "Nivel maximo alcanzado";
  document.getElementById("rewardProgressBar").style.width = `${getRewardProgress(student.rewardPoints)}%`;

  const availablePrizes = getAvailablePrizeCount(student);
  const deliveredPrizes = getDeliveredPrizeCount(student);
  const prizeStatus = document.getElementById("rewardPrizeStatus");
  const prizeHelp = document.getElementById("rewardPrizeHelp");
  const deliverButton = document.getElementById("deliverRewardPrize");

  if (prizeStatus && prizeHelp && deliverButton) {
    prizeStatus.textContent = availablePrizes
      ? `${availablePrizes} premio${availablePrizes === 1 ? "" : "s"} disponible${availablePrizes === 1 ? "" : "s"}`
      : "Sin premio disponible";
    prizeHelp.textContent = `Premios entregados: ${deliveredPrizes}. Próximo premio cada ${REWARD_PRIZE_POINTS} puntos.`;
    deliverButton.disabled = availablePrizes < 1;
  }

  const history = student.rewardHistory || [];
  const historyContainer = document.getElementById("rewardHistory");
  historyContainer.innerHTML = history.length
    ? history.slice(0, 12).map((entry) => `
      <div class="reward-history-item">
        <div>
          <strong>${escapeHtml(entry.reason)}${entry.deliveredPrize ? ' <em class="reward-delivered">Entregado</em>' : ""}</strong>
          <span>${escapeHtml(entry.note || getRewardHistoryDate(entry))}</span>
        </div>
        <div class="reward-history-actions">
          <b class="${entry.points >= 0 ? "reward-positive" : "reward-negative"}">
            ${entry.points > 0 ? "+" : ""}${entry.points}
          </b>
          <button class="btn btn-sm btn-outline-danger delete-reward-entry" type="button" data-id="${escapeHtml(entry.id)}" aria-label="Borrar entrada">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `).join("")
    : '<div class="text-muted small">Todavía no hay puntos registrados.</div>';

  historyContainer.querySelectorAll(".delete-reward-entry").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteRewardEntry(button.dataset.id);
    });
  });
}

async function addRewardPoints(points, reason, note) {
  const student = selectedRewardStudentCode ? normalizeRewardData(getStudentByCode(selectedRewardStudentCode)) : null;

  if (!student) {
    window.alert("Selecciona un estudiante primero.");
    return;
  }

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    points: Number(points),
    reason,
    note: String(note || "").trim(),
    createdAt: new Date().toISOString()
  };

  const updatedStudent = {
    ...student,
    rewardPoints: Math.max(0, Number(student.rewardPoints || 0) + entry.points),
    rewardHistory: [entry, ...(student.rewardHistory || [])],
    updatedAt: new Date().toISOString()
  };

  students = students.map((item) => item.code === updatedStudent.code ? updatedStudent : item);
  saveStudents(students);

  if (window.PRFirebase && typeof window.PRFirebase.saveStudent === "function") {
    await window.PRFirebase.saveStudent(updatedStudent);
  }

  renderStudentsTable();
  renderRewardManager();
}

async function saveRewardStudent(updatedStudent) {
  students = students.map((item) => item.code === updatedStudent.code ? updatedStudent : item);
  saveStudents(students);

  if (window.PRFirebase && typeof window.PRFirebase.saveStudent === "function") {
    await window.PRFirebase.saveStudent(updatedStudent);
  }

  renderStudentsTable();
  renderRewardManager();
}

async function deleteRewardEntry(entryId) {
  const student = selectedRewardStudentCode ? normalizeRewardData(getStudentByCode(selectedRewardStudentCode)) : null;

  if (!student || !entryId) {
    return;
  }

  const entry = (student.rewardHistory || []).find((item) => item.id === entryId);

  if (!entry) {
    return;
  }

  const confirmed = window.confirm(`¿Seguro que quieres borrar esta entrada?\n\n${entry.reason} (${entry.points > 0 ? "+" : ""}${entry.points} puntos)`);

  if (!confirmed) {
    return;
  }

  const updatedHistory = (student.rewardHistory || []).filter((item) => item.id !== entryId);
  const updatedStudent = {
    ...student,
    rewardPoints: Math.max(0, Number(student.rewardPoints || 0) - Number(entry.points || 0)),
    rewardHistory: updatedHistory,
    updatedAt: new Date().toISOString()
  };

  await saveRewardStudent(updatedStudent);
}

async function deliverRewardPrize() {
  const student = selectedRewardStudentCode ? normalizeRewardData(getStudentByCode(selectedRewardStudentCode)) : null;

  if (!student) {
    window.alert("Selecciona un estudiante primero.");
    return;
  }

  if (getAvailablePrizeCount(student) < 1) {
    window.alert("Este estudiante todavía no tiene puntos suficientes para premio.");
    return;
  }

  const confirmed = window.confirm(`Marcar un premio como entregado a ${student.name}? Se descontarán ${REWARD_PRIZE_POINTS} puntos.`);

  if (!confirmed) {
    return;
  }

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
    points: -REWARD_PRIZE_POINTS,
    reason: "Premio entregado",
    note: "Canje registrado por el panel de premios",
    deliveredPrize: true,
    createdAt: new Date().toISOString()
  };

  const updatedStudent = {
    ...student,
    rewardPoints: Math.max(0, Number(student.rewardPoints || 0) + entry.points),
    rewardHistory: [entry, ...(student.rewardHistory || [])],
    updatedAt: new Date().toISOString()
  };

  await saveRewardStudent(updatedStudent);
}

function setupRewardsForm() {
  const form = document.getElementById("rewardForm");

  if (!form) {
    return;
  }

  populateRewardControls();

  const deliverButton = document.getElementById("deliverRewardPrize");
  if (deliverButton) {
    deliverButton.addEventListener("click", deliverRewardPrize);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const reasonSelect = document.getElementById("rewardReason");
    const selectedAction = REWARD_ACTIONS.find((action) => action.id === reasonSelect.value);
    const points = Number(document.getElementById("rewardPoints").value || 0);
    const reason = selectedAction ? selectedAction.label : "Ajuste de puntos";
    const note = document.getElementById("rewardNote").value;

    await addRewardPoints(points, reason, note);
    form.reset();
    reasonSelect.value = REWARD_ACTIONS[0].id;
    document.getElementById("rewardPoints").value = REWARD_ACTIONS[0].points;
  });
}

// Descarga el QR visible como imagen PNG.
function downloadVisibleQr() {
  const canvas = document.querySelector("#qrResult canvas");
  downloadQrCanvas(canvas, selectedQrStudent);
}

// Conecta el formulario y los controles del panel.
async function setupTeacherPanel() {
  const form = document.getElementById("studentForm");
  const searchInput = document.getElementById("studentSearch");
  const downloadButton = document.getElementById("downloadQr");
  const cancelEditButton = document.getElementById("cancelStudentEdit");
  const birthDateInput = document.getElementById("studentBirthDate");
  const ageInput = document.getElementById("studentAge");
  const profileEditButton = document.getElementById("profileEditStudent");
  const phoneInputs = [
    document.getElementById("guardianPhone"),
    document.getElementById("emergencyPhone")
  ];

  if (window.PRFirebase && typeof window.PRFirebase.requireAuth === "function") {
    const profile = await window.PRFirebase.requireAuth();
    if (!profile) {
      return;
    }
  }

  await loadSharedStudents();
  students = students.map(normalizeRewardData);
  saveStudents(students);
  renderStudentsTable();
  setupRewardsForm();

  const pendingEditCode = sessionStorage.getItem("crece_edit_student_code");
  if (pendingEditCode) {
    sessionStorage.removeItem("crece_edit_student_code");
    const pendingStudent = getStudentByCode(pendingEditCode);

    if (pendingStudent) {
      editingStudentCode = pendingStudent.code;
      fillStudentForm(pendingStudent);
      setStudentFormMode("edit");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const formData = new FormData(form);
      const existingStudent = editingStudentCode ? getStudentByCode(editingStudentCode) : null;
      const student = existingStudent
        ? buildUpdatedStudentRecord(existingStudent, formData)
        : buildStudentRecord(formData);

      if (existingStudent) {
        students = students.map((item) => item.code === student.code ? student : item);
      } else {
        students.unshift(student);
      }

      saveStudents(students);

      if (window.PRFirebase && typeof window.PRFirebase.saveStudent === "function") {
        await window.PRFirebase.saveStudent(student);
      }

      resetStudentForm(form);
      renderStudentsTable();
      renderQr(student);
    } catch (error) {
      window.alert(error.message);
    }
  });

  searchInput.addEventListener("input", renderStudentsTable);
  downloadButton.addEventListener("click", downloadVisibleQr);
  cancelEditButton.addEventListener("click", () => resetStudentForm(form));
  profileEditButton.addEventListener("click", () => editStudentFromProfile(profileEditButton.dataset.code));
  phoneInputs.forEach((input) => {
    if (!input) {
      return;
    }

    input.addEventListener("blur", () => {
      input.value = formatPhoneNumber(input.value);
    });
  });
  birthDateInput.addEventListener("change", () => {
    const calculatedAge = calculateAgeFromBirthDate(birthDateInput.value);

    if (calculatedAge) {
      ageInput.value = calculatedAge;
    }
  });
}

// Carga la clase actual del grupo seleccionado dentro del editor.
function fillLessonForm(group) {
  const lesson = window.PRLessons ? window.PRLessons.getLesson(group) : null;

  if (!lesson) {
    return;
  }

  document.getElementById("lessonTitle").value = lesson.title || "";
  document.getElementById("lessonVerse").value = lesson.verse || "";
  document.getElementById("lessonGoal").value = lesson.goal || "";
  document.getElementById("lessonSummary").value = lesson.summary || "";
  document.getElementById("lessonWarmup").value = lesson.warmup || "";
  document.getElementById("lessonMaterials").value = lesson.materials || "";
  document.getElementById("lessonVisual").value = lesson.visual || "";
  document.getElementById("lessonDynamic").value = lesson.dynamic || "";
  document.getElementById("lessonApplication").value = lesson.application || "";
  document.getElementById("lessonQuestions").value = lesson.questions ? lesson.questions.join("\n") : "";
  document.getElementById("lessonChallenge").value = lesson.challenge || "";
  document.getElementById("lessonTeacherNotes").value = lesson.teacherNotes || "";
}

// Guarda la clase enriquecida para el grupo seleccionado.
function setupLessonEditor() {
  const form = document.getElementById("lessonForm");
  const groupSelect = document.getElementById("lessonGroup");
  const librarySelect = document.getElementById("lessonLibrarySelect");

  if (!form || !groupSelect || !window.PRLessons) {
    return;
  }

  populateLessonLibrary(groupSelect.value);
  fillLessonForm(groupSelect.value);

  groupSelect.addEventListener("change", () => {
    populateLessonLibrary(groupSelect.value);
    fillLessonForm(groupSelect.value);
  });

  if (librarySelect) {
    librarySelect.addEventListener("change", () => {
      const lesson = getSelectedLibraryLesson(groupSelect.value, librarySelect.value);

      if (lesson) {
        fillLessonFormFromLibrary(lesson);
      }
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const group = String(formData.get("lessonGroup"));
    const questions = String(formData.get("lessonQuestions") || "")
      .split("\n")
      .map((question) => question.trim())
      .filter(Boolean);

    window.PRLessons.saveLesson(group, {
      title: String(formData.get("lessonTitle") || "").trim(),
      verse: String(formData.get("lessonVerse") || "").trim(),
      goal: String(formData.get("lessonGoal") || "").trim(),
      summary: String(formData.get("lessonSummary") || "").trim(),
      warmup: String(formData.get("lessonWarmup") || "").trim(),
      materials: String(formData.get("lessonMaterials") || "").trim(),
      visual: String(formData.get("lessonVisual") || "").trim(),
      dynamic: String(formData.get("lessonDynamic") || "").trim(),
      application: String(formData.get("lessonApplication") || "").trim(),
      challenge: String(formData.get("lessonChallenge") || "").trim(),
      teacherNotes: String(formData.get("lessonTeacherNotes") || "").trim(),
      questions,
      updatedAt: new Date().toISOString()
    });

    window.alert("Clase publicada correctamente.");
  });
}

// Llena el selector con las clases ya preparadas para el año.
function populateLessonLibrary(group) {
  const librarySelect = document.getElementById("lessonLibrarySelect");
  const library = window.PRLessonLibrary && window.PRLessonLibrary[group] ? window.PRLessonLibrary[group] : [];

  if (!librarySelect) {
    return;
  }

  librarySelect.innerHTML = '<option value="">Selecciona una clase guardada</option>';

  library.forEach((lesson, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${lesson.date} - ${lesson.title}`;
    librarySelect.appendChild(option);
  });
}

// Obtiene la clase seleccionada en la biblioteca.
function getSelectedLibraryLesson(group, index) {
  const library = window.PRLessonLibrary && window.PRLessonLibrary[group] ? window.PRLessonLibrary[group] : [];
  return index === "" ? null : library[Number(index)];
}

// Carga una clase guardada dentro del editor para que la maestra pueda revisarla.
function fillLessonFormFromLibrary(lesson) {
  document.getElementById("lessonGroup").value = lesson.group;
  document.getElementById("lessonTitle").value = lesson.title || "";
  document.getElementById("lessonVerse").value = lesson.verse || "";
  document.getElementById("lessonGoal").value = lesson.goal || "";
  document.getElementById("lessonSummary").value = lesson.summary || "";
  document.getElementById("lessonWarmup").value = lesson.warmup || "";
  document.getElementById("lessonMaterials").value = lesson.materials || "";
  document.getElementById("lessonVisual").value = lesson.visual || "";
  document.getElementById("lessonDynamic").value = lesson.dynamic || "";
  document.getElementById("lessonApplication").value = lesson.application || "";
  document.getElementById("lessonQuestions").value = lesson.questions ? lesson.questions.join("\n") : "";
  document.getElementById("lessonChallenge").value = lesson.challenge || "";
  document.getElementById("lessonTeacherNotes").value = lesson.teacherNotes || "";
}

document.addEventListener("DOMContentLoaded", () => {
  setupTeacherPanel();
});
