process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../src/server.js';
import { query } from '../src/db/connection.js';

let server;
const PORT = 5088;

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
  console.log('--- TESTING PAYMENT MATRIX (JADWALKA LACAGAHA) & NAVIGATION ---');
  console.log('================================================================');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    server = app.listen(PORT);
    await new Promise(r => setTimeout(r, 600));

    // 1. Login as Super Admin (superadmin / Admin@12345)
    const loginRes = await request('POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'Admin@12345'
    });
    const adminCookie = extractSessionCookie(loginRes.setCookie);
    assert(loginRes.status === 200 && adminCookie, 'Super Admin login successful');

    // 2. Fetch Payment Matrix for Institute 2026
    const matrixRes = await request('GET', '/api/finance/payment-matrix?division=institute&year=2026', null, adminCookie);
    assert(matrixRes.status === 200 && matrixRes.body.success, 'GET /api/finance/payment-matrix (Institute 2026) returns 200 success');
    assert(matrixRes.body.data && matrixRes.body.data.year === '2026', 'Matrix year is 2026');
    assert(matrixRes.body.data.division === 'institute', 'Matrix division is institute');
    assert(typeof matrixRes.body.data.summary?.total_students === 'number', 'Summary has total_students');
    assert(typeof matrixRes.body.data.summary?.grand_total_paid === 'number', 'Summary has grand_total_paid');
    assert(typeof matrixRes.body.data.summary?.grand_total_balance === 'number', 'Summary has grand_total_balance');

    const students = matrixRes.body.data.students || [];
    assert(students.length > 0, `Institute has students enrolled (count: ${students.length})`);

    // Verify student matrix structure
    const sampleStudent = students[0];
    assert(sampleStudent && sampleStudent.id && sampleStudent.full_name, 'Student has ID and full_name');
    assert(sampleStudent.months && Object.keys(sampleStudent.months).length === 12, 'Student has all 12 months (01 through 12)');

    // Verify month keys and valid status values
    const monthKeys = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const validStatuses = ['paid', 'partial', 'unpaid', 'na'];
    let allMonthsValid = true;
    for (const k of monthKeys) {
      const m = sampleStudent.months[k];
      if (!m || !validStatuses.includes(m.status) || m.month_num !== parseInt(k, 10)) {
        allMonthsValid = false;
        break;
      }
    }
    assert(allMonthsValid, 'All 12 month entries have valid period, month_num, and status (paid/partial/unpaid/na)');

    // 3. Fetch Payment Matrix for Quran 2026
    const quranMatrixRes = await request('GET', '/api/finance/payment-matrix?division=quran&year=2026', null, adminCookie);
    assert(quranMatrixRes.status === 200 && quranMatrixRes.body.success, 'GET /api/finance/payment-matrix (Quran 2026) returns 200 success');
    assert(quranMatrixRes.body.data.division === 'quran', 'Matrix division is quran');

    // 4. Test Search Filter
    if (sampleStudent) {
      const searchRes = await request('GET', `/api/finance/payment-matrix?division=institute&year=2026&search=${encodeURIComponent(sampleStudent.student_id)}`, null, adminCookie);
      assert(searchRes.status === 200, 'Search filter returns 200');
      const filteredStudents = searchRes.body.data?.students || [];
      const found = filteredStudents.some(s => s.id === sampleStudent.id);
      assert(found, `Search by student_id (${sampleStudent.student_id}) returns the student`);
    }

    // 5. Test Status Filter
    const unpaidFilterRes = await request('GET', '/api/finance/payment-matrix?division=institute&year=2026&status=unpaid', null, adminCookie);
    assert(unpaidFilterRes.status === 200, 'Status filter (status=unpaid) returns 200');
    const unpaidStudents = unpaidFilterRes.body.data?.students || [];
    const allHaveUnpaid = unpaidStudents.every(s => (s.summary?.unpaid_count > 0 || s.summary?.partial_count > 0));
    assert(allHaveUnpaid, 'Filtered students all have unpaid or partial balances');

    // 6. Test Payment and Matrix Refresh
    // Find an invoice with unpaid or partial status
    const invRows = await query(`
      SELECT fi.*, s.full_name, s.student_id as student_code
      FROM fee_invoices fi
      JOIN students s ON fi.student_id = s.id
      WHERE fi.division = 'institute' AND fi.billing_period LIKE '2026-%' AND fi.balance > 0
      LIMIT 1
    `);

    if (invRows.length > 0) {
      const targetInv = invRows[0];
      const monthNumStr = targetInv.billing_period.split('-')[1];
      const initialBalance = parseFloat(targetInv.balance);

      // Make a partial payment of $5.00
      const payAmount = Math.min(5.00, initialBalance);
      const payRes = await request('POST', '/api/finance/receive-payment', {
        student_id: targetInv.student_id,
        division: 'institute',
        billing_period: targetInv.billing_period,
        amount_paid: payAmount,
        payment_method: 'Cash',
        notes: 'Test Payment for Matrix Verification'
      }, adminCookie);

      assert(payRes.status === 200 && payRes.body.success, `Payment of $${payAmount} recorded successfully (Receipt No: ${payRes.body.receipt?.receipt_number})`);

      // Re-fetch Payment Matrix and check updated status
      const updatedMatrixRes = await request('GET', `/api/finance/payment-matrix?division=institute&year=2026&search=${encodeURIComponent(targetInv.student_code)}`, null, adminCookie);
      const updatedStudents = updatedMatrixRes.body.data?.students || [];
      const updatedStudent = updatedStudents.find(s => s.id === targetInv.student_id);

      assert(updatedStudent !== undefined, 'Target student found in updated matrix');
      if (updatedStudent) {
        const updatedMonth = updatedStudent.months[monthNumStr];
        assert(updatedMonth !== undefined, `Month ${monthNumStr} exists for student in matrix`);
        assert(parseFloat(updatedMonth.amount_paid) > 0, `Month amount_paid updated to $${updatedMonth.amount_paid}`);
        const expectedStatus = parseFloat(updatedMonth.balance) <= 0 ? 'paid' : 'partial';
        assert(updatedMonth.status === expectedStatus, `Month status correctly updated to '${expectedStatus}'`);
      }
    } else {
      console.log('  ℹ No existing unpaid invoice in 2026 to test payment receipt on, skipping live payment update test');
    }

    console.log('\n----------------------------------------------------------------');
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('----------------------------------------------------------------');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
}

runTests();
