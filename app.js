/* EquiFlow v1.3.1 — rides fix + in-app confirm */

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

/* Sample data */
const sampleHorses = ["Itaka", "Basia", "Nicpoń", "Jurek", "Prada", "Emocja"];
const sampleRiders = ["Ola", "Michał", "Anka", "Kuba", "Julia", "Tomek", "Nina", "Bartek"];
const zabiegiList = ["Masaż", "Derka magnetyczna", "Kopyta — pielęgnacja", "Kąpiel", "Stretching"];

/* Utils */
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||""); }catch{ return null; } }
function escapeHTML(s){ return String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function csvEscape(val){ const s=String(val??""); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function download(name, data, mime="text/plain"){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([data],{type:mime})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function todayISO(){ const d=new Date(); const z=(n)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
function isoToPL(iso){ if(!iso) return "—"; const [y,m,d]=iso.split("-"); return `${d}.${m}.${y}`; }
function isFutureISO(iso){ return new Date(iso) > new Date(todayISO()); }
function clamp(n,min=0,max=4){ return Math.max(min, Math.min(max, n)); }
function toastMsg(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"), 1800); }

/* In-app confirm modal */
function confirmInApp(message, {ok="Tak", cancel="Nie", title="Potwierdź"}={}){
  return new Promise(resolve=>{
    const modal = $("#confirm");
    $("#confirmTitle").textContent = title;
    $("#confirmBody").innerHTML = `<p>${escapeHTML(message)}</p>`;
    const okBtn = $("#confirmOk"), cancelBtn=$("#confirmCancel");
    okBtn.textContent = ok; cancelBtn.textContent = cancel;
    function cleanup(res){
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", okH);
      cancelBtn.removeEventListener("click", cancelH);
      resolve(res);
    }
    function okH(){ cleanup(true); }
    function cancelH(){ cleanup(false); }
    okBtn.addEventListener("click", okH);
    cancelBtn.addEventListener("click", cancelH);
    modal.classList.remove("hidden");
  });
}

/* Model */
function task(title, type, extra={}){
  return {
    id: uid(),
    title, type,
    arena: extra.arena || null,
    horse: extra.horse || null,
    rider: extra.rider || null,
    groupLevel: extra.groupLevel || null,
    indivLevel: extra.indivLevel || null,
    when: extra.when || null,             // "HH:MM"
    dateISO: extra.dateISO || todayISO(), // "YYYY-MM-DD"
    points: typeof extra.points==="number" ? extra.points : 2,
    status: extra.status || "open",
    assignedTo: extra.assignedTo || null,
    comments: extra.comments || "",
    procType: extra.procType || null,
    media: extra.media || [],
    daily: !!extra.daily,
    nudged: false,
    ts: Date.now()
  };
}

const seedTasks = [
  task("Prace porządkowe — stajnia", "porządki", {points:2, daily:true}),
  task("Wyprowadzenie Stada", "wyprowadzenie", {points:1, daily:true}),
  task("Sprowadzenie Stada", "sprowadzenie", {points:1, daily:true}),
  task("Dziennikarz/Kronikarz — dokumentuj dzień", "dziennikarz", {points:2}),
];

let state;

document.addEventListener("DOMContentLoaded", () => {
  state = {
    volunteer: load(LS.USER) || { name: "" },
    tasks: load(LS.TASKS) || seedNow(),
    settings: load(LS.SETTINGS) || { demoAutoApprove: false },
    horses: load(LS.HORSES) || sampleHorses,
    riders: load(LS.RIDERS) || sampleRiders,
    ui: load(LS.UI) || {
      tab: "instructor",
      v: { status:"all", onlyMine:false, type:"", view:"cards", search:"" },
      i: { view:"cards" },
      r: { view:"cards", from: todayISO(), to: todayISO(), group:"none", status:"" }
    }
  };

  // Tabs
  $("#tabsNav").addEventListener("click",(e)=>{
    const btn = e.target.closest(".tab"); if(!btn) return;
    switchTab(btn.dataset.tab); renderAll();
  });

  // profile
  $("#volunteerName").value = state.volunteer.name || "";
  $("#saveUser").addEventListener("click", ()=>{
    state.volunteer.name = $("#volunteerName").value.trim();
    save(LS.USER, state.volunteer);
    toastMsg("Zapisano profil");
    renderAll();
  });

  // demo
  const demoChk = $("#demoAutoApprove");
  demoChk.checked = !!state.settings.demoAutoApprove;
  demoChk.addEventListener("change", ()=>{ state.settings.demoAutoApprove = demoChk.checked; save(LS.SETTINGS, state.settings); });

  /* INSTRUKTOR */
  $("#i-view-cards").addEventListener("click", ()=>{ state.ui.i.view="cards"; setViewActive("i","cards"); renderInstructor(); });
  $("#i-view-list").addEventListener("click", ()=>{ state.ui.i.view="list"; setViewActive("i","list"); renderInstructor(); });
  $("#i-taskType").addEventListener("change", renderDynamicFields);
  renderDynamicFields();
  $("#i-add").addEventListener("click", addInstructorTask);
  $("#i-createDefaults").addEventListener("click", ()=>{
    state.tasks = seedTasks.map(t=>({...t, id:uid(), ts:Date.now(), dateISO:todayISO()})).concat(state.tasks);
    persistTasks(); renderAll();
  });

  /* WOLONTARIUSZ */
  $("#v-chipAll").addEventListener("click", ()=>{ state.ui.v.status="all"; setChipActive("v","all"); renderVolunteer(); });
  $("#v-chipOpen").addEventListener("click", ()=>{ state.ui.v.status="open"; setChipActive("v","open"); renderVolunteer(); });
  $("#v-chipTaken").addEventListener("click", ()=>{ state.ui.v.status="taken"; setChipActive("v","taken"); renderVolunteer(); });
  $("#v-chipReview").addEventListener("click", ()=>{ state.ui.v.status="to_review"; setChipActive("v","review"); renderVolunteer(); });
  $("#v-chipApproved").addEventListener("click", ()=>{ state.ui.v.status="approved"; setChipActive("v","approved"); renderVolunteer(); });
  $("#v-chipMine").addEventListener("click", ()=>{ state.ui.v.onlyMine = !state.ui.v.onlyMine; $("#v-chipMine").classList.toggle("chip-active", state.ui.v.onlyMine); renderVolunteer(); });
  $("#v-search").addEventListener("input", ()=>{ state.ui.v.search = $("#v-search").value; renderVolunteer(); });
  $("#v-type").addEventListener("change", ()=>{ state.ui.v.type = $("#v-type").value; renderVolunteer(); });
  $("#v-view-cards").addEventListener("click", ()=>{ state.ui.v.view="cards"; setViewActive("v","cards"); renderVolunteer(); });
  $("#v-view-list").addEventListener("click", ()=>{ state.ui.v.view="list"; setViewActive("v","list"); renderVolunteer(); });
  $("#pointsHistory").addEventListener("click", openPointsHistory);
  $("#exportCsv").addEventListener("click", exportCSV);
  $("#resetData").addEventListener("click", ()=>{ if(confirm("Zresetować do domyślnych?")){ state.tasks = seedNow(); persistTasks(); renderAll(); }});
  $("#hardReset").addEventListener("click", ()=>{
    if(confirm("Twardy reset? Usunie dane i załaduje domyślne.")){
      [LS.TASKS,LS.USER,LS.SETTINGS,LS.HORSES,LS.RIDERS,LS.UI].forEach(k=>localStorage.removeItem(k));
      state = null; location.reload();
    }
  });

  /* RAPORTY */
  $("#r-from").value = state.ui.r.from || todayISO();
  $("#r-to").value = state.ui.r.to || todayISO();
  $("#r-group").value = state.ui.r.group;
  $("#r-status").value = state.ui.r.status;
  $("#r-from").addEventListener("change", ()=>{ state.ui.r.from=$("#r-from").value; renderReports(); save(LS.UI,state.ui); });
  $("#r-to").addEventListener("change", ()=>{ state.ui.r.to=$("#r-to").value; renderReports(); save(LS.UI,state.ui); });
  $("#r-group").addEventListener("change", ()=>{ state.ui.r.group=$("#r-group").value; renderReports(); save(LS.UI,state.ui); });
  $("#r-status").addEventListener("change", ()=>{ state.ui.r.status=$("#r-status").value; renderReports(); save(LS.UI,state.ui); });
  $("#r-view-cards").addEventListener("click", ()=>{ state.ui.r.view="cards"; setViewActive("r","cards"); renderReports(); save(LS.UI,state.ui); });
  $("#r-view-list").addEventListener("click", ()=>{ state.ui.r.view="list"; setViewActive("r","list"); renderReports(); save(LS.UI,state.ui); });
  $("#r-export").addEventListener("click", exportReportsCSV);

  // start
  switchTab(state.ui.tab);
  renderAll();
});

/* Dynamic fields for instructor */
function renderDynamicFields(){
  const c = $("#i-dynamicFields"); c.innerHTML = "";
  const type = $("#i-taskType").value;

  const date = inputDate("Data", "i-date", todayISO());
  const time = inputTime("Godzina", "i-when");
  const horse = inputSelect("Koń", "i-horse", ["— koń —"].concat(load(LS.HORSES)||sampleHorses));
  const rider = inputSelect("Jeździec", "i-rider", ["— jeździec —"].concat(load(LS.RIDERS)||sampleRiders));
  const levelGroup = inputSelect("Poziom (grupa)", "i-level-group", ["kłus", "kłus-galop", "obóz", "teren"]);
  const levelIndiv = inputSelect("Poziom (indywidualna)", "i-level-indiv", ["lonża", "kłus", "kłus-galop"]);
  const zabieg = inputSelect("Typ zabiegu", "i-proc", zabiegiList);

  if (type==="prep"){ append(c, date, time, horse, rider); }
  else if (type==="zabieg"){ append(c, date, horse, zabieg); }
  else if (type==="wyprowadzenie" || type==="sprowadzenie" || type==="rozsiodłanie"){ append(c, date, time); }
  else if (type==="jazda_grupowa"){ append(c, date, time, levelGroup, horse, rider); }
  else if (type==="jazda_indywidualna"){ append(c, date, time, levelIndiv, horse, rider); }
}
function inputDate(label, id, iso){ const el=document.createElement("label"); el.innerHTML=`${label}<input id="${id}" type="date" value="${iso}"/>`; return el; }
function inputTime(label, id){ const el=document.createElement("label"); el.innerHTML=`${label}<input id="${id}" type="time" />`; return el; }
function inputSelect(label,id,arr){ const el=document.createElement("label"); el.innerHTML=`${label}<select id="${id}">${arr.map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("")}</select>`; return el; }
function append(parent,...children){ children.forEach(ch=>parent.appendChild(ch)); }

/* Renders */
function renderAll(){ renderInstructor(); renderVolunteer(); renderReports(); save(LS.UI, state.ui); }
function setViewActive(prefix, which){
  const map = { i:{cards:"#i-view-cards",list:"#i-view-list"}, v:{cards:"#v-view-cards",list:"#v-view-list"}, r:{cards:"#r-view-cards",list:"#r-view-list"} };
  const m = map[prefix]; $(m.cards).classList.toggle("view-active", which==="cards"); $(m.list).classList.toggle("view-active", which==="list");
}
function switchTab(key){
  state.ui.tab = key;
  $$(".tab").forEach(b=>b.classList.toggle("tab-active", b.dataset.tab===key));
  $("#tab-instructor").classList.toggle("hidden", key!=="instructor");
  $("#tab-volunteer").classList.toggle("hidden", key!=="volunteer");
  $("#tab-reports").classList.toggle("hidden", key!=="reports");
  save(LS.UI, state.ui);
}

/* Instructor list */
function renderInstructor(){
  const items = state.tasks.filter(t => t.daily || ["porządki","wyprowadzenie","sprowadzenie"].includes(t.type));
  const other = state.tasks.filter(t => !(t.daily || ["porządki","wyprowadzenie","sprowadzenie"].includes(t.type)));
  const list = $("#i-list");
  list.className = state.ui.i.view==="list" ? "list" : "grid";
  list.innerHTML = items.concat(other).map(cardHTMLInstructor).join("");

  list.querySelectorAll(".openModal").forEach(b=>b.addEventListener("click", e=>{
    const id = e.currentTarget.dataset.id; const t = state.tasks.find(x=>x.id===id); if(t) openTaskModal(t);
  }));
  list.querySelectorAll(".approve").forEach(b=>b.addEventListener("click", onApprove));
  list.querySelectorAll(".reject").forEach(b=>b.addEventListener("click", onReject));
  list.querySelectorAll(".assign").forEach(b=>b.addEventListener("click", onAssignVolunteer));
  list.querySelectorAll(".nudge").forEach(b=>b.addEventListener("click", onNudge));
  list.querySelectorAll(".delete").forEach(b=>b.addEventListener("click", onDeleteTask));
}
function cardHTMLInstructor(t){
  const meta = [
    isoToPL(t.dateISO),
    t.when ? `godz. ${t.when}` : null,
    t.arena ? `miejsce: ${t.arena}` : null,
    t.horse ? `koń: ${t.horse}` : null,
    t.rider ? `jeździec: ${t.rider}` : null,
    t.groupLevel ? `poziom: ${t.groupLevel}` : null,
    t.indivLevel ? `poziom: ${t.indivLevel}` : null,
    t.assignedTo ? `wolont.: ${t.assignedTo}` : null
  ].filter(Boolean).join(" • ");

  const future = isFutureISO(t.dateISO);
  const ride = (t.type==="jazda_grupowa" || t.type==="jazda_indywidualna");
  const daily = t.daily || ["porządki","wyprowadzenie","sprowadzenie"].includes(t.type);

  const badges = [
    `<span class="badge-tag ${ride?'badge-ride':''} ${daily?'badge-daily':''}">${escapeHTML(typeLabel(t.type))}</span>`,
    statusBadgeHTML(t.status)
  ].join("");

  const actions = `
    ${t.status==="to_review" ? `<button class="btn approve" data-id="${t.id}">Zatwierdź</button>
                                <button class="btn ghost reject" data-id="${t.id}">Odrzuć</button>` : ``}
    ${t.status==="open" ? assignVolunteerUI(t.id) : ``}
    <button class="btn ghost nudge" data-id="${t.id}">Szturchnij</button>
    <button class="btn ghost delete" data-id="${t.id}">Usuń</button>
  `;

  return `
  <article class="card ${classByStatus(t.status)} ${ride?'ride':''} ${future?'future':''}" data-id="${t.id}">
    <div class="title">
      <h3>${escapeHTML(t.title)}</h3>
      <span class="podkowy" title="${t.points} podk.">${horseshoesHTML(t.points)}</span>
    </div>
    <div class="badges">${badges}</div>
    <div class="meta">${escapeHTML(meta)}</div>
    ${t.comments ? `<div class="meta">Uwagi: ${escapeHTML(t.comments)}</div>` : ""}
    <div class="kit">
      <button class="btn openModal" data-id="${t.id}">Podgląd</button>
      ${actions}
    </div>
  </article>`;
}
function assignVolunteerUI(id){
  const vols = uniqueAssignedCandidates();
  return `
    <span class="meta">Przypisz do:</span>
    <select class="assignSel" data-id="${id}">
      <option value="">— wybierz —</option>
      ${vols.map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("")}
    </select>
    <button class="btn assign" data-id="${id}">OK</button>
  `;
}
function uniqueAssignedCandidates(){
  const arr = state.tasks.map(t=>t.assignedTo).filter(Boolean);
  const me = (state.volunteer.name||"").trim(); if(me) arr.push(me);
  return Array.from(new Set(arr));
}
function onAssignVolunteer(e){
  const id = e.currentTarget.dataset.id;
  const card = e.currentTarget.closest(".card");
  const sel = card.querySelector(".assignSel");
  const val = sel?.value?.trim();
  if(!val){ toastMsg("Wybierz wolontariusza"); return; }
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.assignedTo = val; t.status = "taken"; persistTasks(); renderAll();
}
function onNudge(e){
  const id = e.currentTarget.dataset.id;
  const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.nudged = true; persistTasks(); toastMsg("Wysłano przypomnienie (demo)"); renderAll();
}
function onDeleteTask(e){
  const id = e.currentTarget.dataset.id;
  if(!confirm("Usunąć to zadanie?")) return;
  state.tasks = state.tasks.filter(x=>x.id!==id);
  persistTasks(); renderAll();
}

/* Volunteer */
function renderVolunteer(){
  const me = (state.volunteer.name||"").trim();
  const vis = state.tasks.filter(t=> t.type!=="jazda_grupowa" && t.type!=="jazda_indywidualna");
  setCounts("v", vis);

  const approvedMine = state.tasks.filter(t=> t.assignedTo===me && t.status==="approved");
  $("#myPoints").textContent = String(approvedMine.reduce((a,t)=>a+(+t.points||0),0));
  $("#myHorseshoes").innerHTML = horseshoesHTML(4);

  const items = vis.filter(t=>{
    const statusOk = state.ui.v.status==="all" ? true : t.status===state.ui.v.status;
    const mineOk = state.ui.v.onlyMine ? (t.assignedTo===me) : true;
    const typeOk = state.ui.v.type ? (typeMapVolunteer(t.type)===state.ui.v.type || t.type===state.ui.v.type) : true;
    const q = (state.ui.v.search||"").toLowerCase();
    const qOk = !q || [t.title,t.horse,t.arena].filter(Boolean).some(x=>String(x).toLowerCase().includes(q));
    return statusOk && mineOk && typeOk && qOk;
  });

  const list = $("#v-list");
  list.className = state.ui.v.view==="list" ? "list" : "grid";
  list.innerHTML = items.map(cardHTMLVolunteer).join("");
  list.querySelectorAll(".more").forEach(b=>b.addEventListener("click", onOpenTask));
  list.querySelectorAll(".take").forEach(b=>b.addEventListener("click", onQuickTake));
  list.querySelectorAll(".done").forEach(b=>b.addEventListener("click", onQuickDone));
}
function typeMapVolunteer(t){ return t==="prep" ? "siodłanie" : t; }
function cardHTMLVolunteer(t){
  const meta = [
    isoToPL(t.dateISO),
    t.when ? `godz. ${t.when}` : null,
    t.arena ? `miejsce: ${t.arena}` : null,
    t.horse ? `koń: ${t.horse}` : null,
    t.assignedTo ? `przypisane: ${t.assignedTo}` : "Wolne"
  ].filter(Boolean).join(" • ");

  return `
  <article class="card ${classByStatus(t.status)} ${t.daily?'daily':''} ${isFutureISO(t.dateISO)?'future':''}" data-id="${t.id}">
    <div class="title">
      <h3>${escapeHTML(t.title)}</h3>
    </div>
    <div class="badges">
      <span class="badge-tag ${t.daily?'badge-daily':''}">${escapeHTML(typeLabel(t.type))}</span>
      ${statusBadgeHTML(t.status)}
    </div>
    <div class="meta">${escapeHTML(meta)}</div>
    <div class="kit">
      <button class="btn more">Szczegóły</button>
      ${quickButtonsVolunteer(t)}
    </div>
  </article>`;
}
function quickButtonsVolunteer(t){
  const me = (state.volunteer.name||"").trim();
  if (t.status === "open") return `<button class="btn take" data-id="${t.id}">Weź</button>`;
  if (t.assignedTo === me && t.status === "taken") return `<button class="btn done" data-id="${t.id}">Zgłoś Wykonanie</button>`;
  return `<span class="meta"></span>`;
}
function onOpenTask(e){ const id=e.currentTarget.closest(".card")?.dataset.id; const t=state.tasks.find(x=>x.id===id); if(t) openTaskModal(t); }
function onQuickTake(e){ const id=e.currentTarget.dataset.id; const t=state.tasks.find(x=>x.id===id); if(t) takeTask(t); }
function onQuickDone(e){ const id=e.currentTarget.dataset.id; const t=state.tasks.find(x=>x.id===id); if(t) markDone(t); }
function takeTask(t){
  const me = (state.volunteer.name||"").trim();
  if(!me){ alert("Podaj swoje imię i zapisz."); return; }
  if(t.status!=="open"){ alert("To zadanie nie jest już wolne."); return; }
  t.status="taken"; t.assignedTo=me; persistTasks();
  if (state.settings.demoAutoApprove){ t.status="approved"; persistTasks(); }
  renderAll();
}
function markDone(t){
  if(t.status!=="taken"){ alert("To zadanie nie jest w trakcie."); return; }
  t.status="to_review"; persistTasks();
  if (state.settings.demoAutoApprove){ t.status="approved"; persistTasks(); }
  renderAll();
}

/* Reports */
function renderReports(){
  const view = state.ui.r.view;
  const from = new Date(state.ui.r.from || todayISO());
  const to = new Date(state.ui.r.to || todayISO()); to.setHours(23,59,59,999);
  const statusFilter = state.ui.r.status;

  let arr = state.tasks.filter(t=>{
    const d = new Date(t.dateISO || todayISO());
    const inRange = d>=from && d<=to;
    const st = !statusFilter || t.status===statusFilter;
    return inRange && st;
  });

  const group = state.ui.r.group;
  let html="";
  if(group==="none"){
    html = arr.map(cardHTMLReport).join("");
  } else {
    const groups = groupBy(arr, group==="user"?"assignedTo":group==="type"?"type":"horse");
    html = Object.entries(groups).map(([key,items])=>{
      return `
      <article class="card">
        <div class="title"><h3>${escapeHTML(key||"(brak)")}</h3></div>
        <div class="${view==='list'?'list':'grid'}">${items.map(cardHTMLReport).join("")}</div>
      </article>`;
    }).join("");
  }

  const list = $("#r-list");
  list.className = view==="list" ? "list" : "grid";
  list.innerHTML = html || `<article class="card"><div class="meta">Brak rekordów w wybranym zakresie.</div></article>`;
}
function cardHTMLReport(t){
  const meta = [
    isoToPL(t.dateISO),
    t.when ? `godz. ${t.when}` : null,
    t.horse ? `koń: ${t.horse}` : null,
    t.rider ? `jeździec: ${t.rider}` : null,
    t.assignedTo ? `wolont.: ${t.assignedTo}` : null
  ].filter(Boolean).join(" • ");
  const ride = (t.type==="jazda_grupowa" || t.type==="jazda_indywidualna");
  return `
  <article class="card ${classByStatus(t.status)} ${isFutureISO(t.dateISO)?'future':''} ${ride?'ride':''}">
    <div class="title"><h3>${escapeHTML(t.title)}</h3></div>
    <div class="badges"><span class="badge-tag">${escapeHTML(typeLabel(t.type))}</span>${statusBadgeHTML(t.status)}</div>
    <div class="meta">${escapeHTML(meta)}</div>
  </article>`;
}
function exportReportsCSV(){
  const from = state.ui.r.from, to = state.ui.r.to, statusFilter = state.ui.r.status;
  const rows = [
    ["data","godzina","tytuł","typ","koń","jeździec","status","wolontariusz","punkty"],
    ...state.tasks
      .filter(t=> t.dateISO>=from && t.dateISO<=to && (!statusFilter || t.status===statusFilter))
      .map(t=>[ isoToPL(t.dateISO), t.when||"", t.title, typeLabel(t.type), t.horse||"", t.rider||"", statusText(t.status), t.assignedTo||"", t.points||0 ])
  ];
  download(`equiflow_raport_${from}_${to}.csv`, rows.map(r=>r.map(csvEscape).join(",")).join("\n"), "text/csv");
}

/* Modal */
$("#closeModal")?.addEventListener("click", ()=>$("#modal").classList.add("hidden"));
$("#modal")?.addEventListener("click",(e)=>{ if(e.target.id==="modal") $("#modal").classList.add("hidden"); });
function openTaskModal(t){
  $("#modalTitle").textContent = t.title;
  $("#modalBody").innerHTML = `
    <div class="meta"><strong>Typ:</strong> ${escapeHTML(typeLabel(t.type))}</div>
    <div class="meta"><strong>Status:</strong> ${escapeHTML(statusText(t.status))}</div>
    <div class="meta"><strong>Data:</strong> ${isoToPL(t.dateISO)}</div>
    <div class="meta"><strong>Godzina:</strong> ${escapeHTML(t.when || '—')}</div>
    <div class="meta"><strong>Koń:</strong> ${escapeHTML(t.horse || '—')}</div>
    <div class="meta"><strong>Jeździec:</strong> ${escapeHTML(t.rider || '—')}</div>
    <div class="meta"><strong>Arena:</strong> ${escapeHTML(t.arena || '—')}</div>
    ${t.procType ? `<div class="meta"><strong>Zabieg:</strong> ${escapeHTML(t.procType)}</div>` : ""}
    <div class="meta"><strong>Podkowy:</strong> ${t.points} / 4</div>
  `;
  $("#modalFoot").innerHTML = `<button class="btn ghost" onclick="closeModal()">Zamknij</button>`;
  $("#modal").classList.remove("hidden");
}
function closeModal(){ $("#modal").classList.add("hidden"); }

/* Actions */
function onApprove(e){ const id=e.currentTarget.dataset.id; const t=state.tasks.find(x=>x.id===id); if(t){ t.status="approved"; persistTasks(); renderAll(); } }
function onReject(e){ const id=e.currentTarget.dataset.id; const t=state.tasks.find(x=>x.id===id); if(t){ t.status="rejected"; persistTasks(); renderAll(); } }
function statusText(s){ return ({open:"Wolne",taken:"W trakcie",to_review:"Do weryfikacji",approved:"Zatwierdzone",rejected:"Odrzucone"})[s] || s; }
function classByStatus(s){ return ({open:"open",taken:"taken",to_review:"to_review",approved:"approved"})[s] || ""; }
function statusBadgeHTML(s){ const map={open:['Wolne','badge-open'],taken:['W trakcie','badge-taken'],to_review:['Do weryfikacji','badge-review'],approved:['Zatwierdzone','badge-approved']}; const [l,c]=map[s]||[s,'badge-tag']; return `<span class="badge-tag ${c}">${l}</span>`; }
function horseshoesHTML(n){ return Array.from({length:4},(_,i)=>`<span class="hs ${i<n?'fill':''}"></span>`).join(""); }
function typeLabel(t){
  const map = {
    "porządki":"Prace porządkowe",
    "wyprowadzenie":"Wyprowadzenie Stada",
    "sprowadzenie":"Sprowadzenie Stada",
    "rozsiodłanie":"Rozsiodłanie",
    "lonżowanie":"Lonżowanie",
    "klinika":"Klinika",
    "zabieg":"Zabieg",
    "dziennikarz":"Dziennikarz / Kronikarz",
    "luzak":"Luzak",
    "prep":"Przygotowanie do Jazdy",
    "jazda_grupowa":"Jazda Grupowa",
    "jazda_indywidualna":"Jazda Indywidualna"
  };
  return map[t] || t;
}

/* Add tasks (INSTRUKTOR) */
async function addInstructorTask(){
  const tp = $("#i-taskType").value;
  const points = clamp(+($("#i-points").value||2), 0, 4);
  const arena = ($("#i-place").value||"").trim() || null;
  const title = ($("#i-title").value||"").trim();

  const dateISO = $("#i-date")?.value || todayISO();
  const when = $("#i-when")?.value || null;
  const horse = $("#i-horse")?.value && $("#i-horse").value!=="— koń —" ? $("#i-horse").value : null;
  const rider = $("#i-rider")?.value && $("#i-rider").value!=="— jeździec —" ? $("#i-rider").value : null;
  const groupLevel = $("#i-level-group")?.value || null;
  const indivLevel = $("#i-level-indiv")?.value || null;
  const procType = $("#i-proc")?.value || null;

  let t;

  if (tp==="prep"){
    const missing = [];
    if(!horse) missing.push("koń");
    if(!rider) missing.push("jeździec");
    if(!when)  missing.push("godzina");
    if(missing.length){ toastMsg("Uzupełnij: " + missing.join(", ")); return; }
    t = task(title||`Przygotowanie — ${horse} dla ${rider}`, "prep", {arena, horse, rider, when, dateISO, points});
  }
  else if (tp==="zabieg"){
    if(!horse || !procType){ toastMsg("Dla Zabiegu wybierz konia i typ zabiegu."); return; }
    t = task(title||`Zabieg — ${procType} (${horse})`, "zabieg", {arena, horse, when, dateISO, points, procType});
  }
  else if (tp==="wyprowadzenie" || tp==="sprowadzenie" || tp==="rozsiodłanie"){
    t = task(title||typeLabel(tp), tp, {arena, when, dateISO, points, daily:true});
  }
  else if (tp==="jazda_grupowa"){
    const missing = [];
    if(!when) missing.push("godzina");
    if(!groupLevel) missing.push("poziom (grupa)");
    if(!horse) missing.push("koń");
    if(!rider) missing.push("jeździec");
    if(missing.length){ toastMsg("Uzupełnij: " + missing.join(", ")); return; }
    t = task(title||`Jazda Grupowa — ${groupLevel}`, "jazda_grupowa", {arena, horse, rider, when, dateISO, points:0, groupLevel});
    await createPrepPrompt(t);
  }
  else if (tp==="jazda_indywidualna"){
    const missing = [];
    if(!when) missing.push("godzina");
    if(!indivLevel) missing.push("poziom (indywidualna)");
    if(!horse) missing.push("koń");
    if(!rider) missing.push("jeździec");
    if(missing.length){ toastMsg("Uzupełnij: " + missing.join(", ")); return; }
    t = task(title||`Jazda Indywidualna — ${indivLevel}`, "jazda_indywidualna", {arena, horse, rider, when, dateISO, points:0, indivLevel});
    await createPrepPrompt(t);
  }

  state.tasks.unshift(t);
  persistTasks();

  // reset podstawowych pól
  $("#i-title").value = ""; $("#i-place").value = ""; $("#i-points").value = 2;
  // nie czyścimy daty – zostaje dzisiejsza, ale czas zostawiamy do ponownego wpisu
  if($("#i-when")) $("#i-when").value = "";

  renderAll();
}

/* In-app prompt for „Przygotowanie do Jazdy” */
async function createPrepPrompt(rideTask){
  const msg = `Dodano ${typeLabel(rideTask.type)} (${isoToPL(rideTask.dateISO)} ${rideTask.when}).\nCzy zlecić osiodłanie konia wolontariuszowi?`;
  const ok = await confirmInApp(msg, {title:"Zlecić Przygotowanie do Jazdy?", ok:"Zleć", cancel:"Pomiń"});
  if (ok){
    const prep = task(`Przygotowanie — ${rideTask.horse} dla ${rideTask.rider}`, "prep", {
      arena: rideTask.arena, horse: rideTask.horse, rider: rideTask.rider,
      when: rideTask.when, dateISO: rideTask.dateISO, points:2
    });
    state.tasks.unshift(prep);
    persistTasks();
    toastMsg("Dodano zadanie: Przygotowanie do Jazdy");
  }
}

/* Persistence & helpers */
function persistTasks(){ save(LS.TASKS, state.tasks); }
function seedNow(){ const s = seedTasks.map(t=>({...t, id:uid(), ts:Date.now(), dateISO:todayISO()})); save(LS.TASKS, s); return s; }
function setCounts(prefix, items){
  if(prefix!=="v") return;
  $("#v-countAll").textContent = items.length;
  $("#v-countOpen").textContent = items.filter(x=>x.status==="open").length;
  $("#v-countTaken").textContent = items.filter(x=>x.status==="taken").length;
  $("#v-countReview").textContent = items.filter(x=>x.status==="to_review").length;
  $("#v-countApproved").textContent = items.filter(x=>x.status==="approved").length;
}
function groupBy(arr, key){ return arr.reduce((acc,it)=>{ const k=(it[key]||""); (acc[k]=acc[k]||[]).push(it); return acc; },{}); }

/* Volunteer: points history & export */
function openPointsHistory(){
  const me = (state.volunteer.name||"").trim();
  const approvedMine = state.tasks.filter(t=> t.assignedTo===me && t.status==="approved");
  const rows = approvedMine.map(t=>`<tr><td>${escapeHTML(t.title)}</td><td>${t.points}</td><td>${isoToPL(t.dateISO)}</td></tr>`).join("");
  $("#modalTitle").textContent = "Moje punkty — historia";
  $("#modalBody").innerHTML = `
    <table class="table">
      <thead><tr><th>Zadanie</th><th>Punkty</th><th>Data</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3">Brak zatwierdzonych zadań.</td></tr>`}</tbody>
    </table>
  `;
  $("#modalFoot").innerHTML = `<button class="btn ghost" onclick="closeModal()">Zamknij</button>`;
  $("#modal").classList.remove("hidden");
}

/* Export user CSV */
function exportCSV(){
  const me = (state.volunteer.name||"").trim();
  if(!me){ alert("Podaj swoje imię i zapisz."); return; }
  const rows = [
    ["data","godzina","tytuł","typ","koń","arena","status","punkty","przypisane_do"],
    ...state.tasks
      .filter(t=>t.assignedTo===me && ["taken","to_review","approved"].includes(t.status))
      .map(t=>[
        isoToPL(t.dateISO), t.when||"", t.title, typeLabel(t.type), t.horse||"", t.arena||"", t.status, t.status==="approved"?t.points:0, t.assignedTo||""
      ])
  ];
  download(`equiflow_${me.toLowerCase()}_raport.csv`, rows.map(r=>r.map(csvEscape).join(",")).join("\n"), "text/csv");
}
