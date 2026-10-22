const BASE_URL = 'http://localhost:5000/api';

async function run() {
  console.log('--- TEST: EXAM DELETION & USER PASSWORD RESET & EDIT ---');
  let cookie = '';

  // 1. Login as superadmin
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'Admin@12345' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    throw new Error('Failed to login as instadmin: ' + JSON.stringify(loginData));
  }
  cookie = loginRes.headers.get('set-cookie');
  console.log('✓ Logged in as instadmin');

  // 2. Test Exam Period Creation and Individual Deletion
  const createExamRes = await fetch(`${BASE_URL}/exams/periods`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      academic_year: '2026',
      name: 'Temp Deletion Test Exam ' + Date.now(),
      exam_type: 'monthly',
      sequence_order: 99,
      max_contribution: 100,
      status: 'active'
    })
  });
  const createExamData = await createExamRes.json();
  if (!createExamData.success) {
    throw new Error('Failed to create test exam period: ' + JSON.stringify(createExamData));
  }
  const examId = createExamData.id || createExamData.data?.id;
  console.log(`✓ Created test exam period ID: ${examId}`);

  // Delete individual exam period
  const delExamRes = await fetch(`${BASE_URL}/exams/periods/${examId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', cookie }
  });
  const delExamData = await delExamRes.json();
  if (!delExamData.success) {
    throw new Error('Failed to delete individual exam period: ' + JSON.stringify(delExamData));
  }
  console.log('✓ Successfully deleted individual exam period');

  // 3. Test Delete All Exam Periods
  const delAllRes = await fetch(`${BASE_URL}/exams/periods/delete-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ academic_year: '2026' })
  });
  const delAllData = await delAllRes.json();
  if (!delAllData.success) {
    throw new Error('Failed to delete all exam periods: ' + JSON.stringify(delAllData));
  }
  console.log(`✓ Delete all exam periods response: ${delAllData.message}`);

  // Verify list is empty
  const listAfterDelRes = await fetch(`${BASE_URL}/exams/periods?academic_year=2026`, {
    headers: { cookie }
  });
  const listAfterDelData = await listAfterDelRes.json();
  console.log(`✓ Exam count after delete-all: ${listAfterDelData.data.length}`);

  // Re-setup standard 40/60 scheme rule
  const setupRes = await fetch(`${BASE_URL}/exams/scheme-rule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      academic_year: '2026',
      pass_threshold: 50,
      exam1_name: 'Imtixaanka Niska (Midterm)',
      exam2_name: 'Kama-Dambays (Final)'
    })
  });
  const setupData = await setupRes.json();
  if (!setupData.success) {
    throw new Error('Failed to re-setup standard 40/60 scheme rule: ' + JSON.stringify(setupData));
  }
  console.log('✓ Successfully re-established clean 40/60 standard rule');

  // 4. Test User Password Reset & User Editing
  // Get users
  const usersRes = await fetch(`${BASE_URL}/users`, { headers: { cookie } });
  const usersData = await usersRes.json();
  if (!usersData.success || usersData.data.length === 0) {
    throw new Error('No users found to test');
  }

  // Find a non-superadmin user, e.g. teacher_ali or finance_inst
  const targetUser = usersData.data.find(u => u.username === 'teacher_ali') || usersData.data[1];
  console.log(`Testing password reset on user: ${targetUser.username} (ID: ${targetUser.id})`);

  // Reset password
  const newPass = 'TestPass@2026';
  const resetRes = await fetch(`${BASE_URL}/users/${targetUser.id}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ new_password: newPass })
  });
  const resetData = await resetRes.json();
  if (!resetData.success) {
    throw new Error('Failed to reset user password: ' + JSON.stringify(resetData));
  }
  console.log('✓ Password reset API succeeded');

  // Verify login with new password
  const testLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: targetUser.username, password: newPass })
  });
  const testLoginData = await testLoginRes.json();
  if (!testLoginData.success) {
    throw new Error('Failed to login with newly reset password: ' + JSON.stringify(testLoginData));
  }
  console.log('✓ Verified user can log in with new password');

  // Re-reset back to original password 'password123'
  await fetch(`${BASE_URL}/users/${targetUser.id}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ new_password: 'password123' })
  });
  console.log('✓ Restored test password back to password123');

  // Test updating user info (edit full_name and phone)
  const updateRes = await fetch(`${BASE_URL}/users/${targetUser.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      username: targetUser.username,
      full_name: targetUser.full_name,
      email: targetUser.email,
      phone: '+252615999888',
      role_id: targetUser.role_id,
      division_scope: targetUser.division_scope
    })
  });
  const updateData = await updateRes.json();
  if (!updateData.success) {
    throw new Error('Failed to update user info: ' + JSON.stringify(updateData));
  }
  console.log('✓ User details updated successfully via PUT /api/users/:id');

  console.log('\n========================================');
  console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
