import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function cleanMockData() {
  console.log('Connecting to database...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mahad_db',
    port: parseInt(process.env.DB_PORT || '3306', 10),
  });

  console.log('Starting mock data cleanup (transactions & sample students)...');

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const tablesToTruncate = [
      'exam_fee_payments',
      'payments',
      'payment_adjustments',
      'fee_invoices',
      'student_discounts',
      'institute_exam_marks',
      'institute_exams',
      'quran_exam_marks',
      'quran_exams',
      'institute_attendance',
      'institute_class_sessions',
      'quran_attendance',
      'quran_progress',
      'quran_sessions',
      'institute_enrollments',
      'quran_enrollments',
      'students',
      'notifications',
      'audit_logs'
    ];

    for (const table of tablesToTruncate) {
      process.stdout.write(`Truncating ${table}... `);
      await conn.query(`TRUNCATE TABLE \`${table}\``);
      console.log('DONE');
    }

    // Clean up test exam periods (keep standard 4)
    console.log('Cleaning test exam periods...');
    await conn.query('DELETE FROM exam_periods WHERE id > 4');
    
    // Clean up test exam fee rules (keep standard 4)
    console.log('Cleaning test exam fee rules...');
    await conn.query('DELETE FROM exam_fee_rules WHERE id > 4');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n=============================================');
    console.log(' Mock data cleanup completed successfully!');
    console.log('=============================================');
    console.log('Preserved core infrastructure:');
    console.log(' - Users & Roles (Administrative & Teacher logins)');
    console.log(' - Institute Classes, Subjects & Timetable');
    console.log(' - Quran Levels & Groups');
    console.log(' - Standard Fee Rules & Exam Fee Rules');
    console.log(' - Standard Exam Periods (Monthly 1, Midterm, Monthly 2, Final)');
    console.log('Cleared:');
    console.log(' - All sample students (students table is empty)');
    console.log(' - All enrollments, attendance, and exam marks');
    console.log(' - All fee invoices, payments, and exam fee payments');
    console.log(' - Audit logs and notifications');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await conn.end();
  }
}

cleanMockData();
