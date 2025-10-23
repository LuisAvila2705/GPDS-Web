import { auth, db } from "./firebase.js";
import { uploadImages } from "./uploaderCloudinary.js";
import {
  addDoc, collection, serverTimestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const btn = $("#btnPublicar");
const msg = $("#pubMsg");

async function getPerfil(uid){
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

btn?.addEventListener("click", async () => {
  try {
    msg.textContent = "";
    btn.disabled = true; btn.textContent = "Publicando…";

    const user = auth.currentUser;
    if (!user) { msg.textContent = "Inicia sesión."; return; }

    const descripcion = $("#desc").value.trim();
    const categoria   = $("#categoria").value;
    const zona        = $("#zona").value.trim();
    if (!descripcion) { msg.textContent = "Escribe una descripción."; return; }

    // 1) subir imágenes (si se eligieron)
    const files = $("#files").files;
    const media = await uploadImages(files); // [] si no eligió nada

    // 2) datos del autor (denormalizados)
    const perfil = await getPerfil(user.uid);
    const autorNombre = perfil?.nombre || user.displayName || "Usuario";
    const autorFoto   = perfil?.fotoPerfil || null;

    // 3) impacto simple por categoría
    const pesos = { limpieza:5, reciclaje:7, taller:4, donacion:6 };
    const impactoPuntos = pesos[categoria] ?? 3;

    // 4) crear doc en Firestore
    await addDoc(collection(db, "acciones"), {
      autorUid: user.uid,
      autorNombre,
      autorFoto,
      descripcion,
      categoria,
      media,               //  array devuelto por Cloudinary
      zona: zona || null,
      validado: false,
      reaccionesCount: 0,
      comentariosCount: 0,
      impactoPuntos,
      creadoEl: serverTimestamp(),
      actualizadoEl: serverTimestamp(),
    });

    msg.textContent = "¡Acción publicada! ✅";
    $("#desc").value = "";
    $("#zona").value = "";
    $("#files").value = "";
  } catch (e) {
    console.error(e);
    msg.textContent = "No se pudo publicar.";
  } finally {
    btn.disabled = false; btn.textContent = "Publicar";
  }
});


// ---- UI: contador de caracteres ----
const desc = document.querySelector("#desc");
const charCount = document.querySelector("#charCount");
desc?.addEventListener("input", () => {
  const n = desc.value.length;
  charCount.textContent = `${n}/500`;
});

// ---- UI: preview de imágenes ----
const fileInput = document.querySelector("#files");
const preview = document.querySelector("#preview");
const hintFiles = document.querySelector("#hintFiles");

const MAX_FILES = 4;

fileInput?.addEventListener("change", () => {
  preview.innerHTML = "";
  const files = Array.from(fileInput.files || []);
  if (files.length > MAX_FILES) {
    hintFiles.textContent = `Máximo ${MAX_FILES} imágenes`;
    hintFiles.style.color = "#c0392b";
  } else {
    hintFiles.textContent = "Hasta 4 imágenes (JPG/PNG/WEBP)";
    hintFiles.style.color = "";
  }

  files.slice(0, MAX_FILES).forEach((f, idx) => {
    const url = URL.createObjectURL(f);
    const card = document.createElement("div");
    card.className = "thumb";
    card.innerHTML = `
      <img src="${url}" alt="preview ${idx+1}" />
      <button class="rm" title="Quitar" data-i="${idx}">✕</button>
    `;
    preview.appendChild(card);
  });
});

// Quitar una imagen del preview (y del FileList)
preview?.addEventListener("click", (e) => {
  const btn = e.target.closest(".rm");
  if (!btn) return;
  const i = Number(btn.dataset.i);

  // reconstruimos FileList sin el índice i
  const dt = new DataTransfer();
  Array.from(fileInput.files).forEach((f, idx) => { if (idx !== i) dt.items.add(f); });
  fileInput.files = dt.files;

  // re-disparar para re-dibujar
  fileInput.dispatchEvent(new Event("change"));
});

window.toggleMenu = () => userDropdown?.classList.toggle("oculto");
