async function fillLessonForm(group) {
  const lesson = window.PRLessons ? await window.PRLessons.getSharedLesson(group) : null;

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

function setLessonEditMode(enabled) {
  getLessonFields().forEach((field) => {
    field.readOnly = !enabled;
  });

  const submitButton = document.querySelector("#lessonForm button[type='submit']");
  if (submitButton) {
    submitButton.disabled = !enabled;
  }
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

function updateLessonActions(group, visible = false) {
  const actionButtons = document.getElementById("lessonActionButtons");
  const printLink = document.getElementById("printSelectedLesson");

  if (actionButtons) {
    actionButtons.classList.toggle("d-none", !visible);
  }

  if (!printLink) {
    return;
  }

  printLink.href = group === "ninos" ? "clase-ninos.html" : "clase-juveniles.html";
}

function getSelectedLibraryLesson(group, index) {
  const library = window.PRLessonLibrary && window.PRLessonLibrary[group] ? window.PRLessonLibrary[group] : [];
  return index === "" ? null : library[Number(index)];
}

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
  await fillLessonForm(groupSelect.value);
  setLessonEditMode(false);
  updateLessonActions(groupSelect.value, false);

  groupSelect.addEventListener("change", async () => {
    populateLessonLibrary(groupSelect.value);
    await fillLessonForm(groupSelect.value);
    setLessonEditMode(false);
    updateLessonActions(groupSelect.value, false);
  });

  librarySelect.addEventListener("change", () => {
    const lesson = getSelectedLibraryLesson(groupSelect.value, librarySelect.value);

    if (lesson) {
      fillLessonFormFromLibrary(lesson);
      setLessonEditMode(false);
      updateLessonActions(lesson.group, true);
    }
  });

  document.getElementById("editLessonButton").addEventListener("click", () => {
    setLessonEditMode(true);
    document.getElementById("lessonTitle").focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const group = String(formData.get("lessonGroup"));
    const questions = String(formData.get("lessonQuestions") || "")
      .split("\n")
      .map((question) => question.trim())
      .filter(Boolean);

    await window.PRLessons.saveLesson(group, {
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
    setLessonEditMode(false);
    updateLessonActions(group, true);
  });
}

document.addEventListener("DOMContentLoaded", setupLessonEditor);
