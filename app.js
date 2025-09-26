/* EquiFlow v1.4 — FIXED FULL APP.JS (Admin first, compact UI, daily tasks auto, add rider/horse, instructor filters) */

const LS = {
  TASKS: "equiflow_tasks_v1",
  USER: "equiflow_user_v1",
  SETTINGS: "equiflow_settings_v1",
  HORSES: "equiflow_horses_v2",
  RIDERS: "equiflow_riders_v2",
  INSTRUCTORS: "equiflow_instructors_v1",
  UI: "equiflow_ui_v1"
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ---------- Helpers ---------- */
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)||""); }catch{ return null; } }
function todayISO(){ const d=new Date(); const z=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
function isoToPL(iso){ if(!iso) return "—"; const [y,m,d]=iso.split("-"); return `${d}.${m}.${y}`; }
function isFutureISO(iso){ return new Date(iso) > new Date(todayISO()); }
function csvEscape(val){ const s=String(val??""); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function download(name, data, mime="text/plain"){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([data],{type:mime})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function clamp(n,min=0,max=4){ return Math.max(min, Math.min(max, n)); }
function toastMsg(msg){ const el=$("#toast"); if(!el) return; el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"), 1800); }
function weekdayPL(dISO){
  const d=new Date(dISO||todayISO());
  const days=["niedziela","poniedziałek","wtorek","środa","czwartek","piątek","sobota"];
  return days[d.getDay()];
}
function escapeHTML(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

/* ---------- Seeds ---------- */
const seedHorseNames = ["Itaka","Basia","Nicpoń","Jurek","Prada","Emocja","Apollo","Mokka","Iskra","Orion","Luna","Tango","Sahara","Hermes","Bella"];
const seedHorses = seedHorseNames.map(n=>({name:n,label:`koń ${n}`}));

const seedInstructors = [
  {first:"Anna", gender:"F"},
  {first:"Katarzyna", gender:"F"},
  {first:"Ewa", gender:"F"},
  {first:"Piotr", gender:"M"},
  {first:"Marek", gender:"M"},
  {first:"Tomasz", gender:"M"},
].map(p=>({...p, id:uid(), label: (p.gender==="F"?"pani ":"pan ") + p.first}));

const levels = ["kłus","kłus-galop","obóz","teren","lonża"];
function addDays(iso,days){ const d=new Date(iso); d.setDate(d.getDate()+days); const z=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
const seedRiders = (()=> {
  const base = todayISO();
  const times = ["10:00","11:00","12:00","16:00","17:00","18:00"];
  const firsts = ["Ola","Michał","Anka","Kuba","Julia","Tomek","Nina","Bartek","Iga","Paweł","Ala","Kamil","Zosia","Karol","Laura","Igor","Oskar","Magda","Adam","Ewelina"];
  const lasts  = ["Kowalska","Nowak","Wiśniewska","Wójcik","Kamińska","Lewandowski","Zielińska","Szymański","Woźniak","Dąbrowska","Kozłowski","Jankowska","Mazur","Krawczyk","Piotrowska","Grabowski","Pawlak","Michalska","Król","Wieczorek"];
  return firsts.map((f,i)=>({
    id: uid(),
    first: f,
    last: lasts[i],
    tel: `+48 600 00 ${String(10+i).padStart(2,"0")}`,
    email: `${f.toLowerCase()}.${lasts[i].toLowerCase()}@example.com`,
    level: levels[i % levels.length],
    dateISO: addDays(base, i % 5),
    when: times[i % times.length],
    instructorId: seedInstructors[i % seedInstructors.length].id,
    horse: null
  }));
})();

/* ---------- Data model ---------- */
function task(title, type, extra={}){
  return {
    id: uid(),
    title, type,
    arena: extra.arena || null,
    horse: extra.horse || null,
    rider: extra.rider || null,
    groupLevel: extra.groupLevel || null,
    indivLevel: extra.indivLevel || null,
    when: extra.when || null,
    dateISO: extra.dateISO || todayISO(),
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

/* brakująca funkcja z Twojego pliku */
function seedNow(){
  // dziś podstawowy zestaw zadań codziennych
  const base = todayISO();
  return [
    task("Prace porządkowe — stajnia", "porządki", {points:2, daily:true, dateISO:base}),
    task("Wyprowadzenie Stada", "wyprowadzenie", {points:1, daily:true, dateISO:base}),
    task("Sprowadzenie Stada", "sprowadzenie", {points:1, daily:true, dateISO:base}),
  ];
}

function ensureDailyTasksForToday(){
  const today = todayISO();
  const need = [
    {title:"Prace porządkowe — stajnia", type:"porządki", points:2},
    {title:"Wyprowadzenie Stada", type:"wyprowadzenie", points:1},
    {title:"Sprowadzenie Stada", type:"sprowadzenie", points:1},
  ];
  let added = 0;
  need.forEach(n=>{
    const exists = state.tasks.some(t=> t.type===n.type && t.dateISO===today);
    if(!exists){
      state.tasks.unshift(task(n.title, n.type, {points:n.points, daily:true, dateISO:today}));
      added++;
    }
  });
  if (added>0) persistAll();
}

/* ---------- State ---------- */
let state;

document.addEventListener("DOMContentLoaded", () => {
  state = {
    volunteer: load(LS.USER) || { name: "" },
    tasks: load(LS.TASKS) || seedNow(),
    settings: load(LS.SETTINGS) || { demoAutoApprove: false },
    horses: load(LS.HORSES) || seedHorses,
    riders: load(LS.RIDERS) || seedRiders,
    instructors: load(LS.INSTRUCTORS) || seedInstructors,
    ui: load(LS.UI) || {
      tab: "admin", // start od Admin
      v: { status:"all", onlyMine:false, type:"", view:"cards", search:"" },
      i: { view:"cards" },
      r: { view:"cards", from: todayISO(), to: todayISO(), group:"none", status:"" },
      a: { day: todayISO() }
    }
  };

  // wymuś Admin na starcie i codzienne zadania
  ensureDailyTasksForToday();
  state.ui.tab = "admin";

  // Tabs
  $("#tabsNav").addEventListener("click",(e)=>{
    const btn = e.target.closest(".tab"); if(!btn) return;
    switchTab(btn.dataset.tab); renderAll();
  });

  // Profile
  $("#volunteerName").value = state.volunteer.name || "";
  $("#saveUser").addEventListener("click", ()=>{
    state.volunteer.name = $("#volunteerName").value.trim();
    save(LS.USER, state.volunteer);
    toastMsg("Zapisano profil");
    renderAll();
  });

  // Demo switch (vol)
  const demoChk = $("#demoAutoApprove");
  if (demoChk){
    demoChk.checked = !!state.settings.demoAutoApprove;
    demoChk.addEventListener("change", ()=>{ state.settings.demoAutoApprove = demoChk.checked; save(LS.SETTINGS, state.settings); });
  }

  /* -------- INSTRUKTOR -------- */
  $("#i-view-cards").addEventListener("click", ()=>{ state.ui.i.view="cards"; setViewActive("i","cards"); renderInstructor(); });
  $("#i-view-list").addEventListener("click", ()=>{ state.ui.i.view="list"; setViewActive("i","list"); renderInstructor(); });
  $("#i-taskType").addEventListener("change", renderDynamicFields);
  renderDynamicFields();
  $("#i-add").addEventListener("click", addInstructorTask);
  $("#i-createDefaults").addEventListener("click", ()=>{
    state.tasks = seedTasks.map(t=>({...t, id:uid(), ts:Date.now(), dateISO:todayISO()})).concat(state.tasks);
    persistAll(); renderAll();
  });

  /* -------- WOLONTARIUSZ -------- */
  bindVolunteerUI();

  /* -------- RAPORTY -------- */
  bindReportsUI();

  /* -------- ADMIN -------- */
  initAdmin();

  // Start
  switchTab(state.ui.tab);
  renderAll();
});

/* ---------- UI Binders ---------- */
function bindVolunteerUI(){
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
  $("#resetData").addEventListener("click", ()=>{ if(confirm("Zresetować do domyślnych?")){ resetAll(); }});
  $("#hardReset").addEventListener("click", ()=>{ if(confirm("Twardy reset?")){ hardReset(); }});
}
function bindReportsUI(){
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
}

/* ---------- Views switch ---------- */
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
  $("#tab-admin").classList.toggle("hidden", key!=="admin");
  save(LS.UI, state.ui);
}

/* ---------- Renders ---------- */
function renderAll(){ renderInstructor(); renderVolunteer(); renderReports(); renderAdmin(); save(LS.UI, state.ui); }

/* INSTRUCTOR */
function renderDynamicFields(){
  const c = $("#i-dynamicFields"); if(!c) return;
  c.innerHTML = "";
  const type = $("#i-taskType").value;

  // safety (gdy LS pusty)
  if(!state.horses || !state.horses.length) state.horses = seedHorses.slice();
  if(!state.riders || !state.riders.length) state.riders = seedRiders.slice();

  const date = inputDate("Data", "i-date", todayISO());
  const time = inputTime("Godzina", "i-when");
  const horse = inputSelect("Koń", "i-horse", ["— koń —"].concat(state.horses.map(h=>h.name)));
  const rider = inputSelect("Jeździec", "i-rider", ["— jeździec —"].concat(uniqueRiderNames()));
  const levelGroup = inputSelect("Poziom (grupa)", "i-level-group", ["kłus", "kłus-galop", "obóz", "teren"]);
  const levelIndiv = inputSelect("Poziom (indywidualna)", "i-level-indiv", ["lonża", "kłus", "kłus-galop"]);

  if (type==="prep"){ append(c, date, time, horse, rider); }
  else if (type==="zabieg"){ const proc = inputSelect("Typ zabiegu","i-proc",["Masaż","Derka magnetyczna","Kopyta — pielęgnacja","Kąpiel","Stretching"]); append(c, date, horse, proc); }
  else if (type==="wyprowadzenie" || type==="sprowadzenie" || type==="rozsiodłanie"){ append(c, date, time); }
  else if (type==="jazda_grupowa"){ append(c, date, time, levelGroup, horse, rider); }
  else if (type==="jazda_indywidualna"){ append(c, date, time, levelIndiv, horse, rider); }
}
function inputDate(label, id, iso){ const el=document.createElement("label"); el.innerHTML=`${label}<input id="${id}" type="date" value="${iso}"/>`; return el; }
function inputTime(label, id){ const el=document.createElement("label"); el.innerHTML=`${label}<input id="${id}" type="time" />`; return el; }
function inputSelect(label,id,arr){ const el=document.createElement("label"); el.innerHTML=`${label}<select id="${id}">${arr.map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("")}</select>`; return el; }
function append(parent,...children){ children.forEach(ch=>parent.appendChild(ch)); }

async function addInstructorTask(){
  if (!$("#i-date")) renderDynamicFields();

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
    if(!horse || !rider || !when){ toastMsg("Uzupełnij: koń, jeździec, godzina"); return; }
    t = task(title||`Przygotowanie — ${horse} dla ${rider}`, "prep", {arena, horse, rider, when, dateISO, points});
  } else if (tp==="zabieg"){
    if(!horse || !procType){ toastMsg("Dla zabiegu: wybierz konia i typ zabiegu"); return; }
    t = task(title||`Zabieg — ${procType} (${horse})`, "zabieg", {arena, horse, when, dateISO, points, procType});
  } else if (tp==="wyprowadzenie" || tp==="sprowadzenie" || tp==="rozsiodłanie"){
    t = task(title||typeLabel(tp), tp, {arena, when, dateISO, points, daily:true});
  } else if (tp==="jazda_grupowa"){
    if(!when || !groupLevel || !horse || !rider){ toastMsg("Jazda grupowa: data, godzina, poziom, koń, jeździec"); return; }
    t = task(title||`Jazda Grupowa — ${groupLevel}`, "jazda_grupowa", {arena, horse, rider, when, dateISO, points:0, groupLevel});
    await createPrepPrompt(t);
  } else if (tp==="jazda_indywidualna"){
    if(!when || !indivLevel || !horse || !rider){ toastMsg("Jazda indywidualna: data, godzina, poziom, koń, jeździec"); return; }
    t = task(title||`Jazda Indywidualna — ${indivLevel}`, "jazda_indywidualna", {arena, horse, rider, when, dateISO, points:0, indivLevel});
    await createPrepPrompt(t);
  } else { toastMsg("Nieobsługiwany typ"); return; }

  state.tasks.unshift(t);
  persistAll();
  $("#i-title").value = ""; $("#i-place").value = ""; $("#i-points").value = 2; if($("#i-when")) $("#i-when").value = "";
  renderAll(); toastMsg("Dodano zadanie");
}
function createPrepPrompt(rideTask){
  return new Promise(async (resolve)=>{
    const ok = await confirmInApp(`Dodano ${typeLabel(rideTask.type)} (${isoToPL(rideTask.dateISO)} ${rideTask.when}).\nCzy zlecić osiodłanie konia wolontariuszowi?`, {title:"Zlecić Przygotowanie do Jazdy?", ok:"Zleć", cancel:"Pomiń"});
    if (ok){
      const prep = task(`Przygotowanie — ${rideTask.horse} dla ${rideTask.rider}`, "prep", {
        arena: rideTask.arena, horse: rideTask.horse, rider: rideTask.rider,
        when: rideTask.when, dateISO: rideTask.dateISO, points:2
      });
      state.tasks.unshift(prep);
      persistAll();
      toastMsg("Dodano zadanie: Przygotowanie do Jazdy");
    }
    resolve(true);
  });
}

function renderInstructor(){
  const items = state.tasks.filter(t => t.daily || ["porządki","wyprowadzenie","sprowadzenie"].includes(t.type));
  const other = state.tasks.filter(t => !(t.daily || ["porządki","wyprowadzenie","sprowadzenie"].includes(t.type)));
  const list = $("#i-list");
  if(!list) return;
  list.className = "list";
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
  ${t.status==="to_review" ? `<button class="btn small approve" data-id="${t.id}">Zatwierdź</button>
                              <button class="btn small ghost reject" data-id="${t.id}">Odrzuć</button>` : ``}
  ${t.status==="open" ? assignVolunteerUI(t.id) : ``}
  <button class="btn small ghost nudge" data-id="${t.id}">Przypomnij</button>
  <button class="btn small ghost delete" data-id="${t.id}">Usuń zadanie</button>
`;

  return `
  <article class="card ${classByStatus(t.status)} ${ride?'ride':''} ${future?'future':''}" data-id="${t.id}">
    <div class="title"><h3>${escapeHTML(t.title)}</h3></div>
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
function uniqueRiderNames(){
  return Array.from(new Set(state.riders.map(r=>`${r.first} ${r.last}`)));
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
  t.assignedTo = val; t.status = "taken"; persistAll(); renderAll();
}
function onNudge(e){
  const id = e.currentTarget.dataset.id; const t=state.tasks.find(x=>x.id===id); if(!t) return;
  t.nudged = true; persistAll(); toastMsg("Wysłano przypomnienie (demo)"); renderAll();
}
function onDeleteTask(e){
  const id = e.currentTarget.dataset.id;
  if(!confirm("Usunąć to zadanie?")) return;
  state.tasks = state.tasks.filter(x=>x.id!==id);
  persistAll(); renderAll();
}
function onApprove(e){
  const id = e.currentTarget.dataset.id; const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.status="approved"; persistAll(); renderAll();
}
function onReject(e){
  const id = e.currentTarget.dataset.id; const t = state.tasks.find(x=>x.id===id); if(!t) return;
  t.status="rejected"; persistAll(); renderAll();
}

/* VOLUNTEER */
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
  if(!list) return;
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
    <div class="title"><h3>${escapeHTML(t.title)}</h3></div>
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
  t.status = "taken";
  t.assignedTo = me;
  persistAll();

  if (state.settings.demoAutoApprove){
    t.status = "approved";
    persistAll();
  }

  renderAll();
}

function markDone(t){
  if(t.status!=="taken"){ alert("To zadanie nie jest w trakcie."); return; }
  t.status = "to_review";
  persistAll();

  if (state.settings.demoAutoApprove){
    t.status = "approved";
    persistAll();
  }

  renderAll();
}

/* ---------- REPORTS ---------- */
function renderReports(){
  const list = $("#r-list"); if(!list) return;

  let from = state.ui.r.from || todayISO();
  let to   = state.ui.r.to   || todayISO();
  const statusFilter = state.ui.r.status;

  const span = (d)=> new Date(d).getTime();
  const items = state.tasks.filter(t=>{
    const inRange = span(t.dateISO) >= span(from) && span(t.dateISO) <= span(to);
    const stOk = !statusFilter || t.status===statusFilter;
    return inRange && stOk;
  });

  setCounts("r", items);

  list.className = "list";
  list.innerHTML = items.map(t=>`
    <article class="card ${classByStatus(t.status)} ${isFutureISO(t.dateISO)?'future':''}">
      <div class="title"><h3>${escapeHTML(t.title)}</h3></div>
      <div class="badges">
        <span class="badge-tag ${["jazda_grupowa","jazda_indywidualna"].includes(t.type)?'badge-ride':''} ${t.daily?'badge-daily':''}">
          ${escapeHTML(typeLabel(t.type))}
        </span>
        ${statusBadgeHTML(t.status)}
      </div>
      <div class="meta">
        ${escapeHTML([isoToPL(t.dateISO), t.when?`godz. ${t.when}`:"", t.horse?`koń: ${t.horse}`:"", t.rider?`jeździec: ${t.rider}`:""].filter(Boolean).join(" • "))}
      </div>
    </article>
  `).join("");
}

/* ---------- ADMIN ---------- */
function initAdmin(){
  const aInstr = $("#a-instructor");
  if (aInstr){
    aInstr.innerHTML = state.instructors
      .map(i=>`<option value="${i.id}">${escapeHTML(i.label)}</option>`).join("");
  }

  $("#a-addRider")?.addEventListener("click", adminAddRider);

  $("#a-day").value = state.ui.a.day;
  const aDate = $("#a-date");
  if (aDate && !aDate.value) aDate.value = state.ui.a.day || todayISO();

  $("#a-day").addEventListener("change", ()=>{
    state.ui.a.day = $("#a-day").value || todayISO();
    save(LS.UI, state.ui);
    renderAdmin();
  });

  $("#a-refresh")?.addEventListener("click", ()=>{
    state.ui.a.day = $("#a-day").value || todayISO();
    save(LS.UI, state.ui);
    renderAdmin();
  });

  $("#a-print").addEventListener("click", ()=>window.print());

  $("#a-addHorse")?.addEventListener("click", ()=>{
    const name = ($("#a-horseName")?.value || "").trim();
    if(!name){ toastMsg("Podaj nazwę konia"); return; }
    const exists = state.horses.some(h=>h.name.toLowerCase()===name.toLowerCase());
    if(exists){ toastMsg("Koń już istnieje"); return; }
    state.horses.push({name, label:`koń ${name}`});
    save(LS.HORSES, state.horses);
    toastMsg("Dodano konia");
    $("#a-horseName").value = "";
    renderDynamicFields();
    renderAdmin();
  });
}

function adminAddRider(){
  const first = ($("#a-first")?.value || "").trim();
  const last  = ($("#a-last")?.value  || "").trim();
  const tel   = ($("#a-phone")?.value || "").trim();
  const email = ($("#a-email")?.value || "").trim();
  const rideType = $("#a-rideType")?.value || "jazda_grupowa";
  const level    = $("#a-level")?.value || "kłus";
  const dateISO  = ($("#a-date")?.value || state.ui.a.day || todayISO());
  const when     = ($("#a-when")?.value || "");
  const instructorId = $("#a-instructor")?.value || (state.instructors[0]?.id || null);

  if(!first || !last){ toastMsg("Podaj imię i nazwisko jeźdźca"); return; }
  if(!when){ toastMsg("Podaj godzinę jazdy"); return; }

  const r = {
    id: uid(), first, last, tel, email, level,
    dateISO, when, instructorId, horse: null
  };
  state.riders.push(r);
  save(LS.RIDERS, state.riders);

  toastMsg("Zapisano na jazdę");
  $("#a-first").value=""; $("#a-last").value="";
  $("#a-phone").value=""; $("#a-email").value="";

  renderAdmin();
  renderDynamicFields();
}

function renderAdmin(){
  // etykieta dnia
  const dayISO = state.ui.a.day || todayISO();
  const label = `Planowanie — ${isoToPL(dayISO)} (${weekdayPL(dayISO)})`;
  $("#adminTodayLabel").textContent = label;

  // grupujemy zapisy (riders) po godzinach
  const ridersForDay = state.riders
    .filter(r => r.dateISO === dayISO)
    .sort((a,b)=> (a.when||"").localeCompare(b.when||""));

  const byTime = new Map();
  ridersForDay.forEach(r=>{
    if(!byTime.has(r.when)) byTime.set(r.when, []);
    byTime.get(r.when).push(r);
  });

  const grid = $("#scheduleGrid"); if(!grid) return;
  grid.innerHTML = "";
  [...byTime.keys()].sort().forEach(time=>{
    const items = byTime.get(time);
    const row = document.createElement("div");
    row.className = "sched-row";

    const timeEl = document.createElement("div");
    timeEl.className = "sched-time";
    timeEl.textContent = time;
    row.appendChild(timeEl);

    items.forEach(r=>{
      const instr = state.instructors.find(i=>i.id===r.instructorId);
      const slot = document.createElement("div");
      slot.className = "sched-slot";
      slot.innerHTML = `
        <h4>${escapeHTML(r.first)} ${escapeHTML(r.last)} <small>(${escapeHTML(r.level)})</small></h4>
        <div class="line">Instruktor: <strong>${escapeHTML(instr?instr.label:"—")}</strong></div>
        <div class="line">Koń: <strong>${escapeHTML(r.horse||"—")}</strong></div>
      `;
      row.appendChild(slot);
    });

    grid.appendChild(row);
  });

  $("#schedTitle").textContent = "Grafik dnia";
}

/* ---------- Common UI bits ---------- */
function statusBadgeHTML(st){
  const map = {open:"badge-open",taken:"badge-taken",to_review:"badge-review",approved:"badge-approved",rejected:"badge-review"};
  const txt = {open:"Wolne",taken:"W trakcie",to_review:"Do weryf.",approved:"Zatwierdzone",rejected:"Odrzucone"};
  return `<span class="badge-tag ${map[st]||""}">${txt[st]||st}</span>`;
}
function classByStatus(st){ return st==="to_review" ? "to_review" : (st||"open"); }
function typeLabel(t){
  const map = {
    "porządki":"Prace porządkowe",
    "wyprowadzenie":"Wyprowadzenie Stada",
    "sprowadzenie":"Sprowadzenie Stada",
    "rozsiodłanie":"Rozsiodłanie",
    "prep":"Przygotowanie do Jazdy",
    "zabieg":"Zabieg",
    "dziennikarz":"Dziennikarz/Kronikarz",
    "luzak":"Luzak",
    "jazda_grupowa":"Jazda Grupowa",
    "jazda_indywidualna":"Jazda Indywidualna"
  };
  return map[t] || t;
}
function openTaskModal(t){
  const modal = $("#modal"); if(!modal) return;
  $("#modalTitle").textContent = t.title;
  $("#modalBody").innerHTML = `
    <p><strong>Typ:</strong> ${escapeHTML(typeLabel(t.type))}</p>
    <p><strong>Data:</strong> ${escapeHTML(isoToPL(t.dateISO))} ${t.when?("godz. "+escapeHTML(t.when)):""}</p>
    <p><strong>Koń:</strong> ${escapeHTML(t.horse||"—")}</p>
    <p><strong>Jeździec:</strong> ${escapeHTML(t.rider||"—")}</p>
    <p><strong>Arena:</strong> ${escapeHTML(t.arena||"—")}</p>
    <p><strong>Status:</strong> ${escapeHTML(t.status)}</p>
  `;
  $("#modalFoot").innerHTML = `<button id="closeModal" class="iconbtn" aria-label="Zamknij">Zamknij</button>`;
  modal.classList.remove("hidden");
  $("#closeModal").addEventListener("click", ()=> modal.classList.add("hidden"));
  modal.addEventListener("click", (e)=>{ if(e.target===modal) modal.classList.add("hidden"); });
}
function confirmInApp(message, opts={}){
  const c = $("#confirm"); if(!c) return Promise.resolve(false);
  $("#confirmBody").textContent = message;
  $("#confirmTitle").textContent = opts.title || "Potwierdź";
  const okBtn = $("#confirmOk");
  const cancelBtn = $("#confirmCancel");
  c.classList.remove("hidden");
  return new Promise(res=>{
    const done=(v)=>{ c.classList.add("hidden"); okBtn.onclick=null; cancelBtn.onclick=null; res(v); };
    okBtn.textContent = opts.ok || "Tak";
    cancelBtn.textContent = opts.cancel || "Nie";
    okBtn.onclick = ()=> done(true);
    cancelBtn.onclick = ()=> done(false);
    c.addEventListener("click",(e)=>{ if(e.target===c) done(false); }, {once:true});
  });
}
function persistAll(){
  save(LS.USER, state.volunteer);
  save(LS.TASKS, state.tasks);
  save(LS.SETTINGS, state.settings);
  save(LS.HORSES, state.horses);
  save(LS.RIDERS, state.riders);
  save(LS.INSTRUCTORS, state.instructors);
  save(LS.UI, state.ui);
}

function setChipActive(prefix, key){
  const ids = { v:["All","Open","Taken","Review","Approved"], r:["view-cards","view-list"] };
  // tylko dla wolontariusza używamy chips
  $$("#tab-volunteer .chip").forEach(el=>el.classList.remove("chip-active"));
  $("#v-chip"+(key[0].toUpperCase()+key.slice(1)))?.classList.add("chip-active");
}
function setCounts(prefix, items){
  if(prefix==="v"){
    $("#v-countAll").textContent = String(items.length);
    $("#v-countOpen").textContent = String(items.filter(t=>t.status==="open").length);
    $("#v-countTaken").textContent = String(items.filter(t=>t.status==="taken").length);
    $("#v-countReview").textContent = String(items.filter(t=>t.status==="to_review").length);
    $("#v-countApproved").textContent = String(items.filter(t=>t.status==="approved").length);
  }
}

function horseshoesHTML(n){
  const total = 4;
  const fill = Math.max(0, Math.min(total, n));
  return Array.from({length:total}).map((_,i)=>`<span class="hs ${i<fill?'fill':''}"></span>`).join("");
}

/* CSV + resety (demo) */
function exportCSV(){
  const me = (state.volunteer.name||"").trim();
  const mine = state.tasks.filter(t=>t.assignedTo===me);
  const head = ["id","data","godzina","tytul","typ","kon","arena","status","punkty"];
  const rows = mine.map(t=>[
    t.id, t.dateISO, t.when||"", t.title, t.type, t.horse||"", t.arena||"", t.status, t.points
  ].map(csvEscape).join(","));
  download(`equiflow_${me||"vol"}_${todayISO()}.csv`, [head.join(","), ...rows].join("\n"), "text/csv");
}
function resetAll(){
  localStorage.removeItem(LS.TASKS);
  state.tasks = seedNow();
  persistAll(); renderAll();
  toastMsg("Zresetowano dane do domyślnych");
}
function hardReset(){
  Object.values(LS).forEach(k=>localStorage.removeItem(k));
  location.reload();
}

/* ---------- END ---------- */
