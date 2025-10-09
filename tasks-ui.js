// EquiFlow – skórka + chipy (v4.3 DOM-only, bez zmian logiki app.js)
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  /* -------------------- KARTY: miękki skin -------------------- */
  function styleCard(card){
    if(!(card instanceof HTMLElement)) return;
    if(!card.closest('#i-list, #v-list, #r-list')) return; // tylko listy zadań
    card.classList.add('task-card'); // sam CSS robi resztę
  }
  function styleAll(){ $$('#i-list .card, #v-list .card, #r-list .card').forEach(styleCard); }
  function observeCards(){
    const mo = new MutationObserver(recs=>{
      for(const r of recs){
        r.addedNodes.forEach(n=>{
          if(!(n instanceof HTMLElement)) return;
          if(n.matches('.card')) styleCard(n);
          $$('.card', n).forEach(styleCard);
        });
      }
    });
    mo.observe(document.body, {childList:true, subtree:true});
  }

  /* -------------------- CHIPY: filtracja DOM -------------------- */
  const P = {
    i: {
      all:      el => true,
      open:     el => el.classList.contains('open'),
      taken:    el => el.classList.contains('taken'),
      to_review:el => el.classList.contains('to_review'),
      approved: el => el.classList.contains('approved'),
      rejected: el => el.classList.contains('rejected'),
      future:   el => el.classList.contains('future'),
      container:'#i-list'
    },
    v: {
      all:      el => true,
      open:     el => el.classList.contains('open'),
      taken:    el => el.classList.contains('taken'),
      to_review:el => el.classList.contains('to_review'),
      approved: el => el.classList.contains('approved'),
      // „Tylko moje” – karta ma przycisk .done (po wzięciu przez mnie)
      mine:     el => !!$('.done', el),
      container:'#v-list'
    }
  };

  function applyFilter(prefix, key){
    const conf = P[prefix];
    const list = $(conf.container);
    if(!list) return;
    const test = conf[key] || (()=>true);
    const cards = $$('.card', list);
    cards.forEach(el => {
      el.style.display = test(el) ? '' : 'none';
    });
  }

  function setActiveChip(btn){
    const wrap = btn.closest('.chips, .i-chips');
    if(!wrap) return;
    $$('.chip', wrap).forEach(c => c.classList.remove('chip-active'));
    btn.classList.add('chip-active');
  }

  function wireChips(){
    // Instruktor
    const iMap = {
      'i-chipAll':'all',
      'i-chipOpen':'open',
      'i-chipTaken':'taken',
      'i-chipReview':'to_review',
      'i-chipApproved':'approved',
      'i-chipRejected':'rejected',
      'i-chipFuture':'future'
    };
    Object.entries(iMap).forEach(([id,key])=>{
      const b = document.getElementById(id);
      if(!b) return;
      b.addEventListener('click', (e)=>{
        setActiveChip(b);
        applyFilter('i', key);
      });
    });

    // Wolontariusz
    const vMap = {
      'v-chipAll':'all',
      'v-chipOpen':'open',
      'v-chipTaken':'taken',
      'v-chipReview':'to_review',
      'v-chipApproved':'approved',
      'v-chipMine':'mine'
    };
    Object.entries(vMap).forEach(([id,key])=>{
      const b = document.getElementById(id);
      if(!b) return;
      b.addEventListener('click', ()=>{
        setActiveChip(b);
        applyFilter('v', key);
      });
    });
  }

  /* -------------------- INIT -------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    styleAll();
    observeCards();
    wireChips();

    // Domyślnie: pokaż to, co już było aktywne w HTML (Wszystkie)
    applyFilter('i','all');
    applyFilter('v','all');
  });
})();
