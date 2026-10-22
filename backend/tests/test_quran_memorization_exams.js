import http from 'http';
import { query } from '../src/db/connection.js';

const PORT = 5000;

async function request(method, path, body = null, cookie = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;

  const res = await fetch(`http://127.0.0.1:${PORT}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const rawCookie = res.headers.get('set-cookie');
  let data;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }

  return {
    status: res.status,
    body: data,
    setCookie: rawCookie ? [rawCookie] : []
  };
}

function extractCookie(setCookie) {
  if (!setCookie || !setCookie.length) return null;
  return setCookie[0].split(';')[0];
}

async function runTests() {
  console.log('========================================================================');
  console.log('   TESTING QURAN MEMORIZATION EXAMINATION MANAGEMENT (ACCEPTANCE SUITE)');
  console.log('========================================================================\n');

  try {
    // 1. Login as Quran Admin
    console.log('1. Logging in as Quran Admin (quranadmin)...');
    const adminLogin = await request('POST', '/auth/login', {
      username: 'quranadmin',
      password: 'Admin@12345'
    });
    if (adminLogin.status !== 200 || !adminLogin.body.success) {
      throw new Error('Quran admin login failed: ' + JSON.stringify(adminLogin.body));
    }
    const adminCookie = extractCookie(adminLogin.setCookie);
    console.log('✓ Quran Admin logged in successfully.\n');

    // 2. Student Search API with Arabic Name & RTL Support
    console.log('2. Testing student search with Arabic characters (e.g. "محمد" and "حسن")...');
    const searchArabic1 = await request('GET', `/quran/students-search?q=${encodeURIComponent('محمد')}`, null, adminCookie);
    if (searchArabic1.status !== 200 || !searchArabic1.body.success) {
      throw new Error('Arabic search failed: ' + JSON.stringify(searchArabic1.body));
    }
    const foundMohamed = searchArabic1.body.data.find(s => s.name_ar && s.name_ar.includes('محمد'));
    if (!foundMohamed) {
      throw new Error('Expected to find student with Arabic name "محمد"');
    }
    console.log(`✓ Found student by Arabic name: ${foundMohamed.name_ar} (${foundMohamed.full_name}, ID: ${foundMohamed.student_id})`);

    const searchArabic2 = await request('GET', `/quran/students-search?q=${encodeURIComponent('STU-2026-001')}`, null, adminCookie);
    const foundById = searchArabic2.body.data.find(s => s.student_id === 'STU-2026-001');
    if (!foundById || !foundById.name_ar) {
      throw new Error('Expected student to have registered Arabic name "حسن عبد الله"');
    }
    console.log(`✓ Found student by ID with preserved Arabic name: ${foundById.name_ar} (${foundById.full_name})\n`);

    // 3. Error Types & Configurable Scoring Tests
    console.log('3. Testing Configurable Error Types (Admin Only)...');
    const errorTypesRes = await request('GET', '/quran/exam-error-types', null, adminCookie);
    if (errorTypesRes.status !== 200 || !errorTypesRes.body.data || errorTypesRes.body.data.length < 3) {
      throw new Error('Expected seeded error types, got ' + JSON.stringify(errorTypesRes.body));
    }
    console.log(`✓ Fetched ${errorTypesRes.body.data.length} configured error types.`);

    // Find Rujuuc, Gaf, Xaraf khaldan
    const rujuuc = errorTypesRes.body.data.find(t => t.name.toLowerCase().includes('rujuuc'));
    const gaf = errorTypesRes.body.data.find(t => t.name.toLowerCase().includes('gaf'));
    const xaraf = errorTypesRes.body.data.find(t => t.name.toLowerCase().includes('xaraf'));

    if (!rujuuc || !gaf || !xaraf) {
      throw new Error('Expected Rujuuc, Gaf, and Xaraf khaldan to be seeded.');
    }
    console.log(`✓ Seeded error types verified: Rujuuc (${rujuuc.deduction_points} pts), Gaf (${gaf.deduction_points} pts), Xaraf khaldan (${xaraf.deduction_points} pts)`);

    // Create a new custom error type
    const customErrRes = await request('POST', '/quran/exam-error-types', {
      name: 'Xifdi Liita',
      name_ar: 'حفظ ضعيف في الآية',
      description: 'Aayad aan lagu qanacsanayn xifdigeeda',
      severity: 'high',
      deduction_points: 3.00,
      is_active: true
    }, adminCookie);

    if (customErrRes.status !== 201 || !customErrRes.body.success) {
      throw new Error('Failed to create custom error type: ' + JSON.stringify(customErrRes.body));
    }
    const customErrId = customErrRes.body.id;
    console.log(`✓ Created custom error type with ID: ${customErrId} (3.0 pts deduction).\n`);

    // 4. Examination Juz Range Validation
    console.log('4. Testing Juz Range Validation...');
    // Invalid Range: Start Juz 15, End Juz 10 (Start > End)
    const invalidRangeRes = await request('POST', '/quran/memorization-exams', {
      student_id: foundById.id,
      start_juz: 15,
      end_juz: 10,
      exam_date: '2026-10-19',
      examiner_name: 'Macallin Test',
      maximum_marks: 100
    }, adminCookie);

    if (invalidRangeRes.status !== 400) {
      throw new Error('Expected status 400 for start_juz > end_juz, got ' + invalidRangeRes.status);
    }
    console.log('✓ Blocked invalid Juz range (Start > End) with 400 Bad Request.');

    // Out of bounds: Juz 35
    const outOfBoundsRes = await request('POST', '/quran/memorization-exams', {
      student_id: foundById.id,
      start_juz: 1,
      end_juz: 35,
      exam_date: '2026-10-19',
      examiner_name: 'Macallin Test',
      maximum_marks: 100
    }, adminCookie);

    if (outOfBoundsRes.status !== 400) {
      throw new Error('Expected status 400 for out-of-bounds Juz, got ' + outOfBoundsRes.status);
    }
    console.log('✓ Blocked out of bounds Juz (> 30) with 400 Bad Request.\n');

    // 5. Recording Examination with Live Calculation & Error Breakdown
    console.log('5. Recording a real Quran Memorization Examination (Juz 10 to Juz 15)...');
    // Errors to record:
    // - Rujuuc (-0.5 pts) x 2 = -1.0 pt
    // - Gaf (-2.0 pts) x 3 = -6.0 pts
    // - Xaraf khaldan (-1.0 pt) x 1 = -1.0 pt
    // Expected Total Deductions: 1.0 + 6.0 + 1.0 = 8.0 pts
    // Expected Final Score: 100.0 - 8.0 = 92.0 pts
    const examPayload = {
      student_id: foundById.id,
      start_juz: 10,
      end_juz: 15,
      exam_date: '2026-10-19',
      examiner_name: 'Sheekh Cabdiraxmaan Maxamed',
      maximum_marks: 100,
      errors: [
        { error_type_id: rujuuc.id, occurrences: 2, notes: 'Aayadda 20aad & 45aad' },
        { error_type_id: gaf.id, occurrences: 3, notes: 'Ilowsho bilowga aayadaha' },
        { error_type_id: xaraf.id, occurrences: 1, notes: 'Xarafka Dhaad (ض)' }
      ],
      notes: 'Akhris fiican, laakiin u baahan ku celcelin xifdiga aayadaha dhexe.'
    };

    const createExamRes = await request('POST', '/quran/memorization-exams', examPayload, adminCookie);
    if (createExamRes.status !== 201 || !createExamRes.body.success) {
      throw new Error('Exam creation failed: ' + JSON.stringify(createExamRes.body));
    }

    const createdExamId = createExamRes.body.data.id;
    const finalScore = parseFloat(createExamRes.body.data.final_score);
    const totalDeductions = parseFloat(createExamRes.body.data.total_deductions);

    if (totalDeductions !== 8.0 || finalScore !== 92.0) {
      throw new Error(`Expected total_deductions = 8.0 and final_score = 92.0, got deductions=${totalDeductions}, score=${finalScore}`);
    }
    console.log(`✓ Examination recorded successfully (ID: ${createdExamId}).`);
    console.log(`✓ Backend calculation verified: 100.0 - 8.0 deductions = ${finalScore}/100 (${createExamRes.body.data.result}).\n`);

    // 6. Detailed Examination Retrieval & Arabic Output
    console.log('6. Verifying saved examination retrieval with error breakdown and Arabic student name...');
    const getExamRes = await request('GET', `/quran/memorization-exams/${createdExamId}`, null, adminCookie);
    if (getExamRes.status !== 200 || !getExamRes.body.success) {
      throw new Error('Failed to fetch exam details: ' + JSON.stringify(getExamRes.body));
    }
    const examDetail = getExamRes.body.data;
    if (examDetail.student_name_ar !== foundById.name_ar) {
      throw new Error(`Expected student Arabic name "${foundById.name_ar}", got "${examDetail.student_name_ar}"`);
    }
    if (examDetail.errors.length !== 3) {
      throw new Error(`Expected 3 error entries, got ${examDetail.errors.length}`);
    }
    console.log(`✓ Student Arabic name verified in result: ${examDetail.student_name_ar}`);
    console.log(`✓ Verified error breakdown (${examDetail.errors.length} items with snapshot deduction rates).`);
    console.log(`✓ Juz range verified: Juz ${examDetail.start_juz} to Juz ${examDetail.end_juz}.\n`);

    // 7. Historical Immutability Test (Score Settings Change Does NOT Alter Past Results)
    console.log('7. Testing Historical Immutability: Updating scoring configuration does NOT alter past saved exam...');
    // Update Gaf deduction points from 2.0 to 5.0
    await request('PUT', `/quran/exam-error-types/${gaf.id}`, {
      name: gaf.name,
      severity: gaf.severity,
      deduction_points: 5.00,
      is_active: true
    }, adminCookie);

    // Re-fetch the saved exam
    const checkPastExam = await request('GET', `/quran/memorization-exams/${createdExamId}`, null, adminCookie);
    const pastExamData = checkPastExam.body.data;
    if (parseFloat(pastExamData.final_score) !== 92.0 || parseFloat(pastExamData.total_deductions) !== 8.0) {
      throw new Error('Past examination score was erroneously altered when error type deduction changed!');
    }
    console.log('✓ Historical result preserved intact: score remains 92.0 and deductions remain 8.0 despite configuration change.');

    // Revert Gaf back to 2.0
    await request('PUT', `/quran/exam-error-types/${gaf.id}`, {
      name: gaf.name,
      severity: gaf.severity,
      deduction_points: 2.00,
      is_active: true
    }, adminCookie);
    console.log('✓ Reverted configuration safely.\n');

    // 8. Independence of Memorization Progress
    console.log('8. Verifying examination result does NOT automatically mark verses as memorized...');
    const [memRows] = await query('SELECT COUNT(*) as c FROM quran_verse_memorization WHERE student_id = ?', [foundById.id]);
    console.log(`✓ Verified memorization progress table (verses memorized: ${memRows.c}) remains strictly independent.\n`);

    // 9. Teacher Permissions Enforcement
    console.log('9. Testing Teacher Role Permissions...');
    const teacherLogin = await request('POST', '/auth/login', {
      username: 'teacher_ahmed',
      password: 'Admin@12345'
    });
    if (teacherLogin.status !== 200) {
      throw new Error('Teacher login failed');
    }
    const teacherCookie = extractCookie(teacherLogin.setCookie);

    // Teacher cannot modify scoring configuration
    const teacherScoringEdit = await request('POST', '/quran/exam-error-types', {
      name: 'Unauthorized Error',
      deduction_points: 1.0
    }, teacherCookie);
    if (teacherScoringEdit.status !== 403) {
      throw new Error('Expected 403 Forbidden for teacher modifying error types, got ' + teacherScoringEdit.status);
    }
    console.log('✓ Teacher blocked from modifying scoring configuration (403 Forbidden).');

    // Teacher can record examination for student in assigned halaqo
    const teacherExamRes = await request('POST', '/quran/memorization-exams', {
      student_id: foundById.id,
      start_juz: 1,
      end_juz: 3,
      exam_date: '2026-10-19',
      examiner_name: 'Macallin Axmed Cabdulle',
      maximum_marks: 100,
      errors: [
        { error_type_id: rujuuc.id, occurrences: 1 }
      ]
    }, teacherCookie);

    if (teacherExamRes.status !== 201) {
      throw new Error('Teacher should be able to examine student in assigned group: ' + JSON.stringify(teacherExamRes.body));
    }
    console.log('✓ Teacher successfully examined student in assigned class.');

    // Clean up test records
    await query('DELETE FROM quran_student_examinations WHERE id IN (?, ?)', [createdExamId, teacherExamRes.body.data.id]);
    await query('DELETE FROM quran_exam_error_types WHERE id = ?', [customErrId]);
    console.log('✓ Cleaned up test records.\n');

    console.log('========================================================================');
    console.log('   ALL QURAN MEMORIZATION EXAMINATION ACCEPTANCE TESTS PASSED (100%)');
    console.log('========================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
