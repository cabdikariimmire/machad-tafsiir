import ExcelJS from 'exceljs';
import { query } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';
import { canAccessDivision } from '../middleware/auth.js';

/**
 * Sanitize text to prevent Excel Formula Injection (CSV/Formula injection CWE-1236)
 */
function sanitizeForExcel(val) {
  if (typeof val === 'string' && ['=', '+', '-', '@'].includes(val.charAt(0))) {
    return `'${val}`;
  }
  return val;
}

/**
 * 1. Financial Reports & Payment History
 */
export async function getFinancialReports(req, res, next) {
  try {
    const user = req.session.user;
    const {
      division, start_date, end_date, status, payment_status, search,
      fee_type, billing_period, billing_month, billing_year, academic_year,
      class_id, group_id, student_id, transaction_id, received_by,
      page = '1', page_size = '50', export_xlsx
    } = req.query;

    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedPageSize = Math.min(200, Math.max(1, Number.parseInt(page_size, 10) || 50));

    // The two financial sources are intentionally combined for searching, but
    // remain distinguishable by division and fee_type. Reprinting only reads
    // these rows and can never create a new transaction.
    let sql = `
      SELECT r.*
      FROM (
        SELECT p.id AS transaction_id,
               CONVERT(p.receipt_number USING utf8mb4) COLLATE utf8mb4_unicode_ci AS receipt_number,
               p.payment_date, p.amount_paid,
               CONVERT(p.status USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status,
               CONVERT(p.notes USING utf8mb4) COLLATE utf8mb4_unicode_ci AS notes,
               s.id AS student_id,
               CONVERT(s.student_id USING utf8mb4) COLLATE utf8mb4_unicode_ci AS student_code,
               CONVERT(s.full_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS student_name,
               CONVERT(s.name_ar USING utf8mb4) COLLATE utf8mb4_unicode_ci AS student_name_ar,
               CONVERT(s.phone USING utf8mb4) COLLATE utf8mb4_unicode_ci AS student_phone,
               CONVERT(p.division USING utf8mb4) COLLATE utf8mb4_unicode_ci AS division,
               CONVERT(fi.fee_type USING utf8mb4) COLLATE utf8mb4_unicode_ci AS fee_type,
               CONVERT(fi.billing_period USING utf8mb4) COLLATE utf8mb4_unicode_ci AS billing_period,
               CONVERT(CASE WHEN fi.billing_period REGEXP '^[0-9]{4}' THEN LEFT(fi.billing_period, 4)
                    ELSE YEAR(p.payment_date) END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS academic_year,
               fi.standard_fee, fi.discount_amount, fi.amount_due,
               GREATEST(fi.balance, 0) AS balance_remaining,
               CONVERT(fi.status USING utf8mb4) COLLATE utf8mb4_unicode_ci AS obligation_status,
               CONVERT(u.full_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS received_by_name,
               ic.id AS class_id, ic.name AS class_name,
               qg.id AS group_id, qg.name AS group_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN fee_invoices fi ON p.invoice_id = fi.id
        LEFT JOIN users u ON p.received_by = u.id
        LEFT JOIN institute_classes ic ON fi.class_id = ic.id
        LEFT JOIN quran_groups qg ON fi.group_id = qg.id

        UNION ALL

        SELECT efp.id AS transaction_id,
               CONVERT(efp.receipt_number USING utf8mb4) COLLATE utf8mb4_unicode_ci AS receipt_number,
               efp.payment_date, efp.amount_paid,
               CONVERT(efp.status USING utf8mb4) COLLATE utf8mb4_unicode_ci AS status,
               CONVERT(efp.notes USING utf8mb4) COLLATE utf8mb4_unicode_ci AS notes,
               s.id AS student_id,
               CONVERT(s.student_id USING utf8mb4) COLLATE utf8mb4_unicode_ci AS student_code,
               CONVERT(s.full_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS student_name,
               CONVERT(s.name_ar USING utf8mb4) COLLATE utf8mb4_unicode_ci AS student_name_ar,
               CONVERT(s.phone USING utf8mb4) COLLATE utf8mb4_unicode_ci AS student_phone,
               CONVERT('institute' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS division,
               CONVERT('exam' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS fee_type,
               CONVERT(efp.exam_period USING utf8mb4) COLLATE utf8mb4_unicode_ci AS billing_period,
               CONVERT(efp.academic_year USING utf8mb4) COLLATE utf8mb4_unicode_ci AS academic_year,
               efp.fee_amount AS standard_fee, 0 AS discount_amount,
               efp.fee_amount AS amount_due, GREATEST(efp.balance_remaining, 0) AS balance_remaining,
                CONVERT(CASE WHEN efp.balance_remaining <= 0 THEN 'paid'
                     WHEN efp.amount_paid > 0 THEN 'partial' ELSE 'unpaid' END USING utf8mb4) COLLATE utf8mb4_unicode_ci AS obligation_status,
               CONVERT(u.full_name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS received_by_name,
               ic.id AS class_id, ic.name AS class_name,
               NULL AS group_id,
               CONVERT(NULL USING utf8mb4) COLLATE utf8mb4_unicode_ci AS group_name
        FROM exam_fee_payments efp
        JOIN students s ON efp.student_id = s.id
        LEFT JOIN users u ON efp.received_by = u.id
        LEFT JOIN institute_classes ic ON efp.class_id = ic.id
      ) r
      WHERE 1 = 1
    `;
    const params = [];

    if (user.role === 'institute_admin' || user.division_scope === 'institute') {
      sql += ` AND r.division = 'institute'`;
    } else if (user.role === 'quran_admin' || user.division_scope === 'quran') {
      sql += ` AND r.division = 'quran'`;
    } else if (division) {
      sql += ` AND r.division = ?`;
      params.push(division);
    }

    if (start_date) { sql += ` AND DATE(r.payment_date) >= ?`; params.push(start_date); }
    if (end_date) { sql += ` AND DATE(r.payment_date) <= ?`; params.push(end_date); }
    if (status) { sql += ` AND r.status = ?`; params.push(status); }
    if (payment_status) { sql += ` AND r.obligation_status = ?`; params.push(payment_status); }
    if (fee_type) { sql += ` AND r.fee_type = ?`; params.push(fee_type); }
    if (billing_period) { sql += ` AND r.billing_period = ?`; params.push(billing_period); }
    if (billing_month) { sql += ` AND r.billing_period LIKE ?`; params.push(`%${billing_month}`); }
    if (billing_year) { sql += ` AND r.billing_period LIKE ?`; params.push(`${billing_year}-%`); }
    if (academic_year) { sql += ` AND r.academic_year = ?`; params.push(academic_year); }
    if (class_id) { sql += ` AND r.class_id = ?`; params.push(class_id); }
    if (group_id) { sql += ` AND r.group_id = ?`; params.push(group_id); }
    if (student_id) { sql += ` AND r.student_id = ?`; params.push(student_id); }
    if (transaction_id) { sql += ` AND r.transaction_id = ?`; params.push(transaction_id); }
    if (received_by) { sql += ` AND r.received_by_name LIKE ?`; params.push(`%${received_by}%`); }
    if (search) {
      const st = `%${search.trim()}%`;
      sql += ` AND (r.student_name LIKE ? OR r.student_name_ar LIKE ? OR r.student_code LIKE ?
                    OR r.student_phone LIKE ? OR r.receipt_number LIKE ?
                    OR CAST(r.transaction_id AS CHAR) LIKE ? OR r.notes LIKE ?)`;
      params.push(st, st, st, st, st, st, st);
    }

    const countSql = `SELECT COUNT(*) AS total_count, COALESCE(SUM(amount_paid), 0) AS total_amount FROM (${sql}) filtered`;
    const countRows = await query(countSql, params);
    const totalCount = Number(countRows[0]?.total_count || 0);
    const totalAmount = Number(countRows[0]?.total_amount || 0);

    const dataParams = [...params];
    sql += ` ORDER BY r.payment_date DESC, r.transaction_id DESC`;
    const isExport = export_xlsx === 'true' || export_xlsx === '1';
    if (!isExport) {
      const offset = (parsedPage - 1) * parsedPageSize;
      sql += ` LIMIT ${parsedPageSize} OFFSET ${offset}`;
    }
    const records = await query(sql, dataParams);

    // Export to Excel if requested
    if (isExport) {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'معهد التفسير للعلوم الشرعية والعربية';
      const sheet = workbook.addWorksheet('Warbixinta Maaliyadda');

      // Title header
      sheet.mergeCells('A1:K1');
      sheet.getCell('A1').value = 'معهد التفسير للعلوم الشرعية والعربية - Warbixinta Lacag-qabashada (Financial Report)';
      sheet.getCell('A1').font = { size: 14, bold: true };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      sheet.addRow([]);
      sheet.addRow([
        'Transaction ID',
        'Rasiidka',
        'Taariikhda',
        'Magaca Ardayga',
        'Aqoonsiga (ID)',
        'Waaxda',
        'Nooca Waajibka',
        'Billing Period',
        'Fasalka / Halaqada',
        'Lacagta ($)',
        'Qasnajiga'
      ]);

      const headerRow = sheet.getRow(3);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      };

      records.forEach(r => {
        sheet.addRow([
          r.transaction_id,
          sanitizeForExcel(r.receipt_number),
          new Date(r.payment_date).toLocaleDateString(),
          sanitizeForExcel(r.student_name),
          sanitizeForExcel(r.student_code),
          r.division === 'institute' ? 'Machad' : 'Quraan',
          sanitizeForExcel(r.fee_type),
          sanitizeForExcel(r.billing_period),
          sanitizeForExcel(r.class_name || r.group_name || '-'),
          parseFloat(r.amount_paid),
          sanitizeForExcel(r.received_by_name)
        ]);
      });

      // Total row
      const totalRow = sheet.addRow(['WADAR GUUD', '', '', '', '', '', '', '', '', totalAmount, '']);
      totalRow.font = { bold: true };

      // Set column widths
      sheet.columns = [
        { width: 16 }, { width: 25 },
        { width: 15 },
        { width: 30 },
        { width: 18 },
        { width: 15 },
        { width: 16 }, { width: 20 },
        { width: 25 },
        { width: 15 },
        { width: 25 }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=warbixin-maaliyadeed-${Date.now()}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    res.json({
      success: true,
      data: {
        records,
        summary: {
          total_count: totalCount,
          total_amount: totalAmount,
          page: parsedPage,
          page_size: parsedPageSize,
          total_pages: Math.ceil(totalCount / parsedPageSize)
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Outstanding Fees & Student Balances Report
 */
export async function getOutstandingFeesReport(req, res, next) {
  try {
    const user = req.session.user;
    const {
      division, status, search, fee_type, billing_period, billing_year,
      class_id, group_id, page = '1', page_size = '50', export_xlsx
    } = req.query;
    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedPageSize = Math.min(200, Math.max(1, Number.parseInt(page_size, 10) || 50));

    let sql = `
      SELECT fi.id AS obligation_id, fi.billing_period, fi.fee_type, fi.standard_fee,
             fi.discount_amount, fi.amount_due, fi.amount_paid, GREATEST(fi.balance, 0) AS balance, fi.status,
             s.student_id as student_code, s.full_name as student_name, s.phone as student_phone,
             fi.division,
             ic.id as class_id, ic.name as class_name, qg.id as group_id, qg.name as group_name
      FROM fee_invoices fi
      JOIN students s ON fi.student_id = s.id
      LEFT JOIN institute_classes ic ON fi.class_id = ic.id
      LEFT JOIN quran_groups qg ON fi.group_id = qg.id
      WHERE 1=1
    `;
    const params = [];

    if (user.role === 'institute_admin' || user.division_scope === 'institute') {
      sql += ` AND fi.division = 'institute'`;
    } else if (user.role === 'quran_admin' || user.division_scope === 'quran') {
      sql += ` AND fi.division = 'quran'`;
    } else if (division) {
      sql += ` AND fi.division = ?`;
      params.push(division);
    }

    if (status) {
      sql += ` AND fi.status = ?`;
      params.push(status);
    }
    if (fee_type) {
      sql += ` AND fi.fee_type = ?`;
      params.push(fee_type);
    }
    if (billing_period) {
      sql += ` AND fi.billing_period = ?`;
      params.push(billing_period);
    }
    if (billing_year) {
      sql += ` AND fi.billing_period LIKE ?`;
      params.push(`${billing_year}-%`);
    }
    if (class_id) {
      sql += ` AND fi.class_id = ?`;
      params.push(class_id);
    }
    if (group_id) {
      sql += ` AND fi.group_id = ?`;
      params.push(group_id);
    }
    if (search) {
      const st = `%${search.trim()}%`;
      sql += ` AND (s.full_name LIKE ? OR s.student_id LIKE ? OR CAST(fi.id AS CHAR) LIKE ?)`;
      params.push(st, st, st);
    }

    const countRows = await query(
      `SELECT COUNT(*) AS total_count,
              COALESCE(SUM(amount_due), 0) AS total_due,
              COALESCE(SUM(amount_paid), 0) AS total_paid,
              COALESCE(SUM(balance), 0) AS total_balance
         FROM (${sql}) filtered`,
      params
    );
    const totals = countRows[0] || {};
    const isExport = export_xlsx === 'true' || export_xlsx === '1';
    sql += ` ORDER BY fi.balance DESC, s.full_name ASC`;
    if (!isExport) {
      const offset = (parsedPage - 1) * parsedPageSize;
      sql += ` LIMIT ${parsedPageSize} OFFSET ${offset}`;
    }

    const records = await query(sql, params);

    const totalDue = Number(totals.total_due || 0);
    const totalPaid = Number(totals.total_paid || 0);
    const totalBalance = Number(totals.total_balance || 0);

    if (export_xlsx === 'true' || export_xlsx === '1') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'معهد التفسير للعلوم الشرعية والعربية';
      const sheet = workbook.addWorksheet('Warbixinta Biilasha');

      sheet.mergeCells('A1:H1');
      sheet.getCell('A1').value = 'معهد التفسير للعلوم الشرعية والعربية - Warbixinta Biilasha & Haraaga (Fee Balances)';
      sheet.getCell('A1').font = { size: 14, bold: true };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      sheet.addRow([]);
      sheet.addRow([
        'Aqoonsiga (ID)',
        'Magaca Ardayga',
        'Waaxda',
        'Fasalka / Halaqada',
        'Bisha (Period)',
        'Lacagta Laga Rabo ($)',
        'Lacagta Bixiyay ($)',
        'Haraaga Dhiman ($)',
        'Xaaladda'
      ]);

      const headerRow = sheet.getRow(3);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };

      records.forEach(r => {
        sheet.addRow([
          sanitizeForExcel(r.student_code),
          sanitizeForExcel(r.student_name),
          r.division === 'institute' ? 'Machad' : 'Quraan',
          sanitizeForExcel(r.class_name || r.group_name || '-'),
          sanitizeForExcel(r.billing_period),
          parseFloat(r.amount_due),
          parseFloat(r.amount_paid),
          parseFloat(r.balance),
          r.status.toUpperCase()
        ]);
      });

      const totalRow = sheet.addRow(['WADAR GUUD', '', '', '', '', totalDue, totalPaid, totalBalance, '']);
      totalRow.font = { bold: true };

      sheet.columns = [
        { width: 18 }, { width: 30 }, { width: 15 }, { width: 25 },
        { width: 18 }, { width: 22 }, { width: 20 }, { width: 20 }, { width: 15 }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=warbixin-biilasha-${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    res.json({
      success: true,
      data: {
        records,
        summary: {
          total_count: Number(totals.total_count || 0),
          total_due: totalDue,
          total_paid: totalPaid,
          total_balance: totalBalance,
          page: parsedPage,
          page_size: parsedPageSize,
          total_pages: Math.ceil(Number(totals.total_count || 0) / parsedPageSize)
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Complete student financial statement across all available historical years.
 * This endpoint is read-only: it never creates invoices, payments, or receipts.
 */
export async function getStudentFinancialProfile(req, res, next) {
  try {
    const user = req.session.user;
    const { student_id } = req.params;
    if (!student_id) {
      return res.status(400).json({ success: false, error: 'Student ID waa qasab.' });
    }

    const [student] = await query(
      `SELECT id, student_id AS student_code, full_name, name_ar, phone, guardian_phone,
              gender, is_active, created_at
         FROM students WHERE id = ? OR student_id = ? LIMIT 1`,
      [student_id, student_id]
    );
    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    const scopedDivision = user.division_scope && user.division_scope !== 'all' && user.role !== 'super_admin'
      ? user.division_scope
      : null;
    const scopeParams = scopedDivision ? [scopedDivision] : [];
    if (scopedDivision && !canAccessDivision(user, scopedDivision)) {
      return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku aragto xogtan.' });
    }

    const enrollments = await query(
      `SELECT 'institute' AS division, ic.academic_year, ie.status,
              ic.name AS class_or_group_name, NULL AS level_name
         FROM institute_enrollments ie
         LEFT JOIN institute_classes ic ON ie.class_id = ic.id
        WHERE ie.student_id = ?
       UNION ALL
       SELECT 'quran' AS division, NULL AS academic_year, qe.status,
              qg.name AS class_or_group_name, ql.name AS level_name
         FROM quran_enrollments qe
         LEFT JOIN quran_groups qg ON qe.group_id = qg.id
         LEFT JOIN quran_levels ql ON qg.level_id = ql.id
        WHERE qe.student_id = ?
       ORDER BY academic_year DESC, division ASC`,
      [student.id, student.id]
    );

    let obligationSql = `
      SELECT fi.id AS obligation_id, fi.division, fi.fee_type, fi.billing_period,
             fi.standard_fee, fi.discount_amount, fi.amount_due, fi.amount_paid,
             GREATEST(fi.balance, 0) AS balance, fi.status, fi.invoice_number,
             ic.name AS class_name, qg.name AS group_name
        FROM fee_invoices fi
        LEFT JOIN institute_classes ic ON fi.class_id = ic.id
        LEFT JOIN quran_groups qg ON fi.group_id = qg.id
       WHERE fi.student_id = ?`;
    const obligationParams = [student.id];
    if (scopedDivision) {
      obligationSql += ' AND fi.division = ?';
      obligationParams.push(scopedDivision);
    }
    obligationSql += ' ORDER BY fi.billing_period DESC, fi.id DESC';
    const obligations = await query(obligationSql, obligationParams);

    let paymentSql = `
      SELECT p.id AS transaction_id, p.receipt_number, p.division, fi.fee_type,
             fi.billing_period, p.amount_paid, p.payment_date, p.status, p.notes,
             u.full_name AS received_by_name, fi.invoice_number,
             ic.name AS class_name, qg.name AS group_name
        FROM payments p
        JOIN fee_invoices fi ON p.invoice_id = fi.id
        LEFT JOIN users u ON p.received_by = u.id
        LEFT JOIN institute_classes ic ON fi.class_id = ic.id
        LEFT JOIN quran_groups qg ON fi.group_id = qg.id
       WHERE p.student_id = ?`;
    const paymentParams = [student.id];
    if (scopedDivision) {
      paymentSql += ' AND p.division = ?';
      paymentParams.push(scopedDivision);
    }
    paymentSql += ' ORDER BY p.payment_date DESC, p.id DESC';
    const tuitionPayments = await query(paymentSql, paymentParams);

    let examPayments = [];
    if (!scopedDivision || scopedDivision === 'institute') {
      examPayments = await query(
        `SELECT efp.id AS transaction_id, efp.receipt_number, 'institute' AS division,
                'exam' AS fee_type, efp.exam_period AS billing_period,
                efp.academic_year, efp.fee_amount AS amount_due,
                efp.amount_paid, GREATEST(efp.balance_remaining, 0) AS balance,
                efp.payment_date, efp.status, efp.notes,
                u.full_name AS received_by_name, ic.name AS class_name
           FROM exam_fee_payments efp
           LEFT JOIN users u ON efp.received_by = u.id
           LEFT JOIN institute_classes ic ON efp.class_id = ic.id
          WHERE efp.student_id = ?
          ORDER BY efp.payment_date DESC, efp.id DESC`,
        [student.id]
      );
    }

    const totalPaid = tuitionPayments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0)
      + examPayments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
    const outstandingByFeeType = {};
    for (const row of obligations) {
      outstandingByFeeType[row.fee_type] = (outstandingByFeeType[row.fee_type] || 0) + Number(row.balance || 0);
    }
    for (const row of examPayments) {
      outstandingByFeeType.exam = (outstandingByFeeType.exam || 0) + Number(row.balance || 0);
    }

    res.json({
      success: true,
      data: {
        student,
        enrollments,
        obligations,
        payments: [
          ...tuitionPayments.map(row => ({ ...row, transaction_type: 'finance' })),
          ...examPayments.map(row => ({ ...row, transaction_type: 'exam_fee' }))
        ].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)),
        summary: {
          total_paid: Number(totalPaid.toFixed(2)),
          total_outstanding: Number(Object.values(outstandingByFeeType).reduce((sum, value) => sum + value, 0).toFixed(2)),
          outstanding_by_fee_type: Object.fromEntries(
            Object.entries(outstandingByFeeType).map(([key, value]) => [key, Number(value.toFixed(2))])
          ),
          obligation_count: obligations.length,
          payment_count: tuitionPayments.length + examPayments.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Student Attendance Summary Report
 */
export async function getAttendanceReport(req, res, next) {
  try {
    const user = req.session.user;
    const { division, class_id, group_id, start_date, end_date, export_xlsx } = req.query;

    const div = (user.role === 'institute_admin' || user.division_scope === 'institute') ? 'institute'
      : (user.role === 'quran_admin' || user.division_scope === 'quran') ? 'quran'
      : (division || 'institute');

    let records = [];

    if (div === 'institute') {
      let sql = `
        SELECT s.id as student_id, s.student_id as student_code, s.full_name as student_name,
               ic.name as class_name,
               COUNT(ia.id) as total_sessions,
               SUM(CASE WHEN ia.status = 'present' THEN 1 ELSE 0 END) as present_count,
               SUM(CASE WHEN ia.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
               SUM(CASE WHEN ia.status = 'late' THEN 1 ELSE 0 END) as late_count,
               SUM(CASE WHEN ia.status = 'excused' THEN 1 ELSE 0 END) as excused_count
        FROM students s
        JOIN institute_enrollments ie ON s.id = ie.student_id AND ie.status = 'active'
        JOIN institute_classes ic ON ie.class_id = ic.id
        LEFT JOIN institute_attendance ia ON s.id = ia.student_id
        LEFT JOIN institute_class_sessions ics ON ia.session_id = ics.id
        WHERE 1=1
      `;
      const params = [];

      if (class_id) {
        sql += ` AND ic.id = ?`;
        params.push(class_id);
      }
      if (start_date) {
        sql += ` AND (ics.session_date >= ? OR ics.session_date IS NULL)`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND (ics.session_date <= ? OR ics.session_date IS NULL)`;
        params.push(end_date);
      }

      sql += ` GROUP BY s.id, ic.id ORDER BY ic.name ASC, s.full_name ASC`;
      records = await query(sql, params);
    } else {
      let sql = `
        SELECT s.id as student_id, s.student_id as student_code, s.full_name as student_name,
               qg.name as group_name,
               COUNT(qa.id) as total_sessions,
               SUM(CASE WHEN qa.status = 'present' THEN 1 ELSE 0 END) as present_count,
               SUM(CASE WHEN qa.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
               SUM(CASE WHEN qa.status = 'late' THEN 1 ELSE 0 END) as late_count,
               SUM(CASE WHEN qa.status = 'excused' THEN 1 ELSE 0 END) as excused_count
        FROM students s
        JOIN quran_enrollments qe ON s.id = qe.student_id AND qe.status = 'active'
        JOIN quran_groups qg ON qe.group_id = qg.id
        LEFT JOIN quran_attendance qa ON s.id = qa.student_id
        LEFT JOIN quran_sessions qs ON qa.session_id = qs.id
        WHERE 1=1
      `;
      const params = [];

      if (group_id) {
        sql += ` AND qg.id = ?`;
        params.push(group_id);
      }
      if (start_date) {
        sql += ` AND (qs.session_date >= ? OR qs.session_date IS NULL)`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND (qs.session_date <= ? OR qs.session_date IS NULL)`;
        params.push(end_date);
      }

      sql += ` GROUP BY s.id, qg.id ORDER BY qg.name ASC, s.full_name ASC`;
      records = await query(sql, params);
    }

    // Calculate attendance percentage
    records = records.map(r => {
      const total = parseInt(r.total_sessions || 0, 10);
      const present = parseInt(r.present_count || 0, 10);
      const late = parseInt(r.late_count || 0, 10);
      const rate = total > 0 ? (((present + late * 0.5) / total) * 100).toFixed(1) : '100.0';
      return { ...r, attendance_percentage: rate };
    });

    if (export_xlsx === 'true' || export_xlsx === '1') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'معهد التفسير للعلوم الشرعية والعربية';
      const sheet = workbook.addWorksheet('Warbixinta Xaadirinta');

      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = `معهد التفسير - Warbixinta Xaadirinta (${div === 'institute' ? 'Machadka' : 'Quraanka'})`;
      sheet.getCell('A1').font = { size: 14, bold: true };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      sheet.addRow([]);
      sheet.addRow([
        'Aqoonsiga (ID)',
        'Magaca Ardayga',
        div === 'institute' ? 'Fasalka' : 'Halaqada',
        'Kulamada (Sessions)',
        'Joogay (Present)',
        'Maqnaa (Absent)',
        'Cudurdaar (Excused)',
        'Boqolkiiba (%)'
      ]);

      const headerRow = sheet.getRow(3);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

      records.forEach(r => {
        sheet.addRow([
          sanitizeForExcel(r.student_code),
          sanitizeForExcel(r.student_name),
          sanitizeForExcel(r.class_name || r.group_name || '-'),
          parseInt(r.total_sessions, 10),
          parseInt(r.present_count, 10),
          parseInt(r.absent_count, 10),
          parseInt(r.excused_count, 10),
          `${r.attendance_percentage}%`
        ]);
      });

      sheet.columns = [
        { width: 18 }, { width: 30 }, { width: 25 },
        { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=warbixin-xaadirinta-${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    res.json({
      success: true,
      data: {
        records,
        division: div
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Students Enrollment & Demographic Roster Report
 */
export async function getStudentsReport(req, res, next) {
  try {
    const user = req.session.user;
    const { division, class_id, group_id, status, gender, export_xlsx } = req.query;

    let sql = `
      SELECT s.id, s.student_id as student_code, s.full_name as student_name, s.gender, s.date_of_birth,
             s.phone as student_phone, s.emergency_contact_name, s.emergency_contact_phone, s.created_at,
             ic.name as class_name, qg.name as group_name,
             ie.status as institute_status, qe.status as quran_status
      FROM students s
      LEFT JOIN institute_enrollments ie ON s.id = ie.student_id
      LEFT JOIN institute_classes ic ON ie.class_id = ic.id
      LEFT JOIN quran_enrollments qe ON s.id = qe.student_id
      LEFT JOIN quran_groups qg ON qe.group_id = qg.id
      WHERE 1=1
    `;
    const params = [];

    if (user.role === 'institute_admin' || user.division_scope === 'institute' || division === 'institute') {
      sql += ` AND ie.id IS NOT NULL`;
      if (class_id) {
        sql += ` AND ic.id = ?`;
        params.push(class_id);
      }
    } else if (user.role === 'quran_admin' || user.division_scope === 'quran' || division === 'quran') {
      sql += ` AND qe.id IS NOT NULL`;
      if (group_id) {
        sql += ` AND qg.id = ?`;
        params.push(group_id);
      }
    }

    if (gender) {
      sql += ` AND s.gender = ?`;
      params.push(gender);
    }
    if (status) {
      sql += ` AND s.is_active = ?`;
      params.push(status === 'active' ? 1 : 0);
    }

    sql += ` ORDER BY s.student_id ASC`;
    const records = await query(sql, params);

    if (export_xlsx === 'true' || export_xlsx === '1') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'معهد التفسير للعلوم الشرعية والعربية';
      const sheet = workbook.addWorksheet('Liiska Ardayda');

      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'معهد التفسير للعلوم الشرعية والعربية - Liiska Guud ee Ardayda (Students Roster)';
      sheet.getCell('A1').font = { size: 14, bold: true };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      sheet.addRow([]);
      sheet.addRow([
        'Aqoonsiga (ID)',
        'Magaca Buuxa',
        'Jinsiga',
        'Telefoonka',
        'Fasalka (Machadka)',
        'Halaqada (Quraanka)',
        'Waalidka / Xiriirka'
      ]);

      const headerRow = sheet.getRow(3);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };

      records.forEach(r => {
        sheet.addRow([
          sanitizeForExcel(r.student_code),
          sanitizeForExcel(r.student_name),
          r.gender === 'male' ? 'Lab' : 'Dheddig',
          sanitizeForExcel(r.student_phone || '-'),
          sanitizeForExcel(r.class_name || '-'),
          sanitizeForExcel(r.group_name || '-'),
          sanitizeForExcel(`${r.emergency_contact_name || ''} ${r.emergency_contact_phone ? `(${r.emergency_contact_phone})` : ''}`.trim() || '-')
        ]);
      });

      sheet.columns = [
        { width: 18 }, { width: 32 }, { width: 12 }, { width: 18 },
        { width: 25 }, { width: 25 }, { width: 30 }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=liiska-ardayda-${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Quran Hifdh Tracking Progress Report
 */
export async function getQuranHifdhReport(req, res, next) {
  try {
    const { group_id, start_date, end_date, rating, export_xlsx } = req.query;

    let sql = `
      SELECT qp.*, s.student_id as student_code, s.full_name as student_name,
             qg.name as group_name, u.full_name as teacher_name
      FROM quran_progress qp
      JOIN students s ON qp.student_id = s.id
      JOIN quran_groups qg ON qp.group_id = qg.id
      JOIN users u ON qp.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (group_id) {
      sql += ` AND qp.group_id = ?`;
      params.push(group_id);
    }
    if (rating) {
      sql += ` AND qp.rating = ?`;
      params.push(rating);
    }
    if (start_date) {
      sql += ` AND qp.record_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND qp.record_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY qp.record_date DESC, s.full_name ASC LIMIT 100`;
    const records = await query(sql, params);

    if (export_xlsx === 'true' || export_xlsx === '1') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'معهد التفسير للعلوم الشرعية والعربية';
      const sheet = workbook.addWorksheet('Diiwaanka Xifdiga');

      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'معهد التفسير - Diiwaanka Xifdiga & Muraja\'ada Quraanka Kariimka';
      sheet.getCell('A1').font = { size: 14, bold: true };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      sheet.addRow([]);
      sheet.addRow([
        'Taariikhda',
        'Aqoonsiga (ID)',
        'Magaca Ardayga',
        'Halaqada',
        'Suuradda & Aayadaha',
        'Qiimaynta (Rating)',
        'Macallinka'
      ]);

      const headerRow = sheet.getRow(3);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };

      records.forEach(r => {
        sheet.addRow([
          new Date(r.record_date).toLocaleDateString(),
          sanitizeForExcel(r.student_code),
          sanitizeForExcel(r.student_name),
          sanitizeForExcel(r.group_name),
          sanitizeForExcel(`${r.surah_name || ''} (${r.from_ayah || 1}-${r.to_ayah || ''})`),
          r.rating.toUpperCase(),
          sanitizeForExcel(r.teacher_name)
        ]);
      });

      sheet.columns = [
        { width: 15 }, { width: 18 }, { width: 30 }, { width: 22 },
        { width: 30 }, { width: 18 }, { width: 25 }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=warbixin-xifdiga-${Date.now()}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
}

/**
 * 6. Exam Results Report with Excel Export
 */
export async function getExamResultsReport(req, res, next) {
  try {
    const { exam_id, division, export_xlsx } = req.query;

    if (!exam_id || !division) {
      // If no specific exam_id is given, return the list of available exams for selection
      const user = req.session.user;
      let examsList = [];
      if (user.role === 'institute_admin' || user.division_scope === 'institute' || division === 'institute') {
        examsList = await query(`
          SELECT e.id, e.title, e.exam_date, e.maximum_marks, e.status,
                 ic.name as class_name, isub.name as subject_name, 'institute' as division
          FROM institute_exams e
          JOIN institute_classes ic ON e.class_id = ic.id
          JOIN institute_subjects isub ON e.subject_id = isub.id
          ORDER BY e.exam_date DESC
        `);
      } else {
        examsList = await query(`
          SELECT qe.id, qe.title, qe.exam_date, qe.maximum_marks, qe.status,
                 qg.name as group_name, 'quran' as division
          FROM quran_exams qe
          JOIN quran_groups qg ON qe.group_id = qg.id
          ORDER BY qe.exam_date DESC
        `);
      }
      return res.json({ success: true, data: { exams_list: examsList } });
    }

    let exam;
    let marks;

    if (division === 'institute') {
      [exam] = await query(`
        SELECT e.*, ic.name as class_name, isub.name as subject_name
        FROM institute_exams e
        JOIN institute_classes ic ON e.class_id = ic.id
        JOIN institute_subjects isub ON e.subject_id = isub.id
        WHERE e.id = ?
      `, [exam_id]);

      marks = await query(`
        SELECT m.*, s.student_id as student_code, s.full_name as student_name, s.gender,
               u.full_name as entered_by_name
        FROM institute_exam_marks m
        JOIN students s ON m.student_id = s.id
        JOIN users u ON m.entered_by = u.id
        WHERE m.exam_id = ?
        ORDER BY m.percentage DESC, s.full_name ASC
      `, [exam_id]);
    } else {
      [exam] = await query(`
        SELECT qe.*, qg.name as group_name
        FROM quran_exams qe
        JOIN quran_groups qg ON qe.group_id = qg.id
        WHERE qe.id = ?
      `, [exam_id]);

      marks = await query(`
        SELECT m.*, s.student_id as student_code, s.full_name as student_name, s.gender,
               u.full_name as entered_by_name
        FROM quran_exam_marks m
        JOIN students s ON m.student_id = s.id
        JOIN users u ON m.entered_by = u.id
        WHERE m.exam_id = ?
        ORDER BY m.percentage DESC, s.full_name ASC
      `, [exam_id]);
    }

    if (!exam) {
      return res.status(404).json({ success: false, error: 'Imtixaanka lama helin.' });
    }

    if (export_xlsx === 'true' || export_xlsx === '1') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Natiijooyinka Imtixaanka');

      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = `Natiijada Imtixaanka: ${exam.title} (${exam.class_name || exam.group_name})`;
      sheet.getCell('A1').font = { size: 14, bold: true };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      sheet.addRow([]);
      sheet.addRow([
        'Kaalinta',
        'Aqoonsiga (ID)',
        'Magaca Ardayga',
        'Dhibcaha Helay',
        'Boqolkiiba (%)',
        'Xaaladda'
      ]);

      const headerRow = sheet.getRow(3);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0284C7' }
      };

      marks.forEach((m, idx) => {
        sheet.addRow([
          idx + 1,
          sanitizeForExcel(m.student_code),
          sanitizeForExcel(m.student_name),
          m.is_absent ? 'Ma Joogin (ABS)' : m.marks_obtained,
          m.is_absent ? '-' : `${m.percentage}%`,
          m.is_absent ? 'Ma Joogin' : (m.percentage >= 50 ? 'Gudbay' : 'Haray')
        ]);
      });

      sheet.columns = [
        { width: 10 },
        { width: 18 },
        { width: 30 },
        { width: 18 },
        { width: 18 },
        { width: 18 }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=natiijooyinka-${exam_id}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    res.json({
      success: true,
      data: {
        exam,
        results: marks
      }
    });
  } catch (error) {
    next(error);
  }
}

