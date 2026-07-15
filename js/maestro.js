// Clave local para guardar estudiantes hasta conectar Firebase, Supabase o Google Sheets.
const STUDENTS_STORAGE_KEY = "prfwb_student_records";

let students = [];
let selectedQrStudent = null;
let editingStudentCode = null;

function storageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

// Determina automaticamente el grupo segun la edad.
function getGroupByAge(age) {
  if (age >= 3 && age <= 10) {
    return { group: "ninos", groupLabel: "Niños" };
  }

  if (age >= 11 && age <= 16) {
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

// Genera un numero facil de leer para el estudiante.
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

// Crea el objeto del estudiante registrado.
function buildStudentRecord(formData) {
  const age = Number(formData.get("studentAge"));
  const groupInfo = getGroupByAge(age);

  if (!groupInfo) {
    throw new Error("La edad debe estar entre 3 y 16 años.");
  }

  const now = new Date();

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    code: createUniqueStudentCode(),
    name: String(formData.get("studentName") || "").trim(),
    age,
    group: groupInfo.group,
    groupLabel: groupInfo.groupLabel,
    guardianName: String(formData.get("guardianName") || "").trim(),
    guardianPhone: String(formData.get("guardianPhone") || "").trim(),
    emergencyPhone: String(formData.get("emergencyPhone") || "").trim(),
    active: true,
    createdAt: now.toISOString()
  };
}

// Actualiza un estudiante existente sin cambiar su numero ni QR.
function buildUpdatedStudentRecord(existingStudent, formData) {
  const age = Number(formData.get("studentAge"));
  const groupInfo = getGroupByAge(age);

  if (!groupInfo) {
    throw new Error("La edad debe estar entre 3 y 16 aÃ±os.");
  }

  return {
    ...existingStudent,
    name: String(formData.get("studentName") || "").trim(),
    age,
    group: groupInfo.group,
    groupLabel: groupInfo.groupLabel,
    guardianName: String(formData.get("guardianName") || "").trim(),
    guardianPhone: String(formData.get("guardianPhone") || "").trim(),
    emergencyPhone: String(formData.get("emergencyPhone") || "").trim(),
    active: existingStudent.active !== false,
    updatedAt: new Date().toISOString()
  };
}

function getStudentByCode(code) {
  return students.find((student) => student.code === code);
}

function fillStudentForm(student) {
  document.getElementById("studentName").value = student.name || "";
  document.getElementById("studentAge").value = student.age || "";
  document.getElementById("guardianName").value = student.guardianName || "";
  document.getElementById("guardianPhone").value = student.guardianPhone || "";
  document.getElementById("emergencyPhone").value = student.emergencyPhone || "";
}

function setStudentFormMode(mode) {
  const isEditing = mode === "edit";
  const title = document.getElementById("studentFormTitle");
  const help = document.getElementById("studentFormHelp");
  const submitButton = document.getElementById("studentSubmitButton");
  const cancelButton = document.getElementById("cancelStudentEdit");

  title.textContent = isEditing ? "Editar estudiante" : "Nuevo estudiante";
  help.textContent = isEditing
    ? "Actualiza la informacion sin cambiar el numero ni el QR."
    : "Al guardar se genera un numero y codigo QR.";
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
  title.textContent = student.name;

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

// Pinta la tabla de estudiantes registrados.
function renderStudentsTable() {
  const tableBody = document.getElementById("studentsTable");
  const search = normalizeText(document.getElementById("studentSearch").value);
  const visibleStudents = students.filter((student) => {
    return !search || normalizeText(`${student.code} ${student.name} ${student.groupLabel}`).includes(search);
  });

  if (!visibleStudents.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-muted py-4">No hay estudiantes registrados.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = visibleStudents.map((student) => `
    <tr class="${student.active === false ? "inactive-student" : ""}">
      <td><strong>${student.code}</strong></td>
      <td>${student.name}</td>
      <td>${student.age}</td>
      <td>${student.groupLabel}</td>
      <td>${student.guardianName || ""}</td>
      <td>${student.guardianPhone || ""}</td>
      <td>
        <span class="badge ${student.active === false ? "text-bg-secondary" : "text-bg-success"}">
          ${student.active === false ? "Inactivo" : "Activo"}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary show-qr" type="button" data-code="${student.code}">
          <i class="bi bi-qr-code"></i> Ver
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
  `).join("");

  tableBody.querySelectorAll(".show-qr").forEach((button) => {
    button.addEventListener("click", () => {
      const student = students.find((item) => item.code === button.dataset.code);
      renderQr(student);
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

// Descarga el QR visible como imagen PNG.
function downloadVisibleQr() {
  const canvas = document.querySelector("#qrResult canvas");

  if (!canvas || !selectedQrStudent) {
    return;
  }

  const link = document.createElement("a");
  link.download = `${selectedQrStudent.code}-${selectedQrStudent.name}.png`.replace(/\s+/g, "-");
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// Conecta el formulario y los controles del panel.
async function setupTeacherPanel() {
  const form = document.getElementById("studentForm");
  const searchInput = document.getElementById("studentSearch");
  const downloadButton = document.getElementById("downloadQr");
  const cancelEditButton = document.getElementById("cancelStudentEdit");

  if (window.PRFirebase && typeof window.PRFirebase.requireAuth === "function") {
    const profile = await window.PRFirebase.requireAuth();
    if (!profile) {
      return;
    }
  }

  await loadSharedStudents();
  renderStudentsTable();

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
