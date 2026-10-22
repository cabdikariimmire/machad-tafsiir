import { query, withTransaction } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';
import { createNotification } from '../services/notificationService.js';
import { canAccessDivision } from '../middleware/auth.js';

/**
 * 1. Financial Dashboard Stats
 */
export async function getFinanceDashboard(req, res, next) {
  try {
    const user = req.session.user;
    const { division } = req.query;

    const targetDiv = division || (user.division_scope === 'all' ? null : user.division_scope);

    if (targetDiv && !canAccessDivision(user, targetDiv)) {
      return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku aragto maaliyadda waaxdan.' });
    }

    let whereClause = '';
    const params = [];
    if (targetDiv) {
      whereClause = ' WHERE division = ?';
      params.push(targetDiv);
    }

    // Total collected
    const [totalPaidRow] = await query(
      `SELECT COALESCE(SUM(amount_paid), 0) as total_collected 
       FROM payments ${whereClause ? whereClause + ' AND status = "valid"' : 'WHERE status = "valid"'}`,
      params
    );

    // Outstanding balance & total due
    const [invoicesSummary] = await query(
      `SELECT COALESCE(SUM(amount_due), 0) as total_due,
              COALESCE(SUM(amount_paid), 0) as invoice_paid,
              COALESCE(SUM(GREATEST(balance, 0)), 0) as outstanding_balance,
              COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_count,
              COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count,
              COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
       FROM fee_invoices ${whereClause}`,
      params
    );

    // Payments recorded today
    const [todayPayments] = await query(
      `SELECT COALESCE(SUM(amount_paid), 0) as collected_today, COUNT(id) as count_today
       FROM payments 
       ${whereClause ? whereClause + ' AND DATE(payment_date) = CURDATE() AND status = "valid"' : 'WHERE DATE(payment_date) = CURDATE() AND status = "valid"'}`,
      params
    );

    // Recent 5 payments
    const recentPayments = await query(
      `SELECT p.*, s.student_id as student_code, s.full_name as student_name, u.full_name as received_by_name
       FROM payments p
       JOIN students s ON p.student_id = s.id
       JOIN users u ON p.received_by = u.id
       ${whereClause ? whereClause + ' AND p.status = "valid"' : 'WHERE p.status = "valid"'}
       ORDER BY p.payment_date DESC LIMIT 5`,
      params
    );

    res.json({
      success: true,
      data: {
        total_collected: parseFloat(totalPaidRow.total_collected || 0),
        outstanding_balance: parseFloat(invoicesSummary.outstanding_balance || 0),
        total_due: parseFloat(invoicesSummary.total_due || 0),
        collected_today: parseFloat(todayPayments.collected_today || 0),
        today_transactions: todayPayments.count_today || 0,
        unpaid_count: invoicesSummary.unpaid_count || 0,
        partial_count: invoicesSummary.partial_count || 0,
        paid_count: invoicesSummary.paid_count || 0,
        recent_payments: recentPayments
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Students & Fees: List of fee obligations and student balances
 */
export async function getStudentsAndFees(req, res, next) {
  try {
    const user = req.session.user;
    const { division, search, status, billing_period } = req.query;

    const targetDiv = division || (user.division_scope === 'all' ? 'institute' : user.division_scope);

    if (targetDiv && !canAccessDivision(user, targetDiv)) {
      return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku aragto maaliyadda waaxdan.' });
    }

    let sql = `
      SELECT fi.*, s.student_id as student_code, s.full_name as student_name, s.phone as student_phone,
             ic.name as class_name, qg.name as group_name
      FROM fee_invoices fi
      JOIN students s ON fi.student_id = s.id
      LEFT JOIN institute_classes ic ON fi.class_id = ic.id
      LEFT JOIN quran_groups qg ON fi.group_id = qg.id
      WHERE fi.division = ?
    `;
    const params = [targetDiv];

    if (search) {
      const st = `%${search.trim()}%`;
      sql += ` AND (s.full_name LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ?)`;
      params.push(st, st, st);
    }

    if (status) {
      sql += ` AND fi.status = ?`;
      params.push(status);
    }

    if (billing_period) {
      sql += ` AND fi.billing_period = ?`;
      params.push(billing_period);
    }

    sql += ` ORDER BY fi.id DESC LIMIT 200`;

    const records = await query(sql, params);
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
}

/**
 * Prepare student payment details (for the payment form: auto-loading class/group, fee, and approved discount)
 */
export async function getStudentPaymentDetails(req, res, next) {
  try {
    const { student_id, division, billing_period } = req.query;
    const requestedFeeType = req.query.fee_type || 'monthly';
    const feeType = division === 'quran' ? 'monthly' : requestedFeeType;

    if (!student_id || !division) {
      return res.status(400).json({ success: false, error: 'Ardayga iyo waaxdu waa qasab.' });
    }

    if (!canAccessDivision(req.session.user, division)) {
      return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku aragto maaliyadda waaxdan.' });
    }

    if (!['monthly', 'registration'].includes(feeType)) {
      return res.status(400).json({ success: false, error: 'Nooca waajibka maaliyadeed lama aqoonsan.' });
    }

    const currentPeriod = billing_period || (feeType === 'registration'
      ? `registration-${new Date().getFullYear()}`
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

    // 1. Get student
    const [student] = await query(`SELECT * FROM students WHERE id = ?`, [student_id]);
    if (!student) {
      return res.status(404).json({ success: false, error: 'Ardayga lama helin.' });
    }

    let classOrGroupId = null;
    let classOrGroupName = '';

    if (division === 'institute') {
      const [enrollment] = await query(
        `SELECT ie.class_id, ic.name as class_name 
         FROM institute_enrollments ie
         JOIN institute_classes ic ON ie.class_id = ic.id
         WHERE ie.student_id = ? AND ie.status = 'active'`,
        [student_id]
      );
      if (enrollment) {
        classOrGroupId = enrollment.class_id;
        classOrGroupName = enrollment.class_name;
      }
    } else {
      const [enrollment] = await query(
        `SELECT qe.group_id, qg.name as group_name 
         FROM quran_enrollments qe
         JOIN quran_groups qg ON qe.group_id = qg.id
         WHERE qe.student_id = ? AND qe.status = 'active'`,
        [student_id]
      );
      if (enrollment) {
        classOrGroupId = enrollment.group_id;
        classOrGroupName = enrollment.group_name;
      }
    }

    // 2. Load official fee rule
    let feeRuleQuery = `
      SELECT standard_fee
      FROM fee_rules
      WHERE division = ? AND fee_type = ? AND is_active = 1
        AND (billing_period = ? OR billing_period = 'Monthly')`;
    const feeParams = [division, feeType, currentPeriod];
    if (division === 'institute' && classOrGroupId) {
      feeRuleQuery += ` AND class_id = ?`;
      feeParams.push(classOrGroupId);
    } else if (division === 'quran' && classOrGroupId) {
      feeRuleQuery += ` AND group_id = ?`;
      feeParams.push(classOrGroupId);
    }
    feeRuleQuery += ` ORDER BY (billing_period = ?) DESC, id DESC LIMIT 1`;
    feeParams.push(currentPeriod);
    const [rule] = await query(feeRuleQuery, feeParams);
    const standardFee = rule ? parseFloat(rule.standard_fee) : 25.00;

    // 3. Load approved student discount
    const [discountRow] = await query(
      `SELECT * FROM student_discounts 
       WHERE student_id = ? AND (division = ? OR division = 'both') AND is_active = 1
         AND (billing_period IS NULL OR billing_period = ?)
       ORDER BY (billing_period = ?) DESC, id DESC LIMIT 1`,
      [student_id, division, currentPeriod, currentPeriod]
    );

    let discountAmount = 0.00;
    let discountReason = '';
    if (discountRow) {
      discountReason = discountRow.reason;
      if (discountRow.discount_type === 'percentage') {
        discountAmount = (standardFee * parseFloat(discountRow.discount_value)) / 100;
      } else {
        discountAmount = parseFloat(discountRow.discount_value);
      }
    }

    // Ensure discount doesn't exceed standard fee
    if (discountAmount > standardFee) discountAmount = standardFee;

    const amountDue = standardFee - discountAmount;

    // 4. Check if invoice already exists for this student and period
    const [invoice] = await query(
      `SELECT * FROM fee_invoices 
       WHERE student_id = ? AND division = ? AND fee_type = ? AND billing_period = ?`,
      [student_id, division, feeType, currentPeriod]
    );

    // 5. Query all unpaid or partially paid months for this student in this division
    const unpaidInvoices = await query(
      `SELECT fi.id, fi.invoice_number, fi.billing_period, fi.standard_fee, fi.discount_amount,
              fi.amount_due, fi.amount_paid, fi.balance, fi.status, fi.created_at
       FROM fee_invoices fi
       WHERE fi.student_id = ? AND fi.division = ? AND fi.fee_type = ?
         AND fi.status IN ('unpaid', 'partial') AND fi.balance > 0
       ORDER BY fi.billing_period ASC`,
      [student_id, division, feeType]
    );

    const totalOutstandingFromInvoices = unpaidInvoices.reduce((sum, inv) => sum + Math.max(0, parseFloat(inv.balance || 0)), 0);
    const currentPeriodInUnpaid = unpaidInvoices.some(inv => inv.billing_period === currentPeriod);
    const currentMonthBalance = invoice ? Math.max(0, parseFloat(invoice.balance || 0)) : Math.max(0, amountDue);
    const totalOutstanding = currentPeriodInUnpaid
      ? totalOutstandingFromInvoices
      : (invoice && invoice.status === 'paid'
        ? totalOutstandingFromInvoices
        : totalOutstandingFromInvoices + currentMonthBalance);

    // 6. Query student's historical payment transactions in this division
    const paymentHistory = await query(
      `SELECT p.id, p.receipt_number, p.amount_paid, p.payment_date, p.notes, p.status,
              fi.fee_type, fi.billing_period, fi.invoice_number,
              u.full_name as received_by_name
       FROM payments p
       JOIN fee_invoices fi ON p.invoice_id = fi.id
       LEFT JOIN users u ON p.received_by = u.id
        WHERE p.student_id = ? AND p.division = ? AND fi.fee_type = ? AND p.status = 'valid'
       ORDER BY p.payment_date DESC`,
      [student_id, division, feeType]
    );

    const totalPaidAllTime = paymentHistory.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          student_code: student.student_id,
          full_name: student.full_name,
          name_ar: student.name_ar,
          phone: student.phone,
          guardian_phone: student.guardian_phone,
          gender: student.gender,
          class_or_group_name: classOrGroupName
        },
        division,
         fee_type: feeType,
        class_or_group_id: classOrGroupId,
        class_or_group_name: classOrGroupName,
        billing_period: currentPeriod,
        standard_fee: standardFee,
        discount_amount: discountAmount,
        discount_reason: discountReason,
        amount_due: invoice ? Math.max(0, parseFloat(invoice.amount_due || 0)) : amountDue,
        amount_paid_so_far: invoice ? Math.max(0, parseFloat(invoice.amount_paid || 0)) : 0.00,
        balance_remaining: currentMonthBalance,
        invoice_id: invoice ? invoice.id : null,
        invoice_status: invoice ? invoice.status : 'unpaid',
        total_outstanding_balance: totalOutstanding,
        unpaid_months: unpaidInvoices.map(inv => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          billing_period: inv.billing_period,
          standard_fee: parseFloat(inv.standard_fee),
          discount_amount: parseFloat(inv.discount_amount),
          amount_due: parseFloat(inv.amount_due),
          amount_paid: parseFloat(inv.amount_paid),
          balance: parseFloat(inv.balance),
          status: inv.status
        })),
        payment_history: paymentHistory.map(p => ({
          id: p.id,
          receipt_number: p.receipt_number,
           fee_type: p.fee_type,
          billing_period: p.billing_period,
          invoice_number: p.invoice_number,
          amount_paid: parseFloat(p.amount_paid),
          payment_date: p.payment_date,
          received_by_name: p.received_by_name,
          notes: p.notes,
          status: p.status
        })),
        total_paid_all_time: totalPaidAllTime
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Receive Payment & Generate Receipt
 */
export async function receivePayment(req, res, next) {
  try {
    const user = req.session.user;
    const {
      student_id,
      division,
      billing_period,
      fee_type = 'monthly',
      amount_paid,
      payment_date,
      notes
    } = req.body;

    if (!student_id || !division || !amount_paid) {
      return res.status(400).json({
        success: false,
        error: 'Ardayga, waaxda, iyo lacagta la bixinayo waa qasab.'
      });
    }

    const feeType = division === 'quran' ? 'monthly' : fee_type;
    if (!['monthly', 'registration'].includes(feeType)) {
      return res.status(400).json({ success: false, error: 'Qaybtan waxay taageertaa monthly iyo registration oo keliya.' });
    }

    const payAmount = parseFloat(amount_paid);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Lacagta la bixiyay waa inay noqotaa tiro togan.'
      });
    }

    // Scope check: Finance user division scope
    if (user.division_scope !== 'all' && user.role !== 'super_admin') {
      if (user.division_scope !== division) {
        return res.status(403).json({
          success: false,
          error: `Ma lihid awood aad ku qaaddo lacagta waaxda ${division === 'institute' ? 'Machadka' : 'Quraanka'}.`
        });
      }
    }

    const period = billing_period || (feeType === 'registration'
      ? `registration-${new Date().getFullYear()}`
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

    const receiptResult = await withTransaction(async (conn) => {
      // 1. Get student
      const [[student]] = await conn.execute(`SELECT * FROM students WHERE id = ?`, [student_id]);
      if (!student) {
        throw new Error('Ardayga lama helin.');
      }

      // 2. Identify class or group
      let classId = null;
      let groupId = null;
      let classOrGroupName = '';

      if (division === 'institute') {
        const [enr] = await conn.execute(
          `SELECT ie.class_id, ic.name FROM institute_enrollments ie JOIN institute_classes ic ON ie.class_id = ic.id WHERE ie.student_id = ? AND ie.status = 'active'`,
          [student_id]
        );
        if (enr.length > 0) {
          classId = enr[0].class_id;
          classOrGroupName = enr[0].name;
        }
      } else {
        const [enr] = await conn.execute(
          `SELECT qe.group_id, qg.name FROM quran_enrollments qe JOIN quran_groups qg ON qe.group_id = qg.id WHERE qe.student_id = ? AND qe.status = 'active'`,
          [student_id]
        );
        if (enr.length > 0) {
          groupId = enr[0].group_id;
          classOrGroupName = enr[0].name;
        }
      }

      // 3. Find or create fee invoice
      let [invoices] = await conn.execute(
        `SELECT * FROM fee_invoices
         WHERE student_id = ? AND division = ? AND fee_type = ? AND billing_period = ? FOR UPDATE`,
        [student_id, division, feeType, period]
      );

      let invoiceId;
      let amountDue;
      let prevPaid = 0.00;

      if (invoices.length > 0) {
        invoiceId = invoices[0].id;
        amountDue = parseFloat(invoices[0].amount_due);
        prevPaid = parseFloat(invoices[0].amount_paid);

        const remaining = Math.max(0, parseFloat(invoices[0].balance || 0));
        if (payAmount > remaining) {
          const validationError = new Error(`Lacagta la bixinayo ($${payAmount.toFixed(2)}) kama badnaan karto haraaga dhiman ($${remaining.toFixed(2)}).`);
          validationError.status = 400;
          throw validationError;
        }
      } else {
        // Calculate fee and discount from official rules
        let feeQuery = `
          SELECT standard_fee
          FROM fee_rules
          WHERE division = ? AND fee_type = ? AND is_active = 1
            AND (billing_period = ? OR billing_period = 'Monthly')`;
        const fParams = [division, feeType, period];
        if (division === 'institute' && classId) {
          feeQuery += ` AND class_id = ?`;
          fParams.push(classId);
        } else if (division === 'quran' && groupId) {
          feeQuery += ` AND group_id = ?`;
          fParams.push(groupId);
        }
        feeQuery += ` ORDER BY (billing_period = ?) DESC, id DESC LIMIT 1`;
        fParams.push(period);
        const [fRule] = await conn.execute(feeQuery, fParams);
        const standardFee = fRule.length > 0 ? parseFloat(fRule[0].standard_fee) : 25.00;

        const [disc] = await conn.execute(
          `SELECT * FROM student_discounts
           WHERE student_id = ? AND (division = ? OR division = 'both')
             AND is_active = 1 AND (billing_period IS NULL OR billing_period = ?)
           ORDER BY (billing_period = ?) DESC, id DESC
           LIMIT 1`,
          [student_id, division, period, period]
        );

        let discountAmt = 0.00;
        if (disc.length > 0) {
          discountAmt = disc[0].discount_type === 'percentage'
            ? (standardFee * parseFloat(disc[0].discount_value)) / 100
            : parseFloat(disc[0].discount_value);
        }
        if (discountAmt > standardFee) discountAmt = standardFee;

        amountDue = standardFee - discountAmt;
        if (payAmount > amountDue) {
          const validationError = new Error(`Lacagta la bixinayo ($${payAmount.toFixed(2)}) kama badnaan karto khidmadda waajibka ah ($${amountDue.toFixed(2)}).`);
          validationError.status = 400;
          throw validationError;
        }

        const invNum = `INV-${division === 'institute' ? 'INST' : 'QUR'}-${feeType.slice(0, 3).toUpperCase()}-${period.replace(/[^0-9A-Za-z]/g, '')}-${String(student.id).padStart(4, '0')}`;

        const [newInv] = await conn.execute(
          `INSERT INTO fee_invoices (invoice_number, student_id, division, fee_type, class_id, group_id, billing_period, standard_fee, discount_amount, amount_due, amount_paid, balance, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'unpaid')`,
          [invNum, student_id, division, feeType, classId, groupId, period, standardFee, discountAmt, amountDue, amountDue]
        );
        invoiceId = newInv.insertId;
      }

      // 4. Generate unique receipt number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const [[{ nextId }]] = await conn.execute(`SELECT COALESCE(MAX(id), 0) + 1 as nextId FROM payments`);
      const receiptNumber = `REC-${division === 'institute' ? 'INST' : 'QUR'}-${dateStr}-${String(nextId).padStart(4, '0')}`;

      // 5. Insert payment record
      const [payRes] = await conn.execute(
        `INSERT INTO payments (receipt_number, invoice_id, student_id, division, amount_paid, payment_date, received_by, notes, status)
         VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, 'valid')`,
        [receiptNumber, invoiceId, student_id, division, payAmount, payment_date || null, user.id, notes || null]
      );

      // 6. Recalculate invoice totals and balance safely
      const newTotalPaid = prevPaid + payAmount;
      const newBalance = Math.max(0, amountDue - newTotalPaid);
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';

      await conn.execute(
        `UPDATE fee_invoices 
         SET amount_paid = ?, balance = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newTotalPaid, newBalance, newStatus, invoiceId]
      );

      return {
        paymentId: payRes.insertId,
        id: payRes.insertId,
        receiptNumber,
        receipt_number: receiptNumber,
        invoiceId,
        invoice_id: invoiceId,
        studentName: student.full_name,
        student_name: student.full_name,
        studentCode: student.student_id,
        student_code: student.student_id,
        amountPaid: payAmount,
        amount_paid: payAmount,
        amount_due: amountDue,
        billing_period: period,
        fee_type: feeType,
        newBalance,
        balance: newBalance,
        newStatus,
        status: newStatus,
        division,
        classOrGroupName,
        class_or_group_name: classOrGroupName,
        payment_date: payment_date || new Date().toISOString()
      };
    });


    // 7. Audit log & In-app Super Admin notification
    await logAudit({
      userId: user.id,
      action: 'RECEIVE_PAYMENT',
      module: 'finance',
      division,
      recordId: receiptResult.paymentId,
      details: `Received payment of $${payAmount} for student ${receiptResult.studentName} (${receiptResult.studentCode}). Receipt: ${receiptResult.receiptNumber}`,
      afterValue: receiptResult,
      ipAddress: req.ip
    });

    await createNotification({
      type: 'payment_recorded',
      title: `Lacag-bixin cusub ($${payAmount}): ${receiptResult.studentName}`,
      message: `Qasnaji ${user.full_name} ayaa qabtay lacag dhan $${payAmount} oo ah waaxda ${division === 'institute' ? 'Machadka' : 'Quraanka'}. Rasiidka: ${receiptResult.receiptNumber}`,
      division,
      metadata: receiptResult
    });

    res.status(201).json({
      success: true,
      message: 'Lacag-bixinta si guul leh ayaa loo qabtay, rasiidkana waa la soo saaray.',
      receipt: receiptResult
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Get Payment Receipt Details
 */
export async function getReceipt(req, res, next) {
  try {
    const { receipt_number } = req.params;

    const [payment] = await query(
      `SELECT p.*, s.student_id as student_code, s.full_name as student_name, s.phone as student_phone,
              fi.invoice_number, fi.fee_type, fi.billing_period, fi.standard_fee, fi.discount_amount,
              fi.amount_due, fi.amount_paid as invoice_amount_paid, fi.balance,
              u.full_name as received_by_name,
              ic.name as class_name, qg.name as group_name
       FROM payments p
       JOIN students s ON p.student_id = s.id
       JOIN fee_invoices fi ON p.invoice_id = fi.id
       JOIN users u ON p.received_by = u.id
       LEFT JOIN institute_classes ic ON fi.class_id = ic.id
       LEFT JOIN quran_groups qg ON fi.group_id = qg.id
       WHERE p.receipt_number = ?`,
      [receipt_number]
    );

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Rasiidka lama helin.' });
    }

    if (!canAccessDivision(req.session.user, payment.division)) {
      return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku aragto rasiidkan.' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
}

/**
 * Controlled Payment Adjustment / Reversal (No silent deletes)
 */
export async function adjustPayment(req, res, next) {
  try {
    const user = req.session.user;
    const { payment_id, new_amount, reason } = req.body;

    if (!payment_id || new_amount === undefined || !reason) {
      return res.status(400).json({
        success: false,
        error: 'ID-ga lacag-bixinta, cadadka cusub, iyo sababta waa qasab.'
      });
    }

    const newAmt = parseFloat(new_amount);
    if (isNaN(newAmt) || newAmt < 0) {
      return res.status(400).json({ success: false, error: 'Cadadka cusub waa inuu noqdaa tiro sax ah.' });
    }

    const result = await withTransaction(async (conn) => {
      const [[payment]] = await conn.execute(
        `SELECT * FROM payments WHERE id = ? FOR UPDATE`,
        [payment_id]
      );

      if (!payment) {
        throw new Error('Lacag-bixinta lama helin.');
      }

      const oldAmt = parseFloat(payment.amount_paid);

      // Record adjustment in audit table
      await conn.execute(
        `INSERT INTO payment_adjustments (payment_id, old_amount, new_amount, reason, adjusted_by)
         VALUES (?, ?, ?, ?, ?)`,
        [payment_id, oldAmt, newAmt, reason.trim(), user.id]
      );

      // Update payment
      const status = newAmt === 0 ? 'reversed' : 'adjusted';
      await conn.execute(
        `UPDATE payments SET amount_paid = ?, status = ? WHERE id = ?`,
        [newAmt, status, payment_id]
      );

      // Recalculate invoice
      const [[{ totalPaid }]] = await conn.execute(
        `SELECT COALESCE(SUM(amount_paid), 0) as totalPaid FROM payments WHERE invoice_id = ? AND status != 'reversed'`,
        [payment.invoice_id]
      );

      const [[invoice]] = await conn.execute(
        `SELECT amount_due FROM fee_invoices WHERE id = ?`,
        [payment.invoice_id]
      );

      const balance = parseFloat(invoice.amount_due) - parseFloat(totalPaid);
      const invStatus = balance <= 0 ? 'paid' : (parseFloat(totalPaid) > 0 ? 'partial' : 'unpaid');

      await conn.execute(
        `UPDATE fee_invoices SET amount_paid = ?, balance = ?, status = ? WHERE id = ?`,
        [totalPaid, balance, invStatus, payment.invoice_id]
      );

      return { oldAmt, newAmt, receiptNumber: payment.receiptNumber, division: payment.division };
    });

    await logAudit({
      userId: user.id,
      action: 'ADJUST_PAYMENT',
      module: 'finance',
      division: result.division,
      recordId: payment_id,
      details: `Adjusted payment ${result.receiptNumber} from $${result.oldAmt} to $${result.newAmt}. Reason: ${reason}`,
      beforeValue: { amount_paid: result.oldAmt },
      afterValue: { amount_paid: result.newAmt, reason },
      ipAddress: req.ip
    });

    await createNotification({
      type: 'fee_adjusted',
      title: `Wax-ka-beddel lacag-bixineed: ${result.receiptNumber}`,
      message: `Lacag-bixinta ${result.receiptNumber} waxaa laga beddelay $${result.oldAmt} waxaana laga dhigay $${result.newAmt}. Sababta: ${reason} (Waxaa beddelay: ${user.full_name})`,
      division: result.division
    });

    res.json({
      success: true,
      message: 'Dib-u-hagaajinta lacagta si guul leh ayaa loo diiwaangeliyay.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Official Fee Rules & Discounts (Settings for Super Admin)
 */
export async function getFeeRules(req, res, next) {
  try {
    const user = req.session.user;
    const scopeWhere = user.division_scope && user.division_scope !== 'all' ? 'WHERE fr.division = ?' : '';
    const scopeParams = scopeWhere ? [user.division_scope] : [];
    const rules = await query(`
      SELECT fr.*, ic.name as class_name, qg.name as group_name, u.full_name as created_by_name
      FROM fee_rules fr
      LEFT JOIN institute_classes ic ON fr.class_id = ic.id
      LEFT JOIN quran_groups qg ON fr.group_id = qg.id
      LEFT JOIN users u ON fr.created_by = u.id
      ${scopeWhere}
      ORDER BY fr.division ASC, fr.id ASC
    `, scopeParams);
    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
}

export async function setFeeRule(req, res, next) {
  try {
    const user = req.session.user;
    const { division, fee_type = 'monthly', class_id, group_id, billing_period, standard_fee } = req.body;

    if (!division || !['monthly', 'registration'].includes(fee_type) || !billing_period || standard_fee === undefined) {
      return res.status(400).json({ success: false, error: 'Waaxda, wareegga biilka, iyo lacagtu waa qasab.' });
    }

    if (!canAccessDivision(user, division)) {
      return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku maamusho waaxdan.' });
    }

    const fee = parseFloat(standard_fee);
    if (isNaN(fee) || fee < 0) {
      return res.status(400).json({ success: false, error: 'Lacagtu waa inay noqotaa tiro togan.' });
    }

    await query(
      `INSERT INTO fee_rules (division, fee_type, class_id, group_id, billing_period, standard_fee, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [division, fee_type, class_id || null, group_id || null, billing_period.trim(), fee, user.id]
    );

    await logAudit({
      userId: user.id,
      action: 'CREATE_FEE_RULE',
      module: 'finance',
      division,
      details: `Created official ${fee_type} fee rule of $${fee} for ${division} (${billing_period})`,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, message: 'Xeerka khidmadda rasmiga ah waa la keydiyay.' });
  } catch (error) {
    next(error);
  }
}

export async function getStudentDiscounts(req, res, next) {
  try {
    const user = req.session.user;
    const scopeWhere = user.division_scope && user.division_scope !== 'all' ? `WHERE (sd.division = ? OR sd.division = 'both')` : '';
    const scopeParams = scopeWhere ? [user.division_scope] : [];
    const discounts = await query(`
      SELECT sd.*, s.student_id as student_code, s.full_name as student_name, u.full_name as approved_by_name
      FROM student_discounts sd
      JOIN students s ON sd.student_id = s.id
      JOIN users u ON sd.approved_by = u.id
      ${scopeWhere}
      ORDER BY sd.id DESC
    `, scopeParams);
    res.json({ success: true, data: discounts });
  } catch (error) {
    next(error);
  }
}

export async function createStudentDiscount(req, res, next) {
  try {
    const user = req.session.user;
    const { student_id, division, discount_type, discount_value, reason, billing_period } = req.body;

    if (!student_id || !division || discount_value === undefined || !reason) {
      return res.status(400).json({ success: false, error: 'Xogta dhimistu ma dhammaystirna.' });
    }

    if (!canAccessDivision(user, division)) {
      return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku maamusho waaxdan.' });
    }

    const val = parseFloat(discount_value);
    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ success: false, error: 'Qiimaha dhimistu waa inuu noqdaa tiro togan.' });
    }

    await query(
      `INSERT INTO student_discounts (student_id, division, discount_type, discount_value, reason, billing_period, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [student_id, division, discount_type || 'fixed', val, reason.trim(), billing_period || null, user.id]
    );

    await logAudit({
      userId: user.id,
      action: 'APPROVE_DISCOUNT',
      module: 'finance',
      division,
      recordId: student_id,
      details: `Approved ${discount_type} discount of ${val} for student ID ${student_id}`,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, message: 'Dhimista ardayga si guul leh ayaa loo oggolaaday.' });
  } catch (error) {
    next(error);
  }
}

/**
 * 6. Payment Matrix (Monthly payment tracking across 12 months for a selected year)
 */
export async function getPaymentMatrix(req, res, next) {
  try {
    const user = req.session.user;
    const {
      division = 'institute',
      year = new Date().getFullYear().toString(),
      class_id,
      group_id,
      search,
      status // 'all', 'paid', 'partial', 'unpaid'
    } = req.query;

    // Division scope enforcement
    if (user.division_scope !== 'all' && user.role !== 'super_admin') {
      if (user.division_scope !== division) {
        return res.status(403).json({
          success: false,
          error: `Ma lihid awood aad ku aragto maaliyadda waaxda ${division === 'institute' ? 'Machadka' : 'Quraanka'}.`
        });
      }
    }

    // 1. Fetch enrolled students for this division
    let studentSql = '';
    const studentParams = [];

    if (division === 'institute') {
      studentSql = `
        SELECT DISTINCT s.id, s.student_id as student_code, s.full_name, s.name_ar, s.gender, s.phone,
               ie.class_id, ic.name as class_or_group_name
        FROM students s
        JOIN institute_enrollments ie ON s.id = ie.student_id AND ie.status = 'active'
        LEFT JOIN institute_classes ic ON ie.class_id = ic.id
        WHERE 1=1
      `;
      if (class_id && class_id !== 'all') {
        studentSql += ` AND ie.class_id = ?`;
        studentParams.push(class_id);
      }
    } else {
      studentSql = `
        SELECT DISTINCT s.id, s.student_id as student_code, s.full_name, s.name_ar, s.gender, s.phone,
               qe.group_id, qg.name as class_or_group_name
        FROM students s
        JOIN quran_enrollments qe ON s.id = qe.student_id AND qe.status = 'active'
        LEFT JOIN quran_groups qg ON qe.group_id = qg.id
        WHERE 1=1
      `;
      if (group_id && group_id !== 'all') {
        studentSql += ` AND qe.group_id = ?`;
        studentParams.push(group_id);
      }
    }

    if (search && search.trim()) {
      const st = `%${search.trim()}%`;
      studentSql += ` AND (s.full_name LIKE ? OR s.name_ar LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ?)`;
      studentParams.push(st, st, st, st);
    }

    studentSql += ` ORDER BY s.id ASC`;
    const students = await query(studentSql, studentParams);

    // 2. Fetch all invoices for this division in the selected year
    const yearPattern = `${year}-%`;
    const invoices = await query(
      `SELECT fi.* 
       FROM fee_invoices fi
       WHERE fi.division = ? AND fi.billing_period LIKE ?`,
      [division, yearPattern]
    );

    const invoiceMap = new Map();
    for (const inv of invoices) {
      invoiceMap.set(`${inv.student_id}_${inv.billing_period}`, inv);
    }

    const monthNames = [
      { key: '01', en: 'Jan', so: 'Jannaayo' },
      { key: '02', en: 'Feb', so: 'Febraayo' },
      { key: '03', en: 'Mar', so: 'Maarso' },
      { key: '04', en: 'Apr', so: 'Abriil' },
      { key: '05', en: 'May', so: 'Maayo' },
      { key: '06', en: 'Jun', so: 'Juun' },
      { key: '07', en: 'Jul', so: 'Luuliyo' },
      { key: '08', en: 'Aug', so: 'Ogosto' },
      { key: '09', en: 'Sep', so: 'Sebtembar' },
      { key: '10', en: 'Oct', so: 'Oktoobar' },
      { key: '11', en: 'Nov', so: 'Nofembar' },
      { key: '12', en: 'Dec', so: 'Diseembar' }
    ];

    let matrixRows = [];
    let grandTotalPaid = 0;
    let grandTotalOutstanding = 0;

    for (const st of students) {
      let totalPaidYear = 0;
      let totalBalanceYear = 0;
      let unpaidCount = 0;
      let partialCount = 0;
      let paidCount = 0;

      const monthsData = monthNames.map(m => {
        const period = `${year}-${m.key}`;
        const inv = invoiceMap.get(`${st.id}_${period}`);

        if (inv) {
          const paid = parseFloat(inv.amount_paid) || 0;
          const due = parseFloat(inv.amount_due) || 0;
          const rawBal = parseFloat(inv.balance) || 0;
          const bal = Math.max(0, rawBal);
          const invStatus = inv.status;

          let cellStatus = 'unpaid';
          if (invStatus === 'paid' || bal <= 0) {
            cellStatus = 'paid';
            paidCount++;
          } else if (paid > 0 && bal > 0) {
            cellStatus = 'partial';
            partialCount++;
          } else {
            cellStatus = 'unpaid';
            unpaidCount++;
          }

          totalPaidYear += paid;
          totalBalanceYear += bal;

          return {
            month_key: m.key,
            month_num: parseInt(m.key, 10),
            month_name: m.en,
            month_name_so: m.so,
            billing_period: period,
            period: period,
            status: cellStatus,
            amount_due: due,
            amount_paid: paid,
            balance: bal,
            standard_fee: parseFloat(inv.standard_fee) || due,
            discount_amount: parseFloat(inv.discount_amount) || 0,
            invoice_number: inv.invoice_number
          };
        } else {
          return {
            month_key: m.key,
            month_num: parseInt(m.key, 10),
            month_name: m.en,
            month_name_so: m.so,
            billing_period: period,
            period: period,
            status: 'na',
            amount_due: 0,
            amount_paid: 0,
            balance: 0,
            standard_fee: 0,
            discount_amount: 0,
            invoice_number: null
          };
        }
      });

      const monthsObj = {};
      for (const mData of monthsData) {
        monthsObj[mData.month_key] = mData;
      }

      grandTotalPaid += totalPaidYear;
      grandTotalOutstanding += totalBalanceYear;

      matrixRows.push({
        id: st.id,
        student_id: st.student_code,
        student_code: st.student_code,
        full_name: st.full_name,
        name_ar: st.name_ar,
        phone: st.phone,
        class_name: st.class_or_group_name || 'Lama qorin',
        class_or_group_name: st.class_or_group_name || 'Lama qorin',
        months: monthsObj,
        months_list: monthsData,
        summary: {
          total_paid: Math.round(totalPaidYear * 100) / 100,
          total_balance: Math.round(totalBalanceYear * 100) / 100,
          paid_count: paidCount,
          partial_count: partialCount,
          unpaid_count: unpaidCount
        }
      });
    }

    // Apply status filter if requested
    if (status && status !== 'all') {
      if (status === 'unpaid') {
        matrixRows = matrixRows.filter(r => r.summary.unpaid_count > 0);
      } else if (status === 'partial') {
        matrixRows = matrixRows.filter(r => r.summary.partial_count > 0);
      } else if (status === 'paid') {
        matrixRows = matrixRows.filter(r => r.summary.total_balance === 0 && r.summary.total_paid > 0);
      }
    }

    res.json({
      success: true,
      data: {
        year,
        division,
        students: matrixRows,
        summary: {
          total_students: matrixRows.length,
          grand_total_paid: Math.round(grandTotalPaid * 100) / 100,
          grand_total_balance: Math.round(grandTotalOutstanding * 100) / 100,
          grand_total_outstanding: Math.round(grandTotalOutstanding * 100) / 100
        }
      }
    });
  } catch (error) {
    next(error);
  }
}
