// /js/panelOrg.js
import { auth, db } from "/js/firebase.js";
import {
  collection, query, where, orderBy, limit, getDocs, getCountFromServer,
  doc, updateDoc, startAfter, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ====== Debounce util ======
function debounce(fn, wait = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// ---- Guard de acceso (mínimo cliente)
async function requireOrgOrAdmin(user) {
  const snap = await getDocs(query(
    collection(db, "usuarios"), where("uid", "==", user.uid), limit(1)
  ));
  const rol = snap.empty ? null : (snap.docs[0].data().rol || null);
  if (!rol || (rol !== "organizacion" && rol !== "admin")) {
    alert("Acceso restringido a Organizaciones/Admin.");
    window.location.href = "/DashboardPrincipal.html";
    return false;
  }
  return true;
}

// ---- Refs UI
const periodoSel       = document.getElementById("periodo");
const filtroZona       = document.getElementById("filtroZona");
const filtroCategoria  = document.getElementById("filtroCategoria");
const btnAplicar       = document.getElementById("btnAplicar"); // opcional (ya no se usa)
const btnExport        = document.getElementById("btnExport");

const kpiTotal         = document.getElementById("kpiTotal");
const kpiValidadas     = document.getElementById("kpiValidadas");
const kpiCategorias    = document.getElementById("kpiCategorias");
const listaLideres     = document.getElementById("listaLideres");
const tablaAcciones    = document.getElementById("tablaAcciones");
const btnMas           = document.getElementById("btnMas");

// ====== helpers ======
const normalize = (s) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function rangoDesdeDias(dias) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - Number(dias || 30));
  return { from, to };
}

function getFilters(){
  const dias = Number(periodoSel?.value || 30);
  const {from, to} = rangoDesdeDias(dias);
  return {
    from, to,
    zona: filtroZona?.value || "",
    categoria: filtroCategoria?.value || ""
  };
}

function buildBaseQueryByTime({from, to}) {
  return query(
    collection(db, "acciones"),
    where("creadoEl", ">=", Timestamp.fromDate(from)),
    where("creadoEl", "<=", Timestamp.fromDate(to)),
    orderBy("creadoEl", "desc")
  );
}

function pasaFiltrosCliente(a, { zona, categoria }) {
  if (zona) {
    const z = normalize(zona);
    if (!normalize(a.zona || "").includes(z)) return false;
  }
  if (categoria) {
    if (normalize(a.categoria || "") !== normalize(categoria)) return false;
  }
  return true;
}

// ====== Estado tabla ======
let lastDoc = null;
let tablaLlena = false;

// ====== KPIs ======
async function cargarKPIs(filters) {
  const base = buildBaseQueryByTime(filters);
  const snap = await getDocs(query(base, limit(2000)));
  const items = snap.docs.map(d => d.data()).filter(a => pasaFiltrosCliente(a, filters));

  if (kpiTotal)     kpiTotal.textContent     = items.length;
  if (kpiValidadas) kpiValidadas.textContent = items.filter(x => !!x.validado).length;

  if (kpiCategorias) {
    const cats = ["limpieza","reciclaje","taller","donacion"];
    const parts = [];
    for (const c of cats) {
      const n = items.filter(x => normalize(x.categoria) === normalize(c)).length;
      if (n > 0) parts.push(`${c}: ${n}`);
    }
    kpiCategorias.textContent = parts.length ? parts.join(" · ") : "—";
  }
}

// ====== Líderes ======
async function cargarLideres(filters) {
  const base = buildBaseQueryByTime(filters);
  const snap = await getDocs(query(base, limit(2000)));
  const items = snap.docs.map(d => d.data()).filter(a => pasaFiltrosCliente(a, filters));

  const byAutor = new Map();
  items.forEach(a => {
    const key = a.autorUid || "na";
    const curr = byAutor.get(key) || { nombre: a.autorNombre || "Usuario", count: 0 };
    curr.count += 1;
    byAutor.set(key, curr);
  });
  const top = [...byAutor.values()].sort((a,b)=>b.count-a.count).slice(0,5);
  if (listaLideres)
    listaLideres.innerHTML = top.length ? top.map(x=>`<li>${x.nombre} — ${x.count}</li>`).join("") : "<li>—</li>";
}

// ====== Tabla paginada ======
async function cargarTabla(filters, reset=false) {
  if (reset) {
    tablaAcciones && (tablaAcciones.innerHTML = "");
    lastDoc = null;
    tablaLlena = false;
  }
  if (tablaLlena) { btnMas && (btnMas.disabled = true); return; }

  const base = buildBaseQueryByTime(filters);

  let rowsAgregadas = 0;
  let cursor = lastDoc;

  while (rowsAgregadas < 20) {
    let q = cursor ? query(base, startAfter(cursor), limit(50)) : query(base, limit(50));
    const snap = await getDocs(q);
    if (snap.empty) { tablaLlena = true; break; }

    cursor = snap.docs[snap.docs.length - 1];

    for (const d of snap.docs) {
      const a = d.data();
      if (!pasaFiltrosCliente(a, filters)) continue;

      const fecha = a.creadoEl?.toDate ? a.creadoEl.toDate().toLocaleString() : "—";
      const estado = a.validado ? "✅ Validado" : "⏳ Pendiente";
      const btn = a.validado ? "" : `<button data-approve="${d.id}">Aprobar</button>`;

      const tr = `<tr>
        <td>${fecha}</td>
        <td>${a.autorNombre || "Usuario"}</td>
        <td>${a.categoria || ""}</td>
        <td>${a.zona || ""}</td>
        <td>${estado}</td>
        <td>${btn}</td>
      </tr>`;
      tablaAcciones?.insertAdjacentHTML("beforeend", tr);

      rowsAgregadas++;
      if (rowsAgregadas >= 20) break;
    }
  }

  lastDoc = cursor;
  if (btnMas) btnMas.disabled = rowsAgregadas < 20 || tablaLlena;
}

// aprobar
tablaAcciones?.addEventListener("click", async (e)=>{
  const b = e.target.closest("[data-approve]");
  if(!b) return;
  const id = b.getAttribute("data-approve");
  b.disabled = true;
  try {
    await updateDoc(doc(db,"acciones", id), { validado: true });
    b.closest("tr").querySelector("td:nth-child(5)").textContent = "✅ Validado";
    b.remove();
  } catch(err){
    console.error(err);
    alert("No se pudo aprobar.");
    b.disabled = false;
  }
});

// ====== Export CSV ======
btnExport?.addEventListener("click", async ()=>{
  const filters = getFilters();
  const base = buildBaseQueryByTime(filters);
  const snap = await getDocs(query(base, limit(2000)));
  const items = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => pasaFiltrosCliente(a, filters));

  const rows = [["fecha","autor","categoria","zona","validado"]];
  items.forEach(a=>{
    rows.push([
      a.creadoEl?.toDate ? a.creadoEl.toDate().toISOString() : "",
      a.autorNombre || "",
      a.categoria || "",
      a.zona || "",
      a.validado ? "1":"0"
    ]);
  });
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "acciones.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// ====== Orquestador ======
async function cargarPanel(resetTabla=false){
  const filters = getFilters();
  await Promise.allSettled([
    cargarKPIs(filters),
    cargarLideres(filters),
  ]);
  await cargarTabla(filters, resetTabla);
}

// ====== Live filters (sin botón) ======
// Oculta/desactiva el botón "Aplicar" si existe
if (btnAplicar) { btnAplicar.style.display = "none"; btnAplicar.disabled = true; }

// Período y categoría: cambio inmediato
periodoSel?.addEventListener("change", () => cargarPanel(true));
filtroCategoria?.addEventListener("change", () => cargarPanel(true));

// Municipio (texto): debounce para no saturar
const onZonaInput = debounce(() => cargarPanel(true), 300);
filtroZona?.addEventListener("input", onZonaInput);

// Paginación
btnMas?.addEventListener("click", () => cargarPanel(false));

// Guard + boot
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "/login.html"; return; }
  if (!(await requireOrgOrAdmin(user))) return;
  await cargarPanel(true);
});
