/* EquiFlow — MVP katalog zadań wolontariusza
 * Stan: localStorage (brak backendu)
 * Funkcje: lista zadań, filtry/szukajka, przyjmowanie, zakończenie, media (nazwy plików),
 * podkowy (0–4), raport CSV, tryb demo auto-akceptacji.
 */

const LS_KEYS = {
  TASKS: "equiflow_tasks_v1",
  USER: "equiflow_user_v1",
  SETTINGS: "equiflow_settings_v1",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ---------- Dane początkowe ---------- */
const seedTasks = [
  { id: uid(), title: "Prace porządkowe — dziedziniec", type: "porządki", arena: null, horse: null, points: 2, status: "open", assignedTo: null, comments: "" },
  { id: uid(), title: "Siodłanie — grupa 16:00", type: "siodłanie", arena: "arena 2", horse: null, points: 2, status: "open", assignedTo: null, comments: "" },
  { id: uid(), title: "Wyprowadzanie na pastwisko", type: "wyprowadzanie", arena: null, horse: "Iskra", points: 1, status: "open", assignedTo: null, comments: "" },
  { id: uid(), title: "Sprowadzanie do stajni", type: "sprowadzanie", arena: null, horse: "Brego", points: 1, status: "open", assignedTo: null, comments: "" },
  { id: uid(), title: "Rozsiodłanie — po jeździe 17:00", type: "rozsiodłanie", arena: "arena 1", horse: null, points: 1, status: "open", assignedTo: null, comments: "" },
  { id: uid(), title: "Lonżowanie — Apollo (15 min)", type: "lonżowanie", arena: "lonżownik", horse: "Apollo", points: 3, status: "open", assignedTo: null, comments: "Skupienie: rytm, przejścia" },
  { id: uid(), title: "Klinika — praca nad reaktywnością", type: "klinika", arena: "hala", horse: "Mokka", points: 3, status: "open", assignedTo: null, comments: "Notuj obserwacje w komentarzach" },
  { id: uid(), title: "Zabieg — pielęgnacja/leczenie kopyt", type: "zabieg", arena: "stanowisko", horse: "Iskra", points: 2, status: "open", assignedTo: null, comments: "Konsultuj z instruktorem" },

  // Specjalne i wymagane przez Ciebie:
  { id: uid(), title: "Dziennikarz / Kronikarz — nagraj 3 krótkie ujęcia z dzisiejszych jazd", type: "dziennikarz", arena: "dowolna", horse: null, points: 2, status: "open", assignedTo: null, comments: "Dodaj pliki, opisz ujęcia. Po publikacji możliwy bonus." },
  { id: uid(), title: "Luzak (zadanie specjalne) — kontrola ogłowia i popręgu przed wejściem na halę", type: "luzak", arena: "hala", horse: null, points: 2, status: "open", assignedTo: null, comments: "Sprawdź bezpieczeństwo, zgłoś nieprawidłowości." },
];

let state = {
  volunteer: load(LS_KEYS.USER) || { name: "" },
  tasks: load(LS_KEYS.TASKS) || seedTasks,
  settings: load(LS_KEYS.SETTINGS) || { demoAutoApprove: false },
};

/* ---------- Inicjalizacja UI ---------- */
const nameInput = $("#volunteerName");
const saveUserBtn = $("#saveUser");
const demoChk = $("#demoAutoApprove");
const searchInp = $("#search");
const typeSel = $("#typeFilter");
const onlyOpenChk = $("#onlyOpen");
const taskList = $("#taskList");
const pointsEl = $("#myPoints");
const horseshoesEl = $("#myHorseshoes");

const exportBtn = $("#exportCsv");
const resetBtn = $("#resetData");

const modal = $("#modal");
const modalTitle = $("#modalTitle");
const modalBody = $("#modalBody");
const modalFoot = $("#modalFoot");
const closeModalBtn = $("#closeModal");

function init() {
  nameInput.value = state.volunteer.name || "";
  demoChk.checked = !!state.settings.demoAutoApprove;
  render();
}
document.addEventListener("DOMContentLoaded", init);

/* ---------- Render ---------- */
function render() {
  // Punkty liczymy z zadań approved przypisanych do usera
  const my = state.volunteer.name?.trim();
  const approvedMine = state.tasks.filter(t => t.assignedTo === my && t.status === "approved");
  const sumPoints = approvedMine.reduce((a,t)=>a+(Number(t.points)||0),0);
  pointsEl.textContent = String(sumPoints);
  renderHorseshoes(horseshoesEl, Math.min(4, Math.round(Math.min(sumPoints,4))));
  // Lista zadań
  const q = searchInp.value.toLowerCase().trim();
  const type = typeSel.value;
  const onlyOpen = onlyOpenChk.checked;
  const items = state.tasks.filter(t=>{
    const matchesQ = !q || (t.title.toLowerCase().includes(q) || (t.horse||"").toLowerCase().includes(q) || (t.arena||"").toLowerCase().includes(q));
    const matchesType = !type || t.type === type;
    const matchesOpen = !onlyOpen || t.status === "open";
    return matchesQ && matchesType && matchesOpen;
  });
  taskList.innerHTML = items.map(renderCard).join("");
  // Podpinamy zdarzenia
  $$(".card .more").forEach(btn=>{
    btn.addEventListener("click", onOpenTask);
  });
}

function renderCard(t){
  const statusBadge = statusToBadge(t.status);
  const hs = horseshoesHTML(t.points);
  const meta = [
    t.arena ? `Miejsce: ${t.arena}` : null,
    t.horse ? `Koń: ${t.horse}` : null,
    t.assignedTo ? `Przypisane: ${t.assignedTo}` : "Wolne"
  ].filter(Boolean).join(" • ");
  return `
  <article class="card" data-id="${t.id}">
    <div class="kit">
      <h3>${escapeHTML(t.title)}</h3>
      <span class="podkowy" title="${t.points} podk.">${hs}</span>
    </div>
    <div class="badges">
      <span class="badge">${escapeHTML(typeLabel(t.type))}</span>
      ${statusBadge}
    </div>
    <div class="meta">${escapeHTML(meta)}</div>
    ${t.comments ? `<div class="meta">Uwagi: ${escapeHTML(t.comments)}</div>` : ""}
    <div class="kit">
      <button class="btn more">Szczegóły</button>
      ${quickActionButton(t)}
    </div>
  </article>`;
}

function quickActionButton(t){
  const me = state.volunteer.name?.trim();
  if (t.status === "open") return `<button class="btn take" data-id="${t.id}">Weź zadanie</button>`;
  if (t.assignedTo === me && t.status === "taken") return `<button class="btn" data-id="${t.id}" data-done="1">Zgłoś zakończenie</button>`;
  return `<span class="meta"> </span>`;
}

function statusToBadge(st){
  const map = {
    open: ['Wolne','ok'],
    taken: ['W trakcie','warn'],
    to_review: ['Do weryfikacji','warn'],
    approved: ['Zatwierdzone','ok'],
    rejected: ['Odrzucone','err']
  };
  const [label, cls] = map[st] || [st,''];
  return `<span class="badge ${cls}">${label}</span>`;
}

function horseshoesHTML(n){
  const arr = Array.from({length:4},(_,i)=>`<span class="hs ${i<n?'fill':''}"></span>`).join("");
  return arr;
}
function renderHorseshoes(el, n){
  el.innerHTML = horseshoesHTML(n);
}

/* ---------- Zdarzenia listy i sterowania ---------- */
searchInp.addEventListener("input", render);
typeSel.addEventListener("change", render);
onlyOpenChk.addEventListener("change", render);
demoChk.addEventListener("change", ()=>{
  state.settings.demoAutoApprove = demoChk.checked;
  save(LS_KEYS.SETTINGS, state.settings);
});

taskList.addEventListener("click", (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const id = btn.dataset.id;
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;

  if (btn.classList.contains("more")) {
    openTaskModal(t);
  } else if (btn.classList.contains("take")) {
    takeTask(t);
  } else if (btn.dataset.done === "1") {
    markDone(t);
  }
});

saveUserBtn.addEventListener("click", ()=>{
  state.volunteer.name = nameInput.value.trim();
  save(LS_KEYS.USER, state.volunteer);
  render();
});

/* ---------- Modal ---------- */
function openTaskModal(t){
  modalTitle.textContent = t.title;
  modalBody.innerHTML = `
    <div class="meta"><strong>Typ:</strong> ${escapeHTML(typeLabel(t.type))}</div>
    <div class="meta"><strong>Status:</strong> ${escapeHTML(statusText(t.status))}</div>
    <div class="meta"><strong>Miejsce:</strong> ${escapeHTML(t.arena || '—')}</div>
    <div class="meta"><strong>Koń:</strong> ${escapeHTML(t.horse || '—')}</div>
    <div class="meta"><strong>Podkowy:</strong> ${t.points} / 4</div>
    ${t.comments ? `<div class="meta"><strong>Uwagi:</strong> ${escapeHTML(t.comments)}</div>` : ""}
    ${t.type === "dziennikarz" ? mediaBlockHTML(t) : ""}
  `;
  modalFoot.innerHTML = modalButtonsHTML(t);
  modal.classList.remove("hidden");

  // Obsługa plików (tylko zapis nazw)
  const mediaInp = $("#mediaInput");
  if (mediaInp) {
    mediaInp.addEventListener("change", (e)=>{
      const files = Array.from(e.target.files||[]).map(f=>({name:f.name, ts: Date.now()}));
      t.media = (t.media||[]).concat(files);
      persist();
      // mały refresh podglądu
      $("#mediaList").innerHTML = renderMediaList(t);
    });
  }

  modalFoot.querySelectorAll("button").forEach(b=>{
    b.addEventListener("click", ()=>{
      if (b.dataset.action === "take") takeTask(t, true);
      if (b.dataset.action === "done") markDone(t, true);
    });
  });
}
function mediaBlockHTML(t){
  return `
    <div class="meta"><strong>Pliki:</strong></div>
    <div id="mediaList" class="meta">${renderMediaList(t)}</div>
    <input id="mediaInput" type="file" multiple />
    <small class="meta">Uwaga: w wersji bez serwera zapisywane są tylko nazwy plików.</small>
  `;
}
function renderMediaList(t){
  const m = t.media||[];
  if(!m.length) return "Brak";
  return `<ul>${m.map(x=>`<li>${escapeHTML(x.name)}</li>`).join("")}</ul>`;
}

function modalButtonsHTML(t){
  const me = state.volunteer.name?.trim();
  let btns = [`<button id="closeModal2" class="btn ghost" onclick="closeModal()">Zamknij</button>`];
  if (t.status === "open") btns.push(`<button class="btn" data-action="take">Weź zadanie</button>`);
  if (t.assignedTo === me && t.status === "taken") btns.push(`<button class="btn" data-action="done">Zgłoś zakończenie</button>`);
  return btns.join("");
}
function closeModal(){ modal.classList.add("hidden"); }
window.closeModal = closeModal;
closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click",(e)=>{ if(e.target===modal) closeModal(); });

/* ---------- Akcje ---------- */
function takeTask(t, rerender=false){
  const me = state.volunteer.name?.trim();
  if(!me){ alert("Podaj swoje imię w prawym górnym rogu i zapisz."); return; }
  if(t.status!=="open"){ alert("To zadanie nie jest już wolne."); return; }
  t.status = "taken";
  t.assignedTo = me;
  persist();
  if (state.settings.demoAutoApprove) {
    // szybka ścieżka: od razu zatwierdzamy i naliczamy punkty
    t.status = "approved";
    persist();
  }
  if(rerender) closeModal();
  render();
}
function markDone(t, rerender=false){
  if(t.status!=="taken"){ alert("To zadanie nie jest w trakcie."); return; }
  t.status = "to_review";
  persist();
  if (state.settings.demoAutoApprove) {
    t.status = "approved";
    persist();
  }
  if(rerender) closeModal();
  render();
}

/* ---------- Raport CSV ---------- */
exportBtn.addEventListener("click", ()=>{
  const me = state.volunteer.name?.trim();
  if(!me){ alert("Podaj swoje imię i zapisz."); return; }
  const rows = [
    ["id","tytuł","typ","koń","arena","status","punkty","przypisane_do","komentarze","media"],
    ...state.tasks
      .filter(t=>t.assignedTo===me && ["taken","to_review","approved"].includes(t.status))
      .map(t=>[
        t.id, t.title, t.type, t.horse||"", t.arena||"", t.status, t.status==="approved"?t.points:0,
        t.assignedTo||"", (t.comments||"").replace(/\n/g," "), (t.media||[]).map(m=>m.name).join("|")
      ])
  ];
  const csv = rows.map(r=>r.map(cell=>csvEscape(cell)).join(",")).join("\n");
  downloadFile(`equiflow_${slug(me)}_raport.csv`, csv, "text/csv");
});

/* ---------- Reset demo ---------- */
resetBtn.addEventListener("click", ()=>{
  if(!confirm("Na pewno zresetować dane (powrót do zadań startowych)?")) return;
  state.tasks = seedTasks.map(t=>({...t}));
  save(LS_KEYS.TASKS, state.tasks);
  render();
});

/* ---------- Helpers ---------- */
function typeLabel(t){
  const map = {
    "porządki":"Prace porządkowe",
    "siodłanie":"Siodłanie / przygotowanie",
    "wyprowadzanie":"Wyprowadzanie",
    "sprowadzanie":"Sprowadzanie",
    "rozsiodłanie":"Rozsiodłanie",
    "lonżowanie":"Lonżowanie",
    "klinika":"Klinika (notatki)",
    "zabieg":"Zabieg",
    "dziennikarz":"Dziennikarz / Kronikarz",
    "luzak":"Luzak (zadanie specjalne)"
  };
  return map[t] || t;
}
function statusText(s){
  return ({
    open:"Wolne",
    taken:"W trakcie",
    to_review:"Do weryfikacji",
    approved:"Zatwierdzone",
    rejected:"Odrzucone"
  })[s] || s;
}
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function escapeHTML(s){ return String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function slug(s){ return String(s).toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]+/g,""); }
function csvEscape(val){
  const s = String(val??"");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||""); }catch{ return null; } }
function persist(){ save(LS_KEYS.TASKS, state.tasks); }

/* Na starcie policz punkty i narysuj podkowy */

