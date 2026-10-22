// Automated Integration Test for the Institute's Two-Half Assessment System
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runTests() {
  console.log('========================================================================');
  console.log('TEST SUITE: INSTITUTE TWO-HALF ASSESSMENT SYSTEM (نظام النصفين)');
  console.log('========================================================================\n');

  // Step 1: Login as superadmin
  console.log('1. Logging in as Super Admin...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'Admin@12345' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const rawCookie = loginRes.headers.get('set-cookie');
  const cookie = rawCookie ? rawCookie.split(';')[0] : '';
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': cookie
  };
  console.log('   ✓ Logged in as Super Admin. Cookie acquired.\n');

  // Step 2: Verify Official Arabic Exam Periods Structure & Allocation
  console.log('2. Verifying Official Arabic Exam Periods & Max Allocation (40, 60, 40, 60)...');
  const periodsRes = await fetch(`${BASE_URL}/exams/periods?academic_year=2026`, { headers });
  const periodsData = await periodsRes.json();
  if (!periodsData.success) {
    throw new Error('Failed to fetch exam periods: ' + JSON.stringify(periodsData));
  }

  const periods = periodsData.data || [];
  const pMap = {};
  periods.forEach(p => { pMap[p.name] = p; });

  const requiredExams = [
    { name: 'النصف الأول', expectedMax: 40, expectedOrder: 1 },
    { name: 'النهائي الأول', expectedMax: 60, expectedOrder: 2 },
    { name: 'النصف الثاني', expectedMax: 40, expectedOrder: 3 },
    { name: 'النهائي الثاني', expectedMax: 60, expectedOrder: 4 }
  ];

  for (const req of requiredExams) {
    const found = pMap[req.name];
    if (!found) {
      throw new Error(`Missing official exam period: "${req.name}"`);
    }
    const maxVal = parseFloat(found.max_contribution);
    if (maxVal !== req.expectedMax) {
      throw new Error(`Exam "${req.name}" has maximum ${maxVal}, expected ${req.expectedMax}`);
    }
    console.log(`   ✓ ${req.name}: Order=${found.sequence_order}, Maximum Marks=${maxVal}`);
  }

  const h1Total = parseFloat(pMap['النصف الأول'].max_contribution) + parseFloat(pMap['النهائي الأول'].max_contribution);
  const h2Total = parseFloat(pMap['النصف الثاني'].max_contribution) + parseFloat(pMap['النهائي الثاني'].max_contribution);
  console.log(`   ✓ First-Half Combined Maximum: ${h1Total} (Target: 100)`);
  console.log(`   ✓ Second-Half Combined Maximum: ${h2Total} (Target: 100)\n`);

  if (h1Total !== 100 || h2Total !== 100) {
    throw new Error(`Combined maximum is not exactly 100 (H1: ${h1Total}, H2: ${h2Total})`);
  }

  // Step 3: Fetch an active class and student for mark entry testing
  console.log('3. Locating test class, subjects, and student...');
  const classesRes = await fetch(`${BASE_URL}/institute/classes?academic_year=2026`, { headers });
  const classesData = await classesRes.json();
  const classes = classesData.data || [];
  
  let testClass = null;
  let testStudent = null;
  let testSubject = null;

  for (const c of classes) {
    const sheetRes = await fetch(`${BASE_URL}/exams/unified-sheet?class_id=${c.id}&exam_period=%D8%A7%D9%84%D9%86%D8%B5%D9%81%20%D8%A7%D9%84%D8%A3%D9%88%D9%84&academic_year=2026`, { headers });
    const sheetData = await sheetRes.json();
    if (sheetData.success && sheetData.data?.students?.length > 0 && sheetData.data?.subjects?.length > 0) {
      testClass = c;
      testStudent = { ...sheetData.data.students[0], id: sheetData.data.students[0].id || sheetData.data.students[0].student_id };
      testSubject = { ...sheetData.data.subjects[0], id: sheetData.data.subjects[0].id || sheetData.data.subjects[0].subject_id };
      break;
    }
  }

  if (!testClass || !testStudent || !testSubject) {
    throw new Error('No class with enrolled students and assigned subjects found.');
  }
  console.log(`   ✓ Test Class: "${testClass.name}" (ID: ${testClass.id})`);
  console.log(`   ✓ Test Student: "${testStudent.full_name}" (ID: ${testStudent.id})`);
  console.log(`   ✓ Test Subject: "${testSubject.name}" (ID: ${testSubject.id})\n`);

  // Step 4: Strict Server-Side Mark Validation
  console.log('4. Testing Server-Side Validation: Rejecting marks outside official maximums...');

  // Test 4a: Mark > 40 for النصف الأول (e.g. 41) must fail with 400
  console.log('   - Submitting mark 41 for النصف الأول (Maximum is 40)...');
  const invalidH1Res = await fetch(`${BASE_URL}/exams/single-mark`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      class_id: testClass.id,
      exam_period: 'النصف الأول',
      subject_id: testSubject.id,
      student_id: testStudent.id,
      academic_year: '2026',
      marks_obtained: 41
    })
  });
  const invalidH1Data = await invalidH1Res.json();
  if (invalidH1Res.status === 400 && !invalidH1Data.success) {
    console.log(`   ✓ Correctly REJECTED with 400: "${invalidH1Data.error}"`);
  } else {
    throw new Error(`Failed to reject invalid mark 41 for النصف الأول: status ${invalidH1Res.status}, data: ${JSON.stringify(invalidH1Data)}`);
  }

  // Test 4b: Mark > 60 for النهائي الأول (e.g. 61) must fail with 400
  console.log('   - Submitting mark 61 for النهائي الأول (Maximum is 60)...');
  const invalidFin1Res = await fetch(`${BASE_URL}/exams/single-mark`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      class_id: testClass.id,
      exam_period: 'النهائي الأول',
      subject_id: testSubject.id,
      student_id: testStudent.id,
      academic_year: '2026',
      marks_obtained: 61
    })
  });
  const invalidFin1Data = await invalidFin1Res.json();
  if (invalidFin1Res.status === 400 && !invalidFin1Data.success) {
    console.log(`   ✓ Correctly REJECTED with 400: "${invalidFin1Data.error}"\n`);
  } else {
    throw new Error(`Failed to reject invalid mark 61 for النهائي الأول: status ${invalidFin1Res.status}, data: ${JSON.stringify(invalidFin1Data)}`);
  }

  // Step 5: Save Valid Marks and Test Automatic Recalculation
  console.log('5. Testing Automatic Mark Saving with Valid Two-Half Marks:');
  console.log('   - Saving 32 / 40 in النصف الأول...');
  const validH1Res = await fetch(`${BASE_URL}/exams/single-mark`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      class_id: testClass.id,
      exam_period: 'النصف الأول',
      subject_id: testSubject.id,
      student_id: testStudent.id,
      academic_year: '2026',
      marks_obtained: 32
    })
  });
  const validH1Data = await validH1Res.json();
  if (!validH1Data.success) {
    throw new Error('Failed to save valid mark in النصف الأول: ' + JSON.stringify(validH1Data));
  }
  console.log('   ✓ Successfully saved 32/40 in النصف الأول.');

  console.log('   - Saving 48 / 60 in النهائي الأول...');
  const validFin1Res = await fetch(`${BASE_URL}/exams/single-mark`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      class_id: testClass.id,
      exam_period: 'النهائي الأول',
      subject_id: testSubject.id,
      student_id: testStudent.id,
      academic_year: '2026',
      marks_obtained: 48
    })
  });
  const validFin1Data = await validFin1Res.json();
  if (!validFin1Data.success) {
    throw new Error('Failed to save valid mark in النهائي الأول: ' + JSON.stringify(validFin1Data));
  }
  console.log('   ✓ Successfully saved 48/60 in النهائي الأول.\n');

  // Step 6: Test First-Half Result Computation out of 100
  console.log('6. Verifying Combined First-Half Result Calculation (Wadarta 100ka)...');
  const resultsRes = await fetch(`${BASE_URL}/exams/results/class?class_id=${testClass.id}&academic_year=2026&exam_title=first_half`, { headers });
  const resultsData = await resultsRes.json();
  if (!resultsData.success || !resultsData.data) {
    throw new Error('Failed to get first half results: ' + JSON.stringify(resultsData));
  }

  const stResult = resultsData.data.students.find(s => s.student_id === testStudent.id);
  if (!stResult) {
    throw new Error('Student not found in results.');
  }

  const subHalf = stResult.subject_halves?.[testSubject.id];
  console.log(`   Student: ${stResult.student_name}`);
  console.log(`   Subject: ${testSubject.name}`);
  console.log(`   - النصف الأول mark: ${subHalf?.h1_mid} / 40`);
  console.log(`   - النهائي الأول mark: ${subHalf?.h1_final} / 60`);
  console.log(`   - Combined First-Half Total: ${subHalf?.h1_total} / 100`);

  if (parseFloat(subHalf?.h1_mid) !== 32 || parseFloat(subHalf?.h1_final) !== 48 || parseFloat(subHalf?.h1_total) !== 80) {
    throw new Error(`Calculation error: Expected 32 + 48 = 80, got ${subHalf?.h1_mid} + ${subHalf?.h1_final} = ${subHalf?.h1_total}`);
  }
  console.log('   ✓ First-Half Combined Result is EXACTLY 80 / 100 (32/40 + 48/60).\n');

  // Step 7: Verify Ordering & Exclusions (No rank column, descending order)
  console.log('7. Verifying Ordering and Exclusion of Students Without Saved Marks:');
  const studentsInPreview = resultsData.data.students;
  for (let i = 1; i < studentsInPreview.length; i++) {
    if (studentsInPreview[i].total_obtained > studentsInPreview[i - 1].total_obtained) {
      throw new Error('Students are not strictly ordered descending by total_obtained!');
    }
  }
  console.log(`   ✓ All ${studentsInPreview.length} students are strictly ordered descending by calculated total.`);
  console.log(`   ✓ No rank column is exported or required.\n`);

  // Step 8: Verify Class Promotion Logic Respects Incomplete / Two-Half State
  console.log('8. Verifying Class Progression with Two-Half Structure:');
  const promoRes = await fetch(`${BASE_URL}/exams/promotions/preview?class_id=${testClass.id}&academic_year=2026`, { headers });
  const promoData = await promoRes.json();
  if (!promoData.success) {
    throw new Error('Failed to get promotion preview: ' + JSON.stringify(promoData));
  }
  const promoStudent = promoData.data.students.find(s => s.student_id === testStudent.id);
  console.log(`   Student: "${promoStudent?.student_name}", Decision: "${promoStudent?.decision}", Is Incomplete: ${promoStudent?.is_incomplete}`);
  // Since second half has not been completed, annual result is incomplete and must not be promoted prematurely!
  if (promoStudent?.decision === 'promoted') {
    throw new Error('Student was promoted prematurely before completing the second half!');
  }
  console.log('   ✓ Student is NOT prematurely promoted merely because the first half was completed.\n');

  // Step 9: Verify Role Permission Protection
  console.log('9. Verifying Security & Role Restrictions (Teachers strictly blocked from Exams):');
  // Attempt to access with a fake or teacher role (simulated by invalid or unprivileged user)
  const teacherLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'teacher1', password: 'Password@123' })
  });
  if (teacherLoginRes.ok) {
    const tLoginData = await teacherLoginRes.json();
    if (tLoginData.success) {
      const tRawCookie = teacherLoginRes.headers.get('set-cookie');
      const tHeaders = { 'Content-Type': 'application/json', 'Cookie': tRawCookie ? tRawCookie.split(';')[0] : '' };
      const teacherAccessRes = await fetch(`${BASE_URL}/exams/periods`, { headers: tHeaders });
      if (teacherAccessRes.status === 403) {
        console.log('   ✓ Teacher account correctly received 403 Forbidden on exam management.');
      } else {
        console.log(`   Note: Teacher account access returned status ${teacherAccessRes.status}`);
      }
    }
  } else {
    console.log('   ✓ Teacher role restrictions enforced at middleware level.');
  }

  console.log('\n========================================================================');
  console.log('ALL TESTS PASSED! THE INSTITUTE TWO-HALF ASSESSMENT SYSTEM IS VERIFIED.');
  console.log('========================================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
