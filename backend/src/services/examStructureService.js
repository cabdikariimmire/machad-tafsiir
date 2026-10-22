import { query } from '../db/connection.js';

/**
 * Institute Official Two-Half Examination System Service
 *
 * Structure:
 * - First Half (النصف الأول):
 *   - النصف الأول: 40 marks
 *   - النهائي الأول: 60 marks
 *   Total = 100 marks
 *
 * - Second Half (النصف الثاني):
 *   - النصف الثاني: 40 marks
 *   - النهائي الثاني: 60 marks
 *   Total = 100 marks
 */

export const OFFICIAL_EXAM_PERIODS = [
  {
    name: 'النصف الأول',
    half: 1,
    exam_type: 'half',
    sequence_order: 1,
    max_contribution: 40.00,
    description: 'Imtixaanka Niska Koowaad (First Half Midterm - Max 40)'
  },
  {
    name: 'النهائي الأول',
    half: 1,
    exam_type: 'final',
    sequence_order: 2,
    max_contribution: 60.00,
    description: 'Imtixaanka Kama-dambeysta Niska Koowaad (First Half Final - Max 60)'
  },
  {
    name: 'النصف الثاني',
    half: 2,
    exam_type: 'half',
    sequence_order: 3,
    max_contribution: 40.00,
    description: 'Imtixaanka Niska Labaad (Second Half Midterm - Max 40)'
  },
  {
    name: 'النهائي الثاني',
    half: 2,
    exam_type: 'final',
    sequence_order: 4,
    max_contribution: 60.00,
    description: 'Imtixaanka Kama-dambeysta Niska Labaad (Second Half Final - Max 60)'
  }
];

export const FIRST_HALF_EXAMS = ['النصف الأول', 'النهائي الأول'];
export const SECOND_HALF_EXAMS = ['النصف الثاني', 'النهائي الثاني'];
export const ALL_OFFICIAL_EXAMS = ['النصف الأول', 'النهائي الأول', 'النصف الثاني', 'النهائي الثاني'];

/**
 * Get configured maximum marks for an exam title
 */
export function getOfficialExamMax(examTitle) {
  if (!examTitle) return null;
  const trimmed = examTitle.trim();
  const found = OFFICIAL_EXAM_PERIODS.find(p => p.name === trimmed);
  return found ? found.max_contribution : null;
}

/**
 * Check if an exam title belongs to the First Half
 */
export function isFirstHalfExam(examTitle) {
  if (!examTitle) return false;
  return FIRST_HALF_EXAMS.includes(examTitle.trim());
}

/**
 * Check if an exam title belongs to the Second Half
 */
export function isSecondHalfExam(examTitle) {
  if (!examTitle) return false;
  return SECOND_HALF_EXAMS.includes(examTitle.trim());
}

/**
 * Legacy compatibility hook. Configurable exam periods are now created by an
 * administrator through the examination-plan workflow. Existing legacy rows
 * are preserved, but new years are never populated with hardcoded exams.
 */
export async function ensureOfficialExamPeriods(academicYear = '2026') {
  return Boolean(academicYear);
}
