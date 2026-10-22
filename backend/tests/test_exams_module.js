import http from 'http';

function makeRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api${path}`,
        method,
        headers: reqHeaders
      },
      (res) => {
        const isExcel = res.headers['content-type']?.includes('spreadsheetml');
        if (isExcel) {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve({
              status: res.statusCode,
              isExcel: true,
              size: buffer.length,
              headers: res.headers
            });
          });
          return;
        }

        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(rawData);
          } catch (e) {
            parsed = rawData;
          }
          resolve({
            status: res.statusCode,
            data: parsed,
            cookies: res.headers['set-cookie']
          });
        });
      }
    );

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

async function login(username, password) {
  const res = await makeRequest({
    method: 'POST',
    path: '/auth/login',
    body: { username, password }
  });
  if (res.cookies && res.cookies.length > 0) {
    return res.cookies.map(c => c.split(';')[0]).join('; ');
  }
  return null;
}

async function runTests() {
  console.log('====================================================');
  console.log('   TESTING EXAMS, MARKS & RESULTS MODULE (ALL CRITERIA)');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  // 1. Authentication
  const cookie = await login('superadmin', 'Admin@12345');
  const authHeaders = { Cookie: cookie };
  assert(!!cookie, 'Auth: Super Admin logged in with valid session cookie');

  // Setup: Create a dedicated test class and subjects
  const rand = Math.floor(Math.random() * 9000 + 1000);
  const className = `Class-Exam-Test-${rand}`;
  const resCls = await makeRequest({
    method: 'POST',
    path: '/institute/classes',
    headers: authHeaders,
    body: { class_name: className, academic_year: '2026', description: 'Exam Test Suite' }
  });
  const classId = resCls.data?.id;
  assert(resCls.status === 201 && !!classId, `Setup: Created test class ${className} (ID: ${classId})`);

  // Create 2 subjects
  const resSub1 = await makeRequest({
    method: 'POST',
    path: '/institute/subjects',
    headers: authHeaders,
    body: { subject_code: `SUB-T1-${rand}`, subject_name: `Tafsiir Exam ${rand}` }
  });
  const sub1Id = resSub1.data?.id;

  const resSub2 = await makeRequest({
    method: 'POST',
    path: '/institute/subjects',
    headers: authHeaders,
    body: { subject_code: `SUB-T2-${rand}`, subject_name: `Fiqh Exam ${rand}` }
  });
  const sub2Id = resSub2.data?.id;
  assert(!!sub1Id && !!sub2Id, 'Setup: Created 2 test subjects');

  // Assign subjects to class
  await makeRequest({
    method: 'POST',
    path: `/institute/classes/${classId}/subjects`,
    headers: authHeaders,
    body: { subject_ids: [sub1Id, sub2Id] }
  });

  // Enroll 4 test students in this class
  const students = [];
  for (let i = 1; i <= 4; i++) {
    const sName = `Student ${String.fromCharCode(64 + i)} (Test ${rand})`;
    const resSt = await makeRequest({
      method: 'POST',
      path: '/students',
      headers: authHeaders,
      body: {
        full_name: sName,
        phone: `+252615${rand}${i}`,
        gender: i % 2 === 0 ? 'female' : 'male',
        enroll_institute: true,
        institute_class_id: classId
      }
    });
    students.push({ id: resSt.data?.student?.id, name: sName });
  }
  assert(students.length === 4 && students.every(s => s.id), 'Setup: Enrolled 4 test students in the class');

  // 2. Examination Management
  // Create Exam 1 (Tafsiir)
  const examTitle1 = `Imtixaanka Bisha 1-aad (Tafsiir) ${rand}`;
  const resEx1 = await makeRequest({
    method: 'POST',
    path: '/exams',
    headers: authHeaders,
    body: {
      division: 'institute',
      title: examTitle1,
      class_id: classId,
      subject_id: sub1Id,
      academic_year: '2026',
      exam_date: '2026-10-25',
      maximum_marks: 100
    }
  });
  const exam1Id = resEx1.data?.id;
  assert(resEx1.status === 201 && !!exam1Id, '1. Authorized user can create examination for assigned subject');

  // Prevent duplicate examination
  const resDupEx = await makeRequest({
    method: 'POST',
    path: '/exams',
    headers: authHeaders,
    body: {
      division: 'institute',
      title: examTitle1,
      class_id: classId,
      subject_id: sub1Id,
      academic_year: '2026',
      exam_date: '2026-10-25'
    }
  });
  assert(resDupEx.status === 400, '2. Prevent duplicate examination for same class, subject, title, and year');

  // Create unassigned subject and verify exam creation is rejected
  const resSubUnassigned = await makeRequest({
    method: 'POST',
    path: '/institute/subjects',
    headers: authHeaders,
    body: { subject_code: `SUB-UN-${rand}`, subject_name: `Unassigned Subject ${rand}` }
  });
  const resBadSubEx = await makeRequest({
    method: 'POST',
    path: '/exams',
    headers: authHeaders,
    body: {
      division: 'institute',
      title: 'Bad Subject Exam',
      class_id: classId,
      subject_id: resSubUnassigned.data?.id,
      exam_date: '2026-10-25'
    }
  });
  assert(resBadSubEx.status === 400, '3. Ensure selected subject belongs to the selected class (rejected unassigned)');

  // Create Exam 2 (Fiqh)
  const examTitle2 = `Imtixaanka Bisha 1-aad (Fiqh) ${rand}`;
  const resEx2 = await makeRequest({
    method: 'POST',
    path: '/exams',
    headers: authHeaders,
    body: {
      division: 'institute',
      title: examTitle2,
      class_id: classId,
      subject_id: sub2Id,
      academic_year: '2026',
      exam_date: '2026-10-26',
      maximum_marks: 100
    }
  });
  const exam2Id = resEx2.data?.id;

  // 3. Marks Validation (Negative marks, over-max marks)
  const resBadMark = await makeRequest({
    method: 'POST',
    path: `/exams/${exam1Id}/marks`,
    headers: authHeaders,
    body: {
      division: 'institute',
      marks: [{ student_id: students[0].id, marks_obtained: 105 }] // > 100
    }
  });
  assert(resBadMark.status === 400 || resBadMark.status === 500, '4. Server validation rejects marks exceeding maximum');

  const resNegMark = await makeRequest({
    method: 'POST',
    path: `/exams/${exam1Id}/marks`,
    headers: authHeaders,
    body: {
      division: 'institute',
      marks: [{ student_id: students[0].id, marks_obtained: -5 }]
    }
  });
  assert(resNegMark.status === 400 || resNegMark.status === 500, '5. Server validation rejects negative marks');

  // 4. Enter Marks for Exam 1 and Exam 2
  // Scenario for Tied Competition Ranking:
  // Student C (index 2): Tafsiir 95, Fiqh 90 -> Total 185 (Rank 1)
  // Student A (index 0): Tafsiir 90, Fiqh 85 -> Total 175 (Rank 2)
  // Student B (index 1): Tafsiir 78, Fiqh 97 -> Total 175 (Rank 2 - Tied!)
  // Student D (index 3): Absent in Tafsiir, Fiqh 70 -> Total 70 (Rank 4, NOT 3!)
  await makeRequest({
    method: 'POST',
    path: `/exams/${exam1Id}/marks`,
    headers: authHeaders,
    body: {
      division: 'institute',
      status: 'published',
      marks: [
        { student_id: students[0].id, marks_obtained: 90, is_absent: false },
        { student_id: students[1].id, marks_obtained: 78, is_absent: false },
        { student_id: students[2].id, marks_obtained: 95, is_absent: false },
        { student_id: students[3].id, marks_obtained: '', is_absent: true } // Absent!
      ]
    }
  });

  await makeRequest({
    method: 'POST',
    path: `/exams/${exam2Id}/marks`,
    headers: authHeaders,
    body: {
      division: 'institute',
      status: 'published',
      marks: [
        { student_id: students[0].id, marks_obtained: 85, is_absent: false },
        { student_id: students[1].id, marks_obtained: 97, is_absent: false },
        { student_id: students[2].id, marks_obtained: 90, is_absent: false },
        { student_id: students[3].id, marks_obtained: 70, is_absent: false }
      ]
    }
  });

  // Verify marks load correctly
  const resSheet1 = await makeRequest({
    method: 'GET',
    path: `/exams/${exam1Id}/sheet?division=institute`,
    headers: authHeaders
  });
  const sheetMarks = resSheet1.data?.data?.sheet || [];
  const stDInSheet = sheetMarks.find(s => s.student_id === students[3].id);
  assert(stDInSheet && stDInSheet.is_absent === true, '6. Distinguish absent student from student with 0 or pending');

  // 5. Whole-Class Results Sheet & Automatic Competition Ranking
  const resClassResults = await makeRequest({
    method: 'GET',
    path: `/exams/results/class?class_id=${classId}&academic_year=2026`,
    headers: authHeaders
  });
  const resultsData = resClassResults.data?.data;
  assert(resClassResults.status === 200 && resultsData?.students?.length === 4, '7. Whole-class results returned all 4 students');

  const rankedStudents = resultsData?.students || [];
  // Find ranks
  const rankC = rankedStudents.find(s => s.student_id === students[2].id);
  const rankA = rankedStudents.find(s => s.student_id === students[0].id);
  const rankB = rankedStudents.find(s => s.student_id === students[1].id);
  const rankD = rankedStudents.find(s => s.student_id === students[3].id);

  console.log('Ranking results:', {
    studentC: { total: rankC?.total_obtained, rank: rankC?.rank },
    studentA: { total: rankA?.total_obtained, rank: rankA?.rank },
    studentB: { total: rankB?.total_obtained, rank: rankB?.rank },
    studentD: { total: rankD?.total_obtained, rank: rankD?.rank }
  });

  assert(rankC?.total_obtained === 185 && rankC?.rank === 1, '8. Highest total receives Rank 1 (Student C: 185 marks, Rank 1)');
  assert(
    rankA?.total_obtained === 175 && rankB?.total_obtained === 175 &&
    rankA?.rank === 2 && rankB?.rank === 2,
    '9. Equal totals receive the same rank (Students A & B both 175 marks, Rank 2)'
  );
  assert(
    rankD?.total_obtained === 70 && rankD?.rank === 4,
    '10. Competition ranking correctly skips to Rank 4 after two Rank 2s (1, 2, 2, 4 pattern)'
  );
  assert(
    resultsData?.maximum_total === 200 &&
    rankC?.average_percentage === 92.5 &&
    rankA?.average_percentage === 87.5,
    '11. Correct totals and percentage calculations: (185/200) * 100 = 92.50%'
  );

  // 6. Individual Student Result Sheet
  const resIndiv = await makeRequest({
    method: 'GET',
    path: `/exams/results/student/${students[1].id}?class_id=${classId}&academic_year=2026`,
    headers: authHeaders
  });
  const indivData = resIndiv.data?.data;
  assert(
    resIndiv.status === 200 &&
    indivData?.student?.student_name.includes('Student B') &&
    indivData?.student?.rank === 2 &&
    indivData?.subjects?.length === 2,
    '12. Individual student result sheet displays correct subject breakdown and class rank'
  );

  // 7. Genuine Excel Export (.xlsx)
  const resClassExcel = await makeRequest({
    method: 'GET',
    path: `/exams/results/class/export?class_id=${classId}&academic_year=2026`,
    headers: authHeaders
  });
  assert(
    resClassExcel.status === 200 && resClassExcel.isExcel && resClassExcel.size > 2000,
    `13. Whole-class results Excel export generates valid .xlsx workbook (${resClassExcel.size} bytes)`
  );

  const resStudentExcel = await makeRequest({
    method: 'GET',
    path: `/exams/results/student/${students[0].id}/export?class_id=${classId}&academic_year=2026`,
    headers: authHeaders
  });
  assert(
    resStudentExcel.status === 200 && resStudentExcel.isExcel && resStudentExcel.size > 2000,
    `14. Individual student result Excel export generates valid .xlsx workbook (${resStudentExcel.size} bytes)`
  );

  // 8. Unauthorized API security
  const resNoAuth = await makeRequest({
    method: 'GET',
    path: `/exams/results/class?class_id=${classId}`
  });
  assert(resNoAuth.status === 401, '15. Unauthorized direct API access rejected (401)');

  console.log(`\n====================================================`);
  console.log(`TEST SUMMARY: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`====================================================\n`);

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
