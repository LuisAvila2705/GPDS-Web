// /js/adminPanel.js
import { auth, db } from "/js/firebase.js";
import {
  collection, query, where, orderBy, limit, startAfter, getDocs,
  doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- helpers de selección ----------
const $ = (s) => document.querySelector(s);
const qInput   = $("#q") || $("#buscar") || $("#search") || document.querySelector('input[placeholder*="Buscar"]');
const rolSel   = $("#rolSel") || $("#rol") || document.querySelector('select[name*="rol"]');
const munSel   = $("#munSel") || $("#municipioSel") || document.querySelector('select[name*="municipio"]');
const tblBody  = $("#tblUsers") || $("#tablaUsers") || document.querySelector("tbody");
const btnPrev  = $("#btnPrev")  || document.querySelector('button[data-prev]');
const btnNext  = $("#btnNext")  || document.querySelector('button[data-next]');
const toastEl  = $("#toast");

// ---------- Config HTTP Functions (CORS friendly) ----------
const FUNCTIONS_REGION  = "us-central1";
const PROJECT_ID        = (db?.app?.options?.projectId) || "v2integradora-ef9ea"; // cámbialo si no coincide
const FUNCTIONS_BASE    = `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net`;

// Llamada segura a setCustomRole (onRequest)
async function callSetCustomRole(uid, role) {
  const idToken = await auth.currentUser.getIdToken(/* forceRefresh */ true);
  const res = await fetch(`${FUNCTIONS_BASE}/setCustomRole`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`, // necesaria para auth en Functions
    },
    body: JSON.stringify({ uid, role }),
  });
  if (!res.ok) {
    let details = "";
    try { const j = await res.json(); details = j.error || j.message || JSON.stringify(j); } catch {}
    throw new Error(`HTTP ${res.status} ${res.statusText} ${details}`);
  }
  return res.json();
}

// (Opcional) auditoría genérica
async function callLogAdminAction(payload) {
  const idToken = await auth.currentUser.getIdToken(true);
  const res = await fetch(`${FUNCTIONS_BASE}/logAdminAction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let details = "";
    try { const j = await res.json(); details = j.error || j.message || JSON.stringify(j); } catch {}
    throw new Error(`HTTP ${res.status} ${res.statusText} ${details}`);
  }
  return res.json();
}

// Bonito para mostrar fallos de Functions
function showFnError(err, fallback = "Algo salió mal") {
  // eslint-disable-next-line no-console
  console.error("[functions]", err);
  const txt = (err && err.message) ? err.message : fallback;
  alert(fallback + (txt ? `\n\n${txt}` : ""));
}

// ---------- UI ----------
function showToast(msg, ms = 2500) {
  if (!toastEl) return alert(msg);
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toastEl.style.display = "none"), ms);
}

// Asegura que la opción placeholder de municipio NO aplique filtro
(function fixMunicipioPlaceholder(){
  if (!munSel) return;
  const v = (munSel.value || "").trim().toLowerCase();
  if (v === "munsel" || v === "municipio") munSel.value = "";
  const hasEmpty = Array.from(munSel.options).some(o => (o.value || "") === "");
  if (!hasEmpty) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Municipio (todos)";
    munSel.insertBefore(opt, munSel.firstChild);
    munSel.value = "";
  }
})();

// ---------- paginación ----------
const PAGE_SIZE = 25;
let lastDoc = null;
let pageStack = [];
let currentServerDocs = [];

// ---------- guard: solo admin ----------
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "/login.html"; return; }

  const tok = await user.getIdTokenResult(true);
  let role = tok.claims?.role;
  console.log('[debug] mi claim role:', tok.claims?.role);

  if (!role) {
    const rsnap = await getDocs(query(collection(db,"usuarios"), where("uid","==", user.uid), limit(1)));
    role = rsnap.empty ? null : (rsnap.docs[0].data().rol || null);
    if (role) console.warn("[admin] Usando rol desde Firestore (sin custom claim). Cierra sesión y entra de nuevo para que el claim se refleje.");
  }

  if (role !== "admin") {
    alert("No tengo permisos para listar usuarios. Asegúrate de tener el custom claim 'role: admin' y vuelve a iniciar sesión.");
    window.location.href = "/DashboardPrincipal.html";
    return;
  }

  await loadPage({ reset:true });
});

// ---------- construir query (rol + municipio) ----------
function buildBaseQuery() {
  let qBase = collection(db, "usuarios");
  qBase = query(qBase, orderBy("ultimaConexion", "desc"));

  const rolVal = (rolSel?.value || "").trim();
  if (rolVal) qBase = query(qBase, where("rol", "==", rolVal));

  const munVal = (munSel?.value || "").trim();
  if (munVal) qBase = query(qBase, where("ciudad", "==", munVal));

  return qBase;
}

// ---------- normalización y debounce ----------
const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function debounce(fn, delay=300) {
  let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args), delay); };
}

// ---------- carga página ----------
async function loadPage({ reset=false, after=null } = {}) {
  if (!tblBody) return;

  if (reset) {
    lastDoc = null; pageStack = [];
    tblBody.innerHTML = `<tr><td colspan="7" style="padding:12px">Cargando…</td></tr>`;
  }

  let qBase = buildBaseQuery();
  if (after) qBase = query(qBase, startAfter(after));
  qBase = query(qBase, limit(PAGE_SIZE));

  const snap = await getDocs(qBase);
  currentServerDocs = snap.docs;

  btnPrev && (btnPrev.disabled = pageStack.length === 0);
  btnNext && (btnNext.disabled = snap.empty);

  if (!snap.empty) lastDoc = snap.docs[snap.docs.length - 1];

  renderTable();
}

// ---------- render con filtro por texto (nombre/correo) ----------
function renderTable() {
  if (!tblBody) return;

  const text = norm(qInput?.value || "");
  const matchText = (u) => !text || norm(u.nombre).includes(text) || norm(u.email).includes(text);

  const docs = currentServerDocs.filter(d => matchText(d.data() || {}));
  if (docs.length === 0) {
    tblBody.innerHTML = `<tr><td colspan="7" style="padding:12px">Sin resultados.</td></tr>`;
    return;
  }

  const rows = [];
  for (const d of docs) {
    const u = d.data();
    const fecha  = u.ultimaConexion?.toDate ? u.ultimaConexion.toDate().toLocaleString() : "—";
    const rol    = u.rol || "ciudadano";
    const estado = u.estadoCuenta || "activo";

    rows.push(`
      <tr>
        <td>${u.nombre || ""}</td>
        <td>${u.email || ""}</td>
        <td>
          <select data-role="${d.id}">
            <option value="ciudadano" ${rol==="ciudadano"?"selected":""}>Ciudadano</option>
            <option value="organizacion" ${rol==="organizacion"?"selected":""}>Organización</option>
            <option value="admin" ${rol==="admin"?"selected":""}>Admin</option>
          </select>
        </td>
        <td>${u.ciudad || ""}</td>
        <td>${estado}</td>
        <td>${fecha}</td>
        <td>
          <button data-toggle="${d.id}" data-current="${estado}">
            ${estado==="activo" ? "Bloquear" : "Activar"}
          </button>
        </td>
      </tr>
    `);
  }
  tblBody.innerHTML = rows.join("");
}

// ---------- búsqueda / filtros en vivo ----------
const doSearch = debounce(() => loadPage({ reset:true }), 300);
qInput?.addEventListener("input", doSearch);
rolSel?.addEventListener("change", () => loadPage({ reset:true }));
munSel?.addEventListener("change", () => loadPage({ reset:true }));

// ---------- paginación ----------
btnNext?.addEventListener("click", async () => {
  if (!lastDoc) return;
  pageStack.push(lastDoc);
  await loadPage({ after:lastDoc });
});
btnPrev?.addEventListener("click", async () => {
  if (pageStack.length === 0) return;
  const target = pageStack.pop();

  let qBase = buildBaseQuery();
  let cursor = null;
  while (true) {
    let qPage = query(qBase, cursor ? startAfter(cursor) : undefined, limit(PAGE_SIZE));
    const snap = await getDocs(qPage);
    if (snap.empty) break;

    const found = snap.docs.find(d => d.id === target.id);
    if (found) {
      currentServerDocs = snap.docs;
      lastDoc = snap.docs[snap.docs.length - 1];
      break;
    }
    cursor = snap.docs[snap.docs.length - 1];
  }
  btnPrev && (btnPrev.disabled = pageStack.length === 0);
  btnNext && (btnNext.disabled = !lastDoc);
  renderTable();
});

// ---------- cambios de rol ----------
tblBody?.addEventListener("change", async (e) => {
  const sel = e.target.closest("select[data-role]");
  if (!sel) return;

  const uid = sel.getAttribute("data-role");
  const newRole = sel.value;

  // Evita que el admin se degrade a sí mismo
  const me = auth.currentUser?.uid;
  if (uid === me && newRole !== "admin") {
    showToast("No puedes cambiar tu propio rol a algo distinto de 'admin'.");
    sel.value = "admin";
    return;
  }

  sel.disabled = true;
  try {
    await callSetCustomRole(uid, newRole);                // <-- HTTP Function
    await updateDoc(doc(db, "usuarios", uid), { rol: newRole }); // Reflejar en UI
    showToast("Rol actualizado. Se aplicará cuando el usuario vuelva a iniciar sesión.");
  } catch (err) {
    showFnError(err, "No se pudo actualizar el rol.");
  } finally {
    sel.disabled = false;
  }
});

// ---------- bloquear/activar ----------
tblBody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-toggle]");
  if (!btn) return;

  const uid = btn.getAttribute("data-toggle");
  const current = btn.getAttribute("data-current") || "activo";
  const next = current === "activo" ? "bloqueado" : "activo";

  btn.disabled = true;
  try {
    await updateDoc(doc(db, "usuarios", uid), { estadoCuenta: next });

    // (Opcional) auditoría con Function HTTP
    try { await callLogAdminAction({ type: "toggleUserState", targetUid: uid, meta: { from: current, to: next } }); }
    catch (_) {}

    btn.textContent = next === "activo" ? "Bloquear" : "Activar";
    btn.setAttribute("data-current", next);
    const tdEstado = btn.closest("tr")?.children?.[4];
    if (tdEstado) tdEstado.textContent = next;
    showToast(next === "activo" ? "Usuario activado." : "Usuario bloqueado.");
  } catch (err) {
    showFnError(err, "No se pudo cambiar el estado.");
  } finally {
    btn.disabled = false;
  }
});
