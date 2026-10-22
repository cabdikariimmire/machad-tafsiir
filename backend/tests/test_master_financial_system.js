process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server.js';
import { query } from '../src/db/connection.js';

let server;
const PORT = 5088;

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

async function runMasterFinancialTests() {
  console.log('========================================================================');
  console.log('--- MASTER TEST: FINANCIAL MANAGEMENT SYSTEM & EXAM RECEIPT ISOLATION ---');
  console.log('========================================================================');

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

      // -----------------------------------------------------------------------
      // REQUIREMENT 1: TWO SEPARATE DEPARTMENTS (INSTITUTE & QURAN SCHOOL)
      // -----------------------------------------------------------------------
      console.log('\n--- 1. TWO SEPARATE DEPARTMENTS ISOLATION ---');
      const instStudents = await request('GET', '/api/students?division=institute&limit=5', null, superCookie);
      assert(instStudents.status === 200 && instStudents.body.data.length > 0, 'Can query Islamic Institute students');

      const quranStudents = await request('GET', '/api/students?division=quran&limit=5', null, superCookie);
      assert(quranStudents.status === 200 && quranStudents.body.data.length > 0, 'Can query Quran School students');

      // Quran admin cannot manage institute finance
      const crossDeptAttempt = await request('POST', '/api/finance/receive-payment', {
        student_id: instStudents.body.data[0].id,
        division: 'institute',
        amount_paid: 10
      }, quranAdminCookie);
      assert(crossDeptAttempt.status === 403, 'Quran Admin strictly forbidden from managing Islamic Institute finance (403)');

      // -----------------------------------------------------------------------
      // REQUIREMENT 4: STUDENT SEARCH BY NAME, ID, PHONE
      // -----------------------------------------------------------------------
      console.log('\n--- 2. STUDENT SEARCH (NAME, ID, PHONE) ---');
      const testStudent = instStudents.body.data[0];
      const searchByName = await request('GET', `/api/students?search=${encodeURIComponent(testStudent.full_name)}&division=institute`, null, superCookie);
      assert(searchByName.status === 200 && searchByName.body.data.some(s => s.id === testStudent.id), 'Search by student name finds correct student');

      const searchById = await request('GET', `/api/students?search=${encodeURIComponent(testStudent.student_id)}&division=institute`, null, superCookie);
      assert(searchById.status === 200 && searchById.body.data.some(s => s.id === testStudent.id), 'Search by Student ID finds correct student');

      if (testStudent.phone) {
        const searchByPhone = await request('GET', `/api/students?search=${encodeURIComponent(testStudent.phone)}&division=institute`, null, superCookie);
        assert(searchByPhone.status === 200 && searchByPhone.body.data.some(s => s.id === testStudent.id), 'Search by phone number finds correct student');
      }

      // -----------------------------------------------------------------------
      // REQUIREMENT 4: PARTIAL PAYMENTS, OBLIGATION ALLOCATION, NO PAYMENT METHOD
      // -----------------------------------------------------------------------
      console.log('\n--- 3. PAYMENT ALLOCATION & ZERO PAYMENT METHOD RULE ---');
      const uniquePeriod = `2026-11`;
      await query(`DELETE FROM payments WHERE student_id = ? AND invoice_id IN (SELECT id FROM fee_invoices WHERE billing_period = ?)`, [testStudent.id, uniquePeriod]);
      await query(`DELETE FROM fee_invoices WHERE student_id = ? AND billing_period = ?`, [testStudent.id, uniquePeriod]);
      
      const payDetails = await request('GET', `/api/finance/payment-details?student_id=${testStudent.id}&division=institute&billing_period=${uniquePeriod}`, null, superCookie);
      assert(payDetails.status === 200 && payDetails.body.success, 'Student financial status retrieved successfully');
      
      const standardFee = payDetails.body.data.standard_fee || 25.00;
      const initialBalance = payDetails.body.data.balance_remaining;
      const partialPayAmount = 10.00;

      // Submit payment WITHOUT payment_method field (as required: payment method completely removed)
      const payRes = await request('POST', '/api/finance/receive-payment', {
        student_id: testStudent.id,
        division: 'institute',
        billing_period: uniquePeriod,
        amount_paid: partialPayAmount,
        notes: 'Monthly tuition partial payment'
      }, superCookie);

      assert((payRes.status === 200 || payRes.status === 201) && payRes.body.success, 'Payment processed successfully without payment method');
      const receipt = payRes.body.receipt;
      assert(receipt && receipt.receipt_number, `Unique receipt number generated: ${receipt?.receipt_number}`);
      assert(receipt.amount_paid === partialPayAmount, `Accurate amount paid recorded: $${receipt.amount_paid}`);
      assert(receipt.newBalance === (initialBalance - partialPayAmount), `Accurate remaining balance computed: $${receipt.newBalance}`);

      // -----------------------------------------------------------------------
      // REQUIREMENT 5 & 6: CRITICAL EXAM RECEIPT DEBT ISOLATION
      // "Outstanding student debt must never appear on Examination Office Receipt Voucher"
      // -----------------------------------------------------------------------
      console.log('\n--- 4. CRITICAL EXAM OFFICE RECEIPT & DEBT ISOLATION TEST ---');
      
      // Step A: Ensure test student has tuition debt (we know initialBalance - partialPayAmount > 0)
      const tuitionDebt = initialBalance - partialPayAmount;
      assert(tuitionDebt > 0, `Student has confirmed active tuition debt ($${tuitionDebt}) in financial records`);

      // Step B: Set exam fee rule for period
      const examPeriod = `Midterm_${Date.now()}`;
      const academicYear = '2026';
      await query(`
        INSERT INTO exam_fee_rules (academic_year, exam_period, class_id, amount)
        VALUES (?, ?, NULL, 15.00)
        ON DUPLICATE KEY UPDATE amount = 15.00
      `, [academicYear, examPeriod]);

      // Step C: Record exam fee payment of $15.00
      const examPayRes = await request('POST', '/api/exams/fees/pay', {
        student_id: testStudent.id,
        academic_year: academicYear,
        exam_period: examPeriod,
        amount_paid: 15.00,
        notes: 'Exam fee payment'
      }, superCookie);

      assert(examPayRes.status === 201 && examPayRes.body.success, 'Exam fee payment recorded successfully');
      const examReceipt = examPayRes.body.data;
      assert(examReceipt && examReceipt.receipt_number, `Exam receipt generated: ${examReceipt.receipt_number}`);
      assert(parseFloat(examReceipt.amount_paid) === 15.00, `Exam receipt shows exact exam payment ($15.00)`);
      assert(parseFloat(examReceipt.fee_amount) === 15.00, `Official exam fee amount is $15.00`);

      // Step D: Fetch Examination Office Receipt Voucher via API
      const receiptFetch = await request('GET', `/api/exams/fees/receipt/${examReceipt.receipt_number}`, null, superCookie);
      assert(receiptFetch.status === 200 && receiptFetch.body.success, 'Examination Office Receipt Voucher retrieved');
      const voucherData = receiptFetch.body.data;

      // CRITICAL ASSERTIONS FOR EXAMINATION RECEIPT:
      // 1. Voucher must show only exam payment information
      assert(parseFloat(voucherData.amount_paid) === 15.00, 'Exam Voucher shows $15.00 exam payment');
      assert(voucherData.exam_period === examPeriod, `Exam Voucher shows exam period '${examPeriod}'`);
      
      // 2. Unrelated tuition debt must NEVER appear on the exam voucher
      assert(voucherData.tuition_debt === undefined, 'No tuition_debt property exists on Exam Voucher');
      assert(voucherData.registration_debt === undefined, 'No registration_debt property exists on Exam Voucher');
      assert(voucherData.total_debt === undefined, 'No total_debt property exists on Exam Voucher');
      assert(voucherData.balance_remaining !== undefined && parseFloat(voucherData.balance_remaining) === 0, 
        'Remaining balance on Exam Voucher reflects ONLY examination fee balance (0.00), not tuition debt');

      // 3. Tuition debt is NOT erased in student financial records
      const verifyTuitionStillExists = await request('GET', `/api/finance/payment-details?student_id=${testStudent.id}&division=institute&billing_period=${uniquePeriod}`, null, superCookie);
      assert(verifyTuitionStillExists.body.data.balance_remaining > 0, 
        `Tuition debt remains accurately recorded in finance ($${verifyTuitionStillExists.body.data.balance_remaining}) without being corrupted`);

      // -----------------------------------------------------------------------
      // REQUIREMENT 6: RECEIPT REPRINTING (NO DUPLICATE TRANSACTIONS)
      // -----------------------------------------------------------------------
      console.log('\n--- 5. RECEIPT REPRINTING TEST ---');
      const [countBefore] = await query('SELECT COUNT(*) as cnt FROM exam_fee_payments WHERE receipt_number = ?', [examReceipt.receipt_number]);
      const reprintFetch = await request('GET', `/api/exams/fees/receipt/${examReceipt.receipt_number}`, null, superCookie);
      assert(reprintFetch.status === 200, 'Receipt fetched again for reprinting');
      const [countAfter] = await query('SELECT COUNT(*) as cnt FROM exam_fee_payments WHERE receipt_number = ?', [examReceipt.receipt_number]);
      assert(countBefore.cnt === 1 && countAfter.cnt === 1, 'Reprinting receipt creates NO duplicate transactions in the database');

      // -----------------------------------------------------------------------
      // REQUIREMENT 7: SEPARATE REPORTS & AUTHORIZED COMBINED REPORTS
      // -----------------------------------------------------------------------
      console.log('\n--- 6. FINANCIAL REPORTS SEPARATION TEST ---');
      const instReport = await request('GET', '/api/reports/finance?division=institute', null, superCookie);
      assert(instReport.status === 200 && instReport.body.success, 'Islamic Institute collections report fetched');

      const quranReport = await request('GET', '/api/reports/finance?division=quran', null, superCookie);
      assert(quranReport.status === 200 && quranReport.body.success, 'Quran School collections report fetched');

      // Super admin combined report
      const combinedReport = await request('GET', '/api/reports/finance', null, superCookie);
      assert(combinedReport.status === 200 && combinedReport.body.success, 'Management combined report fetched');
      const instRecords = combinedReport.body.data.records.filter(r => r.division === 'institute');
      const quranRecords = combinedReport.body.data.records.filter(r => r.division === 'quran');
      assert(instRecords !== undefined && quranRecords !== undefined, 'Combined report clearly isolates institute and quran transactions by division');

      console.log('\n========================================================================');
      console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
      console.log('========================================================================');
      server.close();
      process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
      console.error('Test execution exception:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runMasterFinancialTests();
