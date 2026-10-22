import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function cleanAcademicMock() {
  console.log('Connecting to database...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mahad_db',
    port: parseInt(process.env.DB_PORT || '3306', 10),
  });

  try {
    console.log('Cleaning Institute Academic mock data...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    console.log('Truncating institute_timetable...');
    await conn.query('TRUNCATE TABLE institute_timetable');

    console.log('Truncating institute_class_subjects...');
    await conn.query('TRUNCATE TABLE institute_class_subjects');

    console.log('Truncating institute_teacher_assignments...');
    await conn.query('TRUNCATE TABLE institute_teacher_assignments');

    console.log('Truncating institute_classes...');
    await conn.query('TRUNCATE TABLE institute_classes');

    console.log('Truncating institute_subjects...');
    await conn.query('TRUNCATE TABLE institute_subjects');

    console.log('Removing institute class fee rules...');
    await conn.query("DELETE FROM fee_rules WHERE division = 'institute' OR class_id IS NOT NULL");

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const [[cls]] = await conn.query('SELECT COUNT(*) as cnt FROM institute_classes');
    const [[sub]] = await conn.query('SELECT COUNT(*) as cnt FROM institute_subjects');
    const [[tt]] = await conn.query('SELECT COUNT(*) as cnt FROM institute_timetable');

    console.log('\n=============================================');
    console.log(' Institute Academic mock data cleaned!');
    console.log('=============================================');
    console.log(`Classes count:   ${cls.cnt}`);
    console.log(`Subjects count:  ${sub.cnt}`);
    console.log(`Timetable count: ${tt.cnt}`);
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await conn.end();
  }
}

cleanAcademicMock();
