process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server.js';
import { query } from '../src/db/connection.js';

let server;
const PORT = 5066;

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

function extractSessionCookie(setCookie) {
  if (!setCookie || !setCookie.length) return null;
  const cookieStr = setCookie[0];
  return cookieStr.split(';')[0];
}

async function runTests() {
  console.log('====================================================');
  console.log('--- TESTING THE THREE QURAN SYSTEM BUG FIXES ---');
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

  server = app.listen(PORT, async () => {
    try {
      // -------------------------------------------------------------------
      // 1. Log in users
      // -------------------------------------------------------------------
      const teacherLogin = await request('POST', '/api/auth/login', { username: 'teacher_ahmed', password: 'Admin@12345' });
      assert(teacherLogin.status === 200 && teacherLogin.body.user.role === 'teacher', 'Teacher logs in successfully');
      const teacherCookie = extractSessionCookie(teacherLogin.setCookie);

      const quranAdminLogin = await request('POST', '/api/auth/login', { username: 'quranadmin', password: 'Admin@12345' });
      assert(quranAdminLogin.status === 200 && quranAdminLogin.body.user.role === 'quran_admin', 'Quran Admin logs in successfully');
      const quranAdminCookie = extractSessionCookie(quranAdminLogin.setCookie);

      const superLogin = await request('POST', '/api/auth/login', { username: 'superadmin', password: 'Admin@12345' });
      assert(superLogin.status === 200 && superLogin.body.user.role === 'super_admin', 'Super Admin logs in successfully');
      const superCookie = extractSessionCookie(superLogin.setCookie);

      const examOfficerLogin = await request('POST', '/api/auth/login', { username: 'exam_officer', password: 'Admin@12345' });
      assert(examOfficerLogin.status === 200 && examOfficerLogin.body.user.role === 'examination_officer', 'Examination Officer logs in successfully');
      const examOfficerCookie = extractSessionCookie(examOfficerLogin.setCookie);

      // -------------------------------------------------------------------
      // BUG 1 TESTS: Hide Payment Notifications & Payment Details from Teachers
      // -------------------------------------------------------------------
      console.log('\n--- BUG 1: Payment Notifications & Access ---');
      const teacherNotifs = await request('GET', '/api/dashboard/notifications', null, teacherCookie);
      assert(teacherNotifs.status === 200, 'Teacher can fetch notifications endpoint');
      const hasPaymentNotif = (teacherNotifs.body.data || []).some(n => 
        n.type === 'payment_recorded' || 
        n.type === 'fee_adjusted' || 
        n.type?.startsWith('payment_') || 
        n.type?.startsWith('fee_') ||
        n.title?.includes('$')
      );
      assert(!hasPaymentNotif, 'SECURITY: Teacher notifications contain ZERO payment-related records');

      // Teacher direct API calls to payment endpoints MUST return 403
      const teacherFinanceDash = await request('GET', '/api/finance/dashboard', null, teacherCookie);
      assert(teacherFinanceDash.status === 403, 'SECURITY: Teacher cannot access /api/finance/dashboard (403 Forbidden)');

      const teacherStudentsFees = await request('GET', '/api/finance/students-fees', null, teacherCookie);
      assert(teacherStudentsFees.status === 403, 'SECURITY: Teacher cannot access /api/finance/students-fees (403 Forbidden)');

      const teacherReportsFinance = await request('GET', '/api/reports/finance', null, teacherCookie);
      assert(teacherReportsFinance.status === 403, 'SECURITY: Teacher cannot access /api/reports/finance (403 Forbidden)');

      const teacherOutstandingFees = await request('GET', '/api/reports/outstanding-fees', null, teacherCookie);
      assert(teacherOutstandingFees.status === 403, 'SECURITY: Teacher cannot access /api/reports/outstanding-fees (403 Forbidden)');

      // Quran Admin notifications should only contain 'quran' or 'system' division
      const quranNotifs = await request('GET', '/api/dashboard/notifications', null, quranAdminCookie);
      assert(quranNotifs.status === 200, 'Quran Admin can fetch notifications');
      const hasInstituteNotif = (quranNotifs.body.data || []).some(n => n.division === 'institute');
      assert(!hasInstituteNotif, 'SECURITY: Quran Admin notifications contain NO institute division records');

      // -------------------------------------------------------------------
      // BUG 2 TESTS: Make Saved Surah Completion Decisions Final for Teachers
      // -------------------------------------------------------------------
      console.log('\n--- BUG 2: Saved Surah Completion Finality ---');
      // Find a student in teacher_ahmed's group
      const studentRows = await query(`
        SELECT s.id, s.full_name, qe.group_id
        FROM students s
        JOIN quran_enrollments qe ON s.id = qe.student_id AND qe.status = 'active'
        JOIN quran_teacher_assignments qta ON qe.group_id = qta.group_id
        WHERE qta.teacher_id = 10
        LIMIT 1
      `);

      if (studentRows.length > 0) {
        const testStudent = studentRows[0];
        console.log(`Testing with student: ${testStudent.full_name} (ID: ${testStudent.id})`);

        // First, check current memorization summary
        const summaryBefore = await request('GET', `/api/quran/students/${testStudent.id}/summary`, null, teacherCookie);
        assert(summaryBefore.status === 200, 'Teacher can fetch student memorization summary');
        assert(summaryBefore.body.data.fee === null, 'SECURITY: Student summary fee details are HIDDEN from teacher');

        // Step A: Save Surah 114 (An-Nas) and 113 (Al-Falaq) as completed
        const initialSave = await request('POST', `/api/quran/students/${testStudent.id}/surahs`, {
          surah_numbers: [113, 114]
        }, teacherCookie);
        assert(initialSave.status === 200, 'Teacher successfully saves Surahs 113 and 114');

        // Step B: Teacher attempts to unmark/delete Surah 114 by only sending [113]
        const teacherUnmarkAttempt = await request('POST', `/api/quran/students/${testStudent.id}/surahs`, {
          surah_numbers: [113]
        }, teacherCookie);
        assert(teacherUnmarkAttempt.status === 200, 'Teacher save request processes');

        // Verify Surah 114 was NOT deleted and remains completed
        const surahsAfterUnmark = await request('GET', `/api/quran/students/${testStudent.id}/surahs`, null, teacherCookie);
        const surah114 = surahsAfterUnmark.body.data.surahs.find(s => s.number === 114);
        assert(surah114 && surah114.is_memorized === true, 'FINALITY: Teacher CANNOT unmark previously saved Surah 114 (still memorized)');

        // Step C: Teacher CAN record an additional Surah (112 Al-Ikhlas)
        const teacherAddSurah = await request('POST', `/api/quran/students/${testStudent.id}/surahs`, {
          surah_numbers: [112, 113, 114]
        }, teacherCookie);
        assert(teacherAddSurah.status === 200, 'Teacher can record additional Surahs');
        const surahsAfterAdd = await request('GET', `/api/quran/students/${testStudent.id}/surahs`, null, teacherCookie);
        const surah112 = surahsAfterAdd.body.data.surahs.find(s => s.number === 112);
        assert(surah112 && surah112.is_memorized === true, 'Teacher newly recorded Surah 112 is memorized');

        // Step D: Admin CAN reverse / correct a record if needed
        const adminReverse = await request('POST', `/api/quran/students/${testStudent.id}/surahs`, {
          surah_numbers: [114] // Admin removes 112 and 113
        }, superCookie);
        assert(adminReverse.status === 200, 'Admin can administratively correct/reverse surah completion');

        // Verify audit trail logged for admin reversal
        const [auditRow] = await query(`
          SELECT * FROM audit_logs 
          WHERE action = 'ADMIN_REVERSE_SURAH_MEMORIZATION' AND record_id = ?
          ORDER BY created_at DESC LIMIT 1
        `, [testStudent.id]);
        assert(auditRow && auditRow.user_id === 1, 'AUDIT: Admin reversal is logged with exact admin details in audit_logs');
      } else {
        console.log('Skipping student-specific test: No active students assigned to teacher_ahmed');
      }

      // -------------------------------------------------------------------
      // BUG 3 TESTS: Remove Exam Menu & Prevent Teacher Access to Exam Endpoints
      // -------------------------------------------------------------------
      console.log('\n--- BUG 3: Exam Permissions & Separation of Duties ---');
      // Direct teacher requests to examination APIs must be rejected (403 Forbidden)
      const teacherGetExams = await request('GET', '/api/exams', null, teacherCookie);
      assert(teacherGetExams.status === 403, 'SECURITY: Teacher cannot access /api/exams (403 Forbidden)');

      const teacherPostExam = await request('POST', '/api/exams', { name: 'Unauthorized Exam' }, teacherCookie);
      assert(teacherPostExam.status === 403, 'SECURITY: Teacher cannot create exams in /api/exams (403 Forbidden)');

      const teacherGetQuranExams = await request('GET', '/api/quran/memorization-exams', null, teacherCookie);
      assert(teacherGetQuranExams.status === 403, 'SECURITY: Teacher cannot access /api/quran/memorization-exams (403 Forbidden)');

      const teacherPostQuranExam = await request('POST', '/api/quran/memorization-exams', { student_id: 1 }, teacherCookie);
      assert(teacherPostQuranExam.status === 403, 'SECURITY: Teacher cannot create memorization exams (403 Forbidden)');

      const teacherGetExaminations = await request('GET', '/api/quran/examinations', null, teacherCookie);
      assert(teacherGetExaminations.status === 403, 'SECURITY: Teacher cannot access /api/quran/examinations (403 Forbidden)');

      // Examination Officer CAN access examination endpoints
      const examOfficerGetExams = await request('GET', '/api/exams', null, examOfficerCookie);
      assert(examOfficerGetExams.status === 200, 'Examination Officer CAN access /api/exams (200 OK)');

      const examOfficerGetQuranExams = await request('GET', '/api/quran/memorization-exams', null, examOfficerCookie);
      assert(examOfficerGetQuranExams.status === 200, 'Examination Officer CAN access /api/quran/memorization-exams (200 OK)');

      // Quran Admin CAN access examination endpoints
      const quranAdminGetExams = await request('GET', '/api/quran/memorization-exams', null, quranAdminCookie);
      assert(quranAdminGetExams.status === 200, 'Quran Admin CAN access /api/quran/memorization-exams (200 OK)');

      // Super Admin CAN access examination endpoints
      const superGetExams = await request('GET', '/api/exams', null, superCookie);
      assert(superGetExams.status === 200, 'Super Admin CAN access /api/exams (200 OK)');

      console.log('\n====================================================');
      console.log(`TOTAL PASSED: ${passed}`);
      console.log(`TOTAL FAILED: ${failed}`);
      console.log('====================================================');

      server.close();
      process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
      console.error('Test execution error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runTests();
