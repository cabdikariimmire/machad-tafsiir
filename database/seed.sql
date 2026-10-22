-- ============================================================================
-- Seed Data for معهد التفسير للعلوم الشرعية والعربية
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Roles
INSERT INTO roles (id, name, display_name, description) VALUES
(1, 'super_admin', 'Super Admin (Maamulaha Guud)', 'Full control across all institute and quran systems'),
(2, 'institute_admin', 'Institute Admin (Maamulaha Machadka)', 'Full management of institute academic, students, fees, attendance, and exams'),
(3, 'quran_admin', 'Quran Admin (Maamulaha Dugsiga Quraanka)', 'Full management of quran school, hifdh, groups, fees, and exams'),
(4, 'finance_user', 'Finance User (Qasnajiga/Maaliyadda)', 'Access to fees, payment processing, receipts, and financial reports'),
(5, 'attendance_officer', 'Attendance Officer (Sarkaalka Xaadirinta)', 'Records and monitors student attendance'),
(6, 'examination_officer', 'Examination Officer (Sarkaalka Imtixaanaadka)', 'Manages exams, marks entry, and exam reports'),
(7, 'teacher', 'Teacher (Macallinka)', 'Access to assigned classes, student lists, attendance, and marks')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

-- 2. Users (Password for all default test accounts: Admin@12345)
-- Hash: $2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW
INSERT INTO users (id, username, password_hash, full_name, email, phone, role_id, division_scope, is_active) VALUES
(1, 'superadmin', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Sheekh Cabdullaahi Maxamed (Super Admin)', 'admin@mahad.edu', '+252615000001', 1, 'all', 1),
(2, 'instadmin', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Ustadh Xasan Cali (Institute Admin)', 'instadmin@mahad.edu', '+252615000002', 2, 'institute', 1),
(3, 'quranadmin', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Macallin Ibraahim Xuseen (Quran Admin)', 'quranadmin@mahad.edu', '+252615000003', 3, 'quran', 1),
(4, 'finance_inst', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Faadumo Axmed (Finance Institute)', 'finance1@mahad.edu', '+252615000004', 4, 'institute', 1),
(5, 'finance_quran', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Khadar Maxamuud (Finance Quran)', 'finance2@mahad.edu', '+252615000005', 4, 'quran', 1),
(6, 'finance_all', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Maryan Cabdi (Finance All Divisions)', 'finance_all@mahad.edu', '+252615000006', 4, 'all', 1),
(7, 'attendance_inst', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Yuusuf Cumar (Attendance Officer)', 'attendance@mahad.edu', '+252615000007', 5, 'institute', 1),
(8, 'exam_officer', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Mustaf Jaamac (Exam Officer)', 'exam@mahad.edu', '+252615000008', 6, 'institute', 1),
(9, 'teacher_ali', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Sheekh Cali Nuur (Institute Teacher)', 'ali.teacher@mahad.edu', '+252615000009', 7, 'institute', 1),
(10, 'teacher_ahmed', '$2a$10$frKEe.baseIf5u/Npnnfre2V.S9zNVNqZfwiOMvlM6XhuVYgmjdMW', 'Macallin Axmed Cabdulle (Quran Teacher)', 'ahmed.teacher@mahad.edu', '+252615000010', 7, 'quran', 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- 3. Institute Courses & Subjects
INSERT INTO institute_courses (id, code, name, description) VALUES
(1, 'CRS-TAF', 'Shareecada & Tafsiirka', 'Koorada Tafsiirka iyo Culuumta Shareecada'),
(2, 'CRS-ARB', 'Luqadda Carabiga', 'Koorada Luqadda Carabiga iyo Naxwaha')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO institute_subjects (id, course_id, code, name, description) VALUES
(1, 1, 'SUB-TAF01', 'Tafsiirka Quraanka Kariimka', 'Tafsiirka suuradaha quraanka'),
(2, 1, 'SUB-XAD01', 'Xadiith (Al-Arbaciin An-Nawawiyyah)', 'Culuumta Xadiithka'),
(3, 1, 'SUB-FIQ01', 'Fiqiga Islaamka (Safinatun-Najaah)', 'Fiqiga cibaadaadka'),
(4, 2, 'SUB-NAX01', 'Al-Aajurroomiyyah (Naxwe)', 'Qawaacida naxwaha carabiga'),
(5, 2, 'SUB-SAR01', 'Sarfka Carabiga', 'Dhismaha ereyada carabiga')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO institute_classes (id, course_id, name, section, academic_year) VALUES
(1, 1, 'Sanadka 1-aad (Tafsiir)', 'Qaybta A', '2026'),
(2, 1, 'Sanadka 2-aad (Tafsiir)', 'Qaybta A', '2026'),
(3, 2, 'Fasalka Naxwaha & Luqadda', 'Qaybta B', '2026')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 4. Quran Levels & Groups
INSERT INTO quran_levels (id, name, description) VALUES
(1, 'Heerka Bilowga (Higaadda & Cammada)', 'Barashada xarfaha iyo Juz Camma'),
(2, 'Heerka Dhexe (10-ka Juz ee Dhexe)', 'Hifdiga juzaska 1 ilaa 15'),
(3, 'Heerka Dhameystirka (Xifdiga Buuxa)', 'Khatiminta Quraanka Kariimka iyo Tajweedka')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO quran_groups (id, level_id, name, shift) VALUES
(1, 1, 'Halaqada Al-Nuur (Subax)', 'morning'),
(2, 2, 'Halaqada Al-Furuuq (Galab)', 'afternoon'),
(3, 3, 'Halaqada Al-Ikhlaas (Fiid)', 'evening')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 5. Sample Students (with shared identity demonstrating cross-enrollment)
INSERT INTO students (id, student_id, full_name, gender, phone, guardian_name, guardian_phone, address, is_active) VALUES
(1, 'STU-2026-001', 'Maxamed Cabdi Cilmi', 'male', '+252615111111', 'Cabdi Cilmi', '+252615111112', 'Hodan, Muqdisho', 1),
(2, 'STU-2026-002', 'Cabdiraxmaan Xasan Cali', 'male', '+252615222222', 'Xasan Cali', '+252615222223', 'Wadajir, Muqdisho', 1),
(3, 'STU-2026-003', 'Faadumo Cumar Nuur', 'female', '+252615333333', 'Cumar Nuur', '+252615333334', 'Yaaqshiid, Muqdisho', 1),
(4, 'STU-2026-004', 'Bilal Maxamuud Guuleed', 'male', '+252615444444', 'Maxamuud Guuleed', '+252615444445', 'Deyniile, Muqdisho', 1),
(5, 'STU-2026-005', 'Xaliimo Ibraahim Warsame', 'female', '+252615555555', 'Ibraahim Warsame', '+252615555556', 'Howlwadaag, Muqdisho', 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- Enrollments:
-- Student 1: Enrolled in BOTH Institute (Class 1) and Quran (Group 1) -> Shared student identity!
-- Student 2: Institute only (Class 1)
-- Student 3: Institute only (Class 2)
-- Student 4: Quran only (Group 1)
-- Student 5: Quran only (Group 2)
INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status) VALUES
(1, 1, '2026-01-10', 'active'),
(2, 1, '2026-01-10', 'active'),
(3, 2, '2026-01-10', 'active')
ON DUPLICATE KEY UPDATE status = VALUES(status);

INSERT INTO quran_enrollments (student_id, group_id, enrollment_date, status) VALUES
(1, 1, '2026-01-10', 'active'),
(4, 1, '2026-01-10', 'active'),
(5, 2, '2026-01-10', 'active')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Teacher assignments
INSERT INTO institute_teacher_assignments (teacher_id, class_id, subject_id) VALUES
(9, 1, 1),
(9, 1, 3)
ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id);

INSERT INTO quran_teacher_assignments (teacher_id, group_id) VALUES
(10, 1)
ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id);

-- Timetable (Institute: Thursday and Friday only)
INSERT INTO institute_timetable (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room) VALUES
(1, 1, 9, 'Thursday', '07:30:00', '09:00:00', 'Qolka 1'),
(1, 3, 9, 'Thursday', '09:15:00', '10:45:00', 'Qolka 1'),
(1, 1, 9, 'Friday', '07:30:00', '09:00:00', 'Qolka 1')
ON DUPLICATE KEY UPDATE room = VALUES(room);

-- Official Fee Rules (configured by Super Admin)
INSERT INTO fee_rules (id, division, class_id, group_id, billing_period, standard_fee, is_active, created_by) VALUES
(1, 'institute', 1, NULL, '2026-05', 25.00, 1, 1),
(2, 'institute', 2, NULL, '2026-05', 30.00, 1, 1),
(3, 'quran', NULL, 1, '2026-05', 20.00, 1, 1),
(4, 'quran', NULL, 2, '2026-05', 20.00, 1, 1)
ON DUPLICATE KEY UPDATE standard_fee = VALUES(standard_fee);

-- Approved Student Discounts (e.g. Student 1 has a $5 discount for Institute)
INSERT INTO student_discounts (id, student_id, division, discount_type, discount_value, reason, billing_period, approved_by) VALUES
(1, 1, 'institute', 'fixed', 5.00, 'Dhimis sabab arday firfircoon ah', '2026-05', 1)
ON DUPLICATE KEY UPDATE discount_value = VALUES(discount_value);

-- Generated Invoices for 2026-05
-- Student 1 (Institute): Standard $25 - Discount $5 = Amount Due $20. Paid $10, Balance $10 (Partial)
-- Student 2 (Institute): Standard $25 - Discount $0 = Amount Due $25. Paid $0, Balance $25 (Unpaid)
-- Student 1 (Quran): Standard $20 - Discount $0 = Amount Due $20. Paid $20, Balance $0 (Paid)
-- Student 4 (Quran): Standard $20 - Discount $0 = Amount Due $20. Paid $0, Balance $20 (Unpaid)
INSERT INTO fee_invoices (id, invoice_number, student_id, division, class_id, group_id, billing_period, standard_fee, discount_amount, amount_due, amount_paid, balance, status) VALUES
(1, 'INV-INST-202605-001', 1, 'institute', 1, NULL, '2026-05', 25.00, 5.00, 20.00, 10.00, 10.00, 'partial'),
(2, 'INV-INST-202605-002', 2, 'institute', 1, NULL, '2026-05', 25.00, 0.00, 25.00, 0.00, 25.00, 'unpaid'),
(3, 'INV-QUR-202605-001', 1, 'quran', NULL, 1, '2026-05', 20.00, 0.00, 20.00, 20.00, 0.00, 'paid'),
(4, 'INV-QUR-202605-002', 4, 'quran', NULL, 1, '2026-05', 20.00, 0.00, 20.00, 0.00, 20.00, 'unpaid')
ON DUPLICATE KEY UPDATE amount_due = VALUES(amount_due);

-- Payments
INSERT INTO payments (id, receipt_number, invoice_id, student_id, division, amount_paid, payment_date, received_by, notes, status) VALUES
(1, 'REC-INST-202605-001', 1, 1, 'institute', 10.00, NOW(), 4, 'Qayb ka mid ah bixinta bisha May', 'valid'),
(2, 'REC-QUR-202605-001', 3, 1, 'quran', 20.00, NOW(), 5, 'Lacag buuxda oo bisha May ah', 'valid')
ON DUPLICATE KEY UPDATE amount_paid = VALUES(amount_paid);

SET FOREIGN_KEY_CHECKS = 1;
