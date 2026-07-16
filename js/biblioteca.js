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

function asList(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
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
      <p><strong>Autor:</strong> ${escapeHtml(text.author || "Informacion no especificada")}</p>
      <p><strong>Fecha aproximada:</strong> ${escapeHtml(text.date || "Informacion no especificada")}</p>
      <p>${formatParagraph(text.context, "Lee el pasaje principal y conecta la verdad biblica con la vida diaria del grupo.")}</p>
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
          <p>${formatParagraph(point.text, "Explica esta verdad con palabras sencillas y aplica el texto a la vida del grupo.")}</p>
        </div>
      `).join("")}
    </section>
  `;
}

function renderTeacherGuide(lesson) {
  const guide = lesson.teacherGuide;
  const guideList = Array.isArray(guide) ? guide : [];
  const teacherObjective = !Array.isArray(guide) && guide && guide.teacherObjective
    ? guide.teacherObjective
    : lesson.goal || lesson.centralIdea || "Guiar la clase con claridad biblica y aplicacion practica.";
  const openingIdeas = !Array.isArray(guide) && guide && guide.openingIdeas
    ? asList(guide.openingIdeas)
    : guideList.length
      ? guideList
      : asList(lesson.warmup || "Comienza conectando el tema con una experiencia diaria.");
  const difficultQuestions = !Array.isArray(guide) && guide && guide.difficultQuestions
    ? asList(guide.difficultQuestions)
    : asList("Si surge una pregunta dificil, responde con humildad y vuelve al texto biblico principal.");
  const commonErrors = !Array.isArray(guide) && guide && guide.commonErrors
    ? asList(guide.commonErrors)
    : asList("Evita hacer la actividad sin conectar la verdad biblica con Cristo y la vida diaria.");
  const extraVerses = !Array.isArray(guide) && guide && guide.extraVerses
    ? asList(guide.extraVerses)
    : asList(lesson.verse || (lesson.studentMaterial && lesson.studentMaterial.memoryVerse));

  return `
    <section class="lesson-section teacher-guide-box">
      <p class="section-kicker">Material para el maestro</p>
      <h2>Guia de preparacion</h2>
      <p>${formatParagraph(teacherObjective, "Guiar la clase con claridad biblica y aplicacion practica.")}</p>
      <h3>Ideas para comenzar</h3>
      ${formatList(openingIdeas)}
      <h3>Preguntas dificiles</h3>
      ${formatList(difficultQuestions)}
      <h3>Errores doctrinales comunes</h3>
      ${formatList(commonErrors)}
      <h3>Versiculos adicionales</h3>
      ${formatList(extraVerses)}
    </section>
  `;
}

function renderStudentMaterial(lesson) {
  const material = lesson.studentMaterial || {};
  const memoryVerse = material.memoryVerse || lesson.verse || "Repasar el versiculo principal de la clase.";
  const weeklyReading = material.weeklyReading || lesson.verse || "Repasar el pasaje biblico principal con un adulto.";
  const activity = material.activity || lesson.challenge || lesson.dynamic || "Practicar la ensenanza durante la semana.";
  const notesPrompt = material.notesPrompt || material.reflection || "Hoy aprendi que...";
  const application = material.application || material.homework || material.reflection || lesson.application || lesson.challenge || "Aplicar la verdad aprendida esta semana.";

  return `
    <section class="lesson-section student-material-box">
      <p class="section-kicker">Material para el estudiante</p>
      <h2>Para recordar y practicar</h2>
      <p><strong>Versiculo:</strong> ${escapeHtml(memoryVerse)}</p>
      <p><strong>Lectura semanal:</strong> ${escapeHtml(weeklyReading)}</p>
      <p><strong>Actividad:</strong> ${formatParagraph(activity, "Practicar la ensenanza durante la semana.")}</p>
      <p><strong>Notas:</strong> ${escapeHtml(notesPrompt)}</p>
      <p><strong>Aplicacion:</strong> ${formatParagraph(application, "Aplicar la verdad aprendida esta semana.")}</p>
    </section>
  `;
}

function renderParentMaterial(lesson) {
  const material = lesson.parentMaterial || {};
  const summary = material.summary || material.whatWeLearned || lesson.summary || "Esta semana estudiamos una verdad biblica importante para vivir en casa.";
  const verse = material.verse || (lesson.studentMaterial && lesson.studentMaterial.memoryVerse) || lesson.verse || "Repasar el versiculo principal.";
  const familyQuestions = material.familyQuestions && material.familyQuestions.length
    ? material.familyQuestions
    : [
      material.homeQuestion,
      lesson.questions && lesson.questions[0],
      "Como podemos vivir esto en casa?"
    ].filter(Boolean).slice(0, 3);
  const activity = material.activity || material.familyChallenge || lesson.challenge || "Conversen en familia y practiquen una accion sencilla relacionada con la clase.";
  const prayer = material.prayer || material.parentNote || lesson.prayer || "Senor, ayudanos a vivir tu Palabra en nuestro hogar. Amen.";

  return `
    <section class="lesson-section parent-material-box">
      <p class="section-kicker">Material para los padres</p>
      <h2>Discipulado en el hogar</h2>
      <p>${formatParagraph(summary, "Esta semana estudiamos una verdad biblica importante para vivir en casa.")}</p>
      <p><strong>Versiculo:</strong> ${escapeHtml(verse)}</p>
      <h3>Preguntas familiares</h3>
      ${formatList(familyQuestions)}
      <p><strong>Actividad:</strong> ${formatParagraph(activity, "Conversen en familia y practiquen una accion sencilla relacionada con la clase.")}</p>
      <p><strong>Oracion:</strong> ${formatParagraph(prayer, "Senor, ayudanos a vivir tu Palabra en nuestro hogar. Amen.")}</p>
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
    option.textContent = `${lesson.date} - ${lesson.displayTitle || lesson.title}`;
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
  const lessonTitle = lesson.displayTitle || lesson.title || "Clase seleccionada";

  document.getElementById("previewHeading").textContent = lessonTitle;
  document.getElementById("previewGroup").textContent = `Ministerio CRECE - ${getGroupLabel(lesson.group)}`;
  document.getElementById("previewTitle").textContent = lessonTitle;
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
      <h2>${escapeHtml(lesson.verse || (lesson.studentMaterial && lesson.studentMaterial.memoryVerse) || "Repasar el versiculo principal de la clase.")}</h2>
    </section>

    ${lesson.bibleContext ? `
      <section class="lesson-section">
        <p class="section-kicker">Contexto biblico</p>
        <p>${formatParagraph(lesson.bibleContext, "Lee el pasaje principal y conecta la verdad biblica con la vida diaria del grupo.")}</p>
      </section>
    ` : ""}

    <section class="lesson-section">
      <p class="section-kicker">Ensenanza</p>
      <p>${formatParagraph(lesson.summary, "La clase aun no tiene resumen publicado.")}</p>
    </section>

    ${renderExposition(lesson)}

    <section class="lesson-section">
      <p class="section-kicker">Inicio dinamico</p>
      <p>${formatParagraph(lesson.warmup, "Comienza con una pregunta sencilla conectada con la experiencia diaria del grupo.")}</p>
    </section>

    <section class="lesson-section visual-box">
      <p class="section-kicker">Recurso visual</p>
      <p>${formatParagraph(lesson.visual, "Usa una imagen, dibujo, objeto o palabra clave que ayude a recordar la verdad central.")}</p>
    </section>

    <section class="lesson-section dynamic-box">
      <p class="section-kicker">Dinamica</p>
      <p>${formatParagraph(lesson.dynamic, "Realiza una actividad participativa que conecte el texto biblico con una decision practica.")}</p>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Aplicacion</p>
      <p>${formatParagraph(lesson.application || lesson.challenge || (lesson.studentMaterial && (lesson.studentMaterial.homework || lesson.studentMaterial.reflection)), "Escoge una accion concreta para vivir esta verdad durante la semana.")}</p>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Reto de la semana</p>
      <p>${formatParagraph(lesson.challenge || (lesson.studentMaterial && lesson.studentMaterial.homework), "Practicar la ensenanza con una accion sencilla durante la semana.")}</p>
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
      <li><i class="bi bi-bullseye"></i> ${escapeHtml(lesson.goal || lesson.centralIdea || "Guiar la clase hacia una respuesta practica a la Palabra.")}</li>
      <li><i class="bi bi-backpack"></i> ${escapeHtml(lesson.materials || "Biblia, hojas, lapices y materiales sencillos para la actividad.")}</li>
      <li><i class="bi bi-person-video3"></i> ${escapeHtml(lesson.teacherNotes || "Conecta cada actividad con la verdad biblica y la aplicacion semanal.")}</li>
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
