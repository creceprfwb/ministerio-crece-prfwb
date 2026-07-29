const COMM_TEACHERS_STORAGE_KEY = "prfwb_teacher_records";
const COMM_SCHEDULE_STORAGE_KEY = "prfwb_schedule_records";
const COMM_STUDENTS_STORAGE_KEY = "prfwb_student_records";

let communicationTeachers = [];
let communicationSchedule = [];
let communicationStudents = [];

function commStorageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

function loadCommLocal(key) {
  const raw = localStorage.getItem(commStorageKey(key));
  return raw ? JSON.parse(raw) : [];
}

function escapeCommHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeCommPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

function getCommTeacher(id) {
  return communicationTeachers.find((teacher) => teacher.id === id) || null;
}

function getCommGroupLabel(group) {
  if (group === "ninos") return "Ninos";
  if (group === "juveniles") return "Juveniles";
  return "Ambos grupos";
}

function getActiveCommStudents() {
  return communicationStudents
    .filter((student) => student.active !== false)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function getCommFamilies() {
  const families = new Map();

  getActiveCommStudents().forEach((student) => {
    const phone = normalizeCommPhone(student.guardianPhone);
    const guardianName = String(student.guardianName || "Encargado").trim();
    const key = phone || guardianName.toLowerCase() || student.code;
    const existing = families.get(key) || {
      id: key,
      guardianName,
      guardianPhone: student.guardianPhone || "",
      groups: new Set(),
      students: []
    };

    existing.guardianName = existing.guardianName === "Encargado" ? guardianName : existing.guardianName;
    existing.guardianPhone = existing.guardianPhone || student.guardianPhone || "";
    existing.groups.add(student.group || "");
    existing.students.push(student);
    families.set(key, existing);
  });

  return Array.from(families.values()).map((family) => ({
    ...family,
    groups: Array.from(family.groups).filter(Boolean),
    studentNames: family.students.map((student) => student.name).filter(Boolean).join(", ")
  }));
}

function getUpcomingCommAssignments(limit = 8) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return communicationSchedule
    .filter((entry) => entry.dateIso && new Date(`${entry.dateIso}T12:00:00`) >= today)
    .sort((a, b) => new Date(a.dateIso || 0) - new Date(b.dateIso || 0))
    .slice(0, limit);
}

function buildAssignmentMessage(entry) {
  const teacher = getCommTeacher(entry.teacherId);
  const assistant = getCommTeacher(entry.assistantId);
  const assistantText = assistant ? `\nAyudante: ${assistant.name}` : "";
  const notesText = entry.notes ? `\nNotas: ${entry.notes}` : "";

  return `Hola ${teacher ? teacher.name : "maestro/a"}, Dios le bendiga.\n\nRecordatorio Ministerio CRECE:\nFecha: ${entry.dateLabel || entry.dateIso}\nGrupo: ${getCommGroupLabel(entry.group)}\nClase: ${entry.lessonTitle || "Clase por confirmar"}${assistantText}${notesText}\n\nPor favor confirme si puede servir. Gracias.`;
}

function buildTeacherQuickMessage(teacher) {
  return `Hola ${teacher.name}, Dios le bendiga.\n\nLe escribimos del Ministerio CRECE para confirmar disponibilidad y compartir informacion de la proxima clase.\n\nGracias por servir.`;
}

function buildGroupMessage() {
  const upcoming = getUpcomingCommAssignments(4);

  if (!upcoming.length) {
    return "Dios les bendiga equipo CRECE.\n\nTodavia no hay asignaciones generadas para compartir. Por favor revisen el calendario cuando este listo.";
  }

  const lines = upcoming.map((entry) => {
    const teacher = getCommTeacher(entry.teacherId);
    const assistant = getCommTeacher(entry.assistantId);
    return `- ${entry.dateLabel || entry.dateIso} | ${getCommGroupLabel(entry.group)} | ${teacher ? teacher.name : "VACANTE"}${assistant ? ` / Ayudante: ${assistant.name}` : ""}`;
  });

  return `Dios les bendiga equipo CRECE.\n\nEstas son las proximas asignaciones:\n${lines.join("\n")}\n\nPor favor revisen su fecha y confirmen si pueden servir. Gracias por sembrar en la vida de nuestros ninos y jovenes.`;
}

function buildParentGroupMessage() {
  const next = getUpcomingCommAssignments(1)[0];
  const nextText = next
    ? `\n\nProxima clase: ${next.dateLabel || next.dateIso}\nGrupo: ${getCommGroupLabel(next.group)}\nTema: ${next.lessonTitle || "Clase por confirmar"}`
    : "";

  return `Dios les bendiga familias CRECE.\n\nGracias por permitirnos discipular a sus hijos. Les recordamos traer Biblia, libreta y llegar a tiempo para la clase.${nextText}\n\nSi tienen alguna pregunta, pueden responder a este mensaje. Gracias por caminar con nosotros.`;
}

function buildGuardianMessage(family) {
  const next = getUpcomingCommAssignments(1)[0];
  const nextText = next
    ? `\n\nProxima clase: ${next.dateLabel || next.dateIso}\nTema: ${next.lessonTitle || "Clase por confirmar"}`
    : "";

  return `Hola ${family.guardianName || "familia"}, Dios le bendiga.\n\nLe escribimos del Ministerio CRECE sobre ${family.studentNames || "su estudiante"}. Queremos recordarles traer Biblia, libreta y llegar a tiempo para la clase.${nextText}\n\nGracias por permitirnos servir a su familia.`;
}

function getWhatsAppUrl(phone, message) {
  const normalizedPhone = normalizeCommPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;
}

async function copyText(message) {
  try {
    await navigator.clipboard.writeText(message);
    window.alert("Mensaje copiado.");
  } catch (error) {
    window.prompt("Copia este mensaje:", message);
  }
}

async function loadCommunicationData() {
  communicationTeachers = loadCommLocal(COMM_TEACHERS_STORAGE_KEY);
  communicationSchedule = loadCommLocal(COMM_SCHEDULE_STORAGE_KEY);
  communicationStudents = loadCommLocal(COMM_STUDENTS_STORAGE_KEY);

  try {
    if (window.PRFirebase && window.PRFirebase.enabled) {
      const profile = await window.PRFirebase.requireAuth();
      if (!profile) return;

      const [cloudTeachers, cloudSchedule, cloudStudents] = await Promise.all([
        window.PRFirebase.getTeachers ? window.PRFirebase.getTeachers() : [],
        window.PRFirebase.getSchedule ? window.PRFirebase.getSchedule() : [],
        window.PRFirebase.getStudents ? window.PRFirebase.getStudents() : []
      ]);

      if (cloudTeachers.length) {
        communicationTeachers = cloudTeachers;
        localStorage.setItem(commStorageKey(COMM_TEACHERS_STORAGE_KEY), JSON.stringify(communicationTeachers));
      }

      if (cloudSchedule.length) {
        communicationSchedule = cloudSchedule;
        localStorage.setItem(commStorageKey(COMM_SCHEDULE_STORAGE_KEY), JSON.stringify(communicationSchedule));
      }

      if (cloudStudents.length) {
        communicationStudents = cloudStudents;
        localStorage.setItem(commStorageKey(COMM_STUDENTS_STORAGE_KEY), JSON.stringify(communicationStudents));
      }
    }
  } catch (error) {
    console.warn("No se pudo cargar comunicacion desde Firebase.", error);
  }

  renderCommunication();
}

function renderGroupMessage() {
  const message = buildGroupMessage();
  const textarea = document.getElementById("groupMessage");
  textarea.value = message;
  document.getElementById("openWhatsAppGroup").href = getWhatsAppUrl("", message);
}

function renderParentGroupMessage() {
  const message = buildParentGroupMessage();
  const textarea = document.getElementById("parentGroupMessage");
  textarea.value = message;
  document.getElementById("openWhatsAppParents").href = getWhatsAppUrl("", message);
}

function renderParentSummary() {
  const board = document.getElementById("parentCommunicationSummary");
  const families = getCommFamilies();
  const withPhone = families.filter((family) => normalizeCommPhone(family.guardianPhone)).length;

  board.innerHTML = `
    <div class="communication-next-card">
      <span>Familias activas</span>
      <strong>${families.length}</strong>
      <p>${withPhone} con WhatsApp registrado</p>
      <small>${getActiveCommStudents().length} estudiantes activos en CRECE</small>
    </div>
  `;
}

function renderNextSummary() {
  const board = document.getElementById("nextCommunicationSummary");
  const next = getUpcomingCommAssignments(1)[0];

  if (!next) {
    board.innerHTML = '<div class="empty-inline">No hay asignaciones proximas.</div>';
    return;
  }

  const teacher = getCommTeacher(next.teacherId);
  const assistant = getCommTeacher(next.assistantId);

  board.innerHTML = `
    <div class="communication-next-card">
      <span>${escapeCommHtml(next.dateLabel || next.dateIso)}</span>
      <strong>${escapeCommHtml(getCommGroupLabel(next.group))}</strong>
      <p>${escapeCommHtml(next.lessonTitle || "Clase por confirmar")}</p>
      <small>${teacher ? `Maestro: ${escapeCommHtml(teacher.name)}` : "Maestro: VACANTE"}</small>
      <small>${assistant ? `Ayudante: ${escapeCommHtml(assistant.name)}` : "Ayudante sin asignar"}</small>
    </div>
  `;
}

function renderTeachers() {
  const board = document.getElementById("communicationTeachers");
  const query = String(document.getElementById("teacherSearch").value || "").toLowerCase().trim();
  const teachers = communicationTeachers
    .filter((teacher) => teacher.active !== false)
    .filter((teacher) => !query || `${teacher.name} ${teacher.phone} ${teacher.email} ${teacher.group}`.toLowerCase().includes(query))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  if (!teachers.length) {
    board.innerHTML = '<div class="empty-inline">No hay maestros activos con ese filtro.</div>';
    return;
  }

  board.innerHTML = teachers.map((teacher) => {
    const message = buildTeacherQuickMessage(teacher);
    const hasPhone = Boolean(normalizeCommPhone(teacher.phone));
    return `
      <article class="communication-teacher-card">
        <div>
          <strong>${escapeCommHtml(teacher.name)}</strong>
          <span>${escapeCommHtml(getCommGroupLabel(teacher.group))}</span>
          <small>${escapeCommHtml(teacher.phone || "Sin WhatsApp")}</small>
          ${teacher.email ? `<small>${escapeCommHtml(teacher.email)}</small>` : ""}
        </div>
        <div class="communication-card-actions">
          <button class="btn btn-sm btn-outline-secondary copy-teacher-message" type="button" data-id="${escapeCommHtml(teacher.id)}">
            <i class="bi bi-copy"></i> Copiar
          </button>
          <a class="btn btn-sm btn-outline-success ${hasPhone ? "" : "disabled"}" href="${hasPhone ? getWhatsAppUrl(teacher.phone, message) : "#"}" target="_blank" rel="noopener">
            <i class="bi bi-whatsapp"></i> WhatsApp
          </a>
        </div>
      </article>
    `;
  }).join("");

  board.querySelectorAll(".copy-teacher-message").forEach((button) => {
    button.addEventListener("click", () => {
      const teacher = getCommTeacher(button.dataset.id);
      if (teacher) copyText(buildTeacherQuickMessage(teacher));
    });
  });
}

function renderGuardians() {
  const board = document.getElementById("communicationGuardians");
  const query = String(document.getElementById("guardianSearch").value || "").toLowerCase().trim();
  const groupFilter = document.getElementById("guardianGroupFilter").value;
  const families = getCommFamilies()
    .filter((family) => groupFilter === "all" || family.groups.includes(groupFilter))
    .filter((family) => {
      const searchable = `${family.guardianName} ${family.guardianPhone} ${family.studentNames} ${family.groups.join(" ")}`.toLowerCase();
      return !query || searchable.includes(query);
    })
    .sort((a, b) => String(a.guardianName || "").localeCompare(String(b.guardianName || "")));

  if (!families.length) {
    board.innerHTML = '<div class="empty-inline">No hay padres o encargados con ese filtro.</div>';
    return;
  }

  board.innerHTML = families.map((family) => {
    const message = buildGuardianMessage(family);
    const hasPhone = Boolean(normalizeCommPhone(family.guardianPhone));
    const groupLabel = family.groups.map(getCommGroupLabel).join(", ") || "Sin grupo";

    return `
      <article class="communication-teacher-card communication-family-card">
        <div>
          <strong>${escapeCommHtml(family.guardianName || "Encargado")}</strong>
          <span>${escapeCommHtml(family.studentNames || "Sin estudiante")}</span>
          <small>${escapeCommHtml(groupLabel)}</small>
          <small>${escapeCommHtml(family.guardianPhone || "Sin WhatsApp")}</small>
        </div>
        <div class="communication-card-actions">
          <button class="btn btn-sm btn-outline-secondary copy-guardian-message" type="button" data-id="${escapeCommHtml(family.id)}">
            <i class="bi bi-copy"></i> Copiar
          </button>
          <a class="btn btn-sm btn-outline-success ${hasPhone ? "" : "disabled"}" href="${hasPhone ? getWhatsAppUrl(family.guardianPhone, message) : "#"}" target="_blank" rel="noopener">
            <i class="bi bi-whatsapp"></i> WhatsApp
          </a>
        </div>
      </article>
    `;
  }).join("");

  board.querySelectorAll(".copy-guardian-message").forEach((button) => {
    button.addEventListener("click", () => {
      const family = getCommFamilies().find((item) => item.id === button.dataset.id);
      if (family) copyText(buildGuardianMessage(family));
    });
  });
}

function renderAssignments() {
  const board = document.getElementById("communicationAssignments");
  const entries = getUpcomingCommAssignments(10);

  if (!entries.length) {
    board.innerHTML = '<div class="empty-inline">No hay asignaciones proximas para comunicar.</div>';
    return;
  }

  board.innerHTML = entries.map((entry) => {
    const teacher = getCommTeacher(entry.teacherId);
    const message = buildAssignmentMessage(entry);
    const hasPhone = Boolean(teacher && normalizeCommPhone(teacher.phone));
    return `
      <article class="communication-assignment-card ${teacher ? "" : "vacant"}">
        <div>
          <span>${escapeCommHtml(entry.dateLabel || entry.dateIso)}</span>
          <strong>${escapeCommHtml(getCommGroupLabel(entry.group))}</strong>
          <p>${escapeCommHtml(entry.lessonTitle || "Clase por confirmar")}</p>
          <small>${teacher ? `Maestro: ${escapeCommHtml(teacher.name)}` : "Maestro: VACANTE"}</small>
        </div>
        <div class="communication-card-actions">
          <button class="btn btn-sm btn-outline-secondary copy-assignment-message" type="button" data-id="${escapeCommHtml(entry.id)}" ${teacher ? "" : "disabled"}>
            <i class="bi bi-copy"></i> Copiar
          </button>
          <a class="btn btn-sm btn-outline-success ${hasPhone ? "" : "disabled"}" href="${hasPhone ? getWhatsAppUrl(teacher.phone, message) : "#"}" target="_blank" rel="noopener">
            <i class="bi bi-whatsapp"></i> WhatsApp
          </a>
        </div>
      </article>
    `;
  }).join("");

  board.querySelectorAll(".copy-assignment-message").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = communicationSchedule.find((item) => item.id === button.dataset.id);
      if (entry) copyText(buildAssignmentMessage(entry));
    });
  });
}

function renderCommunication() {
  renderGroupMessage();
  renderParentGroupMessage();
  renderNextSummary();
  renderParentSummary();
  renderTeachers();
  renderGuardians();
  renderAssignments();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("copyGroupMessage").addEventListener("click", () => {
    copyText(document.getElementById("groupMessage").value);
  });

  document.getElementById("groupMessage").addEventListener("input", () => {
    document.getElementById("openWhatsAppGroup").href = getWhatsAppUrl("", document.getElementById("groupMessage").value);
  });

  document.getElementById("copyParentGroupMessage").addEventListener("click", () => {
    copyText(document.getElementById("parentGroupMessage").value);
  });

  document.getElementById("parentGroupMessage").addEventListener("input", () => {
    document.getElementById("openWhatsAppParents").href = getWhatsAppUrl("", document.getElementById("parentGroupMessage").value);
  });

  document.getElementById("teacherSearch").addEventListener("input", renderTeachers);
  document.getElementById("guardianSearch").addEventListener("input", renderGuardians);
  document.getElementById("guardianGroupFilter").addEventListener("change", renderGuardians);
  loadCommunicationData();
});
