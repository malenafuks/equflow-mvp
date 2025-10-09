/* EquiFlow v1.6.6 — clean build (single file, defensive)
   - Stabilne TABY (klik/klawiatura, bez hotfixów i bez zależności od kolejności)
   - Absolutne gardy na null/undefined (żaden błąd nie ma prawa ubić całego JS)
   - Walidacje przez validators.js + bezpieczny fallback (gdy validators jeszcze nie jest gotowy)
   - Brak duplikatów, pełny komplet handlerów
*/

(function(){
  "use strict";

  /* ===== Utils ===== */
  const LS = {
    TASKS:"equiflow_tasks_v1",
    USER:"equiflow_user_v1",
    SETTINGS:"equiflow_settings_v1",
    HORSES:"equiflow_horses_v2",
    RIDERS:"equiflow_riders_v2",
    INSTRUCTORS:"equiflow_instructors_v1",
    UI:"equiflow_ui_v1"
  };

  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
  function save(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ console.warn("save failed",k,e); } }
  function load(k){ try{ const raw = localStorage.getItem(k); return raw? JSON.parse(raw): null; }catch{ return null; } }
  function todayISO(){ const d=new Date(); const z=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
  function isoToPL(iso){ if(!iso) return "—"; const [y,m,d]=iso.split("-"); return `${d}.${m}.${y}`; }
  function isFutureISO(iso){ try{ return new Date(iso) > new Date(todayISO()); }catch{ return false; } }
  function csvEscape(val){ const s=String(val??""); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
  function download(name, data, mime="text/plain"){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([data],{type:mime})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  function clamp(n,min=0,max=4){ return Math.max(min, Math.min(max, n)); }
  function escapeHTML(s){ return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
  function addDays(iso,days){ const d=new Date(iso); d.setDate(d.getDate()+days); const z=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; }
  function el(tag, cls="", text=""){ const x=document.createElement(tag); if(cls) x.className=cls; if(text!=null) x.textContent=text; return x; }
// ===== Modal Szczegóły =====
function openTaskDetailsById(id){
  try{
    const t = state.tasks.find(x=>x.id===id);
    if(!t){ toastMsg("Nie znaleziono zadania"); return; }
    const m = $("#details"); const body=$("#detailsBody"); const title=$("#detailsTitle"); const close=$("#detailsClose");
    if(!m||!body||!title||!close){ alert("Szczegóły (fallback)"); return; }

    title.textContent = t.title || "Szczegóły zadania";
    const meta = [
      t.dateISO ? `Data: ${isoToPL(t.dateISO)}` : null,
      t.when ? `Godzina: ${t.when}` : null,
      t.horse ? `Koń: ${t.horse}` : null,
      t.rider ? `Jeździec: ${t.rider}` : null,
      t.arena ? `Miejsce: ${t.arena}` : null,
      t.groupLevel ? `Poziom (grupa): ${t.groupLevel}` : null,
      t.indivLevel ? `Poziom (indyw.): ${t.indivLevel}` : null,
      `Status: ${statusLabel(t.status)}`,
      (typeof t.points==="number") ? `Punkty: ${t.points}` : null,
      t.assignedTo ? `Przypisane: ${t.assignedTo}` : null,
      (t.instructorId ? `Instruktor: ${(state.instructors.find(i=>i.id===t.instructorId)?.label)||"—"}` : null)
    ].filter(Boolean);

    const details = (t.comments||"").trim();

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="meta">${meta.map(escapeHTML).join(" • ")}</div>
        ${details ? `<div><strong>Uwagi / Szczegóły:</strong><br>${escapeHTML(details)}</div>` : `<div class="meta">Brak dodatkowych szczegółów.</div>`}
      </div>
    `;

    const closeFn = ()=> m.classList.add("hidden");
    m.classList.remove("hidden");
    close.onclick = closeFn;
    m.addEventListener("click", (e)=>{ if(e.target===m) closeFn(); }, { once:true });
    document.addEventListener("keydown", function esc(e){ if(e.key==="Escape"){ closeFn(); document.removeEventListener("keydown", esc); }});
  }catch(e){ console.warn("openTaskDetailsById", e); }
}

  function toastMsg(msg, {danger=false}={}) {
  try{
    const el = $("#toast");
    if(!el){ console.warn("[toast] brak #toast"); alert(msg); return; }
    el.textContent = msg;
    if(danger){ el.style.background="#b91c1c"; el.style.color="#fff"; }
    el.classList.add("show");
    // Zamykaj DOPIERO po kliknięciu
    el.onclick = ()=>{
      el.classList.remove("show");
      el.style.background=""; el.style.color="";
      el.onclick = null;
    };
  }catch(e){ console.warn("toast error", e); }
}


  function flash(anchorSelector, text){
    try{
      const anchor = typeof anchorSelector==="string" ? $(anchorSelector) : anchorSelector;
      if(!anchor){ toastMsg(text); return; }
      const tip = document.createElement("div");
      tip.textContent = text;
      Object.assign(tip.style,{
        position:"absolute", zIndex:"999", padding:"6px 10px", background:"#111827",
        color:"#fff", borderRadius:"10px", fontSize:".9rem", boxShadow:"0 8px 20px rgba(0,0,0,.15)",
        opacity:"0", transform:"translateY(-6px)"
      });
      document.body.appendChild(tip);
      const r = anchor.getBoundingClientRect();
      tip.style.left = (r.left + window.scrollX) + "px";
      tip.style.top  = (r.top + window.scrollY - 38) + "px";
      requestAnimationFrame(()=>{
        tip.style.transition = "opacity .18s ease, transform .18s ease";
        tip.style.opacity = "1"; tip.style.transform = "translateY(-12px)";
      });
      setTimeout(()=>{
        tip.style.opacity = "0"; tip.style.transform = "translateY(-6px)";
        setTimeout(()=> tip.remove(), 200);
      }, 1500);
    }catch(e){ console.warn("flash error", e); }
  }

  /* ===== Bezpieczny fallback validators.js ===== */
  const SafeValidation = {
    validateRide: (ride, vState)=>({ errors:[], warnings:[], needsConfirm:false }),
    showValidationMessages: (v)=> {
      (v?.errors||[]).forEach(m=>toastMsg(m,{danger:true}));
      (v?.warnings||[]).forEach(m=>toastMsg(m));
    },
    confirmWarnings: (v, onOk, onCancel)=> {
      if(!v?.warnings?.length){ onOk&&onOk(); return; }
      const ok = confirm( (v.warnings||[]).join("\n") + "\n\nKontynuować?" );
      ok ? (onOk&&onOk()) : (onCancel&&onCancel());
    }
  };
  function V(){ return (window.EquiFlowValidation && typeof window.EquiFlowValidation.validateRide==="function") ? window.EquiFlowValidation : SafeValidation; }

  /* ===== Validation: budowa stanu ===== */
  function EQF_buildRidesState() {
    const rides = [];
    try{
      if (Array.isArray(state?.riders)) {
        state.riders.forEach(r => rides.push({
          id:r.id, date:r.dateISO, time:r.when, horse:r.horse||null,
          rider:`${r.first} ${r.last}`, instructor:r.instructorId||null, level:r.level||null
        }));
      }
      if (Array.isArray(state?.tasks)) {
        state.tasks.forEach(t => {
          if ((t.type==="jazda_grupowa"||t.type==="jazda_indywidualna") && !t.riderId) {
            rides.push({
              id:t.id, date:t.dateISO, time:t.when, horse:t.horse||null,
              rider:t.rider||null, instructor:t.instructorId||null, level:t.groupLevel||t.indivLevel||null
            });
          }
        });
      }
    }catch(e){ console.warn("EQF_buildRidesState error", e); }
    return { rides };
  }

  /* ===== Seeds ===== */
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
  const LEVELS_GROUP = ["kłus","kłus-galop","obóz","teren"];
  const LEVELS_INDIV = ["lonża","kłus","kłus-galop"];
  const PROCEDURES = [
    "Kowal — werkowanie/podkucie",
    "Weterynarz — szczepienia",
    "Weterynarz — zęby",
    "Weterynarz — badania okresowe",
    "Kopyta — pielęgnacja",
    "Wcierki chłodzące",
    "Wcierki rozgrzewające",
    "Golenie"
  ];

  const seedRiders = (()=>{
    const base = todayISO();
    const firsts = ["Ola","Michał","Anka","Kuba","Julia","Tomek","Nina","Bartek","Iga","Paweł","Ala","Kamil","Zosia","Karol","Laura","Igor","Oskar","Magda","Adam","Ewelina"];
    const lasts  = ["Kowalska","Nowak","Wiśniewska","Wójcik","Kamińska","Lewandowski","Zielińska","Szymański","Woźniak","Dąbrowska","Kozłowski","Jankowska","Mazur","Krawczyk","Piotrowska","Grabowski","Pawlak","Michalska","Król","Wieczorek"];
    const times = ["10:00","11:00","12:00","16:00","17:00","18:00"];
    return firsts.map((f,i)=>({
      id: uid(),
      first: f, last: lasts[i],
      tel: `+48 600 00 ${String(10+i).padStart(2,"0")}`,
      email: `${f.toLowerCase()}.${lasts[i].toLowerCase()}@example.com`,
      level: levels[i % levels.length],
      dateISO: addDays(base, i % 5),
      when: times[i % times.length],
      instructorId: seedInstructors[i % seedInstructors.length].id,
      horse: seedHorses[i % seedHorses.length].name
    }));
  })();

  /* ===== Model ===== */
  function task(title, type, extra={}) {
    return {
      id: uid(),
      title, type,
      arena: extra.arena || null,
      horse: extra.horse || null,
      rider: extra.rider || null,
      riderId: extra.riderId || null,
      instructorId: extra.instructorId || null,
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
  ];

  /* ===== Codzienne ===== */
  function seedNow(){
    const base = todayISO();
    return [
      task("Prace porządkowe — stajnia", "porządki", {points:2, daily:true, dateISO:base}),
      task("Wyprowadzenie Stada", "wyprowadzenie", {points:1, daily:true, dateISO:base}),
      task("Sprowadzenie Stada", "sprowadzenie", {points:1, daily:true, dateISO:base}),
    ];
  }
  function ensureDailyTasksForToday(){
    try{
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
    }catch(e){ console.warn("ensureDailyTasksForToday error", e); }
  }

  /* ===== Global state ===== */
  let state = null;

  /* ===== Bootstrap ===== */
document.addEventListener("DOMContentLoaded", () => {
  try{
    state = {
      volunteer:   load(LS.USER)        || { name: "" },
      tasks:       load(LS.TASKS)       || seedTasks.slice(),
      settings:    load(LS.SETTINGS)    || { demoAutoApprove: false },
      horses:      load(LS.HORSES)      || seedHorses,
      riders:      load(LS.RIDERS)      || seedRiders,
      instructors: load(LS.INSTRUCTORS) || seedInstructors,
      ui: (() => {
        const today = todayISO();
        const ui = load(LS.UI);
if (ui) {
  return {
    ...ui,
    a: { ...(ui.a || {}), day: today },
    v: { ...(ui.v || {}), view: "list" },
    i: { ...(ui.i || {}), view: "list", status: ui.i?.status || "all", future: !!ui.i?.future, sort: ui.i?.sort || "newest" },
    r: { ...(ui.r || {}), view: "list", from: ui.r?.from || today, to: ui.r?.to || today }
  };
}

        // WYMUSZAMY dzisiejszy zakres w Raportach przy KAŻDYM starcie
        base.r.from = today;
        base.r.to   = today;
        return base;
      })()
    };

    ensureDailyTasksForToday();
    state.ui.tab = state.ui.tab || "admin";
    save(LS.UI, state.ui);

    // TABY — rejestracja absolutnie na pewno:
    initTabs();


      // Reszta UI
      bindProfile();
      bindInstructor();
      bindReportsUI();
      initAdmin();

      // Start
      switchTab(state.ui.tab);
      renderAll();
    }catch(err){
      console.error("Bootstrap error:", err);
      // Minimum: włącz taby nawet gdy coś padnie
      try{ initTabs(); switchTab("admin"); }catch(e){}
    }
  });

  /* ===== TABS ===== */
  function initTabs(){
    try{
      const tabsRoot = $("#tabsNav");
      if(!tabsRoot){ console.warn("Brak #tabsNav"); return; }

      const tabs = $$('.tab[data-tab]', tabsRoot);
      if(!tabs.length){ console.warn("Brak przycisków .tab[data-tab]"); }

      tabs.forEach(btn=>{
        btn.setAttribute('role','tab');
        btn.setAttribute('tabindex', btn.classList.contains('tab-active') ? '0':'-1');

        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          const key = btn.dataset.tab;
          try{ switchTab(key); }catch(err){ console.error("switchTab error", err); }
          try{ renderAll(); }catch(err){ console.error("renderAll error", err); }
          focusActiveTab();
        });

        btn.addEventListener('keydown',(e)=>{
          const all = $$('.tab[data-tab]', tabsRoot);
          const i = all.findIndex(x=>x.classList.contains('tab-active'));
          if(e.key==='ArrowLeft'){ e.preventDefault(); all[(i-1+all.length)%all.length]?.click(); }
          if(e.key==='ArrowRight'){ e.preventDefault(); all[(i+1)%all.length]?.click(); }
          if(e.key==='Home'){ e.preventDefault(); all[0]?.click(); }
          if(e.key==='End'){ e.preventDefault(); all[all.length-1]?.click(); }
        });
      });

      // Delegat (drugi bezpiecznik)
      tabsRoot.addEventListener("click",(e)=>{
        const btn = e.target.closest('.tab[data-tab]');
        if(!btn) return;
        e.preventDefault();
        const key = btn.dataset.tab;
        try{ switchTab(key); }catch(err){ console.error("switchTab error", err); }
        try{ renderAll(); }catch(err){ console.error("renderAll error", err); }
        focusActiveTab();
      }, {capture:true});

    }catch(e){
      console.error("initTabs error", e);
    }
  }

  function focusActiveTab(){
    try{
      const active = $('#tabsNav .tab.tab-active');
      $$('#tabsNav .tab[data-tab]').forEach(b=> b.setAttribute('tabindex', b===active ? '0':'-1'));
      active?.focus();
    }catch(e){ /* ignore */ }
  }

  function switchTab(key){
    try{
      state.ui.tab = key;
      // przyciski
      $$('#tabsNav .tab[data-tab]').forEach(b=>{
        const act = (b.dataset.tab===key);
        b.classList.toggle('tab-active', act);
        b.setAttribute('aria-selected', act ? 'true':'false');
      });
      // sekcje
      $("#tab-admin")?.classList.toggle("hidden", key!=="admin");
      $("#tab-instructor")?.classList.toggle("hidden", key!=="instructor");
      $("#tab-volunteer")?.classList.toggle("hidden", key!=="volunteer");
      $("#tab-reports")?.classList.toggle("hidden", key!=="reports");
      save(LS.UI, state.ui);
    }catch(e){
      console.error("switchTab fatal", e);
      // awaryjnie pokaż admin
      try{
        $("#tab-admin")?.classList.remove("hidden");
        $("#tab-instructor")?.classList.add("hidden");
        $("#tab-volunteer")?.classList.add("hidden");
        $("#tab-reports")?.classList.add("hidden");
      }catch(_){}
    }
  }

  function renderAll(){
    try{ renderInstructor(); }catch(e){ console.warn("renderInstructor warn", e); }
    try{ renderVolunteer(); }catch(e){ console.warn("renderVolunteer warn", e); }
    try{ renderReports(); }catch(e){ console.warn("renderReports warn", e); }
    try{ renderAdmin(); }catch(e){ console.warn("renderAdmin warn", e); }
    try{ save(LS.UI, state.ui); }catch(_){}
  }

  /* ===== PROFIL ===== */
  function bindProfile(){
    try{
      const v=$("#volunteerName");
      if(v) v.value = state.volunteer.name || "";
      $("#saveUser")?.addEventListener("click", ()=>{
        try{
          state.volunteer.name = $("#volunteerName").value.trim();
          save(LS.USER, state.volunteer);
          toastMsg("Zapisano profil");
          renderAll();
        }catch(e){ console.warn("save user error", e); }
      });
    }catch(e){ console.warn("bindProfile error", e); }
  }

  /* ===== INSTRUKTOR ===== */
  function setViewActive(prefix, which){
    try{
      const map = { i:{list:"#i-view-list"}, v:{list:"#v-view-list"}, r:{list:"#r-view-list"} };
      const m = map[prefix];
      $(m.list)?.classList.toggle("view-active", which==="list");
    }catch(e){}
  }

  function bindInstructor(){
    try{
      $("#i-view-list")?.addEventListener("click", ()=>{ state.ui.i.view="list"; setViewActive("i","list"); renderInstructor();});
      $("#i-taskType")?.addEventListener("change", renderDynamicFields);
      renderDynamicFields();
      $("#i-add")?.addEventListener("click", addInstructorTask);
      $("#i-createDefaults")?.addEventListener("click", ()=>{
        const now = todayISO();
        const me = (state.volunteer.name||"").trim();
        const set = [
          task("Prace porządkowe — stajnia", "porządki", {points:2, daily:true, dateISO:now, assignedTo: me || null}),
          task("Wyprowadzenie Stada", "wyprowadzenie", {points:1, daily:true, dateISO:now, assignedTo: me || null}),
          task("Sprowadzenie Stada", "sprowadzenie", {points:1, daily:true, dateISO:now, assignedTo: me || null}),
        ];
        state.tasks = set.concat(state.tasks);
        persistAll(); renderAll(); flash("#i-createDefaults","Dodano zestaw");
      });
    }catch(e){ console.warn("bindInstructor error", e); }
  }

  function renderDynamicFields(){
    try{
      const c = $("#i-dynamicFields"); if(!c) return;

      c.innerHTML = "";
      const type = $("#i-taskType")?.value;

      if(!state.horses?.length) state.horses = seedHorses.slice();
      if(!state.riders?.length) state.riders = seedRiders.slice();

      const date = inputDate("Data", "i-date", todayISO());
      const time = inputTime("Godzina", "i-when");
      const horse = inputSelect("Koń", "i-horse", ["— koń —"].concat(state.horses.map(h=>h.name)));
      const rider = inputSelect("Jeździec", "i-rider", ["— jeździec —"].concat(uniqueRiderNames()));
      const levelGroup = inputSelect("Poziom (grupa)", "i-level-group", LEVELS_GROUP);
      const levelIndiv  = inputSelect("Poziom (indywidualna)", "i-level-indiv", LEVELS_INDIV);

      const placeWrap = $("#i-place")?.closest("label");
      const titleWrap = $("#i-title")?.closest("label");
      if (titleWrap) titleWrap.style.display = "none";

      if (type==="prep"){
        if (placeWrap) placeWrap.style.display = "none";
        append(c, date, time);
      }
      else if (type==="zabieg"){

        if (placeWrap) placeWrap.style.display = "none";
        const proc = inputSelect("Typ zabiegu","i-proc",PROCEDURES);
        append(c, date, horse, proc);
      }
    else if (["wyprowadzenie","sprowadzenie","rozsiodłanie"].includes(type)){
        if (placeWrap) placeWrap.style.display = "none";
        append(c, date);
      }
else if (type==="dziennikarz"){
        if (placeWrap) placeWrap.style.display = "none";
        append(c, date, time);
      }
      else if (type==="dziennikarz"){
      if (placeWrap) placeWrap.style.display = "none";
      append(c, date, time);
    }

      else if (type==="jazda_grupowa"){
        if (placeWrap) placeWrap.style.display = "";
        const inst = document.createElement("label");
        inst.innerHTML = `Instruktor
          <select id="i-instructor">
            <option value="">— instruktor —</option>
            ${state.instructors.map(i=>`<option value="${escapeHTML(i.id)}">${escapeHTML(i.label)}</option>`).join("")}
          </select>`;
        append(c, date, time, levelGroup, horse, rider, inst);
      }
      else if (type==="jazda_indywidualna"){
        if (placeWrap) placeWrap.style.display = "";
        const inst = document.createElement("label");
        inst.innerHTML = `Instruktor
          <select id="i-instructor">
            <option value="">— instruktor —</option>
            ${state.instructors.map(i=>`<option value="${escapeHTML(i.id)}">${escapeHTML(i.label)}</option>`).join("")}
          </select>`;
        append(c, date, time, levelIndiv, horse, rider, inst);
      }

      function inputDate(label, id, iso){ const el=document.createElement("label"); el.innerHTML=`${label}<input id="${id}" type="date" value="${iso}"/>`; return el; }
      function inputTime(label, id){ const el=document.createElement("label"); el.innerHTML=`${label}<input id="${id}" type="time" />`; return el; }
      function inputSelect(label,id,arr){
        const el=document.createElement("label");
        const opts = arr.map(v=> typeof v==="string"
          ? `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`
          : `<option value="${escapeHTML(v.value)}">${escapeHTML(v.text)}</option>`).join("");
        el.innerHTML = `${label}<select id="${id}">${opts}</select>`;
        return el;
      }
function append(parent, ...children){ children.forEach(ch=>parent.appendChild(ch)); }
    }catch(e){ console.warn("renderDynamicFields error", e); }
  }
function renderDynamicFieldsAdmin(){
  try{
    const c = $("#a-dynamicFields"); if(!c) return;
    c.innerHTML = "";
    const type = $("#a-taskType")?.value;

    if(!state.horses?.length) state.horses = seedHorses.slice();
    if(!state.riders?.length) state.riders = seedRiders.slice();

    const date = inputDate("Data", "a-date", todayISO());
    const time = inputTime("Godzina", "a-when");
    const horse = inputSelect("Koń", "a-horse", ["— koń —"].concat(state.horses.map(h=>h.name)));
    const rider = inputSelect("Jeździec", "a-rider", ["— jeździec —"].concat(uniqueRiderNames()));
    const levelGroup = inputSelect("Poziom (grupa)", "a-level-group", LEVELS_GROUP);
    const levelIndiv  = inputSelect("Poziom (indywidualna)", "a-level-indiv", LEVELS_INDIV);

    const placeWrap = $("#a-place")?.closest("label");
    const titleWrap = $("#a-title")?.closest("label");
    if (titleWrap) titleWrap.style.display = "none"; // tytuł generujemy

    if (type==="prep"){
      if (placeWrap) placeWrap.style.display = "none";
      append(c, date, time);
    }
    else if (type==="zabieg"){

      if (placeWrap) placeWrap.style.display = "none";
      const proc = inputSelect("Typ zabiegu","a-proc",PROCEDURES);
      append(c, date, horse, proc);
    }
    else if (["wyprowadzenie","sprowadzenie","rozsiodłanie"].includes(type)){
      if (placeWrap) placeWrap.style.display = "none";
      append(c, date);
    }

    else if (type==="jazda_grupowa"){
      if (placeWrap) placeWrap.style.display = "";
      const inst = document.createElement("label");
      inst.innerHTML = `Instruktor
        <select id="a-instructor">
          <option value="">— instruktor —</option>
          ${state.instructors.map(i=>`<option value="${escapeHTML(i.id)}">${escapeHTML(i.label)}</option>`).join("")}
        </select>`;
      append(c, date, time, levelGroup, horse, rider, inst);
    }
    else if (type==="jazda_indywidualna"){
      if (placeWrap) placeWrap.style.display = "";
      const inst = document.createElement("label");
      inst.innerHTML = `Instruktor
        <select id="a-instructor">
          <option value="">— instruktor —</option>
          ${state.instructors.map(i=>`<option value="${escapeHTML(i.id)}">${escapeHTML(i.label)}</option>`).join("")}
        </select>`;
      append(c, date, time, levelIndiv, horse, rider, inst);
    }

    function inputDate(label, id, iso){ const el=document.createElement("label"); el.innerHTML=`${label}<input id="${id}" type="date" value="${iso}"/>`; return el; }
    function inputTime(label, id){ const el=document.createElement("label"); el.innerHTML=`${label}<input id="${id}" type="time" />`; return el; }
    function inputSelect(label,id,arr){
      const el=document.createElement("label");
      const opts = arr.map(v=> typeof v==="string"
        ? `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`
        : `<option value="${escapeHTML(v.value)}">${escapeHTML(v.text)}</option>`).join("");
      el.innerHTML = `${label}<select id="${id}">${opts}</select>`;
      return el;
    }
function append(parent, ...children){ children.forEach(ch=>parent.appendChild(ch)); }
  }catch(e){ console.warn("renderDynamicFieldsAdmin error", e); }
}

  function makeTitle(tp, data){
    if(tp==="jazda_grupowa")      return `Jazda Grupowa — ${data.groupLevel||"—"} • ${data.horse||"—"} • ${data.rider||"—"}`;
    if(tp==="jazda_indywidualna") return `Jazda Indywidualna — ${data.indivLevel||"—"} • ${data.horse||"—"} • ${data.rider||"—"}`;
    if(tp==="prep")               return `Przygotowanie — ${data.rider||"—"}`;
    if(tp==="zabieg")             return `Zabieg — ${data.procType||"—"} • ${data.horse||"—"}`;
    return typeLabel(tp);
  }

async function addInstructorTask(){
  try{
    const tp = $("#i-taskType")?.value;
    const points = clamp(+($("#i-points")?.value||2), 0, 4);
    const arena = ($("#i-place")?.value||"").trim() || null;
    const title = ($("#i-title")?.value||"").trim();
    const dateISO = $("#i-date")?.value || todayISO();
    const when = $("#i-when")?.value || null;
    const horse = $("#i-horse")?.value && $("#i-horse").value!=="— koń —" ? $("#i-horse").value : null;
    const rider = $("#i-rider")?.value && $("#i-rider").value!=="— jeździec —" ? $("#i-rider").value : null;
    const groupLevel = $("#i-level-group")?.value || null;
    const indivLevel = $("#i-level-indiv")?.value || null;
    const procType = $("#i-proc")?.value || null;
const notes = (($("#i-details")?.value ?? $("#i-notes")?.value) || "").trim();
    const instructorId = $("#i-instructor")?.value || null;

    let t;

  if (tp==="prep"){
      if(!when){ toastMsg("Przygotowanie: podaj godzinę", {danger:true}); return; }
      t = task(title||makeTitle(tp,{when}), "prep",
        {arena:null, horse:null, rider:null, when, dateISO, points, comments: notes});
    }
    else if (tp==="zabieg"){

      if(!horse || !procType){ toastMsg("Zabieg: wybierz konia i typ zabiegu", {danger:true}); return; }
      t = task(title||makeTitle(tp,{horse,procType}), "zabieg",
        {arena:null, horse, when, dateISO, points, procType, comments: notes});
    }
    else if (["wyprowadzenie","sprowadzenie","rozsiodłanie"].includes(tp)){
     t = task(title||typeLabel(tp), tp, {arena:null, when:null, dateISO, points, daily:true, comments: notes});
    }
    else if (tp === "jazda_grupowa") {
      if (!when || !groupLevel || !horse || !rider) {
        toastMsg("Jazda grupowa: data, godzina, poziom, koń, jeździec", {danger:true});
        return;
      }
      if (!instructorId) { toastMsg("Wybierz instruktora", {danger:true}); return; }

      const vState = EQF_buildRidesState();
      const newRide = { id:null, date:dateISO, time:when, horse, rider, instructor:instructorId, level:groupLevel };
      const vRes = V().validateRide(newRide, vState, { mode:"create" });
      if (vRes.errors.length) { V().showValidationMessages(vRes); return; }

      const doCreateGroup = () => {
        const sameTimeHorse = vState.rides.some(r => r.date===dateISO && r.time===when && (r.horse||"") === (horse||""));
        if (sameTimeHorse){
          V().showValidationMessages({errors:[`Koń ${horse} jest już zapisany na ${when}.`], warnings:[]});
          return;
        }
        const [firstName, ...restName] = (rider||"").split(" ");
        const lastName = restName.join(" ") || "";
        const riderObj = { id: uid(), first:firstName||rider, last:lastName, tel:"", email:"", level:groupLevel, dateISO, when, instructorId, horse };
        state.riders.push(riderObj);

        const tNew = task(title || makeTitle(tp, { groupLevel, horse, rider }), "jazda_grupowa", {
          arena, horse, rider, riderId: riderObj.id, instructorId, when, dateISO, points: 0, groupLevel, comments: notes
        });
        state.tasks.unshift(tNew);
        persistAll(); renderAll(); flash("#i-add","Dodano zadanie");
      };

      if (vRes.needsConfirm) { V().confirmWarnings(vRes, () => doCreateGroup(), () => {}); return; }
      else if (vRes.warnings.length) { V().showValidationMessages(vRes); }

      doCreateGroup(); return;
    }
    else if (tp === "jazda_indywidualna") {
      if (!when || !indivLevel || !horse || !rider) {
        toastMsg("Jazda indywidualna: data, godzina, poziom, koń, jeździec", {danger:true});
        return;
      }
      if (!instructorId) { toastMsg("Wybierz instruktora", {danger:true}); return; }

      const vState = EQF_buildRidesState();
      const newRide = { id:null, date:dateISO, time:when, horse, rider, instructor:instructorId, level:indivLevel };
      const vRes = V().validateRide(newRide, vState, { mode:"create" });
      if (vRes.errors.length) { V().showValidationMessages(vRes); return; }

      const doCreateIndiv = () => {
        const sameTimeHorse = vState.rides.some(r => r.date===dateISO && r.time===when && (r.horse||"") === (horse||""));
        if (sameTimeHorse){
          V().showValidationMessages({errors:[`Koń ${horse} jest już zapisany na ${when}.`], warnings:[]});
          return;
        }
        const [firstName2, ...restName2] = (rider||"").split(" ");
        const lastName2 = restName2.join(" ") || "";
        const riderObj = { id: uid(), first:firstName2||rider, last:lastName2, tel:"", email:"", level:indivLevel, dateISO, when, instructorId, horse };
        state.riders.push(riderObj);

        const tNew = task(title || makeTitle(tp, { indivLevel, horse, rider }), "jazda_indywidualna", {
          arena, horse, rider, riderId:riderObj.id, instructorId, when, dateISO, points:0, indivLevel, comments: notes
        });
        state.tasks.unshift(tNew);
        persistAll(); renderAll(); flash("#i-add","Dodano zadanie");
      };

      if (vRes.needsConfirm) { V().confirmWarnings(vRes, () => doCreateIndiv(), () => {}); return; }
      else if (vRes.warnings.length) { V().showValidationMessages(vRes); }

      doCreateIndiv(); return;
    }
    else if (tp === "dziennikarz"){
      // nowy obsługiwany typ — prosty task, bez walidacji jazdy
      t = task(title||"Dziennikarz / Kronikarz", "dziennikarz", {
        dateISO, when, points, comments: notes
      });
    }
    else {
      toastMsg("Nieobsługiwany typ", {danger:true});
      return;
    }

    if (t){
      state.tasks.unshift(t);
      persistAll();
      renderAll();
      flash("#i-add","Dodano zadanie");
    }
  }catch(e){
    console.error("addInstructorTask fatal", e);
    toastMsg("Błąd dodawania — sprawdź konsolę", {danger:true});
  }
}
  async function addAdminTask(){
    try{
      if (!$("#a-date")) renderDynamicFieldsAdmin();

      const tp = $("#a-taskType")?.value;
      const points = clamp(+($("#a-points")?.value||2), 0, 4);
      const arena = ($("#a-place")?.value||"").trim() || null;
      const title = ($("#a-title")?.value||"").trim();
      const dateISO = $("#a-date")?.value || todayISO();
      const when = $("#a-when")?.value || null;
      const horse = $("#a-horse")?.value && $("#a-horse").value!=="— koń —" ? $("#a-horse").value : null;
      const rider = $("#a-rider")?.value && $("#a-rider").value!=="— jeździec —" ? $("#a-rider").value : null;
      const groupLevel = $("#a-level-group")?.value || null;
      const indivLevel = $("#a-level-indiv")?.value || null;
      const procType = $("#a-proc")?.value || null;
      const notes = ($("#a-details")?.value||"").trim();
      const instructorId = $("#a-instructor")?.value || null;

      let t;

     if (tp==="prep"){
        if(!when){ toastMsg("Przygotowanie: podaj godzinę", {danger:true}); return; }
        t = task(title||makeTitle(tp,{when}), "prep",
          {arena:null, horse:null, rider:null, when, dateISO, points, comments: notes});
      }
      else if (tp==="zabieg"){

        if(!horse || !procType){ toastMsg("Zabieg: wybierz konia i typ zabiegu", {danger:true}); return; }
        t = task(title||makeTitle(tp,{horse,procType}), "zabieg",
          {arena:null, horse, when, dateISO, points, procType, comments: notes});
      }
      else if (["wyprowadzenie","sprowadzenie","rozsiodłanie"].includes(tp)){
        t = task(title||typeLabel(tp), tp, {arena:null, when:null, dateISO, points, daily:true, comments: notes});
      }
      else if (tp === "jazda_grupowa") {
        if (!when || !groupLevel || !horse || !rider) {
          toastMsg("Jazda grupowa: data, godzina, poziom, koń, jeździec", {danger:true});
          return;
        }
        if (!instructorId) { toastMsg("Wybierz instruktora", {danger:true}); return; }

        const vState = EQF_buildRidesState();
        const newRide = { id:null, date:dateISO, time:when, horse, rider, instructor:instructorId, level:groupLevel };
        const vRes = V().validateRide(newRide, vState, { mode:"create" });
        if (vRes.errors.length) { V().showValidationMessages(vRes); return; }

        const doCreateGroup = () => {
          const sameTimeHorse = vState.rides.some(r => r.date===dateISO && r.time===when && (r.horse||"") === (horse||""));
          if (sameTimeHorse){
            V().showValidationMessages({errors:[`Koń ${horse} jest już zapisany na ${when}.`], warnings:[]});
            return;
          }
          const [firstName, ...restName] = (rider||"").split(" ");
          const lastName = restName.join(" ") || "";
          const riderObj = { id: uid(), first:firstName||rider, last:lastName, tel:"", email:"", level:groupLevel, dateISO, when, instructorId, horse };
          state.riders.push(riderObj);

          const tNew = task(title || makeTitle(tp, { groupLevel, horse, rider }), "jazda_grupowa", {
            arena, horse, rider, riderId: riderObj.id, instructorId, when, dateISO, points: 0, groupLevel, comments: notes
          });
          state.tasks.unshift(tNew);
          persistAll(); renderAll(); flash("#a-add","Dodano zadanie");
        };

        if (vRes.needsConfirm) { V().confirmWarnings(vRes, () => doCreateGroup(), () => {}); return; }
        else if (vRes.warnings.length) { V().showValidationMessages(vRes); }

        doCreateGroup(); return;
      }
      else if (tp === "jazda_indywidualna") {
        if (!when || !indivLevel || !horse || !rider) {
          toastMsg("Jazda indywidualna: data, godzina, poziom, koń, jeździec", {danger:true});
          return;
        }
        if (!instructorId) { toastMsg("Wybierz instruktora", {danger:true}); return; }

        const vState = EQF_buildRidesState();
        const newRide = { id:null, date:dateISO, time:when, horse, rider, instructor:instructorId, level:indivLevel };
        const vRes = V().validateRide(newRide, vState, { mode:"create" });
        if (vRes.errors.length) { V().showValidationMessages(vRes); return; }

        const doCreateIndiv = () => {
          const sameTimeHorse = vState.rides.some(r => r.date===dateISO && r.time===when && (r.horse||"") === (horse||""));
          if (sameTimeHorse){
            V().showValidationMessages({errors:[`Koń ${horse} jest już zapisany na ${when}.`], warnings:[]});
            return;
          }
          const [firstName2, ...restName2] = (rider||"").split(" ");
          const lastName2 = restName2.join(" ") || "";
          const riderObj = { id: uid(), first:firstName2||rider, last:lastName2, tel:"", email:"", level:indivLevel, dateISO, when, instructorId, horse };
          state.riders.push(riderObj);

          const tNew = task(title || makeTitle(tp, { indivLevel, horse, rider }), "jazda_indywidualna", {
            arena, horse, rider, riderId:riderObj.id, instructorId, when, dateISO, points:0, indivLevel, comments: notes
          });
          state.tasks.unshift(tNew);
          persistAll(); renderAll(); flash("#a-add","Dodano zadanie");
        };

        if (vRes.needsConfirm) { V().confirmWarnings(vRes, () => doCreateIndiv(), () => {}); return; }
        else if (vRes.warnings.length) { V().showValidationMessages(vRes); }

        doCreateIndiv(); return;
      }
      else if (tp === "dziennikarz"){
        // prosty task — karta pojawia się u Instr/Wolon (bez grafiku jazd)
        t = task(title||"Dziennikarz / Kronikarz", "dziennikarz", {
          dateISO, when, points, comments: notes
        });
      }
      else {
        toastMsg("Nieobsługiwany typ", {danger:true});
        return;
      }

      if (t){
        state.tasks.unshift(t);
        persistAll();
        renderAll();
        flash("#a-add","Dodano zadanie");
      }
    }catch(e){
      console.error("addAdminTask fatal", e);
      toastMsg("Błąd dodawania — sprawdź konsolę", {danger:true});
    }
  }


  function renderInstructor(){
    try{
      const list = $("#i-list");
      if(!list) return;

    let items = state.tasks.slice();
// FILTR: karty pokazują WYŁĄCZNIE DZISIEJSZE (chyba że włączony tryb „przyszłość”)
const today = todayISO();
if (state.ui.i?.future){
  items = items.filter(t => t.dateISO > today);
} else {
  items = items.filter(t => t.dateISO === today);
}
// dodatkowy filtr po statusie (jak dotychczas)
if(state.ui.i?.status && state.ui.i.status!=="all"){
  items = items.filter(t=> t.status===state.ui.i.status);
}


      items.sort((a,b)=>{
        const sort = state.ui.i?.sort || "newest";
        if(sort==="date"){
          const d = (a.dateISO||"").localeCompare(b.dateISO||"");
          if(d!==0) return d;
          return (a.when||"").localeCompare(b.when||"");
        }
        if(sort==="status"){
          return (a.status||"").localeCompare(b.status||"");
        }
        return (b.ts||0) - (a.ts||0);
      });

      const needsAssign = items.filter(t=> t.status==="open" && !t.assignedTo);
      const rest = items.filter(t=> !(t.status==="open" && !t.assignedTo));
      items = needsAssign.concat(rest);

      list.className = "list";
      list.innerHTML = items.map(cardHTMLInstructor).join("");
      renderInstructorArchive(state.tasks);

      list.querySelectorAll(".openModal").forEach(b=>b.addEventListener("click", e=>{
  try{
    const id = e.currentTarget.dataset.id;
    if(!id) return;
    openTaskDetailsById(id);
  }catch(_){}
}));

      list.querySelectorAll(".approve").forEach(b=>b.addEventListener("click", onApprove));
      list.querySelectorAll(".reject").forEach(b=>b.addEventListener("click", onReject));
      list.querySelectorAll(".assign").forEach(b=>b.addEventListener("click", onAssignVolunteer));
      list.querySelectorAll(".nudge").forEach(b=>b.addEventListener("click", onNudge));
      list.querySelectorAll(".delete").forEach(b=>b.addEventListener("click", onDeleteTask));
      list.querySelectorAll(".instAssign").forEach(b=>b.addEventListener("click", onAssignInstructor));

      setCountsInstructor(state.tasks);
    }catch(e){ console.warn("renderInstructor error", e); }
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

    const instSelect = ride ? `
      <div class="row-inline">
        <span class="meta">Instruktor:</span>
        <select class="instSel" data-id="${t.id}">
          ${state.instructors.map(i => `
            <option value="${escapeHTML(i.id)}" ${t.instructorId===i.id?'selected':''}>
              ${escapeHTML(i.label)}
            </option>
          `).join("")}
        </select>
        <button class="btn small instAssign" data-id="${t.id}">OK</button>
      </div>
    ` : "";

    const actions = `
      ${t.status==="to_review" ? `<button class="btn small approve" data-id="${t.id}">Zatwierdź</button>
                                  <button class="btn small ghost reject" data-id="${t.id}">Odrzuć</button>` : ``}
      ${(!ride && t.status==="open") ? assignVolunteerUI(t.id) : ``}
      <button class="btn small ghost nudge" data-id="${t.id}" title="Wyślij przypomnienie">Przypomnij</button>
      <button class="btn small ghost delete" data-id="${t.id}">Usuń zadanie</button>
    `;

    return `
    <article class="card ${classByStatus(t.status)} ${ride?'ride':''} ${future?'future':''}" data-id="${t.id}">
      <div class="title"><h3>${escapeHTML(t.title)}</h3></div>
      <div class="badges">${badges}</div>
      <div class="meta">${escapeHTML(meta)}</div>
      ${instSelect}
      ${t.comments ? `<div class="meta">Uwagi: ${escapeHTML(t.comments)}</div>` : ""}
           <div class="kit">
        <button class="btn small openModal" type="button" data-id="${t.id}">Szczegóły</button>
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

  function uniqueRiderNames(){ return Array.from(new Set(state.riders.map(r=>`${r.first} ${r.last}`))); }
  function uniqueAssignedCandidates(){
    const arr = state.tasks.map(t=>t.assignedTo).filter(Boolean);
    const me = (state.volunteer.name||"").trim(); if(me) arr.push(me);
    return Array.from(new Set(arr));
  }

  function onAssignVolunteer(e){
    try{
      const id = e.currentTarget.dataset.id;
      const card = e.currentTarget.closest(".card");
      const sel = card.querySelector(".assignSel");
      const val = sel?.value?.trim();
      if(!val){ toastMsg("Wybierz wolontariusza"); return; }
      const t = state.tasks.find(x=>x.id===id); if(!t) return;
      t.assignedTo = val; t.status = "taken"; persistAll(); renderAll();
    }catch(err){ console.warn("onAssignVolunteer", err); }
  }

  function onAssignInstructor(e){
    try{
      const id = e.currentTarget.dataset.id;
      const card = e.currentTarget.closest(".card");
      const sel = card.querySelector(".instSel");
      const newInst = sel?.value;
      if(!newInst) return;

      const t = state.tasks.find(x=>x.id===id);
      if(!t) return;
      t.instructorId = newInst;

      if((t.type==="jazda_grupowa" || t.type==="jazda_indywidualna") && t.riderId){
        const r = state.riders.find(rr => rr.id === t.riderId);
        if(r){ r.instructorId = newInst; }
      } else if (t.type==="jazda_grupowa" || t.type==="jazda_indywidualna") {
        const match = state.riders.find(r =>
          r.dateISO===t.dateISO &&
          r.when===t.when &&
          (r.horse||"") === (t.horse||"") &&
          (`${r.first} ${r.last}` === (t.rider||""))
        );
        if(match){ match.instructorId = newInst; }
      }
      persistAll();
      renderAll();
    }catch(err){ console.warn("onAssignInstructor", err); }
  }

  function onNudge(e){
    try{
      const id = e.currentTarget.dataset.id; const t=state.tasks.find(x=>x.id===id); if(!t) return;
      t.nudged = true; persistAll(); toastMsg("Wysłano przypomnienie (demo)"); renderAll();
    }catch(err){ console.warn("onNudge", err); }
  }

function onDeleteTask(e){
  try{
    const id = e.currentTarget.dataset.id;
    const t = state.tasks.find(x=>x.id===id);
    if(!t) return;
    if (t.status === "approved"){
      V().showValidationMessages({errors:["Nie można usuwać zatwierdzonych zadań."], warnings:[]});
      return;
    }

    V().confirmWarnings({ warnings: ["Na pewno usunąć to zadanie?"] }, () => {
      // Usuń powiązanego jeźdźca jeśli to jazda (spójnie z dotychczasową logiką)
      if ((t.type==="jazda_grupowa" || t.type==="jazda_indywidualna") && t.riderId){
        state.riders = state.riders.filter(r => r.id !== t.riderId);
      } else if (t.type==="jazda_grupowa" || t.type==="jazda_indywidualna"){
        state.riders = state.riders.filter(r=>{
          const sameDay = r.dateISO===t.dateISO;
          const sameTime = r.when===t.when;
          const sameHorse = (r.horse||"") === (t.horse||"");
          const sameRider = (`${r.first} ${r.last}` === (t.rider||""));
          return !(sameDay && sameTime && sameHorse && sameRider);
        });
      }
      // Usuń zadanie
      state.tasks = state.tasks.filter(x=>x.id!==id);
      persistAll(); renderAll();
      toastMsg("Zadanie usunięte");
    }, () => {});
    return; // wyjście po zainicjowaniu modala
  }catch(err){ console.warn("onDeleteTask", err); }
}


  function onApprove(e){
    try{
      const id=e.currentTarget.dataset.id; const t=state.tasks.find(x=>x.id===id); if(!t) return;
      t.status="approved"; persistAll(); renderAll(); toastMsg("Zatwierdzono");
    }catch(err){ console.warn("onApprove", err); }
  }
  function onReject(e){
    try{
      const id=e.currentTarget.dataset.id; const t=state.tasks.find(x=>x.id===id); if(!t) return;
      t.status="rejected"; persistAll(); renderAll(); toastMsg("Odrzucono",{danger:true});
    }catch(err){ console.warn("onReject", err); }
  }

  /* ===== WOLONTARIUSZ ===== */
  function typeLabel(t){
    const map = {
      "porządki":"Prace porządkowe","wyprowadzenie":"Wyprowadzenie","sprowadzenie":"Sprowadzenie","rozsiodłanie":"Rozsiodłanie",
      "zabieg":"Zabieg","prep":"Przygotowanie do jazdy",
      "jazda_grupowa":"Jazda Grupowa","jazda_indywidualna":"Jazda Indywidualna",
      "dziennikarz":"Dziennikarz / Kronikarz","lonżowanie":"Lonżowanie","klinika":"Klinika","luzak":"Luzak"
    };
    return map[t] || t;
  }
  function statusLabel(st){ return ({open:"Wolne",taken:"W trakcie",to_review:"Do weryf.",approved:"Zatwierdzone",rejected:"Odrzucone"})[st] || st; }
  function statusBadgeHTML(st){
    const cls = {open:"badge-open",taken:"badge-taken",to_review:"badge-review",approved:"badge-approved",rejected:"badge-rejected"}[st] || "badge-open";
    return `<span class="badge-tag ${cls}">${statusLabel(st)}</span>`;
  }
  function classByStatus(st){ if (st==="approved"||st==="rejected") return st+" dim"; return st; }
  function horseshoesHTML(n){ return new Array(n).fill(0).map((_,i)=>`<span class="hs ${i<2?'fill':''}"></span>`).join(""); }
// ===== ARCHIWUM (dni poprzednie pod listami) =====
function isISO(iso){ return /^\d{4}-\d{2}-\d{2}$/.test(String(iso||"")); }
function daysBetween(aISO,bISO){ try{ const A=new Date(aISO+"T00:00:00"); const B=new Date(bISO+"T00:00:00"); return Math.round((A-B)/86400000); }catch{ return 0; } }
function withinLastNDays(iso, n){
  try{ const t=todayISO(); return isISO(iso) && (new Date(iso) < new Date(t)) && (daysBetween(t, iso) <= n); }catch{ return false; }
}
function isRide(t){ return t && (t.type==="jazda_grupowa" || t.type==="jazda_indywidualna"); }
function displayStatusForArchive(t){
  // Dla JAZD: jeśli data < dziś i zadanie istnieje → traktujemy jako „zrealizowane” (UI).
  if (isRide(t) && isISO(t.dateISO) && (new Date(t.dateISO) < new Date(todayISO()))) return "approved";
  return t.status || "open";
}
function compactRows(items, role){
  const me = (state.volunteer.name||"").trim();
  const mount = role==="instructor" ? $("#i-archive") : $("#v-archive");
  const more = !!(mount && mount.dataset.more === "1");
  const days = more ? 7 : 1;
  const filt = (mount && mount.dataset.filter) || "all";

  // Tylko przeszłość (wczoraj lub ostatnie 7 dni)
  const pastNDays = items.filter(t => isISO(t.dateISO) && withinLastNDays(t.dateISO, days));

  // Widoczność: Instruktor widzi wszystkie, Wolontariusz tylko swoje
  let visible = role==="instructor" ? pastNDays : pastNDays.filter(t => t.assignedTo === me);

  // Mini-filtr statusu
  if (filt !== "all"){
    visible = visible.filter(t => displayStatusForArchive(t) === filt);
  }
  if (!visible.length) return "";

  const head = `
    <thead><tr>
      <th>Data</th><th>Typ</th><th>Tytuł</th><th>Koń</th><th>Osoba</th><th>Punkty</th><th>Status</th>
    </tr></thead>`;

  const rows = visible.map(t=>{
    const st = displayStatusForArchive(t);
    const who = t.assignedTo || (t.rider || "");
    const type = (typeof typeLabel==="function") ? typeLabel(t.type||"") : (t.type||"").replace("_"," ");
    return `<tr class="st-${st}">
      <td>${isoToPL(t.dateISO)}</td>
      <td>${escapeHTML(type)}</td>
      <td>${escapeHTML(t.title||"—")}</td>
      <td>${escapeHTML(t.horse||"—")}</td>
      <td>${escapeHTML(who||"—")}</td>
      <td>${typeof t.points==="number" ? t.points : "—"}</td>
      <td>${statusLabel(st)}</td>
    </tr>`;
  }).join("");

  const headTitle = more ? "Zadania z ostatnich 7 dni" : "Zadania z wczoraj";
  const toggleLabel = more ? "Pokaż mniej" : "Pokaż więcej";
  const f = (val,lab)=>`<option value="${val}" ${(filt===val)?'selected':''}>${lab}</option>`;
  const roleId = role==="instructor" ? "instructor" : "volunteer";

  return `<div class="archive-wrap">
    <div class="archive-head">
      <h3 class="archive-title">${headTitle}</h3>
      <div class="archive-controls">
        <select id="arch-filter-${roleId}" class="archive-filter">
          ${f("all","Wszystkie")}
          ${f("approved","Zrealizowane")}
          ${f("to_review","Niezweryfikowane")}
          ${f("open","Niepodjęte")}
        </select>
        <button class="archive-toggle" data-role="${role}">${toggleLabel}</button>
      </div>
    </div>
    <table class="table report-table compact">${head}<tbody>${rows}</tbody></table>
  </div>`;
}
function renderInstructorArchive(items){
  const mount = $("#i-archive");
  if (!mount) return;
  mount.innerHTML = compactRows(items, "instructor");
  // Toggle „Pokaż więcej/mniej”
  mount.onclick = (e)=>{
    const btn = e.target.closest(".archive-toggle");
    if(!btn) return;
    mount.dataset.more = mount.dataset.more === "1" ? "0" : "1";
    mount.innerHTML = compactRows(items, "instructor");
  };
  // Mini-filtr statusu
  mount.onchange = (e)=>{
    if(!(e.target && e.target.classList.contains("archive-filter"))) return;
    mount.dataset.filter = e.target.value;
    mount.innerHTML = compactRows(items, "instructor");
  };
}
function renderVolunteerArchive(items){
  const mount = $("#v-archive");
  if (!mount) return;
  mount.innerHTML = compactRows(items, "volunteer");
  // Toggle „Pokaż więcej/mniej”
  mount.onclick = (e)=>{
    const btn = e.target.closest(".archive-toggle");
    if(!btn) return;
    mount.dataset.more = mount.dataset.more === "1" ? "0" : "1";
    mount.innerHTML = compactRows(items, "volunteer");
  };
  // Mini-filtr statusu
  mount.onchange = (e)=>{
    if(!(e.target && e.target.classList.contains("archive-filter"))) return;
    mount.dataset.filter = e.target.value;
    mount.innerHTML = compactRows(items, "volunteer");
  };
}



  function setCounts(prefix, items){
    try{
      const by = items.reduce((a,t)=>{ a.all++; a[t.status]=(a[t.status]||0)+1; return a; }, {all:0});
      if(prefix==="v"){
        $("#v-countAll") && ($("#v-countAll").textContent = by.all||0);
        $("#v-countOpen") && ($("#v-countOpen").textContent = by.open||0);
        $("#v-countTaken") && ($("#v-countTaken").textContent = by.taken||0);
        $("#v-countReview") && ($("#v-countReview").textContent = by.to_review||0);
        $("#v-countApproved") && ($("#v-countApproved").textContent = by.approved||0);
      }
    }catch(e){}
  }
  function setCountsInstructor(items){
    try{
      const by = items.reduce((a,t)=>{ a.all++; a[t.status]=(a[t.status]||0)+1; return a; }, {all:0});
      $("#i-countAll")&&($("#i-countAll").textContent = by.all||0);
      $("#i-countOpen")&&($("#i-countOpen").textContent = by.open||0);
      $("#i-countTaken")&&($("#i-countTaken").textContent = by.taken||0);
      $("#i-countReview")&&($("#i-countReview").textContent = by.to_review||0);
      $("#i-countApproved")&&($("#i-countApproved").textContent = by.approved||0);
      $("#i-countRejected")&&($("#i-countRejected").textContent = by.rejected||0);
    }catch(e){}
  }
function cardHTMLVolunteer(t){
  const meta = [
    isoToPL(t.dateISO),
    t.when ? `godz. ${t.when}` : null,
    t.horse ? `koń: ${t.horse}` : null,
    t.arena ? `miejsce: ${t.arena}` : null,
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
      <button class="btn small more" type="button" data-id="${t.id}">Szczegóły</button>
      ${quickButtonsVolunteer(t)}
    </div>
  </article>`;
}

function onOpenTask(e){
  try{
    const id = e?.currentTarget?.dataset?.id;
    if(!id) return;
    openTaskDetailsById(id);
  }catch(_){}
}


function quickButtonsVolunteer(t){
  const me = (state.volunteer.name||"").trim();
  if (t.status === "open")
    return `<button class="btn small take" type="button" data-id="${t.id}">Weź</button>`;
  if (t.assignedTo === me && t.status === "taken") {
    return `<button class="btn small done" type="button" data-id="${t.id}">Zgłoś Wykonanie</button>
            <button class="btn small ghost resign" type="button" data-id="${t.id}">Zrezygnuj</button>`;
  }
  return `<span class="meta"></span>`;
}
/* === FIX 3: awaryjna mapa typów dla filtra wolontariusza === */
function typeMapVolunteer(t){
  return t; // neutralnie: brak mapowania, brak błędu ReferenceError
}

  function renderVolunteer(){
  try{
    const me = (state.volunteer.name||"").trim();
    const today = todayISO();
    const vis = state.tasks.filter(t => t.type!=="jazda_grupowa" && t.type!=="jazda_indywidualna" && t.dateISO === today);

    setCounts("v", vis);

    // === Scoreboard ===
    const approvedMine = state.tasks.filter(t => t.assignedTo===me && t.status==="approved");
    const approvedPts = approvedMine.reduce((a,t)=> a + (+t.points||0), 0);
    const inCollection = state.tasks.filter(t => t.assignedTo===me && (t.status==="taken" || t.status==="to_review") && t.dateISO===today).length;

    const ap = document.getElementById("v-approvedPoints");
    const tk = document.getElementById("v-takenCount");
    if(ap) ap.textContent = String(approvedPts);
    if(tk) tk.textContent = String(inCollection);

    const q = (state.ui?.v?.search||"").toLowerCase();
    const typeFilter = document.getElementById("v-type")?.value || "";
    let items = vis;
    if (typeFilter) items = items.filter(t => t.type===typeFilter || typeMapVolunteer(t.type)===typeFilter);
    if (q) items = items.filter(t => [t.title,t.horse,t.arena].filter(Boolean).some(x=>String(x).toLowerCase().includes(q)));

    const list = document.getElementById("v-list");
    if(!list) return;
    list.className = "list";
list.innerHTML = items.map(cardHTMLVolunteer).join("");

// Jeden, pewny nasłuchiwacz na cały kontener (delegacja)
list.onclick = (ev)=>{
  const btn = ev.target.closest(".more, .take, .done, .resign");
  if(!btn || !list.contains(btn)) return;

  const id = btn.dataset.id;
  if(!id) return;

  // Podgląd (zostawiamy jak było)
  if(btn.classList.contains("more")){
    onOpenTask({ currentTarget: btn });
    return;
  }

  // Odnajdujemy zadanie tylko raz
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;

  if(btn.classList.contains("take")){
    // „Weź”
    takeTask(t, btn);
    return;
  }
  if(btn.classList.contains("done")){
    // „Zgłoś Wykonanie”
    markDone(t);
    return;
  }
  if(btn.classList.contains("resign")){
    // „Zrezygnuj”
    if (t.status!=="taken") return;
    t.status = "open";
    t.assignedTo = null;
    persistAll(); renderAll();
    toastMsg("Zrezygnowano z wykonania");
    return;
  }
};

} catch(e){ console.warn("renderVolunteer error", e); }
}


function onQuickTake(e){
  try{
    const id = e.currentTarget?.dataset?.id;
    const t  = state.tasks.find(x=>x.id===id);
    if(!t) return;
    takeTask(t, e.currentTarget);
  }catch(err){ console.warn("onQuickTake", err); }
}
  function onQuickDone(e){ try{ const id=e.currentTarget.dataset.id; const t=state.tasks.find(x=>x.id===id); if(t) markDone(t);}catch(_){ } }
  function onQuickResign(e){
    try{
      const id=e.currentTarget.dataset.id;
      const t=state.tasks.find(x=>x.id===id); if(!t) return;
      if (t.status!=="taken") return;
      t.status = "open";
      t.assignedTo = null;
      persistAll(); renderAll();
      toastMsg("Zrezygnowano z wykonania");
    }catch(_){}
  }
function takeTask(t, originEl){
  const me = (state.volunteer.name||"").trim();
  if(!me){ alert("Podaj swoje imię i zapisz."); return; }
  if(t.status!=="open"){ alert("To zadanie nie jest już wolne."); return; }

  t.status = "taken";
  t.assignedTo = me;

  // --- ANIMACJA PODKOWY (+punkty) ---
  const pts = Number.isFinite(+t.points) ? (+t.points) : 1;
  try{
    if (window.EF && typeof EF.animPoints === "function") {
      EF.animPoints(originEl || document.body, pts);
    } else {
      console.warn("EF.animPoints not available");
    }
  }catch(e){ console.warn("animPoints error", e); }

  persistAll();
  renderAll();
}


  function markDone(t){
    if(t.status!=="taken"){ toastMsg("Najpierw weź zadanie", {danger:true}); return; }
    t.status="to_review"; persistAll(); renderAll();
  }

  /* ===== RAPORTY ===== */
  function bindReportsUI(){
    try{
      $("#r-from") && ($("#r-from").value = state.ui.r.from);
      $("#r-to") && ($("#r-to").value = state.ui.r.to);
      $("#r-status") && ($("#r-status").value = state.ui.r.status||"");
      $("#r-view-list")?.addEventListener("click", ()=>{ state.ui.r.view="list"; setViewActive("r","list"); renderReports(); save(LS.UI,state.ui); });
      $("#r-from")?.addEventListener("change", ()=>{ state.ui.r.from=$("#r-from").value; renderReports(); save(LS.UI,state.ui); });
      $("#r-to")?.addEventListener("change", ()=>{ state.ui.r.to=$("#r-to").value; renderReports(); save(LS.UI,state.ui); });
      $("#r-status")?.addEventListener("change", ()=>{ state.ui.r.status=$("#r-status").value; renderReports(); save(LS.UI,state.ui); });
    }catch(e){ console.warn("bindReportsUI", e); }
  }
  function renderReports(){
    try{
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

      list.className = "";
      list.innerHTML = `
        <div style="overflow:auto">
          <table class="table report-table">
            <thead>
              <tr>
                <th>Data</th><th>Godz.</th><th>Typ</th><th>Tytuł</th>
                <th>Koń</th><th>Jeździec</th><th>Miejsce</th>
                <th>Status</th><th>Pkt</th><th>Przypisane</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(t=>`
                <tr>
                  <td>${escapeHTML(isoToPL(t.dateISO))}</td>
                  <td>${escapeHTML(t.when||"")}</td>
                  <td>${escapeHTML(typeLabel(t.type))}</td>
                  <td>${escapeHTML(t.title)}</td>
                  <td>${escapeHTML(t.horse||"")}</td>
                  <td>${escapeHTML(t.rider||"")}</td>
                  <td>${escapeHTML(t.arena||"")}</td>
                  <td>${escapeHTML(statusLabel(t.status))}</td>
                  <td>${escapeHTML(String(t.points||0))}</td>
                  <td>${escapeHTML(t.assignedTo||"")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }catch(e){ console.warn("renderReports error", e); }
  }

  /* ===== ADMIN ===== */
    function initAdmin(){
    try{
      const day = todayISO();
      $("#a-date") && ($("#a-date").value = day);

      // Formularz „Dodaj zadanie” (mirror Instruktora)
      $("#a-taskType")?.addEventListener("change", renderDynamicFieldsAdmin);
      renderDynamicFieldsAdmin();
      $("#a-add")?.addEventListener("click", addAdminTask);

      // Nagłówki grafików
      const title = $("#schedTitle");
      if (title) title.textContent = `Grafik dnia — ${isoToPL(day)}`;
      const titleProc = $("#schedProcTitle");
      if (titleProc) titleProc.textContent = `Grafik zabiegów dnia — ${isoToPL(day)}`;

      // Pierwsze renderowanie obu grafik
      renderAdmin();

      // Dodatkowe kontrolki (opcjonalne)
      $("#a-refresh")?.addEventListener("click", ()=>{ renderAdmin(); flash("#a-refresh","Odświeżono"); });
    }catch(e){ console.warn("initAdmin error", e); }
  }


  function populateAdminLevel(){
    try{
      const rideType = $("#a-rideType")?.value;
      const sel = $("#a-level");
      if(!sel) return;
      let opts = [];
      if(rideType==="jazda_grupowa") opts = LEVELS_GROUP;
      else if(rideType==="jazda_indywidualna") opts = LEVELS_INDIV;
      else if(rideType==="zabieg") opts = PROCEDURES;
      sel.innerHTML = opts.map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
    }catch(e){}
  }

  function refreshAdminSelects(){
    try{
      const horseSel = $("#a-horse"); const instrSel=$("#a-instructor");
      horseSel && (horseSel.innerHTML = state.horses.map(h=>`<option value="${escapeHTML(h.name)}">${escapeHTML(h.name)}</option>`).join(""));
      instrSel && (instrSel.innerHTML = state.instructors.map(i=>`<option value="${escapeHTML(i.id)}">${escapeHTML(i.label)}</option>`).join(""));
    }catch(e){}
  }

  function onAdminAddRider(){
    try{
      const first = $("#a-first")?.value.trim();
      const last  = $("#a-last")?.value.trim();
      const phone = $("#a-phone")?.value.trim();
      const email = $("#a-email")?.value.trim();
      const rideType = $("#a-rideType")?.value;
      const level = $("#a-level")?.value;
      const horse = $("#a-horse")?.value;
      const dateISO = $("#a-date")?.value || todayISO();
      const when = $("#a-when")?.value;
      const instructorId = $("#a-instructor")?.value;

      if(!first || !last || !when || !dateISO){ toastMsg("Uzupełnij imię, nazwisko, datę i godzinę", {danger:true}); return; }
      if((rideType==="jazda_grupowa"||rideType==="jazda_indywidualna") && (!level || !horse || !instructorId)){ toastMsg("Wybierz poziom, konia i instruktora", {danger:true}); return; }

      const vState = EQF_buildRidesState();
      const riderName = `${first} ${last}`;
      const newRide = { id:null, date:dateISO, time:when, horse, rider:riderName, instructor:instructorId, level:level||null };
      const vRes = V().validateRide(newRide, vState, { mode:"create" });
      if (vRes.errors.length) { V().showValidationMessages(vRes); return; }
      if (vRes.warnings.length) { V().showValidationMessages(vRes); }

      const r = { id:uid(), first, last, tel:phone, email, level, dateISO, when, instructorId, horse };
      state.riders.push(r);

      if(rideType==="jazda_grupowa" || rideType==="jazda_indywidualna"){
        const data = {arena:null, horse, rider:riderName, riderId:r.id, instructorId, when, dateISO, points:0, comments:"" };
        if(rideType==="jazda_grupowa")
          state.tasks.unshift(task(`Jazda Grupowa — ${level} • ${horse} • ${riderName}`,"jazda_grupowa",{...data, groupLevel:level}));
        else
          state.tasks.unshift(task(`Jazda Indywidualna — ${level} • ${horse} • ${riderName}`,"jazda_indywidualna",{...data, indivLevel:level}));
      }

      persistAll(); renderAll(); flash("#a-addRider", "Dodano zapis/zadanie");
    }catch(e){
      console.warn("onAdminAddRider", e);
      toastMsg("Błąd dodawania — sprawdź konsolę", {danger:true});
    }
  }

  function ensureRotateHint(){
    try{
      const wrap = $(".sched-wrap");
      if(!wrap) return;
      let hint = wrap.querySelector(".rotate-hint");
      if(!hint){
        hint = document.createElement("div");
        hint.className = "rotate-hint";
        hint.textContent = "Aby wygodniej przeglądać grafik — obróć telefon w poziom.";
        wrap.appendChild(hint);
      }
    }catch(e){}
  }

  function renderAdmin(){
    try{
      refreshAdminSelects();
      ensureRotateHint();

      const day = $("#a-day")?.value || todayISO();
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
      title && (title.textContent = `Grafik dnia — ${isoToPL(day)}`);
      if(!grid) return;
grid.innerHTML = "";

      grid.style.setProperty("--sched-cols", String(state.instructors.length));

      const header = document.createElement("div");
      header.className = "sched-row header";
      header.appendChild(el("div","sched-time","Godzina"));
      instructors.forEach(i=> header.appendChild(el("div","sched-slot", i.label)));
      grid.appendChild(header);

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
            slot.innerHTML = rs.map(r=>`
              <div class="rider" data-rid="${r.id}">
                ${escapeHTML(r.first)} ${escapeHTML(r.last)} • ${escapeHTML(r.horse||"—")} • ${escapeHTML(r.level||"—")}
                <button class="rider-del" title="Usuń z grafiku" aria-label="Usuń" data-rid="${r.id}">×</button>
              </div>
            `).join("");
          }
          row.appendChild(slot);
        });

        grid.appendChild(row);
      });

      grid.onclick = (ev)=>{
        try{
          const btn = ev.target.closest(".rider-del");
          if(!btn) return;
          const rid = btn.dataset.rid;
          if(!rid) return;

         state.riders = state.riders.filter(r => r.id !== rid);
          state.tasks  = state.tasks.filter(t => t.riderId !== rid);

          persistAll();
          renderAll();
          toastMsg("Zadanie usunięte");

        }catch(e){ console.warn("grid onclick", e); }
      };
// ====== GRAFIK ZABIEGÓW DNIA (transpose: konie=wiersze, typy=kolumny) ======
(function(){
  const gridP = $("#scheduleGridProc");
  const titleP = $("#schedProcTitle");
  const day = $("#a-day")?.value || todayISO();
  if (titleP) titleP.textContent = `Grafik zabiegów dnia — ${isoToPL(day)}`;
  if (!gridP) return;

  gridP.innerHTML = "";

  // wybierz zabiegi danego dnia
  const procs = state.tasks.filter(t => t.type==="zabieg" && t.dateISO===day);

  // wiersze = KONIE
  const horses = Array.from(new Set(procs.map(p=>p.horse||"—").filter(Boolean))).sort();

  // kolumny = TYPY zabiegów
  const types = Array.from(new Set(procs.map(p=>p.procType||"Zabieg"))).sort();

  gridP.style.setProperty("--sched-cols", String(Math.max(types.length, 1)));

  // header
  const headerP = document.createElement("div");
  headerP.className = "sched-row header";
  headerP.appendChild(el("div","sched-time","Koń"));
  if (types.length){
    types.forEach(tp => headerP.appendChild(el("div","sched-slot", tp)));
  } else {
    headerP.appendChild(el("div","sched-slot","Zabiegi"));
  }
  gridP.appendChild(headerP);

  // rows (po koniach)
  horses.forEach(h=>{
    const row = document.createElement("div");
    row.className = "sched-row";
    row.appendChild(el("div","sched-time", h));

    if (types.length){
      types.forEach(tp=>{
        const cell = el("div","sched-slot","");
        procs.filter(p => (p.horse||"—")===h && (p.procType||"Zabieg")===tp).forEach(p=>{
          const line = document.createElement("div");
          line.className = "rider";
          line.innerHTML = `
            ${escapeHTML(p.when || "—")}${p.arena ? " • " + escapeHTML(p.arena) : "" }
            <button class="rider-del proc-del" title="Usuń z grafiku" aria-label="Usuń" data-tid="${p.id}">×</button>
          `;
          cell.appendChild(line);
        });
        row.appendChild(cell);
      });
    } else {
      const cell = el("div","sched-slot","");
      procs.filter(p => (p.horse||"—")===h).forEach(p=>{
        const line = document.createElement("div");
        line.className = "rider";
        line.innerHTML = `
          ${escapeHTML(p.procType||"Zabieg")} • ${escapeHTML(p.when||"—")}
          <button class="rider-del proc-del" title="Usuń z grafiku" aria-label="Usuń" data-tid="${p.id}">×</button>
        `;
        cell.appendChild(line);
      });
      row.appendChild(cell);
    }

    gridP.appendChild(row);
  });

  // szybkie usuwanie zabiegu
  gridP.onclick = (ev)=>{
    try{
      const btn = ev.target.closest(".proc-del");
      if(!btn) return;
      const tid = btn.dataset.tid;
      if(!tid) return;
      // usuwamy samo zadanie-zabieg (nie ruszamy jeźdźców)
      state.tasks = state.tasks.filter(t => t.id !== tid);
      persistAll();
      renderAll();
    }catch(e){ console.warn("gridP onclick", e); }
  };
})();


    }catch(e){ console.warn("renderAdmin", e); }
  }

  /* ===== Eksport/Reset/Persist ===== */
  function exportCSV(){
    try{
      const me = (state.volunteer.name||"").trim();
      const rows = [["Data","Godzina","Tytuł","Koń","Miejsce","Status","Punkty"]];
      state.tasks.filter(t=>t.assignedTo===me).forEach(t=>{
        rows.push([t.dateISO, t.when||"", t.title, t.horse||"", t.arena||"", t.status, t.points]);
      });
      const csv = rows.map(r=>r.map(csvEscape).join(",")).join("\n");
      download(`equiflow_${me||"wolontariusz"}.csv`, csv, "text/csv");
    }catch(e){ console.warn("exportCSV error", e); }
  }
  function resetAll(){ try{ state.tasks = seedNow(); state.horses = seedHorses.slice(); state.instructors = seedInstructors.slice(); state.riders = seedRiders.slice(); persistAll(); renderAll(); }catch(e){} }
  function hardReset(){ try{ Object.values(LS).forEach(k=>localStorage.removeItem(k)); location.reload(); }catch(e){} }
  function persistAll(){
    try{
      save(LS.USER, state.volunteer);
      save(LS.TASKS, state.tasks);
      save(LS.SETTINGS, state.settings);
      save(LS.HORSES, state.horses);
      save(LS.RIDERS, state.riders);
      save(LS.INSTRUCTORS, state.instructors);
      save(LS.UI, state.ui);
    }catch(e){}
  }

  /* ===== Status helpers ===== */
  function typeLabel(t){ const m={"porządki":"Prace porządkowe","wyprowadzenie":"Wyprowadzenie","sprowadzenie":"Sprowadzenie","rozsiodłanie":"Rozsiodłanie","zabieg":"Zabieg","prep":"Przygotowanie do jazdy","jazda_grupowa":"Jazda Grupowa","jazda_indywidualna":"Jazda Indywidualna","dziennikarz":"Dziennikarz / Kronikarz","lonżowanie":"Lonżowanie","klinika":"Klinika","luzak":"Luzak"}; return m[t]||t; }
  function statusLabel(st){ return ({open:"Wolne",taken:"W trakcie",to_review:"Do weryf.",approved:"Zatwierdzone",rejected:"Odrzucone"})[st] || st; }
  function statusBadgeHTML(st){ const cls={open:"badge-open",taken:"badge-taken",to_review:"badge-review",approved:"badge-approved",rejected:"badge-rejected"}[st] || "badge-open"; return `<span class="badge-tag ${cls}">${statusLabel(st)}</span>`; }
  function classByStatus(st){ if (st==="approved"||st==="rejected") return st+" dim"; return st; }
  function setCounts(prefix, items){ const by = items.reduce((a,t)=>{ a.all++; a[t.status]=(a[t.status]||0)+1; return a; }, {all:0}); if(prefix==="v"){ $("#v-countAll")&&($("#v-countAll").textContent=by.all||0); $("#v-countOpen")&&($("#v-countOpen").textContent=by.open||0); $("#v-countTaken")&&($("#v-countTaken").textContent=by.taken||0); $("#v-countReview")&&($("#v-countReview").textContent=by.to_review||0); $("#v-countApproved")&&($("#v-countApproved").textContent=by.approved||0); } }
  function setCountsInstructor(items){ const by = items.reduce((a,t)=>{ a.all++; a[t.status]=(a[t.status]||0)+1; return a; }, {all:0}); $("#i-countAll")&&($("#i-countAll").textContent=by.all||0); $("#i-countOpen")&&($("#i-countOpen").textContent=by.open||0); $("#i-countTaken")&&($("#i-countTaken").textContent=by.taken||0); $("#i-countReview")&&($("#i-countReview").textContent=by.to_review||0); $("#i-countApproved")&&($("#i-countApproved").textContent=by.approved||0); $("#i-countRejected")&&($("#i-countRejected").textContent=by.rejected||0); }

  // Expose (opcjonalnie — przydatne w debug)
  window.EquiFlow = { hardReset, resetAll, exportCSV };

  console.log("EquiFlow v1.6.6 — załadowano (defensive build)");
})();
