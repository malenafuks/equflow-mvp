# EquiFlow – MVP (v1.5 → v1.6 roadmap)

EquiFlow to aplikacja **do zarządzania stajnią i wolontariuszami**, tworzona jako MVP (mobile-first, HTML/CSS/JS + LocalStorage, bez backendu, hostowana na GitHub Pages).

---

## 🚀 Stan obecny (v1.5)

- Repo: `equflow-mvp` (GitHub Pages).
- **index.html**: zakładki (Admin, Instruktor, Wolontariusz, Raporty).
- **styles.css**: jasny layout (beż/grafit), kafelki, sticky topbar, grafik admina z przewijaniem poziomym, overlay „obróć telefon”.
- **app-v1_5.js**:
  - Instruktor → dodaje jazdy (grupowe/indywidualne), zadania, zabiegi.
  - Admin → CRUD zapisów, grafik dzienny, dropdowny z poziomami.
  - Wolontariusz → podejmowanie zadań, zgłaszanie wykonania, historia punktów, eksport CSV.
  - Raporty → filtrowanie po datach/statusach, eksport.

✔ Synchronizacja jazd instruktora z grafikiem.  
✔ Usuwanie jazdy = ❌ w grafiku.  
✔ Kolorowe chipy/statusy, textarea większe na desktopie.  

---

## 🛠 Planowane zmiany (v1.6+)

### Walidacje i ograniczenia
- Koń ↔ jeździec / godzina (blokada duplikatów).  
- Limit 3 jazd dziennie / koń (4. i 5. = ostrzeżenie ⚠️, ale zapis).  
- Instruktor ↔ grupy / godzina (blokada).  
- Spójność poziomu w grupie (blokada).

### UI i funkcjonalności
- Usunięcie pola „Przypisz do”.  
- Ograniczenie usuwania zaakceptowanych zadań.  
- Możliwość rezygnacji z zadania (wraca do puli).  
- Wyszarzanie zadań wykonanych/zaakceptowanych.  
- Ulepszenie grafiku (responsywność, szybkie akcje).  

---

## 📅 Roadmapa

- **v1.6 (najbliższa)** → walidacje, blokady, UI grafiku, rezygnacja z zadań.  
- **v1.7** → import jeźdźców z Excela, grafik zabiegów/weterynarza, sklep za punkty.  
- **v1.8** → wersja EN, pełne poprawki UI, raporty z flagami naruszeń.  

---

## 🧑‍💻 Tech notes

- Mobile-first, HTML/CSS/JS, LocalStorage.
- Walidacje w jednej warstwie usług (`validateRide()`).
- Testy jednostkowe dla logiki (koń/godzina, limit, instruktor/godzina).
- Raporty → flagi naruszeń (⚠️).
- Import Excel → walidacja poprawności danych.

---

## ▶️ Uruchomienie lokalne

1. Sklonuj repo:
   ```bash
   git clone https://github.com/malenafuks/equflow-mvp.git
   cd equflow-mvp
