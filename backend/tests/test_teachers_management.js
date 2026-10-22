import http from 'http';
import { query } from '../src/db/connection.js';

const PORT = 5000;

function request(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;
    if (body) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: `/api${path}`,
        method,
        headers
      },
      (res) => {
        let data = '';
        const setCookie = res.headers['set-cookie'];
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data), setCookie });
          } catch {
            resolve({ status: res.statusCode, body: data, setCookie });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

function extractCookie(setCookie) {
  if (!setCookie || !setCookie.length) return null;
  return setCookie[0].split(';')[0];
}

async function runTests() {
  console.log('===============================================================');
  console.log('   VERIFYING QURAN SCHOOL TEACHERS MANAGEMENT (ACCEPTANCE TESTS)');
  console.log('===============================================================\n');

  try {
    // 1. Login as Quran Admin
    console.log('1. Logging in as Quran Admin (quranadmin)...');
    const adminLogin = await request('POST', '/auth/login', {
      username: 'quranadmin',
      password: 'Admin@12345'
    });
    if (adminLogin.status !== 200 || !adminLogin.body.success) {
      throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.body));
    }
    const adminCookie = extractCookie(adminLogin.setCookie);
    console.log('✓ Admin login successful.\n');

    // 2. Fetch existing teachers list
    console.log('2. Testing GET /api/quran/teachers...');
    const listRes = await request('GET', '/quran/teachers', null, adminCookie);
    if (listRes.status !== 200 || !listRes.body.success) {
      throw new Error('Failed to fetch teachers: ' + JSON.stringify(listRes.body));
    }
    console.log(`✓ Fetched ${listRes.body.data.length} registered Quran teachers from database.`);
    const existingTeacher = listRes.body.data.find(t => t.username === 'teacher_ahmed');
    if (!existingTeacher) {
      throw new Error('Expected default seeded teacher_ahmed to exist in teachers list.');
    }
    console.log(`✓ Verified seeded teacher: ${existingTeacher.full_name} with ${existingTeacher.classes.length} class(es).\n`);

    // 3. Validation Tests: Create teacher
    console.log('3. Testing validation for new teacher registration...');
    // Empty full name
    const valRes1 = await request('POST', '/quran/teachers', {
      full_name: '',
      username: 'test_empty_name',
      password: 'password123'
    }, adminCookie);
    if (valRes1.status !== 400) {
      throw new Error('Expected status 400 for empty full_name, got ' + valRes1.status);
    }
    console.log('✓ Blocked empty full_name.');

    // Short password
    const valRes2 = await request('POST', '/quran/teachers', {
      full_name: 'Test Macallin',
      username: 'test_short_pass',
      password: '123'
    }, adminCookie);
    if (valRes2.status !== 400) {
      throw new Error('Expected status 400 for short password, got ' + valRes2.status);
    }
    console.log('✓ Blocked short password.');

    // Duplicate username test
    const valRes3 = await request('POST', '/quran/teachers', {
      full_name: 'Macallin Ahmed Clone',
      username: 'teacher_ahmed', // already exists
      password: 'Password123!'
    }, adminCookie);
    if (valRes3.status !== 400) {
      throw new Error('Expected status 400 for duplicate username, got ' + valRes3.status);
    }
    console.log('✓ Blocked duplicate username registration.\n');

    // 4. Register a new real teacher with class assignments
    const testUsername = `macallin_tst_${Date.now()}`;
    console.log(`4. Registering a new teacher (${testUsername}) with multiple class assignments...`);
    const createRes = await request('POST', '/quran/teachers', {
      full_name: 'Macallin Yoonis Cabdullaahi',
      username: testUsername,
      password: 'Teacher@2026',
      phone: '+252615998877',
      email: `${testUsername}@mahad.edu`,
      is_active: true,
      group_ids: [1, 2] // Assigning to 2 classes
    }, adminCookie);

    if (createRes.status !== 201 || !createRes.body.success) {
      throw new Error('Teacher registration failed: ' + JSON.stringify(createRes.body));
    }
    const createdId = createRes.body.teacherId;
    console.log(`✓ Teacher registered successfully with ID: ${createdId}.\n`);

    // 5. Verify the new teacher appears in the list with classes
    console.log('5. Verifying teacher appears in database query and assigned classes...');
    const listRes2 = await request('GET', '/quran/teachers', null, adminCookie);
    const newTeacher = listRes2.body.data.find(t => t.id === createdId);
    if (!newTeacher) {
      throw new Error('New teacher not found in GET /api/quran/teachers');
    }
    if (newTeacher.classes.length !== 2) {
      throw new Error(`Expected 2 assigned classes, got ${newTeacher.classes.length}`);
    }
    console.log(`✓ Confirmed teacher: ${newTeacher.full_name}, active: ${newTeacher.is_active}, classes: [${newTeacher.classes.map(c => c.name).join(', ')}].\n`);

    // 6. Test login with the newly created teacher
    console.log('6. Verifying newly created teacher can log in...');
    const teacherLogin = await request('POST', '/auth/login', {
      username: testUsername,
      password: 'Teacher@2026'
    });
    if (teacherLogin.status !== 200 || !teacherLogin.body.success) {
      throw new Error('New teacher login failed: ' + JSON.stringify(teacherLogin.body));
    }
    const teacherCookie = extractCookie(teacherLogin.setCookie);
    console.log('✓ New teacher logged in successfully.\n');

    // 7. Verify teacher cannot perform admin actions (Authorization test)
    console.log('7. Verifying unauthorized access is rejected (Teacher role trying to register teacher)...');
    const unauthorizedRes = await request('POST', '/quran/teachers', {
      full_name: 'Unauthorized Teacher',
      username: 'unauth_teacher',
      password: 'Password123'
    }, teacherCookie);
    if (unauthorizedRes.status !== 403) {
      throw new Error('Expected 403 Forbidden for teacher role creating a teacher, got ' + unauthorizedRes.status);
    }
    console.log('✓ Teacher correctly forbidden from registering other teachers.\n');

    // 8. Edit Teacher and Change Class Assignments
    console.log('8. Editing teacher details and reassigning classes (removing class 1, keeping 2, adding 3)...');
    const updateRes = await request('PUT', `/quran/teachers/${createdId}`, {
      full_name: 'Macallin Yoonis Cabdullaahi (Updated)',
      phone: '+252615998800',
      email: `${testUsername}_updated@mahad.edu`,
      is_active: true,
      group_ids: [2, 3] // Changed assignments: now [2, 3]
    }, adminCookie);

    if (updateRes.status !== 200 || !updateRes.body.success) {
      throw new Error('Update failed: ' + JSON.stringify(updateRes.body));
    }

    const listRes3 = await request('GET', '/quran/teachers', null, adminCookie);
    const updatedTeacher = listRes3.body.data.find(t => t.id === createdId);
    if (updatedTeacher.full_name !== 'Macallin Yoonis Cabdullaahi (Updated)') {
      throw new Error('Full name did not update');
    }
    const updatedGids = updatedTeacher.classes.map(c => c.id).sort();
    if (JSON.stringify(updatedGids) !== JSON.stringify([2, 3])) {
      throw new Error(`Expected classes [2, 3], got ${JSON.stringify(updatedGids)}`);
    }
    console.log(`✓ Teacher successfully edited and reassigned to classes [${updatedTeacher.classes.map(c => c.name).join(', ')}].\n`);

    // 9. Deactivate Teacher & Verify login and active operations blocked
    console.log('9. Deactivating teacher and verifying backend enforcement...');
    const toggleDeactivate = await request('PATCH', `/quran/teachers/${createdId}/toggle-status`, null, adminCookie);
    if (toggleDeactivate.status !== 200 || toggleDeactivate.body.is_active !== 0) {
      throw new Error('Failed to deactivate teacher');
    }
    console.log('✓ Teacher status changed to Inactive (Xanniban).');

    // Login must fail for inactive teacher
    const loginInactive = await request('POST', '/auth/login', {
      username: testUsername,
      password: 'Teacher@2026'
    });
    if (loginInactive.status !== 403) {
      throw new Error('Expected 403 Forbidden when logging in with inactive account, got ' + loginInactive.status);
    }
    console.log('✓ Deactivated teacher login blocked with 403.');

    // Using old session must be rejected by requireAuth
    const oldSessionCall = await request('GET', '/quran/groups', null, teacherCookie);
    if (oldSessionCall.status !== 403) {
      throw new Error('Expected 403 for existing session of deactivated user, got ' + oldSessionCall.status);
    }
    console.log('✓ Deactivated teacher active session blocked with 403 by requireAuth.');

    // Reactivate teacher
    console.log('10. Reactivating teacher...');
    const toggleActivate = await request('PATCH', `/quran/teachers/${createdId}/toggle-status`, null, adminCookie);
    if (toggleActivate.status !== 200 || toggleActivate.body.is_active !== 1) {
      throw new Error('Failed to reactivate teacher');
    }
    console.log('✓ Teacher status changed to Active (Shaqaynaya).');

    // Verify login works again
    const loginReactivated = await request('POST', '/auth/login', {
      username: testUsername,
      password: 'Teacher@2026'
    });
    if (loginReactivated.status !== 200) {
      throw new Error('Reactivated teacher should be able to log in, got ' + loginReactivated.status);
    }
    console.log('✓ Reactivated teacher can log in again.\n');

    // 11. Safe Deletion Test:
    // First, test deletion on a teacher WITH historical records
    console.log('11. Testing safe deletion on teacher with historical records...');
    // Create a mock memorization progress record recorded by this teacher
    await query(`
      INSERT INTO quran_verse_memorization (student_id, surah_number, verse_number, is_memorized, memorized_date, recorded_by)
      VALUES (1, 1, 1, 1, '2026-10-19', ?)
      ON DUPLICATE KEY UPDATE recorded_by = VALUES(recorded_by)
    `, [createdId]);

    const delHistorical = await request('DELETE', `/quran/teachers/${createdId}`, null, adminCookie);
    if (delHistorical.status !== 200 || !delHistorical.body.archived) {
      throw new Error('Expected safe archive/deactivation response when historical records exist, got ' + JSON.stringify(delHistorical.body));
    }
    console.log(`✓ Safe protection triggered: "${delHistorical.body.message}"`);

    // Verify user is preserved in DB and set to is_active = 0
    const [preservedUser] = await query('SELECT * FROM users WHERE id = ?', [createdId]);
    if (!preservedUser || preservedUser.is_active !== 0) {
      throw new Error('User should still exist in database with is_active = 0');
    }
    console.log('✓ Historical student memorization preserved, teacher safely archived.');

    // Clean up mock memorization record so we can test clean deletion
    await query('DELETE FROM quran_verse_memorization WHERE recorded_by = ?', [createdId]);
    await query('DELETE FROM audit_logs WHERE user_id = ?', [createdId]);

    // Now test permanent delete on clean teacher without historical records
    console.log('12. Testing clean deletion on teacher without historical records...');
    const delClean = await request('DELETE', `/quran/teachers/${createdId}`, null, adminCookie);
    if (delClean.status !== 200 || !delClean.body.deleted) {
      throw new Error('Expected permanent deletion for teacher with no historical records, got ' + JSON.stringify(delClean.body));
    }
    console.log(`✓ Clean deletion successful: "${delClean.body.message}"`);

    const [deletedUser] = await query('SELECT * FROM users WHERE id = ?', [createdId]);
    if (deletedUser) {
      throw new Error('User should be completely deleted from users table');
    }
    console.log('✓ Confirmed user row removed from users table.\n');

    console.log('===============================================================');
    console.log('   ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! (100% VERIFIED)');
    console.log('===============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
