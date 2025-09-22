/* EquiFlow v1.2.1 — stabilizacja
 * - Wszystkie bindowania w DOMContentLoaded
 * - Delegacja zdarzeń tabs (nav)
 * - Auto-dosiewanie zadań jeśli pusto
 * - Twardy reset localStorage
 * - Historia punktów
 * - Zakładki: Wolontariusz / Instruktor / Konie
 * - Instruktor: zadania dla koni + jazdy
 * - Konie: obciążenie
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

const seedTasks = [
  task("Prace porządkowe — stajnia", "porządki", {points:2}),
  task("Dziennikarz/Kronikarz — dokumentuj dzień", "dziennikarz", {points:2, comments:"Dodaj pliki; po publikacji bonus."}),
  task("Wyprowadzanie na padok (stado)", "wyprowadzanie", {points:1}),
  task("Sprowadzanie z padoku (stado)", "sprowadzanie", {points:1}),
  task("Rozsiodłanie — po jeździe 17:00", "rozsiodłanie", {arena:"arena 1", points:1}),
  task("Lonżowanie — Apollo (15 min)", "lonżowanie", {arena:"lonżownik", horse:"Apollo", points:3, comments:"Rytm, przejścia"}),
  task("Klinika — praca nad reaktywnością", "klinika", {arena:"hala", horse:"Mokka", points:3, comments:"Notuj obserwacje"}),
  task("Zabieg — pielęgnacja/leczenie kopyt (Iskra)", "zabieg", {arena:"stanowisko", horse:"Iskra", points:2, comments:"Konsultuj z instruktorem"}),
  task("Luzak — kontrola ogłowia i popręgu", "luzak", {arena:"hala", points:2, comments:"Bezpieczeństwo przede wszystkim."}),
];

/* --- Global state (will be filled on load) --- */
let state;

document.addEventListener("DOMContentLoaded", () => {
  try {
    // Load or seed
    const tasksLoaded = load(LS.TASKS);
    state = {
      volunteer: load(LS.USER) || { name: "" },
      tasks: Array.isArray(tasksLoaded) && tasksLoaded.length ? tasksLoaded : seedNow(),
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

    // Cache elements
    const tabsNav = $("#tabsNav");
    const paneVolunteer = $("#tab-volunteer");
    const paneInstructor = $("#tab-instructor");
    const paneHorses = $("#tab-horses");

    const nameInput = $("#volunteerName");
    const saveUserBtn = $("#saveUser");
    const demoChk = $("#demoAutoApprove");
    const toast = $("#toast");

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

    const hViewCards = $("#h-view-cards");
    const hViewList = $("#h-view-list");
    const hList = $("#h-list");

    const modal = $("#modal");
    const modalTitle = $("#modalTitle");
    const modalBody = $("#modalBody");
    const modalFoot = $("#modalFoot");
    $("#closeModal").addEventListener("click", closeModal);
    modal.addEventListener("click",(e)=>{ if(e.target===modal) closeModal(); });

    $("#exportCsv").addEventListener("click", exportCSV);
    $("#resetData").addEventListener("click", ()=>{ resetData(false); });
    $("#hardReset").addEventListener("click", ()=>{ resetData(true); });

    // Tabs delegation (1 listener dla całej belki)
    tabsNav.addEventListener("click", (e)=>{
      const btn = e.target.closest(".tab");
      if(!btn) return;
      switchTab(btn.dataset.tab);
      renderAll();
    });

    // Profile + demo
    nameInput.value = state.volunteer.name || "";
    saveUserBtn.addEventListener("click", ()=>{
      state.volunteer.name = nameInput.value.trim();
      save(LS.USER, state.volunteer);
      toastMsg("Zapisano profil");
      renderVolunteer();
    });
    demoChk.checked = !!state.settings.demoAutoApprove;
    demoChk.addEventListener("change", ()=>{
      state.settings.demoAutoApprove = demoChk.checked;
      save(LS.SETTINGS, state.settings);
    });

    // Volunteer filters
    vChips.all.addEventListener("click", ()=>{ state.ui.v.status="all"; setChipActive("v","all"); renderVolunteer(); });
    vChips.open.addEventListener("click", ()=>{ state.ui.v.status="open"; setChipActive("v","open"); renderVolunteer(); });
    vChips.taken.addEventListener("click", ()=>{ state.ui.v.status="taken"; setChipActive("v","taken"); renderVolunteer(); });
    vChips.review.addEventListener("click", ()=>{ state.ui.v.status="to_review"; setChipActive("v","review"); renderVolunteer(); });
    vChips.approved.addEventListener("click", ()=>{ state.ui.v.status="approved"; setChipActive("v","approved"); renderVolunteer(); });
    vChips.mine.addEventListener("click", ()=>{
      state.ui.v.onlyMine = !state.ui.v.onlyMine;
      vChips.mine.classList.toggle("chip-active", state.ui.v.onlyMine);
      renderVolunteer();
    });
    vSearch.addEventListener("input", ()=>{ state.ui.v.search = vSearch.value; renderVolunteer(); });
    vType.addEventListener("change", ()=>{ state.ui.v.type = vType.value; renderVolunteer(); });
    vViewCards.addEventListener("click", ()=>{ state.ui.v.view="cards"; setViewActive("v","cards"); renderVolunteer(); });
    vViewList.addEventListener("click", ()=>{ state.ui.v.view="list"; setViewActive("v","list"); renderVolunteer(); });
    pointsHistoryBtn.addEventListener("click", openPointsHistory);

    // Instructor
    fillSelect(iHorse, ["— koń —"].concat(state.horses));
    fillSelect(iRider, ["— jeździec —"].concat(state.riders));
    iViewCards.addEventListener("click", ()=>{ state.ui.i.view="cards"; setViewActive("i","cards"); renderInstructor(); });
    iViewList.addEventListener("click", ()=>{ state.ui.i.view="list"; setViewActive("i","list"); renderInstructor(); });
    iAdd.addEventListener("click", ()=>addInstructorTask({ iTaskType,iHorse,iRider,iSkill,iWhen,iTitle,iPlace,iPoints }));
    iCreateDefaults.addEventListener("click", createDefaultTasks);

    // Horses
    hViewCards.addEventListener("click", ()=>{ state.ui.h.view="cards"; setViewActive("h","cards"); renderHorses(); });
    hViewList.addEventListener("click", ()=>{ state.ui.h.view="list"; setViewActive("h","list"); renderHorses(); });

    // Start
    switchTab(state.ui.tab);
    renderAll();

  } catch(err){
    console.error(err);
    alert("Ups, coś poszło nie tak. Spróbuj twardego resetu lub odśwież stronę (Ctrl+F5).");
  }
});

/* ---------- Renders ---------- */
function renderAll(){ renderVolunteer(); renderInstructor(); renderHorses(); save(LS.UI, state.ui); }

function renderVolunteer(){
  const me = (state.volunteer.name||"").trim();

  const vis = state.tasks.filter(t=> t.type!=="jazda"); // wolontariusz nie widzi jazd
  // liczniki
  setCounts("v", vis);

  // punkty
  const approvedMine = state.tasks.filter(t=> t.assignedTo===me && t.status==="approved");
  const sumPoints = approvedMine.reduce((a,t)=>a+(+t.points||0),0);
  $("#myPoints").textContent = String(sumPoints);
  $("#myHorseshoes").innerHTML = horseshoesHTML(Math.min(4, Math.round(Math.min(sumPoints,4))));

  // filtracja
  const items = vis.filter(t=>{
    const statusOk = state.ui.v.status==="all" ? true : t.status===state.ui.v.status;
    const mineOk = state.ui.v.onlyMine ? (t.assignedTo===me) : true;
    const typeOk = state.ui.v.type ? (t.type===state.ui.v.type) : true;
    const q = (state.ui.v.search||"").toLowerCase();
    const qOk = !q || [t.title,t.horse,t.arena].filter(Boolean).some(x=>String(x).toLowerCase().includes(q));
    return statusOk && mineOk && typeOk && qOk;
  });

  const vList = $("#v-list");
  vList.className = state.ui.v.view==="list" ? "list" : "grid";
  vList.innerHTML = items.map(cardHTMLVolunteer).join("");
  // actions
  vList.querySelectorAll(".more").forEach(b=>b.addEventListener("click", onOpenTask));
  vList.querySelectorAll(".take").forEach(b=>b.addEventListener("click", onQuickTake));
  vList.querySelectorAll(".done").forEach(b=>b.addEventListener("click", onQuickDone));
}

function renderInstructor(){
  const iList = $("#i-list");
  iList.className = state.ui.i.view==="list" ? "list" : "grid";
  iList.innerHTML = state.tasks.map(cardHTMLInstructor).join("");
  iList.querySelectorAll(".approve").forEach(b=>b.addEventListener("click", onApprove));
  iList.querySelectorAll(".reject").forEach(b=>b.addEventListener("click", onReject));
  iList.querySelectorAll(".openModal").forEach(b=>b.addEventListener("click", e=>{
    const id = e.currentTarget.dataset.id;
    const t = state.tasks.find(x=>x.id===id); if(t) openTaskModal(t);
  }));
}

function renderHorses(){
  const hList = $("#h-list");
  const arr = state.horses.map(name => ({ name, ...horseLoad(name) }));
  hList.className = state.ui.h.view==="list" ? "list" : "grid";
  hList.innerHTML = arr.map(horseCardHTML).join("");
}

/* ---------- Cards ---------- */
function cardHTMLVolunteer(t){
  const meta = [
    t.arena ? `Miejsce: ${t.arena}` : null,
    t.horse ? `Koń: ${t.horse}` : null,
    t.assignedTo ? `Przypisane: ${t.assignedTo}` : "Wolne"
  ].filter(Boolean).join(" • ");
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
      ${quickButtonsVolunteer(t)}
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
      ${t.status==="to_review"
        ? `<button class="btn approve" data-id="${t.id}">Zatwierdź</button>
           <button class="btn ghost reject" data-id="${t.id}">Odrzuć</button>`
        : `<span class="meta"></span>`}
    </div>
  </article>`;
}
function horseCardHTML(h){
  const badge = `<span class="badge-tag">${h.sessions} zadań • ${h.rides} jazd • pkt: ${h.points}</span>`;
  return `
  <article class="card">
    <div class="title"><h3>${escapeHTML(h.name)}</h3></div>
    <div class="badges">${badge}</div>
    <div class="meta">Ostatnie: ${escapeHTML(h.last || "—")}</div>
  </article>`;
}

/* ---------- Buttons & actions ---------- */
function quickButtonsVolunteer(t){
  const me = (state.volunteer.name||"").trim();
  if (t.type==="jazda") return `<span class="meta">Zadanie instruktorskie</span>`;
  if (t.status === "open") return `<button class="btn take" data-id="${t.id}">Weź</button>`;
  if (t.assignedTo === me && t.status === "taken") return `<button class="btn done" data-id="${t.id}">Zgłoś</button>`;
  return `<span class="meta"></span>`;
}
function onOpenTask(e){
  const id = e.currentTarget.closest(".card")?.dataset.id;
  const t = state.tasks.find(x=>x.id===id); if(t) openTaskModal(t);
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

function takeTask(t){
  const me = (state.volunteer.name||"").trim();
  if(!me){ alert("Podaj swoje imię i zapisz."); return; }
  if(t.status!=="open"){ alert("To zadanie nie jest już wolne."); return; }
  t.status = "taken"; t.assignedTo = me; persistTasks();
  if (state.settings.demoAutoApprove) { t.status = "approved"; persistTasks(); }
  renderAll();
}
function markDone(t){
  if(t.status!=="taken"){ alert("To zadanie nie jest w trakcie."); return; }
  t.status = "to_review"; persistTasks();
  if (state.settings.demoAutoApprove) { t.status = "approved"; persistTasks(); }
  renderAll();
}
function onApprove(e){
  const id = e.currentTarget.dataset.id;
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.status = "approved"; persistTasks(); renderAll();
}
function onReject(e){
  const id = e.currentTarget.dataset.id;
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.status = "rejected"; persistTasks(); renderAll();
}

/* ---------- Instructor tools ---------- */
function addInstructorTask(refs){
  const {iTaskType,iHorse,iRider,iSkill,iWhen,iTitle,iPlace,iPoints} = refs;
  const tp = iTaskType.value;
  const title = iTitle.value.trim();
  const arena = iPlace.value.trim() || null;
  const points = clamp(+iPoints.value||0, 0, 4);
  const horse = iHorse.value && iHorse.value!=="— koń —" ? iHorse.value : null;
  const rider = iRider.value && iRider.value!=="— jeździec —" ? iRider.value : null;
  const skill = iSkill.value || null;
  const when = iWhen.value || null;

  if (tp==="jazda") {
    if(!horse || !rider || !when){ alert("Dla jazdy wybierz: konia, jeźdźca i godzinę."); return; }
    const t = task(title || `Jazda — ${horse} ↔ ${rider}`, "jazda", { arena, horse, rider, skill, when, points:0, status:"open" });
    state.tasks.unshift(t);
  } else {
    const t = task(title || defaultTitle(tp, horse), tp, { arena, horse, points, status:"open" });
    state.tasks.unshift(t);
  }
  persistTasks();
  // clear
  iTitle.value = ""; iPlace.value = ""; iPoints.value = 2;
  iHorse.value = "— koń —"; iRider.value = "— jeździec —"; iSkill.value = ""; iWhen.value = "";
  renderAll();
}

function createDefaultTasks(){
  const pack = [
    task("Prace porządkowe — stajnia", "porządki", {points:2}),
    task("Dziennikarz/Kronikarz — dokumentuj dzień", "dziennikarz", {points:2}),
    task("Wyprowadzanie na padok (stado)", "wyprowadzanie", {points:1}),
    task("Sprowadzanie z padoku (stado)", "sprowadzanie", {points:1}),
  ];
  state.tasks = pack.concat(state.tasks);
  persistTasks(); renderAll();
}

/* ---------- Horses: metrics ---------- */
function horseLoad(name){
  const related = state.tasks.filter(t=> t.horse===name && ["lonżowanie","klinika","zabieg","jazda","rozsiodłanie"].includes(t.type));
  const sessions = related.filter(t=> t.type!=="jazda").length;
  const rides = related.filter(t=> t.type==="jazda").length;
  const points = related.filter(t=> t.status==="approved").reduce((a,t)=>a+(+t.points||0),0);
  const last = related.sort((a,b)=>(b.ts||0)-(a.ts||0))[0]?.title;
  return { sessions, rides, points, last };
}

/* ---------- Points history ---------- */
function openPointsHistory(){
  const me = (state.volunteer.name||"").trim();
  const approvedMine = state.tasks.filter(t=> t.assignedTo===me && t.status==="approved");
  const rows = approvedMine.map(t=>`<tr><td>${escapeHTML(t.title)}</td><td>${t.points}</td></tr>`).join("");
  $("#modalTitle").textContent = "Moje punkty — historia";
  $("#modalBody").innerHTML = `
    <table class="table">
      <thead><tr><th>Zadanie</th><th>Punkty</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="2">Brak zatwierdzonych zadań.</td></tr>`}</tbody>
    </table>
  `;
  $("#modalFoot").innerHTML = `<button class="btn ghost" onclick="closeModal()">Zamknij</button>`;
  $("#modal").classList.remove("hidden");
}

/* ---------- Modal ---------- */
function openTaskModal(t){
  $("#modalTitle").textContent = t.title;
  $("#modalBody").innerHTML = `
    <div class="meta"><strong>Typ:</strong> ${escapeHTML(typeLabel(t.type))}</div>
    <div class="meta"><strong>Status:</strong> ${escapeHTML(statusText(t.status))}</div>
    <div class="meta"><strong>Miejsce:</strong> ${escapeHTML(t.arena || '—')}</div>
    <div class="meta"><strong>Koń:</strong> ${escapeHTML(t.horse || '—')}</div>
    <div class="meta"><strong>Jeździec:</strong> ${escapeHTML(t.rider || '—')}</div>
    <div class="meta"><strong>Poziom:</strong> ${escapeHTML(t.skill || '—')}</div>
    <div class="meta"><strong>Godzina:</strong> ${escapeHTML(t.when || '—')}</div>
    <div class="meta"><strong>Podkowy:</strong> ${t.points} / 4</div>
    ${t.type === "dziennikarz" ? mediaBlockHTML(t) : ""}
  `;
  $("#modalFoot").innerHTML = modalButtonsHTML(t);
  $("#modal").classList.remove("hidden");

  const mediaInp = $("#mediaInput");
  if (mediaInp) {
    mediaInp.addEventListener("change", (e)=>{
      const files = Array.from(e.target.files||[]).map(f=>({name:f.name, ts: Date.now()}));
      t.media = (t.media||[]).concat(files);
      persistTasks();
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
function closeModal(){ $("#modal").classList.add("hidden"); }
window.closeModal = closeModal;
window.__take = (id, close)=>{ const t = state.tasks.find(x=>x.id===id); if(t){ takeTask(t); if(close) closeModal(); } };
window.__done = (id, close)=>{ const t = state.tasks.find(x=>x.id===id); if(t){ markDone(t); if(close) closeModal(); } };
window.__approve = (id)=>{ const t = state.tasks.find(x=>x.id===id); if(t){ t.status="approved"; persistTasks(); closeModal(); renderAll(); } };

/* ---------- Export / Reset ---------- */
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

function resetData(hard=false){
  if(!confirm(hard ? "Twardy reset: wyczyści dane i dosieje przykładowe. Kontynuować?" : "Zresetować zadania do stanu domyślnego?")) return;
  if(hard){
    [LS.TASKS,LS.USER,LS.SETTINGS,LS.HORSES,LS.RIDERS,LS.UI].forEach(k=>localStorage.removeItem(k));
    state.tasks = seedNow();
    state.volunteer = {name:""};
    state.settings = { demoAutoApprove:false };
    state.horses = sampleHorses.slice();
    state.riders = sampleRiders.slice();
    state.ui = { tab:"volunteer", v:{status:"all",onlyMine:false,type:"",view:"cards",search:""}, i:{view:"cards"}, h:{view:"cards"} };
  } else {
    state.tasks = seedNow();
  }
  persistTasks(); save(LS.USER,state.volunteer); save(LS.SETTINGS,state.settings);
  save(LS.HORSES,state.horses); save(LS.RIDERS,state.riders); save(LS.UI,state.ui);
  renderAll();
}

/* ---------- Helpers ---------- */
function seedNow(){ const s = seedTasks.map(t=>({...t, id:uid(), ts:Date.now()})); save(LS.TASKS, s); return s; }

function setCounts(prefix, items){
  if(prefix!=="v") return;
  $("#v-countAll").textContent = items.length;
  $("#v-countOpen").textContent = items.filter(x=>x.status==="open").length;
  $("#v-countTaken").textContent = items.filter(x=>x.status==="taken").length;
  $("#v-countReview").textContent = items.filter(x=>x.status==="to_review").length;
  $("#v-countApproved").textContent = items.filter(x=>x.status==="approved").length;
}

function setChipActive(prefix, which){
  const map = {
    all: "#v-chipAll", open:"#v-chipOpen", taken:"#v-chipTaken",
    review:"#v-chipReview", approved:"#v-chipApproved"
  };
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

function statusText(s){
  return ({
    open:"Wolne", taken:"W trakcie", to_review:"Do weryfikacji", approved:"Zatwierdzone", rejected:"Odrzucone"
  })[s] || s;
}

function classByStatus(s){ return ({open:"open", taken:"taken", to_review:"to_review", approved:"approved"})[s] || ""; }
function statusBadgeHTML(s){
  const map = { open:['Wolne','badge-open'], taken:['W trakcie','badge-taken'], to_review:['Do weryfikacji','badge-review'], approved:['Zatwierdzone','badge-approved'] };
  const [label, cls] = map[s] || [s,'badge-tag'];
  return `<span class="badge-tag ${cls}">${label}</span>`;
}
function horseshoesHTML(n){ return Array.from({length:4},(_,i)=>`<span class="hs ${i<n?'fill':''}"></span>`).join(""); }

function horseLoad(name){
  const related = state.tasks.filter(t=> t.horse===name && ["lonżowanie","klinika","zabieg","jazda","rozsiodłanie"].includes(t.type));
  const sessions = related.filter(t=> t.type!=="jazda").length;
  const rides = related.filter(t=> t.type==="jazda").length;
  const points = related.filter(t=> t.status==="approved").reduce((a,t)=>a+(+t.points||0),0);
  const last = related.sort((a,b)=>(b.ts||0)-(a.ts||0))[0]?.title;
  return { sessions, rides, points, last };
}

/* utils */
function toastMsg(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"), 1800); }
function download(name, data, mime="text/plain"){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([data],{type:mime})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function csvEscape(val){ const s=String(val??""); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function slug(s){ return String(s).toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]+/g,""); }
function escapeHTML(s){ return String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||""); }catch{ return null; } }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
