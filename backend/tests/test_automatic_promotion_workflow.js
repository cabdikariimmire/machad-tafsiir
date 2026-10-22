import { query } from '../src/db/connection.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function login(username, password = 'Admin@12345') {
  const { response } = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) throw new Error(`Login failed for ${username}`);
  return response.headers.get('set-cookie').split(';')[0];
}

async function run() {
  const suffix = Date.now();
  let sourceClassId;
  let targetClassId;
  let studentId;
  let manualStudentId;
  let subjectId;
  let periodName;
  try {
    const adminCookie = await login('superadmin');
    const sourceName = `Auto Promotion Source ${suffix}`;
    const targetName = `Auto Promotion Target ${suffix}`;

    let result = await request('/institute/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_name: sourceName, academic_year: '2099', progression_order: 9001, is_final_class: false })
    });
    if (!result.body.success) throw new Error(`Source class failed: ${JSON.stringify(result.body)}`);
    sourceClassId = result.body.id;

    result = await request('/institute/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_name: sourceName, academic_year: '2101', progression_order: 9010, is_final_class: false })
    });
    if (!result.body.success || !result.body.reused || result.body.id !== sourceClassId) throw new Error(`Yearly class reuse policy failed: ${JSON.stringify(result.body)}`);

    result = await request('/institute/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_name: targetName, academic_year: '2100', progression_order: 9002, is_final_class: true })
    });
    if (!result.body.success) throw new Error(`Target class failed: ${JSON.stringify(result.body)}`);
    targetClassId = result.body.id;

    result = await request('/exams/classes/progression', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        classes: [
          { id: sourceClassId, next_class_id: targetClassId, is_final_class: false, progression_order: 9001 },
          { id: targetClassId, next_class_id: null, is_final_class: true, progression_order: 9002 }
        ]
      })
    });
    if (!result.body.success) throw new Error(`Class configuration failed: ${JSON.stringify(result.body)}`);

    result = await request('/institute/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: `Promotion Test Subject ${suffix}`, code: `APS${String(suffix).slice(-6)}` })
    });
    if (!result.body.success) throw new Error(`Subject failed: ${JSON.stringify(result.body)}`);
    subjectId = result.body.id;
    result = await request(`/institute/classes/${sourceClassId}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ subject_ids: [subjectId] })
    });
    if (!result.body.success) throw new Error(`Subject assignment failed: ${JSON.stringify(result.body)}`);

    periodName = `Promotion Final ${suffix}`;
    result = await request('/exams/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: periodName, academic_year: '2099', exam_type: 'final', sequence_order: 1, max_contribution: 100, status: 'active' })
    });
    if (!result.body.success) throw new Error(`Exam period failed: ${JSON.stringify(result.body)}`);

    result = await request('/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ full_name: `Promotion Test Student ${suffix}`, gender: 'male', phone: `25261${String(suffix).slice(-7)}` })
    });
    if (!result.body.success) throw new Error(`Student failed: ${JSON.stringify(result.body)}`);
    studentId = result.body.student?.id || result.body.id;
    await query(`INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, CURDATE(), 'active')`, [studentId, sourceClassId]);

    result = await request('/exams/single-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: sourceClassId, exam_period: periodName, subject_id: subjectId, student_id: studentId, academic_year: '2099', marks_obtained: 85 })
    });
    if (!result.body.success) throw new Error(`Passing mark failed: ${JSON.stringify(result.body)}`);

    result = await request(`/exams/promotions/preview?class_id=${sourceClassId}&academic_year=2099`, { headers: { Cookie: adminCookie } });
    if (!result.body.success || result.body.data.next_class.id !== targetClassId) throw new Error(`Preview/config failed: ${JSON.stringify(result.body)}`);

    if (result.body.data.students[0]?.decision !== 'promoted') throw new Error(`Passing student was not marked for promotion: ${JSON.stringify(result.body.data.students)}`);

    result = await request('/exams/promotions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: sourceClassId, from_academic_year: '2099', to_academic_year: '2100' })
    });
    if (result.response.status !== 409) throw new Error(`Execution without confirmation was not blocked: ${JSON.stringify(result.body)}`);

    result = await request('/exams/promotions/confirm-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: sourceClassId, academic_year: '2099', confirmation_note: 'Automatic promotion integration test' })
    });
    if (!result.body.success) throw new Error(`Result confirmation failed: ${JSON.stringify(result.body)}`);

    result = await request('/exams/promotions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: sourceClassId, from_academic_year: '2099', to_academic_year: '2100' })
    });
    if (!result.body.success || result.body.data.promoted !== 1) throw new Error(`Automatic promotion failed: ${JSON.stringify(result.body)}`);

    const [autoTarget] = await query(`SELECT status FROM institute_enrollments WHERE student_id = ? AND class_id = ?`, [studentId, targetClassId]);
    const [autoHistory] = await query(`SELECT outcome, is_override FROM student_promotion_history WHERE student_id = ? AND from_academic_year = '2099'`, [studentId]);
    if (!autoTarget || autoTarget.status !== 'active' || autoHistory?.outcome !== 'promoted' || autoHistory.is_override) throw new Error(`Automatic promotion persistence mismatch: ${JSON.stringify({ autoTarget, autoHistory })}`);

    result = await request('/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ full_name: `Manual Promotion Student ${suffix}`, gender: 'female', phone: `25262${String(suffix).slice(-7)}` })
    });
    if (!result.body.success) throw new Error(`Manual student failed: ${JSON.stringify(result.body)}`);
    manualStudentId = result.body.student?.id || result.body.id;
    await query(`INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, CURDATE(), 'active')`, [manualStudentId, sourceClassId]);

    result = await request('/exams/promotions/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ student_id: manualStudentId, from_class_id: sourceClassId, from_academic_year: '2099', to_academic_year: '2100', outcome: 'promoted', target_class_id: targetClassId, reason: 'Approved manual promotion test' })
    });
    if (!result.body.success) throw new Error(`Manual override failed: ${JSON.stringify(result.body)}`);

    const [activeTarget] = await query(`SELECT COUNT(*) AS count FROM institute_enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'`, [manualStudentId, targetClassId]);
    const [history] = await query(`SELECT outcome, is_override, override_reason FROM student_promotion_history WHERE student_id = ? AND from_academic_year = '2099'`, [manualStudentId]);
    if (Number(activeTarget.count) !== 1 || history?.outcome !== 'manual_override' || !history.is_override || history.override_reason !== 'Approved manual promotion test') {
      throw new Error(`Manual promotion audit/enrollment mismatch: ${JSON.stringify({ activeTarget, history })}`);
    }

    result = await request('/exams/promotions/history?academic_year=2099', { headers: { Cookie: adminCookie } });
    if (!result.body.success || !result.body.data.some(item => item.student_id === manualStudentId)) throw new Error('Promotion history endpoint did not return the audit record.');

    console.log('✓ Automatic promotion safeguards, explicit class link, confirmation gate, manual override, duplicate-safe enrollment, and history passed');
  } finally {
    if (studentId) {
      await query(`DELETE FROM student_promotion_history WHERE student_id = ?`, [studentId]);
      await query(`DELETE FROM institute_enrollments WHERE student_id = ?`, [studentId]);
      await query(`DELETE FROM institute_exam_marks WHERE student_id = ?`, [studentId]);
      await query(`DELETE FROM students WHERE id = ?`, [studentId]);
    }
    if (manualStudentId) {
      await query(`DELETE FROM student_promotion_history WHERE student_id = ?`, [manualStudentId]);
      await query(`DELETE FROM institute_enrollments WHERE student_id = ?`, [manualStudentId]);
      await query(`DELETE FROM institute_exam_marks WHERE student_id = ?`, [manualStudentId]);
      await query(`DELETE FROM students WHERE id = ?`, [manualStudentId]);
    }
    if (sourceClassId) await query(`DELETE FROM institute_exams WHERE class_id = ?`, [sourceClassId]);
    if (periodName) await query(`DELETE FROM exam_periods WHERE name = ? AND academic_year = '2099'`, [periodName]);
    if (sourceClassId) await query(`DELETE FROM promotion_result_confirmations WHERE class_id = ?`, [sourceClassId]);
    if (sourceClassId) await query(`DELETE FROM institute_classes WHERE id = ?`, [sourceClassId]);
    if (targetClassId) await query(`DELETE FROM institute_classes WHERE id = ?`, [targetClassId]);
    if (subjectId) await query(`DELETE FROM institute_subjects WHERE id = ?`, [subjectId]);
  }
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
