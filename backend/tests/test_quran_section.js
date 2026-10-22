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
  console.log('   TESTING QURAN SECTION: DIIWAANKA XIFDIGA & FASALLADA');
  console.log('========================================================================\n');

  let testClassId = null;
  let testStudentId = null;

  try {
    // 1. Login as Quran Admin
    console.log('1. Logging in as Quran Admin (quranadmin)...');
    const adminLogin = await request('POST', '/auth/login', {
      username: 'quranadmin',
      password: 'Admin@12345'
    });
    if (adminLogin.status !== 200 || !adminLogin.body.success) {
      throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.body));
    }
    const adminCookie = extractCookie(adminLogin.setCookie);
    console.log('✓ Admin logged in successfully.\n');

    // 2. Login as Teacher
    console.log('2. Logging in as Teacher (teacher_ahmed)...');
    const teacherLogin = await request('POST', '/auth/login', {
      username: 'teacher_ahmed',
      password: 'Admin@12345'
    });
    if (teacherLogin.status !== 200 || !teacherLogin.body.success) {
      throw new Error('Teacher login failed: ' + JSON.stringify(teacherLogin.body));
    }
    const teacherCookie = extractCookie(teacherLogin.setCookie);
    const teacherUser = teacherLogin.body.user;
    console.log(`✓ Teacher logged in successfully (${teacherUser.full_name}, ID: ${teacherUser.id}).\n`);

    // 3. Test Teacher Permissions: Cannot access Class Management
    console.log('3. Testing Teacher Permissions: Blocking administrative class management...');
    const teacherCreateAttempt = await request('POST', '/quran/groups', {
      name: 'Fasal sharci darro ah',
      shift: 'Subax',
      teacher_id: teacherUser.id
    }, teacherCookie);

    if (teacherCreateAttempt.status !== 403) {
      throw new Error(`Teacher was NOT blocked from creating class (Status: ${teacherCreateAttempt.status})`);
    }
    console.log('✓ Teacher blocked with 403 Forbidden when attempting to create a class.');

    const teacherRegisterAttempt = await request('POST', '/quran/groups/1/register-student', {
      full_name: 'Test Student',
      phone: '+252610000000'
    }, teacherCookie);
    if (teacherRegisterAttempt.status !== 403) {
      throw new Error(`Teacher was NOT blocked from registering student (Status: ${teacherRegisterAttempt.status})`);
    }
    console.log('✓ Teacher blocked with 403 Forbidden when attempting to manage class students directly.\n');

    // 4. Test Fasallada: Admin creates class with schedule & assigns exactly one teacher
    console.log('4. Testing Class Management (Admin): Creating class with schedule & single teacher...');
    const createClassRes = await request('POST', '/quran/groups', {
      name: 'Halaqada Tijaabada (Subax iyo Galab)',
      shift: 'Subax iyo Galab',
      teacher_id: teacherUser.id
    }, adminCookie);

    if (createClassRes.status !== 201 || !createClassRes.body.success) {
      throw new Error('Failed to create class: ' + JSON.stringify(createClassRes.body));
    }
    testClassId = createClassRes.body.id;
    console.log(`✓ Created Quran class with ID: ${testClassId}, Schedule: "Subax iyo Galab", Teacher ID: ${teacherUser.id}`);

    // Verify exactly one teacher assigned in database
    const assignments = await query(
      `SELECT * FROM quran_teacher_assignments WHERE group_id = ?`,
      [testClassId]
    );
    if (assignments.length !== 1 || assignments[0].teacher_id !== teacherUser.id) {
      throw new Error(`Expected exactly 1 teacher assigned to group, found: ${assignments.length}`);
    }
    console.log('✓ Enforced exactly one teacher assigned to class in database.\n');

    // 5. Test Register New Student directly through Class Workflow
    console.log('5. Testing Direct Student Registration into Class...');
    const regStudentRes = await request('POST', `/quran/groups/${testClassId}/register-student`, {
      full_name: 'Cabdiraxmaan Maxamed Cali',
      name_ar: 'عبد الرحمن محمد علي',
      gender: 'male',
      phone: '+252615998877',
      guardian_name: 'Maxamed Cali',
      guardian_phone: '+252615998870'
    }, adminCookie);

    if (regStudentRes.status !== 201 || !regStudentRes.body.success) {
      throw new Error('Failed to register student to class: ' + JSON.stringify(regStudentRes.body));
    }
    testStudentId = regStudentRes.body.data.id;
    console.log(`✓ Student registered directly into class: ${regStudentRes.body.data.full_name} (${regStudentRes.body.data.name_ar}), Student ID: ${regStudentRes.body.data.student_id}`);

    // Verify student is in group students list
    const classStudentsRes = await request('GET', `/quran/groups/${testClassId}/students`, null, adminCookie);
    const inClass = classStudentsRes.body.data?.find(s => s.id === testStudentId);
    if (!inClass) {
      throw new Error('Registered student not found in class student roster');
    }
    console.log('✓ Student verified in class student roster.\n');

    // 6. Test Teacher Scoping: Teacher can view assigned class & student
    console.log('6. Testing Teacher Scoping for Diiwaanka Xifdiga...');
    const teacherGroupsRes = await request('GET', '/quran/groups', null, teacherCookie);
    const teacherHasClass = teacherGroupsRes.body.data?.find(g => g.id === testClassId);
    if (!teacherHasClass) {
      throw new Error('Assigned class not found in teacher groups list');
    }
    console.log(`✓ Teacher successfully sees assigned class: "${teacherHasClass.name}" (${teacherHasClass.shift})`);

    const teacherStudentsRes = await request('GET', `/quran/groups/${testClassId}/students`, null, teacherCookie);
    if (teacherStudentsRes.status !== 200 || !teacherStudentsRes.body.data?.find(s => s.id === testStudentId)) {
      throw new Error('Teacher could not access students of assigned class');
    }
    console.log('✓ Teacher successfully accesses students of assigned class.\n');

    // 7. Test Diiwaanka Xifdiga: Fetch all 114 Surahs for student
    console.log('7. Testing 114 Surahs Retrieval for Student...');
    const surahsRes = await request('GET', `/quran/students/${testStudentId}/surahs`, null, teacherCookie);
    if (surahsRes.status !== 200 || !surahsRes.body.success) {
      throw new Error('Failed to fetch student surahs: ' + JSON.stringify(surahsRes.body));
    }
    const allSurahs = surahsRes.body.data.surahs;
    if (allSurahs.length !== 114) {
      throw new Error(`Expected 114 surahs, received: ${allSurahs.length}`);
    }
    console.log(`✓ Retrieved all 114 Surahs in correct Quran order (#1 ${allSurahs[0].name_ar} to #114 ${allSurahs[113].name_ar}).`);
    console.log(`✓ Initial completed count: ${surahsRes.body.data.completed_count} / 114.\n`);

    // 8. Test Bulk Surah Memorization: "Kaydi Xifdiga"
    console.log('8. Testing Bulk Surah Memorization ("Kaydi Xifdiga")...');
    // Select Surah 1 (Al-Fatihah), Surah 112 (Al-Ikhlas), Surah 113 (Al-Falaq), Surah 114 (An-Nas)
    const surahsToMemorize = [1, 112, 113, 114];
    const saveSurahsRes = await request('POST', `/quran/students/${testStudentId}/surahs`, {
      surah_numbers: surahsToMemorize
    }, teacherCookie);

    if (saveSurahsRes.status !== 200 || !saveSurahsRes.body.success) {
      throw new Error('Failed to save surahs: ' + JSON.stringify(saveSurahsRes.body));
    }
    console.log(`✓ Saved ${saveSurahsRes.body.data.completed_surahs_count} completed surahs together.`);

    // Verify retrieval after saving
    const verifySurahsRes = await request('GET', `/quran/students/${testStudentId}/surahs`, null, teacherCookie);
    const savedList = verifySurahsRes.body.data.surahs;
    const completedList = savedList.filter(s => s.is_memorized);
    if (completedList.length !== 4) {
      throw new Error(`Expected 4 completed surahs, found: ${completedList.length}`);
    }
    console.log('✓ Verified 4 Surahs marked memorized:');
    completedList.forEach(s => {
      console.log(`   - #${s.number} ${s.name_ar} (${s.name_en}) - ${s.total_verses} aayadood`);
    });

    // Verify student memorization summary and completion counts
    const summaryRes = await request('GET', `/quran/students/${testStudentId}/summary`, null, teacherCookie);
    const summary = summaryRes.body.data.memorization;
    if (summary.completed_surahs_count !== 4) {
      throw new Error(`Expected summary completed_surahs_count 4, got ${summary.completed_surahs_count}`);
    }
    console.log(`✓ Verified summary completion counts: ${summary.completed_surahs_count} surahs, ${summary.memorized_verses} verses memorized.\n`);

    // 9. Clean up test records safely
    console.log('9. Cleaning up test records...');
    await query(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [testStudentId]);
    await query(`DELETE FROM quran_enrollments WHERE student_id = ?`, [testStudentId]);
    await query(`DELETE FROM students WHERE id = ?`, [testStudentId]);
    await query(`DELETE FROM quran_teacher_assignments WHERE group_id = ?`, [testClassId]);
    await query(`DELETE FROM quran_groups WHERE id = ?`, [testClassId]);
    console.log('✓ Test records cleaned up safely.\n');

    console.log('========================================================================');
    console.log('   ALL QURAN SECTION ACCEPTANCE TESTS PASSED (100%)');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    // Cleanup on failure
    if (testStudentId) {
      await query(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [testStudentId]);
      await query(`DELETE FROM quran_enrollments WHERE student_id = ?`, [testStudentId]);
      await query(`DELETE FROM students WHERE id = ?`, [testStudentId]);
    }
    if (testClassId) {
      await query(`DELETE FROM quran_teacher_assignments WHERE group_id = ?`, [testClassId]);
      await query(`DELETE FROM quran_groups WHERE id = ?`, [testClassId]);
    }
    process.exit(1);
  }

  process.exit(0);
}

runTests();
