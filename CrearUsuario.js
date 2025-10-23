// js/CrearUsuario.js
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { uploadImages } from "./uploaderCloudinary.js";


const $ = s => document.querySelector(s);
const form = $("#registroForm");
const btn  = $("#btnCrear");
const msg  = $("#msg");

const inputNombre   = $("#nombre");
const inputEmail    = $("#email");
const inputEmail2   = $("#email2");
const inputPassword = $("#password");
const inputTelefono = $("#telefono");
const inputCiudad   = $("#ciudad");
const inputRol      = $("#rol");
const inputAcepta   = $("#acepta");

const errNombre   = $("#err-nombre");
const errEmail    = $("#err-email");
const errEmail2   = $("#err-email2");
const errPassword = $("#err-password");
const errTelefono = $("#err-telefono");
const errCiudad   = $("#err-ciudad");   // 👈 (opcional en tu HTML)
const errAcepta   = $("#err-acepta");

const meter = $("#pwd-meter");
const bar   = $("#pwd-bar");

const inputFoto       = $("#foto");
const hintFoto        = $("#hintFoto");
const fotoPreview     = $("#fotoPreview");

// Lista de contraseñas prohibidas comunes (puedes ampliar)
const BAD_PASSWORDS = new Set([
  "password","123456","123456789","qwerty","111111","abc123","password1",
  "12345678","admin","123123","000000","iloveyou","1234","12345"
]);

function setLoading(v){ if(!btn) return; btn.disabled = v; btn.textContent = v ? "Creando..." : "Crear mi cuenta"; }
function showMessage(text, type="info"){ if(!msg) return; msg.textContent = text; msg.className = type; }
function setError(input, errEl, text){
  if(!input || !errEl) return;
  errEl.textContent = text || "";
  input.classList.toggle("error", !!text);
  input.classList.toggle("ok", !text && input.value.trim().length>0);
}

// Validaciones
const reNombre    = /^[A-Za-zÁÉÍÓÚáéíóúñÑ ]{2,60}$/;
const reTelefono  = /^\d{10}$/;
const reHasUpper  = /[A-Z]/;
const reHasLower  = /[a-z]/;
const reHasDigit  = /\d/;
const reHasSpecial= /[^A-Za-z0-9]/;
const reNoSpace   = /^\S+$/;

function scorePassword(pwd){
  if(!pwd) return 0;
  let s = 0;
  if (pwd.length >= 10) s += 2; else if (pwd.length >= 8) s += 1;
  if (reHasUpper.test(pwd)) s++;
  if (reHasLower.test(pwd)) s++;
  if (reHasDigit.test(pwd)) s++;
  if (reHasSpecial.test(pwd)) s++;
  if (BAD_PASSWORDS.has(pwd.toLowerCase())) s = 0;
  return Math.min(s, 7);
}

function updatePwdMeter(){
  if (!bar) return;
  const val = inputPassword?.value || "";
  const s = scorePassword(val);
  const pct = (s / 7) * 100;
  bar.style.width = `${pct}%`;
  if (s <= 2) bar.style.background = "#ef4444";     // rojo
  else if (s <= 4) bar.style.background = "#f59e0b"; // amarillo
  else bar.style.background = "#16a34a";             // verde
}

function validateNombre(){
  const v = (inputNombre?.value || "").trim();
  if (!reNombre.test(v)) {
    setError(inputNombre, errNombre, "Usa solo letras y espacios (2–60).");
    return false;
  }
  setError(inputNombre, errNombre, "");
  return true;
}

function validateEmails(){
  const e1 = (inputEmail?.value || "").trim();
  const e2 = (inputEmail2?.value || "").trim();
  let ok = true;

  if (!e1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e1)) {
    setError(inputEmail, errEmail, "Correo inválido.");
    ok = false;
  } else {
    setError(inputEmail, errEmail, "");
  }

  if (e1 !== e2) {
    setError(inputEmail2, errEmail2, "Los correos no coinciden.");
    ok = false;
  } else {
    setError(inputEmail2, errEmail2, "");
  }
  return ok;
}

/* 👇 Teléfono: obligatorio, solo dígitos, exactamente 10 */
function validateTelefono(){
  const t = (inputTelefono?.value || "").trim();
  if (!reTelefono.test(t)) {
    setError(inputTelefono, errTelefono, "Debe tener exactamente 10 dígitos.");
    return false;
  }
  setError(inputTelefono, errTelefono, "");
  return true;
}

/* 👇 Ciudad/municipio: obligatorio (dropdown) */
function validateCiudad(){
  const v = (inputCiudad?.value || "").trim();
  if (!v) {
    setError(inputCiudad, errCiudad, "Selecciona tu municipio.");
    return false;
  }
  setError(inputCiudad, errCiudad, "");
  return true;
}

function validatePassword(){
  const p = inputPassword?.value || "";
  let error = "";
  if (BAD_PASSWORDS.has(p.toLowerCase())) error = "Contraseña muy común, elige otra.";
  else if (p.length < 10) error = "Mínimo 10 caracteres.";
  else if (!reNoSpace.test(p)) error = "No se permiten espacios.";
  else if (!reHasUpper.test(p)) error = "Debe incluir al menos 1 mayúscula.";
  else if (!reHasLower.test(p)) error = "Debe incluir al menos 1 minúscula.";
  else if (!reHasDigit.test(p)) error = "Debe incluir al menos 1 número.";
  else if (!reHasSpecial.test(p)) error = "Debe incluir al menos 1 carácter especial.";

  setError(inputPassword, errPassword, error);
  updatePwdMeter();
  return error === "";
}

function validateAcepta(){
  if (!inputAcepta?.checked) {
    if (errAcepta) errAcepta.textContent = "Debes aceptar términos y privacidad.";
    return false;
  }
  if (errAcepta) errAcepta.textContent = "";
  return true;
}

function updateSubmitState(){
  const ok =
    validateNombre() &
    validateEmails() &
    validateTelefono() &     // 👈 ahora obligatorio
    validateCiudad() &       // 👈 nuevo
    validatePassword() &
    validateAcepta();
  if (btn) btn.disabled = !ok;
}

// ===== Listeners (validación en vivo) =====

// Tel: normaliza a dígitos y limita a 10
inputTelefono?.addEventListener("input", () => {
  const only = (inputTelefono.value || "").replace(/\D+/g, "");
  inputTelefono.value = only.slice(0, 10);
  validateTelefono();
  updateSubmitState();
});

[inputNombre, inputEmail, inputEmail2, inputPassword, inputAcepta, inputCiudad]
  .forEach(el => el?.addEventListener("input", updateSubmitState));

// password meter
inputPassword?.addEventListener("input", updatePwdMeter);

// Init
updateSubmitState();
updatePwdMeter();

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  updateSubmitState();
  if (btn?.disabled) return;

  showMessage("");
  setLoading(true);

  // Preview en vivo + validación ligera (≤ 2MB)
inputFoto?.addEventListener("change", () => {
  const f = inputFoto.files?.[0];
  if (!f) { fotoPreview.style.display = "none"; return; }
  if (!["image/jpeg","image/png","image/webp"].includes(f.type) || f.size > 4*1024*1024) {
    hintFoto.textContent = "Formato no válido o > 4MB";
    hintFoto.style.color = "#c0392b";
    inputFoto.value = "";
    fotoPreview.style.display = "none";
    return;
  }
  hintFoto.textContent = "JPG/PNG · máx. 4 MB";
  hintFoto.style.color = "";
  const url = URL.createObjectURL(f);
  fotoPreview.src = url;
  fotoPreview.style.display = "block";
});

  try {
    const email = (inputEmail.value || "").trim().toLowerCase();
    const password = inputPassword.value;

    // 1) Auth
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // 2) Perfil visible
    await updateProfile(user, { displayName: (inputNombre.value || "").trim() });

    // 2.1) (Opcional) Subir foto de perfil a Cloudinary
  let fotoPerfilUrl = null;
  let fotoPerfilPublicId = null;
  const fotoFile = inputFoto?.files?.[0];
  if (fotoFile) {
    // Reutiliza tu helper. Acepta arrays, así que [fotoFile] funciona
    const uploaded = await uploadImages([fotoFile]);
    if (uploaded && uploaded[0]) {
      fotoPerfilUrl = uploaded[0].url;         // URL pública
      fotoPerfilPublicId = uploaded[0].publicId; // para poder borrar/cambiar después
    }
  }

    // 3) Firestore -> colección "usuarios"
  await setDoc(doc(db, "usuarios", user.uid), {
    uid: user.uid,
    email: user.email.toLowerCase(),
    nombre: (inputNombre.value || "").trim(),
    rol: (inputRol?.value || "ciudadano"),
    organizacion: null,
    telefono: (inputTelefono.value || "").trim(), // 10 dígitos
    ciudad: (inputCiudad.value || "").trim(),      // municipio NL
    fotoPerfil: fotoPerfilUrl,                     // 👈 guardamos la URL (o null)
    fotoPerfilPublicId: fotoPerfilPublicId,        // 👈 útil para borrar/actualizar después
    creadoEl: serverTimestamp(),
    ultimaConexion: serverTimestamp(),
    estadoCuenta: "activo",
  });

    showMessage("Cuenta creada con éxito ✅", "success");
    window.location.href = "DashboardPrincipal.html";
  } catch (err) {
    console.error(err);
    const code = err.code || "";
    let friendly = "No se pudo crear la cuenta.";
    if (code === "auth/email-already-in-use") friendly = "Ese correo ya está en uso.";
    else if (code === "auth/weak-password") friendly = "Contraseña muy débil.";
    else if (code === "auth/invalid-email") friendly = "Correo inválido.";
    showMessage(friendly, "error");
  } finally {
    setLoading(false);
  }
});
