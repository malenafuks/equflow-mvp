
---

# 📌 README-EN.md (draft)

```markdown
# EquiFlow – MVP (v1.5 → v1.6 roadmap)

EquiFlow is a **stable & volunteer management app**, built as an MVP (mobile-first, HTML/CSS/JS + LocalStorage, no backend, hosted on GitHub Pages).

---

## 🚀 Current state (v1.5)

- Repo: `equflow-mvp` (GitHub Pages).
- **index.html**: tabs (Admin, Instructor, Volunteer, Reports).
- **styles.css**: light layout (beige/graphite), cards, sticky topbar, admin schedule with horizontal scroll, mobile overlay “rotate phone”.
- **app-v1_5.js**:
  - Instructor → add rides (group/individual), tasks, treatments.
  - Admin → CRUD bookings, daily schedule, level dropdowns.
  - Volunteer → take tasks, mark as done, points history, CSV export.
  - Reports → date/status filters, export.

✔ Instructor rides synced with admin schedule.  
✔ Ride deletion = ❌ in schedule.  
✔ Colored chips/statuses, larger textarea on desktop.  

---

## 🛠 Planned changes (v1.6+)

### Validations & rules
- Horse ↔ rider / time (no duplicates).  
- Horse limit: 3 rides/day (4th & 5th → ⚠️ warning, still saved).  
- Instructor ↔ groups / time (blocked).  
- Group level consistency (blocked).  

### UI & features
- Remove “Assign to” field.  
- Limit: accepted tasks cannot be deleted.  
- Volunteers can resign (task returns to pool).  
- Grey out completed/accepted tasks.  
- Improved schedule UI (responsive, quick actions).  

---

## 📅 Roadmap

- **v1.6 (next)** → validations, blocking, schedule UI, task resignation.  
- **v1.7** → Excel import (riders), horse treatment schedule, points shop.  
- **v1.8** → EN version, full UI polish, reports with violation flags.  

---

## 🧑‍💻 Tech notes

- Mobile-first, HTML/CSS/JS, LocalStorage.
- Validations in one service layer (`validateRide()`).
- Unit tests for logic (horse/time, limit, instructor/time).
- Reports → warning flags (⚠️).
- Excel import → input data validation.

---

## ▶️ Run locally

1. Clone the repo:
   ```bash
   git clone https://github.com/malenafuks/equflow-mvp.git
   cd equflow-mvp
