import mysql from 'mysql2/promise';

const BASE_URL = 'http://localhost:5000/api';

async function testSaveSchemeRule() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mahad_db'
  });

  const testYear = 'YEAR_' + Math.floor(Math.random() * 100000);

  try {
    console.log(`Testing 2-exam connected 40/60 rule for academic year ${testYear}...`);

    // 1. Log in as super admin
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'superadmin',
        password: 'Admin@12345'
      })
    });
    const rawCookie = loginRes.headers.get('set-cookie');
    const cookie = rawCookie ? rawCookie.split(';')[0] : '';

    // 2. Post rule with custom names
    const ruleRes = await fetch(`${BASE_URL}/exams/scheme-rule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        academic_year: testYear,
        pass_threshold: 50.0,
        exam1_name: 'Imtixaanka Niska Sanadka',
        exam2_name: 'Imtixaanka Kama-dambaysta ah'
      })
    });

    const ruleData = await ruleRes.json();
    console.log('Scheme Rule Response:', ruleData);
    if (!ruleData.success) {
      throw new Error(`Failed to save scheme rule: ${ruleData.error}`);
    }

    // 3. Verify database state: strictly 2 periods, 40 marks and 60 marks
    const [periods] = await conn.query('SELECT name, exam_type, max_contribution, sequence_order FROM exam_periods WHERE academic_year = ? ORDER BY sequence_order ASC', [testYear]);
    console.log('Saved exam periods in DB:', periods);
    if (periods.length !== 2) {
      throw new Error(`Expected strictly 2 periods, got ${periods.length}`);
    }
    if (parseFloat(periods[0].max_contribution) !== 40 || parseFloat(periods[1].max_contribution) !== 60) {
      throw new Error(`Periods marks do not match expected 40 and 60!`);
    }
    if (periods[0].name !== 'Imtixaanka Niska Sanadka' || periods[1].name !== 'Imtixaanka Kama-dambaysta ah') {
      throw new Error(`Period names do not match expected custom names!`);
    }

    // Check connected set
    const [sets] = await conn.query('SELECT s.id, s.name, count(m.id) as member_count, sum(m.maximum_marks) as total_marks FROM institute_exam_sets s JOIN institute_exam_set_members m ON m.exam_set_id = s.id WHERE s.academic_year = ? GROUP BY s.id', [testYear]);
    console.log('Saved exam set in DB:', sets);
    if (sets[0].member_count !== 2) {
      throw new Error(`Expected set member count of 2, got ${sets[0].member_count}`);
    }
    if (parseFloat(sets[0].total_marks) !== 100) {
      throw new Error(`Expected total marks 100, got ${sets[0].total_marks}`);
    }

    // 4. Update the names again
    const updateRes = await fetch(`${BASE_URL}/exams/scheme-rule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        academic_year: testYear,
        pass_threshold: 50.0,
        exam1_name: 'Imtixaanka Niska (Midterm)',
        exam2_name: 'Kama-Dambays (Final)'
      })
    });
    const updateData = await updateRes.json();
    console.log('Updated Scheme Rule Response:', updateData);
    if (!updateData.success) {
      throw new Error(`Failed to update scheme rule: ${updateData.error}`);
    }

    const [updatedPeriods] = await conn.query('SELECT name, max_contribution FROM exam_periods WHERE academic_year = ? ORDER BY sequence_order ASC', [testYear]);
    if (updatedPeriods[0].name !== 'Imtixaanka Niska (Midterm)' || updatedPeriods[1].name !== 'Kama-Dambays (Final)') {
      throw new Error(`Updated names do not match!`);
    }
    if (parseFloat(updatedPeriods[0].max_contribution) !== 40 || parseFloat(updatedPeriods[1].max_contribution) !== 60) {
      throw new Error(`Marks changed from 40/60!`);
    }

    console.log('=== STRICT 2-EXAM (40/60 = 100 MARKS) CONNECTED RULE VERIFIED SUCCESSFULLY! ===');
  } finally {
    // Cleanup
    await conn.query(`DELETE FROM institute_exam_set_members WHERE exam_set_id IN (SELECT id FROM institute_exam_sets WHERE academic_year = ?)`, [testYear]);
    await conn.query(`DELETE FROM institute_exam_sets WHERE academic_year = ?`, [testYear]);
    await conn.query(`DELETE FROM exam_periods WHERE academic_year = ?`, [testYear]);
    await conn.query(`DELETE FROM academic_year_assessment_configs WHERE academic_year = ?`, [testYear]);
    await conn.end();
  }
}

testSaveSchemeRule().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
