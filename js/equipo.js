const TEAM_STORAGE_KEY = "prfwb_teacher_records";

let teamMembers = [];
let editingTeamId = null;

function teamStorageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

function escapeTeamHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeTeamText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function loadLocalTeam() {
  const raw = localStorage.getItem(teamStorageKey(TEAM_STORAGE_KEY));
  return raw ? JSON.parse(raw) : [];
}

function saveLocalTeam(records) {
  localStorage.setItem(teamStorageKey(TEAM_STORAGE_KEY), JSON.stringify(records));
}

async function loadSharedTeam() {
  teamMembers = loadLocalTeam();

  if (!window.PRFirebase || !window.PRFirebase.enabled || typeof window.PRFirebase.getTeachers !== "function") {
    return;
  }

  try {
    const cloudTeam = await window.PRFirebase.getTeachers();
    if (cloudTeam.length) {
      teamMembers = cloudTeam;
      saveLocalTeam(teamMembers);
    }
  } catch (error) {
    console.warn("No se pudo cargar el equipo compartido.", error);
  }
}

function getRoleLabel(role) {
  const labels = {
    maestro: "Maestro/a",
    ayudante: "Ayudante",
    ambos: "Maestro/a y ayudante"
  };

  return labels[role] || "Maestro/a";
}

function getGroupLabel(group) {
  const labels = {
    ninos: "Ninos",
    juveniles: "Juveniles",
    ambos: "Ambos grupos"
  };

  return labels[group] || "Ambos grupos";
}

function getAvailabilityLabel(value) {
  const labels = {
    domingo: "Domingos",
    rotativo: "Rotativo",
    solo_suplente: "Solo suplente",
    por_confirmar: "Por confirmar"
  };

  return labels[value] || "Domingos";
}

function createTeamId() {
  return `team-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function saveTeamMember(member) {
  teamMembers = [member, ...teamMembers.filter((item) => item.id !== member.id)];
  saveLocalTeam(teamMembers);

  if (window.PRFirebase && typeof window.PRFirebase.saveTeacher === "function") {
    await window.PRFirebase.saveTeacher(member);
  }
}

function buildTeamMember() {
  const existing = editingTeamId ? teamMembers.find((member) => member.id === editingTeamId) : null;
  const now = new Date().toISOString();
  const role = document.getElementById("teamRole").value;

  return {
    ...(existing || {}),
    id: existing ? existing.id : createTeamId(),
    name: document.getElementById("teamName").value.trim(),
    role,
    ministryRole: role,
    phone: document.getElementById("teamPhone").value.trim(),
    email: document.getElementById("teamEmail").value.trim(),
    group: document.getElementById("teamGroup").value,
    availability: document.getElementById("teamAvailability").value,
    notes: document.getElementById("teamNotes").value.trim(),
    active: existing ? existing.active !== false : true,
    createdAt: existing && existing.createdAt ? existing.createdAt : now,
    updatedAt: now
  };
}

function resetTeamForm() {
  editingTeamId = null;
  document.getElementById("teamForm").reset();
  document.getElementById("teamFormTitle").textContent = "Nuevo servidor";
  document.getElementById("teamFormHelp").textContent = "Registra maestros, ayudantes o personal disponible para ambos roles.";
  document.getElementById("teamSubmitButton").innerHTML = '<i class="bi bi-person-plus"></i> Guardar servidor';
  document.getElementById("cancelTeamEdit").classList.add("d-none");
}

function editTeamMember(id) {
  const member = teamMembers.find((item) => item.id === id);
  if (!member) return;

  editingTeamId = member.id;
  document.getElementById("teamName").value = member.name || "";
  document.getElementById("teamRole").value = member.role || member.ministryRole || "maestro";
  document.getElementById("teamPhone").value = member.phone || "";
  document.getElementById("teamEmail").value = member.email || "";
  document.getElementById("teamGroup").value = member.group || "ambos";
  document.getElementById("teamAvailability").value = member.availability || "domingo";
  document.getElementById("teamNotes").value = member.notes || "";
  document.getElementById("teamFormTitle").textContent = "Editar servidor";
  document.getElementById("teamFormHelp").textContent = "Actualiza la informacion del maestro o ayudante.";
  document.getElementById("teamSubmitButton").innerHTML = '<i class="bi bi-save"></i> Guardar cambios';
  document.getElementById("cancelTeamEdit").classList.remove("d-none");
  document.getElementById("teamForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function getFilteredTeam() {
  const query = normalizeTeamText(document.getElementById("teamSearch").value);
  const roleFilter = document.getElementById("teamRoleFilter").value;
  const groupFilter = document.getElementById("teamGroupFilter").value;

  return teamMembers.filter((member) => {
    const role = member.role || member.ministryRole || "maestro";
    const group = member.group || "ambos";
    const searchText = normalizeTeamText([
      member.name,
      member.phone,
      member.email,
      getRoleLabel(role),
      getGroupLabel(group),
      member.availability,
      member.notes
    ].join(" "));

    return (!query || searchText.includes(query))
      && (!roleFilter || role === roleFilter)
      && (!groupFilter || group === groupFilter);
  });
}

function renderTeamStats() {
  const active = teamMembers.filter((member) => member.active !== false);
  const teachers = active.filter((member) => ["maestro", "ambos"].includes(member.role || member.ministryRole || "maestro"));
  const assistants = active.filter((member) => ["ayudante", "ambos"].includes(member.role || member.ministryRole || "maestro"));
  const paused = teamMembers.filter((member) => member.active === false);

  document.getElementById("activeTeachersCount").textContent = teachers.length;
  document.getElementById("activeAssistantsCount").textContent = assistants.length;
  document.getElementById("totalTeamCount").textContent = teamMembers.length;
  document.getElementById("pausedTeamCount").textContent = paused.length;
}

function renderTeamList() {
  const list = document.getElementById("teamList");
  const filtered = getFilteredTeam();

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-person-video3"></i>
        <span>No hay maestros o ayudantes con esos filtros.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map((member) => {
    const role = member.role || member.ministryRole || "maestro";

    return `
      <article class="team-member-card ${member.active === false ? "inactive-student" : ""}">
        <div class="team-member-main">
          <div class="team-avatar">${escapeTeamHtml((member.name || "?").charAt(0))}</div>
          <div>
            <span class="team-role-pill">${escapeTeamHtml(getRoleLabel(role))}</span>
            <h3>${escapeTeamHtml(member.name)}</h3>
            <p>${escapeTeamHtml(getGroupLabel(member.group))} - ${escapeTeamHtml(getAvailabilityLabel(member.availability))}</p>
          </div>
        </div>
        <div class="team-contact">
          <span><i class="bi bi-whatsapp"></i> ${escapeTeamHtml(member.phone || "Sin telefono")}</span>
          <span><i class="bi bi-envelope"></i> ${escapeTeamHtml(member.email || "Sin email")}</span>
          <span><i class="bi bi-card-text"></i> ${escapeTeamHtml(member.notes || "Sin notas")}</span>
        </div>
        <div class="team-card-actions">
          <button class="btn btn-sm btn-outline-primary edit-team" type="button" data-id="${escapeTeamHtml(member.id)}">
            <i class="bi bi-pencil-square"></i> Editar
          </button>
          <button class="btn btn-sm ${member.active === false ? "btn-outline-success" : "btn-outline-warning"} toggle-team" type="button" data-id="${escapeTeamHtml(member.id)}">
            <i class="bi ${member.active === false ? "bi-check-circle" : "bi-pause-circle"}"></i>
            ${member.active === false ? "Activar" : "Pausar"}
          </button>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll(".edit-team").forEach((button) => {
    button.addEventListener("click", () => editTeamMember(button.dataset.id));
  });

  list.querySelectorAll(".toggle-team").forEach((button) => {
    button.addEventListener("click", async () => {
      const member = teamMembers.find((item) => item.id === button.dataset.id);
      if (!member) return;

      await saveTeamMember({
        ...member,
        active: member.active === false,
        updatedAt: new Date().toISOString()
      });
      renderTeam();
    });
  });
}

function renderTeam() {
  renderTeamStats();
  renderTeamList();
}

function setupTeamEvents() {
  document.getElementById("teamForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const member = buildTeamMember();
    if (!member.name) {
      window.alert("Escribe el nombre del maestro o ayudante.");
      return;
    }

    await saveTeamMember(member);
    resetTeamForm();
    renderTeam();
  });

  document.getElementById("cancelTeamEdit").addEventListener("click", resetTeamForm);
  document.getElementById("teamSearch").addEventListener("input", renderTeamList);
  document.getElementById("teamRoleFilter").addEventListener("change", renderTeamList);
  document.getElementById("teamGroupFilter").addEventListener("change", renderTeamList);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.PRFirebase && typeof window.PRFirebase.requireAuth === "function") {
    const profile = await window.PRFirebase.requireAuth({ adminOnly: true });
    if (!profile) {
      return;
    }
  } else {
    window.location.href = "login.html";
    return;
  }

  await loadSharedTeam();
  setupTeamEvents();
  renderTeam();
});
