# Buugga Dhismaha & Daabacaadda Nidaamka (Deployment & Operating Guide)

**Institution:** معهد التفسير للعلوم الشرعية والعربية  
**System:** Internal Management System (Nidaamka Maamulka Gudaha)  
**Technology Stack:** React + Vite, Node.js + Express, MySQL (`mysql2`), Vanilla CSS  
**Date:** October 2026  

---

## 1. Hordhac (Overview)
Nidaamkani waa nidaam gudaha ah oo si gaar ah loogu talagalay **معهد التفسير للعلوم الشرعية والعربية**. Waxa uu leeyahay laba waaxood oo kala madaxbannaan balse wadaaga hal xog-kaydiye (Database) iyo hal nidaam aqoonsi (Authentication):
1. **Waaxda Machadka (Institute Division):** Koorsooyinka, fasallada, jadwalka casharrada (Khamiis iyo Jimce oo keliya), xaadirinta, imtixaannada, iyo maaliyadda.
2. **Waaxda Dugsiga Quraanka (Quran School Division):** Halaqaadka, heerarka xifdiga, diiwaangelinta xifdiga maalinlaha/muraja'ada, imtixaannada, iyo maaliyadda.

---

## 2. Qalabka Loo Baahan Yahay (Prerequisites)
- **Node.js:** v18 ama ka cusub (waxaa lagu tijaabiyay Node v24.19.0).
- **npm:** v9 ama ka cusub.
- **MySQL Database Server:** v8.0 ama ka cusub (Adeegga MySQL waa inuu shaqaynayaa).

---

## 3. Qaab-dhismeedka Mashruuca (Directory Structure)
- `backend/` — API-ga Node.js + Express
  - `src/db/` — Xiriirka MySQL pool (`connection.js`)
  - `src/controllers/` — Hawlaha ganacsiga (Auth, Students, Institute, Quran, Attendance, Exams, Finance, Reports, Dashboard, Users)
  - `src/middleware/` — Ilaalinta amniga, doorarka (roles), iyo xadka waaxyaha (division scopes)
  - `src/routes/` — Dhuumaha API-yada
  - `tests/` — Baaritaannada tooska ah (`test_api.js`, `test_all_roles.js`)
- `frontend/` — Dhismaha hore ee React + Vite
  - `src/components/` — Qaybaha UI-ga (`Layout.jsx`, `NotificationBell.jsx`, `ReceiptModal.jsx`)
  - `src/context/` — Maamulka xaaladda isticmaalaha (`AuthContext.jsx`)
  - `src/pages/` — Bogagga nidaamka (Login, Dashboard, Students, Institute, Quran, Attendance, Exams, Finance, Reports, Users, AuditLogs)
  - `src/services/api.js` — Xiriiriyaha API-ga
- `database/` — Faylasha DDL schema (`schema.sql`) iyo xogta bilowga (`seed.sql`)
- `docs/` — Dukumintiyada farsamada

---

## 4. Dejinta Xog-kaydiyaha (Database Setup)

1. Gal MySQL oo abuur xog-kaydiyaha:
```sql
CREATE DATABASE IF NOT EXISTS mahad_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Geli qaab-dhismeedka jadwalka (Schema):
```bash
mysql -u root -p mahad_db < database/schema.sql
```

3. Geli xogta bilowga ah (Seed Data):
```bash
mysql -u root -p mahad_db < database/seed.sql
```

---

## 5. Isticmaalayaasha Bilowga ah (Default Credentials)

Dhammaan akoonnada tijaabada furahooda sirta ah (Password) waa: **`Admin@12345`**

| Magaca Gelitaanka (Username) | Doorka (Role) | Xadka Waaxda (Division Scope) | Ujeeddada |
|---|---|---|---|
| `superadmin` | Super Admin | `all` (Dhammaan) | Maamulaha guud ee nidaamka oo dhan |
| `instadmin` | Institute Admin | `institute` | Maamulaha Machadka (Keliya) |
| `quranadmin` | Quran Admin | `quran` | Maamulaha Dugsiga Quraanka (Keliya) |
| `finance_inst` | Finance User | `institute` | Qasnajiga Machadka |
| `finance_quran` | Finance User | `quran` | Qasnajiga Quraanka |
| `finance_all` | Finance User | `all` | Qasnajiga labada waaxoodba |
| `attendance_inst`| Attendance Officer | `institute` | Sarkaalka Xaadirinta Machadka |
| `exam_officer` | Examination Officer | `institute` | Sarkaalka Imtixaanaadka |
| `teacher_ali` | Teacher | `institute` | Macallinka Machadka |
| `teacher_ahmed` | Teacher | `quran` | Macallinka Dugsiga Quraanka |

---

## 6. Sida Loo Kiciyo Nidaamka (Running the Application)

### 1. Kici Server-ka (Backend)
```bash
cd backend
npm run dev
# Server-ku wuxuu ka shaqayn doonaa: http://localhost:5000
# Dhuunta caafimaadka: http://localhost:5000/api/health
```

### 2. Kici Dhismaha Hore (Frontend)
```bash
cd frontend
npm run dev
# Frontend-ku wuxuu ka kici doonaa: http://localhost:5173
```

---

## 7. Orodka Baaritaannada Tooska ah (Running Tests)
Nidaamku wuxuu leeyahay laba xirmo oo baaritaan oo dhammaystiran:

1. **Baaritaanka Dhuumaha API & Amniga:**
```bash
cd backend
node tests/test_api.js
```

2. **Baaritaanka Dhammaan Doorarka (End-to-End Roles Suite):**
```bash
cd backend
node tests/test_all_roles.js
```

---

## 8. Kaydinta & Soo Celinta Xogta (Backup & Restore Procedures)

### Kaydinta (Backup)
```bash
mysqldump -u root -p mahad_db > backups/mahad_db_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Soo Celinta (Restore)
```bash
mysql -u root -p mahad_db < backups/mahad_db_backup_YYYYMMDD.sql
```

---

## 9. Xeerarka Amniga ee Lagu Dhaqmay (Security Safeguards)
- **Kala-soocnaanta Waaxyaha (Division Scope Isolation):** Maamulaha ama qasnajiga Machadku ma arki karo mana wax ka beddeli karo xogta Quraanka; maamulaha Quraankuna ma arki karo Machadka.
- **Xaadirinta Machadka:** Waxaa lagu xaddiday Khamiis iyo Jimce oo keliya heer koodh iyo heer xog-kaydiye.
- **Maaliyadda:** Ma jiro wax goob ah oo ah *Payment Method* (lacag caddaan, zaad, sahal, bangi lama gelinayo sida lagu heshiiyay). Lacagta waxaa lagu kaydiyaa `DECIMAL(10,2)` si aysan u dhicin wax lumis ah.
- **Rasiidyo Gaar ah (Unique Receipts):** Rasiid kastaa wuxuu leeyahay lambar gaar ah oo aan la labanlaabi karin.
- **Ilaalinta Excel (Formula Injection Guard):** Qoraallada ku bilowda `=`, `+`, `-`, `@` waa laga ilaaliyay in ay foomam ka noqdaan Excel.
