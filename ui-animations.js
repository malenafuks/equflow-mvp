// EquiFlow – animacje: reveal + punkty (podkowa)
(() => {
  // 1) Reveal (zostawiamy jak było, ale w jednej wersji pliku)
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!mql.matches) {
    const els = [...document.querySelectorAll('.reveal')];
    if (els.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.08 });
      els.forEach(el => io.observe(el));
    }
  }

  // 2) +Punkty przy „Weź” – złota podkowa
  // Używa styli .points-fly i .icon-points (styles.css)
  window.EF = window.EF || {};
  window.EF.animPoints = function(originEl, amount = 1){
    try{
      const src = originEl instanceof HTMLElement ? originEl : document.body;
      const r = src.getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'points-fly';
      el.innerHTML = `<span class="icon-points"></span><span class="amount">+${amount}</span>`;
      document.body.appendChild(el);
      // pozycja startowa – nad przyciskiem
      el.style.left = (r.left + r.width/2 + window.scrollX) + 'px';
      el.style.top  = (r.top  - 6 + window.scrollY) + 'px';
      // start animacji (CSS keyframes)
      requestAnimationFrame(()=> el.classList.add('animating'));
      setTimeout(()=> el.remove(), 1000);
    }catch(_){}
  };
})();


// EF.animPoints(target, amount = 1) – bąbelek z podkową i “+N”
(() => {
  window.EF = window.EF || {};
  window.EF.animPoints = function(target, amount = 1){
    try{
      const ref = (typeof target === "string") ? document.querySelector(target) : (target || document.body);
      if(!ref) return;
      const r = ref.getBoundingClientRect();
      const x = r.left + r.width/2;
      const y = r.top  + 8;

      const box = document.createElement("div");
      box.className = "points-fly";
      box.style.left = x + "px";
      box.style.top  = y + "px";
      box.innerHTML = `<span class="icon-points" aria-hidden="true"></span><span class="amount">+${amount}</span>`;

      document.body.appendChild(box);
      void box.offsetWidth; // start animacji
      box.classList.add("animating");
      setTimeout(() => box.remove(), 950);
    }catch(e){ console.warn("EF.animPoints error:", e); }
  };
})();

// === EF: animacja zdobycia punktów (ikona podkowy + "+N") ===
(() => {
  window.EF = window.EF || {};
  // EF.animPoints(target, amount = 1) — target: selektor lub element, obok którego pokaże się animacja
  window.EF.animPoints = function(target, amount=1){
    try{
      const ref = (typeof target==="string") ? document.querySelector(target) : target || document.body;
      if(!ref) return;
      const r = ref.getBoundingClientRect();
      const x = r.left + r.width/2;
      const y = r.top  + 8;

      const box = document.createElement("div");
      box.className = "points-fly";
      box.style.left = x+"px";
      box.style.top  = y+"px";
      box.innerHTML = `<span class="icon-points" aria-hidden="true"></span><span class="amount">+${amount}</span>`;

      document.body.appendChild(box);
      void box.offsetWidth; // start animacji
      box.classList.add("animating");
      setTimeout(()=> box.remove(), 950);
    }catch(e){ console.warn("EF.animPoints:", e); }
  };
})();
// === EF: animacja zdobycia punktów (ikona podkowy + "+N") ===
(() => {
  window.EF = window.EF || {};
  // EF.animPoints(target, amount = 1) — target: selektor lub element, obok którego pokaże się animacja
  window.EF.animPoints = function(target, amount=1){
    try{
      const ref = (typeof target==="string") ? document.querySelector(target) : target || document.body;
      if(!ref) return;
      const r = ref.getBoundingClientRect();
      const x = r.left + r.width/2;
      const y = r.top  + 8;

      const box = document.createElement("div");
      box.className = "points-fly";
      box.style.left = x+"px";
      box.style.top  = y+"px";
      box.innerHTML = `<span class="icon-points" aria-hidden="true"></span><span class="amount">+${amount}</span>`;

      document.body.appendChild(box);
      void box.offsetWidth; // start animacji
      box.classList.add("animating");
      setTimeout(()=> box.remove(), 950);
    }catch(e){ console.warn("EF.animPoints:", e); }
  };
})();
