import { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  DollarSign, 
  Search, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  Printer, 
  Clock, 
  RefreshCw,
  Plus,
  Settings,
  Filter,
  Eye
} from 'lucide-react';
import CenteredArabicExamReceipt from './CenteredArabicExamReceipt';

export default function ExamFeeSection({ classes = [], canManage = false }) {
  // Periods & Configuration
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('Monthly Exam 1');
  const [academicYear, setAcademicYear] = useState('2026');

  // Student Search & Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Fee Status for Selected Student
  const [feeStatus, setFeeStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Form Fields
  const [amountBeingPaid, setAmountBeingPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Active Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Payment History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState('all');
  const [historyClassFilter, setHistoryClassFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');

  // Fee Rule Config Modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleAmount, setRuleAmount] = useState('10.00');
  const [ruleSaving, setRuleSaving] = useState(false);

  useEffect(() => {
    loadPeriods();
    loadHistory();
  }, [academicYear]);

  useEffect(() => {
    if (selectedStudent && selectedPeriod) {
      loadStudentFeeStatus(selectedStudent.id, selectedPeriod);
    }
  }, [selectedStudent, selectedPeriod, academicYear]);

  async function loadPeriods() {
    try {
      const res = await api.getExamPeriods(`?academic_year=${academicYear}`);
      if (res.success && res.data?.length > 0) {
        setPeriods(res.data);
        if (!selectedPeriod || !res.data.find(p => p.name === selectedPeriod)) {
          setSelectedPeriod(res.data[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load exam periods:', err);
    }
  }

  async function handleStudentSearch(q) {
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const res = await api.getStudents(`?search=${encodeURIComponent(q.trim())}&limit=10`);
      if (res.success) {
        setSearchResults(res.data || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  }

  function handleSelectStudent(st) {
    setSelectedStudent(st);
    setSearchResults([]);
    setSearchQuery(`${st.full_name} (${st.student_id})`);
    setFormError('');
    setFormSuccess('');
  }

  async function loadStudentFeeStatus(studentId, periodName) {
    try {
      setStatusLoading(true);
      setFormError('');
      const res = await api.getStudentExamFeeStatus(`?student_id=${studentId}&exam_period=${encodeURIComponent(periodName)}&academic_year=${academicYear}`);
      if (res.success) {
        setFeeStatus(res.data);
        // Pre-fill amount with remaining balance
        const rem = parseFloat(res.data.balance_remaining || 0);
        setAmountBeingPaid(rem > 0 ? String(rem) : '0');
      }
    } catch (err) {
      setFormError(err.message || 'Lama soo kicin karo xaaladda lacagta ardayga.');
      setFeeStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }

  async function handlePayExamFee(e) {
    e.preventDefault();
    if (!selectedStudent || !feeStatus) {
      setFormError('Fadlan marka hore dooro arday.');
      return;
    }

    const amt = parseFloat(amountBeingPaid);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Qadarka la bixinayo waa inuu ka weynaadaa 0.');
      return;
    }

    if (amt > parseFloat(feeStatus.balance_remaining) + 0.001) {
      setFormError(`Lacagta aad gelisay ($${amt}) way ka badan tahay haraaga dhiman ($${feeStatus.balance_remaining}).`);
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      setFormSuccess('');

      const res = await api.recordExamFeePayment({
        student_id: selectedStudent.id,
        exam_period: selectedPeriod,
        academic_year: academicYear,
        amount_paid: amt,
        payment_date: paymentDate,
        notes: paymentNotes
      });

      if (res.success) {
        setFormSuccess('Lacagta imtixaanka si guul leh ayaa loo qabtay!');
        // Immediately show Centered Arabic Receipt!
        setActiveReceipt(res.data);
        // Refresh fee status and history
        loadStudentFeeStatus(selectedStudent.id, selectedPeriod);
        loadHistory();
      }
    } catch (err) {
      setFormError(err.message || 'Khalad ayaa dhacay intii lagu guda jiray qabashada lacagta.');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      let queryStr = `?academic_year=${academicYear}&limit=50`;
      if (historyPeriodFilter !== 'all') queryStr += `&exam_period=${encodeURIComponent(historyPeriodFilter)}`;
      if (historyClassFilter !== 'all') queryStr += `&class_id=${historyClassFilter}`;
      if (historySearch) queryStr += `&search=${encodeURIComponent(historySearch.trim())}`;

      const res = await api.getExamFeeHistory(queryStr);
      if (res.success) {
        setHistory(res.data || []);
      }
    } catch (err) {
      console.error('History load error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleReprintReceipt(paymentId) {
    try {
      const res = await api.getExamFeeReceipt(paymentId);
      if (res.success) {
        setActiveReceipt(res.data);
      }
    } catch (err) {
      alert(err.message || 'Lama soo kicin karo rasiidka.');
    }
  }

  async function handleSaveRule(e) {
    e.preventDefault();
    const amt = parseFloat(ruleAmount);
    if (isNaN(amt) || amt < 0) return;

    try {
      setRuleSaving(true);
      const res = await api.setExamFeeRule({
        academic_year: academicYear,
        exam_period: selectedPeriod,
        amount: amt,
        description: 'Lacagta Rasmiga ah ee Imtixaanka'
      });
      if (res.success) {
        setShowRuleModal(false);
        if (selectedStudent) {
          loadStudentFeeStatus(selectedStudent.id, selectedPeriod);
        }
        alert('Qaanuunka lacagta imtixaanka waa la cusboonaysiiyay.');
      }
    } catch (err) {
      alert(err.message || 'Khalad ayaa dhacay.');
    } finally {
      setRuleSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* 1. Header & Quick Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: '#f0fdfa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0d9488'
          }}>
            <DollarSign size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Exam Fee — رسوم الامتحان
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
              Qabashada lacagta imtixaanaadka iyo soo saarista rasiidka rasmiga ah
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canManage && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setRuleAmount(feeStatus?.official_fee ? String(feeStatus.official_fee) : '10.00');
                setShowRuleModal(true);
              }}
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Settings size={14} />
              <span>Deji Lacagta Rasmiga ah (${feeStatus?.official_fee || '10.00'})</span>
            </button>
          )}

          <div style={{
            padding: '5px 12px',
            borderRadius: '6px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#0f766e'
          }}>
            Sannadka: {academicYear}
          </div>
        </div>
      </div>

      {/* 2. Registration Grid (Form + Student Status Card) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px'
      }}>
        
        {/* Left Card: Payment Registration Form */}
        <div className="card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
            Diiwaangeli Bixinta Lacagta Imtixaanka
          </h3>

          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.84rem', marginBottom: '14px' }}>
              {formError}
            </div>
          )}

          {formSuccess && (
            <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.84rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handlePayExamFee} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Period Selector */}
            <div>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155' }}>
                Xilliga Imtixaanka (Examination Period) *
              </label>
              <select
                className="form-input"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{ fontWeight: 600 }}
              >
                {periods.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Student Search with live autocomplete dropdown */}
            <div style={{ position: 'relative' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155' }}>
                Raadi Ardayga (Student Search) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Geli magaca ardayga ama ID-ga..."
                  value={searchQuery}
                  onChange={(e) => handleStudentSearch(e.target.value)}
                  style={{ paddingRight: '32px' }}
                />
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', right: '10px', top: '11px' }} />
              </div>

              {/* Autocomplete Dropdown List */}
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                  zIndex: 20,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}>
                  {searchResults.map(st => (
                    <div
                      key={st.id}
                      onClick={() => handleSelectStudent(st)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        fontSize: '0.86rem',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdfa'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                    >
                      <strong style={{ color: '#0f172a' }}>{st.full_name}</strong>
                      <span style={{ color: '#0d9488', marginLeft: '8px', fontSize: '0.78rem', fontWeight: 600 }}>
                        ({st.student_id})
                      </span>
                      {st.phone && <span style={{ color: '#64748b', fontSize: '0.76rem', marginLeft: '6px' }}>— {st.phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Amount Being Paid */}
            <div>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155' }}>
                Lacagta La Bixinayo (Amount Being Paid) *
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '9px', fontWeight: 700, color: '#64748b' }}>$</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  className="form-input"
                  style={{ paddingLeft: '28px', fontSize: '1rem', fontWeight: 700, color: '#0f766e' }}
                  value={amountBeingPaid}
                  onChange={(e) => setAmountBeingPaid(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Payment Date & Notes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>
                  Taariikhda Bixinta *
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>
                  Xusuusin (Notes)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tusaale: Kaash"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !selectedStudent || !feeStatus || parseFloat(feeStatus.balance_remaining || 0) <= 0}
              style={{
                marginTop: '10px',
                padding: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#0d9488'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Kaydinayaa...</span>
                </>
              ) : (
                <>
                  <Printer size={16} />
                  <span>Qabo Lacagta & Daabac Rasiidka (Pay & Print)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Card: Selected Student Financial Status */}
        <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
            Xogta Rasmiga ah ee Ardayga
          </h3>

          {statusLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Waa la soo kicinayaa xogta ardayga...
            </div>
          ) : !selectedStudent ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', textAlign: 'center', padding: '30px' }}>
              <UserCheck size={36} color="#cbd5e1" style={{ marginBottom: '10px' }} />
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                Fadlan dhinaca bidix ka raadi oo dooro ardayga si aad u aragto macluumaadkiisa iyo xaaladdiisa lacagta.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              {/* Profile Box */}
              <div style={{
                padding: '14px 16px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  {feeStatus?.student?.full_name || selectedStudent.full_name}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap' }}>
                  <span>ID: <strong>{feeStatus?.student?.student_code || selectedStudent.student_id}</strong></span>
                  <span>Fasalka: <strong>{feeStatus?.student?.class_name || 'Fasal la\'aan'}</strong></span>
                  {selectedStudent.phone && <span>Tel: {selectedStudent.phone}</span>}
                </div>
              </div>

              {/* Financial Status Breakdown */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginTop: '6px'
              }}>
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Lacagta Rasmiga ah</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    ${Number(feeStatus?.official_fee || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ padding: '12px', background: '#f0fdfa', borderRadius: '8px', border: '1px solid #ccfbf1', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#0f766e', fontWeight: 600 }}>Horay loo Bixiyay</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0d9488', marginTop: '4px' }}>
                    ${Number(feeStatus?.previously_paid || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>Haraaga Dhiman</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                    ${Number(feeStatus?.balance_remaining || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                {parseFloat(feeStatus?.balance_remaining || 0) <= 0 ? (
                  <div style={{ padding: '10px', background: '#ecfdf5', borderRadius: '6px', color: '#065f46', fontSize: '0.84rem', fontWeight: 600, textAlign: 'center', border: '1px solid #a7f3d0' }}>
                    ✓ Ardaygani wax haraag ah kuma laha xilliga '{selectedPeriod}'.
                  </div>
                ) : (
                  <div style={{ padding: '10px', background: '#fff7ed', borderRadius: '6px', color: '#c2410c', fontSize: '0.84rem', fontWeight: 600, textAlign: 'center', border: '1px solid #ffedd5' }}>
                    Waxa ku dhiman ardaygan: ${Number(feeStatus?.balance_remaining || 0).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Payment History and Reprinting Table */}
      <div className="card">
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Diiwaanka Lacagaha Imtixaanka (Exam Fee Payment History)
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
              Dhammaan rasiidhada la bixiyay ee la dib-u-daabacan karo
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Period Filter */}
            <select
              className="form-input"
              style={{ fontSize: '0.82rem', padding: '5px 10px', width: '160px' }}
              value={historyPeriodFilter}
              onChange={(e) => {
                setHistoryPeriodFilter(e.target.value);
                setTimeout(loadHistory, 50);
              }}
            >
              <option value="all">Dhammaan Xilliyada</option>
              {periods.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>

            {/* Class Filter */}
            <select
              className="form-input"
              style={{ fontSize: '0.82rem', padding: '5px 10px', width: '150px' }}
              value={historyClassFilter}
              onChange={(e) => {
                setHistoryClassFilter(e.target.value);
                setTimeout(loadHistory, 50);
              }}
            >
              <option value="all">Dhammaan Fasallada</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Search */}
            <input
              type="text"
              className="form-input"
              placeholder="Rasiid ama arday..."
              style={{ fontSize: '0.82rem', padding: '5px 10px', width: '150px' }}
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
            />

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadHistory}
              title="Dib u cusbooneysii"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>No.</th>
                <th>Rasiidka (Receipt #)</th>
                <th>Taariikhda</th>
                <th>Magaca Ardayga</th>
                <th>Aqoonsiga (ID)</th>
                <th>Fasalka</th>
                <th>Xilliga Imtixaanka</th>
                <th>La Qabtay</th>
                <th>Haraaga</th>
                <th style={{ textAlign: 'center' }}>Rasiid</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    Waa la soo kicinayaa taariikhda bixinta...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    Wax bixinno ah weli lama diiwaangelin xilligan.
                  </td>
                </tr>
              ) : (
                history.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>
                        {item.receipt_number}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(item.payment_date).toLocaleDateString()}
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{item.student_name}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.student_code}</span>
                    </td>
                    <td>{item.class_name || '-'}</td>
                    <td>
                      <span style={{ fontSize: '0.78rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        {item.exam_period}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#0f766e' }}>${parseFloat(item.amount_paid).toFixed(2)}</strong>
                    </td>
                    <td>
                      <span style={{ color: parseFloat(item.balance_remaining) > 0 ? '#d97706' : '#10b981', fontWeight: 600 }}>
                        ${parseFloat(item.balance_remaining).toFixed(2)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleReprintReceipt(item.id)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Printer size={13} />
                        <span>Daabac Rasiid</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Official Fee Rule Modal */}
      {showRuleModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', margin: '20px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              Deji Lacagta Rasmiga ah ee Imtixaanka
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '16px' }}>
              Xilliga: <strong>{selectedPeriod}</strong> | Sannadka: <strong>{academicYear}</strong>
            </p>

            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                  Qadarka Lacagta ($ USD) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="form-input"
                  value={ruleAmount}
                  onChange={(e) => setRuleAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowRuleModal(false)}
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={ruleSaving}
                >
                  {ruleSaving ? 'Kaydinayaa...' : 'Keydi Qaanuunka'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Centered Arabic Exam Receipt Modal */}
      {activeReceipt && (
        <CenteredArabicExamReceipt
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

    </div>
  );
}
