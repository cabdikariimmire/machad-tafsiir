# معهد التفسير للعلوم الشرعية والعربية
## Internal Institute Management System

Private, responsive management application built with **React + Vite**, **Node.js + Express**, and **MySQL**.

---

### Project Structure
```
machad/
├── backend/            # Express REST API, MySQL Pool, Auth, Business Services
├── frontend/           # React + Vite Application, Responsive UI, Vanilla CSS
├── database/           # DDL Schema (schema.sql) and Initial Seed Data (seed.sql)
├── docs/               # Technical Documentation and Deployment Guide
├── mahad_system_specification.md # Primary requirements specification
└── IMPLEMENTATION_PROGRESS.md    # Multi-phase tracking document
```

### Quick Start

1. **Database:**
   Ensure MySQL is running, then load schema and seed data:
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS mahad_db;"
   mysql -u root -p mahad_db < database/schema.sql
   mysql -u root -p mahad_db < database/seed.sql
   ```
   For an existing installation, apply the additive financial migration after the backup:
   ```bash
   node database/migrate_financial_refactor.js
   ```
   Apply the additive Quran student-transfer history migration as well:
   ```bash
   node database/migrate_quran_student_transfers.js
   ```
   Apply the additive automatic-promotion safeguards migration:
   ```bash
   node database/migrate_automatic_promotions.js
   ```
   Apply the additive configurable connected-examinations migration:
   ```bash
   node database/migrate_configurable_exam_sets.js
   ```

2. **Backend API:**
   ```bash
   cd backend
   npm install
   npm run dev
   # Server runs at http://localhost:5000
   ```

3. **Frontend Client:**
   ```bash
   cd frontend
   npm install
   npm run dev
   # Client runs at http://localhost:5173
   ```

4. **Default Test Login:**
   - **Super Admin:** `superadmin` / `Admin@12345`
   - **Institute Admin:** `instadmin` / `Admin@12345`
   - **Quran Admin:** `quranadmin` / `Admin@12345`
   - **Finance User:** `finance_inst` / `Admin@12345`

For complete documentation, see [docs/DEPLOYMENT_GUIDE.md](file:///c:/Users/cxc/Desktop/machad/docs/DEPLOYMENT_GUIDE.md).
