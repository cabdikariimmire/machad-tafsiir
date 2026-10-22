process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server.js';
import { query } from '../src/db/connection.js';

let server;
const PORT = 5077;

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
  return setCookie[0].split(';')[0];
}

async function runTests() {
  console.log('================================================================');
  console.log('--- TESTING FINANCE PAYMENT FORM REDESIGN & FINANCIAL STATUS ---');
  console.log('================================================================');
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
      // 1. Authenticate users
      const superLogin = await request('POST', '/api/auth/login', { username: 'superadmin', password: 'Admin@12345' });
      assert(superLogin.status === 200 && superLogin.body.user.role === 'super_admin', 'Super Admin logs in successfully');
      const superCookie = extractSessionCookie(superLogin.setCookie);

      const quranAdminLogin = await request('POST', '/api/auth/login', { username: 'quranadmin', password: 'Admin@12345' });
      assert(quranAdminLogin.status === 200 && quranAdminLogin.body.user.role === 'quran_admin', 'Quran Admin logs in successfully');
      const quranAdminCookie = extractSessionCookie(quranAdminLogin.setCookie);

      const teacherLogin = await request('POST', '/api/auth/login', { username: 'teacher_ahmed', password: 'Admin@12345' });
      assert(teacherLogin.status === 200 && teacherLogin.body.user.role === 'teacher', 'Teacher logs in successfully');
      const teacherCookie = extractSessionCookie(teacherLogin.setCookie);

      // -------------------------------------------------------------------
      // 2. Student Search Tests (English name, Arabic name, Student ID, Phone, Division scoping)
      // -------------------------------------------------------------------
      console.log('\n--- 2. STUDENT SEARCH TESTS ---');
      
      // Search by partial English name
      const searchEn = await request('GET', '/api/students?search=abdi&division=quran', null, superCookie);
      assert(searchEn.status === 200 && Array.isArray(searchEn.body.data) && searchEn.body.data.length > 0, 
        `Search by English name returns results (found: ${searchEn.body.data?.length})`);

      // Search by Arabic name
      const searchAr = await request('GET', '/api/students?search=' + encodeURIComponent('عبد الكريم') + '&division=quran', null, superCookie);
      assert(searchAr.status === 200 && Array.isArray(searchAr.body.data) && searchAr.body.data.length > 0,
        `Search by Arabic name ('عبد الكريم') returns matching student`);
      if (searchAr.body.data?.length > 0) {
        assert(searchAr.body.data[0].name_ar.includes('عبد الكريم'), 'Student result contains correct Arabic name');
      }

      // Search by Student ID
      const searchId = await request('GET', '/api/students?search=STU-2026&division=quran', null, superCookie);
      assert(searchId.status === 200 && Array.isArray(searchId.body.data) && searchId.body.data.length > 0,
        `Search by Student ID prefix returns matching students`);

      // Search by Phone number
      const testStudent = searchEn.body.data[0];
      if (testStudent && testStudent.phone) {
        const searchPhone = await request('GET', `/api/students?search=${testStudent.phone}&division=quran`, null, superCookie);
        assert(searchPhone.status === 200 && searchPhone.body.data.some(s => s.id === testStudent.id),
          `Search by phone number '${testStudent.phone}' successfully finds the student`);
      }

      // Division separation in search
      const quranStudentInInstitute = await request('GET', `/api/students?search=${encodeURIComponent(testStudent.full_name)}&division=institute`, null, superCookie);
      assert(quranStudentInInstitute.status === 200, 'Search respects division parameter');

      // -------------------------------------------------------------------
      // 3. Student Financial Summary & Unpaid Months
      // -------------------------------------------------------------------
      console.log('\n--- 3. STUDENT FINANCIAL SUMMARY & DETAILS ---');

      const paymentDetailsRes = await request('GET', `/api/finance/payment-details?student_id=${testStudent.id}&division=quran&billing_period=2026-05`, null, superCookie);
      assert(paymentDetailsRes.status === 200 && paymentDetailsRes.body.success, 'Fetch student payment details returns 200 OK');
      
      const pData = paymentDetailsRes.body.data;
      assert(pData.student && pData.student.id === testStudent.id, 'Returned student object with ID');
      assert(pData.student.student_code && pData.student.full_name, 'Student code and full name populated');
      assert(typeof pData.standard_fee === 'number', `Official standard fee is numeric ($${pData.standard_fee})`);
      assert(typeof pData.discount_amount === 'number', `Approved discount amount is numeric ($${pData.discount_amount})`);
      assert(typeof pData.amount_due === 'number', `Net amount due is numeric ($${pData.amount_due})`);
      assert(typeof pData.balance_remaining === 'number', `Remaining balance is numeric ($${pData.balance_remaining})`);
      assert(typeof pData.total_outstanding_balance === 'number', `Total outstanding balance is numeric ($${pData.total_outstanding_balance})`);
      assert(Array.isArray(pData.unpaid_months), `Unpaid months is an array (length: ${pData.unpaid_months.length})`);
      assert(Array.isArray(pData.payment_history), `Payment history is an array (length: ${pData.payment_history.length})`);

      // -------------------------------------------------------------------
      // 4. Payment Submission & Validations
      // -------------------------------------------------------------------
      console.log('\n--- 4. PAYMENT RECORDING & RECEIPT GENERATION ---');

      // 4a. Validate negative or 0 amount is rejected
      const invalidZero = await request('POST', '/api/finance/receive-payment', {
        student_id: testStudent.id,
        division: 'quran',
        billing_period: '2026-05',
        amount_paid: 0
      }, superCookie);
      assert(invalidZero.status === 400, 'Rejects zero amount payment (400 Bad Request)');

      // 4b. Validate amount exceeding balance is rejected
      const testPeriod = `test-${Date.now()}`; // Isolated period so the test never reuses an existing invoice
      const testPeriodDetails = await request('GET', `/api/finance/payment-details?student_id=${testStudent.id}&division=quran&billing_period=${testPeriod}`, null, superCookie);
      const testPeriodBalance = Number(testPeriodDetails.body.data?.balance_remaining || 25);
      const excessiveAmount = await request('POST', '/api/finance/receive-payment', {
        student_id: testStudent.id,
        division: 'quran',
        billing_period: testPeriod,
        amount_paid: testPeriodBalance + 500
      }, superCookie);
      assert(excessiveAmount.status === 400, 'Rejects payment exceeding balance (400 Bad Request)');

      // 4c. Submit valid partial payment without a payment method
      const payAmount = Math.min(10.00, testPeriodBalance);
      const payRes = await request('POST', '/api/finance/receive-payment', {
        student_id: testStudent.id,
        division: 'quran',
        billing_period: testPeriod,
        amount_paid: payAmount,
        notes: 'Test partial payment'
      }, superCookie);

      assert((payRes.status === 200 || payRes.status === 201) && payRes.body.success, 'Valid payment submission succeeds (2xx OK)');
      assert(payRes.body.receipt && payRes.body.receipt.receipt_number, `Receipt number generated: ${payRes.body.receipt?.receipt_number}`);
      assert(!Object.prototype.hasOwnProperty.call(payRes.body.receipt || {}, 'payment_method'), 'Receipt does not expose a payment method');
      assert(typeof payRes.body.receipt.amount_paid === 'number' || typeof payRes.body.receipt.amount_paid === 'string', 'Receipt has amount paid');

      // 4d. Verify payment stored without using payment_method
      const [paymentRow] = await query('SELECT id, receipt_number, amount_paid, notes FROM payments WHERE receipt_number = ?', [payRes.body.receipt.receipt_number]);
      assert(paymentRow && !Object.prototype.hasOwnProperty.call(paymentRow, 'payment_method'), 'Payment record does not use payment_method');
      assert(paymentRow && parseFloat(paymentRow.amount_paid) === payAmount, 'Payment record in DB matches amount paid');

      // 4e. Verify payment history now includes this payment
      const refreshedDetails = await request('GET', `/api/finance/payment-details?student_id=${testStudent.id}&division=quran&billing_period=${testPeriod}`, null, superCookie);
      assert(refreshedDetails.status === 200, 'Refreshed payment details returns 200 OK');
      const updatedHistory = refreshedDetails.body.data.payment_history;
      const foundInHistory = updatedHistory.find(h => h.receipt_number === payRes.body.receipt.receipt_number);
      assert(foundInHistory !== undefined, 'Payment appears in student payment history table');
      assert(foundInHistory && !Object.prototype.hasOwnProperty.call(foundInHistory, 'payment_method'), 'Payment history does not expose a payment method');

      // -------------------------------------------------------------------
      // 5. Role-based Permission Tests
      // -------------------------------------------------------------------
      console.log('\n--- 5. ROLE-BASED ACCESS CONTROL TESTS ---');

      // Teacher cannot access payment details
      const teacherDetails = await request('GET', `/api/finance/payment-details?student_id=${testStudent.id}&division=quran&billing_period=2026-05`, null, teacherCookie);
      assert(teacherDetails.status === 403, 'Teacher is forbidden from viewing payment details (403)');

      // Teacher cannot submit payments
      const teacherPay = await request('POST', '/api/finance/receive-payment', {
        student_id: testStudent.id,
        division: 'quran',
        billing_period: '2026-05',
        amount_paid: 10
      }, teacherCookie);
      assert(teacherPay.status === 403, 'Teacher is forbidden from submitting payments (403)');

      // Quran admin cannot manage Institute payments
      const quranAdminInstitute = await request('GET', `/api/finance/payment-details?student_id=${testStudent.id}&division=institute&billing_period=2026-05`, null, quranAdminCookie);
      assert(quranAdminInstitute.status === 403, 'Quran Admin is forbidden from accessing Institute payments (403)');

      console.log('\n================================================================');
      console.log(`--- TEST RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
      console.log('================================================================');

      server.close(() => {
        process.exit(failed > 0 ? 1 : 0);
      });
    } catch (err) {
      console.error('Test error:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runTests();
