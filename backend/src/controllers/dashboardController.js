import { query } from '../db/connection.js';

export async function getGeneralDashboardStats(req, res, next) {
  try {
    const user = req.session.user;

    // Common counts
    const [{ totalStudents }] = await query(`SELECT COUNT(*) as totalStudents FROM students WHERE is_active = 1`);
    const [{ instituteStudents }] = await query(`SELECT COUNT(DISTINCT student_id) as instituteStudents FROM institute_enrollments WHERE status = 'active'`);
    const [{ quranStudents }] = await query(`SELECT COUNT(DISTINCT student_id) as quranStudents FROM quran_enrollments WHERE status = 'active'`);
    const [{ totalTeachers }] = await query(`SELECT COUNT(*) as totalTeachers FROM users WHERE role_id = 7 AND is_active = 1`);

    // Institute counts
    const [{ totalClasses }] = await query(`SELECT COUNT(*) as totalClasses FROM institute_classes WHERE is_active = 1`);
    const [{ totalSubjects }] = await query(`SELECT COUNT(*) as totalSubjects FROM institute_subjects WHERE is_active = 1`);

    // Quran counts
    const [{ totalGroups }] = await query(`SELECT COUNT(*) as totalGroups FROM quran_groups WHERE is_active = 1`);
    const [{ totalHifdhEntries }] = await query(`SELECT COUNT(*) as totalHifdhEntries FROM quran_progress`);

    // Financial totals
    const [financeTotals] = await query(`
      SELECT 
        COALESCE(SUM(amount_paid), 0) as total_paid,
        COALESCE(SUM(CASE WHEN division = 'institute' THEN amount_paid ELSE 0 END), 0) as institute_paid,
        COALESCE(SUM(CASE WHEN division = 'quran' THEN amount_paid ELSE 0 END), 0) as quran_paid
      FROM payments WHERE status = 'valid'
    `);

    const [outstandingTotals] = await query(`
      SELECT 
        COALESCE(SUM(balance), 0) as total_balance,
        COALESCE(SUM(CASE WHEN division = 'institute' THEN balance ELSE 0 END), 0) as institute_balance,
        COALESCE(SUM(CASE WHEN division = 'quran' THEN balance ELSE 0 END), 0) as quran_balance
      FROM fee_invoices
    `);

    // Recent audits
    const recentAudit = await query(`
      SELECT a.*, u.full_name as actor_name, u.username as actor_username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC LIMIT 8
    `);

    res.json({
      success: true,
      data: {
        role: user.role,
        division_scope: user.division_scope,
        students: {
          total: totalStudents,
          institute: instituteStudents,
          quran: quranStudents
        },
        teachers: totalTeachers,
        institute: {
          classes: totalClasses,
          subjects: totalSubjects,
          financial_collected: parseFloat(financeTotals.institute_paid || 0),
          outstanding_balance: parseFloat(outstandingTotals.institute_balance || 0)
        },
        quran: {
          groups: totalGroups,
          hifdh_entries: totalHifdhEntries,
          financial_collected: parseFloat(financeTotals.quran_paid || 0),
          outstanding_balance: parseFloat(outstandingTotals.quran_balance || 0)
        },
        financial_combined: {
          total_collected: parseFloat(financeTotals.total_paid || 0),
          total_outstanding: parseFloat(outstandingTotals.total_balance || 0)
        },
        recent_audit: recentAudit
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getNotifications(req, res, next) {
  try {
    const user = req.session.user;
    let whereSql = '';
    const params = [];

    if (user.role === 'teacher') {
      // 1. Teachers: Completely hide payment-related notifications (types, amounts, receipts)
      whereSql = `(user_id = ? OR (user_id IS NULL AND division IN ('system', ?)))
                  AND type NOT IN ('payment_recorded', 'fee_adjusted')
                  AND type NOT LIKE 'payment_%'
                  AND type NOT LIKE 'fee_%'`;
      params.push(user.id, user.division_scope || 'quran');
    } else if (user.role === 'quran_admin' || user.division_scope === 'quran') {
      // 2. Quran Admin: Only access Quran School and system notifications
      whereSql = `(user_id = ? OR user_id IS NULL) AND division IN ('quran', 'system')`;
      params.push(user.id);
    } else if (user.role === 'institute_admin' || user.division_scope === 'institute') {
      // 3. Institute Admin: Only access Institute and system notifications
      whereSql = `(user_id = ? OR user_id IS NULL) AND division IN ('institute', 'system')`;
      params.push(user.id);
    } else {
      // 4. Super Admin & Finance User: Full system or scoped notifications
      whereSql = `(user_id = ? OR user_id IS NULL)`;
      params.push(user.id);
    }

    const notifs = await query(
      `SELECT id, user_id, type, title, message, division, is_read, metadata, created_at 
       FROM notifications 
       WHERE ${whereSql}
       ORDER BY created_at DESC LIMIT 50`,
      params
    );

    const [{ unreadCount } = { unreadCount: 0 }] = await query(
      `SELECT COUNT(*) as unreadCount 
       FROM notifications 
       WHERE ${whereSql} AND is_read = 0`,
      params
    );

    res.json({ success: true, data: notifs, unread_count: unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.session.user;

    // Verify ownership or role-based permission
    if (user.role === 'teacher') {
      const [notif] = await query(
        `SELECT id, type FROM notifications 
         WHERE id = ? AND (type IN ('payment_recorded', 'fee_adjusted') OR type LIKE 'payment_%' OR type LIKE 'fee_%')`,
        [id]
      );
      if (notif) {
        return res.status(403).json({ success: false, error: 'Ma lihid fasax aad ku aragto ogeysiisyada lacagaha.' });
      }
    }

    await query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Ogeysiiska waa la calaamadeeyay.' });
  } catch (error) {
    next(error);
  }
}

export async function getDashboardAnalytics(req, res, next) {
  try {
    const user = req.session.user;
    let requestedDivision = req.query.division || 'all';

    // Enforce division authorization
    if (user.role === 'institute_admin') {
      requestedDivision = 'institute';
    } else if (user.role === 'quran_admin') {
      requestedDivision = 'quran';
    } else if (user.division_scope && user.division_scope !== 'all') {
      requestedDivision = user.division_scope;
    }

    const canViewFinance = ['super_admin', 'finance_officer'].includes(user.role) ||
      (user.role === 'institute_admin' && requestedDivision !== 'quran') ||
      (user.role === 'quran_admin' && requestedDivision !== 'institute');

    // 1. Total Students
    let totalStudents = 0;
    if (requestedDivision === 'institute') {
      const [{ count }] = await query(`
        SELECT COUNT(DISTINCT student_id) as count 
        FROM institute_enrollments 
        WHERE status = 'active'
      `);
      totalStudents = count;
    } else if (requestedDivision === 'quran') {
      const [{ count }] = await query(`
        SELECT COUNT(DISTINCT student_id) as count 
        FROM quran_enrollments 
        WHERE status = 'active'
      `);
      totalStudents = count;
    } else {
      const [{ count }] = await query(`SELECT COUNT(*) as count FROM students WHERE is_active = 1`);
      totalStudents = count;
    }

    // 2. Total Classes / Groups
    let totalClasses = 0;
    let classesLabel = 'Fasallada Firfircoon';
    if (requestedDivision === 'institute') {
      const [{ count }] = await query(`SELECT COUNT(*) as count FROM institute_classes WHERE is_active = 1`);
      totalClasses = count;
      classesLabel = 'Fasallada Machadka';
    } else if (requestedDivision === 'quran') {
      const [{ count }] = await query(`SELECT COUNT(*) as count FROM quran_groups WHERE is_active = 1`);
      totalClasses = count;
      classesLabel = 'Halaqaadka Quraanka';
    } else {
      const [{ instClasses }] = await query(`SELECT COUNT(*) as instClasses FROM institute_classes WHERE is_active = 1`);
      const [{ quranGroups }] = await query(`SELECT COUNT(*) as quranGroups FROM quran_groups WHERE is_active = 1`);
      totalClasses = Number(instClasses || 0) + Number(quranGroups || 0);
      classesLabel = 'Fasallada & Halaqaadka';
    }

    // 3. Attendance Rate Calculation: ((Present + 0.5 * Late) / Total Recorded Entries) * 100
    let attRecord = { total_records: 0, present_count: 0, late_count: 0, absent_count: 0 };
    if (requestedDivision === 'institute') {
      const [rec] = await query(`
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM institute_attendance a
        JOIN institute_class_sessions s ON a.session_id = s.id
      `);
      attRecord = rec || attRecord;
    } else if (requestedDivision === 'quran') {
      const [rec] = await query(`
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM quran_attendance a
        JOIN quran_sessions s ON a.session_id = s.id
      `);
      attRecord = rec || attRecord;
    } else {
      const [instRec] = await query(`
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM institute_attendance a
        JOIN institute_class_sessions s ON a.session_id = s.id
      `);
      const [quranRec] = await query(`
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
        FROM quran_attendance a
        JOIN quran_sessions s ON a.session_id = s.id
      `);
      attRecord = {
        total_records: Number(instRec?.total_records || 0) + Number(quranRec?.total_records || 0),
        present_count: Number(instRec?.present_count || 0) + Number(quranRec?.present_count || 0),
        late_count: Number(instRec?.late_count || 0) + Number(quranRec?.late_count || 0),
        absent_count: Number(instRec?.absent_count || 0) + Number(quranRec?.absent_count || 0)
      };
    }

    const attendanceRate = attRecord.total_records > 0
      ? Number((((Number(attRecord.present_count) + 0.5 * Number(attRecord.late_count)) / Number(attRecord.total_records)) * 100).toFixed(1))
      : null;

    // 4. Outstanding Student Fees
    let outstandingFees = null;
    let totalCollected = null;
    if (canViewFinance) {
      let feeSql = `SELECT COALESCE(SUM(balance), 0) as outstanding FROM fee_invoices WHERE status IN ('unpaid', 'partial') AND balance > 0`;
      let paySql = `SELECT COALESCE(SUM(amount_paid), 0) as collected FROM payments WHERE status = 'valid'`;
      const feeParams = [];
      const payParams = [];

      if (requestedDivision === 'institute') {
        feeSql += ` AND division = 'institute'`;
        paySql += ` AND division = 'institute'`;
      } else if (requestedDivision === 'quran') {
        feeSql += ` AND division = 'quran'`;
        paySql += ` AND division = 'quran'`;
      }

      const [feeRow] = await query(feeSql, feeParams);
      const [payRow] = await query(paySql, payParams);
      outstandingFees = Number(Number(feeRow.outstanding || 0).toFixed(2));
      totalCollected = Number(Number(payRow.collected || 0).toFixed(2));
    }

    // 5. Academic Performance (Average Exam Marks Percentage)
    let academicPerformance = null;
    if (requestedDivision !== 'quran') {
      const [perfRow] = await query(`
        SELECT 
          COUNT(m.id) as marks_count,
          ROUND(AVG(m.percentage), 1) as avg_pct
        FROM institute_exam_marks m
        JOIN institute_exams e ON m.exam_id = e.id
        WHERE m.is_absent = 0 AND m.marks_obtained IS NOT NULL
      `);
      if (perfRow && perfRow.marks_count > 0 && perfRow.avg_pct !== null) {
        academicPerformance = Number(perfRow.avg_pct);
      }
    }

    // --- CHART 1: Student Enrollment Trend (Monthly) ---
    let enrollmentTrendSql = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as ym,
        DATE_FORMAT(created_at, '%b %Y') as period,
        COUNT(*) as new_students
      FROM students
      WHERE is_active = 1
      GROUP BY ym, period
      ORDER BY ym ASC
      LIMIT 12
    `;
    if (requestedDivision === 'institute') {
      enrollmentTrendSql = `
        SELECT 
          DATE_FORMAT(COALESCE(ie.enrollment_date, s.created_at), '%Y-%m') as ym,
          DATE_FORMAT(COALESCE(ie.enrollment_date, s.created_at), '%b %Y') as period,
          COUNT(DISTINCT s.id) as new_students
        FROM students s
        JOIN institute_enrollments ie ON s.id = ie.student_id
        WHERE ie.status = 'active' AND s.is_active = 1
        GROUP BY ym, period
        ORDER BY ym ASC
        LIMIT 12
      `;
    } else if (requestedDivision === 'quran') {
      enrollmentTrendSql = `
        SELECT 
          DATE_FORMAT(COALESCE(qe.enrollment_date, s.created_at), '%Y-%m') as ym,
          DATE_FORMAT(COALESCE(qe.enrollment_date, s.created_at), '%b %Y') as period,
          COUNT(DISTINCT s.id) as new_students
        FROM students s
        JOIN quran_enrollments qe ON s.id = qe.student_id
        WHERE qe.status = 'active' AND s.is_active = 1
        GROUP BY ym, period
        ORDER BY ym ASC
        LIMIT 12
      `;
    }
    const rawEnrollment = await query(enrollmentTrendSql);
    let cumulativeCount = 0;
    const enrollmentTrend = rawEnrollment.map(row => {
      cumulativeCount += Number(row.new_students);
      return {
        ym: row.ym,
        period: row.period,
        new_students: Number(row.new_students),
        cumulative: cumulativeCount
      };
    });

    // --- CHART 2: Attendance Overview (Session / Date Trend) ---
    let attendanceTrend = [];
    if (requestedDivision === 'quran') {
      attendanceTrend = await query(`
        SELECT 
          DATE_FORMAT(s.session_date, '%Y-%m-%d') as date,
          DATE_FORMAT(s.session_date, '%d %b') as display_date,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
          COUNT(*) as total
        FROM quran_attendance a
        JOIN quran_sessions s ON a.session_id = s.id
        GROUP BY s.session_date
        ORDER BY s.session_date ASC
        LIMIT 14
      `);
    } else {
      attendanceTrend = await query(`
        SELECT 
          DATE_FORMAT(s.session_date, '%Y-%m-%d') as date,
          DATE_FORMAT(s.session_date, '%d %b') as display_date,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
          SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
          COUNT(*) as total
        FROM institute_attendance a
        JOIN institute_class_sessions s ON a.session_id = s.id
        GROUP BY s.session_date
        ORDER BY s.session_date ASC
        LIMIT 14
      `);
    }

    const formattedAttendanceTrend = attendanceTrend.map(row => {
      const pres = Number(row.present || 0);
      const abs = Number(row.absent || 0);
      const lt = Number(row.late || 0);
      const tot = Number(row.total || 0);
      const pct = tot > 0 ? Number((((pres + 0.5 * lt) / tot) * 100).toFixed(1)) : 0;
      return {
        date: row.date,
        display_date: row.display_date,
        present: pres,
        absent: abs,
        late: lt,
        total: tot,
        rate: pct
      };
    });

    // --- CHART 3: Examination Performance (Subject Averages) ---
    let examPerformance = [];
    if (requestedDivision !== 'quran') {
      examPerformance = await query(`
        SELECT 
          s.name as subject,
          COUNT(m.id) as students_count,
          ROUND(AVG(m.percentage), 1) as avg_pct
        FROM institute_exam_marks m
        JOIN institute_exams e ON m.exam_id = e.id
        JOIN institute_subjects s ON e.subject_id = s.id
        WHERE m.is_absent = 0 AND m.marks_obtained IS NOT NULL
        GROUP BY s.id, s.name
        ORDER BY avg_pct DESC
        LIMIT 8
      `);
    }

    // --- CHART 4: Financial Overview ---
    let financialOverview = {
      can_view_finance: canViewFinance,
      total_collected: totalCollected,
      total_outstanding: outstandingFees,
      collection_rate: (totalCollected && outstandingFees !== null && (totalCollected + outstandingFees) > 0)
        ? Number(((totalCollected / (totalCollected + outstandingFees)) * 100).toFixed(1))
        : 100,
      monthly: []
    };

    if (canViewFinance) {
      let divClause = '';
      if (requestedDivision === 'institute') divClause = " AND division = 'institute'";
      if (requestedDivision === 'quran') divClause = " AND division = 'quran'";

      const monthlyCollections = await query(`
        SELECT 
          DATE_FORMAT(payment_date, '%Y-%m') as ym,
          DATE_FORMAT(payment_date, '%b %Y') as period,
          SUM(amount_paid) as collected
        FROM payments
        WHERE status = 'valid' ${divClause}
        GROUP BY ym, period
        ORDER BY ym ASC
        LIMIT 6
      `);

      const monthlyInvoices = await query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as ym,
          DATE_FORMAT(created_at, '%b %Y') as period,
          SUM(amount_due) as invoiced,
          SUM(CASE WHEN status IN ('unpaid', 'partial') AND balance > 0 THEN balance ELSE 0 END) as outstanding
        FROM fee_invoices
        WHERE 1=1 ${divClause}
        GROUP BY ym, period
        ORDER BY ym ASC
        LIMIT 6
      `);

      const financeMap = new Map();
      monthlyCollections.forEach(row => {
        financeMap.set(row.ym, {
          ym: row.ym,
          period: row.period,
          collected: Number(row.collected || 0),
          invoiced: 0,
          outstanding: 0
        });
      });

      monthlyInvoices.forEach(row => {
        if (!financeMap.has(row.ym)) {
          financeMap.set(row.ym, {
            ym: row.ym,
            period: row.period,
            collected: 0,
            invoiced: Number(row.invoiced || 0),
            outstanding: Number(row.outstanding || 0)
          });
        } else {
          const item = financeMap.get(row.ym);
          item.invoiced = Number(row.invoiced || 0);
          item.outstanding = Number(row.outstanding || 0);
        }
      });

      financialOverview.monthly = Array.from(financeMap.values()).sort((a, b) => a.ym.localeCompare(b.ym));
    }

    // --- RECENT ACTIVITIES (Human-Readable Audit Events) ---
    let auditSql = `
      SELECT a.id, a.action, a.module, a.division, a.details, a.created_at,
             u.full_name as actor_name, u.username as actor_username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const auditParams = [];
    if (requestedDivision === 'institute') {
      auditSql += ` AND (a.division = 'institute' OR a.division = 'system')`;
    } else if (requestedDivision === 'quran') {
      auditSql += ` AND (a.division = 'quran' OR a.division = 'system')`;
    }
    auditSql += ` ORDER BY a.created_at DESC LIMIT 8`;

    const rawAudits = await query(auditSql, auditParams);

    const formattedAudits = rawAudits.map(item => {
      let title = item.action || 'Dhaqdhaqaaq';
      let desc = item.details || '';
      let type = 'general';

      const act = (item.action || '').toUpperCase();
      const mod = (item.module || '').toLowerCase();

      if (act.includes('LOGIN')) {
        title = 'Soo Gelid Nidaamka';
        type = 'security';
      } else if (act.includes('STUDENT') || mod === 'students') {
        title = 'Diiwaanka Ardayda';
        type = 'student';
      } else if (act.includes('ATTENDANCE') || mod === 'attendance') {
        title = 'Xaadirinta Fasalka';
        type = 'attendance';
      } else if (act.includes('MARK') || act.includes('EXAM') || mod === 'exams') {
        title = 'Natiijada Imtixaanka';
        type = 'exam';
      } else if (act.includes('PAYMENT') || act.includes('INVOICE') || mod === 'finance') {
        title = 'Diiwaanka Maaliyadda';
        type = 'finance';
      } else if (act.includes('CLASS') || act.includes('SUBJECT') || mod === 'academic') {
        title = 'Qorshaha Akadeemiyada';
        type = 'academic';
      }

      if (typeof desc === 'string' && desc.startsWith('{') && desc.endsWith('}')) {
        try {
          const parsed = JSON.parse(desc);
          desc = parsed.message || parsed.description || Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(', ');
        } catch (_) {}
      }

      return {
        id: item.id,
        title,
        description: desc,
        action: item.action,
        module: item.module,
        type,
        actor: item.actor_name || item.actor_username || 'Nidaamka (System)',
        division: item.division,
        created_at: item.created_at
      };
    });

    res.json({
      success: true,
      data: {
        role: user.role,
        division_scope: user.division_scope,
        active_division: requestedDivision,
        academic_year: '2026',
        kpis: {
          total_students: totalStudents,
          total_classes: totalClasses,
          classes_label: classesLabel,
          attendance_rate: attendanceRate,
          attendance_recorded: attRecord.total_records > 0,
          outstanding_fees: outstandingFees,
          total_collected: totalCollected,
          academic_performance: academicPerformance,
          academic_performance_available: academicPerformance !== null,
          can_view_finance: canViewFinance
        },
        charts: {
          enrollment_trend: enrollmentTrend,
          attendance_trend: formattedAttendanceTrend,
          exam_performance: examPerformance,
          financial_overview: financialOverview
        },
        recent_activities: formattedAudits
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const { module, division, start_date, end_date } = req.query;
    let sql = `
      SELECT a.*, u.full_name as actor_name, u.username as actor_username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (module) {
      sql += ` AND a.module = ?`;
      params.push(module);
    }
    if (division) {
      sql += ` AND a.division = ?`;
      params.push(division);
    }
    if (start_date) {
      sql += ` AND DATE(a.created_at) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND DATE(a.created_at) <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT 100`;

    const logs = await query(sql, params);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}


