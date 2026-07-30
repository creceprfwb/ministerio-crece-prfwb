// Clave local donde se guardan las clases publicadas por grupo.
const LESSONS_STORAGE_KEY = "prfwb_weekly_lessons";

function storageKey(baseKey) {
  return window.PRFirebase && typeof window.PRFirebase.getScopedStorageKey === "function"
    ? window.PRFirebase.getScopedStorageKey(baseKey)
    : baseKey;
}

// Plantillas iniciales para que la página no se vea vacía mientras se cargan las clases.
const DEFAULT_LESSONS = {
  ninos: {
    title: "Clase para Niños",
    verse: "Versículo clave pendiente",
    goal: "Aprender la enseñanza principal de la clase de hoy.",
    summary: "Aqui se mostrara la clase preparada por la maestra.",
    warmup: "Comienza con una pregunta sencilla relacionada con la vida diaria.",
    materials: "Biblia, hoja, lapices y materiales sencillos para actividad.",
    visual: "Dibujo sugerido: una imagen simple que represente el tema de la clase.",
    dynamic: "Dinámica sugerida: una conversación breve con una pregunta sencilla antes de comenzar.",
    application: "Durante la semana, el estudiante practicara una acción relacionada con la enseñanza.",
    questions: ["¿Qué aprendiste hoy?", "¿Cómo puedes practicarlo esta semana?"],
    challenge: "Practicar una acción sencilla durante la semana.",
    teacherNotes: "Mantener el lenguaje simple, participativo y centrado en Cristo.",
    updatedAt: ""
  },
  juveniles: {
    title: "Clase para Juveniles",
    verse: "Versículo clave pendiente",
    goal: "Conectar la enseñanza bíblica con decisiones reales de la semana.",
    summary: "Aqui se mostrara la clase preparada por la maestra.",
    warmup: "Abre con una pregunta real que conecte con escuela, familia o amistades.",
    materials: "Biblia, libreta o teléfono para notas, y una pregunta de conversación.",
    visual: "Recurso sugerido: una frase clave en pantalla o pizarra para iniciar dialogo.",
    dynamic: "Dinámica sugerida: abrir con una situación real y conversar cómo responder bíblicamente.",
    application: "Durante la semana, el estudiante aplicara la enseñanza en una decisión concreta.",
    questions: ["¿Qué parte de la enseñanza te reta más?", "¿Qué decisión puedes tomar esta semana?"],
    challenge: "Escoger una decisión concreta para vivir la enseñanza esta semana.",
    teacherNotes: "Dar espacio para respuestas honestas y llevar la conversación a la Biblia.",
    updatedAt: ""
  }
};

function getLessons() {
  const rawLessons = localStorage.getItem(storageKey(LESSONS_STORAGE_KEY));
  return rawLessons ? JSON.parse(rawLessons) : {};
}

function saveLessons(lessons) {
  localStorage.setItem(storageKey(LESSONS_STORAGE_KEY), JSON.stringify(lessons));
}

function getLesson(group) {
  const lessons = getLessons();
  return lessons[group] || DEFAULT_LESSONS[group];
}

async function getSharedLesson(group) {
  if (!window.PRFirebase || !window.PRFirebase.enabled || typeof window.PRFirebase.getLesson !== "function") {
    return getLesson(group);
  }

  try {
    const cloudLesson = await window.PRFirebase.getLesson(group);

    if (cloudLesson) {
      const lessons = getLessons();
      lessons[group] = cloudLesson;
      saveLessons(lessons);
      return cloudLesson;
    }
  } catch (error) {
    console.warn("No se pudo cargar la clase compartida.", error);
  }

  return getLesson(group);
}

async function saveLesson(group, lesson) {
  const lessons = getLessons();
  lessons[group] = lesson;
  saveLessons(lessons);

  if (window.PRFirebase && window.PRFirebase.enabled && typeof window.PRFirebase.saveLesson === "function") {
    try {
      await window.PRFirebase.saveLesson(group, lesson);
    } catch (error) {
      console.warn("La clase se guardo localmente, pero no se pudo guardar en Firebase.", error);
    }
  }
}

function formatQuestions(questions) {
  if (!questions || !questions.length) {
    return "<li>No hay preguntas publicadas todavía.</li>";
  }

  return questions.map((question) => `<li>${question}</li>`).join("");
}

async function renderLessonPage(group) {
  if (window.PRFirebase && typeof window.PRFirebase.requireAuth === "function") {
    const profile = await window.PRFirebase.requireAuth();
    if (!profile) {
      return;
    }
  }

  const lesson = await getSharedLesson(group);
  const title = document.getElementById("lessonTitle");
  const intro = document.getElementById("lessonIntro");
  const content = document.getElementById("lessonContent");
  const resources = document.getElementById("lessonResources");

  if (!title || !intro || !content || !resources) {
    return;
  }

  title.textContent = lesson.title;
  intro.textContent = lesson.goal || "Clase preparada para el grupo.";

  content.innerHTML = `
    <section class="lesson-section">
      <p class="section-kicker">Versículo clave</p>
      <h2>${lesson.verse || "Pendiente"}</h2>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Enseñanza</p>
      <p>${lesson.summary || "La clase aún no tiene resumen publicado."}</p>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Inicio dinámico</p>
      <p>${lesson.warmup || "Inicio dinámico pendiente."}</p>
    </section>

    <section class="lesson-section visual-box">
      <p class="section-kicker">Recurso visual</p>
      <p>${lesson.visual || "Recurso visual pendiente."}</p>
    </section>

    <section class="lesson-section dynamic-box">
      <p class="section-kicker">Dinámica</p>
      <p>${lesson.dynamic || "Dinámica pendiente."}</p>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Aplicación</p>
      <p>${lesson.application || "Aplicación pendiente."}</p>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Reto de la semana</p>
      <p>${lesson.challenge || "Reto pendiente."}</p>
    </section>

    <section class="lesson-section">
      <p class="section-kicker">Oración final</p>
      <p>${lesson.prayer || "Señor, ayúdanos a vivir tu Palabra con un corazón obediente. Amén."}</p>
    </section>
  `;

  resources.innerHTML = `
    <h2>Recursos</h2>
    <ul class="resource-list">
      <li><i class="bi bi-bullseye"></i> ${lesson.goal || "Objetivo pendiente"}</li>
      <li><i class="bi bi-backpack"></i> ${lesson.materials || "Materiales pendientes"}</li>
      <li><i class="bi bi-person-video3"></i> ${lesson.teacherNotes || "Notas para la maestra pendientes"}</li>
      <li><i class="bi bi-chat-square-text"></i> Preguntas de conversación</li>
    </ul>

    <ol class="question-list">
      ${formatQuestions(lesson.questions)}
    </ol>

    <button class="btn btn-primary w-100 mt-3 no-print" type="button" onclick="window.print()">
      <i class="bi bi-printer"></i>
      Imprimir versión de clase
    </button>
  `;
}

// Expone funciones para maestro.js sin usar herramientas de build.
window.PRLessons = {
  getLesson,
  getSharedLesson,
  saveLesson,
  renderLessonPage
};
