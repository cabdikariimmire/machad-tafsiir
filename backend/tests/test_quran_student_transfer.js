process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server.js';
import { query } from '../src/db/connection.js';

const PORT = 5095;
let server;

function request(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    if (body) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request({ hostname: 'localhost', port: PORT, path, method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        resolve({ status: res.statusCode, body: parsed, setCookie: res.headers['set-cookie'] });
      });
    });
    req.on('error', reject);
    if (body) req.write(payload);
    req.end();
  });
}

function cookieFrom(response) {
  return response.setCookie?.[0]?.split(';')[0] || null;
}

async function run() {
  let passed = 0;
  let failed = 0;
  const assert = (condition, message) => {
    if (condition) { console.log(`[PASS] ${message}`); passed++; }
    else { console.error(`[FAIL] ${message}`); failed++; }
  };

  let studentId;
  let fromGroupId;
  let toGroupId;
  let progressId;

  server = app.listen(PORT, async () => {
    try {
      const login = await request('POST', '/api/auth/login', { username: 'superadmin', password: 'Admin@12345' });
      const adminCookie = cookieFrom(login);
      assert(login.status === 200 && login.body.user?.role === 'super_admin', 'Super Admin login succeeds');

      const teacher = await query(`
        SELECT u.id
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'teacher' AND u.is_active = 1
        ORDER BY u.id ASC LIMIT 1
      `);
      if (!teacher[0]) throw new Error('No Quran teacher available for transfer test setup');

      const suffix = Date.now();
      const fromName = `Transfer Source ${suffix}`;
      const toName = `Transfer Destination ${suffix}`;
      const createFrom = await request('POST', '/api/quran/groups', { name: fromName, shift: 'Subax', teacher_id: teacher[0].id }, adminCookie);
      const createTo = await request('POST', '/api/quran/groups', { name: toName, shift: 'Galab', teacher_id: teacher[0].id }, adminCookie);
      assert(createFrom.status === 201 && createTo.status === 201, 'Two eligible Quran classes created for transfer test');
      fromGroupId = createFrom.body.id;
      toGroupId = createTo.body.id;

      const register = await request('POST', `/api/quran/groups/${fromGroupId}/register-student`, {
        full_name: `Transfer Test Student ${suffix}`,
        name_ar: 'طالب اختبار النقل',
        gender: 'male',
        phone: `061${String(suffix).slice(-7)}`
      }, adminCookie);
      studentId = register.body.data?.id;
      assert(register.status === 201 && studentId, 'Test student registered in source class');

      const admin = await query(`SELECT id FROM users WHERE username = 'superadmin' LIMIT 1`);
      const progressInsert = await query(`
        INSERT INTO quran_progress
          (student_id, group_id, record_date, surah_name, recorded_by)
        VALUES (?, ?, CURDATE(), 'Al-Faatiha', ?)
      `, [studentId, fromGroupId, admin[0].id]);
      progressId = progressInsert.insertId;

      const teacherLogin = await request('POST', '/api/auth/login', { username: 'teacher_ali', password: 'Admin@12345' });
      const teacherCookie = cookieFrom(teacherLogin);
      const teacherAttempt = await request('POST', '/api/quran/transfer-student', {
        student_id: studentId, to_group_id: toGroupId, transfer_date: '2026-10-21'
      }, teacherCookie);
      assert(teacherAttempt.status === 403, 'Teacher cannot execute class transfers');

      const search = await request('GET', `/api/quran/transfer-students?search=${encodeURIComponent(`Transfer Test Student ${suffix}`)}`, null, adminCookie);
      assert(search.status === 200 && search.body.data?.some(s => s.id === studentId), 'Transfer search finds student by name');
      const selected = search.body.data.find(s => s.id === studentId);
      assert(selected?.current_group_id === fromGroupId, 'Selected student exposes current class as read-only data');

      const sameClass = await request('POST', '/api/quran/transfer-student', {
        student_id: studentId, to_group_id: fromGroupId, transfer_date: '2026-10-21'
      }, adminCookie);
      assert(sameClass.status === 400, 'Transfer to the same class is rejected');

      const firstTransfer = await request('POST', '/api/quran/transfer-student', {
        student_id: studentId,
        to_group_id: toGroupId,
        transfer_date: '2026-10-21',
        reason: 'Jadwalka ardayga ayaa is beddelay'
      }, adminCookie);
      assert(firstTransfer.status === 200 && firstTransfer.body.success, 'Student transfer succeeds atomically');

      const enrollmentAfterFirst = await query(`SELECT group_id, status FROM quran_enrollments WHERE student_id = ? ORDER BY id`, [studentId]);
      assert(enrollmentAfterFirst.some(row => Number(row.group_id) === fromGroupId && row.status === 'completed'), 'Previous enrollment is preserved as completed');
      assert(enrollmentAfterFirst.some(row => Number(row.group_id) === toGroupId && row.status === 'active'), 'Destination enrollment is active');
      assert(enrollmentAfterFirst.filter(row => row.status === 'active').length === 1, 'Student has exactly one active Quran enrollment');

      const progressAfterFirst = await query(`SELECT id, group_id FROM quran_progress WHERE id = ? AND student_id = ?`, [progressId, studentId]);
      assert(progressAfterFirst.length === 1, 'Quran memorization progress remains intact');

      const counts = await request('GET', '/api/quran/groups', null, adminCookie);
      const fromGroup = counts.body.data?.find(group => Number(group.id) === fromGroupId);
      const toGroup = counts.body.data?.find(group => Number(group.id) === toGroupId);
      assert(Number(fromGroup?.student_count) === 0 && Number(toGroup?.student_count) === 1, 'Class counts refresh after transfer');

      const secondTransfer = await request('POST', '/api/quran/transfer-student', {
        student_id: studentId, to_group_id: fromGroupId, transfer_date: '2026-10-22', reason: 'Second transfer test'
      }, adminCookie);
      assert(secondTransfer.status === 200 && secondTransfer.body.success, 'Repeated transfer succeeds');

      const history = await request('GET', `/api/quran/transfer-history?search=${encodeURIComponent(`Transfer Test Student ${suffix}`)}`, null, adminCookie);
      assert(history.status === 200 && history.body.data?.length === 2, 'Repeated transfers create separate history entries');
      assert(history.body.data?.some(row => row.reason === 'Jadwalka ardayga ayaa is beddelay'), 'Transfer reason is preserved');
      assert(history.body.data?.every(row => row.transferred_by_name), 'Transfer history records staff member');

      const finalEnrollment = await query(`SELECT group_id, status FROM quran_enrollments WHERE student_id = ?`, [studentId]);
      assert(finalEnrollment.filter(row => row.status === 'active').length === 1 && Number(finalEnrollment.find(row => row.status === 'active').group_id) === fromGroupId, 'Final state has one active enrollment after repeated transfer');
    } catch (error) {
      console.error('[ERROR]', error.stack || error.message);
      failed++;
    } finally {
      try {
        if (studentId) {
          await query(`DELETE FROM quran_student_transfer_history WHERE student_id = ?`, [studentId]);
          await query(`DELETE FROM quran_progress WHERE student_id = ?`, [studentId]);
          await query(`DELETE FROM quran_enrollments WHERE student_id = ?`, [studentId]);
          await query(`DELETE FROM students WHERE id = ?`, [studentId]);
        }
        if (fromGroupId) await query(`DELETE FROM quran_groups WHERE id = ?`, [fromGroupId]);
        if (toGroupId) await query(`DELETE FROM quran_groups WHERE id = ?`, [toGroupId]);
      } finally {
        server.close(() => {
          console.log(`\nTRANSFER TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
          process.exit(failed ? 1 : 0);
        });
      }
    }
  });
}

run();
