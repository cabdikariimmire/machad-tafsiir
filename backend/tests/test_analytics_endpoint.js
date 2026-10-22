import { query } from '../src/db/connection.js';

async function testAnalyticsLogic() {
  console.log('Testing Analytics Logic for Dashboard Redesign...');

  // Test 1: Institute Scope
  const division = 'institute';
  const [{ totalStudents }] = await query(`
    SELECT COUNT(DISTINCT student_id) as totalStudents 
    FROM institute_enrollments 
    WHERE status = 'active'
  `);

  const [{ totalClasses }] = await query(`
    SELECT COUNT(*) as totalClasses 
    FROM institute_classes 
    WHERE is_active = 1
  `);

  const [attRecord] = await query(`
    SELECT 
      COUNT(*) as total_records,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
    FROM institute_attendance a
    JOIN institute_class_sessions s ON a.session_id = s.id
  `);

  const attRate = attRecord.total_records > 0
    ? Number((((Number(attRecord.present_count) + 0.5 * Number(attRecord.late_count)) / Number(attRecord.total_records)) * 100).toFixed(1))
    : null;

  const [fees] = await query(`
    SELECT COALESCE(SUM(balance), 0) as outstanding 
    FROM fee_invoices 
    WHERE division = 'institute' AND status != 'cancelled'
  `);

  const [examPerf] = await query(`
    SELECT 
      COUNT(m.id) as marks_count,
      ROUND(AVG(m.percentage), 1) as avg_score
    FROM institute_exam_marks m
    JOIN institute_exams e ON m.exam_id = e.id
    WHERE m.is_absent = 0 AND m.marks_obtained IS NOT NULL
  `);

  console.log('Institute KPIs:', {
    totalStudents,
    totalClasses,
    attRate,
    outstandingFees: Number(fees.outstanding),
    examAvg: examPerf.marks_count > 0 ? Number(examPerf.avg_score) : null
  });

  // Test 2: Attendance Trend (last 10 sessions)
  const attTrend = await query(`
    SELECT 
      DATE_FORMAT(s.session_date, '%Y-%m-%d') as date,
      DATE_FORMAT(s.session_date, '%d %b') as display_date,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
      COUNT(*) as total
    FROM institute_attendance a
    JOIN institute_class_sessions s ON a.session_id = s.id
    GROUP BY s.session_date
    ORDER BY s.session_date ASC
    LIMIT 10
  `);
  console.log('Attendance Trend Count:', attTrend.length);

  // Test 3: Exam Subjects
  const examSubjects = await query(`
    SELECT 
      s.name as subject,
      COUNT(m.id) as students_count,
      ROUND(AVG(m.percentage), 1) as avg_pct
    FROM institute_exam_marks m
    JOIN institute_exams e ON m.exam_id = e.id
    JOIN institute_subjects s ON e.subject_id = s.id
    WHERE m.is_absent = 0 AND m.marks_obtained IS NOT NULL
    GROUP BY s.id, s.name
    ORDER BY avg_pct DESC
    LIMIT 8
  `);
  console.log('Exam Subjects:', examSubjects);

  console.log('Analytics queries verified successfully!');
  process.exit(0);
}

testAnalyticsLogic().catch(err => {
  console.error(err);
  process.exit(1);
});
