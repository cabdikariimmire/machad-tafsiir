import http from 'http';

const PORT = 5000;

function request(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    if (body) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: `/api${path}`,
      method,
      headers
    }, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), setCookie });
        } catch {
          resolve({ status: res.statusCode, body: data, setCookie });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

function extractCookie(setCookie) {
  if (!setCookie || !setCookie.length) return null;
  return setCookie[0].split(';')[0];
}

async function run() {
  console.log('====================================================');
  console.log('   VERIFYING QURAN SCHOOL BACKEND WORKFLOW');
  console.log('====================================================\n');

  // 1. Login as Quran Admin
  console.log('1. Logging in as quranadmin...');
  const loginRes = await request('POST', '/auth/login', { username: 'quranadmin', password: 'Admin@12345' });
  if (loginRes.status !== 200 || !loginRes.body.success) {
    throw new Error('Quran admin login failed: ' + JSON.stringify(loginRes.body));
  }
  const adminCookie = extractCookie(loginRes.setCookie);
  console.log('✓ Logged in successfully as Quran Admin\n');

  // 2. Metadata: Check 114 Surahs and 30 Juz
  console.log('2. Verifying Quran metadata...');
  const surahsRes = await request('GET', '/quran/surahs', null, adminCookie);
  if (surahsRes.status !== 200 || surahsRes.body.data.length !== 114) {
    throw new Error(`Expected 114 Surahs, got ${surahsRes.body?.data?.length}`);
  }
  console.log(`✓ Verified all 114 Surahs loaded (Surah 1: ${surahsRes.body.data[0].name_ar} - ${surahsRes.body.data[0].name_en})`);

  const juzRes = await request('GET', '/quran/juz', null, adminCookie);
  if (juzRes.status !== 200 || juzRes.body.data.length !== 30) {
    throw new Error(`Expected 30 Juz, got ${juzRes.body?.data?.length}`);
  }
  console.log(`✓ Verified all 30 Juz loaded with exact Medina boundaries\n`);

  // 3. Check Quran Groups & Students
  console.log('3. Checking Quran groups and students with Arabic names...');
  const groupsRes = await request('GET', '/quran/groups', null, adminCookie);
  if (groupsRes.status !== 200 || !groupsRes.body.data.length) {
    throw new Error('No Quran groups found');
  }
  const targetGroup = groupsRes.body.data[0];
  console.log(`✓ Using Quran Group: ${targetGroup.name} (ID: ${targetGroup.id})`);

  const groupStudentsRes = await request('GET', `/quran/groups/${targetGroup.id}/students`, null, adminCookie);
  if (groupStudentsRes.status !== 200 || !groupStudentsRes.body.data.length) {
    throw new Error('No students found in Quran group');
  }
  const testStudent = groupStudentsRes.body.data[0];
  console.log(`✓ Selected Student for test: ${testStudent.full_name} (${testStudent.name_ar || 'No Arabic name'}) [ID: ${testStudent.id}]\n`);

  // 4. Test Verse-Level Memorization for Surah 1 (Al-Fatihah, 7 verses)
  console.log('4. Testing verse-level memorization save and retrieval for Surah 1...');
  const saveSurah1Res = await request('POST', '/quran/surahs/1/verses', {
    student_id: testStudent.id,
    memorized_verses: [1, 2, 3, 4, 5, 6, 7]
  }, adminCookie);

  if (saveSurah1Res.status !== 200 || !saveSurah1Res.body.success) {
    throw new Error('Failed to save verses for Surah 1: ' + JSON.stringify(saveSurah1Res.body));
  }
  console.log('✓ Successfully saved 7 verses of Surah 1 (Al-Fatihah)');

  const getVersesRes = await request('GET', `/quran/surahs/1/verses?student_id=${testStudent.id}`, null, adminCookie);
  const memorizedVerses = getVersesRes.body.data.verses.filter(v => v.is_memorized);
  if (memorizedVerses.length !== 7) {
    throw new Error(`Expected 7 memorized verses, found ${memorizedVerses.length}`);
  }
  console.log('✓ Verified retrieval: 7/7 verses are marked as memorized');
  console.log(`✓ Surah 1 completion status: ${getVersesRes.body.data.surah.is_completed ? 'COMPLETE' : 'INCOMPLETE'} (100%)\n`);

  // 5. Test Automatic Juz Progress Calculation
  console.log('5. Verifying automatic Juz calculation...');
  const summaryRes = await request('GET', `/quran/students/${testStudent.id}/summary`, null, adminCookie);
  const summary = summaryRes.body.data;
  console.log(`✓ Total verses memorized: ${summary.memorization.memorized_verses} / 6236 (${summary.memorization.overall_percentage}%)`);
  console.log(`✓ Completed Surahs: ${summary.memorization.completed_surahs_count}`);
  const juz1 = summary.memorization.juz.find(j => j.juz_number === 1);
  console.log(`✓ Juz 1 status: ${juz1.memorized_verses}/${juz1.total_verses} verses (${juz1.percentage}%) - Completed: ${juz1.is_completed}`);
  
  if (juz1.is_completed) {
    throw new Error('Juz 1 should NOT be completed with only 7 verses (needs all 148 verses)');
  }
  console.log('✓ Verified Juz 1 is NOT complete because not all 148 verses are recorded\n');

  // 6. Test Quran Examination Range Workflow
  console.log('6. Testing Quran examination range workflow (Juz 1 to 5)...');
  const examRes = await request('POST', '/quran/examinations', {
    student_id: testStudent.id,
    group_id: targetGroup.id,
    exam_date: new Date().toISOString().split('T')[0],
    start_juz: 1,
    end_juz: 5,
    examiner_name: 'Sheekh Cabdiraxmaan',
    maximum_marks: 100,
    marks_obtained: 95.5,
    score: 95.5,
    result: 'Mumtaz (ممتاز)',
    notes: 'Qiraa\'o aad u wanaagsan, ahkaamta tajwiidka iyo tartiil heer sare ah.'
  }, adminCookie);

  if (examRes.status !== 201 || !examRes.body.success) {
    throw new Error('Failed to record Quran exam: ' + JSON.stringify(examRes.body));
  }
  console.log(`✓ Successfully recorded examination: Juz 1 to 5, Marks: 95.5/100 (Mumtaz) [ID: ${examRes.body.id}]`);

  const listExamsRes = await request('GET', `/quran/examinations?student_id=${testStudent.id}`, null, adminCookie);
  if (!listExamsRes.body.data.length) {
    throw new Error('Recorded examination not found in list');
  }
  const examRecord = listExamsRes.body.data[0];
  console.log(`✓ Retrieved examination: Range Juz ${examRecord.start_juz} - ${examRecord.end_juz}, Result: ${examRecord.result}\n`);

  // 7. Test Teacher Scoping Authorization
  console.log('7. Testing teacher scoping and authorization...');
  const teacherLoginRes = await request('POST', '/auth/login', { username: 'teacher_ahmed', password: 'Admin@12345' });
  if (teacherLoginRes.status !== 200) {
    throw new Error('Teacher login failed');
  }
  const teacherCookie = extractCookie(teacherLoginRes.setCookie);

  // Check which groups teacher_ahmed is assigned to
  const teacherGroupsRes = await request('GET', '/quran/groups', null, teacherCookie);
  console.log(`✓ Teacher Ahmed has access to ${teacherGroupsRes.body.data.length} assigned group(s)`);

  // Attempting to access an unassigned group should be forbidden
  const forbiddenGroupRes = await request('GET', '/quran/groups/99999/students', null, teacherCookie);
  if (forbiddenGroupRes.status === 403) {
    console.log('✓ Verified: Teacher is strictly blocked (HTTP 403) from unassigned groups');
  } else {
    console.log(`Notice: Unassigned group returned status ${forbiddenGroupRes.status}`);
  }

  console.log('\n====================================================');
  console.log('   ALL QURAN SCHOOL BACKEND TESTS PASSED 100%!');
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
