process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server.js';

let server;
const PORT = 5055; // Separate test port

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
  console.log('--- STARTING COMPREHENSIVE BACKEND API TESTS ---');
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
      // 1. Health check
      const health = await request('GET', '/api/health');
      assert(health.status === 200 && health.body.services.database === 'connected', 'Health check is 200 with DB connected');

      // 2. Unauthenticated check
      const unauth = await request('GET', '/api/students');
      assert(unauth.status === 401, 'Protected route returns 401 for unauthenticated request');

      // 3. Super Admin Login
      const loginSuper = await request('POST', '/api/auth/login', { username: 'superadmin', password: 'Admin@12345' });
      assert(loginSuper.status === 200 && loginSuper.body.user.role === 'super_admin', 'Super Admin logs in successfully');
      const superCookie = extractSessionCookie(loginSuper.setCookie);

      // 4. Super Admin can access both Institute and Quran
      const superInst = await request('GET', '/api/institute/classes', null, superCookie);
      assert(superInst.status === 200 && superInst.body.data.length > 0, 'Super Admin can access Institute classes');

      const superQuran = await request('GET', '/api/quran/groups', null, superCookie);
      assert(superQuran.status === 200 && superQuran.body.data.length > 0, 'Super Admin can access Quran groups');

      // 5. Institute Admin Login & Scope Boundaries
      const loginInst = await request('POST', '/api/auth/login', { username: 'instadmin', password: 'Admin@12345' });
      assert(loginInst.status === 200 && loginInst.body.user.role === 'institute_admin', 'Institute Admin logs in');
      const instCookie = extractSessionCookie(loginInst.setCookie);

      const instAccessInst = await request('GET', '/api/institute/classes', null, instCookie);
      assert(instAccessInst.status === 200, 'Institute Admin CAN access Institute classes');

      const instAccessQuran = await request('GET', '/api/quran/groups', null, instCookie);
      assert(instAccessQuran.status === 403, 'SECURITY: Institute Admin CANNOT access Quran groups (403 Forbidden)');

      // 6. Quran Admin Login & Scope Boundaries
      const loginQuran = await request('POST', '/api/auth/login', { username: 'quranadmin', password: 'Admin@12345' });
      assert(loginQuran.status === 200 && loginQuran.body.user.role === 'quran_admin', 'Quran Admin logs in');
      const quranCookie = extractSessionCookie(loginQuran.setCookie);

      const quranAccessQuran = await request('GET', '/api/quran/groups', null, quranCookie);
      assert(quranAccessQuran.status === 200, 'Quran Admin CAN access Quran groups');

      const quranAccessInst = await request('GET', '/api/institute/classes', null, quranCookie);
      assert(quranAccessInst.status === 403, 'SECURITY: Quran Admin CANNOT access Institute classes (403 Forbidden)');

      // 7. Institute Attendance Schedule: Allowed on all weekdays (including Wednesday)
      // 2026-10-21 is a Wednesday
      const wednesdaySheet = await request('GET', '/api/attendance/sheet?division=institute&class_id=1&date=2026-10-21', null, superCookie);
      assert(wednesdaySheet.status === 200 && wednesdaySheet.body.data.students.length > 0, 'Institute attendance is allowed on any weekday (including Wednesday)');

      // 2026-10-22 is a Thursday
      const thursdaySheet = await request('GET', '/api/attendance/sheet?division=institute&class_id=1&date=2026-10-22', null, superCookie);
      assert(thursdaySheet.status === 200 && thursdaySheet.body.data.students.length > 0, 'Institute attendance sheet loads for Thursday');

      // 8. Payment workflow & Balance Calculation (NO payment method column)
      const payDetails = await request('GET', '/api/finance/payment-details?student_id=2&division=institute&billing_period=2026-05', null, superCookie);
      assert(payDetails.status === 200 && payDetails.body.data.amount_due > 0, 'Payment details auto-loads standard fee and discount');

      const makePayment = await request('POST', '/api/finance/receive-payment', {
        student_id: 2,
        division: 'institute',
        billing_period: '2026-05',
        amount_paid: 15.00,
        notes: 'Test partial payment'
      }, superCookie);
      assert(makePayment.status === 201 && makePayment.body.receipt.receiptNumber.startsWith('REC-INST-'), 'Payment received and unique receipt generated');

      // 9. Financial Report contains the payment
      const finReport = await request('GET', '/api/finance/dashboard', null, superCookie);
      assert(finReport.status === 200 && finReport.body.data.total_collected > 0, 'Finance dashboard reflects payment collection');

      console.log('------------------------------------------------');
      console.log(`TOTAL PASSED: ${passed}`);
      console.log(`TOTAL FAILED: ${failed}`);
      console.log('------------------------------------------------');

      if (failed === 0) {
        console.log('ALL TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
      } else {
        process.exit(1);
      }
    } catch (err) {
      console.error('Test execution error:', err);
      process.exit(1);
    } finally {
      server.close();
    }
  });
}

runTests();
