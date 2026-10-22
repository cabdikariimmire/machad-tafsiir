import http from 'http';

function makeRequest({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api${path}`,
        method,
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(rawData);
          } catch (e) {
            parsed = rawData;
          }
          resolve({
            status: res.statusCode,
            data: parsed,
            cookies: res.headers['set-cookie']
          });
        });
      }
    );

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

async function login(username, password) {
  const res = await makeRequest({
    method: 'POST',
    path: '/auth/login',
    body: { username, password }
  });
  if (res.cookies && res.cookies.length > 0) {
    return res.cookies.map(c => c.split(';')[0]).join('; ');
  }
  return null;
}

async function runTests() {
  console.log('====================================================');
  console.log('   TESTING INSTITUTE ACADEMIC MODULE (ALL CRITERIA)');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  // Log in as Super Admin
  const cookie = await login('superadmin', 'Admin@12345');
  const authHeaders = { Cookie: cookie };

  // 1. Create Class F1 for academic year 2026
  const randSuffix = Math.floor(Math.random() * 9000 + 1000);
  const testClassName = `F1-${randSuffix}`;
  const resCreateF1 = await makeRequest({
    method: 'POST',
    path: '/institute/classes',
    headers: authHeaders,
    body: { class_name: testClassName, academic_year: '2026', description: 'Test Class F1' }
  });
  assert(resCreateF1.status === 201 && resCreateF1.data?.id, `1. Authorized user can create class ${testClassName} for 2026`);
  const f1Id = resCreateF1.data?.id;

  // Duplicate class name in same year should be rejected
  const resDupClass = await makeRequest({
    method: 'POST',
    path: '/institute/classes',
    headers: authHeaders,
    body: { class_name: testClassName, academic_year: '2026' }
  });
  assert(resDupClass.status === 400, '1b. Duplicate class name within same academic year rejected');

  // Create Class F2
  const testF2Name = `F2-${randSuffix}`;
  const resCreateF2 = await makeRequest({
    method: 'POST',
    path: '/institute/classes',
    headers: authHeaders,
    body: { class_name: testF2Name, academic_year: '2026' }
  });
  const f2Id = resCreateF2.data?.id;
  assert(resCreateF2.status === 201 && f2Id, `1c. Authorized user can create class ${testF2Name}`);

  // 2. Register a subject centrally once
  const subCodeA = `SUB-TST-${randSuffix}-A`;
  const subNameA = `Tafsiir Test ${randSuffix}`;
  const resSubA = await makeRequest({
    method: 'POST',
    path: '/institute/subjects',
    headers: authHeaders,
    body: { subject_code: subCodeA, subject_name: subNameA, description: 'Central Subject A' }
  });
  assert(resSubA.status === 201 && resSubA.data?.id, `2. Register subject centrally (${subNameA})`);
  const subAId = resSubA.data?.id;

  // Duplicate subject code rejected
  const resDupCode = await makeRequest({
    method: 'POST',
    path: '/institute/subjects',
    headers: authHeaders,
    body: { subject_code: subCodeA, subject_name: 'Another Name' }
  });
  assert(resDupCode.status === 400, '2b. Duplicate subject code rejected');

  // Register subject B
  const subCodeB = `SUB-TST-${randSuffix}-B`;
  const subNameB = `Nahw Test ${randSuffix}`;
  const resSubB = await makeRequest({
    method: 'POST',
    path: '/institute/subjects',
    headers: authHeaders,
    body: { subject_code: subCodeB, subject_name: subNameB }
  });
  const subBId = resSubB.data?.id;

  // 3. Assign multiple existing subjects to F1
  const resAssignF1 = await makeRequest({
    method: 'POST',
    path: `/institute/classes/${f1Id}/subjects`,
    headers: authHeaders,
    body: { subject_ids: [subAId, subBId] }
  });
  assert(resAssignF1.status === 201, '3. Assign multiple subjects (A and B) to F1');

  // 4. Assign the SAME subject (subAId) to F2 without creating another subject record
  const resAssignF2 = await makeRequest({
    method: 'POST',
    path: `/institute/classes/${f2Id}/subjects`,
    headers: authHeaders,
    body: { subject_id: subAId }
  });
  assert(resAssignF2.status === 201, '4. Assign same subject A to F2 without duplicating subject record');

  // 5. Opening F1 displays its assigned subjects
  const resGetF1Subs = await makeRequest({
    method: 'GET',
    path: `/institute/classes/${f1Id}/subjects`,
    headers: authHeaders
  });
  const f1Subs = resGetF1Subs.data?.data || [];
  const hasSubA = f1Subs.some(s => s.id === subAId);
  const hasSubB = f1Subs.some(s => s.id === subBId);
  assert(resGetF1Subs.status === 200 && hasSubA && hasSubB, '5. Opening F1 displays assigned subjects (A and B)');

  // 6. Restrict Timetable to only subjects assigned to the class
  // Try to schedule subject B in F2 (Subject B is NOT assigned to F2!)
  const resInvalidSubTT = await makeRequest({
    method: 'POST',
    path: '/institute/timetable',
    headers: authHeaders,
    body: {
      class_id: f2Id,
      subject_id: subBId, // Not assigned to F2
      day_of_week: 'Monday',
      start_time: '08:00',
      end_time: '09:30'
    }
  });
  assert(resInvalidSubTT.status === 400 && resInvalidSubTT.data?.error?.includes('looma xilsaarin'), '6. Timetable rejects unassigned subject for F2');

  // 7. Timetable supports every day of the week (Monday - Sunday)
  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  let allDaysValid = true;
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const sHour = (7 + i).toString().padStart(2, '0');
    const eHour = (8 + i).toString().padStart(2, '0');
    const resDay = await makeRequest({
      method: 'POST',
      path: '/institute/timetable',
      headers: authHeaders,
      body: {
        class_id: f1Id,
        subject_id: subAId,
        day_of_week: day,
        start_time: `${sHour}:00`,
        end_time: `${eHour}:00`,
        room: `Room ${i + 1}`
      }
    });
    if (resDay.status !== 201) {
      allDaysValid = false;
      console.error(`Failed on day ${day}:`, resDay.data);
    }
  }
  assert(allDaysValid, '7. Timetable supports all 7 days of the week (Saturday - Friday)');

  // 8. Invalid times rejected (end_time <= start_time)
  const resBadTime = await makeRequest({
    method: 'POST',
    path: '/institute/timetable',
    headers: authHeaders,
    body: {
      class_id: f1Id,
      subject_id: subAId,
      day_of_week: 'Monday',
      start_time: '10:00',
      end_time: '09:00'
    }
  });
  assert(resBadTime.status === 400 && resBadTime.data?.error?.includes('dambaysaa'), '8a. Invalid time range (end_time <= start_time) rejected');

  // 8b. Overlapping class schedule rejected
  // F1 on Monday has 09:00 - 10:00. Let's try 09:30 - 10:30 on Monday for F1
  const resOverlap = await makeRequest({
    method: 'POST',
    path: '/institute/timetable',
    headers: authHeaders,
    body: {
      class_id: f1Id,
      subject_id: subBId, // B is assigned to F1
      day_of_week: 'Monday',
      start_time: '09:30',
      end_time: '10:30'
    }
  });
  assert(resOverlap.status === 400 && resOverlap.data?.error?.includes('Isku dhac waqti'), '8b. Overlapping class schedule rejected with clear error message');

  // 9. Safe deactivation & duplicate handling
  const resToggle = await makeRequest({
    method: 'PATCH',
    path: `/institute/classes/${f1Id}/toggle-status`,
    headers: authHeaders
  });
  assert(resToggle.status === 200 && resToggle.data?.is_active === 0, '9. Safe deactivation toggles class to Inactive');

  // Reactivate for further tests
  await makeRequest({
    method: 'PATCH',
    path: `/institute/classes/${f1Id}/toggle-status`,
    headers: authHeaders
  });

  // 10. Unauthorized access control
  const resNoAuth = await makeRequest({
    method: 'POST',
    path: '/institute/classes',
    body: { class_name: 'Hacker Class', academic_year: '2026' }
  });
  assert(resNoAuth.status === 401, '10. Unauthorized direct API requests rejected (401)');

  console.log(`\n====================================================`);
  console.log(`TEST SUMMARY: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`====================================================\n`);

  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
