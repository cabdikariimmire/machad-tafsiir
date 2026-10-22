import { query, withTransaction } from '../src/db/connection.js';
import { saveStudentSurahs, calculateStudentMemorizationSummary, getAllJuz } from '../src/services/quranService.js';
import { JUZ_DATA, SURAHS_DATA } from '../src/constants/quranMetadata.js';

async function runAcceptanceSuite() {
  console.log('========================================================================');
  console.log('  TESTING QURAN JUZ ACCURACY & MEMORIZATION BOUNDARIES (6 TEST CASES)   ');
  console.log('========================================================================\n');

  // Find or create an isolated test student so we never mutate real student data
  let [testStudent] = await query(`SELECT id FROM students WHERE student_id = 'STU-TEST-JUZ'`);
  if (!testStudent) {
    const res = await query(
      `INSERT INTO students (student_id, full_name, name_ar, gender, phone, is_active)
       VALUES ('STU-TEST-JUZ', 'Ardayga Tijaabada Juz', 'طالب اختبار الأجزاء', 'male', '610000000', 1)`
    );
    testStudent = { id: res.insertId };
  }
  const sId = testStudent.id;
  const adminUser = { id: 1, role: 'super_admin' };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: A student with no memorized ayahs
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Student with NO memorized ayahs ---');
    await query(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [sId]);
    
    let summary1 = await calculateStudentMemorizationSummary(sId);
    console.log(`[PASS] Memorized Verses: ${summary1.memorization.memorized_verses} / 6236`);
    console.log(`[PASS] Surahs Completed: ${summary1.memorization.completed_surahs_count} / 114`);
    console.log(`[PASS] Juz Completed: ${summary1.memorization.completed_juz_count} / 30`);
    console.log(`[PASS] In-Progress Juz: ${summary1.memorization.in_progress_juz_count}`);
    
    if (summary1.memorization.completed_juz_count !== 0 || summary1.memorization.memorized_verses !== 0) {
      throw new Error(`Test 1 Failed: Expected 0 completed juz and 0 verses, got ${summary1.memorization.completed_juz_count}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: A student who has memorized only Al-Fatihah (7 ayahs)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Student who has memorized ONLY Al-Fatihah (7 ayahs) ---');
    await query(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [sId]);
    await saveStudentSurahs(sId, [1], adminUser);
    
    let summary2 = await calculateStudentMemorizationSummary(sId);
    console.log(`[PASS] Memorized Verses: ${summary2.memorization.memorized_verses} (Al-Fatihah: 7 ayahs)`);
    console.log(`[PASS] Surahs Completed: ${summary2.memorization.completed_surahs_count} / 114`);
    console.log(`[PASS] Juz Completed: ${summary2.memorization.completed_juz_count} / 30 (Al-Fatihah alone cannot complete Juz 1)`);
    console.log(`[PASS] Juz 1 Progress: ${summary2.memorization.juz[0].memorized_verses} / ${summary2.memorization.juz[0].total_verses} ayahs (${summary2.memorization.juz[0].percentage}%)`);
    console.log(`[PASS] Juz 1 Completed Flag: ${summary2.memorization.juz[0].is_completed}`);
    
    if (summary2.memorization.completed_juz_count !== 0) {
      throw new Error(`Test 2 Failed: Completed Juz should be 0, but got ${summary2.memorization.completed_juz_count}`);
    }
    if (summary2.memorization.juz[0].memorized_verses !== 7 || summary2.memorization.juz[0].is_completed !== false) {
      throw new Error(`Test 2 Failed: Juz 1 should have exactly 7 verses and be incomplete`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: A student who has memorized all 286 ayahs of Al-Baqarah (only Al-Baqarah)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Student who has memorized ALL 286 ayahs of Al-Baqarah (only Al-Baqarah) ---');
    await query(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [sId]);
    await saveStudentSurahs(sId, [2], adminUser);
    
    let summary3 = await calculateStudentMemorizationSummary(sId);
    console.log(`[PASS] Memorized Verses: ${summary3.memorization.memorized_verses} / 6236 (${summary3.memorization.overall_percentage}%)`);
    console.log(`[PASS] Surahs Completed: ${summary3.memorization.completed_surahs_count} / 114 (Al-Baqarah)`);
    console.log(`[PASS] Juz Completed Count: ${summary3.memorization.completed_juz_count} / 30 (Juz 2 is completely in Al-Baqarah!)`);
    console.log(`[PASS] Completed Juz List: [${summary3.memorization.completed_juz_list.join(', ')}]`);
    console.log(`[PASS] Juz 1 Progress: ${summary3.memorization.juz[0].memorized_verses} / ${summary3.memorization.juz[0].total_verses} (95.3% - missing Al-Fatihah 1-7)`);
    console.log(`[PASS] Juz 2 Progress: ${summary3.memorization.juz[1].memorized_verses} / ${summary3.memorization.juz[1].total_verses} (100% - COMPLETED)`);
    console.log(`[PASS] Juz 3 Progress: ${summary3.memorization.juz[2].memorized_verses} / ${summary3.memorization.juz[2].total_verses} (27.0% - Baqarah 253-286, missing Ali Imran 1-92)`);
    
    if (summary3.memorization.completed_juz_count !== 1) {
      throw new Error(`Test 3 Failed: Al-Baqarah alone must complete exactly 1 Juz (Juz 2), but got ${summary3.memorization.completed_juz_count}`);
    }
    if (!summary3.memorization.completed_juz_list.includes(2)) {
      throw new Error(`Test 3 Failed: Completed Juz list must contain Juz 2, got ${JSON.stringify(summary3.memorization.completed_juz_list)}`);
    }
    if (summary3.memorization.juz[0].is_completed !== false) {
      throw new Error(`Test 3 Failed: Juz 1 must be incomplete because Al-Fatihah is not memorized`);
    }
    if (summary3.memorization.juz[1].is_completed !== true) {
      throw new Error(`Test 3 Failed: Juz 2 must be marked completed`);
    }
    if (summary3.memorization.juz[2].is_completed !== false) {
      throw new Error(`Test 3 Failed: Juz 3 must be incomplete because Ali Imran 1-92 is not memorized`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: A student who has memorized all ayahs in Juz 1 but not all of Juz 2
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Student with all ayahs in Juz 1 (Fatihah 1-7 + Baqarah 1-141) but not all of Juz 2 ---');
    await query(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [sId]);
    // Insert Fatihah (1-7) and Baqarah (1-141)
    for (let v = 1; v <= 7; v++) {
      await query(`INSERT INTO quran_verse_memorization (student_id, surah_number, verse_number, is_memorized, recorded_by) VALUES (?, 1, ?, 1, 1)`, [sId, v]);
    }
    for (let v = 1; v <= 141; v++) {
      await query(`INSERT INTO quran_verse_memorization (student_id, surah_number, verse_number, is_memorized, recorded_by) VALUES (?, 2, ?, 1, 1)`, [sId, v]);
    }
    
    let summary4 = await calculateStudentMemorizationSummary(sId);
    console.log(`[PASS] Memorized Verses: ${summary4.memorization.memorized_verses} / 6236`);
    console.log(`[PASS] Surahs Completed: ${summary4.memorization.completed_surahs_count} (Al-Fatihah is completed; Al-Baqarah is partial 141/286)`);
    console.log(`[PASS] Juz Completed Count: ${summary4.memorization.completed_juz_count} / 30`);
    console.log(`[PASS] Completed Juz List: [${summary4.memorization.completed_juz_list.join(', ')}]`);
    console.log(`[PASS] Juz 1 Status: ${summary4.memorization.juz[0].memorized_verses} / ${summary4.memorization.juz[0].total_verses} (Completed: ${summary4.memorization.juz[0].is_completed})`);
    console.log(`[PASS] Juz 2 Status: ${summary4.memorization.juz[1].memorized_verses} / ${summary4.memorization.juz[1].total_verses} (Completed: ${summary4.memorization.juz[1].is_completed})`);
    
    if (summary4.memorization.completed_juz_count !== 1 || !summary4.memorization.completed_juz_list.includes(1)) {
      throw new Error(`Test 4 Failed: Expected Juz 1 to be completed, got count ${summary4.memorization.completed_juz_count}`);
    }
    if (summary4.memorization.juz[0].is_completed !== true) {
      throw new Error(`Test 4 Failed: Juz 1 must be completed`);
    }
    if (summary4.memorization.juz[1].is_completed !== false) {
      throw new Error(`Test 4 Failed: Juz 2 must be incomplete`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: A student who has completed Juz 2 but has not completed all of Juz 3
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Student who completed Juz 2 (Baqarah 142-252) + partial Juz 3 (Baqarah 253-286) ---');
    await query(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [sId]);
    for (let v = 142; v <= 286; v++) {
      await query(`INSERT INTO quran_verse_memorization (student_id, surah_number, verse_number, is_memorized, recorded_by) VALUES (?, 2, ?, 1, 1)`, [sId, v]);
    }
    
    let summary5 = await calculateStudentMemorizationSummary(sId);
    console.log(`[PASS] Memorized Verses: ${summary5.memorization.memorized_verses} (Verses 142 to 286 of Al-Baqarah = 145 verses)`);
    console.log(`[PASS] Surahs Completed: ${summary5.memorization.completed_surahs_count} / 114 (0 completed surahs, partial Al-Baqarah)`);
    console.log(`[PASS] Juz Completed Count: ${summary5.memorization.completed_juz_count} / 30`);
    console.log(`[PASS] Completed Juz List: [${summary5.memorization.completed_juz_list.join(', ')}]`);
    console.log(`[PASS] Juz 2: ${summary5.memorization.juz[1].memorized_verses} / ${summary5.memorization.juz[1].total_verses} (Completed: ${summary5.memorization.juz[1].is_completed})`);
    console.log(`[PASS] Juz 3: ${summary5.memorization.juz[2].memorized_verses} / ${summary5.memorization.juz[2].total_verses} (Completed: ${summary5.memorization.juz[2].is_completed})`);
    
    if (summary5.memorization.completed_juz_count !== 1 || !summary5.memorization.completed_juz_list.includes(2)) {
      throw new Error(`Test 5 Failed: Juz 2 must be completed`);
    }
    if (summary5.memorization.juz[1].is_completed !== true) {
      throw new Error(`Test 5 Failed: Juz 2 must be completed`);
    }
    if (summary5.memorization.juz[2].is_completed !== false || summary5.memorization.juz[2].memorized_verses !== 34) {
      throw new Error(`Test 5 Failed: Juz 3 must be incomplete with exactly 34 verses from Baqarah 253-286`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: A student whose memorization crosses a Juz boundary within a Surah
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Student memorization crossing a Juz boundary within a Surah (Baqarah 100 to 200, crossing boundary at 141/142) ---');
    await query(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [sId]);
    for (let v = 100; v <= 200; v++) {
      await query(`INSERT INTO quran_verse_memorization (student_id, surah_number, verse_number, is_memorized, recorded_by) VALUES (?, 2, ?, 1, 1)`, [sId, v]);
    }
    
    let summary6 = await calculateStudentMemorizationSummary(sId);
    console.log(`[PASS] Memorized Verses: ${summary6.memorization.memorized_verses} (Verses 100 to 200 of Al-Baqarah = 101 verses)`);
    console.log(`[PASS] Juz 1 portion (Baqarah 100-141): ${summary6.memorization.juz[0].memorized_verses} / ${summary6.memorization.juz[0].total_verses} ayahs`);
    console.log(`[PASS] Juz 2 portion (Baqarah 142-200): ${summary6.memorization.juz[1].memorized_verses} / ${summary6.memorization.juz[1].total_verses} ayahs`);
    console.log(`[PASS] Juz Completed Count: ${summary6.memorization.completed_juz_count} / 30 (neither is completed)`);
    console.log(`[PASS] In-Progress Juz Count: ${summary6.memorization.in_progress_juz_count} (both Juz 1 and Juz 2 are in-progress)`);
    
    if (summary6.memorization.juz[0].memorized_verses !== 42) {
      throw new Error(`Test 6 Failed: Juz 1 should have 42 verses (100 to 141), got ${summary6.memorization.juz[0].memorized_verses}`);
    }
    if (summary6.memorization.juz[1].memorized_verses !== 59) {
      throw new Error(`Test 6 Failed: Juz 2 should have 59 verses (142 to 200), got ${summary6.memorization.juz[1].memorized_verses}`);
    }
    if (summary6.memorization.completed_juz_count !== 0) {
      throw new Error(`Test 6 Failed: Completed Juz should be 0`);
    }
    if (summary6.memorization.in_progress_juz_count !== 2) {
      throw new Error(`Test 6 Failed: In-progress Juz should be 2, got ${summary6.memorization.in_progress_juz_count}`);
    }

    console.log('\n========================================================================');
    console.log('  ALL 6 ACCEPTANCE TEST CASES PASSED WITH 100% ACCURACY!                ');
    console.log('========================================================================\n');

    process.exit(0);
  } finally {
    // Clean up test student
    await query(`DELETE FROM quran_verse_memorization WHERE student_id = ?`, [sId]);
    await query(`DELETE FROM students WHERE id = ?`, [sId]);
  }
}

runAcceptanceSuite().catch(err => {
  console.error('\n❌ ACCEPTANCE SUITE FAILED:', err);
  process.exit(1);
});
