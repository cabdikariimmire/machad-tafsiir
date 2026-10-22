import { query } from '../src/db/connection.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, body: data };
}

async function login(username = 'superadmin', password = 'Admin@12345') {
  const res = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.body.success) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  const rawCookie = res.headers.get('set-cookie');
  return rawCookie ? rawCookie.split(';')[0] : '';
}

async function runTest() {
  const suffix = Date.now();
  const year = 'Y' + String(suffix).slice(-3);
  let adminCookie;
  let c1Id, c2Id;
  let sPassId, sFailId;
  const subjectIds = [];

  try {
    adminCookie = await login();
    console.log(`1. Testing /exams/setup-standard-scheme for academic year ${year}...`);

    const setupRes = await request('/exams/setup-standard-scheme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ academic_year: year, pass_threshold: 50.00 })
    });
    if (!setupRes.body.success) throw new Error(`Setup failed: ${JSON.stringify(setupRes.body)}`);
    console.log('✓ Standard 40/60 scheme successfully setup!');

    // Verify exam periods in database
    const periods = await query(
      `SELECT name, exam_type, max_contribution FROM exam_periods WHERE academic_year = ? ORDER BY sequence_order ASC`,
      [year]
    );
    console.log('Exam periods configured:', periods);
    const midPeriod = periods.find(p => p.exam_type === 'midterm');
    const finPeriod = periods.find(p => p.exam_type === 'final');
    if (!midPeriod || Number(midPeriod.max_contribution) !== 40 || !finPeriod || Number(finPeriod.max_contribution) !== 60) {
      throw new Error(`Period max_contribution mismatch: Mid=${midPeriod?.max_contribution}, Fin=${finPeriod?.max_contribution}`);
    }
    console.log('✓ Midterm (40) and Final (60) confirmed in DB.');

    // 2. Create 2 Classes: C1 (Middle) -> C2 (Target)
    console.log('2. Creating classes and 6 subjects...');
    let res = await request('/institute/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_name: `C1-${suffix}`, academic_year: year, progression_order: 1, is_final_class: false })
    });
    c1Id = res.body.id;

    res = await request('/institute/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_name: `C2-${suffix}`, academic_year: year, progression_order: 2, is_final_class: true })
    });
    c2Id = res.body.id;

    // Create 6 subjects (Total = 6 * 100 = 600 max marks)
    for (let i = 1; i <= 6; i++) {
      res = await request('/institute/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: `Subject-${i}-${suffix}`, code: `S${i}${String(suffix).slice(-4)}` })
      });
      const subId = res.body.id || res.body.data?.id;
      subjectIds.push(subId);
      await query(`INSERT INTO institute_class_subjects (class_id, subject_id) VALUES (?, ?)`, [c1Id, subId]);
    }

    // 3. Create 2 students in C1
    console.log('3. Enrolling students in class...');
    res = await request('/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        full_name: `Guuleed Pass-${suffix}`,
        phone: '615555001',
        enroll_institute: true,
        institute_class_id: c1Id
      })
    });
    sPassId = res.body.student?.id;

    res = await request('/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        full_name: `Dhaafiye Fail-${suffix}`,
        phone: '615555002',
        enroll_institute: true,
        institute_class_id: c1Id
      })
    });
    sFailId = res.body.student?.id;

    // 4. Enter marks:
    // Student 1 (sPassId):
    // In subject 1: Midterm = 19 (out of 40 - fails midterm < 20), Final = 31 (out of 60). Combined = 50 / 100! (passes subject!)
    // In subjects 2-6: Midterm = 20 (each), Final = 30 (each). Each = 50 / 100!
    // Total for all 6 subjects = 50 * 6 = 300 / 600 (Exact 50%) -> PASSES OVERALL!
    console.log('4. Entering Midterm and Final marks for Student 1 (Target: 300 / 600, with 19 on Midterm Sub 1)...');
    
    // Sub 1: Midterm 19, Final 31
    await request('/exams/single-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: c1Id, exam_period: midPeriod.name, subject_id: subjectIds[0], student_id: sPassId, academic_year: year, marks_obtained: 19 })
    });
    await request('/exams/single-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: c1Id, exam_period: finPeriod.name, subject_id: subjectIds[0], student_id: sPassId, academic_year: year, marks_obtained: 31 })
    });

    // Sub 2-6 for sPassId: 20 on Midterm, 30 on Final
    for (let i = 1; i < 6; i++) {
      await request('/exams/single-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ class_id: c1Id, exam_period: midPeriod.name, subject_id: subjectIds[i], student_id: sPassId, academic_year: year, marks_obtained: 20 })
      });
      await request('/exams/single-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ class_id: c1Id, exam_period: finPeriod.name, subject_id: subjectIds[i], student_id: sPassId, academic_year: year, marks_obtained: 30 })
      });
    }

    // Student 2 (sFailId):
    // In subject 1: Midterm = 19, Final = 30 (combined = 49).
    // In subjects 2-6: Midterm = 20, Final = 30 (each 50).
    // Total for all 6 subjects = 49 + 250 = 299 / 600 (49.83% < 50%) -> FAILS OVERALL!
    console.log('Entering Midterm and Final marks for Student 2 (Target: 299 / 600)...');
    await request('/exams/single-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: c1Id, exam_period: midPeriod.name, subject_id: subjectIds[0], student_id: sFailId, academic_year: year, marks_obtained: 19 })
    });
    await request('/exams/single-mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: c1Id, exam_period: finPeriod.name, subject_id: subjectIds[0], student_id: sFailId, academic_year: year, marks_obtained: 30 })
    });
    for (let i = 1; i < 6; i++) {
      await request('/exams/single-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ class_id: c1Id, exam_period: midPeriod.name, subject_id: subjectIds[i], student_id: sFailId, academic_year: year, marks_obtained: 20 })
      });
      await request('/exams/single-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ class_id: c1Id, exam_period: finPeriod.name, subject_id: subjectIds[i], student_id: sFailId, academic_year: year, marks_obtained: 30 })
      });
    }

    // 5. Check promotion preview
    console.log('5. Checking promotion preview results...');
    const previewRes = await request(`/exams/promotions/preview?class_id=${c1Id}&academic_year=${year}`, {
      headers: { Cookie: adminCookie }
    });
    if (!previewRes.body.success) throw new Error(`Preview failed: ${JSON.stringify(previewRes.body)}`);
    
    const previewStudents = previewRes.body.data?.students || [];
    const pStudentPass = previewStudents.find(s => s.student_id === sPassId);
    const pStudentFail = previewStudents.find(s => s.student_id === sFailId);

    console.log('Student 1 (300/600):', {
      total: pStudentPass?.total_marks,
      max: pStudentPass?.maximum_total,
      pct: pStudentPass?.average_percentage,
      decision: pStudentPass?.decision
    });
    console.log('Student 2 (299/600):', {
      total: pStudentFail?.total_marks,
      max: pStudentFail?.maximum_total,
      pct: pStudentFail?.average_percentage,
      decision: pStudentFail?.decision
    });

    if (pStudentPass?.total_marks !== 300 || pStudentPass?.maximum_total !== 600 || pStudentPass?.decision !== 'promoted') {
      throw new Error(`Student 1 should be PROMOTED with 300/600, got: ${JSON.stringify(pStudentPass)}`);
    }
    if (pStudentFail?.total_marks !== 299 || pStudentFail?.maximum_total !== 600 || pStudentFail?.decision !== 'retained') {
      throw new Error(`Student 2 should be RETAINED with 299/600, got: ${JSON.stringify(pStudentFail)}`);
    }
    console.log('✓ 300/600 passes and promotes to next class, 299/600 fails and is retained!');

    // 6. Execute promotion
    console.log('6. Executing automatic promotion...');
    const promoRes = await request('/exams/promotions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ class_id: c1Id, from_academic_year: year, to_academic_year: year, auto_confirm: true })
    });
    if (!promoRes.body.success) throw new Error(`Execute promotion failed: ${JSON.stringify(promoRes.body)}`);
    console.log('Promotion execution output:', promoRes.body.data);

    // Verify enrollments in DB
    const [enrPass] = await query(`SELECT class_id, status FROM institute_enrollments WHERE student_id = ? AND status = 'active'`, [sPassId]);
    const [enrFail] = await query(`SELECT class_id, status FROM institute_enrollments WHERE student_id = ? AND status = 'active'`, [sFailId]);

    console.log(`Student 1 active enrollment: class ${enrPass?.class_id} (expected ${c2Id})`);
    console.log(`Student 2 active enrollment: class ${enrFail?.class_id} (expected ${c1Id})`);

    if (enrPass?.class_id !== c2Id) throw new Error(`Student 1 was not promoted to C2 (${c2Id})!`);
    if (enrFail?.class_id !== c1Id) throw new Error(`Student 2 did not remain in C1 (${c1Id})!`);

    console.log('=== ALL MIDTERM (40) / FINAL (60) AND 300/600 PROMOTION TESTS PASSED! ===');
  } finally {
    // Cleanup
    const sIds = [sPassId, sFailId].filter(Boolean);
    if (sIds.length) {
      await query(`DELETE FROM student_promotion_history WHERE student_id IN (?)`, [sIds]);
      await query(`DELETE FROM institute_enrollments WHERE student_id IN (?)`, [sIds]);
      await query(`DELETE FROM institute_exam_marks WHERE student_id IN (?)`, [sIds]);
      await query(`DELETE FROM students WHERE id IN (?)`, [sIds]);
    }
    const cIds = [c1Id, c2Id].filter(Boolean);
    if (cIds.length) {
      await query(`DELETE FROM institute_class_subjects WHERE class_id IN (?)`, [cIds]);
      await query(`DELETE FROM institute_exams WHERE class_id IN (?)`, [cIds]);
      await query(`DELETE FROM promotion_result_confirmations WHERE class_id IN (?)`, [cIds]);
      await query(`DELETE FROM institute_classes WHERE id IN (?)`, [cIds]);
    }
    if (subjectIds.length) {
      await query(`DELETE FROM institute_exams WHERE subject_id IN (?)`, [subjectIds]);
      await query(`DELETE FROM institute_class_subjects WHERE subject_id IN (?)`, [subjectIds]);
      await query(`DELETE FROM institute_subjects WHERE id IN (?)`, [subjectIds]);
    }
    const [sets] = await query(`SELECT id FROM institute_exam_sets WHERE academic_year = ?`, [year]);
    if (sets) {
      await query(`DELETE FROM institute_exam_set_members WHERE exam_set_id = ?`, [sets.id]);
      await query(`DELETE FROM institute_exam_sets WHERE id = ?`, [sets.id]);
    }
    await query(`DELETE FROM exam_fee_rules WHERE academic_year = ?`, [year]);
    await query(`DELETE FROM exam_periods WHERE academic_year = ?`, [year]);
    await query(`DELETE FROM academic_year_assessment_configs WHERE academic_year = ?`, [year]);
  }
}

runTest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
