process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server.js';

const PORT = 5092;

function request(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    if (body) headers['Content-Length'] = Buffer.byteLength(payload);
    const req = http.request({ hostname: 'localhost', port: PORT, path, method, headers }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), cookies: res.headers['set-cookie'] }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(payload);
    req.end();
  });
}

function cookieFrom(response) {
  return response.cookies?.[0]?.split(';')[0] || null;
}

const server = app.listen(PORT, async () => {
  let failed = 0;
  const assert = (condition, message) => {
    if (condition) console.log(`[PASS] ${message}`);
    else { console.error(`[FAIL] ${message}`); failed++; }
  };

  try {
    const login = await request('POST', '/api/auth/login', { username: 'superadmin', password: 'Admin@12345' });
    const cookie = cookieFrom(login);
    assert(login.status === 200 && cookie, 'Super Admin login succeeds');

    const students = await request('GET', '/api/students?division=quran&search=abdi', null, cookie);
    const student = students.body.data?.[0];
    assert(students.status === 200 && student?.id, 'A searchable student is available');

    if (student?.id) {
      const profile = await request('GET', `/api/reports/student-financial/${student.id}`, null, cookie);
      assert(profile.status === 200 && profile.body.success, 'Student financial profile endpoint succeeds');
      assert(profile.body.data?.student?.student_code === student.student_id, 'Profile returns the selected student identity');
      assert(Array.isArray(profile.body.data?.obligations), 'Profile includes historical obligations');
      assert(Array.isArray(profile.body.data?.payments), 'Profile includes payment and receipt history');
      assert(typeof profile.body.data?.summary?.total_outstanding === 'number', 'Profile includes total outstanding balance');

      const reports = await request('GET', `/api/reports/finance?division=quran&search=${encodeURIComponent(student.full_name)}&page=1&page_size=5`, null, cookie);
      assert(reports.status === 200 && reports.body.success, 'Financial report search works by student name');
    }
  } catch (error) {
    console.error(error);
    failed++;
  } finally {
    server.close(() => process.exit(failed ? 1 : 0));
  }
});
