/* EquiFlow v1.5 — pełny skrypt (app-v1_5.js)
   - Dymki przy dodawaniu
   - Poprawka dodawania "Przygotowanie" po dodaniu jazdy
   - Instruktor: lista + compact
   - Admin: zapis na jazdę + grafik dnia
*/

/* =================== Storage keys =================== */
const LS = {
  TASKS: "equiflow_tasks_v1",
  USER: "equiflow_user_v1",
  SETTINGS: "equiflow_settings_v1",
  HORSES: "equiflow_horses_v2",
  RIDERS: "equiflow_riders_v2",
  INSTRUCTORS: "equiflow_instructors_v1",
  UI: "equiflow_ui_v1"
};

/* =================== Shorthands =================== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* =================== Helpers =================== */
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
function escapeHTML(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
function addDays(iso,days){ const d=new Date(iso); d.setDate(d.getDate()+days); const z=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }

/* Mały dymek przy przycisku (sam znika) */
function flash(anchorSelector, text){
  const anchor = typeof anchorSelector==="string" ? $(anchorSelector) : anchorSelector;
  if(!anchor){ toastMsg(text); return; }
  const tip = document.createElement("div");
  tip.textContent = text;
  tip.style.position = "absolute";
  tip.style.zIndex = "999";
  tip.style.padding = "6px 10px";
  tip.style.background = "#111827";
  tip.style.color = "#fff";
  tip.style.borderRadius = "10px";
  tip.style.fontSize = ".9rem";
  tip.style.boxShadow = "0 8px 20px rgba(0,0,0,.15)";
  tip.style.opacity = "0";
  tip.style.transform = "translateY(-6px)";
  document.body.appendChild(tip);
  const r = anchor.getBoundingClientRect();
  tip.style.left = (r.left + window.scrollX) + "px";
  tip.style.top  = (r.top + window.scrollY - 38) + "px";
  requestAnimationFrame(()=>{
    tip.style.transition = "opacity .18s ease, transform .18s ease";
    tip.style.opacity = "1";
    tip.style.transform = "translateY(-12px)";
  });
  setTimeout(()=>{
    tip.style.opacity = "0";
    tip.style.transform = "translateY(-6px)";
    setTimeout(()=> tip.remove(), 200);
  }, 1500);
}

/* =================== Seeds =================== */
const seedHorseNames = ["Itaka","Basia","Nicpoń","Jurek","Prada","Emocja","Apollo","Mokka","Iskra","Orion","Luna","Tango","Sahara","Hermes","Bella"];
const seedHorses = seedHorseNames.map(n=>({name:n,label:`koń ${n}` }));

const seedInstructors = [
  {first:"Anna", gender:"F"},
  {first:"Katarzyna", gender:"F"},
  {first:"Ewa", gender:"F"},
  {first:"Piotr", gender:"M"},
  {first:"Marek", gender:"M"}
].map(p=>({...p, id:uid(), label:(p.gender==="F"?"pani ":"pan ")+p.first}));

const levels = ["kłus","kłus-galop","obóz","teren","lonża"];
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
    horse: seedHorses[i % seedHorses.length].name
  }));
})();

/* =================== Data model =================== */
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
  task("Prace porządkowe — stajnia", "porządki", {points:2, daily:true, dateISO:todayISO()}),
  task("Wyprowadzenie Stada", "wyprowadzenie", {points:1, daily:true, dateISO:todayISO()}),
  task("Sprowadzenie Stada", "sprowadzenie", {points:1, daily:true, dateISO:todayISO()}),
  task("Dziennikarz/Kronikarz — dokumentuj dzień", "dziennikarz", {points:2, dateISO:todayISO()}),
];

/* =================== State =================== */
let state;

/* =================== Bootstrap =================== */
document.addEventListener("DOMContentLoaded", () => {
  state = {
    volunteer: load(LS.USER) || { name: "" },
    tasks: load(LS.TASKS) || seedTasks.slice(),
    settings: load(LS.SETTINGS) || { demoAutoApprove: false },
    horses: load(LS.HORSES) || seedHorses,
    riders: load(LS.RIDERS) || seedRiders,
    instructors: load(LS.INSTRUCTORS) || seedInstructors,
    ui: (() => {
      const today = todayISO();
      const ui = load(LS.UI);
      if (ui) {
        return {
          ...ui,
          a: { ...(ui.a || {}), day: today },
          v: { ...(ui.v||{}), view: "list" },
          i: { ...(ui.i||{}), view: "list" },
          r: { ...(ui.r||{}), view: "list", from: ui.r?.from || today, to: ui.r?.to || today }
        };
      }
      return {
        tab: "admin",
        v: { status:"all", onlyMine:false, type:"", view:"list", search:"" },
        i: { view:"list" },
        r: { view:"list", from: today, to: today, group:"none", status:"" },
        a: { day: today }
      };
    })()
  };

  ensureDailyTasksForToday();
  state.ui.tab = state.ui.tab || "admin";
  save(LS.UI, state.ui);

  /* --------- Tabs --------- */
  $("#tabsNav").addEventListener("click",(e)=>{
    const btn = e.target.closest(".tab"); if(!btn) return;
    switchTab(btn.dataset.tab); renderAll();
  });

  /* --------- Profile --------- */
  $("#volunteerName").value = state.volunteer.name || "";
  $("#saveUser").addEventListener("click", ()=>{
    state.volunteer.name = $("#volunteerName").value.trim();
    save(LS.USER, state.volunteer);
    toastMsg("Zapisano profil");
    renderAll();
  });

  /* --------- Demo switch --------- */
  const demoChk = $("#demoAutoApprove");
  if (demoChk){
    demoChk.checked = !!state.settings.demoAutoApprove;
    demoChk.addEventListener("change", ()=>{ state.settings.demoAutoApprove = demoChk.checked; save(LS.SETTINGS, state.settings); });
  }

  /* --------- INSTRUKTOR --------- */
  $("#i-view-cards")?.addEventListener("click", ()=>{ state.ui.i.view="list"; setViewActive("i","list"); renderInstructor(); });
  $("#i-view-list")?.addEventListener("click", ()=>{ state.ui.i.view="list"; setViewActive("i","list"); renderInstructor(); });
  $("#i-taskType").addEventListener("change", renderDynamicFields);
  renderDynamicFields();
  $("#i-add").addEventListener("click", addInstructorTask);
  $("#i-createDefaults").addEventListener("click", ()=>{
    const now = todayISO();
    const set = [
      task("Prace porządkowe — stajnia", "porządki", {points:2, daily:true, dateISO:now}),
      task("Wyprowadzenie Stada", "wyprowadzenie", {points:1, daily:true, dateISO:now}),
      task("Sprowadzenie Stada", "sprowadzenie", {points:1, daily:true, dateISO:now}),
    ];
    state.tasks = set.concat(state.tasks);
    persistAll(); renderAll(); flash("#i-createDefaults","Dodano zestaw");
  });

  /* --------- WOLONTARIUSZ --------- */
  bindVolunteerUI();

  /* --------- RAPORTY --------- */
  bindReportsUI();

  /* --------- ADMIN --------- */
  initAdmin();

  /* --------- Start --------- */
    // Jeśli w URL jest #kotwica, aktywuj odpowiednią zakładkę i przewiń
  const hash = (location.hash || "").toLowerCase();
  const hashToTab = {
    "#adminTop":"admin", "#a-form":"admin", "#a-schedule":"admin",
    "#instructorTop":"instructor", "#i-form":"instructor", "#i-list":"instructor",
    "#volunteerTop":"volunteer", "#v-filters":"volunteer", "#v-list":"volunteer",
    "#reportsTop":"reports", "#r-filters":"reports", "#r-list":"reports"
  };
  if (hash && hashToTab[hash]){
    switchTab(hashToTab[hash]);
    document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    switchTab(state.ui.tab);
  }
  renderAll();
});

/* =================== Daily tasks guard =================== */
function seedNow(){
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

/* =================== Views switch =================== */
function switchTab(key){
  state.ui.tab = key;

  // UI: przełącz przyciski
  $$(".tab").forEach(b=>b.classList.toggle("tab-active", b.dataset.tab===key));

  // UI: pokaż/ukryj sekcje
  $("#tab-instructor").classList.toggle("hidden", key!=="instructor");
  $("#tab-volunteer").classList.toggle("hidden", key!=="volunteer");
  $("#tab-reports").classList.toggle("hidden", key!=="reports");
  $("#tab-admin").classList.toggle("hidden", key!=="admin");

  // zapisz UI
  save(LS.UI, state.ui);

  // NOWE: skocz do nagłówka aktywnej sekcji (kotwica)
  const anchors = {
    admin: "#adminTop",
    instructor: "#instructorTop",
    volunteer: "#volunteerTop",
    reports: "#reportsTop"
  };
  const sel = anchors[key];
  if (sel){
    document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* =================== Renders (global) =================== */
function renderAll(){
  renderInstructor();
  renderVolunteer();
  renderReports();
  renderAdmin();
  save(LS.UI, state.ui);
}

/* =================== INSTRUCTOR =================== */
function renderDynamicFields(){
  const c = $("#i-dynamicFields"); if(!c) return;
  c.innerHTML = "";
  const type = $("#i-taskType").value;

  if(!state.horses || !state.horses.length) state.horses = seedHorses.slice();
  if(!state.riders || !state.riders.length) state.riders = seedRiders.slice();

  const date = inputDate("Data", "i-date", todayISO());
  const time = inputTime("Godzina", "i-when");
  const horse = inputSelect("Koń", "i-horse", ["— koń —"].concat(state.horses.map(h=>h.name)));
  const rider = inputSelect("Jeździec", "i-rider", ["— jeździec —"].concat(uniqueRiderNames()));
  const levelGroup = inputSelect("Poziom (grupa)", "i-level-group", ["kłus", "kłus-galop", "obóz", "teren"]);
  const levelIndiv = inputSelect("Poziom (indywidualna)", "i-level-indiv", ["lonża", "kłus", "kłus-galop"]);

  if (type==="prep"){ append(c, date, time, horse, rider); }
  else if (type==="zabieg"){
    const proc = inputSelect("Typ zabiegu","i-proc",["Masaż","Derka magnetyczna","Kopyta — pielęgnacja","Kąpiel","Stretching"]);
    append(c, date, horse, proc);
  }
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
    state.tasks.unshift(t);
    persistAll();
    await createPrepPrompt(t);
  } else if (tp==="jazda_indywidualna"){
    if(!when || !indivLevel || !horse || !rider){ toastMsg("Jazda indywidualna: data, godzina, poziom, koń, jeździec"); return; }
    t = task(title||`Jazda Indywidualna — ${indivLevel}`, "jazda_indywidualna", {arena, horse, rider, when, dateISO, points:0, indivLevel});
    state.tasks.unshift(t);
    persistAll();
    await createPrepPrompt(t);
  } else { toastMsg("Nieobsługiwany typ"); return; }

  if (tp!=="jazda_grupowa" && tp!=="jazda_indywidualna"){
    state.tasks.unshift(t);
    persistAll();
  }

  $("#i-title").value = ""; $("#i-place").value = ""; $("#i-points").value = 2; if($("#i-when")) $("#i-when").value = "";
  renderAll();
  flash("#i-add","Dodano zadanie");
}

function createPrepPrompt(rideTask){
  return new Promise(async (resolve)=>{
    const ok = await confirmInApp(
      `Dodano ${typeLabel(rideTask.type)} (${isoToPL(rideTask.dateISO)} ${rideTask.when}).\nCzy zlecić osiodłanie konia wolontariuszowi?`,
      {title:"Zlecić Przygotowanie do Jazdy?", ok:"Zleć", cancel:"Pomiń"}
    );
    if (ok){
      const prep = task(`Przygotowanie — ${rideTask.horse} dla ${rideTask.rider}`, "prep", {
        arena: rideTask.arena, horse: rideTask.horse, rider: rideTask.rider,
        when: rideTask.when, dateISO: rideTask.dateISO, points:2
      });
      state.tasks.unshift(prep);
      persistAll();
      flash("#i-add","Dodano: Przygotowanie");
    }
    renderInstructor();
    resolve(true);
  });
}

function renderInstructor(){
  const list = $("#i-list");
  if(!list) return;

  list.className = "list";

  const items = state.tasks.filter(t => t.daily || ["porządki","wyprowadzenie","sprowadzenie"].includes(t.type));
  const other = state.tasks.filter(t => !(t.daily || ["porządki","wyprowadzenie","sprowadzenie"].includes(t.type)));
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
    <button class="btn small ghost nudge" data-id="${t.id}" title="Wyślij przypomnienie">Przypomnij</button>
    <button class="btn small ghost delete" data-id="${t.id}">Usuń zadanie</button>
  `;

  return `
  <article class="card ${classByStatus(t.status)} ${ride?'ride':''} ${future?'future':''}" data-id="${t.id}">
    <div class="title"><h3>${escapeHTML(t.title)}</h3></div>
    <div class="badges">${badges}</div>
    <div class="meta">${escapeHTML(meta)}</div>
    ${t.comments ? `<div class="meta">Uwagi: ${escapeHTML(t.comments)}</div>` : ""}
    <div class="kit">
      <button class="btn small openModal" data-id="${t.id}">Podgląd</button>
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
    <button class="btn small assign" data-id="${id}">OK</button>
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

/* =================== VOLUNTEER =================== */
function bindVolunteerUI(){
  $("#v-chipAll").addEventListener("click", ()=>{ state.ui.v.status="all"; setChipActive("v","all"); renderVolunteer(); });
  $("#v-chipOpen").addEventListener("click", ()=>{ state.ui.v.status="open"; setChipActive("v","open"); renderVolunteer(); });
  $("#v-chipTaken").addEventListener("click", ()=>{ state.ui.v.status="taken"; setChipActive("v","taken"); renderVolunteer(); });
  $("#v-chipReview").addEventListener("click", ()=>{ state.ui.v.status="to_review"; setChipActive("v","review"); renderVolunteer(); });
  $("#v-chipApproved").addEventListener("click", ()=>{ state.ui.v.status="approved"; setChipActive("v","approved"); renderVolunteer(); });
  $("#v-chipMine").addEventListener("click", ()=>{ state.ui.v.onlyMine = !state.ui.v.onlyMine; $("#v-chipMine").classList.toggle("chip-active", state.ui.v.onlyMine); renderVolunteer(); });
  $("#v-search").addEventListener("input", ()=>{ state.ui.v.search = $("#v-search").value; renderVolunteer(); });
  $("#v-type").addEventListener("change", ()=>{ state.ui.v.type = $("#v-type").value; renderVolunteer(); });
  $("#v-view-cards")?.addEventListener("click", ()=>{ state.ui.v.view="list"; setViewActive("v","list"); renderVolunteer(); });
  $("#v-view-list")?.addEventListener("click", ()=>{ state.ui.v.view="list"; setViewActive("v","list"); renderVolunteer(); });
  $("#pointsHistory").addEventListener("click", openPointsHistory);
  $("#exportCsv").addEventListener("click", exportCSV);
  $("#resetData").addEventListener("click", ()=>{ if(confirm("Zresetować do domyślnych?")){ resetAll(); }});
  $("#hardReset").addEventListener("click", ()=>{ if(confirm("Twardy reset?")){ hardReset(); }});
}
function setChipActive(prefix, which){
  const ids = { v:{all:"#v-chipAll", open:"#v-chipOpen", taken:"#v-chipTaken", review:"#v-chipReview", approved:"#v-chipApproved"} };
  for(const k in ids[prefix]) $(ids[prefix][k])?.classList.toggle("chip-active", k===which);
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
      <button class="btn small more">Szczegóły</button>
      ${quickButtonsVolunteer(t)}
    </div>
  </article>`;
}
function quickButtonsVolunteer(t){
  const me = (state.volunteer.name||"").trim();
  if (t.status === "open") return `<button class="btn small take" data-id="${t.id}">Weź</button>`;
  if (t.assignedTo === me && t.status === "taken") return `<button class="btn small done" data-id="${t.id}">Zgłoś Wykonanie</button>`;
  return `<span class="meta"></span>`;
}
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
  list.className = "list";
  list.innerHTML = items.map(cardHTMLVolunteer).join("");
  list.querySelectorAll(".more").forEach(b=>b.addEventListener("click", onOpenTask));
  list.querySelectorAll(".take").forEach(b=>b.addEventListener("click", onQuickTake));
  list.querySelectorAll(".done").forEach(b=>b.addEventListener("click", onQuickDone));
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
function openPointsHistory(){ alert("Demo: historia punktów w przygotowaniu."); }

/* =================== REPORTS =================== */
function bindReportsUI(){
  $("#r-from").value = state.ui.r.from || todayISO();
  $("#r-to").value = state.ui.r.to || todayISO();
  $("#r-group").value = state.ui.r.group;
  $("#r-status").value = state.ui.r.status;
  $("#r-from").addEventListener("change", ()=>{ state.ui.r.from=$("#r-from").value; renderReports(); save(LS.UI,state.ui); });
  $("#r-to").addEventListener("change", ()=>{ state.ui.r.to=$("#r-to").value; renderReports(); save(LS.UI,state.ui); });
  $("#r-group").addEventListener("change", ()=>{ state.ui.r.group=$("#r-group").value; renderReports(); save(LS.UI,state.ui); });
  $("#r-status").addEventListener("change", ()=>{ state.ui.r.status=$("#r-status").value; renderReports(); save(LS.UI,state.ui); });
  $("#r-view-cards")?.addEventListener("click", ()=>{ state.ui.r.view="list"; setViewActive("r","list"); renderReports(); save(LS.UI,state.ui); });
  $("#r-view-list")?.addEventListener("click", ()=>{ state.ui.r.view="list"; setViewActive("r","list"); renderReports(); save(LS.UI,state.ui); });
}

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
  <article class="card ${classByStatus(t.status)}">
    <div class="title"><h3>${escapeHTML(t.title)}</h3></div>
    <div class="badges">
      <span class="badge-tag">${escapeHTML(typeLabel(t.type))}</span>
      ${statusBadgeHTML(t.status)}
    </div>
    <div class="meta">${escapeHTML(isoToPL(t.dateISO))} ${t.when?("• "+t.when):""}</div>
  </article>
`).join("");
}

/* =================== ADMIN =================== */
function initAdmin(){
  // Ustaw dzisiejszą datę
  const day = todayISO();
  $("#a-day").value = state.ui.a?.day || day;
  $("#a-date").value = day;
  $("#adminTodayLabel").textContent = `Planowanie — ${isoToPL($("#a-day").value)}`;

  // Selecty konie/instruktorzy
  refreshAdminSelects();

  // Bindy
  $("#a-day").addEventListener("change", ()=>{
    state.ui.a.day = $("#a-day").value || todayISO();
    $("#adminTodayLabel").textContent = `Planowanie — ${isoToPL(state.ui.a.day)}`;
    renderAdmin();
    save(LS.UI, state.ui);
  });
  $("#a-addRider").addEventListener("click", onAdminAddRider);
  $("#a-generate").addEventListener("click", ()=>{ renderAdmin(true); flash("#a-generate","Zbudowano grafik"); });
  $("#a-refresh").addEventListener("click", ()=>{ renderAdmin(); flash("#a-refresh","Odświeżono"); });
  $("#a-print").addEventListener("click", ()=>{ window.print(); });
}
function refreshAdminSelects(){
  const horseSel = $("#a-horse"); const instrSel=$("#a-instructor");
  horseSel.innerHTML = state.horses.map(h=>`<option value="${escapeHTML(h.name)}">${escapeHTML(h.name)}</option>`).join("");
  instrSel.innerHTML = state.instructors.map(i=>`<option value="${escapeHTML(i.id)}">${escapeHTML(i.label)}</option>`).join("");
}
function onAdminAddRider(){
  const first = $("#a-first").value.trim();
  const last  = $("#a-last").value.trim();
  const phone = $("#a-phone").value.trim();
  const email = $("#a-email").value.trim();
  const rideType = $("#a-rideType").value;
  const level = $("#a-level").value;
  const horse = $("#a-horse").value;
  const dateISO = $("#a-date").value || todayISO();
  const when = $("#a-when").value;
  const instructorId = $("#a-instructor").value;

  if(!first || !last || !when || !dateISO){ alert("Uzupełnij: imię, nazwisko, datę i godzinę."); return; }

  const rider = { id:uid(), first, last, tel:phone, email, level, dateISO, when, instructorId, horse };
  state.riders.push(rider);

  // Dodaj zadanie jazdy (dla widoku instruktora)
  let t;
  if(rideType==="jazda_grupowa"){
    t = task(`Jazda Grupowa — ${level}`, "jazda_grupowa", {horse, rider:`${first} ${last}`, when, dateISO, points:0, groupLevel:level});
  }else{
    t = task(`Jazda Indywidualna — ${level}`, "jazda_indywidualna", {horse, rider:`${first} ${last}`, when, dateISO, points:0, indivLevel:level});
  }
  state.tasks.unshift(t);
  persistAll();
  renderAll();
  flash("#a-addRider","Dodano zapis");
}
function renderAdmin(buildScheduleOnly=false){
  refreshAdminSelects();

  // Grafik dnia na podstawie riderów z wybranego dnia
  const day = $("#a-day").value || todayISO();
  const riders = state.riders.filter(r=>r.dateISO===day);

  const byTime = {};
  riders.forEach(r=>{
    byTime[r.when] = byTime[r.when] || [];
    byTime[r.when].push(r);
  });

  const times = Object.keys(byTime).sort();
  const instructors = state.instructors.slice();

  const grid = $("#scheduleGrid");
  const title = $("#schedTitle");
  title.textContent = `Grafik dnia — ${isoToPL(day)}`;
  grid.innerHTML = "";

  // Header row
  const header = document.createElement("div");
  header.className = "sched-row header";
  header.appendChild(el("div","sched-time","Godzina"));
  instructors.forEach(i=> header.appendChild(el("div","sched-slot", i.label)));
  grid.appendChild(header);

  // Rows
  times.forEach(tm=>{
    const row = document.createElement("div");
    row.className = "sched-row";
    row.appendChild(el("div","sched-time", tm));

    instructors.forEach(i=>{
      const slot = document.createElement("div");
      slot.className = "sched-slot";
      const rs = byTime[tm].filter(r=>r.instructorId===i.id);
      if(rs.length===0){
        slot.innerHTML = `<div class="rider muted">—</div>`;
      }else{
        slot.innerHTML = rs.map(r=>`<div class="rider">${escapeHTML(r.first)} ${escapeHTML(r.last)} • ${escapeHTML(r.horse||"—")} • ${escapeHTML(r.level)}</div>`).join("");
      }
      row.appendChild(slot);
    });

    grid.appendChild(row);
  });
}
function el(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }

/* =================== Modal / Confirm =================== */
function openTaskModal(t){
  const m = $("#modal"); const body=$("#modalBody"); const foot=$("#modalFoot"); const title=$("#modalTitle");
  title.textContent = t.title;
  body.innerHTML = `
    <p><strong>Data:</strong> ${escapeHTML(isoToPL(t.dateISO))} ${t.when?("• "+escapeHTML(t.when)):""}</p>
    ${t.arena?`<p><strong>Miejsce:</strong> ${escapeHTML(t.arena)}</p>`:""}
    ${t.horse?`<p><strong>Koń:</strong> ${escapeHTML(t.horse)}</p>`:""}
    ${t.rider?`<p><strong>Jeździec:</strong> ${escapeHTML(t.rider)}</p>`:""}
    <p><strong>Status:</strong> ${escapeHTML(t.status)}</p>
  `;
  foot.innerHTML = `
    <button class="btn ghost" id="mClose">Zamknij</button>
  `;
  $("#mClose").addEventListener("click", ()=> m.classList.add("hidden"));
  $("#closeModal").addEventListener("click", ()=> m.classList.add("hidden"));
  m.classList.remove("hidden");
}
function confirmInApp(message, {title="Potwierdź", ok="OK", cancel="Anuluj"}={}){
  return new Promise(resolve=>{
    const m = $("#confirm");
    $("#confirmTitle").textContent = title;
    $("#confirmBody").textContent = message;
    m.classList.remove("hidden");
    const onOk = ()=>{ cleanup(); resolve(true); };
    const onCancel = ()=>{ cleanup(); resolve(false); };
    function cleanup(){
      $("#confirmOk").removeEventListener("click", onOk);
      $("#confirmCancel").removeEventListener("click", onCancel);
      m.classList.add("hidden");
    }
    $("#confirmOk").addEventListener("click", onOk);
    $("#confirmCancel").addEventListener("click", onCancel);
  });
}

/* =================== Utilities =================== */
function typeLabel(t){
  const map = {
    "porządki":"Prace porządkowe",
    "wyprowadzenie":"Wyprowadzenie Stada",
    "sprowadzenie":"Sprowadzenie Stada",
    "rozsiodłanie":"Rozsiodłanie",
    "prep":"Przygotowanie do Jazdy",
    "zabieg":"Zabieg",
    "jazda_grupowa":"Jazda Grupowa",
    "jazda_indywidualna":"Jazda Indywidualna",
    "dziennikarz":"Dziennikarz / Kronikarz",
    "lonżowanie":"Lonżowanie",
    "klinika":"Klinika",
    "luzak":"Luzak"
  };
  return map[t] || t;
}
function statusBadgeHTML(st){
  const cls = {open:"badge-open",taken:"badge-taken",to_review:"badge-review",approved:"badge-approved"}[st] || "badge-open";
  const label = {open:"Wolne",taken:"W trakcie",to_review:"Do weryf.",approved:"Zatwierdzone",rejected:"Odrzucone"}[st] || st;
  return `<span class="badge-tag ${cls}">${label}</span>`;
}
function classByStatus(st){ return st; }
function horseshoesHTML(n){
  const arr = new Array(n).fill(0).map((_,i)=>`<span class="hs ${i<2?'fill':''}"></span>`);
  return arr.join("");
}
function setCounts(prefix, items){
  const by = items.reduce((a,t)=>{ a.all++; a[t.status]=(a[t.status]||0)+1; return a; }, {all:0});
  if(prefix==="v"){
    $("#v-countAll").textContent = by.all||0;
    $("#v-countOpen").textContent = by.open||0;
    $("#v-countTaken").textContent = by.taken||0;
    $("#v-countReview").textContent = by.to_review||0;
    $("#v-countApproved").textContent = by.approved||0;
  }
}
function exportCSV(){
  const me = (state.volunteer.name||"").trim();
  const rows = [["Data","Godzina","Tytuł","Koń","Miejsce","Status","Punkty"]];
  state.tasks.filter(t=>t.assignedTo===me).forEach(t=>{
    rows.push([t.dateISO, t.when||"", t.title, t.horse||"", t.arena||"", t.status, t.points]);
  });
  const csv = rows.map(r=>r.map(csvEscape).join(",")).join("\n");
  download(`equiflow_${me||"wolontariusz"}.csv`, csv, "text/csv");
}
function resetAll(){
  state.tasks = seedNow();
  state.horses = seedHorses.slice();
  state.instructors = seedInstructors.slice();
  state.riders = seedRiders.slice();
  persistAll();
  renderAll();
}
function hardReset(){
  Object.values(LS).forEach(k=>localStorage.removeItem(k));
  location.reload();
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

/* ================ Dev marker ================ */
console.log("EquiFlow v1.5 – pełny app-v1_5.js załadowany.");
