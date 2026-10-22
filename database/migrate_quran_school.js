import { query } from '../backend/src/db/connection.js';

// Verified 114 Surahs dataset
export const SURAHS_DATA = [
  { number: 1, name_ar: 'الفاتحة', name_en: 'Al-Fatihah', total_verses: 7, revelation_type: 'Meccan' },
  { number: 2, name_ar: 'البقرة', name_en: 'Al-Baqarah', total_verses: 286, revelation_type: 'Medinan' },
  { number: 3, name_ar: 'آل عمران', name_en: 'Ali \'Imran', total_verses: 200, revelation_type: 'Medinan' },
  { number: 4, name_ar: 'النساء', name_en: 'An-Nisa', total_verses: 176, revelation_type: 'Medinan' },
  { number: 5, name_ar: 'المائدة', name_en: 'Al-Ma\'idah', total_verses: 120, revelation_type: 'Medinan' },
  { number: 6, name_ar: 'الأنعام', name_en: 'Al-An\'am', total_verses: 165, revelation_type: 'Meccan' },
  { number: 7, name_ar: 'الأعراف', name_en: 'Al-A\'raf', total_verses: 206, revelation_type: 'Meccan' },
  { number: 8, name_ar: 'الأنفال', name_en: 'Al-Anfal', total_verses: 75, revelation_type: 'Medinan' },
  { number: 9, name_ar: 'التوبة', name_en: 'At-Tawbah', total_verses: 129, revelation_type: 'Medinan' },
  { number: 10, name_ar: 'يونس', name_en: 'Yunus', total_verses: 109, revelation_type: 'Meccan' },
  { number: 11, name_ar: 'هود', name_en: 'Hud', total_verses: 123, revelation_type: 'Meccan' },
  { number: 12, name_ar: 'يوسف', name_en: 'Yusuf', total_verses: 111, revelation_type: 'Meccan' },
  { number: 13, name_ar: 'الرعد', name_en: 'Ar-Ra\'d', total_verses: 43, revelation_type: 'Medinan' },
  { number: 14, name_ar: 'إبراهيم', name_en: 'Ibrahim', total_verses: 52, revelation_type: 'Meccan' },
  { number: 15, name_ar: 'الحجر', name_en: 'Al-Hijr', total_verses: 99, revelation_type: 'Meccan' },
  { number: 16, name_ar: 'النحل', name_en: 'An-Nahl', total_verses: 128, revelation_type: 'Meccan' },
  { number: 17, name_ar: 'الإسراء', name_en: 'Al-Isra', total_verses: 111, revelation_type: 'Meccan' },
  { number: 18, name_ar: 'الكهف', name_en: 'Al-Kahf', total_verses: 110, revelation_type: 'Meccan' },
  { number: 19, name_ar: 'مريم', name_en: 'Maryam', total_verses: 98, revelation_type: 'Meccan' },
  { number: 20, name_ar: 'طه', name_en: 'Ta-Ha', total_verses: 135, revelation_type: 'Meccan' },
  { number: 21, name_ar: 'الأنبياء', name_en: 'Al-Anbiya', total_verses: 112, revelation_type: 'Meccan' },
  { number: 22, name_ar: 'الحج', name_en: 'Al-Hajj', total_verses: 78, revelation_type: 'Medinan' },
  { number: 23, name_ar: 'المؤمنون', name_en: 'Al-Mu\'minun', total_verses: 118, revelation_type: 'Meccan' },
  { number: 24, name_ar: 'النور', name_en: 'An-Nur', total_verses: 64, revelation_type: 'Medinan' },
  { number: 25, name_ar: 'الفرقان', name_en: 'Al-Furqan', total_verses: 77, revelation_type: 'Meccan' },
  { number: 26, name_ar: 'الشعراء', name_en: 'Ash-Shu\'ara', total_verses: 227, revelation_type: 'Meccan' },
  { number: 27, name_ar: 'النمل', name_en: 'An-Naml', total_verses: 93, revelation_type: 'Meccan' },
  { number: 28, name_ar: 'القصص', name_en: 'Al-Qasas', total_verses: 88, revelation_type: 'Meccan' },
  { number: 29, name_ar: 'العنكبوت', name_en: 'Al-\'Ankabut', total_verses: 69, revelation_type: 'Meccan' },
  { number: 30, name_ar: 'الروم', name_en: 'Ar-Rum', total_verses: 60, revelation_type: 'Meccan' },
  { number: 31, name_ar: 'لقمان', name_en: 'Luqman', total_verses: 34, revelation_type: 'Meccan' },
  { number: 32, name_ar: 'السجدة', name_en: 'As-Sajdah', total_verses: 30, revelation_type: 'Meccan' },
  { number: 33, name_ar: 'الأحزاب', name_en: 'Al-Ahzab', total_verses: 73, revelation_type: 'Medinan' },
  { number: 34, name_ar: 'سبأ', name_en: 'Saba', total_verses: 54, revelation_type: 'Meccan' },
  { number: 35, name_ar: 'فاطر', name_en: 'Fatir', total_verses: 45, revelation_type: 'Meccan' },
  { number: 36, name_ar: 'يس', name_en: 'Ya-Sin', total_verses: 83, revelation_type: 'Meccan' },
  { number: 37, name_ar: 'الصافات', name_en: 'As-Saffat', total_verses: 182, revelation_type: 'Meccan' },
  { number: 38, name_ar: 'ص', name_en: 'Sad', total_verses: 88, revelation_type: 'Meccan' },
  { number: 39, name_ar: 'الزمر', name_en: 'Az-Zumar', total_verses: 75, revelation_type: 'Meccan' },
  { number: 40, name_ar: 'غافر', name_en: 'Ghafir', total_verses: 85, revelation_type: 'Meccan' },
  { number: 41, name_ar: 'فصلت', name_en: 'Fussilat', total_verses: 54, revelation_type: 'Meccan' },
  { number: 42, name_ar: 'الشورى', name_en: 'Ash-Shura', total_verses: 53, revelation_type: 'Meccan' },
  { number: 43, name_ar: 'الزخرف', name_en: 'Az-Zukhruf', total_verses: 89, revelation_type: 'Meccan' },
  { number: 44, name_ar: 'الدخان', name_en: 'Ad-Dukhan', total_verses: 59, revelation_type: 'Meccan' },
  { number: 45, name_ar: 'الجاثية', name_en: 'Al-Jathiyah', total_verses: 37, revelation_type: 'Meccan' },
  { number: 46, name_ar: 'الأحقاف', name_en: 'Al-Ahqaf', total_verses: 35, revelation_type: 'Meccan' },
  { number: 47, name_ar: 'محمد', name_en: 'Muhammad', total_verses: 38, revelation_type: 'Medinan' },
  { number: 48, name_ar: 'الفتح', name_en: 'Al-Fath', total_verses: 29, revelation_type: 'Medinan' },
  { number: 49, name_ar: 'الحجرات', name_en: 'Al-Hujurat', total_verses: 18, revelation_type: 'Medinan' },
  { number: 50, name_ar: 'ق', name_en: 'Qaf', total_verses: 45, revelation_type: 'Meccan' },
  { number: 51, name_ar: 'الذاريات', name_en: 'Adh-Dhariyat', total_verses: 60, revelation_type: 'Meccan' },
  { number: 52, name_ar: 'الطور', name_en: 'At-Tur', total_verses: 49, revelation_type: 'Meccan' },
  { number: 53, name_ar: 'النجم', name_en: 'An-Najm', total_verses: 62, revelation_type: 'Meccan' },
  { number: 54, name_ar: 'القمر', name_en: 'Al-Qamar', total_verses: 55, revelation_type: 'Meccan' },
  { number: 55, name_ar: 'الرحمن', name_en: 'Ar-Rahman', total_verses: 78, revelation_type: 'Medinan' },
  { number: 56, name_ar: 'الواقعة', name_en: 'Al-Waqi\'ah', total_verses: 96, revelation_type: 'Meccan' },
  { number: 57, name_ar: 'الحديد', name_en: 'Al-Hadid', total_verses: 29, revelation_type: 'Medinan' },
  { number: 58, name_ar: 'المجادلة', name_en: 'Al-Mujadilah', total_verses: 22, revelation_type: 'Medinan' },
  { number: 59, name_ar: 'الحشر', name_en: 'Al-Hashr', total_verses: 24, revelation_type: 'Medinan' },
  { number: 60, name_ar: 'الممتحنة', name_en: 'Al-Mumtahanah', total_verses: 13, revelation_type: 'Medinan' },
  { number: 61, name_ar: 'الصف', name_en: 'As-Saff', total_verses: 14, revelation_type: 'Medinan' },
  { number: 62, name_ar: 'الجمعة', name_en: 'Al-Jumu\'ah', total_verses: 11, revelation_type: 'Medinan' },
  { number: 63, name_ar: 'المنافقون', name_en: 'Al-Munafiqun', total_verses: 11, revelation_type: 'Medinan' },
  { number: 64, name_ar: 'التغابن', name_en: 'At-Taghabun', total_verses: 18, revelation_type: 'Medinan' },
  { number: 65, name_ar: 'الطلاق', name_en: 'At-Talaq', total_verses: 12, revelation_type: 'Medinan' },
  { number: 66, name_ar: 'التحريم', name_en: 'At-Tahrim', total_verses: 12, revelation_type: 'Medinan' },
  { number: 67, name_ar: 'الملك', name_en: 'Al-Mulk', total_verses: 30, revelation_type: 'Meccan' },
  { number: 68, name_ar: 'القلم', name_en: 'Al-Qalam', total_verses: 52, revelation_type: 'Meccan' },
  { number: 69, name_ar: 'الحاقة', name_en: 'Al-Haqqah', total_verses: 52, revelation_type: 'Meccan' },
  { number: 70, name_ar: 'المعارج', name_en: 'Al-Ma\'arij', total_verses: 44, revelation_type: 'Meccan' },
  { number: 71, name_ar: 'نوح', name_en: 'Nuh', total_verses: 28, revelation_type: 'Meccan' },
  { number: 72, name_ar: 'الجن', name_en: 'Al-Jinn', total_verses: 28, revelation_type: 'Meccan' },
  { number: 73, name_ar: 'المزمل', name_en: 'Al-Muzzammil', total_verses: 20, revelation_type: 'Meccan' },
  { number: 74, name_ar: 'المدثر', name_en: 'Al-Muddaththir', total_verses: 56, revelation_type: 'Meccan' },
  { number: 75, name_ar: 'القيامة', name_en: 'Al-Qiyamah', total_verses: 40, revelation_type: 'Meccan' },
  { number: 76, name_ar: 'الإنسان', name_en: 'Al-Insan', total_verses: 31, revelation_type: 'Medinan' },
  { number: 77, name_ar: 'المرسلات', name_en: 'Al-Mursalat', total_verses: 50, revelation_type: 'Meccan' },
  { number: 78, name_ar: 'النبأ', name_en: 'An-Naba', total_verses: 40, revelation_type: 'Meccan' },
  { number: 79, name_ar: 'النازعات', name_en: 'An-Nazi\'at', total_verses: 46, revelation_type: 'Meccan' },
  { number: 80, name_ar: 'عبس', name_en: '\'Abasa', total_verses: 42, revelation_type: 'Meccan' },
  { number: 81, name_ar: 'التكوير', name_en: 'At-Takwir', total_verses: 29, revelation_type: 'Meccan' },
  { number: 82, name_ar: 'الانفطار', name_en: 'Al-Infitar', total_verses: 19, revelation_type: 'Meccan' },
  { number: 83, name_ar: 'المطففين', name_en: 'Al-Mutaffifin', total_verses: 36, revelation_type: 'Meccan' },
  { number: 84, name_ar: 'الانشقاق', name_en: 'Al-Inshiqaq', total_verses: 25, revelation_type: 'Meccan' },
  { number: 85, name_ar: 'البروج', name_en: 'Al-Buruj', total_verses: 22, revelation_type: 'Meccan' },
  { number: 86, name_ar: 'الطارق', name_en: 'At-Tariq', total_verses: 17, revelation_type: 'Meccan' },
  { number: 87, name_ar: 'الأعلى', name_en: 'Al-A\'la', total_verses: 19, revelation_type: 'Meccan' },
  { number: 88, name_ar: 'الغاشية', name_en: 'Al-Ghashiyah', total_verses: 26, revelation_type: 'Meccan' },
  { number: 89, name_ar: 'الفجر', name_en: 'Al-Fajr', total_verses: 30, revelation_type: 'Meccan' },
  { number: 90, name_ar: 'البلد', name_en: 'Al-Balad', total_verses: 20, revelation_type: 'Meccan' },
  { number: 91, name_ar: 'الشمس', name_en: 'Ash-Shams', total_verses: 15, revelation_type: 'Meccan' },
  { number: 92, name_ar: 'الليل', name_en: 'Al-Layl', total_verses: 21, revelation_type: 'Meccan' },
  { number: 93, name_ar: 'الضحى', name_en: 'Ad-Duha', total_verses: 11, revelation_type: 'Meccan' },
  { number: 94, name_ar: 'الشرح', name_en: 'Ash-Sharh', total_verses: 8, revelation_type: 'Meccan' },
  { number: 95, name_ar: 'التين', name_en: 'At-Tin', total_verses: 8, revelation_type: 'Meccan' },
  { number: 96, name_ar: 'العلق', name_en: 'Al-\'Alaq', total_verses: 19, revelation_type: 'Meccan' },
  { number: 97, name_ar: 'القدر', name_en: 'Al-Qadr', total_verses: 5, revelation_type: 'Meccan' },
  { number: 98, name_ar: 'البينة', name_en: 'Al-Bayyinah', total_verses: 8, revelation_type: 'Medinan' },
  { number: 99, name_ar: 'الزلزلة', name_en: 'Az-Zalzalah', total_verses: 8, revelation_type: 'Medinan' },
  { number: 100, name_ar: 'العاديات', name_en: 'Al-\'Adiyat', total_verses: 11, revelation_type: 'Meccan' },
  { number: 101, name_ar: 'القارعة', name_en: 'Al-Qari\'ah', total_verses: 11, revelation_type: 'Meccan' },
  { number: 102, name_ar: 'التكاثر', name_en: 'At-Takathur', total_verses: 8, revelation_type: 'Meccan' },
  { number: 103, name_ar: 'العصر', name_en: 'Al-\'Asr', total_verses: 3, revelation_type: 'Meccan' },
  { number: 104, name_ar: 'الهمزة', name_en: 'Al-Humazah', total_verses: 9, revelation_type: 'Meccan' },
  { number: 105, name_ar: 'الفيل', name_en: 'Al-Fil', total_verses: 5, revelation_type: 'Meccan' },
  { number: 106, name_ar: 'قريش', name_en: 'Quraysh', total_verses: 4, revelation_type: 'Meccan' },
  { number: 107, name_ar: 'الماعون', name_en: 'Al-Ma\'un', total_verses: 7, revelation_type: 'Meccan' },
  { number: 108, name_ar: 'الكوثر', name_en: 'Al-Kawthar', total_verses: 3, revelation_type: 'Meccan' },
  { number: 109, name_ar: 'الكافرون', name_en: 'Al-Kafirun', total_verses: 6, revelation_type: 'Meccan' },
  { number: 110, name_ar: 'النصر', name_en: 'An-Nasr', total_verses: 3, revelation_type: 'Medinan' },
  { number: 111, name_ar: 'المسد', name_en: 'Al-Masad', total_verses: 5, revelation_type: 'Meccan' },
  { number: 112, name_ar: 'الإخلاص', name_en: 'Al-Ikhlas', total_verses: 4, revelation_type: 'Meccan' },
  { number: 113, name_ar: 'الفلق', name_en: 'Al-Falaq', total_verses: 5, revelation_type: 'Meccan' },
  { number: 114, name_ar: 'الناس', name_en: 'An-Nas', total_verses: 6, revelation_type: 'Meccan' }
];

// Verified 30 Juz boundaries in Medina Mushaf
export const JUZ_DATA = [
  { juz_number: 1, name_ar: 'الجزء الأول', start_surah: 1, start_verse: 1, end_surah: 2, end_verse: 141, total_verses: 148 },
  { juz_number: 2, name_ar: 'الجزء الثاني', start_surah: 2, start_verse: 142, end_surah: 2, end_verse: 252, total_verses: 111 },
  { juz_number: 3, name_ar: 'الجزء الثالث', start_surah: 2, start_verse: 253, end_surah: 3, end_verse: 92, total_verses: 126 },
  { juz_number: 4, name_ar: 'الجزء الرابع', start_surah: 3, start_verse: 93, end_surah: 4, end_verse: 23, total_verses: 131 },
  { juz_number: 5, name_ar: 'الجزء الخامس', start_surah: 4, start_verse: 24, end_surah: 4, end_verse: 147, total_verses: 124 },
  { juz_number: 6, name_ar: 'الجزء السادس', start_surah: 4, start_verse: 148, end_surah: 5, end_verse: 81, total_verses: 110 },
  { juz_number: 7, name_ar: 'الجزء السابع', start_surah: 5, start_verse: 82, end_surah: 6, end_verse: 110, total_verses: 149 },
  { juz_number: 8, name_ar: 'الجزء الثامن', start_surah: 6, start_verse: 111, end_surah: 7, end_verse: 87, total_verses: 142 },
  { juz_number: 9, name_ar: 'الجزء التاسع', start_surah: 7, start_verse: 88, end_surah: 8, end_verse: 40, total_verses: 159 },
  { juz_number: 10, name_ar: 'الجزء العاشر', start_surah: 8, start_verse: 41, end_surah: 9, end_verse: 92, total_verses: 127 },
  { juz_number: 11, name_ar: 'الجزء الحادي عشر', start_surah: 9, start_verse: 93, end_surah: 11, end_verse: 5, total_verses: 151 },
  { juz_number: 12, name_ar: 'الجزء الثاني عشر', start_surah: 11, start_verse: 6, end_surah: 12, end_verse: 52, total_verses: 170 },
  { juz_number: 13, name_ar: 'الجزء الثالث عشر', start_surah: 12, start_verse: 53, end_surah: 14, end_verse: 52, total_verses: 154 },
  { juz_number: 14, name_ar: 'الجزء الرابع عشر', start_surah: 15, start_verse: 1, end_surah: 16, end_verse: 128, total_verses: 227 },
  { juz_number: 15, name_ar: 'الجزء الخامس عشر', start_surah: 17, start_verse: 1, end_surah: 18, end_verse: 74, total_verses: 185 },
  { juz_number: 16, name_ar: 'الجزء السادس عشر', start_surah: 18, start_verse: 75, end_surah: 20, end_verse: 135, total_verses: 269 },
  { juz_number: 17, name_ar: 'الجزء السابع عشر', start_surah: 21, start_verse: 1, end_surah: 22, end_verse: 78, total_verses: 190 },
  { juz_number: 18, name_ar: 'الجزء الثامن عشر', start_surah: 23, start_verse: 1, end_surah: 25, end_verse: 20, total_verses: 202 },
  { juz_number: 19, name_ar: 'الجزء التاسع عشر', start_surah: 25, start_verse: 21, end_surah: 27, end_verse: 55, total_verses: 339 },
  { juz_number: 20, name_ar: 'الجزء العشرون', start_surah: 27, start_verse: 56, end_surah: 29, end_verse: 45, total_verses: 171 },
  { juz_number: 21, name_ar: 'الجزء الحادي والعشرون', start_surah: 29, start_verse: 46, end_surah: 33, end_verse: 30, total_verses: 178 },
  { juz_number: 22, name_ar: 'الجزء الثاني والعشرون', start_surah: 33, start_verse: 31, end_surah: 36, end_verse: 27, total_verses: 169 },
  { juz_number: 23, name_ar: 'الجزء الثالث والعشرون', start_surah: 36, start_verse: 28, end_surah: 39, end_verse: 31, total_verses: 357 },
  { juz_number: 24, name_ar: 'الجزء الرابع والعشرون', start_surah: 39, start_verse: 32, end_surah: 41, end_verse: 46, total_verses: 175 },
  { juz_number: 25, name_ar: 'الجزء الخامس والعشرون', start_surah: 41, start_verse: 47, end_surah: 45, end_verse: 37, total_verses: 246 },
  { juz_number: 26, name_ar: 'الجزء السادس والعشرون', start_surah: 46, start_verse: 1, end_surah: 51, end_verse: 30, total_verses: 195 },
  { juz_number: 27, name_ar: 'الجزء السابع والعشرون', start_surah: 51, start_verse: 31, end_surah: 57, end_verse: 29, total_verses: 399 },
  { juz_number: 28, name_ar: 'الجزء الثامن والعشرون', start_surah: 58, start_verse: 1, end_surah: 66, end_verse: 12, total_verses: 137 },
  { juz_number: 29, name_ar: 'الجزء التاسع والعشرون', start_surah: 67, start_verse: 1, end_surah: 77, end_verse: 50, total_verses: 431 },
  { juz_number: 30, name_ar: 'الجزء الثلاثون', start_surah: 78, start_verse: 1, end_surah: 114, end_verse: 6, total_verses: 564 }
];

async function migrate() {
  console.log('--- STARTING QURAN SCHOOL DATABASE MIGRATION ---');

  // 1. Add name_ar to students table
  try {
    await query(`ALTER TABLE students ADD COLUMN name_ar VARCHAR(150) NULL AFTER full_name`);
    console.log('✓ 1. Added name_ar to students table');
  } catch (e) {
    if (e.message.includes('Duplicate column') || e.code === 'ER_DUP_FIELDNAME') {
      console.log('✓ 1. Column name_ar already exists in students table');
    } else {
      throw e;
    }
  }

  // 2. Create quran_surahs table
  await query(`
    CREATE TABLE IF NOT EXISTS quran_surahs (
      number INT PRIMARY KEY,
      name_ar VARCHAR(100) NOT NULL,
      name_en VARCHAR(100) NOT NULL,
      total_verses INT NOT NULL,
      revelation_type ENUM('Meccan', 'Medinan') NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ 2. Table quran_surahs ready');

  // Seed quran_surahs
  for (const s of SURAHS_DATA) {
    await query(`
      INSERT INTO quran_surahs (number, name_ar, name_en, total_verses, revelation_type)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        name_ar = VALUES(name_ar),
        name_en = VALUES(name_en),
        total_verses = VALUES(total_verses),
        revelation_type = VALUES(revelation_type)
    `, [s.number, s.name_ar, s.name_en, s.total_verses, s.revelation_type]);
  }
  console.log(`✓ 2b. Seeded all ${SURAHS_DATA.length} Surahs in quran_surahs`);

  // 3. Create quran_juz table
  await query(`
    CREATE TABLE IF NOT EXISTS quran_juz (
      juz_number INT PRIMARY KEY,
      name_ar VARCHAR(100) NOT NULL,
      start_surah INT NOT NULL,
      start_verse INT NOT NULL,
      end_surah INT NOT NULL,
      end_verse INT NOT NULL,
      total_verses INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ 3. Table quran_juz ready');

  // Seed quran_juz
  for (const j of JUZ_DATA) {
    await query(`
      INSERT INTO quran_juz (juz_number, name_ar, start_surah, start_verse, end_surah, end_verse, total_verses)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name_ar = VALUES(name_ar),
        start_surah = VALUES(start_surah),
        start_verse = VALUES(start_verse),
        end_surah = VALUES(end_surah),
        end_verse = VALUES(end_verse),
        total_verses = VALUES(total_verses)
    `, [j.juz_number, j.name_ar, j.start_surah, j.start_verse, j.end_surah, j.end_verse, j.total_verses]);
  }
  console.log(`✓ 3b. Seeded all ${JUZ_DATA.length} Juz in quran_juz`);

  // 4. Create quran_verse_memorization table
  await query(`
    CREATE TABLE IF NOT EXISTS quran_verse_memorization (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      surah_number INT NOT NULL,
      verse_number INT NOT NULL,
      is_memorized BOOLEAN NOT NULL DEFAULT TRUE,
      memorized_date DATE NOT NULL,
      recorded_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (surah_number) REFERENCES quran_surahs(number) ON DELETE RESTRICT,
      FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
      UNIQUE KEY uk_stu_surah_verse (student_id, surah_number, verse_number),
      INDEX idx_stu_surah (student_id, surah_number),
      INDEX idx_stu_memorized (student_id, is_memorized)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ 4. Table quran_verse_memorization ready');

  // 5. Create quran_student_examinations table
  await query(`
    CREATE TABLE IF NOT EXISTS quran_student_examinations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      group_id INT NULL,
      exam_date DATE NOT NULL,
      start_juz INT NOT NULL,
      end_juz INT NOT NULL,
      examiner_name VARCHAR(150) NOT NULL,
      examiner_id INT NULL,
      maximum_marks DECIMAL(5,2) NOT NULL DEFAULT 100.00,
      marks_obtained DECIMAL(5,2) NULL,
      score DECIMAL(5,2) NULL,
      result VARCHAR(50) NULL,
      notes TEXT NULL,
      created_by INT NOT NULL,
      updated_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES quran_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (examiner_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_qexam_stu (student_id, exam_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ 5. Table quran_student_examinations ready');

  // 6. Create quran_certificates table
  await query(`
    CREATE TABLE IF NOT EXISTS quran_certificates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      certificate_number VARCHAR(50) NOT NULL UNIQUE,
      student_id INT NOT NULL,
      certificate_type VARCHAR(100) NOT NULL,
      juz_completed INT NOT NULL,
      issue_date DATE NOT NULL,
      issued_by INT NOT NULL,
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_cert_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ 6. Table quran_certificates ready');

  console.log('--- QURAN SCHOOL MIGRATION COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

// Execute if run directly
if (process.argv[1]?.includes('migrate_quran_school.js')) {
  migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
