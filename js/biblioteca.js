let selectedLesson = null;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatParagraph(value, fallback) {
  return escapeHtml(value || fallback).replace(/\n/g, "<br>");
}

function formatQuestions(questions) {
  if (!questions || !questions.length) {
    return "<li>No hay preguntas publicadas todavia.</li>";
  }

  return questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("");
}

function formatList(items) {
  if (!items || !items.length) {
    return "";
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderBiblicalText(lesson) {
  if (!lesson.biblicalText) {
    return "";
  }

  const text = lesson.biblicalText;

  return `
    <section class="lesson-section visual-box">
      <p class="section-kicker">Texto biblico</p>
      <h2>${escapeHtml(text.book || "")} ${escapeHtml(text.chapter || "")}:${escapeHtml(text.verses || "")}</h2>
      <p><strong>Autor:</strong> ${escapeHtml(text.author || "Pendiente")}</p>
      <p><strong>Fecha aproximada:</strong> ${escapeHtml(text.date || "Pendiente")}</p>
      <p>${formatParagraph(text.context, "Contexto pendiente.")}</p>
    </section>
  `;
}

function renderObjectives(lesson) {
  if (!lesson.objectives || !lesson.objectives.length) {
    return "";
  }

  return `
    <section class="lesson-section">
      <p class="section-kicker">Objetivos</p>
      ${formatList(lesson.objectives)}
    </section>
  `;
}

function renderExposition(lesson) {
  if (!lesson.exposition || !lesson.exposition.length) {
    return "";
  }

  return `
    <section class="lesson-section">
      <p class="section-kicker">Desarrollo expositivo</p>
      ${lesson.exposition.map((point) => `
        <div class="exposition-point">
          <h2>${escapeHtml(point.title || "Punto")}</h2>
          <p>${formatParagraph(point.text, "Contenido pendiente.")}</p>
        </div>
      `).join("")}
    </section>
  `;
}

function renderTeacherGuide(lesson) {
  if (!lesson.teacherGuide) {
    return "";
  }

  const guide = lesson.teacherGuide;

  return `
    <section class="lesson-section teacher-guide-box">
      <p class="section-kicker">Material para el maestro</p>
      <h2>Guia de preparacion</h2>
      <p>${formatParagraph(guide.teacherObjective, "Objetivo del maestro pendiente.")}</p>
      <h3>Ideas para comenzar</h3>
      ${formatList(guide.openingIdeas)}
      <h3>Preguntas dificiles</h3>
      ${formatList(guide.difficultQuestions)}
      <h3>Errores doctrinales comunes</h3>
      ${formatList(guide.commonErrors)}
      <h3>Versiculos adicionales</h3>
      ${formatList(guide.extraVerses)}
    </section>
  `;
}

function renderStudentMaterial(lesson) {
  if (!lesson.studentMaterial) {
    return "";
  }

  const material = lesson.studentMaterial;

  return `
    <section class="lesson-section student-material-box">
      <p class="section-kicker">Material para el estudiante</p>
      <h2>Para recordar y practicar</h2>
      <p><strong>Versiculo:</strong> ${escapeHtml(material.memoryVerse || "Pendiente")}</p>
      <p><strong>Lectura semanal:</strong> ${escapeHtml(material.weeklyReading || "Pendiente")}</p>
      <p><strong>Actividad:</strong> ${formatParagraph(material.activity, "Actividad pendiente.")}</p>
      <p><strong>Notas:</strong> ${escapeHtml(material.notesPrompt || "Hoy aprendi que...")}</p>
      <p><strong>Aplicacion:</strong> ${formatParagraph(material.application, "Aplicacion pendiente.")}</p>
    </section>
  `;
}

function renderParentMaterial(lesson) {
  if (!lesson.parentMaterial) {
    return "";
  }

  const material = lesson.parentMaterial;

  return `
    <section class="lesson-section parent-material-box">
      <p class="section-kicker">Material para los padres</p>
      <h2>Discipulado en el hogar</h2>
      <p>${formatParagraph(material.whatWeLearned, "Resumen del hogar pendiente.")}</p>
      <p><strong>Versiculo:</strong> ${escapeHtml(material.verse || "Pendiente")}</p>
      <h3>Preguntas familiares</h3>
      ${formatList(material.familyQuestions)}
      <p><strong>Actividad:</strong> ${formatParagraph(material.activity, "Actividad pendiente.")}</p>
      <p><strong>Oracion:</strong> ${formatParagraph(material.prayer, "Oracion pendiente.")}</p>
    </section>
  `;
}

function getLessonFields() {
  return [
    "lessonTitle",
    "lessonVerse",
    "lessonGoal",
    "lessonSummary",
    "lessonWarmup",
    "lessonMaterials",
    "lessonVisual",
    "lessonDynamic",
    "lessonApplication",
    "lessonQuestions",
    "lessonChallenge",
    "lessonTeacherNotes"
  ].map((id) => document.getElementById(id)).filter(Boolean);
}

function getGroupLabel(group) {
  return group === "ninos" ? "Ninos" : "Juveniles";
}

function populateLessonLibrary(group) {
  const librarySelect = document.getElementById("lessonLibrarySelect");
  const library = window.PRLessonLibrary && window.PRLessonLibrary[group] ? window.PRLessonLibrary[group] : [];

  librarySelect.innerHTML = '<option value="">Selecciona la clase por fecha</option>';

  library.forEach((lesson, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${lesson.date} - ${lesson.title}`;
    librarySelect.appendChild(option);
  });
}

function getSelectedLibraryLesson(group, index) {
  const library = window.PRLessonLibrary && window.PRLessonLibrary[group] ? window.PRLessonLibrary[group] : [];
  return index === "" ? null : library[Number(index)];
}

function showPreviewPanel(visible) {
  document.getElementById("lessonPreviewPanel").classList.toggle("d-none", !visible);
}

function showEditorPanel(visible) {
  document.getElementById("lessonEditorPanel").classList.toggle("d-none", !visible);
}

function fillLessonFormFromLesson(lesson) {
  document.getElementById("lessonGroupHidden").value = lesson.group;
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

function getLessonFromForm() {
  const form = document.getElementById("lessonForm");
  const formData = new FormData(form);
  const questions = String(formData.get("lessonQuestions") || "")
    .split("\n")
    .map((question) => question.trim())
    .filter(Boolean);

  return {
    ...selectedLesson,
    group: String(formData.get("lessonGroup")),
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
  };
}

function renderLessonPreview(lesson) {
  document.getElementById("previewHeading").textContent = lesson.title || "Clase seleccionada";
  document.getElementById("previewGroup").textContent = `Ministerio CRECE - ${getGroupLabel(lesson.group)}`;
  document.getElementById("previewTitle").textContent = lesson.title || "Clase seleccionada";
  document.getElementById("previewIntro").textContent = lesson.goal || "Clase preparada para el grupo.";
  document.getElementById("previewDate").textContent = lesson.date || "Clase";

  document.getElementById("previewContent").innerHTML = `
    ${renderBiblicalText(lesson)}

    ${lesson.centralIdea ? `
      <section class="lesson-section central-idea-box">
        <p class="section-kicker">Idea central</p>
        <h2>${escapeHtml(lesson.centralIdea)}</h2>
      </section>
    ` : ""}

    ${renderObjectives(lesson)}

    <section class="lesson-section">
      <p class="section-kicker">Versiculo clave</p>
      <h2>${escapeHtml(lesson.verse || "Pendiente")}</h2>
    </section>

    ${lesson.bibleContext ? `
      <section class="lesson-section">
        <p class="section-kicker">Contexto biblico</p>
        <p>${formatParagraph(lesson.bibleContext, "Contexto pendiente.")}</p>
      </section>
    ` : ""}

    <section class="lesson-section">
      <p class="section-kicker">Ensenanza</p>
      <p>${formatParagraph(lesson.summary, "La clase aun no tiene resumen publicado.")}</p>
    </section>

    ${renderExposition(lesson)}

    <section class="lesson-section">
      <p class="section-kicker">Inicio dinamico</p>
      <p>${formatParagraph(lesson.warmup, "Inicio dinamico pendiente.")}</p>
    </section>

    <section class="lesson-section visual-box">
      <p class="section-kicker">Recurso visual</p>
      <p>${formatParagraph(lesson.visual, "Recurso visual pendiente.")}</p>
    </section>

    <section class="lesson-section dynamic-box">
      <p class="section-kicker">Dinamica</p>
      <p>${formatParagraph(lesson.dynamic, "Dinamica pendiente.")}</p>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Aplicacion</p>
      <p>${formatParagraph(lesson.application, "Aplicacion pendiente.")}</p>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Reto de la semana</p>
      <p>${formatParagraph(lesson.challenge, "Reto pendiente.")}</p>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Oracion final</p>
      <p>${formatParagraph(lesson.prayer, "Senor, ayudanos a vivir tu Palabra con un corazon obediente. Amen.")}</p>
    </section>

    ${lesson.closingSummary ? `
      <section class="lesson-section central-idea-box">
        <p class="section-kicker">Resumen</p>
        <h2>${escapeHtml(lesson.closingSummary)}</h2>
      </section>
    ` : ""}
  `;

  document.getElementById("previewResources").innerHTML = `
    <h2>Recursos</h2>
    <ul class="resource-list">
      <li><i class="bi bi-bullseye"></i> ${escapeHtml(lesson.goal || "Objetivo pendiente")}</li>
      <li><i class="bi bi-backpack"></i> ${escapeHtml(lesson.materials || "Materiales pendientes")}</li>
      <li><i class="bi bi-person-video3"></i> ${escapeHtml(lesson.teacherNotes || "Notas para la maestra pendientes")}</li>
      <li><i class="bi bi-chat-square-text"></i> Preguntas de conversacion</li>
    </ul>

    <ol class="question-list">
      ${formatQuestions(lesson.questions)}
    </ol>

    ${renderTeacherGuide(lesson)}
    ${renderStudentMaterial(lesson)}
    ${renderParentMaterial(lesson)}
  `;
}

function selectLesson(lesson) {
  selectedLesson = { ...lesson };
  fillLessonFormFromLesson(selectedLesson);
  renderLessonPreview(selectedLesson);
  showPreviewPanel(true);
  showEditorPanel(false);
  document.getElementById("lessonPreviewPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupPrintButtons() {
  document.getElementById("printLessonButton").addEventListener("click", () => window.print());
  document.getElementById("savePdfButton").addEventListener("click", () => window.print());
}

async function setupLessonEditor() {
  const form = document.getElementById("lessonForm");
  const groupSelect = document.getElementById("lessonGroup");
  const librarySelect = document.getElementById("lessonLibrarySelect");

  if (window.PRFirebase && typeof window.PRFirebase.requireAuth === "function") {
    const profile = await window.PRFirebase.requireAuth();
    if (!profile) {
      return;
    }
  }

  populateLessonLibrary(groupSelect.value);
  showPreviewPanel(false);
  showEditorPanel(false);
  setupPrintButtons();

  groupSelect.addEventListener("change", () => {
    populateLessonLibrary(groupSelect.value);
    librarySelect.value = "";
    selectedLesson = null;
    showPreviewPanel(false);
    showEditorPanel(false);
  });

  librarySelect.addEventListener("change", () => {
    const lesson = getSelectedLibraryLesson(groupSelect.value, librarySelect.value);

    if (lesson) {
      selectLesson(lesson);
    } else {
      selectedLesson = null;
      showPreviewPanel(false);
      showEditorPanel(false);
    }
  });

  document.getElementById("editLessonButton").addEventListener("click", () => {
    if (!selectedLesson) {
      return;
    }

    showEditorPanel(true);
    document.getElementById("lessonEditorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("lessonTitle").focus();
  });

  document.getElementById("cancelEditButton").addEventListener("click", () => {
    if (selectedLesson) {
      fillLessonFormFromLesson(selectedLesson);
    }

    showEditorPanel(false);
    document.getElementById("lessonPreviewPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const lesson = getLessonFromForm();
    await window.PRLessons.saveLesson(lesson.group, lesson);

    selectedLesson = lesson;
    renderLessonPreview(selectedLesson);
    showEditorPanel(false);
    window.alert("Clase publicada correctamente.");
    document.getElementById("lessonPreviewPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

document.addEventListener("DOMContentLoaded", setupLessonEditor);
