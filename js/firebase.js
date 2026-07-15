/*
  Firebase / Firestore para Ministerio CRECE.

  Esta version separa la data por iglesia:
  churches/{churchId}/students
  churches/{churchId}/attendance
  churches/{churchId}/lessons

  Cada usuario tiene un perfil en users/{uid} con su churchId y role.
*/

const firebaseConfig = {
  apiKey: "AIzaSyB9mhUEJCoa4r5_zKXXhQjmBriyQQ-fxHc",
  authDomain: "ministerio-crece-prfwb.firebaseapp.com",
  projectId: "ministerio-crece-prfwb",
  storageBucket: "ministerio-crece-prfwb.firebasestorage.app",
  messagingSenderId: "778705107251",
  appId: "1:778705107251:web:a52ecdc5391b4cf371e646"
};

function hasFirebaseConfig() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("TU_")
    && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("TU_");
}

function sortByCreatedAtDesc(records) {
  return records.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

let firestoreDb = null;
let authService = null;
let currentUser = null;
let currentProfile = null;

if (hasFirebaseConfig() && window.firebase) {
  firebase.initializeApp(firebaseConfig);
  firestoreDb = firebase.firestore();
  authService = firebase.auth ? firebase.auth() : null;
}

const authReady = new Promise((resolve) => {
  if (!authService || !firestoreDb) {
    resolve(null);
    return;
  }

  authService.onAuthStateChanged(async (user) => {
    currentUser = user;
    currentProfile = null;

    if (user) {
      try {
        const profileDoc = await firestoreDb.collection("users").doc(user.uid).get();
        currentProfile = profileDoc.exists ? profileDoc.data() : null;
      } catch (error) {
        console.warn("No se pudo cargar el perfil del usuario.", error);
        currentProfile = null;
      }
    }

    resolve(currentProfile);
  });
});

function getNextUrl() {
  return `${window.location.pathname.split("/").pop()}${window.location.search || ""}`;
}

function redirectToLogin() {
  const next = encodeURIComponent(getNextUrl());
  window.location.href = `login.html?next=${next}`;
}

async function requireAuth(options = {}) {
  const { adminOnly = false } = options;

  if (!authService || !firestoreDb) {
    return null;
  }

  await authReady;

  if (!currentUser || !currentProfile) {
    redirectToLogin();
    return null;
  }

  if (adminOnly && currentProfile.role !== "admin") {
    window.alert("Solo el administrador de la iglesia puede abrir esta pagina.");
    window.location.href = "index.html";
    return null;
  }

  return currentProfile;
}

function getChurchCollection(collectionName) {
  if (!firestoreDb || !currentProfile || !currentProfile.churchId) {
    return null;
  }

  return firestoreDb
    .collection("churches")
    .doc(currentProfile.churchId)
    .collection(collectionName);
}

async function createChurchAccount(data) {
  if (!authService || !firestoreDb) {
    throw new Error("Firebase Auth no esta disponible.");
  }

  const credential = await authService.createUserWithEmailAndPassword(data.email, data.password);
  const user = credential.user;
  const churchRef = firestoreDb.collection("churches").doc();
  const now = new Date().toISOString();

  const church = {
    id: churchRef.id,
    name: data.churchName,
    city: data.city || "",
    createdAt: now,
    ownerUid: user.uid
  };

  const profile = {
    uid: user.uid,
    churchId: churchRef.id,
    churchName: data.churchName,
    name: data.leaderName,
    email: data.email,
    role: "admin",
    createdAt: now
  };

  await firestoreDb.collection("churches").doc(churchRef.id).set(church);
  await firestoreDb.collection("users").doc(user.uid).set(profile);

  currentUser = user;
  currentProfile = profile;

  return profile;
}

window.PRFirebase = {
  enabled: Boolean(firestoreDb),
  authEnabled: Boolean(authService),

  async registerChurch(data) {
    return createChurchAccount(data);
  },

  async login(email, password) {
    if (!authService) {
      throw new Error("Firebase Auth no esta disponible.");
    }

    const credential = await authService.signInWithEmailAndPassword(email, password);
    const profileDoc = await firestoreDb.collection("users").doc(credential.user.uid).get();
    currentUser = credential.user;
    currentProfile = profileDoc.exists ? profileDoc.data() : null;

    if (!currentProfile) {
      throw new Error("Este usuario no tiene una iglesia asignada.");
    }

    return currentProfile;
  },

  async logout() {
    if (authService) {
      await authService.signOut();
    }

    currentUser = null;
    currentProfile = null;
    window.location.href = "login.html";
  },

  async requireAuth(options) {
    return requireAuth(options);
  },

  async getProfile() {
    await authReady;
    return currentProfile;
  },

  getScopedStorageKey(baseKey) {
    return currentProfile && currentProfile.churchId
      ? `${baseKey}_${currentProfile.churchId}`
      : baseKey;
  },

  async saveStudent(student) {
    await requireAuth();
    const collection = getChurchCollection("students");

    if (!collection) {
      console.info("Firebase no esta activo. Estudiante local:", student);
      return;
    }

    await collection.doc(student.code).set({
      ...student,
      churchId: currentProfile.churchId
    }, { merge: true });
  },

  async getStudents() {
    await requireAuth();
    const collection = getChurchCollection("students");

    if (!collection) {
      return [];
    }

    const snapshot = await collection.get();
    return sortByCreatedAtDesc(snapshot.docs.map((doc) => doc.data()));
  },

  async saveAttendance(record) {
    await requireAuth();
    const collection = getChurchCollection("attendance");

    if (!collection) {
      console.info("Firebase no esta activo. Asistencia local:", record);
      return;
    }

    await collection.doc(record.id).set({
      ...record,
      churchId: currentProfile.churchId
    }, { merge: true });
  },

  async getAttendance() {
    await requireAuth();
    const collection = getChurchCollection("attendance");

    if (!collection) {
      return [];
    }

    const snapshot = await collection.get();
    return sortByCreatedAtDesc(snapshot.docs.map((doc) => doc.data()));
  },

  async saveLesson(group, lesson) {
    await requireAuth();
    const collection = getChurchCollection("lessons");

    if (!collection) {
      return;
    }

    await collection.doc(group).set({
      ...lesson,
      churchId: currentProfile.churchId
    }, { merge: true });
  },

  async getLesson(group) {
    await requireAuth();
    const collection = getChurchCollection("lessons");

    if (!collection) {
      return null;
    }

    const doc = await collection.doc(group).get();
    return doc.exists ? doc.data() : null;
  }
};
