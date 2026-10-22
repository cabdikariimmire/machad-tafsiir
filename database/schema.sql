-- ============================================================================
-- معهد التفسير للعلوم الشرعية والعربية
-- Schema: Internal Management System
-- Database: mahad_db
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. SESSIONS TABLE (express-mysql-session)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT(11) UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. USERS, ROLES, PERMISSIONS, AND SCOPES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  UNIQUE KEY uk_perm (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NULL,
  phone VARCHAR(30) NULL,
  role_id INT NOT NULL,
  division_scope ENUM('all', 'institute', 'quran', 'none') NOT NULL DEFAULT 'institute',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_role (role_id),
  INDEX idx_user_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Specific user module permission overrides if needed
CREATE TABLE IF NOT EXISTS user_module_scopes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module VARCHAR(50) NOT NULL,
  division ENUM('institute', 'quran', 'both') NOT NULL,
  can_view BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_mod (user_id, module, division)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. AUDIT LOGS AND NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  division ENUM('institute', 'quran', 'system') NOT NULL DEFAULT 'system',
  record_id VARCHAR(100) NULL,
  details TEXT NULL,
  before_value JSON NULL,
  after_value JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_module (module, division)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL, -- NULL means broadcast to Super Admins
  type VARCHAR(50) NOT NULL, -- e.g. 'payment_recorded', 'fee_adjusted', 'system'
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  division ENUM('institute', 'quran', 'system') NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. SHARED STUDENT IDENTITY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(30) NOT NULL UNIQUE, -- e.g. STU-2026-001
  full_name VARCHAR(150) NOT NULL,
  gender ENUM('male', 'female') NOT NULL DEFAULT 'male',
  phone VARCHAR(30) NOT NULL,
  guardian_name VARCHAR(150) NULL,
  guardian_phone VARCHAR(30) NULL,
  guardian_relationship VARCHAR(50) NULL,
  address VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_student_name (full_name),
  INDEX idx_student_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. INSTITUTE DIVISION TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS institute_courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institute_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES institute_courses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institute_classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NULL,
  name VARCHAR(100) NOT NULL, -- e.g. "Fasalka 1-aad", "Level 1"
  section VARCHAR(50) NULL,
  academic_year VARCHAR(30) NOT NULL DEFAULT '2026',
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  next_class_id INT NULL,
  graduation_pass_threshold DECIMAL(5,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES institute_courses(id) ON DELETE SET NULL,
  FOREIGN KEY (next_class_id) REFERENCES institute_classes(id) ON DELETE SET NULL,
  UNIQUE KEY uk_class_name_year (name, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institute_enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  class_id INT NOT NULL,
  enrollment_date DATE NOT NULL,
  status ENUM('active', 'suspended', 'completed', 'graduated', 'withdrawn') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_inst_enrollment (student_id, class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institute_class_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  subject_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES institute_subjects(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_class_subject (class_id, subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institute_teacher_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL, -- references users table with role 'teacher'
  class_id INT NOT NULL,
  subject_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES institute_subjects(id) ON DELETE CASCADE,
  UNIQUE KEY uk_inst_teacher_assign (teacher_id, class_id, subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Timetable (all weekdays supported)
CREATE TABLE IF NOT EXISTS institute_timetable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_id INT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(50) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES institute_subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Institute Class Sessions (created when recording attendance)
CREATE TABLE IF NOT EXISTS institute_class_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  session_date DATE NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  recorded_by INT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_inst_session (class_id, session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Institute Attendance
CREATE TABLE IF NOT EXISTS institute_attendance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'present',
  remarks VARCHAR(255) NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES institute_class_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uk_inst_att (session_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Institute Exams
CREATE TABLE IF NOT EXISTS institute_exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  academic_year VARCHAR(30) NOT NULL DEFAULT '2026',
  exam_set_id INT NULL,
  class_id INT NOT NULL,
  subject_id INT NOT NULL,
  exam_date DATE NOT NULL,
  maximum_marks DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  status VARCHAR(30) NOT NULL DEFAULT 'draft', -- 'draft', 'marks_entry', 'finalized', 'published'
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE RESTRICT,
  FOREIGN KEY (subject_id) REFERENCES institute_subjects(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_inst_exam_dup (class_id, subject_id, title, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Connected examination configurations. Existing exam records remain valid
-- when exam_set_id is NULL; new configurable workflows use these relationships.
CREATE TABLE IF NOT EXISTS institute_exam_sets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  academic_year VARCHAR(30) NOT NULL,
  description TEXT NULL,
  status ENUM('configured', 'confirmed', 'closed') NOT NULL DEFAULT 'configured',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_exam_set_year (academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institute_exam_set_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_set_id INT NOT NULL,
  exam_period_id INT NOT NULL,
  sequence_order INT NOT NULL DEFAULT 1,
  maximum_marks DECIMAL(7,2) NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_set_id) REFERENCES institute_exam_sets(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_exam_set_member (exam_set_id, exam_period_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Institute Marks
CREATE TABLE IF NOT EXISTS institute_exam_marks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  marks_obtained DECIMAL(5,2) NULL,
  is_absent BOOLEAN NOT NULL DEFAULT FALSE,
  percentage DECIMAL(5,2) NULL,
  grade VARCHAR(10) NULL,
  notes VARCHAR(255) NULL,
  entered_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES institute_exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_inst_exam_student (exam_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. QURAN SCHOOL DIVISION TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quran_levels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE, -- e.g. "Heerka 1-aad (Hifdh)", "Qiraa'ooyinka"
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quran_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level_id INT NULL,
  name VARCHAR(100) NOT NULL, -- e.g. "Halaqada Al-Nuur"
  shift ENUM('morning', 'afternoon', 'evening') NOT NULL DEFAULT 'morning',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (level_id) REFERENCES quran_levels(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quran_enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  group_id INT NOT NULL,
  enrollment_date DATE NOT NULL,
  status ENUM('active', 'suspended', 'completed', 'withdrawn') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (group_id) REFERENCES quran_groups(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_quran_enrollment (student_id, group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quran_student_transfer_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  from_group_id INT NOT NULL,
  to_group_id INT NOT NULL,
  transfer_date DATE NOT NULL,
  reason TEXT NULL,
  transferred_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (from_group_id) REFERENCES quran_groups(id) ON DELETE RESTRICT,
  FOREIGN KEY (to_group_id) REFERENCES quran_groups(id) ON DELETE RESTRICT,
  FOREIGN KEY (transferred_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_quran_transfer_student_date (student_id, transfer_date),
  INDEX idx_quran_transfer_from_group (from_group_id),
  INDEX idx_quran_transfer_to_group (to_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quran_teacher_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  group_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES quran_groups(id) ON DELETE CASCADE,
  UNIQUE KEY uk_quran_teacher_group (teacher_id, group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quran_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  session_date DATE NOT NULL,
  recorded_by INT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES quran_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_quran_session (group_id, session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quran_attendance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'present',
  remarks VARCHAR(255) NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES quran_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uk_quran_att (session_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quran Progress (Hifdh tracking: Surah, Ayat, Juz, Revision / Muraja'ah)
CREATE TABLE IF NOT EXISTS quran_progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  group_id INT NOT NULL,
  record_date DATE NOT NULL,
  current_juz INT NULL,
  surah_name VARCHAR(100) NOT NULL,
  from_ayah INT NULL,
  to_ayah INT NULL,
  revision_summary TEXT NULL,
  rating ENUM('mumtaz', 'jayid_jiddan', 'jayid', 'maqbul', 'daeef') NOT NULL DEFAULT 'mumtaz',
  recorded_by INT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (group_id) REFERENCES quran_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_quran_prog_student (student_id, record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quran_exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  group_id INT NOT NULL,
  exam_date DATE NOT NULL,
  maximum_marks DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  status ENUM('draft', 'marks_entry', 'published') NOT NULL DEFAULT 'draft',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES quran_groups(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quran_exam_marks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  marks_obtained DECIMAL(5,2) NULL,
  is_absent BOOLEAN NOT NULL DEFAULT FALSE,
  percentage DECIMAL(5,2) NULL,
  grade VARCHAR(10) NULL,
  notes VARCHAR(255) NULL,
  entered_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES quran_exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (entered_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_quran_exam_student (exam_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. FINANCIAL MANAGEMENT TABLES
-- ----------------------------------------------------------------------------
-- Official Fee Rules configured by Super Admin
CREATE TABLE IF NOT EXISTS fee_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  division ENUM('institute', 'quran') NOT NULL,
  fee_type ENUM('monthly', 'registration') NOT NULL DEFAULT 'monthly',
  class_id INT NULL, -- if institute
  group_id INT NULL, -- if quran
  billing_period VARCHAR(50) NOT NULL, -- e.g. "2026-05 (May-June)", "Monthly", etc.
  standard_fee DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES quran_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_fee_rules_div (division, billing_period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Approved Student Discounts managed by Super Admin
CREATE TABLE IF NOT EXISTS student_discounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  division ENUM('institute', 'quran', 'both') NOT NULL,
  discount_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed',
  discount_value DECIMAL(10,2) NOT NULL, -- amount or %
  reason VARCHAR(255) NOT NULL,
  billing_period VARCHAR(50) NULL, -- specific period or NULL for all periods
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_discount_student (student_id, division)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fee Invoices / Obligations
CREATE TABLE IF NOT EXISTS fee_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  student_id INT NOT NULL,
  division ENUM('institute', 'quran') NOT NULL,
  fee_type ENUM('monthly', 'registration') NOT NULL DEFAULT 'monthly',
  class_id INT NULL,
  group_id INT NULL,
  billing_period VARCHAR(50) NOT NULL,
  standard_fee DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  amount_due DECIMAL(10,2) NOT NULL, -- standard_fee - discount_amount
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(10,2) NOT NULL, -- amount_due - amount_paid
  status ENUM('unpaid', 'partial', 'paid') NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE SET NULL,
  FOREIGN KEY (group_id) REFERENCES quran_groups(id) ON DELETE SET NULL,
  UNIQUE KEY uk_invoice_obligation (student_id, division, fee_type, billing_period),
  INDEX idx_invoice_status (division, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments (NO PAYMENT METHOD COLUMN as strictly specified)
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_id INT NOT NULL,
  student_id INT NOT NULL,
  division ENUM('institute', 'quran') NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  received_by INT NOT NULL,
  notes TEXT NULL,
  status ENUM('valid', 'adjusted', 'reversed') NOT NULL DEFAULT 'valid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES fee_invoices(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_payment_student (student_id),
  INDEX idx_payment_div_date (division, payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment Adjustments / Controlled Reversals (Audited overrides)
CREATE TABLE IF NOT EXISTS payment_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  old_amount DECIMAL(10,2) NOT NULL,
  new_amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('applied', 'pending_approval', 'rejected') NOT NULL DEFAULT 'applied',
  adjusted_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. ACADEMIC-YEAR EXAM PLANS, TIMETABLES & PROMOTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_year_assessment_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academic_year VARCHAR(30) NOT NULL UNIQUE,
  marking_mode ENUM('mode_a', 'mode_b') NOT NULL DEFAULT 'mode_b',
  mode_b_calculation ENUM('average', 'final_only') NOT NULL DEFAULT 'average',
  pass_threshold DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exam_timetables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academic_year VARCHAR(30) NOT NULL DEFAULT '2026',
  exam_period_id INT NOT NULL,
  class_id INT NOT NULL,
  subject_id INT NOT NULL,
  exam_date DATE NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes VARCHAR(255) NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_period_id) REFERENCES exam_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES institute_subjects(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_exam_timetable_slot (class_id, exam_period_id, subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_promotion_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  from_academic_year VARCHAR(30) NOT NULL,
  to_academic_year VARCHAR(30) NOT NULL,
  from_class_id INT NOT NULL,
  to_class_id INT NULL,
  outcome ENUM('promoted', 'retained', 'graduated', 'manual_override') NOT NULL,
  overall_total DECIMAL(7,2) NULL,
  overall_percentage DECIMAL(5,2) NULL,
  is_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT NULL,
  processed_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (from_class_id) REFERENCES institute_classes(id) ON DELETE RESTRICT,
  FOREIGN KEY (to_class_id) REFERENCES institute_classes(id) ON DELETE SET NULL,
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_student_promotion_year (student_id, from_academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotion_result_confirmations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  academic_year VARCHAR(30) NOT NULL,
  confirmed_by INT NOT NULL,
  confirmation_note TEXT NULL,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES institute_classes(id) ON DELETE RESTRICT,
  FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_promotion_result_confirmation (class_id, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
