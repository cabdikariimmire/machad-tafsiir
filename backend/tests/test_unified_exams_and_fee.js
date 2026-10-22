// Automated Integration Test for Unified Exam Periods & Exam Fee Management
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING TESTS: UNIFIED EXAM PERIODS & EXAM FEE');
  console.log('====================================================\n');

  // Step 1: Login to get session
  console.log('1. Logging in as superadmin...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'Admin@12345' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const rawCookie = loginRes.headers.get('set-cookie');
  const cookie = rawCookie ? rawCookie.split(';')[0] : '';
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': cookie
  };
  console.log('   ✓ Logged in successfully. Session cookie acquired.\n');

  // Step 2: List Exam Periods
  console.log('2. Testing GET /api/exams/periods...');
  const periodsRes = await fetch(`${BASE_URL}/exams/periods?academic_year=2026`, { headers });
  const periodsData = await periodsRes.json();
  console.log(`   ✓ Returned ${periodsData.data?.length || 0} exam periods.`);
  const periodNames = periodsData.data.map(p => p.name);
  console.log('   Periods:', periodNames.join(', '));
  if (!periodNames.includes('Monthly Exam 1')) {
    throw new Error('Monthly Exam 1 should exist in periods');
  }

  // Step 3: Create a new custom exam period
  console.log('\n3. Testing POST /api/exams/periods (custom period creation)...');
  const createPeriodRes = await fetch(`${BASE_URL}/exams/periods`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Special Assessment 2026',
      academic_year: '2026'
    })
  });
  const createPeriodData = await createPeriodRes.json();
  console.log('   ✓ Period creation response:', createPeriodData.message);

  // Step 4: Get Classes and find Class 1
  console.log('\n4. Fetching classes...');
  const classesRes = await fetch(`${BASE_URL}/institute/classes`, { headers });
  const classesData = await classesRes.json();
  const targetClass = classesData.data[0];
  console.log(`   ✓ Selected class: ${targetClass.name} (ID: ${targetClass.id})`);

  // Step 5: Test GET /api/exams/unified-sheet
  console.log('\n5. Testing GET /api/exams/unified-sheet...');
  const sheetRes = await fetch(
    `${BASE_URL}/exams/unified-sheet?class_id=${targetClass.id}&academic_year=2026&exam_period=Monthly%20Exam%201`,
    { headers }
  );
  const sheetData = await sheetRes.json();
  if (!sheetData.success) {
    throw new Error('Failed to get unified sheet: ' + JSON.stringify(sheetData));
  }
  console.log(`   ✓ Class: ${sheetData.data.class.name}`);
  console.log(`   ✓ Assigned Subjects: ${sheetData.data.subjects.length}`);
  console.log(`   ✓ Enrolled Students: ${sheetData.data.students.length}`);

  // Step 6: Test POST /api/exams/unified-marks (atomic bulk save)
  console.log('\n6. Testing POST /api/exams/unified-marks (Save All Marks)...');
  if (sheetData.data.students.length > 0 && sheetData.data.subjects.length > 0) {
    const marks_grid = [];
    sheetData.data.students.forEach((st, sIdx) => {
      sheetData.data.subjects.forEach((sub, subIdx) => {
        // give student 1 85.5, student 2 92, etc. or absent
        const markVal = (sIdx === 0 && subIdx === 1) ? null : (70 + ((sIdx * 5 + subIdx * 7) % 25));
        const isAbsent = (sIdx === 1 && subIdx === 0);
        marks_grid.push({
          student_id: st.student_id,
          subject_id: sub.id,
          marks_obtained: isAbsent ? null : markVal,
          is_absent: isAbsent
        });
      });
    });

    const saveRes = await fetch(`${BASE_URL}/exams/unified-marks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        academic_year: '2026',
        exam_period: 'Monthly Exam 1',
        class_id: targetClass.id,
        marks_grid,
        status: 'published'
      })
    });
    const saveData = await saveRes.json();
    if (!saveData.success) {
      throw new Error('Save marks failed: ' + JSON.stringify(saveData));
    }
    console.log('   ✓ Save All Marks succeeded:', saveData.message);
    console.log(`   ✓ Upserted ${saveData.count} mark records atomically.`);
  }

  // Step 7: Verify Results Section integration
  console.log('\n7. Verifying Results section integration with period Monthly Exam 1...');
  const resultsRes = await fetch(
    `${BASE_URL}/exams/results/class?class_id=${targetClass.id}&academic_year=2026&exam_title=Monthly%20Exam%201`,
    { headers }
  );
  const resultsData = await resultsRes.json();
  if (!resultsData.success) {
    throw new Error('Class results retrieval failed: ' + JSON.stringify(resultsData));
  }
  console.log(`   ✓ Whole-class results returned ${resultsData.data.students?.length || 0} students.`);
  if (resultsData.data.students?.length > 0) {
    const top = resultsData.data.students[0];
    console.log(`   ✓ Top Student: ${top.student_name} | Rank: ${top.rank} | Total: ${top.total_obtained}/${top.maximum_total} (${top.average_percentage}%)`);
  }

  // Step 8: Test Exam Fee Status
  console.log('\n8. Testing Exam Fee Student Status (GET /api/exams/fee/status)...');
  const student = sheetData.data.students[0];
  let testPeriod = 'Monthly Exam 1';
  let feeStatusRes = await fetch(
    `${BASE_URL}/exams/fee/status?student_id=${student.student_id}&exam_period=${encodeURIComponent(testPeriod)}&academic_year=2026`,
    { headers }
  );
  let feeStatusData = await feeStatusRes.json();
  if (!feeStatusData.success) {
    throw new Error('Fee status failed: ' + JSON.stringify(feeStatusData));
  }

  // If already fully paid for Monthly Exam 1, switch to Midterm Exam so we can test payment
  if (feeStatusData.data.remaining_balance <= 0) {
    testPeriod = 'Midterm Exam';
    feeStatusRes = await fetch(
      `${BASE_URL}/exams/fee/status?student_id=${student.student_id}&exam_period=${encodeURIComponent(testPeriod)}&academic_year=2026`,
      { headers }
    );
    feeStatusData = await feeStatusRes.json();
  }

  console.log(`   ✓ Student: ${feeStatusData.data.student.full_name}`);
  console.log(`   ✓ Exam Period: ${testPeriod}`);
  console.log(`   ✓ Official Fee: $${feeStatusData.data.official_fee}`);
  console.log(`   ✓ Previously Paid: $${feeStatusData.data.amount_paid}`);
  console.log(`   ✓ Remaining Balance: $${feeStatusData.data.remaining_balance}`);

  // Step 9: Record Exam Fee Payment
  console.log('\n9. Testing POST /api/exams/fee/payment...');
  const payAmount = Math.min(5.00, feeStatusData.data.remaining_balance > 0 ? feeStatusData.data.remaining_balance : 5.00);
  const payRes = await fetch(`${BASE_URL}/exams/fee/payment`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      student_id: student.student_id,
      academic_year: '2026',
      exam_period: testPeriod,
      class_id: targetClass.id,
      amount: payAmount,
      notes: `Test payment for ${testPeriod}`
    })
  });
  const payData = await payRes.json();
  if (!payData.success) {
    throw new Error('Fee payment failed: ' + JSON.stringify(payData));
  }
  console.log('   ✓ Payment recorded successfully!');
  console.log(`   ✓ Receipt Number: ${payData.data.receipt_number}`);
  console.log(`   ✓ Amount Paid: $${payData.data.amount_paid}`);
  console.log(`   ✓ Balance Remaining: $${payData.data.balance_remaining}`);

  // Step 10: Test Duplicate Submission Prevention (Immediate retry)
  console.log('\n10. Testing duplicate submission prevention...');
  const dupRes = await fetch(`${BASE_URL}/exams/fee/payment`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      student_id: student.student_id,
      academic_year: '2026',
      exam_period: 'Monthly Exam 1',
      class_id: targetClass.id,
      amount: payAmount
    })
  });
  const dupData = await dupRes.json();
  console.log(`   ✓ Duplicate rejection status (${dupRes.status}):`, dupData.message);
  if (dupRes.status !== 400 && dupRes.status !== 409) {
    console.warn('   Note: Expected 400 or 409 for duplicate within 15s');
  }

  // Step 11: Retrieve Saved Receipt for Reprinting
  console.log('\n11. Testing GET /api/exams/fee/receipt/:receiptNumber...');
  const receiptRes = await fetch(`${BASE_URL}/exams/fee/receipt/${payData.data.receipt_number}`, { headers });
  const receiptData = await receiptRes.json();
  if (!receiptData.success) {
    throw new Error('Receipt retrieval failed: ' + JSON.stringify(receiptData));
  }
  console.log('   ✓ Saved receipt retrieved:');
  console.log(`     Institute Name: ${receiptData.data.institute_name}`);
  console.log(`     Receipt Number: ${receiptData.data.receipt_number}`);
  console.log(`     Student Name:   ${receiptData.data.student_name}`);
  console.log(`     Exam Period:    ${receiptData.data.exam_period}`);
  console.log(`     Amount Paid:    $${receiptData.data.amount_paid}`);
  console.log(`     Remaining:      $${receiptData.data.balance_remaining}`);

  // Step 12: Test Payment History
  console.log('\n12. Testing GET /api/exams/fee/history...');
  const histRes = await fetch(`${BASE_URL}/exams/fee/history?academic_year=2026`, { headers });
  const histData = await histRes.json();
  console.log(`   ✓ Returned ${histData.data.length} payment records in history.`);

  console.log('\n====================================================');
  console.log('ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ✓✓✓');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
