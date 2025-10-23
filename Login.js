// Client/js/Login.js
import { auth, authReady } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form       = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passInput  = document.getElementById("password");
const btnLogin   = document.getElementById("btnLogin");
const msg        = document.getElementById("msg");

const DASHBOARD_URL = "DashboardPrincipal.html";

function setLoading(v) {
  if (!btnLogin) return;
  btnLogin.disabled = v;
  btnLogin.textContent = v ? "Autenticando..." : "Iniciar Sesión";
}
function showMessage(text, type = "info") {
  if (!msg) return;
  msg.textContent = text;
  msg.className = type;
}

// Maneja el submit del login
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passInput?.value || "";

  if (!email || !password) {
    showMessage("Completa correo y contraseña.", "error");
    return;
  }

  setLoading(true);
  showMessage("Verificando credenciales...");

  try {
    // Asegura que la persistencia LOCAL esté configurada antes de loguear
    await authReady;

    const cred = await signInWithEmailAndPassword(auth, email, password);

    // (Opcional) Guardar ID token para llamadas a tu backend
    const idToken = await cred.user.getIdToken(/* forceRefresh */ true);
    localStorage.setItem("idToken", idToken);

    showMessage("Login exitoso ✅", "success");
    window.location.href = DASHBOARD_URL;
  } catch (err) {
    console.error(err);
    const code = err.code || "";
    let friendly = "No se pudo iniciar sesión.";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
      friendly = "Correo o contraseña incorrectos.";
    } else if (code === "auth/user-not-found") {
      friendly = "No existe una cuenta con ese correo.";
    } else if (code === "auth/too-many-requests") {
      friendly = "Demasiados intentos. Inténtalo más tarde.";
    } else if (code === "auth/invalid-email") {
      friendly = "Correo inválido.";
    }
    showMessage(friendly, "error");
  } finally {
    setLoading(false);
  }
});

// Si ya hay sesión (persistencia local), puedes redirigir automáticamente
// Registra el listener sólo cuando la persistencia ya quedó lista
authReady.finally(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Sesión detectada:", user.email);
      // mejor replace() para no dejar el login en el historial
      window.location.replace("DashboardPrincipal.html");
    } else {
      console.log("Sin sesión activa");
    }
  });
});


// (Opcional) Enlace "Olvidé mi contraseña"
export async function resetPassword(email) {
  try {
    const mail = (email || emailInput?.value || "").trim().toLowerCase();
    if (!mail) { showMessage("Ingresa tu correo para recuperar.", "error"); return; }
    await sendPasswordResetEmail(auth, mail);
    showMessage("Te enviamos un correo para restablecer la contraseña.", "success");
  } catch (err) {
    console.error(err);
    showMessage("No pudimos enviar el correo de recuperación.", "error");
  }
}
