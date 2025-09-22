/* EquiFlow v1.2
 * - Naprawa filtrów „Wszystkie/Wolne”
 * - Historia punktów
 * - Zakładki: Wolontariusz / Instruktor / Konie
 * - Instruktor: tworzenie zadań (lonżowanie/zabiegi z koniem, domyślne porządki/dziennikarz, jazdy: koń↔jeździec+poziom+godzina)
 * - Konie: obciążenie (zliczane z zadań taken/to_review/approved i jazd)
 * - Przełącznik widoku: Kafelki / Lista (w każdej zakładce)
 * - localStorage
 */

const LS = {
  TASKS: "equiflow_tasks_v1",
  USER: "equiflow_user_v1",
  SETTINGS: "equiflow_settings_v1",
  HORSES: "equiflow_horses_v1",
  RIDERS: "equiflow_riders_v1",
  UI: "equiflow_ui_v1"
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* --- Sample data --- */
const sampleHorses = ["Itaka", "Basia", "Nicpoń", "Jurek", "Prada", "Emocja"];
const sampleRiders = ["Ola", "Michał", "Anka", "Kuba", "Julia", "Tomek", "Nina", "Bartek"];

const seedTasks = [
  // wolne / domyślne
  task("Prace porządkowe — dziedziniec", "porządki", {points:2}),
  task("Dziennikarz/Kronikarz — nagraj 3 ujęcia", "dziennikarz", {points:2, comments:"Dodaj pliki; po publikacji bonus."}),
  task("Wyprowadzanie na pastwisko (stado)", "wyprowadzanie", {points:1}),
  task("Sprowadzanie do stajni (stado)", "sprowadzanie", {points:1}),
  task("Rozsiodłanie — po jeździe 17:00", "rozsiodłanie", {arena:"arena 1", points:1}),

  // przypisywalne do koni
  task("Lonżowanie — Apollo (15 min)", "lonżowanie", {arena:"lonżownik", horse:"Apollo", points:3, comments:"Rytm, przejścia"}),
  task("Klinika — praca nad reaktywnością", "klinika", {arena:"hala", horse:"Mokka", points:3, comments:"Notuj obserwacje"}),
  task("Zabieg — pielęgnacja/leczenie kopyt (Iskra)", "zabieg", {arena:"stanowisko", horse:"Iskra", points:2, comments:"Konsultuj z instruktorem"}),

  // specjalne
  task("Luzak — kontrola ogłowia i popręgu", "luzak", {arena:"hala", points:2, comments:"Bezpieczeństwo przede wszystkim."}),
];

/* --- State --- */
let state = {
  volunteer: load(LS.USER) || { name: "" },
  tasks: load(LS.TASKS) || seedTasks,
  settings: load(LS.SETTINGS) || { demoAutoApprove: false },
  horses: load(LS.HORSES) || sampleHorses,
  riders: load(LS.RIDERS) || sampleRiders,
  ui: load(LS.UI) || {
    tab: "volunteer",
    v: { status:"all", onlyMine:false, type:"", view:"cards", search:"" },
    i: { view:"cards" },
    h: { view:"cards" }
  }
};

/* --- Elements --- */
// tabs
const tabBtns = $$(".tab");
const paneVolunteer = $("#tab-volunteer");
const paneInstructor = $("#tab-instructor");
const paneHorses = $("#tab-horses");

// profile / toast
const nameInput = $("#volunteerName");
const saveUserBtn = $("#saveUser");
const toast = $("#toast");

// volunteer controls
const demoChk = $("#demoAutoApprove");
const vCounts = {
  all: $("#v-countAll"),
  open: $("#v-countOpen"),
  taken: $("#v-countTaken"),
  review: $("#v-countReview"),
  approved: $("#v-countApproved")
};
const vChips = {
  all: $("#v-chipAll"),
  open: $("#v-chipOpen"),
  taken: $("#v-chipTaken"),
  review: $("#v-chipReview"),
  approved: $("#v-chipApproved"),
  mine: $("#v-chipMine")
};
const vSearch = $("#v-search");
const vType = $("#v-type");
const vViewCards = $("#v-view-cards");
const vViewList = $("#v-view-list");
const vList = $("#v-list");
const myPointsEl = $("#myPoints");
const myHorseshoesEl = $("#myHorseshoes");
const pointsHistoryBtn = $("#pointsHistory");

// instructor controls
const iTaskType = $("#i-taskType");
const iHorse = $("#i-horse");
const iRider = $("#i-rider");
const iSkill = $("#i-skill");
const iWhen = $("#i-when");
const iTitle = $("#i-title");
const iPlace = $("#i-place");
const iPoints = $("#i-points");
const iAdd = $("#i-add");
const iCreateDefaults = $("#i-createDefaults");
const iViewCards = $("#i-view-cards");
const iViewList = $("#i-view-list");
const iList = $("#i-list");

// horses
const hViewCards = $("#h-view-cards");
const hViewList = $("#h-view-list");
const hList = $("#h-list");

// modal
const modal = $("#modal");
const modalTitle = $("#modalTitle");
const modalBody = $("#modalBody");
const modalFoot = $("#modalFoot");
$("#closeModal").addEventListener("click", closeModal);
modal.addEventListener("click",(e)=>{ if(e.target===modal) closeModal(); });

// export/reset
$("#exportCsv").addEventListener("click", exportCSV);
$("#resetData").addEventListener("click", resetData);

/* --- Init --- */
document.addEventListener("DOMContentLoaded", () => {
  // profile
  nameInput.value = state.volunteer.name || "";
  demoChk.checked = !!state.settings.demoAutoApprove;

  // dropdowns for instructor
  fillSelect(iHorse, ["— koń —"].concat(state.horses));
  fillSelect(iRider, ["— jeździec —"].concat(state.riders));

  // tabs restore
  switchTab(state.ui.tab);

  // events
  tabBtns.forEach(b=>b.addEventListener("click", ()=>switchTab(b.dataset.tab)));

  saveUserBtn.addEventListener("click", ()=>{
    state.volunteer.name = nameInput.value.trim();
    save(LS.USER, state.volunteer);
    toastMsg("Zapisano profil");
    renderVolunteer();
  });
  demoChk.addEventListener("change", ()=>{
    state.settings.demoAutoApprove = demoChk.checked;
    save(LS.SETTINGS, state.settings);
  });

  // volunteer filters
  vChips.all.addEventListener("click", ()=>{ state.ui.v.status="all"; setChipActive("v", "all"); renderVolunteer(); });
  vChips.open.addEventListener("click", ()=>{ state.ui.v.status="open"; setChipActive("v", "open"); renderVolunteer(); });
  vChips.taken.addEventListener("click", ()=>{ state.ui.v.status="taken"; setChipActive("v", "taken"); renderVolunteer(); });
  vChips.review.addEventListener("click", ()=>{ state.ui.v.status="to_review"; setChipActive("v", "review"); renderVolunteer(); });
  vChips.approved.addEventListener("click", ()=>{ state.ui.v.status="approved"; setChipActive("v", "approved"); renderVolunteer(); });
  vChips.mine.addEventListener("click", ()=>{
    state.ui.v.onlyMine = !state.ui.v.onlyMine;
    vChips.mine.classList.toggle("chip-active", state.ui.v.onlyMine);
    renderVolunteer();
  });
  vSearch.addEventListener("input", ()=>{ state.ui.v.search = vSearch.value; renderVolunteer(); });
  vType.addEventListener("change", ()=>{ state.ui.v.type = vType.value; renderVolunteer(); });
  vViewCards.addEventListener("click", ()=>{ state.ui.v.view="cards"; setViewActive("v", "cards"); renderVolunteer(); });
  vViewList.addEventListener("click", ()=>{ state.ui.v.view="list"; setViewActive("v", "list"); renderVolunteer(); });
  pointsHistoryBtn.addEventListener("click", openPointsHistory);

  // instructor events
  iViewCards.addEventListener("click", ()=>{ state.ui.i.view="cards"; setViewActive("i","cards"); renderInstructor(); });
  iViewList.addEventListener("click", ()=>{ state.ui.i.view="list"; setViewActive("i","list"); renderInstructor(); });
  iAdd.addEventListener("click", addInstructorTask);
  iCreateDefaults.addEventListener("click", createDefaultTasks);

  // horses events
  hViewCards.addEventListener("click", ()=>{ state.ui.h.view="cards"; setViewActive("h","cards"); renderHorses(); });
  hViewList.addEventListener("click", ()=>{ state.ui.h.view="list"; setViewActive("h","list"); renderHorses(); });

  // first render
  renderAll();
});

/* --- Renders --- */
function renderAll(){
  renderVolunteer();
  renderInstructor();
  renderHorses();
  save(LS.UI, state.ui);
}

function renderVolunteer(){
  // liczniki (liczymy po typach statusu)
  const visForVolunteer = state.tasks.filter(t => isVisibleForVolunteer(t));
  setCounts("v", visForVolunteer);

  // punkty i podkowy
  const me = (state.volunteer.name||"").trim();
  const approvedMine = state.tasks.filter(t=> t.assignedTo===me && t.status==="approved");
  const sumPoints = approvedMine.reduce((a,t)=>a + (+t.points||0), 0);
  $("#myPoints").textContent = String(sumPoints);
  $("#myHorseshoes").innerHTML = horseshoesHTML(Math.min(4, Math.round(Math.min(sumPoints,4))));

  // filtracja
  const items = visForVolunteer.filter(t=>{
    const matchesStatus = state.ui.v.status==="all" ? true : t.status===state.ui.v.status;
    const matchesMine = state.ui.v.onlyMine ? (t.assignedTo===me) : true;
    const matchesType = state.ui.v.type ? (t.type===state.ui.v.type) : true;
    const q = (state.ui.v.search||"").toLowerCase();
    const matchesQ = !q || [t.title, t.horse, t.arena].filter(Boolean).some(x=>String(x).toLowerCase().includes(q));
    return matchesStatus && matchesMine && matchesType && matchesQ;
  });

  // widok
  vList.className = state.ui.v.view==="list" ? "list" : "grid";
  vList.innerHTML = items.map(cardHTML).join("");
  // actions
  vList.querySelectorAll(".more").forEach(b=>b.addEventListener("click", onOpenTask));
  vList.querySelectorAll(".take").forEach(b=>b.addEventListener("click", onQuickTake));
  vList.querySelectorAll(".done").forEach(b=>b.addEventListener("click", onQuickDone));
}

function renderInstructor(){
  // dropdowns keep in sync
  fillSelect(iHorse, ["— koń —"].concat(state.horses));
  fillSelect(iRider, ["— jeździec —"].concat(state.riders));

  const items = state.tasks; // instruktor widzi wszystko
  iList.className = state.ui.i.view==="list" ? "list" : "grid";
  iList.innerHTML = items.map(cardHTMLInstructor).join("");

  // bind buttons inside instructor cards
  iList.querySelectorAll(".approve").forEach(b=>b.addEventListener("click", onApprove));
  iList.querySelectorAll(".reject").forEach(b=>b.addEventListener("click", onReject));
  iList.querySelectorAll(".openModal").forEach(b=>b.addEventListener("click", e=>{
    const id = e.currentTarget.dataset.id;
    const t = state.tasks.find(x=>x.id===id); if(t) openTaskModal(t);
  }));
}

function renderHorses(){
  const arr = state.horses.map(name=>{
    const stats = horseLoad(name);
    return { name, ...stats };
  });

  hList.className = state.ui.h.view==="list" ? "list" : "grid";
  hList.innerHTML = arr.map(horseCardHTML).join("");
}

/* --- Helpers: visibility & counts --- */
function isVisibleForVolunteer(t){
  // wolontariusz NIE widzi zadań typu "jazda"
  if (t.type === "jazda") return false;
  // wolontariusz widzi:
  // - wszystkie zadania domyślne i te z przypisanym koniem (lonżowanie, zabieg itp.)
  return true;
}

function setCounts(prefix, items){
  const counts = {
    all: items.length,
    open: items.filter(x=>x.status==="open").length,
    taken: items.filter(x=>x.status==="taken").length,
    review: items.filter(x=>x.status==="to_review").length,
    approved: items.filter(x=>x.status==="approved").length,
  };
  if(prefix==="v"){
    $("#v-countAll").textContent = counts.all;
    $("#v-countOpen").textContent = counts.open;
    $("#v-countTaken").textContent = counts.taken;
    $("#v-countReview").textContent = counts.review;
    $("#v-countApproved").textContent = counts.approved;
  }
}

function setChipActive(prefix, which){
  const map = prefix==="v" ? {
    all: "#v-chipAll",
    open: "#v-chipOpen",
    taken: "#v-chipTaken",
    review: "#v-chipReview",
    approved: "#v-chipApproved"
  } : null;
  if(!map) return;
  Object.values(map).forEach(sel => $(sel).classList.remove("chip-active"));
  $(map[which]).classList.add("chip-active");
}

function setViewActive(prefix, which){
  const map = {
    v: {cards:"#v-view-cards", list:"#v-view-list"},
    i: {cards:"#i-view-cards", list:"#i-view-list"},
    h: {cards:"#h-view-cards", list:"#h-view-list"},
  };
  const m = map[prefix];
  $(m.cards).classList.toggle("view-active", which==="cards");
  $(m.list).classList.toggle("view-active", which==="list");
}

/* --- Cards HTML --- */
function cardHTML(t){
  const meta = [
    t.arena ? `Miejsce: ${t.arena}` : null,
    t.horse ? `Koń: ${t.horse}` : null,
    t.assignedTo ? `Przypisane: ${t.assignedTo}` : "Wolne"
  ].filter(Boolean).join(" • ");
  const quick = quickButtonsVolunteer(t);
  return `
  <article class="card ${classByStatus(t.status)}" data-id="${t.id}">
    <div class="title">
      <h3>${escapeHTML(t.title)}</h3>
      <span class="podkowy" title="${t.points} podk.">${horseshoesHTML(t.points)}</span>
    </div>
    <div class="badges">
      <span class="badge-tag">${escapeHTML(typeLabel(t.type))}</span>
      ${statusBadgeHTML(t.status)}
    </div>
    <div class="meta">${escapeHTML(meta)}</div>
    ${t.comments ? `<div class="meta">Uwagi: ${escapeHTML(t.comments)}</div>` : ""}
    <div class="kit">
      <button class="btn more">Szczegóły</button>
      ${quick}
    </div>
  </article>`;
}

function cardHTMLInstructor(t){
  const meta = [
    t.arena ? `Miejsce: ${t.arena}` : null,
    t.horse ? `Koń: ${t.horse}` : null,
    t.rider ? `Jeździec: ${t.rider}` : null,
    t.skill ? `Poziom: ${t.skill}` : null,
    t.when ? `Godz.: ${t.when}` : null,
    t.assignedTo ? `Wolont.: ${t.assignedTo}` : null
  ].filter(Boolean).join(" • ");

  const actions = instrButtons(t);
  return `
  <article class="card ${classByStatus(t.status)}" data-id="${t.id}">
    <div class="title">
      <h3>${escapeHTML(t.title)}</h3>
      <span class="podkowy" title="${t.points} podk.">${horseshoesHTML(t.points)}</span>
    </div>
    <div class="badges">
      <span class="badge-tag">${escapeHTML(typeLabel(t.type))}</span>
      ${statusBadgeHTML(t.status)}
    </div>
    <div class="meta">${escapeHTML(meta)}</div>
    ${t.comments ? `<div class="meta">Uwagi: ${escapeHTML(t.comments)}</div>` : ""}
    <div class="kit">
      <button class="btn openModal" data-id="${t.id}">Podgląd</button>
      ${actions}
    </div>
  </article>`;
}

function horseCardHTML(h){
  const badge = `<span class="badge-tag">${h.sessions} zadań • ${h.rides} jazd • pkt: ${h.points}</span>`;
  return `
  <article class="card">
    <div class="title">
      <h3>${escapeHTML(h.name)}</h3>
    </div>
    <div class="badges">${badge}</div>
    <div class="meta">Ostatnie: ${escapeHTML(h.last || "—")}</div>
  </article>`;
}

function classByStatus(s){
  return ({open:"open", taken:"taken", to_review:"to_review", approved:"approved"})[s] || "";
}
function statusBadgeHTML(s){
  const map = {
    open:   ['Wolne','badge-open'],
    taken:  ['W trakcie','badge-taken'],
    to_review: ['Do weryfikacji','badge-review'],
    approved:  ['Zatwierdzone','badge-approved']
  };
  const [label, cls] = map[s] || [s,'badge-tag'];
  return `<span class="badge-tag ${cls}">${label}</span>`;
}
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
    "luzak":"Luzak (zadanie specjalne)",
    "jazda":"Jazda (instruktor)"
  };
  return map[t] || t;
}
function horseshoesHTML(n){
  return Array.from({length:4},(_,i)=>`<span class="hs ${i<n?'fill':''}"></span>`).join("");
}

/* --- Volunteer quick buttons --- */
function quickButtonsVolunteer(t){
  const me = (state.volunteer.name||"").trim();
  if (t.type==="jazda") return `<span class="meta">Zadanie instruktorskie</span>`;
  if (t.status === "open") return `<button class="btn take" data-id="${t.id}">Weź</button>`;
  if (t.assignedTo === me && t.status === "taken") return `<button class="btn done" data-id="${t.id}">Zgłoś</button>`;
  return `<span class="meta"></span>`;
}
function onQuickTake(e){
  const id = e.currentTarget.dataset.id;
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  takeTask(t);
}
function onQuickDone(e){
  const id = e.currentTarget.dataset.id;
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  markDone(t);
}

/* --- Instructor buttons --- */
function instrButtons(t){
  if (t.status==="to_review") {
    return `<button class="btn approve" data-id="${t.id}">Zatwierdź</button>
            <button class="btn ghost reject" data-id="${t.id}">Odrzuć</button>`;
  }
  return `<span class="meta"></span>`;
}

/* --- Modal shared --- */
function onOpenTask(e){
  const card = e.currentTarget.closest(".card");
  const id = card?.dataset.id;
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  openTaskModal(t);
}
function openTaskModal(t){
  modalTitle.textContent = t.title;
  modalBody.innerHTML = `
    <div class="meta"><strong>Typ:</strong> ${escapeHTML(typeLabel(t.type))}</div>
    <div class="meta"><strong>Status:</strong> ${escapeHTML(statusText(t.status))}</div>
    <div class="meta"><strong>Miejsce:</strong> ${escapeHTML(t.arena || '—')}</div>
    <div class="meta"><strong>Koń:</strong> ${escapeHTML(t.horse || '—')}</div>
    <div class="meta"><strong>Jeździec:</strong> ${escapeHTML(t.rider || '—')}</div>
    <div class="meta"><strong>Poziom:</strong> ${escapeHTML(t.skill || '—')}</div>
    <div class="meta"><strong>Godzina:</strong> ${escapeHTML(t.when || '—')}</div>
    <div class="meta"><strong>Podkowy:</strong> ${t.points} / 4</div>
    ${t.comments ? `<div class="meta"><strong>Uwagi:</strong> ${escapeHTML(t.comments)}</div>` : ""}
    ${t.type === "dziennikarz" ? mediaBlockHTML(t) : ""}
  `;
  modalFoot.innerHTML = modalButtonsHTML(t);
  modal.classList.remove("hidden");

  const mediaInp = $("#mediaInput");
  if (mediaInp) {
    mediaInp.addEventListener("change", (e)=>{
      const files = Array.from(e.target.files||[]).map(f=>({name:f.name, ts: Date.now()}));
      t.media = (t.media||[]).concat(files);
      persistTasks();
      // refresh podglądu
      $("#mediaList").innerHTML = renderMediaList(t);
    });
  }
}
function mediaBlockHTML(t){
  return `
    <div class="meta"><strong>Pliki:</strong></div>
    <div id="mediaList" class="meta">${renderMediaList(t)}</div>
    <input id="mediaInput" type="file" multiple />
    <small class="meta">Uwaga: zapis nazw plików lokalnie (bez wysyłki).</small>
  `;
}
function renderMediaList(t){
  const m = t.media||[];
  if(!m.length) return "Brak";
  return `<ul>${m.map(x=>`<li>${escapeHTML(x.name)}</li>`).join("")}</ul>`;
}
function modalButtonsHTML(t){
  const me = (state.volunteer.name||"").trim();
  const btns = [];
  btns.push(`<button class="btn ghost" onclick="closeModal()">Zamknij</button>`);
  if (t.status==="open" && t.type!=="jazda") btns.push(`<button class="btn" onclick="__take('${t.id}', true)">Weź</button>`);
  if (t.assignedTo===me && t.status==="taken") btns.push(`<button class="btn" onclick="__done('${t.id}', true)">Zgłoś</button>`);
  if (t.status==="to_review") btns.push(`<button class="btn" onclick="__approve('${t.id}')">Zatwierdź (instr.)</button>`);
  return btns.join("");
}
function closeModal(){ modal.classList.add("hidden"); }
window.closeModal = closeModal;
window.__take = (id, close)=>{ const t = state.tasks.find(x=>x.id===id); if(t){ takeTask(t); if(close) closeModal(); } };
window.__done = (id, close)=>{ const t = state.tasks.find(x=>x.id===id); if(t){ markDone(t); if(close) closeModal(); } };
window.__approve = (id)=>{ const t = state.tasks.find(x=>x.id===id); if(t){ approveTask(t); closeModal(); } };

/* --- Actions --- */
function takeTask(t){
  const me = (state.volunteer.name||"").trim();
  if(!me){ alert("Podaj swoje imię i zapisz."); return; }
  if(t.status!=="open"){ alert("To zadanie nie jest już wolne."); return; }
  t.status = "taken";
  t.assignedTo = me;
  persistTasks();
  if (state.settings.demoAutoApprove) {
    t.status = "approved";
    persistTasks();
  }
  renderAll();
}
function markDone(t){
  if(t.status!=="taken"){ alert("To zadanie nie jest w trakcie."); return; }
  t.status = "to_review";
  persistTasks();
  if (state.settings.demoAutoApprove) {
    t.status = "approved";
    persistTasks();
  }
  renderAll();
}
function onApprove(e){
  const id = e.currentTarget.dataset.id;
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  approveTask(t);
}
function approveTask(t){
  t.status = "approved";
  persistTasks();
  renderAll();
}
function onReject(e){
  const id = e.currentTarget.dataset.id;
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.status = "rejected";
  persistTasks();
  renderAll();
}

/* --- Instructor: add tasks --- */
function addInstructorTask(){
  const tp = iTaskType.value;
  const title = iTitle.value.trim();
  const arena = iPlace.value.trim() || null;
  const points = clamp(+iPoints.value||0, 0, 4);
  const horse = iHorse.value && iHorse.value!=="— koń —" ? iHorse.value : null;
  const rider = iRider.value && iRider.value!=="— jeździec —" ? iRider.value : null;
  const skill = iSkill.value || null;
  const when = iWhen.value || null;

  if (tp==="jazda") {
    // jazda: musi mieć konia + jeźdźca + godzinę; nie trafia do wolontariuszy
    if(!horse || !rider || !when){ alert("Dla jazdy wybierz: konia, jeźdźca i godzinę."); return; }
    const t = task(title || `Jazda — ${horse} ↔ ${rider}`, "jazda",
      { arena, horse, rider, skill, when, points:0, status:"open" });
    state.tasks.unshift(t);
  } else {
    // zadanie zwykłe; jeśli przypisano konia → pojawi się u wolontariuszy
    const t = task(title || defaultTitle(tp, horse), tp, { arena, horse, points, status:"open" });
    state.tasks.unshift(t);
  }
  persistTasks();
  clearInstructorInputs();
  renderAll();
}

function createDefaultTasks(){
  // dodaje pakiet zadań domyślnych (porządki, dziennikarz, wyprowadzanie/sprowadzanie)
  const pack = [
    task("Prace porządkowe — stajnia", "porządki", {points:2}),
    task("Dziennikarz/Kronikarz — dokumentuj dzień", "dziennikarz", {points:2}),
    task("Wyprowadzanie na padok (stado)", "wyprowadzanie", {points:1}),
    task("Sprowadzanie z padoku (stado)", "sprowadzanie", {points:1}),
  ];
  state.tasks = pack.concat(state.tasks);
  persistTasks();
  renderAll();
}

/* --- Horses: load metrics --- */
function horseLoad(name){
  const related = state.tasks.filter(t=> t.horse===name && ["lonżowanie","klinika","zabieg","jazda","rozsiodłanie"].includes(t.type));
  const sessions = related.filter(t=> t.type!=="jazda").length;
  const rides = related.filter(t=> t.type==="jazda").length;
  const points = related.filter(t=> t.status==="approved").reduce((a,t)=>a+(+t.points||0),0);
  const last = related.sort((a,b)=>(b.ts||0)-(a.ts||0))[0]?.title;
  return { sessions, rides, points, last };
}

/* --- Points history --- */
function openPointsHistory(){
  const me = (state.volunteer.name||"").trim();
  const approvedMine = state.tasks.filter(t=> t.assignedTo===me && t.status==="approved");
  const rows = approvedMine.map(t=>`<tr><td>${escapeHTML(t.title)}</td><td>${t.points}</td></tr>`).join("");
  modalTitle.textContent = "Moje punkty — historia";
  modalBody.innerHTML = `
    <table class="table">
      <thead><tr><th>Zadanie</th><th>Punkty</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="2">Brak zatwierdzonych zadań.</td></tr>`}</tbody>
    </table>
  `;
  modalFoot.innerHTML = `<button class="btn ghost" onclick="closeModal()">Zamknij</button>`;
  modal.classList.remove("hidden");
}

/* --- Export / Reset --- */
function exportCSV(){
  const me = (state.volunteer.name||"").trim();
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
  const csv = rows.map(r=>r.map(c=>csvEscape(c)).join(",")).join("\n");
  download(`equiflow_${slug(me)}_raport.csv`, csv, "text/csv");
}

function resetData(){
  if(!confirm("Na pewno zresetować dane do stanu domyślnego?")) return;
  state.tasks = seedTasks.map(t=>({...t}));
  save(LS.TASKS, state.tasks);
  renderAll();
}

/* --- Tab & View helpers --- */
function switchTab(key){
  state.ui.tab = key;
  $$(".tab").forEach(b=>b.classList.toggle("tab-active", b.dataset.tab===key));
  $("#tab-volunteer").classList.toggle("hidden", key!=="volunteer");
  $("#tab-instructor").classList.toggle("hidden", key!=="instructor");
  $("#tab-horses").classList.toggle("hidden", key!=="horses");
  save(LS.UI, state.ui);
  if(key==="volunteer") renderVolunteer();
  if(key==="instructor") renderInstructor();
  if(key==="horses") renderHorses();
}

function fillSelect(sel, arr){
  const val = sel.value;
  sel.innerHTML = arr.map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
  if ([...sel.options].some(o=>o.value===val)) sel.value = val;
}

function setViewActive(prefix, which){
  const map = {
    v: {cards:"#v-view-cards", list:"#v-view-list"},
    i: {cards:"#i-view-cards", list:"#i-view-list"},
    h: {cards:"#h-view-cards", list:"#h-view-list"},
  };
  const m = map[prefix];
  $(m.cards).classList.toggle("view-active", which==="cards");
  $(m.list).classList.toggle("view-active", which==="list");
}

/* --- Instructor utils --- */
function defaultTitle(tp, horse){
  const base = {
    "lonżowanie":"Lonżowanie",
    "zabieg":"Zabieg",
    "porządki":"Prace porządkowe",
    "dziennikarz":"Dziennikarz/Kronikarz",
    "wyprowadzanie":"Wyprowadzanie (stado)",
    "sprowadzanie":"Sprowadzanie (stado)",
    "rozsiodłanie":"Rozsiodłanie"
  }[tp] || tp;
  return horse ? `${base} — ${horse}` : base;
}
function clearInstructorInputs(){
  iTitle.value = "";
  iPlace.value = "";
  iPoints.value = 2;
  iHorse.value = "— koń —";
  iRider.value = "— jeździec —";
  iSkill.value = "";
  iWhen.value = "";
}

/* --- Core utils --- */
function task(title, type, extra={}){
  return {
    id: uid(),
    title, type,
    arena: extra.arena || null,
    horse: extra.horse || null,
    rider: extra.rider || null,
    skill: extra.skill || null,
    when: extra.when || null,
    points: typeof extra.points==="number" ? extra.points : 2,
    status: extra.status || "open",
    assignedTo: extra.assignedTo || null,
    comments: extra.comments || "",
    media: extra.media || [],
    ts: Date.now()
  };
}
function approveIfDemo(t){
  if (state.settings.demoAutoApprove) {
    t.status="approved";
  }
}
function persistTasks(){ save(LS.TASKS, state.tasks); }

function horseshoes(n){ return Math.max(0, Math.min(4, n|0)); }

function statusText(s){
  return ({
    open:"Wolne",
    taken:"W trakcie",
    to_review:"Do weryfikacji",
    approved:"Zatwierdzone",
    rejected:"Odrzucone"
  })[s] || s;
}

/* --- Generic helpers --- */
function toastMsg(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 1800);
}
function download(name, data, mime="text/plain"){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], {type:mime}));
  a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function csvEscape(val){ const s = String(val??""); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }
function slug(s){ return String(s).toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]+/g,""); }
function escapeHTML(s){ return String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||""); }catch{ return null; } }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
