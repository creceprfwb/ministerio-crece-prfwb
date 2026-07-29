const COMM_TEACHERS_STORAGE_KEY = "prfwb_teacher_records";
const COMM_SCHEDULE_STORAGE_KEY = "prfwb_schedule_records";

let communicationTeachers = [];
let communicationSchedule = [];

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

  try {
    if (window.PRFirebase && window.PRFirebase.enabled) {
      const profile = await window.PRFirebase.requireAuth();
      if (!profile) return;

      const [cloudTeachers, cloudSchedule] = await Promise.all([
        window.PRFirebase.getTeachers ? window.PRFirebase.getTeachers() : [],
        window.PRFirebase.getSchedule ? window.PRFirebase.getSchedule() : []
      ]);

      if (cloudTeachers.length) {
        communicationTeachers = cloudTeachers;
        localStorage.setItem(commStorageKey(COMM_TEACHERS_STORAGE_KEY), JSON.stringify(communicationTeachers));
      }

      if (cloudSchedule.length) {
        communicationSchedule = cloudSchedule;
        localStorage.setItem(commStorageKey(COMM_SCHEDULE_STORAGE_KEY), JSON.stringify(communicationSchedule));
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
  renderNextSummary();
  renderTeachers();
  renderAssignments();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("copyGroupMessage").addEventListener("click", () => {
    copyText(document.getElementById("groupMessage").value);
  });

  document.getElementById("groupMessage").addEventListener("input", () => {
    document.getElementById("openWhatsAppGroup").href = getWhatsAppUrl("", document.getElementById("groupMessage").value);
  });

  document.getElementById("teacherSearch").addEventListener("input", renderTeachers);
  loadCommunicationData();
});
