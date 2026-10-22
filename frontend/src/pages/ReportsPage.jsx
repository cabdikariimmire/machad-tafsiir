import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ReceiptModal from '../components/ReceiptModal';
import CenteredArabicExamReceipt from '../components/exams/CenteredArabicExamReceipt';
import { 
  FileText, Download, Printer, Search, Calendar, Filter,
  DollarSign, AlertTriangle, CalendarCheck, Award, Users, BookMarked, ArrowRight,
  GraduationCap, Clock, CheckCircle2, ChevronRight, User, RefreshCw, X, ShieldCheck
} from 'lucide-react';

export default function ReportsPage() {
  const { user, isSuperAdmin, hasInstituteAccess, hasQuranAccess, isExamOfficer, isFinanceUser } = useAuth();
  
  const [activeReport, setActiveReport] = useState(() => ((isFinanceUser || isSuperAdmin) ? 'finance' : 'historical_exams'));
  
  // Scope & filters
  const defaultDivision = isSuperAdmin ? '' : (hasInstituteAccess ? 'institute' : (hasQuranAccess ? 'quran' : ''));
  const [division, setDivision] = useState(defaultDivision);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [feeTypeFilter, setFeeTypeFilter] = useState('');
  const [billingPeriodFilter, setBillingPeriodFilter] = useState('');
  const [billingYearFilter, setBillingYearFilter] = useState('');
  const [transactionIdFilter, setTransactionIdFilter] = useState('');
  const [receivedByFilter, setReceivedByFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedReceiptIsExam, setSelectedReceiptIsExam] = useState(false);
  const [financialProfile, setFinancialProfile] = useState(null);
  const [financialProfileLoading, setFinancialProfileLoading] = useState(false);
  
  // Examination-specific filters for Historical Reports
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [examPeriodFilter, setExamPeriodFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [examPeriodsList, setExamPeriodsList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);

  // Dropdown options
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [examsList, setExamsList] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  
  // Report data & loading
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [examMeta, setExamMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  // Historical Exam Drilldown State
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [studentDetailLoading, setStudentDetailLoading] = useState(false);

  // Load auxiliary classes/groups/exams
  useEffect(() => {
    loadFilterOptions();
  }, [division]);

  useEffect(() => {
    fetchReport();
  }, [
    activeReport, division, startDate, endDate, statusFilter, feeTypeFilter,
    billingPeriodFilter, billingYearFilter, transactionIdFilter, receivedByFilter, page,
    selectedClass, selectedGroup, selectedExamId,
    academicYearFilter, examPeriodFilter, subjectFilter, search
  ]);

  async function loadFilterOptions() {
    try {
      const [clsRes, grpRes, exRes, pRes, subRes] = await Promise.all([
        api.getClasses(),
        api.getQuranGroups(),
        api.getAvailableExams(division || 'institute'),
        api.getExamPeriods(),
        api.getSubjects()
      ]);

      if (clsRes.success) setClasses(clsRes.data || []);
      if (grpRes.success) setGroups(grpRes.data || []);
      if (exRes.success) {
        const list = exRes.data?.exams_list || [];
        setExamsList(list);
        if (list.length > 0 && !selectedExamId) setSelectedExamId(list[0].id);
      }
      if (pRes.success) setExamPeriodsList(pRes.data || []);
      if (subRes.success) setSubjectsList(subRes.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (division) params.append('division', division);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (statusFilter) params.append(activeReport === 'finance' ? 'payment_status' : 'status', statusFilter);
      if (search) params.append('search', search);

      if (activeReport === 'historical_exams') {
        if (academicYearFilter) params.append('academic_year', academicYearFilter);
        if (selectedClass) params.append('class_id', selectedClass);
        if (examPeriodFilter) params.append('exam_period', examPeriodFilter);
        if (subjectFilter) params.append('subject_id', subjectFilter);

        const res = await api.getHistoricalExamReports(params.toString());
        if (res.success && res.data) {
          setRecords(res.data.students || []);
          setSummary({
            total_students: res.data.students?.length || 0,
            active_count: res.data.students?.filter(s => s.is_active && s.status !== 'graduated').length || 0,
            graduated_count: res.data.students?.filter(s => s.status === 'graduated').length || 0
          });
        }
      } else if (activeReport === 'finance') {
        if (feeTypeFilter) params.append('fee_type', feeTypeFilter);
        if (billingPeriodFilter) params.append('billing_period', billingPeriodFilter);
        if (billingYearFilter) params.append('billing_year', billingYearFilter);
        if (academicYearFilter) params.append('academic_year', academicYearFilter);
        if (selectedClass) params.append('class_id', selectedClass);
        if (selectedGroup) params.append('group_id', selectedGroup);
        if (transactionIdFilter) params.append('transaction_id', transactionIdFilter);
        if (receivedByFilter) params.append('received_by', receivedByFilter);
        params.append('page', page);
        params.append('page_size', 50);
        const res = await api.getFinanceReports(`?${params.toString()}`);
        if (res.success) {
          setRecords(res.data.records || []);
          setSummary(res.data.summary || {});
          setTotalPages(res.data.summary?.total_pages || 1);
        }
      } else if (activeReport === 'balances') {
        if (feeTypeFilter) params.append('fee_type', feeTypeFilter);
        if (billingPeriodFilter) params.append('billing_period', billingPeriodFilter);
        if (billingYearFilter) params.append('billing_year', billingYearFilter);
        if (selectedClass) params.append('class_id', selectedClass);
        if (selectedGroup) params.append('group_id', selectedGroup);
        params.append('page', page);
        params.append('page_size', 50);
        const res = await api.getOutstandingFeesReport(`?${params.toString()}`);
        if (res.success) {
          setRecords(res.data.records || []);
          setSummary(res.data.summary || {});
          setTotalPages(res.data.summary?.total_pages || 1);
        }
      } else if (activeReport === 'attendance') {
        if (selectedClass) params.append('class_id', selectedClass);
        if (selectedGroup) params.append('group_id', selectedGroup);
        const res = await api.getAttendanceReports(`?${params.toString()}`);
        if (res.success) {
          setRecords(res.data.records || []);
          setSummary({ total_count: res.data.records?.length || 0 });
        }
      } else if (activeReport === 'exams') {
        if (selectedExamId) {
          const res = await api.getExamResultsReport(selectedExamId, division || 'institute');
          if (res.success) {
            setRecords(res.data.results || []);
            setExamMeta(res.data.exam || null);
            setSummary({
              total_count: res.data.results?.length || 0,
              passed_count: res.data.results?.filter(r => !r.is_absent && r.percentage >= 50).length || 0
            });
          }
        } else {
          setRecords([]);
        }
      } else if (activeReport === 'students') {
        if (selectedClass) params.append('class_id', selectedClass);
        if (selectedGroup) params.append('group_id', selectedGroup);
        const res = await api.getStudentsRosterReport(`?${params.toString()}`);
        if (res.success) {
          setRecords(res.data || []);
          setSummary({ total_count: res.data?.length || 0 });
        }
      } else if (activeReport === 'quran_hifdh') {
        if (selectedGroup) params.append('group_id', selectedGroup);
        const res = await api.getQuranHifdhReport(`?${params.toString()}`);
        if (res.success) {
          setRecords(res.data || []);
          setSummary({ total_count: res.data?.length || 0 });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Load complete student multi-year historical exam records
  async function handleOpenStudentHistory(studentId) {
    setStudentDetailLoading(true);
    try {
      const res = await api.getHistoricalExamReports({ student_id: studentId });
      if (res.success && res.data) {
        setSelectedStudentDetail(res.data);
      }
    } catch (e) {
      console.error(e);
      alert('Lama soo kicin karo taariikhda imtixaanka ardayga.');
    } finally {
      setStudentDetailLoading(false);
    }
  }

  async function handleDownloadExcel() {
    try {
      const params = new URLSearchParams();
      if (division) params.append('division', division);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (statusFilter) params.append(activeReport === 'finance' ? 'payment_status' : 'status', statusFilter);
      if (search) params.append('search', search);

      let blob;
      let filename = `warbixin-${activeReport}-${Date.now()}.xlsx`;

      if (activeReport === 'historical_exams') {
        if (academicYearFilter) params.append('academic_year', academicYearFilter);
        if (selectedClass) params.append('class_id', selectedClass);
        if (examPeriodFilter) params.append('exam_period', examPeriodFilter);
        if (subjectFilter) params.append('subject_id', subjectFilter);
        if (selectedStudentDetail?.student?.id) params.append('student_id', selectedStudentDetail.student.id);

        blob = await api.downloadHistoricalExamReportsExcel(params.toString());
        filename = `warbixinta-taariikhda-imtixaanaadka-${Date.now()}.xlsx`;
      } else if (activeReport === 'finance') {
        if (feeTypeFilter) params.append('fee_type', feeTypeFilter);
        if (billingPeriodFilter) params.append('billing_period', billingPeriodFilter);
        if (billingYearFilter) params.append('billing_year', billingYearFilter);
        if (academicYearFilter) params.append('academic_year', academicYearFilter);
        if (selectedClass) params.append('class_id', selectedClass);
        if (selectedGroup) params.append('group_id', selectedGroup);
        if (transactionIdFilter) params.append('transaction_id', transactionIdFilter);
        if (receivedByFilter) params.append('received_by', receivedByFilter);
        blob = await api.downloadFinanceExcel(`?${params.toString()}`);
      } else if (activeReport === 'balances') {
        if (feeTypeFilter) params.append('fee_type', feeTypeFilter);
        if (billingPeriodFilter) params.append('billing_period', billingPeriodFilter);
        if (billingYearFilter) params.append('billing_year', billingYearFilter);
        if (selectedClass) params.append('class_id', selectedClass);
        if (selectedGroup) params.append('group_id', selectedGroup);
        blob = await api.downloadOutstandingFeesExcel(`?${params.toString()}`);
      } else if (activeReport === 'attendance') {
        blob = await api.downloadAttendanceExcel(`?${params.toString()}`);
      } else if (activeReport === 'exams') {
        if (!selectedExamId) return alert('Fadlan marka hore dooro imtixaanka aad doonayso inaad soo dejiso.');
        blob = await api.downloadExamExcel(selectedExamId, division || 'institute');
        filename = `warbixin-imtixaan-${selectedExamId}-${Date.now()}.xlsx`;
      } else if (activeReport === 'students') {
        blob = await api.downloadStudentsExcel(`?${params.toString()}`);
      } else if (activeReport === 'quran_hifdh') {
        blob = await api.downloadQuranHifdhExcel(`?${params.toString()}`);
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } catch (e) {
      alert('Khalad ayaa dhacay markii la soo dejinayay Excel.');
    }
  }

  async function handleOpenReceipt(record) {
    try {
      const isExam = record.fee_type === 'exam';
      const res = isExam
        ? await api.getExamFeeReceipt(record.receipt_number)
        : await api.getReceipt(record.receipt_number);
      if (res.success) {
        setSelectedReceipt(res.data || res.receipt);
        setSelectedReceiptIsExam(isExam);
      }
    } catch (e) {
      alert(e.message || 'Lama soo kicin karo rasiidka.');
    }
  }

  async function handleOpenFinancialProfile(studentId) {
    setFinancialProfileLoading(true);
    try {
      const res = await api.getStudentFinancialProfile(studentId);
      if (res.success) setFinancialProfile(res.data);
    } catch (e) {
      alert(e.message || 'Lama soo kicin karo bayaanka maaliyadeed ee ardayga.');
    } finally {
      setFinancialProfileLoading(false);
    }
  }

  const reportTabs = [
    { id: 'historical_exams', label: '1. Diiwaanka Imtixaanaadka (Historical Exams)', icon: Award, color: '#0284c7' },
    { id: 'finance', label: '2. Lacagaha (Collections)', icon: DollarSign, color: '#0d9488' },
    { id: 'balances', label: '3. Biilasha & Haraaga (Balances)', icon: AlertTriangle, color: '#d97706' },
    { id: 'attendance', label: '4. Xaadirinta (Attendance)', icon: CalendarCheck, color: '#059669' },
    { id: 'students', label: '5. Liiska Ardayda (Roster)', icon: Users, color: '#4f46e5' },
    ...(hasQuranAccess || isSuperAdmin ? [
      { id: 'quran_hifdh', label: '6. Xifdiga Quraanka (Hifdh)', icon: BookMarked, color: '#b45309' }
    ] : [])
  ];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(13, 148, 136, 0.08)', borderRadius: '9999px', color: '#0f766e', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            Nidaamka Warbixinnada Guud (Reports)
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Warbixinnada & Taariikhda Imtixaanaadka
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.86rem', marginTop: '4px' }}>
            Raadi diiwaanka imtixaanaadka ardayda hadda dhigata, kuwii hore, iyo kuwa qalin-jabiyay (Multi-Year History).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }} className="no-print">
          <button type="button" className="btn btn-secondary" onClick={() => window.print()} style={{ fontWeight: 600 }}>
            <Printer size={16} />
            <span>Daabac (Print)</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={handleDownloadExcel} style={{ fontWeight: 600 }}>
            <Download size={16} />
            <span>Soo Deji Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Report Categories Navigation Pills */}
      <div className="card no-print" style={{ marginBottom: '20px', padding: '10px 14px', background: '#ffffff', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '8px', minWidth: 'max-content' }}>
          {reportTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeReport === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveReport(tab.id);
                  setSelectedStudentDetail(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: isActive ? `1.5px solid ${tab.color}` : '1px solid #e2e8f0',
                  background: isActive ? `${tab.color}12` : '#ffffff',
                  color: isActive ? tab.color : '#475569',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.04)' : 'none'
                }}
              >
                <Icon size={16} color={isActive ? tab.color : '#64748b'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="card no-print" style={{ marginBottom: '22px' }}>
        <div className="card-body" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            
            {/* Primary Search Bar: Name, Student Code, Phone (All Reports & Historical Exams) */}
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '260px' }}>
              <label className="form-label" style={{ fontWeight: 700 }}>
                Raadi Arday (Magac, Aqoonsi / ID, Taleefan)
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  placeholder="Gali magaca, ID-ga (STU-...), ama taleefanka..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Academic Year Filter */}
            {activeReport === 'historical_exams' && (
              <div className="form-group" style={{ marginBottom: 0, minWidth: '160px' }}>
                <label className="form-label">Sannad-Dugsiyeedka</label>
                <select className="form-select" value={academicYearFilter} onChange={(e) => setAcademicYearFilter(e.target.value)}>
                  <option value="">Dhammaan Sannadaha</option>
                  <option value="2026">2026–2027</option>
                  <option value="2025">2025–2026</option>
                  <option value="2024">2024–2025</option>
                </select>
              </div>
            )}

            {/* Class Filter */}
            {(activeReport === 'historical_exams' || activeReport === 'attendance' || activeReport === 'students' || activeReport === 'finance' || activeReport === 'balances') && (
              <div className="form-group" style={{ marginBottom: 0, minWidth: '170px' }}>
                <label className="form-label">Fasalka (Class)</label>
                <select className="form-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                  <option value="">Dhammaan Fasalada</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name || c.class_name}</option>)}
                </select>
              </div>
            )}

            {(activeReport === 'attendance' || activeReport === 'students' || activeReport === 'finance' || activeReport === 'balances') && (division === 'quran' || isSuperAdmin) && (
              <div className="form-group" style={{ marginBottom: 0, minWidth: '170px' }}>
                <label className="form-label">Halaqada (Quran Group)</label>
                <select className="form-select" value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setPage(1); }}>
                  <option value="">Dhammaan Halaqadaha</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name || g.group_name}</option>)}
                </select>
              </div>
            )}

            {(activeReport === 'finance' || activeReport === 'balances') && (
              <>
                {isSuperAdmin && (
                  <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                    <label className="form-label">Waaxda</label>
                    <select className="form-select" value={division} onChange={(e) => { setDivision(e.target.value); setPage(1); }}>
                      <option value="">Dhammaan Waaxyaha</option>
                      <option value="institute">Machadka</option>
                      <option value="quran">Dugsiga Quraanka</option>
                    </select>
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                  <label className="form-label">Nooca Waajibka</label>
                  <select className="form-select" value={feeTypeFilter} onChange={(e) => { setFeeTypeFilter(e.target.value); setPage(1); }}>
                    <option value="">Dhammaan Noocyada</option>
                    <option value="monthly">Monthly</option>
                    <option value="exam">Exam</option>
                    <option value="registration">Registration</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, minWidth: '160px' }}>
                  <label className="form-label">Billing Period</label>
                  <input className="form-input" value={billingPeriodFilter} onChange={(e) => { setBillingPeriodFilter(e.target.value); setPage(1); }} placeholder="2026-05" />
                </div>
                <div className="form-group" style={{ marginBottom: 0, minWidth: '120px' }}>
                  <label className="form-label">Sannadka</label>
                  <input className="form-input" value={billingYearFilter} onChange={(e) => { setBillingYearFilter(e.target.value); setPage(1); }} placeholder="2026" />
                </div>
                <div className="form-group" style={{ marginBottom: 0, minWidth: '160px' }}>
                  <label className="form-label">Xaaladda Waajibka</label>
                  <select className="form-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                    <option value="">Dhammaan Xaaladaha</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partially Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                {activeReport === 'finance' && (
                  <>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
                      <label className="form-label">Transaction ID</label>
                      <input className="form-input" value={transactionIdFilter} onChange={(e) => { setTransactionIdFilter(e.target.value); setPage(1); }} placeholder="ID" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
                      <label className="form-label">Received By</label>
                      <input className="form-input" value={receivedByFilter} onChange={(e) => { setReceivedByFilter(e.target.value); setPage(1); }} placeholder="Magaca shaqaalaha" />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Exam Period / Half Filter (in Historical Exams) */}
            {activeReport === 'historical_exams' && (
              <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
                <label className="form-label">Imtixaanka ama Niska (Exam/Half)</label>
                <select className="form-select" value={examPeriodFilter} onChange={(e) => setExamPeriodFilter(e.target.value)}>
                  <option value="">Dhammaan Imtixaanaadka & Nisfiyada</option>
                  <optgroup label="Qiimeynta Nisfiyada (Totals out of 100)">
                    <option value="first_half">Niska 1-aad — النصف الأول (Wadarta 100ka)</option>
                    <option value="second_half">Niska 2-aad — النصف الثاني (Wadarta 100ka)</option>
                  </optgroup>
                  <optgroup label="Imtixaannada Rasmiga ah (Official Exams)">
                    <option value="النصف الأول">النصف الأول (Ugu Badnaan 40)</option>
                    <option value="النهائي الأول">النهائي الأول (Ugu Badnaan 60)</option>
                    <option value="النصف الثاني">النصف الثاني (Ugu Badnaan 40)</option>
                    <option value="النهائي الثاني">النهائي الثاني (Ugu Badnaan 60)</option>
                  </optgroup>
                  {examPeriodsList
                    .filter(p => !['النصف الأول', 'النهائي الأول', 'النصف الثاني', 'النهائي الثاني'].includes(p.name))
                    .map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))
                  }
                </select>
              </div>
            )}

            {/* Subject Filter (in Historical Exams) */}
            {activeReport === 'historical_exams' && (
              <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
                <label className="form-label">Maaddada</label>
                <select className="form-select" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                  <option value="">Dhammaan Maaddooyinka</option>
                  {subjectsList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
            )}

            {/* Date Filters for Finance / Attendance */}
            {(activeReport === 'finance' || activeReport === 'attendance' || activeReport === 'quran_hifdh') && (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Laga bilaabo</label>
                  <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ilaa Taariikhda</label>
                  <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            )}

            {/* Clear Filters Button */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearch('');
                setAcademicYearFilter('');
                setSelectedClass('');
                setExamPeriodFilter('');
                setSubjectFilter('');
                setStartDate('');
                setEndDate('');
                setFeeTypeFilter('');
                setBillingPeriodFilter('');
                setBillingYearFilter('');
                setTransactionIdFilter('');
                setReceivedByFilter('');
                setStatusFilter('');
                setPage(1);
                setSelectedStudentDetail(null);
              }}
              style={{ fontWeight: 600, padding: '9px 14px' }}
              title="Nadiifi shaandhada"
            >
              Nadiifi
            </button>
          </div>
        </div>
      </div>

      {/* Main Report Body Card */}
      <div className="card print-card" style={{ border: '1px solid rgba(226, 232, 240, 0.9)', overflow: 'hidden' }}>
        {/* Printable Letterhead & Report Summary */}
        <div className="card-header" style={{ padding: '24px 28px', background: 'linear-gradient(to right, #ffffff, #f8fafc)', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <img
                src="/branding/tafsiir-institute-logo.jpeg"
                alt="Tafsiir Institute logo"
                style={{ display: 'block', width: 'min(100%, 360px)', maxHeight: '72px', objectFit: 'contain', objectPosition: 'left center', marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.74rem', background: '#0d948815', color: '#0f766e', padding: '3px 10px', borderRadius: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Warbixinta Rasmiga ah ee Machadka
                </span>
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#064e3b', fontFamily: 'Amiri, Cairo, serif' }}>
                معهد التفسير للعلوم الشرعية والعربية
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginTop: '2px', fontWeight: 600 }}>
                {activeReport === 'historical_exams' && 'Diiwaanka Taariikhiga ah ee Imtixaanaadka & Dalacsiinta (Multi-Year Records)'}
                {activeReport === 'finance' && 'Warbixinta Maaliyadda & Lacag-qabashada (Collections & Receipts)'}
                {activeReport === 'balances' && 'Warbixinta Biilasha & Haraaga Ardayda (Outstanding Balances)'}
                {activeReport === 'attendance' && 'Warbixinta Guud ee Xaadirinta Ardayda (Attendance Summary)'}
                {activeReport === 'exams' && `Warbixinta Natiijooyinka Imtixaanka: ${examMeta?.title || ''}`}
                {activeReport === 'students' && 'Liiska Guud ee Diiwaangelinta Ardayda (Students Roster)'}
                {activeReport === 'quran_hifdh' && 'Diiwaanka Xifdiga Quraanka Kariimka (Hifdh Progress)'}
              </p>
            </div>

            {/* Metric Summary Box */}
            <div style={{ textAlign: 'right' }}>
              {activeReport === 'historical_exams' && (
                <>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Tirada Ardayda La Helay:</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284c7' }}>
                    {records.length} arday
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    Dhiganaya: {summary.active_count || 0} | Qalin-jabiyay: {summary.graduated_count || 0}
                  </div>
                </>
              )}

              {activeReport === 'finance' && (
                <>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Wadarta Lacagta La Qabtay:</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f766e' }}>
                    ${summary?.total_amount ? summary.total_amount.toFixed(2) : '0.00'}
                  </div>
                </>
              )}

              {activeReport === 'balances' && (
                <>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Wadarta Haraaga Dhiman:</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706' }}>
                    ${summary?.total_balance ? summary.total_balance.toFixed(2) : '0.00'}
                  </div>
                </>
              )}

              {activeReport === 'attendance' && (
                <>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Tirada Ardayda:</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>
                    {records.length} arday
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Report Content Tables */}
        <div className="card-body" style={{ padding: '0' }}>
          
          {/* ======================================================== */}
          {/* 1. HISTORICAL EXAMINATIONS & STUDENT MULTI-YEAR REPORT  */}
          {/* ======================================================== */}
          {activeReport === 'historical_exams' && (
            <div style={{ padding: '24px' }}>
              {/* If a student is selected for multi-year drilldown */}
              {selectedStudentDetail ? (
                <div className="space-y-6">
                  {/* Back button to student list */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 no-print">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentDetail(null)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all"
                    >
                      <span>&larr; Ku noqo liiska ardayda</span>
                    </button>
                    <div className="text-xs text-slate-500 font-medium">
                      Taariikhda oo dhammaystiran (All Recorded Years)
                    </div>
                  </div>

                  {/* Student Profile Card */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-slate-900">
                            {selectedStudentDetail.student.full_name}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            selectedStudentDetail.student.status === 'graduated'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : selectedStudentDetail.student.is_active
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {selectedStudentDetail.student.status === 'graduated' ? 'Graduated (Qalin-jabiyay)' : selectedStudentDetail.student.is_active ? 'Active (Dhiganaya)' : 'Left (Ka baxay)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 font-mono mt-1">
                          <span>Aqoonsiga: <strong>{selectedStudentDetail.student.student_code}</strong></span>
                          <span>Taleefanka: <strong>{selectedStudentDetail.student.phone || '—'}</strong></span>
                          <span>Jinsiga: <strong className="capitalize">{selectedStudentDetail.student.gender || 'male'}</strong></span>
                        </div>
                      </div>

                      {/* Enrollment History Pills */}
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-500 mb-1">Taariikhda Fasalada (Enrollment):</div>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {selectedStudentDetail.student.enrollments?.map((en, idx) => (
                            <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700">
                              {en.academic_year}: <strong>{en.class_name}</strong> ({en.status})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Year Examination Breakdown */}
                  {selectedStudentDetail.historical_years?.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-sm font-medium">Wax imtixaanno ah oo la diiwaangeliyay lagama helin ardaygan.</p>
                    </div>
                  ) : (
                    selectedStudentDetail.historical_years?.map(yearData => (
                      <div key={yearData.academic_year} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        {/* Year Header */}
                        <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold tracking-wide">
                              Sannad-Dugsiyeedka: {yearData.academic_year}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-600 text-white">
                              Fasalkii: {yearData.class_name}
                            </span>
                          </div>
                          <span className="text-xs text-slate-300">
                            Habka: {yearData.assessment_config?.marking_mode === 'mode_a' ? 'Mode A (Saami)' : 'Mode B (100 Madaxbannaan)'}
                          </span>
                        </div>

                        {/* Two-Half Assessment System Summary Cards for this year */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 pb-0">
                          {/* First Half Card */}
                          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-emerald-900">
                                Niska 1-aad — النصف الأول (Max: 100)
                              </span>
                              {yearData.first_half?.status === 'completed' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Dhammaystiran (Completed)
                                </span>
                              ) : yearData.first_half?.status === 'provisional' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Dhiman (Provisional)
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Lama gelin</span>
                              )}
                            </div>
                            <div className="text-sm font-extrabold text-slate-800">
                              {yearData.first_half?.total_obtained !== undefined ? yearData.first_half.total_obtained : '—'}
                              <span className="text-xs font-normal text-slate-500 ml-1">/ {yearData.first_half?.total_maximum || 100} ({yearData.first_half?.percentage || 0}%)</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              Qaab-dhismeedka: النصف الأول (40) + النهائي الأول (60)
                            </div>
                          </div>

                          {/* Second Half Card */}
                          <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/60">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-teal-900">
                                Niska 2-aad — النصف الثاني (Max: 100)
                              </span>
                              {yearData.second_half?.status === 'completed' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                                  Dhammaystiran (Completed)
                                </span>
                              ) : yearData.second_half?.status === 'provisional' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Dhiman (Provisional)
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Lama gelin</span>
                              )}
                            </div>
                            <div className="text-sm font-extrabold text-slate-800">
                              {yearData.second_half?.total_obtained !== undefined ? yearData.second_half.total_obtained : '—'}
                              <span className="text-xs font-normal text-slate-500 ml-1">/ {yearData.second_half?.total_maximum || 100} ({yearData.second_half?.percentage || 0}%)</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              Qaab-dhismeedka: النصف الثاني (40) + النهائي الثاني (60)
                            </div>
                          </div>
                        </div>

                        {/* Year Exams List */}
                        <div className="p-5 space-y-4">
                          {yearData.exams?.map(ex => (
                            <div key={ex.title} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-sm text-slate-800">
                                  {ex.title}
                                </h4>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-slate-700">
                                    Wadarta: {ex.total_obtained} / {ex.total_maximum} ({ex.average_percentage}%)
                                  </span>
                                  {ex.is_provisional ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      Provisional (KMG)
                                    </span>
                                  ) : ex.average_percentage >= (yearData.assessment_config?.pass_threshold || 50) ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Gudbay (Passed)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                      Haray (Failed)
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Subject Marks Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                                      <th className="py-2 px-3">Maaddada</th>
                                      <th className="py-2 px-3 text-center">Dhibcaha La Helay</th>
                                      <th className="py-2 px-3 text-center">Ugu Sarreeya</th>
                                      <th className="py-2 px-3 text-center">Darajada</th>
                                      <th className="py-2 px-3 text-center">Xaaladda</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {ex.subjects?.map(sub => (
                                      <tr key={sub.subject_name}>
                                        <td className="py-2 px-3 font-semibold text-slate-800">{sub.subject_name}</td>
                                        <td className="py-2 px-3 text-center font-bold">
                                          {sub.is_absent ? (
                                            <span className="text-rose-600">ABS</span>
                                          ) : sub.marks_obtained !== null ? (
                                            sub.marks_obtained
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-center text-slate-500">{sub.maximum_marks}</td>
                                        <td className="py-2 px-3 text-center font-bold text-teal-700">{sub.grade || '—'}</td>
                                        <td className="py-2 px-3 text-center">
                                          {sub.is_absent ? (
                                            <span className="text-rose-600 font-bold">Ma Joogin</span>
                                          ) : sub.marks_obtained !== null && sub.marks_obtained >= 50 ? (
                                            <span className="text-emerald-700 font-bold">Baasay</span>
                                          ) : sub.marks_obtained !== null ? (
                                            <span className="text-rose-600 font-bold">Dhacay</span>
                                          ) : (
                                            <span className="text-slate-400 font-normal">Pending</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}

                          {/* Promotion Event (if recorded for this year) */}
                          {yearData.promotions?.length > 0 && (
                            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900">
                              <span className="font-bold flex items-center gap-1 mb-1">
                                <ShieldCheck size={14} /> Go'aanka Dalacsiinta ee Sannadkan:
                              </span>
                              {yearData.promotions.map((pr, pidx) => (
                                <div key={pidx} className="space-y-0.5">
                                  <span>Go'aanka: <strong className="capitalize">{pr.outcome}</strong></span>
                                  {pr.new_class_name && <span> | Fasalka loo wareejiyay: <strong>{pr.new_class_name}</strong></span>}
                                  {pr.reason && <span> | Sababta: <em>{pr.reason}</em></span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Search Results Table of Students */
                <div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                        <th>Aqoonsiga (ID)</th>
                        <th>Magaca Ardayga (Student Name)</th>
                        <th>Jinsiga</th>
                        <th>Telefoonka</th>
                        <th>Fasalka Hadda / Ugu Dambeeyay</th>
                        <th>Xaaladda</th>
                        <th style={{ textAlign: 'right' }}>Taariikhda Imtixaanka</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '36px' }}>Raadinayaa diiwaanka ardayda...</td></tr>
                      ) : records.length === 0 ? (
                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>Wax arday ah lagama helin shuruudahan.</td></tr>
                      ) : (
                        records.map((r, idx) => (
                          <tr key={r.id || idx}>
                            <td style={{ textAlign: 'center', color: '#94a3b8' }}>{idx + 1}</td>
                            <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>{r.student_code}</span></td>
                            <td>
                              <strong>{r.student_name}</strong>
                              {r.name_ar && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{r.name_ar}</div>}
                            </td>
                            <td>
                              <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                                {r.gender === 'male' ? 'Lab' : 'Dheddig'}
                              </span>
                            </td>
                            <td>{r.phone || '—'}</td>
                            <td><strong>{r.class_name || '—'}</strong></td>
                            <td>
                              <span className={`badge ${
                                r.status === 'graduated' ? 'badge-warning' : r.is_active ? 'badge-success' : 'badge-danger'
                              }`}>
                                {r.status === 'graduated' ? 'Qalin-jabiyay' : r.is_active ? 'Dhiganaya' : 'Ka baxay'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenStudentHistory(r.id)}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <span>Arag Natiijooyinka</span>
                                <ChevronRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. FINANCE COLLECTIONS REPORT                            */}
          {/* ======================================================== */}
          {activeReport === 'finance' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Taariikhda</th>
                  <th>Rasiidka #</th>
                  <th>Ardayga</th>
                  <th>Waaxda</th>
                  <th>Nooca Lacagta</th>
                  <th>Bisha / Xilliga</th>
                  <th>Wadarta ($)</th>
                  <th>Haraaga</th>
                  <th>Qaadaha</th>
                  <th>Rasiidka</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center', padding: '36px' }}>Soo dejinayaa xogta maaliyadda...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>Wax lacag-qabasho ah lagama helin shuruudahan.</td></tr>
                ) : (
                  records.map(r => (
                    <tr key={`${r.receipt_number}-${r.transaction_id}`}>
                      <td style={{ fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(r.payment_date).toLocaleDateString()}
                      </td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>{r.receipt_number}</span></td>
                      <td>
                        <strong>{r.student_name}</strong>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{r.student_code}</div>
                      </td>
                      <td>
                        <span className={`badge ${r.division === 'institute' ? 'badge-success' : 'badge-warning'}`}>
                          {r.division === 'institute' ? 'Machadka' : 'Quraanka'}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{r.fee_type_name || r.fee_type}</td>
                      <td>{r.billing_period || '-'}</td>
                      <td><strong style={{ color: '#059669', fontSize: '0.95rem' }}>${parseFloat(r.amount_paid).toFixed(2)}</strong></td>
                      <td>${parseFloat(r.balance_remaining || 0).toFixed(2)}</td>
                      <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{r.received_by_name}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenFinancialProfile(r.student_id)} title="Bayaanka maaliyadeed ee ardayga">
                            <User size={13} />
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenReceipt(r)} title="Arag ama dib u daabac rasiidka">
                            <Printer size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* ======================================================== */}
          {/* 3. BALANCES & INVOICES REPORT                            */}
          {/* ======================================================== */}
          {activeReport === 'balances' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ardayga</th>
                  <th>Aqoonsiga (ID)</th>
                  <th>Waaxda</th>
                  <th>Nooca Biilka</th>
                  <th>Xilliga</th>
                  <th>Laga Rabo ($)</th>
                  <th>Bixiyay ($)</th>
                  <th>Haraaga ($)</th>
                  <th>Xaaladda</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '36px' }}>Soo dejinayaa haraaga ardayda...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>Wax haraac ah oo dhiman lagama helin shuruudahan.</td></tr>
                ) : (
                  records.map(r => (
                    <tr key={r.obligation_id || r.id}>
                      <td><strong>{r.student_name}</strong></td>
                      <td><span style={{ fontFamily: 'monospace' }}>{r.student_code}</span></td>
                      <td>
                        <span className={`badge ${r.division === 'institute' ? 'badge-success' : 'badge-warning'}`}>
                          {r.division === 'institute' ? 'Machadka' : 'Quraanka'}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{r.fee_type_name || r.fee_type}</td>
                      <td>{r.billing_period}</td>
                      <td>${parseFloat(r.amount_due).toFixed(2)}</td>
                      <td>${parseFloat(r.amount_paid).toFixed(2)}</td>
                      <td><strong style={{ color: '#dc2626' }}>${parseFloat(r.balance || 0).toFixed(2)}</strong></td>
                      <td>
                        <span className={`badge ${r.status === 'paid' ? 'badge-success' : r.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                          {r.status === 'paid' ? 'Wada Bixiyay' : r.status === 'partial' ? 'Qayb Bixiyay' : 'Aan Bixin'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* ======================================================== */}
          {/* 4. ATTENDANCE REPORT                                     */}
          {/* ======================================================== */}
          {activeReport === 'attendance' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Aqoonsiga (ID)</th>
                  <th>Magaca Ardayga</th>
                  <th>Fasalka / Halaqada</th>
                  <th>Joogay (Present)</th>
                  <th>Maqnaa (Absent)</th>
                  <th>Idan (Excused)</th>
                  <th>Goor-dambe (Late)</th>
                  <th>Wadarta Fadhiyada</th>
                  <th>Boqolkiiba (%)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '36px' }}>Soo dejinayaa xogta xaadirinta...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>Wax xog xaadirin ah lagama helin.</td></tr>
                ) : (
                  records.map((r, idx) => {
                    const total = (r.present_count || 0) + (r.absent_count || 0) + (r.excused_count || 0) + (r.late_count || 0);
                    const rate = total > 0 ? (((r.present_count || 0) + (r.late_count || 0)) / total) * 100 : 0;
                    return (
                      <tr key={r.student_id || idx}>
                        <td><span style={{ fontFamily: 'monospace' }}>{r.student_code}</span></td>
                        <td><strong>{r.student_name}</strong></td>
                        <td>{r.class_name || r.group_name || '-'}</td>
                        <td><span className="badge badge-success">{r.present_count || 0}</span></td>
                        <td><span className="badge badge-danger">{r.absent_count || 0}</span></td>
                        <td><span className="badge badge-warning">{r.excused_count || 0}</span></td>
                        <td><span className="badge badge-info">{r.late_count || 0}</span></td>
                        <td><strong>{total}</strong></td>
                        <td>
                          <span style={{ fontWeight: 700, color: rate >= 80 ? '#059669' : rate >= 60 ? '#d97706' : '#dc2626' }}>
                            {rate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* ======================================================== */}
          {/* 5. STUDENTS ROSTER REPORT                                */}
          {/* ======================================================== */}
          {activeReport === 'students' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Aqoonsiga (ID)</th>
                  <th>Magaca Buuxa</th>
                  <th>Jinsiga</th>
                  <th>Telefoonka</th>
                  <th>Fasalka (Machadka)</th>
                  <th>Halaqada (Quraanka)</th>
                  <th>Waalidka / Xiriirka</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '36px' }}>Soo dejinayaa liiska ardayda...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>Wax arday ah lagama helin shuruudahan.</td></tr>
                ) : (
                  records.map(r => (
                    <tr key={r.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>{r.student_code}</span></td>
                      <td><strong>{r.student_name}</strong></td>
                      <td>
                        <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                          {r.gender === 'male' ? 'Lab' : 'Dheddig'}
                        </span>
                      </td>
                      <td>{r.student_phone || '-'}</td>
                      <td>{r.class_name ? <span className="badge badge-success">{r.class_name}</span> : '-'}</td>
                      <td>{r.group_name ? <span className="badge badge-warning">{r.group_name}</span> : '-'}</td>
                      <td style={{ fontSize: '0.82rem', color: '#475569' }}>
                        {r.emergency_contact_name} {r.emergency_contact_phone ? `(${r.emergency_contact_phone})` : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* ======================================================== */}
          {/* 6. QURAN HIFDH TRACKING REPORT                           */}
          {/* ======================================================== */}
          {activeReport === 'quran_hifdh' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Taariikhda</th>
                  <th>Aqoonsiga (ID)</th>
                  <th>Magaca Ardayga</th>
                  <th>Halaqada</th>
                  <th>Suuradda & Aayadaha</th>
                  <th>Qiimaynta</th>
                  <th>Macallinka</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '36px' }}>Soo dejinayaa diiwaanka xifdiga...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>Wax diiwaan xifdi ah lagama helin.</td></tr>
                ) : (
                  records.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(r.record_date).toLocaleDateString()}
                      </td>
                      <td><span style={{ fontFamily: 'monospace' }}>{r.student_code}</span></td>
                      <td><strong>{r.student_name}</strong></td>
                      <td><span className="badge badge-warning">{r.group_name}</span></td>
                      <td>
                        <strong>{r.surah_name}</strong>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          Aayadaha: {r.from_ayah || 1} - {r.to_ayah || ''}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          r.rating === 'mumtaz' ? 'badge-success' :
                          r.rating === 'jayid_jiddan' ? 'badge-info' :
                          r.rating === 'jayid' ? 'badge-warning' : 'badge-danger'
                        }`} style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                          {r.rating === 'mumtaz' ? 'Mumtaaz (ممتاز)' :
                           r.rating === 'jayid_jiddan' ? 'Jayid Jiddan (جيد جدا)' :
                           r.rating === 'jayid' ? 'Jayid (جيد)' : r.rating}
                        </span>
                      </td>
                      <td>{r.teacher_name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(activeReport === 'finance' || activeReport === 'balances') && totalPages > 1 && (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>
            Hore
          </button>
          <span style={{ color: '#475569', fontWeight: 700 }}>Bogga {page} / {totalPages}</span>
          <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}>
            Xiga
          </button>
        </div>
      )}

      {financialProfile && (
        <div className="modal-overlay" style={{ zIndex: 9998, overflowY: 'auto', padding: '16px 12px' }}>
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              .financial-profile-print, .financial-profile-print * { visibility: visible !important; }
              .financial-profile-print { position: absolute !important; inset: 0 !important; width: 100% !important; max-width: none !important; box-shadow: none !important; padding: 0 !important; }
              .financial-profile-no-print { display: none !important; }
            }
          `}</style>
          <div className="financial-profile-print" style={{ width: 'min(1100px, 98vw)', maxHeight: '92vh', overflowY: 'auto', margin: '0 auto', background: '#ffffff', borderRadius: '12px', padding: '20px 24px', color: '#0f172a', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)' }}>
            <div className="financial-profile-no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px', position: 'sticky', top: 0, background: '#ffffff', padding: '6px 0', zIndex: 10, borderBottom: '1px solid #f1f5f9' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={15} /> Print Statement</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFinancialProfile(null)}><X size={15} /> Close</button>
            </div>
            <div style={{ borderBottom: '2px solid #0f766e', paddingBottom: '12px', marginBottom: '16px' }}>
              <img src="/branding/tafsiir-institute-logo.jpeg" alt="Tafsiir Institute logo" style={{ width: 'min(100%, 360px)', maxHeight: '70px', objectFit: 'contain', objectPosition: 'left center' }} />
              <h2 style={{ margin: '8px 0 2px', fontSize: '1.25rem' }}>Student Financial Statement</h2>
              <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Complete available financial history from the database</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', marginBottom: '18px' }}>
              <div><strong>Student:</strong> {financialProfile.student.full_name}</div>
              <div><strong>ID:</strong> {financialProfile.student.student_code}</div>
              <div><strong>Phone:</strong> {financialProfile.student.phone || '-'}</div>
              <div><strong>Guardian:</strong> {financialProfile.student.guardian_phone || '-'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: '8px' }}><small>Total Paid</small><div style={{ fontSize: '1.2rem', fontWeight: 800 }}>${Number(financialProfile.summary?.total_paid || 0).toFixed(2)}</div></div>
              <div style={{ padding: '12px', background: '#fff7ed', borderRadius: '8px' }}><small>Total Outstanding</small><div style={{ fontSize: '1.2rem', fontWeight: 800 }}>${Number(financialProfile.summary?.total_outstanding || 0).toFixed(2)}</div></div>
              {Object.entries(financialProfile.summary?.outstanding_by_fee_type || {}).map(([type, amount]) => (
                <div key={type} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}><small>{type} outstanding</small><div style={{ fontSize: '1.05rem', fontWeight: 800 }}>${Number(amount || 0).toFixed(2)}</div></div>
              ))}
            </div>
            <h3 style={{ fontSize: '1rem', margin: '14px 0 8px' }}>Obligations</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table"><thead><tr><th>Department</th><th>Fee Type</th><th>Period</th><th>Due</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>
                {(financialProfile.obligations || []).map(row => <tr key={`ob-${row.obligation_id}`}><td>{row.division}</td><td>{row.fee_type}</td><td>{row.billing_period}</td><td>${Number(row.amount_due || 0).toFixed(2)}</td><td>${Number(row.amount_paid || 0).toFixed(2)}</td><td>${Number(row.balance || 0).toFixed(2)}</td><td>{row.status}</td></tr>)}
              </tbody></table>
            </div>
            <h3 style={{ fontSize: '1rem', margin: '18px 0 8px' }}>Payments & Receipts</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table"><thead><tr><th>Date</th><th>Receipt</th><th>Department</th><th>Fee Type</th><th>Period</th><th>Paid</th><th>Received By</th><th className="financial-profile-no-print">Action</th></tr></thead><tbody>
                {(financialProfile.payments || []).map(row => <tr key={`${row.transaction_type}-${row.transaction_id}`}><td>{row.payment_date ? new Date(row.payment_date).toLocaleDateString() : '-'}</td><td style={{ fontFamily: 'monospace' }}>{row.receipt_number}</td><td>{row.division}</td><td>{row.fee_type}</td><td>{row.billing_period}</td><td>${Number(row.amount_paid || 0).toFixed(2)}</td><td>{row.received_by_name || '-'}</td><td className="financial-profile-no-print"><button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenReceipt(row)}><Printer size={13} /></button></td></tr>)}
              </tbody></table>
            </div>
          </div>
        </div>
      )}

      {selectedReceipt && (
        selectedReceiptIsExam ? (
          <CenteredArabicExamReceipt
            receipt={selectedReceipt}
            onClose={() => { setSelectedReceipt(null); setSelectedReceiptIsExam(false); }}
          />
        ) : (
          <ReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
        )
      )}
    </div>
  );
}
