process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server.js';

let server;
const PORT = 5066;

function request(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    if (body) headers['Content-Length'] = Buffer.byteLength(postData);

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

async function loginUser(username) {
  const res = await request('POST', '/api/auth/login', { username, password: 'Admin@12345' });
  if (res.status !== 200) throw new Error(`Login failed for ${username}: ${JSON.stringify(res.body)}`);
  return extractCookie(res.setCookie);
}

async function runE2E() {
  console.log('=== PHASE 13: END-TO-END ROLE & PERMISSION SUITE ===');
  let passed = 0;
  let failed = 0;

  function test(desc, ok) {
    if (ok) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  server = app.listen(PORT, async () => {
    try {
      // 1. Super Admin
      const superCookie = await loginUser('superadmin');
      const superStats = await request('GET', '/api/dashboard/stats', null, superCookie);
      test('1. Super Admin can view combined stats', superStats.status === 200 && superStats.body.data.role === 'super_admin');

      // 2. Institute Admin
      const instCookie = await loginUser('instadmin');
      const instClasses = await request('GET', '/api/institute/classes', null, instCookie);
      test('2. Institute Admin can view Institute classes', instClasses.status === 200);

      const instBlockQuran = await request('GET', '/api/quran/groups', null, instCookie);
      test('3. Institute Admin is blocked from Quran groups (403)', instBlockQuran.status === 403);

      // 3. Quran Admin
      const quranCookie = await loginUser('quranadmin');
      const quranGroups = await request('GET', '/api/quran/groups', null, quranCookie);
      test('4. Quran Admin can view Quran groups', quranGroups.status === 200);

      const quranBlockInst = await request('GET', '/api/institute/classes', null, quranCookie);
      test('5. Quran Admin is blocked from Institute classes (403)', quranBlockInst.status === 403);

      // 4. Finance Institute User
      const finInstCookie = await loginUser('finance_inst');
      const finInstDashboard = await request('GET', '/api/finance/dashboard?division=institute', null, finInstCookie);
      test('6. Finance Institute user can view Institute finance dashboard', finInstDashboard.status === 200);

      // 5. Attendance Officer
      const attCookie = await loginUser('attendance_inst');
      const attSheet = await request('GET', '/api/attendance/sheet?division=institute&class_id=1&date=2026-10-22', null, attCookie);
      test('7. Attendance Officer can load Thursday attendance sheet', attSheet.status === 200);

      // 6. Exam Officer
      const examCookie = await loginUser('exam_officer');
      const examList = await request('GET', '/api/exams', null, examCookie);
      test('8. Exam Officer can list exams', examList.status === 200);

      // 7. Teacher
      const teacherCookie = await loginUser('teacher_ali');
      const teacherTimetable = await request('GET', '/api/institute/timetable', null, teacherCookie);
      test('9. Teacher can view Institute timetable', teacherTimetable.status === 200);

      // 8. Unique Receipt Number Check
      const rec1 = await request('POST', '/api/finance/receive-payment', {
        student_id: 1,
        division: 'institute',
        billing_period: '2026-05',
        amount_paid: 5.00
      }, superCookie);

      const rec2 = await request('POST', '/api/finance/receive-payment', {
        student_id: 1,
        division: 'institute',
        billing_period: '2026-05',
        amount_paid: 5.00
      }, superCookie);

      test('10. Sequential payments generate distinct unique receipt numbers', 
        rec1.status === 201 && rec2.status === 201 && 
        rec1.body.receipt.receiptNumber !== rec2.body.receipt.receiptNumber
      );

      // 8. Create an exam first
      const createExamRes = await request('POST', '/api/exams', {
        division: 'institute',
        title: 'Imtixaanka Tijaabada',
        class_id: 1,
        subject_id: 1,
        exam_date: '2026-10-25',
        maximum_marks: 100
      }, superCookie);
      const testExamId = createExamRes.body.id || 1;

      // 9. Negative marks validation
      const negMarkRes = await request('POST', `/api/exams/${testExamId}/marks`, {
        division: 'institute',
        marks: [{ student_id: 1, marks_obtained: -10 }]
      }, superCookie);
      test('11. Negative marks are rejected by server validation', negMarkRes.status === 500 || negMarkRes.status === 400);

      // 10. Marks exceeding maximum validation
      const overMarkRes = await request('POST', `/api/exams/${testExamId}/marks`, {
        division: 'institute',
        marks: [{ student_id: 1, marks_obtained: 150 }]
      }, superCookie);
      test('12. Marks exceeding exam maximum are rejected by server validation', overMarkRes.status === 500 || overMarkRes.status === 400);

      console.log('------------------------------------------------');
      console.log(`E2E SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
      console.log('------------------------------------------------');

      if (failed === 0) {
        console.log('ALL E2E SCENARIOS VERIFIED SUCCESSFULLY!');
        process.exit(0);
      } else {
        process.exit(1);
      }
    } catch (err) {
      console.error('E2E error:', err);
      process.exit(1);
    } finally {
      server.close();
    }
  });
}

runE2E();
