const TEACHERS_STORAGE_KEY = "prfwb_teacher_records";
const SCHEDULE_STORAGE_KEY = "prfwb_schedule_records";

const GROUPS = [
  { id: "ninos", label: "Ninos" },
  { id: "juveniles", label: "Juveniles" }
];

const SCHEDULE_STATUSES = [
  { id: "sin-asignar", label: "Sin asignar" },
  { id: "asignado", label: "Asignado" },
  { id: "confirmado", label: "Confirmado" },
  { id: "completado", label: "Completado" }
];

let teachers = [];
let scheduleEntries = [];
let currentMonthDate = new Date();

function storageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `1${digits}`;
  }

  return digits;
}

function formatDate(date) {
  return date.toLocaleDateString("es-PR", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function lessonDateKey(date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function loadLocal(key) {
  const raw = localStorage.getItem(storageKey(key));
  return raw ? JSON.parse(raw) : [];
}

function saveLocal(key, records) {
  localStorage.setItem(storageKey(key), JSON.stringify(records));
}

async function loadSharedData() {
  teachers = loadLocal(TEACHERS_STORAGE_KEY);
  scheduleEntries = loadLocal(SCHEDULE_STORAGE_KEY);

  if (!window.PRFirebase || !window.PRFirebase.enabled) {
    return;
  }

  try {
    const [cloudTeachers, cloudSchedule] = await Promise.all([
      window.PRFirebase.getTeachers ? window.PRFirebase.getTeachers() : [],
      window.PRFirebase.getSchedule ? window.PRFirebase.getSchedule() : []
    ]);

    if (cloudTeachers.length) {
      teachers = cloudTeachers;
      saveLocal(TEACHERS_STORAGE_KEY, teachers);
    }

    if (cloudSchedule.length) {
      scheduleEntries = cloudSchedule;
      saveLocal(SCHEDULE_STORAGE_KEY, scheduleEntries);
    }
  } catch (error) {
    console.warn("No se pudo cargar el calendario compartido.", error);
  }
}

function getLessonForDate(group, dateKey) {
  const library = window.PRLessonLibrary && window.PRLessonLibrary[group] ? window.PRLessonLibrary[group] : [];
  return library.find((lesson) => lesson.date === dateKey) || null;
}

function getTeacher(id) {
  return teachers.find((teacher) => teacher.id === id) || null;
}

function getScheduleEntry(id) {
  return scheduleEntries.find((entry) => entry.id === id) || null;
}

function buildScheduleId(dateIso, group) {
  return `${dateIso}_${group}`;
}

function getUpcomingSundays(count = 12) {
  const dates = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  const day = cursor.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  cursor.setDate(cursor.getDate() + daysUntilSunday);

  while (dates.length < count) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  return dates;
}

async function saveTeacherRecord(teacher) {
  teachers = [teacher, ...teachers.filter((item) => item.id !== teacher.id)];
  saveLocal(TEACHERS_STORAGE_KEY, teachers);

  if (window.PRFirebase && typeof window.PRFirebase.saveTeacher === "function") {
    await window.PRFirebase.saveTeacher(teacher);
  }
}

async function saveScheduleRecord(entry) {
  scheduleEntries = [entry, ...scheduleEntries.filter((item) => item.id !== entry.id)];
  saveLocal(SCHEDULE_STORAGE_KEY, scheduleEntries);

  if (window.PRFirebase && typeof window.PRFirebase.saveScheduleEntry === "function") {
    await window.PRFirebase.saveScheduleEntry(entry);
  }
}

function renderTeacherOptions(selectedId, group, allowEmptyLabel) {
  const eligibleTeachers = teachers.filter((teacher) => {
    return teacher.active !== false && (teacher.group === "ambos" || teacher.group === group || !teacher.group);
  });

  return `
    <option value="">${allowEmptyLabel}</option>
    ${eligibleTeachers.map((teacher) => `
      <option value="${teacher.id}" ${teacher.id === selectedId ? "selected" : ""}>
        ${escapeHtml(teacher.name)}
      </option>
    `).join("")}
  `;
}

function renderTeachers() {
  const list = document.getElementById("teachersList");

  if (!teachers.length) {
    list.innerHTML = '<div class="empty-inline">Todavia no hay maestros registrados.</div>';
    return;
  }

  list.innerHTML = teachers.map((teacher) => `
    <article class="teacher-card ${teacher.active === false ? "inactive-student" : ""}">
      <div>
        <strong>${escapeHtml(teacher.name)}</strong>
        <span>${escapeHtml(teacher.phone || "Sin telefono")} - ${escapeHtml(getGroupLabel(teacher.group))}</span>
      </div>
      <button class="btn btn-sm ${teacher.active === false ? "btn-outline-success" : "btn-outline-warning"} toggle-teacher" type="button" data-id="${teacher.id}">
        <i class="bi ${teacher.active === false ? "bi-check-circle" : "bi-slash-circle"}"></i>
        ${teacher.active === false ? "Activar" : "Pausar"}
      </button>
    </article>
  `).join("");

  list.querySelectorAll(".toggle-teacher").forEach((button) => {
    button.addEventListener("click", async () => {
      const teacher = getTeacher(button.dataset.id);

      if (!teacher) {
        return;
      }

      await saveTeacherRecord({
        ...teacher,
        active: teacher.active === false,
        updatedAt: new Date().toISOString()
      });
      renderAll();
    });
  });
}

function getGroupLabel(group) {
  if (group === "ninos") {
    return "Ninos";
  }

  if (group === "juveniles") {
    return "Juveniles";
  }

  return "Ambos grupos";
}

function getStatusLabel(status) {
  const found = SCHEDULE_STATUSES.find((item) => item.id === status);
  return found ? found.label : "Sin asignar";
}

function buildTeacherMessage(entry) {
  const teacher = getTeacher(entry.teacherId);
  const assistant = getTeacher(entry.assistantId);
  const lessonTitle = entry.lessonTitle || "Clase por confirmar";
  const groupLabel = getGroupLabel(entry.group);
  const assistantText = assistant ? `\nAyudante: ${assistant.name}` : "";
  const notesText = entry.notes ? `\nNotas: ${entry.notes}` : "";

  return `Hola ${teacher ? teacher.name : "maestro/a"}, Dios le bendiga.\n\nAsignacion Ministerio CRECE:\nFecha: ${entry.dateLabel}\nGrupo: ${groupLabel}\nClase: ${lessonTitle}${assistantText}\nEstado: ${getStatusLabel(entry.status)}${notesText}\n\nPor favor confirme si puede servir. Gracias.`;
}

function whatsappUrl(entry) {
  const teacher = getTeacher(entry.teacherId);
  const phone = normalizePhone(teacher && teacher.phone);

  if (!phone) {
    return "";
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(buildTeacherMessage(entry))}`;
}

async function copyMessage(entry) {
  const message = buildTeacherMessage(entry);

  try {
    await navigator.clipboard.writeText(message);
    window.alert("Mensaje copiado. Puedes pegarlo en Google Chat, WhatsApp o email.");
  } catch (error) {
    window.prompt("Copia este mensaje:", message);
  }
}

function renderSchedule() {
  const board = document.getElementById("scheduleBoard");
  const groupFilter = document.getElementById("scheduleGroupFilter").value;
  const statusFilter = document.getElementById("scheduleStatusFilter").value;
  const entries = scheduleEntries
    .filter((entry) => groupFilter === "todos" || entry.group === groupFilter)
    .filter((entry) => statusFilter === "todos" || entry.status === statusFilter)
    .sort((a, b) => new Date(a.dateIso || 0) - new Date(b.dateIso || 0));

  if (!entries.length) {
    board.innerHTML = '<div class="empty-inline">Genera los proximos domingos para comenzar el calendario.</div>';
    return;
  }

  board.innerHTML = entries.map((entry) => {
    const teacher = getTeacher(entry.teacherId);
    const assistant = getTeacher(entry.assistantId);
    const whatsApp = whatsappUrl(entry);

    return `
      <article class="schedule-card status-${entry.status || "sin-asignar"}" data-id="${entry.id}">
        <div class="schedule-card-head">
          <div>
            <span>${escapeHtml(entry.dateLabel)}</span>
            <h3>${escapeHtml(getGroupLabel(entry.group))}</h3>
          </div>
          <span class="schedule-status">${escapeHtml(getStatusLabel(entry.status))}</span>
        </div>
        <p class="schedule-lesson"><i class="bi bi-journal-text"></i> ${escapeHtml(entry.lessonTitle || "Clase por confirmar")}</p>
        <div class="schedule-fields">
          <label>
            Maestro principal
            <select class="form-select schedule-teacher">
              ${renderTeacherOptions(entry.teacherId, entry.group, "Sin asignar")}
            </select>
          </label>
          <label>
            Ayudante
            <select class="form-select schedule-assistant">
              ${renderTeacherOptions(entry.assistantId, entry.group, "Sin ayudante")}
            </select>
          </label>
          <label>
            Estado
            <select class="form-select schedule-status-select">
              ${SCHEDULE_STATUSES.map((status) => `
                <option value="${status.id}" ${status.id === entry.status ? "selected" : ""}>${status.label}</option>
              `).join("")}
            </select>
          </label>
          <label class="schedule-material">
            <input class="form-check-input schedule-material-ready" type="checkbox" ${entry.materialReady ? "checked" : ""}>
            Material listo
          </label>
        </div>
        <textarea class="form-control schedule-notes" rows="2" placeholder="Notas internas">${escapeHtml(entry.notes || "")}</textarea>
        <div class="schedule-actions">
          <button class="btn btn-sm btn-primary save-schedule-entry" type="button">
            <i class="bi bi-save"></i> Guardar
          </button>
          <button class="btn btn-sm btn-outline-secondary copy-schedule-message" type="button" ${teacher ? "" : "disabled"}>
            <i class="bi bi-chat-dots"></i> Copiar mensaje
          </button>
          <a class="btn btn-sm btn-outline-success ${whatsApp ? "" : "disabled"}" href="${whatsApp || "#"}" target="_blank" rel="noopener">
            <i class="bi bi-whatsapp"></i> WhatsApp
          </a>
        </div>
        <p class="schedule-contact">${teacher ? `Principal: ${escapeHtml(teacher.name)}` : "Principal sin asignar"}${assistant ? ` - Ayudante: ${escapeHtml(assistant.name)}` : ""}</p>
      </article>
    `;
  }).join("");

  board.querySelectorAll(".schedule-card").forEach((card) => {
    const id = card.dataset.id;

    card.querySelector(".save-schedule-entry").addEventListener("click", async () => {
      const existing = getScheduleEntry(id);

      if (!existing) {
        return;
      }

      const updated = {
        ...existing,
        teacherId: card.querySelector(".schedule-teacher").value,
        assistantId: card.querySelector(".schedule-assistant").value,
        status: card.querySelector(".schedule-status-select").value,
        materialReady: card.querySelector(".schedule-material-ready").checked,
        notes: card.querySelector(".schedule-notes").value.trim(),
        updatedAt: new Date().toISOString()
      };

      await saveScheduleRecord(updated);
      renderAll();
    });

    card.querySelector(".copy-schedule-message").addEventListener("click", () => {
      const entry = getScheduleEntry(id);
      if (entry) {
        copyMessage(entry);
      }
    });
  });
}

function renderUnassigned() {
  const board = document.getElementById("unassignedBoard");
  const entries = scheduleEntries
    .filter((entry) => !entry.teacherId || entry.status === "sin-asignar")
    .sort((a, b) => new Date(a.dateIso || 0) - new Date(b.dateIso || 0));

  if (!entries.length) {
    board.innerHTML = `
      <div class="empty-inline">
        Todo lo generado tiene maestro principal asignado.
      </div>
    `;
    return;
  }

  board.innerHTML = entries.map((entry) => `
    <article class="unassigned-card">
      <div>
        <strong>${escapeHtml(entry.dateLabel)}</strong>
        <span>${escapeHtml(getGroupLabel(entry.group))} - ${escapeHtml(entry.lessonTitle || "Clase por confirmar")}</span>
      </div>
      <button class="btn btn-sm btn-outline-primary focus-schedule-entry" type="button" data-id="${entry.id}">
        Asignar
      </button>
    </article>
  `).join("");

  board.querySelectorAll(".focus-schedule-entry").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("scheduleGroupFilter").value = "todos";
      document.getElementById("scheduleStatusFilter").value = "todos";
      renderSchedule();

      const card = document.querySelector(`.schedule-card[data-id="${button.dataset.id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("schedule-highlight");
        window.setTimeout(() => card.classList.remove("schedule-highlight"), 1600);
      }
    });
  });
}

function renderMonthCalendar() {
  const calendar = document.getElementById("monthCalendar");
  const label = document.getElementById("monthLabel");
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells = [];
  const monthEntries = scheduleEntries.filter((entry) => entry.dateIso && entry.dateIso.startsWith(monthKey(currentMonthDate)));

  label.textContent = currentMonthDate.toLocaleDateString("es-PR", {
    month: "long",
    year: "numeric"
  });

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    cells.push({ empty: true });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day, 12);
    const dateIso = isoDate(date);
    cells.push({
      day,
      dateIso,
      entries: monthEntries.filter((entry) => entry.dateIso === dateIso)
    });
  }

  calendar.innerHTML = cells.map((cell) => {
    if (cell.empty) {
      return '<div class="month-cell empty"></div>';
    }

    return `
      <div class="month-cell ${cell.entries.length ? "has-service" : ""}">
        <strong>${cell.day}</strong>
        <div class="month-services">
          ${cell.entries.map((entry) => {
            const teacher = getTeacher(entry.teacherId);
            return `
              <button class="month-service status-${entry.status || "sin-asignar"}" type="button" data-id="${entry.id}">
                <span>${escapeHtml(getGroupLabel(entry.group))}</span>
                <small>${teacher ? escapeHtml(teacher.name) : "Sin asignar"}</small>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");

  calendar.querySelectorAll(".month-service").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("scheduleGroupFilter").value = "todos";
      document.getElementById("scheduleStatusFilter").value = "todos";
      renderSchedule();

      const card = document.querySelector(`.schedule-card[data-id="${button.dataset.id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("schedule-highlight");
        window.setTimeout(() => card.classList.remove("schedule-highlight"), 1600);
      }
    });
  });
}

function renderStats() {
  const activeTeachers = teachers.filter((teacher) => teacher.active !== false);
  const openCount = scheduleEntries.filter((entry) => !entry.teacherId || entry.status === "sin-asignar").length;
  const confirmedCount = scheduleEntries.filter((entry) => entry.status === "confirmado").length;

  document.getElementById("statTeachers").textContent = activeTeachers.length;
  document.getElementById("statOpen").textContent = openCount;
  document.getElementById("statConfirmed").textContent = confirmedCount;
}

function renderAll() {
  renderTeachers();
  renderUnassigned();
  renderMonthCalendar();
  renderSchedule();
  renderStats();
}

async function generateUpcomingSchedule() {
  const now = new Date().toISOString();
  const newEntries = [];

  getUpcomingSundays(12).forEach((date) => {
    const dateIso = isoDate(date);
    const dateKey = lessonDateKey(date);

    GROUPS.forEach((group) => {
      const id = buildScheduleId(dateIso, group.id);
      const existing = getScheduleEntry(id);
      const lesson = getLessonForDate(group.id, dateKey);

      newEntries.push(existing || {
        id,
        dateIso,
        dateKey,
        dateLabel: formatDate(date),
        group: group.id,
        groupLabel: group.label,
        lessonTitle: lesson ? (lesson.displayTitle || lesson.title) : "Clase por confirmar",
        lessonDate: lesson ? lesson.date : "",
        teacherId: "",
        assistantId: "",
        status: "sin-asignar",
        materialReady: Boolean(lesson),
        notes: "",
        createdAt: now
      });
    });
  });

  scheduleEntries = [
    ...newEntries,
    ...scheduleEntries.filter((entry) => !newEntries.some((item) => item.id === entry.id))
  ];
  saveLocal(SCHEDULE_STORAGE_KEY, scheduleEntries);

  if (window.PRFirebase && typeof window.PRFirebase.saveScheduleEntry === "function") {
    await Promise.all(newEntries.map((entry) => window.PRFirebase.saveScheduleEntry(entry)));
  }

  renderAll();
}

function setupTeacherForm() {
  const form = document.getElementById("teacherForm");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const now = new Date().toISOString();
    const teacher = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      name: document.getElementById("teacherName").value.trim(),
      phone: document.getElementById("teacherPhone").value.trim(),
      email: document.getElementById("teacherEmail").value.trim(),
      group: document.getElementById("teacherGroup").value,
      active: true,
      createdAt: now
    };

    await saveTeacherRecord(teacher);
    form.reset();
    renderAll();
  });
}

async function setupSchedulePage() {
  if (window.PRFirebase && typeof window.PRFirebase.requireAuth === "function") {
    const profile = await window.PRFirebase.requireAuth();
    if (!profile) {
      return;
    }
  }

  await loadSharedData();
  renderAll();

  setupTeacherForm();
  document.getElementById("generateSundays").addEventListener("click", generateUpcomingSchedule);
  document.getElementById("printSchedule").addEventListener("click", () => window.print());
  document.getElementById("scheduleGroupFilter").addEventListener("change", renderSchedule);
  document.getElementById("scheduleStatusFilter").addEventListener("change", renderSchedule);
  document.getElementById("prevMonth").addEventListener("click", () => {
    currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
    renderMonthCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", () => {
    currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
    renderMonthCalendar();
  });
}

document.addEventListener("DOMContentLoaded", setupSchedulePage);
