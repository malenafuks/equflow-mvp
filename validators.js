/* EquiFlowValidation v1.6.6
   Zasady:
   1) Instruktor może mieć w tym samym slocie (data+godzina) wiele osób,
      ale wyłącznie na JEDNYM poziomie (np. kłus). Inny poziom o tej samej porze = BLOKADA.
   2) Limit pojemności grupy = 5 osób dla danego (instruktor, data, godzina, poziom) — powyżej = BLOKADA.
   3) Ostrzeżenie z potwierdzeniem: jeśli to będzie 4. (lub więcej) jazda danego konia tego dnia.
*/

(function () {
  "use strict";

  function uniq(x){ return Array.from(new Set(x)); }
  function normStr(s){ return String(s||"").trim().toLowerCase(); }

  /** vState.rides: [{ id,date,time,horse,rider,instructor,level }] */
  function validateRide(newRide, vState, opts = { mode: "create" }) {
    const errors = [];
    const warnings = [];
    let needsConfirm = false;

    // Normalizacja
    const date = newRide?.date || "";
    const time = newRide?.time || "";
    const horse = newRide?.horse || null;
    const rider = newRide?.rider || null;
    const instr = newRide?.instructor || null;
    const level = newRide?.level || null;

    const rides = Array.isArray(vState?.rides) ? vState.rides : [];

    // ===== 1) BLOKADA: mieszanie poziomów w tym samym slocie dla instruktora =====
    // Wyszukujemy wszystkie jazdy instruktora w tym samym dniu i o tej samej godzinie
    const sameSlot = rides.filter(r =>
      r.date === date &&
      r.time === time &&
      (r.instructor || null) === instr
    );

    if (sameSlot.length > 0) {
      // poziomy używane w tym slocie
      const levelsInSlot = uniq(sameSlot.map(r => (r.level || null)));
      // a) jeśli jest JAKIKOLWIEK inny poziom niż dodawany — blokada
      const hasDifferentLevel =
        levelsInSlot.some(l => l !== null && l !== level) ||
        (level !== null && levelsInSlot.some(l => l === null)); // gdy istnieje null-level w slocie, a my dodajemy poziom — też traktujemy jako inny

      if (hasDifferentLevel) {
        const prettyLvl = level || "—";
        const prettyExisting = uniq(levelsInSlot.map(l => l || "—")).join(", ");
        errors.push(
          `Instruktor ma już zajęcia ${date} o ${time} na innym poziomie (obecnie: ${prettyExisting}). ` +
          `Dla tego terminu dozwolony jest tylko jeden poziom. Wybrano: ${prettyLvl}.`
        );
      }

      // b) Limit pojemności grupy 5 osób w (instruktor, data, godzina, poziom)
      const sameSlotSameLevel = sameSlot.filter(r => (r.level || null) === (level || null));
      if (sameSlotSameLevel.length >= 5) {
        errors.push(`Limit 5 osób osiągnięty dla tego instruktora (${time}, poziom: ${level || "—"}).`);
      }
    }
    // ===== NEW) BLOKADA: ten sam jeździec o tej samej godzinie na INNYM koniu =====
    if (rider && time && date) {
      const sameRiderSameTime = rides.filter(r =>
        r.date === date &&
        r.time === time &&
        normStr(r.rider || "") === normStr(rider)
      );
      const conflict = sameRiderSameTime.find(r => normStr(r.horse || "") !== normStr(horse || ""));
      if (conflict) {
        errors.push(`Jeździec ${rider} ma już zapis na ${time} na koniu ${conflict.horse || "—"}. Nie można przypisać do innego konia o tej samej godzinie.`);
      }
    }

    // ===== 2) OSTRZEŻENIE: 4. (lub więcej) jazda tego konia w DANYM DNIU =====
    if (horse) {
      const sameDayHorseCount = rides.filter(r =>
        r.date === date && normStr(r.horse) === normStr(horse)
      ).length;

      // nowy wpis byłby (sameDayHorseCount + 1)
      if (sameDayHorseCount >= 3) {
        const nth = sameDayHorseCount + 1;
        warnings.push(
          `To będzie ${nth}. jazda konia ${horse} w dniu ${date}. Czy chcesz mimo to dodać?`
        );
        needsConfirm = true;
      }
    }

    return { errors, warnings, needsConfirm };
  }

  function showValidationMessages(res) {
    try {
      const toast = (msg, { danger = false } = {}) => {
  if (typeof window.toastMsg === "function") { window.toastMsg(msg, { danger }); return; }
  const el = document.querySelector("#toast");
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  if (danger) { el.style.background = "#b91c1c"; el.style.color = "#fff"; }
  el.classList.add("show");
  el.onclick = () => {
    el.classList.remove("show");
    el.style.background = ""; el.style.color = "";
    el.onclick = null;
  };
};

      (res?.errors || []).forEach(m => toast(m, { danger: true }));
      (res?.warnings || []).forEach(m => toast(m));
    } catch { /* no-op */ }
  }

  // Prosty modal potwierdzenia (współpracuje z #confirm z index.html)
  function confirmWarnings(res, onOk, onCancel) {
    const modal = document.querySelector("#confirm");
    const body = document.querySelector("#confirmBody");
    const btnOk = document.querySelector("#confirmOk");
    const btnCancel = document.querySelector("#confirmCancel");

    const close = () => { modal?.classList.add("hidden"); };

    if (!modal || !body || !btnOk || !btnCancel) {
      // Fallback do native confirm
      const txt = (res?.warnings || []).join("\n") + "\n\nKontynuować?";
      if (confirm(txt)) { onOk && onOk(); } else { onCancel && onCancel(); }
      return;
    }

    // Złóż komunikaty
    body.innerHTML = (res?.warnings || []).map(w => `<p>${w}</p>`).join("") || "<p>Kontynuować?</p>";
    modal.classList.remove("hidden");

    const onOkWrap = () => { try { onOk && onOk(); } finally { cleanup(); } };
    const onCancelWrap = () => { try { onCancel && onCancel(); } finally { cleanup(); } };

    function onEsc(ev){ if (ev.key === "Escape") onCancelWrap(); }
    function cleanup(){
      btnOk.removeEventListener("click", onOkWrap);
      btnCancel.removeEventListener("click", onCancelWrap);
      document.removeEventListener("keydown", onEsc);
      close();
    }

    btnOk.addEventListener("click", onOkWrap);
    btnCancel.addEventListener("click", onCancelWrap);
    document.addEventListener("keydown", onEsc);
  }

  // Eksport w globalu
  window.EquiFlowValidation = {
    validateRide,
    showValidationMessages,
    confirmWarnings
  };
})();
