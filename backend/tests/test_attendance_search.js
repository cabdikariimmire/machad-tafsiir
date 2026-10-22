process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server.js';

let server;
const PORT = 5068;

function request(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (cookie) {
      headers['Cookie'] = cookie;
    }
    if (body) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed, setCookie });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, setCookie });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  return setCookieHeader.map(c => c.split(';')[0]).join('; ');
}

async function runTests() {
  server = app.listen(PORT);
  console.log('====================================================');
  console.log('--- TESTING ATTENDANCE STUDENT SEARCH & HISTORY ---');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Log in users
    // Login Teacher Ahmed (ID: 10, assigned to Quran Group 1: Halaqada Al-Nuur)
    const teacherLogin = await request('POST', '/api/auth/login', {
      username: 'teacher_ahmed',
      password: 'Admin@12345'
    });
    const teacherCookie = extractCookie(teacherLogin.setCookie);
    assert(teacherLogin.status === 200 && teacherLogin.body.success, 'Teacher Ahmed logs in successfully');

    // Login Quran Admin
    const adminLogin = await request('POST', '/api/auth/login', {
      username: 'quranadmin',
      password: 'Admin@12345'
    });
    const adminCookie = extractCookie(adminLogin.setCookie);
    assert(adminLogin.status === 200 && adminLogin.body.success, 'Quran Admin logs in successfully');


    // 2. Search by English Name
    const searchNameRes = await request('GET', '/api/attendance/search-students?q=mohamed&date=2026-10-19', null, teacherCookie);
    assert(searchNameRes.status === 200 && searchNameRes.body.success, 'Teacher can search students by English name');
    const mohamedStudent = searchNameRes.body.data.find(s => s.student_id === 'STU-2026-002');
    assert(!!mohamedStudent, 'Found student Mohamed Ahmed (STU-2026-002) by English name');

    // 3. Search by Arabic Name
    const searchArabicRes = await request('GET', '/api/attendance/search-students?q=' + encodeURIComponent('محمد') + '&date=2026-10-19', null, teacherCookie);
    assert(searchArabicRes.status === 200 && searchArabicRes.body.success, 'Teacher can search students by Arabic name');
    const arabicStudent = searchArabicRes.body.data.find(s => s.name_ar && s.name_ar.includes('محمد'));
    assert(!!arabicStudent, 'Found student Mohamed Ahmed by Arabic name (محمد)');

    // 4. Search by Student ID (e.g. STU-2026-002 and partial "002")
    const searchIdRes = await request('GET', '/api/attendance/search-students?q=STU-2026-002&date=2026-10-19', null, teacherCookie);
    assert(searchIdRes.status === 200 && searchIdRes.body.data.length > 0, 'Found student by full Student ID STU-2026-002');

    const searchPartialIdRes = await request('GET', '/api/attendance/search-students?q=002&date=2026-10-19', null, teacherCookie);
    assert(searchPartialIdRes.status === 200 && searchPartialIdRes.body.data.some(s => s.student_id === 'STU-2026-002'), 'Found student by partial ID "002"');

    // 5. Search by Phone Number
    const searchPhoneRes = await request('GET', '/api/attendance/search-students?q=618277158&date=2026-10-19', null, teacherCookie);
    assert(searchPhoneRes.status === 200 && searchPhoneRes.body.success, 'Teacher can search by phone number');
    const phoneStudent = searchPhoneRes.body.data.find(s => s.phone === '618277158');
    assert(!!phoneStudent, 'Found student by phone number 618277158');

    // 6. Security Scoping: Teacher CANNOT find students outside their assigned classes
    // Student Jibril (STU-2026-003) is in Group 4, NOT assigned to Teacher Ahmed (Group 1)
    const searchUnauthorizedRes = await request('GET', '/api/attendance/search-students?q=jibril&date=2026-10-19', null, teacherCookie);
    assert(searchUnauthorizedRes.body.data.length === 0, 'SECURITY: Teacher CANNOT find student Jibril (outside assigned classes)');

    // Student Abdikarim (STU-2026-004) is in Group 5, NOT assigned to Teacher Ahmed
    const searchUnauthorizedAbdikarim = await request('GET', '/api/attendance/search-students?q=abdikarim&date=2026-10-19', null, teacherCookie);
    assert(searchUnauthorizedAbdikarim.body.data.length === 0, 'SECURITY: Teacher CANNOT find student Abdikarim (outside assigned classes)');

    // But Admin CAN find student Jibril
    const adminSearchJibril = await request('GET', '/api/attendance/search-students?q=jibril&date=2026-10-19', null, adminCookie);
    assert(adminSearchJibril.body.data.some(s => s.student_id === 'STU-2026-003'), 'Admin CAN search students across all groups');

    // 7. Verify Attendance Status Distinction (not yet recorded vs recorded)
    assert(mohamedStudent.classes.length > 0, 'Matching student includes assigned class information');
    assert(['not_recorded', 'present', 'absent', 'late', 'excused'].includes(mohamedStudent.status), 'Student attendance status has clear valid category');

    // 8. Test Teacher Real-World Workflow: Record Absence Reason for Student
    const recordAbsenceRes = await request('POST', '/api/attendance/update-single', {
      student_id: 2,
      division: 'quran',
      group_id: 1,
      date: '2026-10-19',
      status: 'absent',
      remarks: 'Xanuun daran (Sick with fever)'
    }, teacherCookie);
    assert(recordAbsenceRes.status === 200 && recordAbsenceRes.body.success, 'Teacher successfully records absence reason for student');

    // Verify attendance status is now 'absent' with remarks in search
    const verifySearchRes = await request('GET', '/api/attendance/search-students?q=mohamed&date=2026-10-19', null, teacherCookie);
    const updatedMohamed = verifySearchRes.body.data.find(s => s.student_id === 'STU-2026-002');
    assert(updatedMohamed.status === 'absent', 'Updated student status reflects "absent"');
    assert(updatedMohamed.remarks.includes('Xanuun daran'), 'Updated student remarks reflect the recorded absence reason');

    // 9. Test Student Attendance History
    const historyRes = await request('GET', '/api/attendance/student-history?student_id=2', null, teacherCookie);
    assert(historyRes.status === 200 && historyRes.body.success, 'Teacher can fetch student attendance history');
    assert(historyRes.body.data.history.length > 0, 'History contains attendance session records');
    assert(historyRes.body.data.summary.total_sessions > 0, 'History summary contains session count and statistics');

    // 10. Security: Teacher cannot view history of student outside assigned classes
    const unassignedHistoryRes = await request('GET', '/api/attendance/student-history?student_id=3', null, teacherCookie); // Jibril
    assert(unassignedHistoryRes.status === 403, 'SECURITY: Blocked teacher from viewing unassigned student history (403 Forbidden)');

    // 11. Data Integrity: Teacher cannot save attendance for unassigned class
    const unassignedUpdateRes = await request('POST', '/api/attendance/update-single', {
      student_id: 3,
      division: 'quran',
      group_id: 4, // Unassigned group
      date: '2026-10-19',
      status: 'present'
    }, teacherCookie);
    assert(unassignedUpdateRes.status === 403, 'SECURITY: Blocked teacher from updating unassigned group (403 Forbidden)');

    console.log('====================================================');
    console.log(`TOTAL PASSED: ${passed}`);
    console.log(`TOTAL FAILED: ${failed}`);
    console.log('====================================================');

    server.close();
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runTests();
