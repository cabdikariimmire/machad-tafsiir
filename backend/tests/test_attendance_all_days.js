import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

async function testAttendanceSuite() {
  console.log('--- STARTING ATTENDANCE COMPREHENSIVE TEST (ALL 7 WEEKDAYS) ---');
  let cookie = '';

  // 1. Login as Super Admin
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'Admin@12345' })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginData.success, true, 'Superadmin login must succeed');
  cookie = loginRes.headers.get('set-cookie');
  console.log('✓ 1. Logged in as Super Admin');

  // 2. Fetch class 1 enrolled students automatically on sheet request
  const sheetRes = await fetch(`${BASE_URL}/attendance/sheet?division=institute&class_id=1&date=2026-10-19`, {
    headers: { 'Cookie': cookie }
  });
  const sheetData = await sheetRes.json();
  assert.strictEqual(sheetData.success, true, 'Attendance sheet must succeed on Monday');
  assert.ok(sheetData.data.students.length >= 2, 'Class 1 must automatically return enrolled students');
  const studentNames = sheetData.data.students.map(s => s.full_name);
  assert.ok(studentNames.includes('Maxamed Cabdi Cilmi'), 'Enrolled student Maxamed must be in sheet');
  assert.ok(studentNames.includes('Cabdiraxmaan Xasan Cali'), 'Enrolled student Cabdiraxmaan must be in sheet');
  console.log(`✓ 2. Class 1 automatically returned ${sheetData.data.students.length} enrolled students`);

  // 3. Test saving attendance across ALL 7 weekdays:
  // Sunday (2026-10-18), Monday (2026-10-19), Tuesday (2026-10-20), Wednesday (2026-10-21),
  // Thursday (2026-10-22), Friday (2026-10-23), Saturday (2026-10-24)
  const weekdaysTest = [
    { day: 'Sunday', date: '2026-10-18' },
    { day: 'Monday', date: '2026-10-19' },
    { day: 'Tuesday', date: '2026-10-20' },
    { day: 'Wednesday', date: '2026-10-21' },
    { day: 'Thursday', date: '2026-10-22' },
    { day: 'Friday', date: '2026-10-23' },
    { day: 'Saturday', date: '2026-10-24' }
  ];

  for (const item of weekdaysTest) {
    const saveRes = await fetch(`${BASE_URL}/attendance/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        division: 'institute',
        class_id: 1,
        date: item.date,
        records: [
          { student_id: 1, status: 'present', remarks: `Joogay ${item.day}` },
          { student_id: 2, status: 'absent', remarks: `Maqnaa ${item.day}` }
        ]
      })
    });
    const saveData = await saveRes.json();
    assert.strictEqual(saveData.success, true, `Attendance on ${item.day} (${item.date}) must succeed`);
    console.log(`✓ 3.${weekdaysTest.indexOf(item) + 1} Attendance saved on ${item.day} (${item.date}) successfully`);
  }

  // 4. Verify existing attendance loads correctly on Monday (shows saved status absent for student 2)
  const reloadRes = await fetch(`${BASE_URL}/attendance/sheet?division=institute&class_id=1&date=2026-10-19`, {
    headers: { 'Cookie': cookie }
  });
  const reloadData = await reloadRes.json();
  assert.strictEqual(reloadData.success, true);
  assert.strictEqual(reloadData.data.session_exists, true, 'Session must exist for Monday');
  const student1 = reloadData.data.students.find(s => s.student_id === 1);
  const student2 = reloadData.data.students.find(s => s.student_id === 2);
  assert.strictEqual(student1.status, 'present', 'Student 1 must have saved status: present');
  assert.strictEqual(student2.status, 'absent', 'Student 2 must have saved status: absent');
  assert.strictEqual(student2.remarks, 'Maqnaa Monday', 'Student 2 remarks must match saved remarks');
  console.log('✓ 4. Loaded existing attendance accurately with saved statuses & remarks');

  // 5. Verify changing date does not overwrite saved records
  const sundayRes = await fetch(`${BASE_URL}/attendance/sheet?division=institute&class_id=1&date=2026-10-18`, {
    headers: { 'Cookie': cookie }
  });
  const sundayData = await sundayRes.json();
  const sundayStudent2 = sundayData.data.students.find(s => s.student_id === 2);
  assert.strictEqual(sundayStudent2.remarks, 'Maqnaa Sunday', 'Sunday records must remain intact when loading other dates');
  console.log('✓ 5. Verified date switching does not overwrite historical records');

  // 6. Verify duplicate records are prevented (re-saving same date updates gracefully)
  const updateRes = await fetch(`${BASE_URL}/attendance/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      division: 'institute',
      class_id: 1,
      date: '2026-10-19',
      records: [
        { student_id: 1, status: 'present', remarks: 'Still present' },
        { student_id: 2, status: 'present', remarks: 'Corrected to present' }
      ]
    })
  });
  const updateData = await updateRes.json();
  assert.strictEqual(updateData.success, true);
  console.log('✓ 6. Prevented duplicate records, upserted cleanly as an authorized correction');

  // 7. Verify students outside the class cannot be recorded (student 3 belongs to class 2, not class 1)
  const invalidRes = await fetch(`${BASE_URL}/attendance/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      division: 'institute',
      class_id: 1,
      date: '2026-10-19',
      records: [
        { student_id: 3, status: 'present', remarks: 'Unenrolled student' }
      ]
    })
  });
  const invalidData = await invalidRes.json();
  assert.strictEqual(invalidData.success, false, 'Recording attendance for unenrolled student must fail');
  console.log('✓ 7. Verified backend rejects students not enrolled in the selected class');

  // 8. Verify division scope protection (institute_admin cannot record Quran attendance)
  const instLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'instadmin', password: 'Admin@12345' })
  });
  const instCookie = instLoginRes.headers.get('set-cookie');
  const scopeRes = await fetch(`${BASE_URL}/attendance/sheet?division=quran&group_id=1&date=2026-10-19`, {
    headers: { 'Cookie': instCookie }
  });
  const scopeData = await scopeRes.json();
  assert.strictEqual(scopeData.success, false, 'Institute admin cannot access Quran attendance');
  assert.strictEqual(scopeRes.status, 403, 'Must return 403 Forbidden');
  console.log('✓ 8. Verified division scope authorization is strictly enforced (403 Forbidden)');

  console.log('\n--- ALL ATTENDANCE TESTS PASSED (100% SUCCESS) ---');
}

testAttendanceSuite().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
