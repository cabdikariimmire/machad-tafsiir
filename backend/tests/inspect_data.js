import { query } from '../src/db/connection.js';

async function main() {
  const enrollmentTrend = await query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as new_students 
    FROM students 
    GROUP BY month 
    ORDER BY month
  `);

  const instAttendance = await query(`
    SELECT s.session_date, a.status, COUNT(*) as count
    FROM institute_attendance a
    JOIN institute_class_sessions s ON a.session_id = s.id
    GROUP BY s.session_date, a.status
    ORDER BY s.session_date DESC
  `);

  const examPerformance = await query(`
    SELECT s.name as subject_name, COUNT(m.id) as students_count, ROUND(AVG(m.percentage), 1) as avg_pct 
    FROM institute_exam_marks m 
    JOIN institute_exams e ON m.exam_id = e.id 
    JOIN institute_subjects s ON e.subject_id = s.id 
    WHERE m.is_absent = 0 AND m.marks_obtained IS NOT NULL 
    GROUP BY s.id, s.name 
    ORDER BY avg_pct DESC
  `);

  const financeTrend = await query(`
    SELECT DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(amount_paid) as collected, division 
    FROM payments 
    WHERE status = 'valid' 
    GROUP BY month, division 
    ORDER BY month
  `);

  const recentAudits = await query(`
    SELECT a.*, u.full_name as actor_name, u.username as actor_username
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `);

  console.log('Enrollment Trend:', JSON.stringify(enrollmentTrend, null, 2));
  console.log('Inst Attendance:', JSON.stringify(instAttendance, null, 2));
  console.log('Exam Performance:', JSON.stringify(examPerformance, null, 2));
  console.log('Finance Trend:', JSON.stringify(financeTrend, null, 2));
  console.log('Recent Audits count:', recentAudits.length);
  if (recentAudits.length > 0) {
    console.log('Sample audit:', recentAudits[0]);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
