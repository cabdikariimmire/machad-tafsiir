import { query } from '../backend/src/db/connection.js';

async function migrate() {
  console.log('--- Migrating quran_groups shift column to support Subax, Galab, Subax iyo Galab ---');

  // 1. Alter shift column to VARCHAR(50)
  await query(`
    ALTER TABLE quran_groups MODIFY COLUMN shift VARCHAR(50) NOT NULL DEFAULT 'Subax'
  `);
  console.log('✓ Modified quran_groups.shift to VARCHAR(50)');

  // 2. Normalize legacy values
  await query(`UPDATE quran_groups SET shift = 'Subax' WHERE shift = 'morning'`);
  await query(`UPDATE quran_groups SET shift = 'Galab' WHERE shift = 'afternoon' OR shift = 'evening'`);
  console.log('✓ Normalized legacy shift values');

  // 3. Ensure quran_teacher_assignments has unique index on group_id to enforce 1 teacher per class
  // Check if unique index already exists
  const indexes = await query(`SHOW INDEX FROM quran_teacher_assignments WHERE Key_name = 'unique_group_teacher'`);
  if (indexes.length === 0) {
    try {
      // First clean up any duplicate assignments keeping latest
      await query(`
        DELETE t1 FROM quran_teacher_assignments t1
        INNER JOIN quran_teacher_assignments t2 
        WHERE t1.id < t2.id AND t1.group_id = t2.group_id
      `);
      await query(`
        ALTER TABLE quran_teacher_assignments 
        ADD UNIQUE KEY unique_group_teacher (group_id)
      `);
      console.log('✓ Added unique constraint unique_group_teacher on quran_teacher_assignments(group_id)');
    } catch (e) {
      console.log('Note on unique index:', e.message);
    }
  }

  console.log('--- Migration completed successfully ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
