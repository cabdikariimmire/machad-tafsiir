import { query } from '../src/db/connection.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function login(username = 'superadmin', password = 'Admin@12345') {
  const { response } = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) throw new Error(`Login failed for ${username}`);
  return response.headers.get('set-cookie').split(';')[0];
}

async function testClassHierarchyAndPromotion() {
  const suffix = Date.now();
  const year = 'Y' + String(suffix).slice(-3);
  let f1Id, f2Id, f3Id, f4Id;
  let sPassF1Id, sFailF1Id, sPassF4Id, sFailF4Id;
  let subjectId, periodName;

  try {
    const adminCookie = await login();

    console.log('1. Creating class hierarchy: F1 (Level 1), F2 (Level 2), F3 (Level 3), F4 (Level 4, Final)...');

    // Create F1 (Level 1 - lowest)
    let res = await request('/institute/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        class_name: `Test-F1-${suffix}`,
        academic_year: year,
        progression_order: 1,
        is_final_class: false
      })
    });
    if (!res.body.success) throw new Error(`Failed to create F1: ${JSON.stringify(res.body)}`);
    f1Id = res.body.id;

    // Create F2 (Level 2)
    res = await request('/institute/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        class_name: `Test-F2-${suffix}`,
        academic_year: year,
        progression_order: 2,
        is_final_class: false
      })
    });
    if (!res.body.success) throw new Error(`Failed to create F2: ${JSON.stringify(res.body)}`);
    f2Id = res.body.id;

    // Create F3 (Level 3)
    res = await request('/institute/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        class_name: `Test-F3-${suffix}`,
        academic_year: year,
        progression_order: 3,
        is_final_class: false
      })
    });
    if (!res.body.success) throw new Error(`Failed to create F3: ${JSON.stringify(res.body)}`);
    f3Id = res.body.id;

    // Create F4 (Level 4 - highest / final class)
    res = await request('/institute/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        class_name: `Test-F4-${suffix}`,
        academic_year: year,
        progression_order: 4,
        is_final_class: true
      })
    });
    if (!res.body.success) throw new Error(`Failed to create F4: ${JSON.stringify(res.body)}`);
    f4Id = res.body.id;

    // Verify automatic linking: F1 -> F2 -> F3 -> F4 -> null (Graduation)
    const [c1] = await query(`SELECT next_class_id, is_final_class FROM institute_classes WHERE id = ?`, [f1Id]);
    const [c2] = await query(`SELECT next_class_id, is_final_class FROM institute_classes WHERE id = ?`, [f2Id]);
    const [c3] = await query(`SELECT next_class_id, is_final_class FROM institute_classes WHERE id = ?`, [f3Id]);
    const [c4] = await query(`SELECT next_class_id, is_final_class FROM institute_classes WHERE id = ?`, [f4Id]);

    console.log(`F1 next: ${c1.next_class_id} (expected ${f2Id})`);
    console.log(`F2 next: ${c2.next_class_id} (expected ${f3Id})`);
    console.log(`F3 next: ${c3.next_class_id} (expected ${f4Id})`);
    console.log(`F4 next: ${c4.next_class_id} (expected null), is_final_class: ${c4.is_final_class}`);

    if (c1.next_class_id !== f2Id || c2.next_class_id !== f3Id || c3.next_class_id !== f4Id || c4.next_class_id !== null || !c4.is_final_class) {
      throw new Error('Class hierarchy linking mismatch!');
    }
    console.log('✓ Automatic class hierarchy linking succeeded!');

    console.log('2. Setting up test subjects, final exam period, and students...');
    // Create Subject
    res = await request('/institute/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: `Subject-${suffix}`, code: `SUB${String(suffix).slice(-5)}` })
    });
    subjectId = res.body.id;

    // Assign to F1 and F4
    await request(`/institute/classes/${f1Id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ subject_ids: [subjectId] })
    });
    await request(`/institute/classes/${f4Id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ subject_ids: [subjectId] })
    });

    // Create Final Exam Period
    periodName = `Final Exam ${suffix}`;
    res = await request('/exams/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        name: periodName,
        academic_year: year,
        exam_type: 'final',
        sequence_order: 1,
        max_contribution: 100,
        status: 'active'
      })
    });

    // Create 4 students: 2 in F1 (pass & fail), 2 in F4 (pass & fail)
    res = await request('/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ full_name: `Student F1 Pass ${suffix}`, gender: 'male', phone: `252611${String(suffix).slice(-6)}` })
    });
    sPassF1Id = res.body.student?.id || res.body.id;
    await query(`INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, CURDATE(), 'active')`, [sPassF1Id, f1Id]);

    res = await request('/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ full_name: `Student F1 Fail ${suffix}`, gender: 'female', phone: `252612${String(suffix).slice(-6)}` })
    });
    sFailF1Id = res.body.student?.id || res.body.id;
    await query(`INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, CURDATE(), 'active')`, [sFailF1Id, f1Id]);

    res = await request('/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ full_name: `Student F4 Pass ${suffix}`, gender: 'male', phone: `252613${String(suffix).slice(-6)}` })
    });
    sPassF4Id = res.body.student?.id || res.body.id;
    await query(`INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, CURDATE(), 'active')`, [sPassF4Id, f4Id]);

    res = await request('/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ full_name: `Student F4 Fail ${suffix}`, gender: 'female', phone: `252614${String(suffix).slice(-6)}` })
    });
    sFailF4Id = res.body.student?.id || res.body.id;
    await query(`INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, CURDATE(), 'active')`, [sFailF4Id, f4Id]);

    console.log('3. Entering final exam marks:');
    // F1 Pass: 85%
    await request('/exams/single-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: f1Id, exam_period: periodName, subject_id: subjectId, student_id: sPassF1Id, academic_year: year, marks_obtained: 85 })
    });
    // F1 Fail: 35%
    await request('/exams/single-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: f1Id, exam_period: periodName, subject_id: subjectId, student_id: sFailF1Id, academic_year: year, marks_obtained: 35 })
    });
    // F4 Pass: 92%
    await request('/exams/single-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: f4Id, exam_period: periodName, subject_id: subjectId, student_id: sPassF4Id, academic_year: year, marks_obtained: 92 })
    });
    // F4 Fail: 40%
    await request('/exams/single-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: f4Id, exam_period: periodName, subject_id: subjectId, student_id: sFailF4Id, academic_year: year, marks_obtained: 40 })
    });

    console.log('4. Executing automatic promotion for F1 (Middle class -> promotes to F2 if pass, retains if fail)...');
    res = await request('/exams/promotions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: f1Id, from_academic_year: year, to_academic_year: '2099', auto_confirm: true })
    });
    if (!res.body.success) throw new Error(`F1 Promotion failed: ${JSON.stringify(res.body)}`);
    console.log(`F1 Promotion result:`, res.body.data);

    // Verify F1 Pass student moved to F2
    const [passEnrollF2] = await query(`SELECT status FROM institute_enrollments WHERE student_id = ? AND class_id = ?`, [sPassF1Id, f2Id]);
    if (!passEnrollF2 || passEnrollF2.status !== 'active') {
      throw new Error(`Passing student was not enrolled actively in F2! Found: ${JSON.stringify(passEnrollF2)}`);
    }
    // Verify F1 Fail student remained in F1
    const [failEnrollF1] = await query(`SELECT status FROM institute_enrollments WHERE student_id = ? AND class_id = ?`, [sFailF1Id, f1Id]);
    if (!failEnrollF1 || failEnrollF1.status !== 'active') {
      throw new Error(`Failing student did not remain in F1! Found: ${JSON.stringify(failEnrollF1)}`);
    }
    console.log('✓ F1 Passed student promoted to F2, failed student remained in F1!');

    console.log('5. Executing automatic promotion for F4 (Final class -> graduates if pass, retains if fail)...');
    res = await request('/exams/promotions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: f4Id, from_academic_year: year, to_academic_year: '2099', auto_confirm: true })
    });
    if (!res.body.success) throw new Error(`F4 Promotion failed: ${JSON.stringify(res.body)}`);
    console.log(`F4 Promotion result:`, res.body.data);

    // Verify F4 Pass student graduated
    const [passEnrollF4] = await query(`SELECT status FROM institute_enrollments WHERE student_id = ? AND class_id = ?`, [sPassF4Id, f4Id]);
    if (!passEnrollF4 || passEnrollF4.status !== 'graduated') {
      throw new Error(`Passing final student was not marked as graduated! Found: ${JSON.stringify(passEnrollF4)}`);
    }
    // Verify F4 Fail student remained in F4
    const [failEnrollF4] = await query(`SELECT status FROM institute_enrollments WHERE student_id = ? AND class_id = ?`, [sFailF4Id, f4Id]);
    if (!failEnrollF4 || failEnrollF4.status !== 'active') {
      throw new Error(`Failing final student did not remain active in F4! Found: ${JSON.stringify(failEnrollF4)}`);
    }
    console.log('✓ F4 Passed student successfully graduated, failed student remained in F4!');

    console.log('=== ALL CLASS HIERARCHY & AUTOMATIC PROMOTION TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    // Cleanup
    const sIds = [sPassF1Id, sFailF1Id, sPassF4Id, sFailF4Id].filter(Boolean);
    if (sIds.length) {
      await query(`DELETE FROM student_promotion_history WHERE student_id IN (?)`, [sIds]);
      await query(`DELETE FROM institute_enrollments WHERE student_id IN (?)`, [sIds]);
      await query(`DELETE FROM institute_exam_marks WHERE student_id IN (?)`, [sIds]);
      await query(`DELETE FROM students WHERE id IN (?)`, [sIds]);
    }
    const cIds = [f1Id, f2Id, f3Id, f4Id].filter(Boolean);
    if (cIds.length) {
      await query(`DELETE FROM institute_class_subjects WHERE class_id IN (?)`, [cIds]);
      await query(`DELETE FROM institute_exams WHERE class_id IN (?)`, [cIds]);
      await query(`DELETE FROM promotion_result_confirmations WHERE class_id IN (?)`, [cIds]);
      await query(`DELETE FROM institute_classes WHERE id IN (?)`, [cIds]);
    }
    if (periodName) await query(`DELETE FROM exam_periods WHERE name = ? AND academic_year = ?`, [periodName, year]);
    if (subjectId) {
      await query(`DELETE FROM institute_exams WHERE subject_id = ?`, [subjectId]);
      await query(`DELETE FROM institute_class_subjects WHERE subject_id = ?`, [subjectId]);
      await query(`DELETE FROM institute_subjects WHERE id = ?`, [subjectId]);
    }
  }
}

testClassHierarchyAndPromotion()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
