import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ReceiptModal from '../components/ReceiptModal';
import CenteredArabicExamReceipt from '../components/exams/CenteredArabicExamReceipt';
import {
  DollarSign,
  GraduationCap,
  CreditCard,
  FileText,
  Settings,
  Search,
  CheckCircle,
  AlertCircle,
  Printer,
  Edit,
  Clock,
  ArrowRight,
  Plus,
  Calendar,
  Wallet,
  Receipt,
  CheckCircle2,
  X,
  Filter,
  RotateCw,
  Award,
  History
} from 'lucide-react';

export default function FinancePage({ initialMenu = 'payments' }) {
  const { user, isSuperAdmin, isInstituteAdmin, isQuranAdmin, hasInstituteAccess, hasQuranAccess } = useAuth();
  const canManage = isSuperAdmin || isInstituteAdmin || isQuranAdmin;
  
  // Division context: Institute or Quran (or toggle for Super Admin / All)
  const [division, setDivision] = useState(() => {
    if (user?.division_scope === 'quran' || isQuranAdmin) return 'quran';
    return 'institute';
  });

  // Current active sub-menu: Payments, Reports, Settings
  const [activeMenu, setActiveMenu] = useState(initialMenu);

  // Data states
  const [feeRules, setFeeRules] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Payment Form States
  const [studentSearch, setStudentSearch] = useState('');
  const [searchedStudents, setSearchedStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [debtReminder, setDebtReminder] = useState(null);
  const [dismissedDebtReminderKey, setDismissedDebtReminderKey] = useState('');
  const [feeType, setFeeType] = useState('monthly');
  const [billingPeriod, setBillingPeriod] = useState('2026-05');
  const [examPeriods, setExamPeriods] = useState([]);
  const [examPeriod, setExamPeriod] = useState('');
  const [examFeeDetails, setExamFeeDetails] = useState(null);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccessMsg, setPaySuccessMsg] = useState('');
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [currentReceiptIsExam, setCurrentReceiptIsExam] = useState(false);

  // Controlled Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustPaymentItem, setAdjustPaymentItem] = useState(null);
  const [adjustNewAmount, setAdjustNewAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Settings: New Fee Rule
  const [newRuleType, setNewRuleType] = useState('monthly');
  const [newRulePeriod, setNewRulePeriod] = useState('2026-05');
  const [newRuleFee, setNewRuleFee] = useState('');

  // Settings: New Discount
  const [newDiscStudentId, setNewDiscStudentId] = useState('');
  const [newDiscType, setNewDiscType] = useState('fixed');
  const [newDiscVal, setNewDiscVal] = useState('');
  const [newDiscReason, setNewDiscReason] = useState('');

  useEffect(() => {
    loadMenuData();
  }, [activeMenu, division]);

  async function loadMenuData() {
    setLoading(true);
    try {
      if (activeMenu === 'reports') {
        const res = await api.getFinanceReports(`?division=${division}`);
        if (res.success) setPaymentHistory(res.data.records || []);
      } else if (activeMenu === 'settings') {
        const [rulesRes, discRes] = await Promise.all([
          api.getFeeRules(),
          api.getStudentDiscounts()
        ]);
        if (rulesRes.success) setFeeRules(rulesRes.data);
        if (discRes.success) setDiscounts(discRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadExamPeriods() {
    try {
      const res = await api.getExamPeriods('?academic_year=2026');
      if (res.success) {
        const rows = res.data || [];
        setExamPeriods(rows);
        if (!examPeriod && rows.length > 0) setExamPeriod(rows[0].name);
        return rows;
      }
    } catch (err) {
      console.error('Error loading exam periods:', err);
    }
    return [];
  }

  async function loadSelectedObligation(studentId, selectedFeeType = feeType, selectedPeriod = billingPeriod, selectedExamPeriod = examPeriod) {
    if (selectedFeeType === 'exam') {
      if (!selectedExamPeriod) return null;
      const res = await api.getStudentExamFeeStatus(
        `?student_id=${studentId}&exam_period=${encodeURIComponent(selectedExamPeriod)}&academic_year=2026`
      );
      if (res.success) {
        const exam = res.data;
        const normalized = {
          ...exam,
          fee_type: 'exam',
          standard_fee: Number(exam.official_fee || 0),
          amount_due: Number(exam.official_fee || 0),
          amount_paid_so_far: Number(exam.amount_paid || 0),
          balance_remaining: Number(exam.balance_remaining || 0),
          billing_period: exam.exam_period,
          class_or_group_name: exam.student?.class_name || ''
        };
        setExamFeeDetails(exam);
        setPaymentDetails(normalized);
        setAmountPaidNow(normalized.balance_remaining > 0 ? String(normalized.balance_remaining) : '');
        return normalized;
      }
      return null;
    }

    const res = await api.getPaymentDetails(studentId, division, selectedPeriod, selectedFeeType);
    if (res.success) {
      setExamFeeDetails(null);
      setPaymentDetails(res.data);
      setAmountPaidNow(res.data.balance_remaining > 0 ? res.data.balance_remaining.toString() : '');
      return res.data;
    }
    return null;
  }

  async function loadDebtReminder(student) {
    if (!student?.id) return;
    try {
      const profileRes = await api.getStudentFinancialProfile(student.id);
      if (!profileRes.success) return;
      const profile = profileRes.data;
      const debtRows = [
        ...(profile.obligations || []).filter(row => Number(row.balance || 0) > 0),
        ...(profile.payments || [])
          .filter(row => row.fee_type === 'exam' && Number(row.balance || 0) > 0)
          .map(row => ({ ...row, obligation_id: `exam-${row.transaction_id}` }))
      ];
      const totalOutstanding = Number(profile.summary?.total_outstanding || 0);
      const reminderKey = `${division}:${student.id}`;
      if (totalOutstanding > 0 && reminderKey !== dismissedDebtReminderKey) {
        const uniquePeriods = Array.from(new Map(
          debtRows.map(row => [`${row.fee_type}:${row.billing_period}`, row])
        ).values());
        setDebtReminder({
          key: reminderKey,
          studentName: profile.student?.full_name || student.full_name,
          periods: uniquePeriods.map(row => ({
            feeType: row.fee_type,
            period: row.billing_period,
            balance: Number(row.balance || 0)
          })),
          total: totalOutstanding
        });
      }
    } catch (err) {
      console.error('Unable to load debt reminder:', err);
    }
  }

  // Student Search in Payments Form
  async function searchForStudent(queryStr) {
    setStudentSearch(queryStr);
    if (!queryStr || queryStr.length < 2) {
      setSearchedStudents([]);
      return;
    }
    try {
      const res = await api.getStudents(`?search=${encodeURIComponent(queryStr)}&division=${division}`);
      if (res.success) {
        setSearchedStudents(res.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Select student and auto-load the selected obligation plus a concise debt reminder.
  async function handleSelectStudent(student, targetPeriod = null) {
    const periodToUse = targetPeriod || billingPeriod;
    setDebtReminder(null);
    if (targetPeriod) {
      setBillingPeriod(targetPeriod);
    }
    setSelectedStudent(student);
    setSearchedStudents([]);
    setStudentSearch(`${student.full_name} (${student.student_id})`);
    setPayError('');
    setPaySuccessMsg('');

    try {
      let examPeriodToUse = examPeriod;
      if (feeType === 'exam') {
        const rows = await loadExamPeriods();
        examPeriodToUse = examPeriodToUse || rows[0]?.name || '';
        if (!examPeriod && examPeriodToUse) setExamPeriod(examPeriodToUse);
      }
      await loadSelectedObligation(student.id, feeType, periodToUse, examPeriodToUse);
      await loadDebtReminder(student);
    } catch (err) {
      setPayError(err.message || 'Cilad ayaa dhacday soo dejinta xogta ardayga.');
    }
  }

  // Change billing period and refresh month fee & balance details
  async function handlePeriodChange(newPeriod) {
    setBillingPeriod(newPeriod);
    setPayError('');
    setPaySuccessMsg('');
    if (selectedStudent && feeType !== 'exam') {
      try {
        await loadSelectedObligation(selectedStudent.id, feeType, newPeriod, examPeriod);
      } catch (err) {
        setPayError(err.message || 'Cilad ayaa dhacday beddelidda bisha.');
      }
    }
  }

  async function handleFeeTypeChange(nextFeeType) {
    setFeeType(nextFeeType);
    setPayError('');
    setPaySuccessMsg('');
    const registrationPeriod = `registration-${new Date().getFullYear()}`;
    const monthlyPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const periodToUse = nextFeeType === 'registration'
      ? registrationPeriod
      : (billingPeriod.startsWith('registration-') ? monthlyPeriod : billingPeriod);
    if (nextFeeType === 'registration') setBillingPeriod(registrationPeriod);
    else if (billingPeriod.startsWith('registration-')) setBillingPeriod(monthlyPeriod);
    let examPeriodToUse = examPeriod;
    if (nextFeeType === 'exam') {
      const rows = await loadExamPeriods();
      examPeriodToUse = examPeriodToUse || rows[0]?.name || '';
      if (!examPeriod && examPeriodToUse) setExamPeriod(examPeriodToUse);
    }
    if (selectedStudent) {
      try {
        await loadSelectedObligation(selectedStudent.id, nextFeeType, periodToUse, examPeriodToUse);
      } catch (err) {
        setPayError(err.message || 'Cilad ayaa dhacday markii waajibka la beddelay.');
      }
    }
  }

  async function handleExamPeriodChange(nextExamPeriod) {
    setExamPeriod(nextExamPeriod);
    if (selectedStudent && nextExamPeriod) {
      try {
        await loadSelectedObligation(selectedStudent.id, 'exam', billingPeriod, nextExamPeriod);
      } catch (err) {
        setPayError(err.message || 'Lama soo kicin karo xogta imtixaanka.');
      }
    }
  }

  // Clear selected student
  function handleClearStudent() {
    setSelectedStudent(null);
    setPaymentDetails(null);
    setExamFeeDetails(null);
    setFeeType('monthly');
    setStudentSearch('');
    setSearchedStudents([]);
    setAmountPaidNow('');
    setPaymentNotes('');
    setPayError('');
    setPaySuccessMsg('');
    setCurrentReceiptIsExam(false);
    setDebtReminder(null);
    setDismissedDebtReminderKey('');
  }

  // Submit Payment (Receive Payment & Generate Receipt)
  async function handleSubmitPayment(e) {
    e.preventDefault();
    if (!selectedStudent || !paymentDetails) return;

    const numAmount = parseFloat(amountPaidNow);
    if (isNaN(numAmount) || numAmount <= 0) {
      setPayError('Fadlan geli lacag sax ah oo ka weyn $0.00.');
      return;
    }

    if (paymentDetails.balance_remaining <= 0) {
      setPayError(feeType === 'exam'
        ? 'Imtixaankan hore ayaa loo wada bixiyay, ma jiro haraa la bixin karo.'
        : 'Waajibkan hore ayaa loo wada bixiyay, ma jiro haraa la bixin karo.');
      return;
    }

    if (numAmount > paymentDetails.balance_remaining) {
      setPayError(`Lacagta la bixinayo ($${numAmount.toFixed(2)}) kama badnaan karto haraaga dhiman bisha ($${paymentDetails.balance_remaining.toFixed(2)}).`);
      return;
    }

    setPayError('');
    setPaySuccessMsg('');
    setPayLoading(true);

    try {
      const res = feeType === 'exam'
        ? await api.recordExamFeePayment({
            student_id: selectedStudent.id,
            exam_period: examPeriod,
            academic_year: '2026',
            amount_paid: numAmount,
            payment_date: paymentDate,
            notes: paymentNotes
          })
        : await api.receivePayment({
            student_id: selectedStudent.id,
            division,
            fee_type: feeType,
            billing_period: feeType === 'registration' ? (billingPeriod || `registration-${new Date().getFullYear()}`) : billingPeriod,
            amount_paid: numAmount,
            payment_date: paymentDate,
            notes: paymentNotes
          });

      const receiptData = feeType === 'exam' ? res.data : res.receipt;
      if (res.success && receiptData) {
        setCurrentReceipt({
          ...receiptData,
          received_by_name: user?.full_name
        });
        setCurrentReceiptIsExam(feeType === 'exam');
        setPaySuccessMsg(`Lacagta ($${numAmount.toFixed(2)}) si guul leh ayaa loo qabtay. Rasiid No: ${receiptData.receipt_number || receiptData.receiptNumber}`);
        setPaymentNotes('');

        // Reload student payment details immediately so summary, unpaid months, and history update in real-time
        await loadSelectedObligation(selectedStudent.id, feeType, billingPeriod, examPeriod);

      }
    } catch (err) {
      setPayError(err.message || 'Cilad ayaa dhacday markii lacagta la qabanayay.');
    } finally {
      setPayLoading(false);
    }
  }

  // Controlled Adjustment Submission
  async function handleAdjustPaymentSubmit(e) {
    e.preventDefault();
    if (!adjustPaymentItem) return;

    try {
      await api.adjustPayment({
        payment_id: adjustPaymentItem.id,
        new_amount: adjustNewAmount,
        reason: adjustReason
      });
      setShowAdjustModal(false);
      loadMenuData();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>


      {/* Title & Division Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            Maamulka Maaliyadda (Financial Management)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Khadadka rasmiga ah, biilasha ardayda, qabashada lacagta (Rasiid), iyo warbixinnada
          </p>
        </div>

        {/* Division Scope Switcher (for users with multi-division access) */}
        {(isSuperAdmin || user?.division_scope === 'all') && (
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => { setDivision('institute'); setFeeType('monthly'); setPaymentDetails(null); }}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: division === 'institute' ? '#0f766e' : 'none',
                color: division === 'institute' ? 'white' : '#64748b'
              }}
            >
              Machadka (Institute Finance)
            </button>
            <button
              type="button"
              onClick={() => { setDivision('quran'); setFeeType('monthly'); setPaymentDetails(null); }}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: division === 'quran' ? '#d97706' : 'none',
                color: division === 'quran' ? 'white' : '#64748b'
              }}
            >
              Quraanka (Quran Finance)
            </button>
          </div>
        )}
      </div>

      {/* Top Horizontal Navigation Tabs (Full Width) */}
      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '24px',
        backgroundColor: '#f8fafc',
        padding: '8px 12px 0',
        borderRadius: '10px 10px 0 0',
        overflowX: 'auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {[
          { id: 'payments', label: '1. Qabashada Lacagta & Rasiidada (Payments & Receipts)', icon: CreditCard },
          { id: 'reports', label: '2. Warbixinnada (Reports)', icon: FileText },
          { id: 'settings', label: '3. Xeerarka & Goobaha (Settings)', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeMenu === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMenu(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                border: 'none',
                background: isActive ? '#ffffff' : 'transparent',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.92rem',
                color: isActive ? '#0f766e' : '#64748b',
                borderBottom: isActive ? '3px solid #0f766e' : '3px solid transparent',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 -2px 6px rgba(0,0,0,0.03)' : 'none'
              }}
            >
              <Icon size={18} color={isActive ? '#0f766e' : '#94a3b8'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Pane */}
      <div style={{ width: '100%' }}>
          {/* 3. Payments Submenu - Redesigned Payment Interface */}
      {activeMenu === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top Banner & Student Search Card */}
          <div className="card" style={{ borderTop: '4px solid #0d9488', overflow: 'visible' }}>
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={20} color="#0d9488" />
                  Qabashada Lacagta & Bixinta Rasiidka (Payments & Receipts)
                </h3>
                <p className="card-subtitle">
                  Raadi ardayga si aad u eegto xaaladdiisa maaliyadeed, bilaha aan la bixin, iyo taariikhda lacagaha
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${division === 'institute' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  {division === 'institute' ? 'Machadka (Institute)' : 'Dugsiga Quraanka (Quran School)'}
                </span>
              </div>
            </div>

            <div className="card-body" style={{ overflow: 'visible' }}>
              {/* Search input with prominent styling */}
              <div style={{ position: 'relative', width: '100%' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Raadi Ardayga (Search by Name, Arabic Name, Student ID, or Phone) *</span>
                  {selectedStudent && (
                    <button
                      type="button"
                      onClick={handleClearStudent}
                      style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      Beddel Ardayga (Change Student)
                    </button>
                  )}
                </label>
                
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tusaale: Maxamed, محمد, STU-2026-001, ama 61xxxxxxx..."
                    value={studentSearch}
                    onChange={(e) => searchForStudent(e.target.value)}
                    style={{
                      paddingLeft: '40px',
                      paddingRight: '36px',
                      fontSize: '0.95rem',
                      height: '46px',
                      borderRadius: '10px',
                      borderColor: selectedStudent ? '#0d9488' : '#cbd5e1'
                    }}
                  />
                  <Search size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: '#0d9488' }} />
                  {studentSearch && (
                    <button
                      type="button"
                      onClick={handleClearStudent}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '13px',
                        border: 'none',
                        background: '#f1f5f9',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                      title="Nadiifi"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Instant Search Results Dropdown */}
                {searchedStudents.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    boxShadow: '0 20px 35px -5px rgba(15,23,42,0.2), 0 10px 15px -3px rgba(15,23,42,0.1)',
                    zIndex: 9999,
                    maxHeight: '280px',
                    overflowY: 'auto',
                    marginTop: '6px'
                  }}>
                    <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                      Natiijooyinka la helay ({searchedStudents.length}):
                    </div>
                    {searchedStudents.map(st => (
                      <div
                        key={st.id}
                        onClick={() => handleSelectStudent(st)}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdfa'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{st.full_name}</strong>
                            {st.name_ar && (
                              <span style={{ fontFamily: 'var(--font-arabic)', color: '#0f766e', fontSize: '0.95rem' }} dir="rtl">
                                ({st.name_ar})
                              </span>
                            )}
                            <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>
                              {st.student_id}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span>📞 {st.phone || 'Tel la\'aan'}</span>
                            <span>• Fasalka/Halaqada: <strong>{st.institute_class_name || st.quran_group_name || 'Lama qorin'}</strong></span>
                          </div>
                        </div>
                        <span style={{ color: '#0d9488', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Dooro <ArrowRight size={14} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Student Profile Banner */}
              {selectedStudent && (
                <div style={{
                  marginTop: '16px',
                  background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%)',
                  border: '1px solid #a7f3d0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: '#0d9488',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      fontWeight: 700
                    }}>
                      {selectedStudent.full_name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                          {selectedStudent.full_name}
                        </h4>
                        {selectedStudent.name_ar && (
                          <span style={{ fontFamily: 'var(--font-arabic)', color: '#047857', fontWeight: 700, fontSize: '1.05rem' }} dir="rtl">
                            ({selectedStudent.name_ar})
                          </span>
                        )}
                        <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                          {selectedStudent.student_id}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '0.82rem', color: '#475569', flexWrap: 'wrap' }}>
                        <span><strong>Tel:</strong> {selectedStudent.phone || '-'}</span>
                        {selectedStudent.guardian_phone && <span><strong>Waalidka:</strong> {selectedStudent.guardian_phone}</span>}
                        <span><strong>Fasalka/Halaqada:</strong> {paymentDetails?.class_or_group_name || selectedStudent.institute_class_name || selectedStudent.quran_group_name || 'Lama qorin'}</span>
                        <span><strong>Waaxda:</strong> {division === 'institute' ? 'Machadka' : 'Dugsiga Quraanka'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearStudent}
                    className="btn btn-secondary btn-sm"
                    style={{ background: 'white' }}
                  >
                    Dooro Arday Kale
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Messages */}
          {payError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 18px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              fontSize: '0.875rem'
            }}>
              <AlertCircle size={20} />
              <span>{payError}</span>
            </div>
          )}

          {paySuccessMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '14px 18px',
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              borderRadius: '10px',
              fontSize: '0.875rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={20} color="#059669" />
                <span style={{ fontWeight: 600 }}>{paySuccessMsg}</span>
              </div>
              {currentReceipt && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setCurrentReceipt(currentReceipt)}
                >
                  <Printer size={14} /> Eeg Rasiidka
                </button>
              )}
            </div>
          )}

          {/* Main Content Area (When student is selected) */}
          {selectedStudent && paymentDetails ? (
            <>
              {/* Single Clean, Modern Payment Card */}
              <div className="card" style={{ borderTop: '4px solid #0f766e', boxShadow: 'var(--shadow-card)' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 className="card-title" style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Receipt size={20} color="#0f766e" />
                      Qabashada Lacagta & Rasiidka (Payment & Receipt)
                    </h4>
                    <p className="card-subtitle">
                      Dooro bisha/imtixaanka, qabo lacagta, isla markaasna daabac rasiidka ardayga.
                    </p>
                  </div>

                  {/* Clean debt pill indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {paymentDetails.total_outstanding_balance > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#fff7ed',
                        border: '1px solid #ffedd5',
                        color: '#c2410c',
                        fontSize: '0.82rem',
                        fontWeight: 700
                      }}>
                        <AlertCircle size={14} color="#ea580c" />
                        Haraaga Guud: ${paymentDetails.total_outstanding_balance.toFixed(2)} ({paymentDetails.unpaid_months?.length || 0} bilood)
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#065f46',
                        fontSize: '0.82rem',
                        fontWeight: 700
                      }}>
                        <CheckCircle size={14} color="#059669" />
                        Ma jiro haraa lagu leeyahay
                      </span>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSubmitPayment}>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {/* Row 1: Fee Type & Month Selection */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '16px'
                    }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>1. Nooca Waajibka (Fee Type) *</label>
                        <select
                          className="form-select"
                          value={feeType}
                          onChange={(e) => handleFeeTypeChange(e.target.value)}
                          required
                        >
                          <option value="monthly">Lacagta Bisha (Monthly Tuition)</option>
                          {division === 'institute' && <option value="exam">Lacagta Imtixaanka (Examination Fee)</option>}
                          {division === 'institute' && <option value="registration">Lacagta Diiwaangelinta (Registration Fee)</option>}
                        </select>
                      </div>

                      {feeType === 'exam' ? (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>2. Imtixaanka / Xilliga (Exam Period) *</label>
                          <select
                            className="form-select"
                            value={examPeriod}
                            onChange={(e) => handleExamPeriodChange(e.target.value)}
                            required
                          >
                            <option value="">Dooro xilliga imtixaanka</option>
                            {examPeriods.map(period => <option key={period.id || period.name} value={period.name}>{period.name}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>
                            2. {feeType === 'registration' ? 'Xilliga Diiwaangelinta' : 'Dooro Bisha (Select Billing Month)'} *
                          </label>
                          <input
                            type={feeType === 'registration' ? 'text' : 'month'}
                            className="form-input"
                            value={billingPeriod}
                            onChange={(e) => handlePeriodChange(e.target.value)}
                            placeholder={feeType === 'registration' ? 'registration-2026' : undefined}
                            readOnly={feeType === 'registration'}
                            required
                            style={{ fontWeight: 600 }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Row 2: Live Month Calculation Strip */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px',
                      padding: '14px',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                          Khidmadda Bisha
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                          ${paymentDetails.amount_due.toFixed(2)}
                          {paymentDetails.discount_amount > 0 && (
                            <span style={{ fontSize: '0.75rem', color: '#059669', marginLeft: '6px' }}>
                              (-${paymentDetails.discount_amount.toFixed(2)} dhimis)
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                          Horay Loo Bixiyay
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0d9488', marginTop: '2px' }}>
                          ${paymentDetails.amount_paid_so_far.toFixed(2)}
                        </div>
                      </div>

                      <div style={{
                        background: paymentDetails.balance_remaining > 0 ? '#fff7ed' : '#ecfdf5',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${paymentDetails.balance_remaining > 0 ? '#ffedd5' : '#a7f3d0'}`
                      }}>
                        <div style={{
                          fontSize: '0.72rem',
                          color: paymentDetails.balance_remaining > 0 ? '#c2410c' : '#047857',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          Haraaga Bisha
                        </div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 900,
                          color: paymentDetails.balance_remaining > 0 ? '#ea580c' : '#10b981',
                          marginTop: '2px'
                        }}>
                          ${paymentDetails.balance_remaining.toFixed(2)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                        <span className={`badge ${
                          paymentDetails.balance_remaining <= 0 ? 'badge-success' :
                          paymentDetails.amount_paid_so_far > 0 ? 'badge-warning' : 'badge-danger'
                        }`} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                          {paymentDetails.balance_remaining <= 0 ? 'Waa Bixiyay (Paid)' :
                           paymentDetails.amount_paid_so_far > 0 ? 'Qabyo (Partially Paid)' : 'Aan Bixin (Unpaid)'}
                        </span>
                      </div>
                    </div>

                    {/* Row 3: Payment Date and Amount to Pay */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '16px'
                    }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Taariikhda Bixinta (Payment Date) *</label>
                        <input
                          type="date"
                          className="form-input"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                            3. Lacagta La Bixinayo Hadda ($ USD) *
                          </label>
                          {paymentDetails.balance_remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => setAmountPaidNow(paymentDetails.balance_remaining.toString())}
                              style={{
                                background: '#f0fdfa',
                                border: '1px solid #99f6e4',
                                color: '#0f766e',
                                borderRadius: '6px',
                                padding: '3px 10px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Buuxi Haraaga (${paymentDetails.balance_remaining.toFixed(2)})
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={paymentDetails.balance_remaining > 0 ? paymentDetails.balance_remaining : undefined}
                          className="form-input"
                          value={amountPaidNow}
                          onChange={(e) => setAmountPaidNow(e.target.value)}
                          required
                          placeholder="0.00"
                          style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                          * Bixinta qayb ka mid ah (partial payment) waa la oggol yahay.
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Optional Notes */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">4. Xusuusin Gaaban (Optional Note)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Qor faahfaahin ama xusuusin gaaban haddii loo baahdo..."
                      />
                    </div>
                  </div>

                  <div className="card-header" style={{ borderTop: '1px solid #e2e8f0', justifyContent: 'flex-end', padding: '16px 24px' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={payLoading || paymentDetails.balance_remaining <= 0 || !amountPaidNow || parseFloat(amountPaidNow) <= 0}
                      style={{
                        padding: '12px 28px',
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        opacity: (paymentDetails.balance_remaining <= 0) ? 0.6 : 1
                      }}
                    >
                      <Printer size={18} />
                      {payLoading ? 'Qabanayaa...' : 'Qabo Lacagta & Soo saar Rasiidka'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Bottom Section 1: Bilaha Aan La Bixin (Unpaid Months) */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={18} color="#d97706" />
                      Bilaha Aan La Bixin (Unpaid Months)
                    </h3>
                    <p className="card-subtitle">
                      Dhammaan bilaha uu ardaygu leeyahay haraa ama aan weli la bixin
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Wadarta Haraaga Liiska:</span>
                    <strong style={{ fontSize: '1.1rem', color: '#b45309', background: '#fffbeb', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                      ${(paymentDetails.unpaid_months || []).reduce((sum, m) => sum + parseFloat(m.balance || 0), 0).toFixed(2)}
                    </strong>
                  </div>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bisha (Period)</th>
                        <th>Biilka (Invoice)</th>
                        <th>Khidmadda ($)</th>
                        <th>Dhimis ($)</th>
                        <th>Waajibka ($)</th>
                        <th>La Bixiyay ($)</th>
                        <th>Haraaga ($)</th>
                        <th>Xaaladda</th>
                        <th style={{ textAlign: 'right' }}>Waxqabad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!paymentDetails.unpaid_months || paymentDetails.unpaid_months.length === 0) ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#059669' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <CheckCircle2 size={32} color="#10b981" />
                              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#047857' }}>
                                Ma jiraan bilo aan la bixin!
                              </span>
                              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                                Ardaygu ma qabo wax biilal ah oo haraa ku jiro xilligan.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paymentDetails.unpaid_months.map(m => (
                          <tr key={m.id} style={{ backgroundColor: m.billing_period === billingPeriod ? '#f0fdfa' : undefined }}>
                            <td>
                              <strong style={{ color: '#0f172a' }}>{m.billing_period}</strong>
                              {m.billing_period === billingPeriod && (
                                <span style={{ marginLeft: '6px', fontSize: '0.72rem', color: '#0d9488', fontWeight: 700 }}>
                                  (Bisha Xulan)
                                </span>
                              )}
                            </td>
                            <td><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{m.invoice_number}</span></td>
                            <td>${parseFloat(m.standard_fee).toFixed(2)}</td>
                            <td style={{ color: '#059669' }}>-${parseFloat(m.discount_amount).toFixed(2)}</td>
                            <td><strong>${parseFloat(m.amount_due).toFixed(2)}</strong></td>
                            <td style={{ color: '#0d9488' }}>${parseFloat(m.amount_paid).toFixed(2)}</td>
                            <td>
                              <strong style={{ color: '#b45309' }}>
                                ${parseFloat(m.balance).toFixed(2)}
                              </strong>
                            </td>
                            <td>
                              <span className={`badge ${m.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                                {m.status === 'partial' ? 'Qabyo (Partial)' : 'Aan Bixin (Unpaid)'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handlePeriodChange(m.billing_period)}
                                style={{
                                  borderColor: m.billing_period === billingPeriod ? '#0d9488' : '#e2e8f0',
                                  color: m.billing_period === billingPeriod ? '#0f766e' : '#334155',
                                  fontWeight: 600
                                }}
                              >
                                Dooro Bisha
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Section 2: Taariikhda Lacag-bixinta (Payment History) */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} color="#0f766e" />
                      Taariikhda Lacag-bixinta (Payment History)
                    </h3>
                    <p className="card-subtitle">
                      Diiwaanka lacagihii hore uu ardaygu u bixiyay iyo rasiidhada la soo saaray
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Wadarta La Qabtay:</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0f766e', background: '#f0fdfa', padding: '4px 10px', borderRadius: '6px', border: '1px solid #ccfbf1' }}>
                      ${(paymentDetails.total_paid_all_time || 0).toFixed(2)}
                    </strong>
                  </div>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rasiid No</th>
                        <th>Bisha (Period)</th>
                        <th>Taariikhda</th>
                        <th>Lacagta ($)</th>
                        <th>Qasnajiga</th>
                        <th>Xusuusin</th>
                        <th style={{ textAlign: 'right' }}>Rasiidka</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!paymentDetails.payment_history || paymentDetails.payment_history.length === 0) ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                            Ardaygu weli ma laha wax taariikh lacag-bixin ah.
                          </td>
                        </tr>
                      ) : (
                        paymentDetails.payment_history.map(p => (
                          <tr key={p.id}>
                            <td>
                              <span style={{ fontWeight: 700, color: '#0f766e' }}>{p.receipt_number}</span>
                            </td>
                            <td><strong>{p.billing_period}</strong></td>
                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {new Date(p.payment_date).toLocaleString()}
                            </td>
                            <td>
                              <strong style={{ color: '#059669', fontSize: '0.95rem' }}>
                                ${parseFloat(p.amount_paid).toFixed(2)}
                              </strong>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>{p.received_by_name || '-'}</td>
                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.notes || '-'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setCurrentReceipt({
                                  ...p,
                                  student_name: selectedStudent.full_name,
                                  student_code: selectedStudent.student_id,
                                  division,
                                  class_name: paymentDetails.class_or_group_name,
                                  balance: 0
                                })}
                                title="Daabac Rasiidka"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Printer size={13} />
                                <span>Rasiidka</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* Prompt State when no student is selected yet */
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1' }}>
              <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#f0fdfa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0d9488'
                }}>
                  <Search size={30} />
                </div>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Dooro Arday si aad u bilaawdo
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                  Fadlan isticmaal sanduuqa raadinta ee sare si aad u dooratid ardayga adigoo isticmaalaya Magaciisa (Soomaali/Carabi), ID-ga, ama Taleefankiisa.
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="badge badge-info">✓ Magaca Ardayga</span>
                  <span className="badge badge-info">✓ Aqoonsiga (ID)</span>
                  <span className="badge badge-info">✓ Taleefanka</span>
                  <span className="badge badge-info">✓ Magaca Carabiga</span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 4. Reports Submenu (Historical Payment Records belong here!) */}
      {activeMenu === 'reports' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Diiwaanka Lacag-qabashada (Payment History & Reports)</h3>
              <p className="card-subtitle">
                Taariikhda buuxda ee rasiidhada la bixiyay, taariikhaha, iyo dib-u-hagaajinta
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                const blob = await api.downloadFinanceExcel(`?division=${division}`);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `warbixin-maaliyadeed-${division}-${Date.now()}.xlsx`;
                a.click();
              }}
            >
              Soo Deji Excel (.xlsx)
            </button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rasiid No</th>
                  <th>Taariikhda</th>
                  <th>Ardayga</th>
                  <th>Fasalka / Halaqada</th>
                  <th>Lacagta ($)</th>
                  <th>Xaaladda</th>
                  <th>Qasnajiga</th>
                  <th style={{ textAlign: 'right' }}>Waxqabad</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Wax diiwaan rasiid ah ma jiraan.</td></tr>
                ) : (
                  paymentHistory.map(p => (
                    <tr key={p.id}>
                      <td><span style={{ fontWeight: 700, color: '#0f766e' }}>{p.receipt_number}</span></td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {new Date(p.payment_date).toLocaleString()}
                      </td>
                      <td>
                        <strong>{p.student_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.student_code}</div>
                      </td>
                      <td>{p.class_name || p.group_name || '-'}</td>
                      <td>
                        <strong style={{ color: p.status === 'reversed' ? '#ef4444' : '#059669' }}>
                          ${parseFloat(p.amount_paid).toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <span className={`badge ${p.status === 'valid' ? 'badge-success' : p.status === 'adjusted' ? 'badge-warning' : 'badge-danger'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>{p.received_by_name}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setCurrentReceipt(p)}
                            title="Daabac Rasiidka"
                          >
                            <Printer size={13} />
                          </button>
                          {(isSuperAdmin || user?.role === 'finance_user') && p.status === 'valid' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setAdjustPaymentItem(p);
                                setAdjustNewAmount(p.amount_paid.toString());
                                setAdjustReason('');
                                setShowAdjustModal(true);
                              }}
                              title="Wax ka beddel / Reversal"
                            >
                              <Edit size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Settings Submenu: Official Fee Rules & Discounts (Super Admin control) */}
      {activeMenu === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Official Fee Rules */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Xeerarka Khidmadda Rasmiga ah (Official Fee Rules)</h3>
            </div>
            <div className="card-body">
              {isSuperAdmin && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  await api.setFeeRule({
                    division,
                    fee_type: newRuleType,
                    billing_period: newRulePeriod,
                    standard_fee: newRuleFee
                  });
                  setNewRuleFee('');
                  loadMenuData();
                }} style={{ marginBottom: '20px', padding: '14px', background: '#f8fafc', borderRadius: '8px' }}>
                  <div className="form-group">
                    <label className="form-label">Nooca Waajibka</label>
                    <select className="form-select" value={newRuleType} onChange={(e) => setNewRuleType(e.target.value)}>
                      <option value="monthly">Monthly Tuition</option>
                      {division === 'institute' && <option value="registration">Registration</option>}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Wareegga Biilka</label>
                    <input className="form-input" value={newRulePeriod} onChange={(e) => setNewRulePeriod(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lacagta Rasmiga ah ($)</label>
                    <input type="number" step="0.01" className="form-input" value={newRuleFee} onChange={(e) => setNewRuleFee(e.target.value)} required placeholder="e.g. 25.00" />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm">Kaydi Xeerka Khidmadda</button>
                </form>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Waaxda</th>
                    <th>Nooca</th>
                    <th>Wareegga</th>
                    <th>Khidmadda ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {feeRules.map(r => (
                    <tr key={r.id}>
                      <td><span className="badge badge-info">{r.division}</span></td>
                      <td>{r.fee_type || 'monthly'}</td>
                      <td>{r.billing_period}</td>
                      <td><strong>${parseFloat(r.standard_fee).toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approved Discounts */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Dhimista Ardayda (Approved Discounts)</h3>
            </div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ardayga</th>
                    <th>Dhimista</th>
                    <th>Sababta</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.map(d => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.student_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.student_code}</div>
                      </td>
                      <td>
                        <strong style={{ color: '#059669' }}>
                          {d.discount_type === 'percentage' ? `${d.discount_value}%` : `$${d.discount_value}`}
                        </strong>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{d.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Monthly Payment Cell Detail Modal */}
      {/* Printable Receipt Modal */}
      {currentReceipt && (
        currentReceiptIsExam ? (
          <CenteredArabicExamReceipt
            receipt={currentReceipt}
            onClose={() => {
              setCurrentReceipt(null);
              setCurrentReceiptIsExam(false);
            }}
          />
        ) : (
          <ReceiptModal
            receipt={currentReceipt}
            onClose={() => setCurrentReceipt(null)}
          />
        )
      )}

      {/* Controlled Payment Adjustment Modal */}
      {showAdjustModal && adjustPaymentItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                Wax ka beddel Lacag-bixinta: {adjustPaymentItem.receipt_number}
              </h3>
            </div>
            <form onSubmit={handleAdjustPaymentSubmit}>
              <div className="modal-body">
                <div style={{ padding: '10px 14px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Digniin: Lacag-bixinta lama tirtiri karo si toos ah. Wax ka beddel kasta waxaa lagu diiwaangelinayaa Audit Log waxaana la ogeysiin doonaa Maamulaha Guud.
                </div>
                <div className="form-group">
                  <label className="form-label">Cadadka Hadda: ${adjustPaymentItem.amount_paid}</label>
                </div>
                <div className="form-group">
                  <label className="form-label">Cadadka Cusub ($ USD) * (Geli 0 haddii aad doonayso inaad baabi'iso / reverse)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={adjustNewAmount}
                    onChange={(e) => setAdjustNewAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sababta Wax-ka-beddelka (Required Reason) *</label>
                  <textarea
                    className="form-textarea"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    required
                    placeholder="Qor sababta rasmiga ah ee wax looga beddelay lacagtan..."
                    rows="3"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>
                  Ka noqo
                </button>
                <button type="submit" className="btn btn-primary">
                  Xaqiiji Wax-ka-beddelka
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
