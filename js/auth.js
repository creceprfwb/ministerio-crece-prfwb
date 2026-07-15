function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function showAuthMessage(message, type = "danger") {
  const box = document.getElementById("authMessage");

  if (!box) {
    window.alert(message);
    return;
  }

  box.className = `alert alert-${type}`;
  box.textContent = message;
  box.classList.remove("d-none");
}

function setupLoginForm() {
  const form = document.getElementById("loginForm");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const submitButton = form.querySelector("button[type='submit']");

    try {
      submitButton.disabled = true;
      await window.PRFirebase.login(email, password);
      window.location.href = getQueryParam("next") || "index.html";
    } catch (error) {
      showAuthMessage("No se pudo entrar. Verifica el correo y la contrasena.");
      submitButton.disabled = false;
      console.warn(error);
    }
  });
}

function setupChurchRegistrationForm() {
  const form = document.getElementById("churchRegistrationForm");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const submitButton = form.querySelector("button[type='submit']");

    if (password.length < 6) {
      showAuthMessage("La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage("Las contrasenas no coinciden.");
      return;
    }

    try {
      submitButton.disabled = true;
      await window.PRFirebase.registerChurch({
        churchName: String(formData.get("churchName") || "").trim(),
        city: String(formData.get("city") || "").trim(),
        leaderName: String(formData.get("leaderName") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        password
      });

      window.location.href = "index.html";
    } catch (error) {
      showAuthMessage("No se pudo crear la iglesia. Verifica el correo o intenta con otro.");
      submitButton.disabled = false;
      console.warn(error);
    }
  });
}

async function setupHomeSession() {
  const sessionBox = document.getElementById("homeSession");
  const logoutButton = document.getElementById("logoutButton");

  if (!sessionBox) {
    return;
  }

  const profile = await window.PRFirebase.getProfile();

  if (!profile) {
    sessionBox.innerHTML = `
      <a href="login.html" class="btn btn-light btn-sm"><i class="bi bi-box-arrow-in-right"></i> Entrar</a>
      <a href="registro-iglesia.html" class="btn btn-outline-light btn-sm"><i class="bi bi-building-add"></i> Registrar iglesia</a>
    `;
    return;
  }

  sessionBox.innerHTML = `
    <span class="session-chip"><i class="bi bi-building"></i> ${profile.churchName}</span>
    <button id="logoutButton" class="btn btn-outline-light btn-sm" type="button">
      <i class="bi bi-box-arrow-right"></i> Salir
    </button>
  `;

  document.getElementById("logoutButton").addEventListener("click", () => {
    window.PRFirebase.logout();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLoginForm();
  setupChurchRegistrationForm();
  setupHomeSession();
});
