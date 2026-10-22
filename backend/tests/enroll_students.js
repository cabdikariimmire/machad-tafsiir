import { query } from '../src/db/connection.js';

async function main() {
  await query("UPDATE students SET name_ar = 'حسن عبد الله' WHERE id = 1");
  await query("INSERT IGNORE INTO quran_enrollments (student_id, group_id, enrollment_date, status) VALUES (1, 1, '2026-10-01', 'active')");
  
  const [existing2] = await query("SELECT id FROM students WHERE student_id = 'STU-2026-002'");
  let s2Id = existing2 ? existing2.id : null;
  if (!existing2) {
    const res = await query("INSERT INTO students (student_id, full_name, name_ar, gender, phone, date_of_birth, enrollment_date, is_active) VALUES ('STU-2026-002', 'Cabdiraxmaan Maxamuud Cali', 'عبد الرحمن محمود علي', 'male', '252615551234', '2012-05-15', '2026-10-01', 1)");
    s2Id = res.insertId;
  }
  await query("INSERT IGNORE INTO quran_enrollments (student_id, group_id, enrollment_date, status) VALUES (?, 1, '2026-10-01', 'active')", [s2Id]);
  
  console.log('✓ Successfully enrolled students in Quran Group 1 with authentic Arabic names');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
