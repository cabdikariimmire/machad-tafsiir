import { query } from '../src/db/connection.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function login(username, password = 'Admin@12345') {
  const { response } = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) throw new Error(`Login failed for ${username}`);
  return response.headers.get('set-cookie').split(';')[0];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const suffix = Date.now();
  const academicYear = '2198';
  const otherYear = '2199';
  let classId;
  let studentId;
  let subjectOneId;
  let subjectTwoId;
  let midtermName;
  let finalName;
  let midtermId;
  let finalId;
  let examSetId;

  try {
    const cookie = await login('superadmin');
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };

    let result = await request('/institute/classes', {
      method: 'POST', headers,
      body: JSON.stringify({ class_name: `Configurable Exam Class ${suffix}`, academic_year: academicYear, progression_order: 9901 })
    });
    assert(result.body.success, `Class creation failed: ${JSON.stringify(result.body)}`);
    classId = result.body.id;

    for (const [name, code] of [[`Config Subject One ${suffix}`, `CES1${String(suffix).slice(-5)}`], [`Config Subject Two ${suffix}`, `CES2${String(suffix).slice(-5)}`]]) {
      result = await request('/institute/subjects', {
        method: 'POST', headers,
        body: JSON.stringify({ name, code })
      });
      assert(result.body.success, `Subject creation failed: ${JSON.stringify(result.body)}`);
      if (!subjectOneId) subjectOneId = result.body.id;
      else subjectTwoId = result.body.id;
    }

    result = await request(`/institute/classes/${classId}/subjects`, {
      method: 'POST', headers,
      body: JSON.stringify({ subject_ids: [subjectOneId, subjectTwoId] })
    });
    assert(result.body.success, `Subject assignment failed: ${JSON.stringify(result.body)}`);

    midtermName = `Configured Midterm ${suffix}`;
    finalName = `Configured Final ${suffix}`;
    for (const [name, type, max] of [[midtermName, 'midterm', 30], [finalName, 'final', 70]]) {
      result = await request('/exams/periods', {
        method: 'POST', headers,
        body: JSON.stringify({ name, academic_year: academicYear, exam_type: type, sequence_order: type === 'midterm' ? 1 : 2, max_contribution: max, status: 'active' })
      });
      assert(result.body.success, `Exam period creation failed: ${JSON.stringify(result.body)}`);
      if (type === 'midterm') midtermId = result.body.id;
      else finalId = result.body.id;
    }

    result = await request('/exams/exam-sets', {
      method: 'POST', headers,
      body: JSON.stringify({
        academic_year: academicYear,
        name: `Configurable Set ${suffix}`,
        description: 'Integration test set',
        members: [
          { exam_period_id: midtermId, sequence_order: 1, maximum_marks: 30, is_required: true },
          { exam_period_id: finalId, sequence_order: 2, maximum_marks: 70, is_required: true }
        ]
      })
    });
    assert(result.body.success, `Exam set save failed: ${JSON.stringify(result.body)}`);
    examSetId = result.body.id;

    result = await request(`/exams/exam-sets?academic_year=${academicYear}`, { headers: { Cookie: cookie } });
    assert(result.body.success && result.body.data.members.length === 2, `Exam set read failed: ${JSON.stringify(result.body)}`);
    assert(result.body.data.members.reduce((sum, member) => sum + Number(member.maximum_marks), 0) === 100, 'Configured combined maximum was not preserved.');

    result = await request('/students', {
      method: 'POST', headers,
      body: JSON.stringify({ full_name: `Configurable Exam Student ${suffix}`, gender: 'male', phone: `25263${String(suffix).slice(-7)}` })
    });
    assert(result.body.success, `Student creation failed: ${JSON.stringify(result.body)}`);
    studentId = result.body.student?.id || result.body.id;
    await query(`INSERT INTO institute_enrollments (student_id, class_id, enrollment_date, status) VALUES (?, ?, CURDATE(), 'active')`, [studentId, classId]);

    async function saveMark(period, subject, value) {
      const response = await request('/exams/single-mark', {
        method: 'POST', headers,
        body: JSON.stringify({ class_id: classId, exam_period: period, subject_id: subject, student_id: studentId, academic_year: academicYear, marks_obtained: value })
      });
      assert(response.body.success, `Mark save failed: ${JSON.stringify(response.body)}`);
    }

    await saveMark(midtermName, subjectOneId, 24);
    result = await request(`/exams/results/class?class_id=${classId}&academic_year=${academicYear}&exam_title=configured_midterm&exam_period_id=${midtermId}&exam_set_id=${examSetId}`, { headers: { Cookie: cookie } });
    assert(result.body.success && result.body.data.is_midterm_result, `Midterm result mode failed: ${JSON.stringify(result.body)}`);
    const midtermStudent = result.body.data.students.find(student => student.student_id === studentId);
    assert(midtermStudent?.subject_results?.[subjectOneId]?.combined_total === 24, 'Midterm mark was not preserved separately.');
    assert(midtermStudent.subject_results[subjectOneId].maximum_marks === 30, 'Midterm maximum did not use configuration.');

    await saveMark(finalName, subjectOneId, 55);
    result = await request(`/exams/results/class?class_id=${classId}&academic_year=${academicYear}&exam_title=final_combined&exam_set_id=${examSetId}`, { headers: { Cookie: cookie } });
    let finalStudent = result.body.data.students.find(student => student.student_id === studentId);
    assert(result.body.success && finalStudent.is_incomplete && finalStudent.total_obtained === null, 'Missing required subject marks were incorrectly treated as zero.');
    assert(finalStudent.subject_results[subjectOneId].combined_total === 79, 'Combined subject result was not calculated from the configured members.');

    await saveMark(midtermName, subjectTwoId, 25);
    await saveMark(finalName, subjectTwoId, 60);
    result = await request(`/exams/results/class?class_id=${classId}&academic_year=${academicYear}&exam_title=final_combined&exam_set_id=${examSetId}`, { headers: { Cookie: cookie } });
    finalStudent = result.body.data.students.find(student => student.student_id === studentId);
    assert(!finalStudent.is_incomplete && finalStudent.total_obtained === 164 && finalStudent.maximum_total === 200, `Complete combined result failed: ${JSON.stringify(finalStudent)}`);
    assert(finalStudent.average_percentage === 82, 'Combined average was not calculated from configured maximums.');

    await saveMark(finalName, subjectOneId, 50);
    result = await request(`/exams/results/class?class_id=${classId}&academic_year=${academicYear}&exam_title=final_combined`, { headers: { Cookie: cookie } });
    finalStudent = result.body.data.students.find(student => student.student_id === studentId);
    assert(finalStudent.total_obtained === 159 && finalStudent.average_percentage === 79.5, 'Corrected mark did not recalculate the combined result.');

    result = await request(`/exams/exam-sets?academic_year=${otherYear}`, { headers: { Cookie: cookie } });
    assert(result.body.success && result.body.data === null, 'Exam-set data leaked across academic years.');
    result = await request(`/exams/results/class?class_id=${classId}&academic_year=${otherYear}&exam_title=final_combined`, { headers: { Cookie: cookie } });
    assert(result.body.success && (!result.body.data?.students?.length || result.body.data.students.every(student => student.total_obtained === null)), 'Final results were not isolated by academic year.');

    console.log('✓ Configurable exam set, separate marks, combined final results, missing-mark validation, corrections, and year isolation passed');
  } finally {
    if (studentId) {
      await query(`DELETE FROM institute_exam_marks WHERE student_id = ?`, [studentId]);
      await query(`DELETE FROM institute_enrollments WHERE student_id = ?`, [studentId]);
      await query(`DELETE FROM students WHERE id = ?`, [studentId]);
    }
    if (classId) await query(`DELETE FROM institute_exams WHERE class_id = ?`, [classId]);
    if (examSetId) {
      await query(`DELETE FROM institute_exam_set_members WHERE exam_set_id = ?`, [examSetId]);
      await query(`DELETE FROM institute_exam_sets WHERE id = ?`, [examSetId]);
    }
    if (midtermId || finalId) await query(`DELETE FROM exam_periods WHERE id IN (?, ?)`, [midtermId || 0, finalId || 0]);
    if (classId) await query(`DELETE FROM institute_class_subjects WHERE class_id = ?`, [classId]);
    if (classId) await query(`DELETE FROM institute_classes WHERE id = ?`, [classId]);
    if (subjectOneId) await query(`DELETE FROM institute_subjects WHERE id = ?`, [subjectOneId]);
    if (subjectTwoId) await query(`DELETE FROM institute_subjects WHERE id = ?`, [subjectTwoId]);
  }
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
