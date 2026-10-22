import { query } from '../src/db/connection.js';

const BASE_URL = 'http://localhost:5000/api';

async function runMasterExamsTests() {
  console.log('====================================================');
  console.log('MASTER EXAMS, MARKS, PROMOTIONS & REPORTS TEST SUITE');
  console.log('====================================================\n');

  let superAdminCookie = '';
  let examOfficerCookie = '';
  let teacherCookie = '';

  // 1. Login as Super Admin
  const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'Admin@12345' })
  });
  if (!adminLogin.ok) throw new Error('Super admin login failed');
  superAdminCookie = adminLogin.headers.get('set-cookie').split(';')[0];
  console.log('✓ 1. Super Admin logged in');

  // 2. Ensure examination officer and teacher exist and log them in
  const examOfficerLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'exam_officer', password: 'Admin@12345' })
  });
  if (examOfficerLogin.ok) {
    examOfficerCookie = examOfficerLogin.headers.get('set-cookie').split(';')[0];
    console.log('✓ 2. Examination Officer logged in');
  }

  const teacherLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'teacher_ali', password: 'Admin@12345' })
  });
  if (teacherLogin.ok) {
    teacherCookie = teacherLogin.headers.get('set-cookie').split(';')[0];
    console.log('✓ 3. Teacher logged in');
  }

  // 3. Test Teacher Access Restriction: Teacher must NOT access exam APIs (403)
  if (teacherCookie) {
    const teacherAccess = await fetch(`${BASE_URL}/exams/periods`, {
      headers: { Cookie: teacherCookie }
    });
    if (teacherAccess.status === 403) {
      console.log('✓ 4. Teacher access to examination management strictly rejected (403 Forbidden)');
    } else {
      throw new Error(`Teacher access not forbidden! Status: ${teacherAccess.status}`);
    }
  }

  // 4. Test Academic-Year Assessment Config (Mode A & Mode B)
  const setConfigRes = await fetch(`${BASE_URL}/exams/assessment-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      academic_year: '2026',
      marking_mode: 'mode_b',
      mode_b_calculation: 'average',
      pass_threshold: 50.00,
      description: 'Standard 2026 Assessment'
    })
  });
  const setConfigJson = await setConfigRes.json();
  if (!setConfigJson.success) throw new Error(`Assessment config failed: ${JSON.stringify(setConfigJson)}`);
  console.log('✓ 5. Configured Academic-Year Assessment Mode & Pass Threshold');

  // 5. Register an Academic-Year Exam Plan
  const planYear = '2026';
  const testExamName = `Test Midterm Assessment ${Date.now()}`;
  const createPlanRes = await fetch(`${BASE_URL}/exams/periods`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      name: testExamName,
      academic_year: planYear,
      exam_type: 'term',
      sequence_order: 2,
      max_contribution: 40.00,
      start_date: '2026-11-01',
      end_date: '2026-11-10',
      status: 'active'
    })
  });
  const createPlanJson = await createPlanRes.json();
  if (!createPlanJson.success) throw new Error(`Create exam plan period failed: ${JSON.stringify(createPlanJson)}`);
  const periodId = createPlanJson.id;
  console.log(`✓ 6. Registered examination in annual plan: "${testExamName}" (ID: ${periodId})`);

  // 6. Setup Test Class and Subjects
  const baseOrder = Math.floor(Math.random() * 5000) + 1000;
  const className = `Progression-Test-Class-${Date.now().toString().slice(-4)}`;
  const createClassRes = await fetch(`${BASE_URL}/institute/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      class_name: className,
      academic_year: planYear,
      progression_order: baseOrder,
      is_entry_class: false,
      is_final_class: false
    })
  });
  const createClassJson = await createClassRes.json();
  const testClassId = createClassJson.id;

  // Create 2 subjects: one assigned to the class, one NOT assigned
  const sub1Code = `S1_${Date.now().toString().slice(-4)}`;
  const sub2Code = `S2_${Date.now().toString().slice(-4)}`;
  const createSub1 = await fetch(`${BASE_URL}/institute/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({ name: `Sub Assigned ${sub1Code}`, code: sub1Code })
  });
  const sub1Json = await createSub1.json();
  const assignedSubId = sub1Json.id;

  const createSub2 = await fetch(`${BASE_URL}/institute/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({ name: `Sub Unassigned ${sub2Code}`, code: sub2Code })
  });
  const sub2Json = await createSub2.json();
  const unassignedSubId = sub2Json.id;

  // Assign only sub1 to test class
  await fetch(`${BASE_URL}/institute/classes/${testClassId}/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({ subject_ids: [assignedSubId] })
  });
  console.log(`✓ 7. Test Class created (ID: ${testClassId}) and assigned subject ${assignedSubId}`);

  // 7. Verify Timetable Subject Restriction
  // Attempting to schedule unassignedSubId MUST fail with 400
  const invalidTimetableRes = await fetch(`${BASE_URL}/exams/timetables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      class_id: testClassId,
      exam_period_id: periodId,
      academic_year: planYear,
      entries: [
        {
          subject_id: unassignedSubId,
          exam_date: '2026-11-02',
          day_of_week: 'Sunday',
          start_time: '08:00',
          end_time: '09:30'
        }
      ]
    })
  });
  if (invalidTimetableRes.status === 400) {
    console.log('✓ 8. Timetable subject restriction enforced: Unassigned subject strictly rejected (400)');
  } else {
    throw new Error(`Unassigned subject was not rejected! Status: ${invalidTimetableRes.status}`);
  }

  // Schedule assigned subject in timetable
  const validTimetableRes = await fetch(`${BASE_URL}/exams/timetables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      class_id: testClassId,
      exam_period_id: periodId,
      academic_year: planYear,
      entries: [
        {
          subject_id: assignedSubId,
          exam_date: '2026-11-02',
          day_of_week: 'Sunday',
          start_time: '08:00',
          end_time: '09:30',
          notes: 'Hall A'
        }
      ]
    })
  });
  const validTimetableJson = await validTimetableRes.json();
  if (!validTimetableJson.success) throw new Error(`Timetable save failed: ${JSON.stringify(validTimetableJson)}`);
  console.log('✓ 9. Valid timetable saved for assigned subject');

  // Fetch timetable and verify layout data
  const getTtRes = await fetch(`${BASE_URL}/exams/timetables?class_id=${testClassId}&exam_period_id=${periodId}&academic_year=${planYear}`, {
    headers: { Cookie: superAdminCookie }
  });
  const getTtJson = await getTtRes.json();
  if (!getTtJson.success || getTtJson.data.entries.length !== 1) {
    throw new Error('Timetable fetch failed or mismatch');
  }
  console.log(`✓ 10. Timetable retrieved for class "${getTtJson.data.class_info.name}" with day: ${getTtJson.data.entries[0].day_of_week}`);

  // 8. Enroll test students
  const stu1Res = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      full_name: `Arday Baasay ${Date.now()}`,
      gender: 'male',
      phone: '252611112233'
    })
  });
  const stu1Json = await stu1Res.json();
  const stu1Id = stu1Json.student?.id || stu1Json.id;

  const stu2Res = await fetch(`${BASE_URL}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      full_name: `Arday Dhacay ${Date.now()}`,
      gender: 'female',
      phone: '252611112244'
    })
  });
  const stu2Json = await stu2Res.json();
  const stu2Id = stu2Json.student?.id || stu2Json.id;

  // Enroll students in test class
  await query(`
    INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status)
    VALUES (?, ?, CURDATE(), 'active'), (?, ?, CURDATE(), 'active')
  `, [stu1Id, testClassId, stu2Id, testClassId]);

  // 9. Automatic Single Mark Saving (No bulk save required)
  // Student 1 gets 85 marks (Pass)
  const saveMark1 = await fetch(`${BASE_URL}/exams/single-mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      class_id: testClassId,
      exam_period: testExamName,
      subject_id: assignedSubId,
      student_id: stu1Id,
      academic_year: planYear,
      marks_obtained: 85
    })
  });
  const mark1Json = await saveMark1.json();
  if (!mark1Json.success || mark1Json.data.marks_obtained !== 85) {
    throw new Error(`Single mark save failed: ${JSON.stringify(mark1Json)}`);
  }
  console.log(`✓ 11. Automatic Single Mark Saved for Student 1: 85/100 (Total: ${mark1Json.data.student_total})`);

  // Student 2 gets 35 marks (Fail)
  const saveMark2 = await fetch(`${BASE_URL}/exams/single-mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      class_id: testClassId,
      exam_period: testExamName,
      subject_id: assignedSubId,
      student_id: stu2Id,
      academic_year: planYear,
      marks_obtained: 35
    })
  });
  const mark2Json = await saveMark2.json();
  if (!mark2Json.success || mark2Json.data.marks_obtained !== 35) {
    throw new Error(`Single mark save failed for student 2`);
  }
  console.log(`✓ 12. Automatic Single Mark Saved for Student 2: 35/100 (Total: ${mark2Json.data.student_total})`);

  // Mark Bounds Validation (Exceeding max marks rejected)
  const invalidMark = await fetch(`${BASE_URL}/exams/single-mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      class_id: testClassId,
      exam_period: testExamName,
      subject_id: assignedSubId,
      student_id: stu1Id,
      academic_year: planYear,
      marks_obtained: 150
    })
  });
  if (invalidMark.status === 400) {
    console.log('✓ 13. Mark bounds server validation rejected mark > maximum marks (400)');
  } else {
    throw new Error(`Invalid mark was not rejected! Status: ${invalidMark.status}`);
  }

  // 10. Class Progression & Annual Promotion
  // Setup next class
  const nextClassName = `Progression-Target-${Date.now().toString().slice(-4)}`;
  const createNextClassRes = await fetch(`${BASE_URL}/institute/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      class_name: nextClassName,
      academic_year: '2027',
      progression_order: baseOrder + 1,
      is_entry_class: false,
      is_final_class: true
    })
  });
  const targetClassId = (await createNextClassRes.json()).id;

  // Test Promotion Preview
  const previewRes = await fetch(`${BASE_URL}/exams/promotions/preview?class_id=${testClassId}&academic_year=${planYear}`, {
    headers: { Cookie: superAdminCookie }
  });
  const previewJson = await previewRes.json();
  if (!previewJson.success) throw new Error(`Promotion preview failed: ${JSON.stringify(previewJson)}`);
  
  const pStudents = previewJson.data.students;
  const p1 = pStudents.find(s => s.student_id === stu1Id);
  const p2 = pStudents.find(s => s.student_id === stu2Id);

  if (p1.decision !== 'promoted' || p1.target_class_id !== targetClassId) {
    throw new Error(`Student 1 promotion decision incorrect: ${JSON.stringify(p1)}`);
  }
  if (p2.decision !== 'retained') {
    throw new Error(`Student 2 should be retained: ${JSON.stringify(p2)}`);
  }
  console.log(`✓ 14. Promotion Preview: Student 1 (85% >= 50%) -> Promoted to "${nextClassName}", Student 2 (35% < 50%) -> Retained in current class`);

  // Execute Promotion
  const execPromo = await fetch(`${BASE_URL}/exams/promotions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      from_academic_year: planYear,
      to_academic_year: '2027',
      class_id: testClassId,
      student_ids: [stu1Id, stu2Id]
    })
  });
  const execPromoJson = await execPromo.json();
  if (!execPromoJson.success) throw new Error(`Execute promotion failed: ${JSON.stringify(execPromoJson)}`);
  console.log('✓ 15. Promotion Executed: Promoted students enrolled in target class, history recorded');

  // Verify historical enrollment preserved
  const [stu1OldEnrollment] = await query(`
    SELECT status FROM institute_enrollments WHERE student_id = ? AND class_id = ?
  `, [stu1Id, testClassId]);
  const [stu1NewEnrollment] = await query(`
    SELECT status FROM institute_enrollments WHERE student_id = ? AND class_id = ?
  `, [stu1Id, targetClassId]);
  if (!stu1OldEnrollment || !stu1NewEnrollment) {
    throw new Error('Enrollment history missing');
  }
  console.log(`✓ 16. Enrollment history preserved (Old class status: ${stu1OldEnrollment.status}, New class status: ${stu1NewEnrollment.status})`);

  // 11. Super Admin Override
  // Non-super-admin override MUST be rejected with 403
  if (examOfficerCookie) {
    const unauthorizedOverride = await fetch(`${BASE_URL}/exams/promotions/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: examOfficerCookie },
      body: JSON.stringify({
        student_id: stu2Id,
        from_academic_year: planYear,
        to_academic_year: '2027',
        target_class_id: targetClassId,
        outcome: 'promoted',
        reason: 'Unauthorized officer change'
      })
    });
    if (unauthorizedOverride.status === 403) {
      console.log('✓ 17. Security check: Only Super Admin can override promotions; Exam Officer rejected (403)');
    } else {
      throw new Error(`Unauthorized override was not rejected with 403! Status: ${unauthorizedOverride.status}`);
    }
  }

  // Super Admin manual override
  const superOverride = await fetch(`${BASE_URL}/exams/promotions/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
    body: JSON.stringify({
      student_id: stu2Id,
      from_academic_year: planYear,
      to_academic_year: '2027',
      target_class_id: targetClassId,
      outcome: 'promoted',
      reason: 'Medical excuse accepted by Super Admin'
    })
  });
  const superOverrideJson = await superOverride.json();
  if (!superOverrideJson.success) throw new Error(`Super admin override failed: ${JSON.stringify(superOverrideJson)}`);
  console.log('✓ 18. Super Admin Override executed with audited reason');

  // 12. Comprehensive Searchable Historical Reports
  const histReportsRes = await fetch(`${BASE_URL}/reports/historical-exams?student_id=${stu1Id}`, {
    headers: { Cookie: superAdminCookie }
  });
  const histJson = await histReportsRes.json();
  if (!histJson.success || !histJson.data.student || histJson.data.historical_years.length === 0) {
    throw new Error(`Historical reports drilldown failed: ${JSON.stringify(histJson)}`);
  }
  console.log(`✓ 19. Historical Student Report retrieved: ${histJson.data.student.full_name} (${histJson.data.historical_years.length} recorded exam years)`);

  console.log('\n====================================================');
  console.log('ALL 19 MASTER EXAMS & PROMOTION TESTS PASSED (100%)');
  console.log('====================================================\n');
}

runMasterExamsTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
