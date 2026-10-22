import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Award,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Printer,
  Calendar,
  User,
  BookMarked,
  RefreshCw,
  Edit2,
  Trash2,
  Settings,
  HelpCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Minus,
  Check,
  FileText,
  AlertCircle,
  Eye,
  ZoomIn,
  ZoomOut,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function QuranExamsPage({ onSwitchToInstitute }) {
  const { user, isSuperAdmin, isQuranAdmin, isExamOfficer, isTeacher } = useAuth();
  const canManageScoring = isSuperAdmin || isQuranAdmin;
  const canExamine = isSuperAdmin || isQuranAdmin || isExamOfficer;

  // Active view: 'sessions' | 'new_exam' | 'history' | 'scoring_settings'
  const [activeTab, setActiveTab] = useState('sessions');

  // Master Data
  const [errorTypes, setErrorTypes] = useState([]);
  const [historyExams, setHistoryExams] = useState([]);
  const [quranGroups, setQuranGroups] = useState([]);
  const [examSessions, setExamSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  function showMessage(type, message) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
  }

  // ==========================================================================
  // EXAM SESSIONS STATE
  // ==========================================================================
  const [selectedExamSessionId, setSelectedExamSessionId] = useState('');
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sessionAcademicYear, setSessionAcademicYear] = useState('2025/2026');
  const [sessionTerm, setSessionTerm] = useState('Term 1');
  const [sessionTotalMarks, setSessionTotalMarks] = useState(100);
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [sessionFormError, setSessionFormError] = useState('');

  // Delete Modals State
  const [showDeleteSessionModal, setShowDeleteSessionModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [showDeleteExamModal, setShowDeleteExamModal] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // History filtering by Session
  const [historySessionFilter, setHistorySessionFilter] = useState('all');

  // ==========================================================================
  // 1. NEW EXAMINATION FORM STATE
  // ==========================================================================
  const [studentSearch, setStudentSearch] = useState('');
  const [searchedStudents, setSearchedStudents] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [startJuz, setStartJuz] = useState(1);
  const [endJuz, setEndJuz] = useState(1);
  const [examDate, setExamDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [examinerName, setExaminerName] = useState(user?.full_name || '');
  const [maxMarks, setMaxMarks] = useState(100);
  const [examNotes, setExamNotes] = useState('');
  const [recordedErrors, setRecordedErrors] = useState([]); // [{ error_type_id, occurrences, notes }]

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Result View / Print Modal (Single Student Certificate)
  const [viewingExam, setViewingExam] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [certZoom, setCertZoom] = useState(1);

  // A4 Master Score Sheet Print Modal (Multi-Student / Batch Roster)
  const [showMasterPrintModal, setShowMasterPrintModal] = useState(false);
  const [printOrientation, setPrintOrientation] = useState('landscape'); // 'landscape' | 'portrait'
  const [printSortBy, setPrintSortBy] = useState('score_desc'); // 'score_desc' | 'name_asc' | 'date_desc'

  // Edit / Correct History Exam Modal
  const [editingExam, setEditingExam] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // ==========================================================================
  // 2. SCORING SETTINGS STATE
  // ==========================================================================
  const [showErrorTypeModal, setShowErrorTypeModal] = useState(false);
  const [editingErrorType, setEditingErrorType] = useState(null);
  const [errName, setErrName] = useState('');
  const [errNameAr, setErrNameAr] = useState('');
  const [errDesc, setErrDesc] = useState('');
  const [errSeverity, setErrSeverity] = useState('medium');
  const [errDeduction, setErrDeduction] = useState('1.00');
  const [errIsActive, setErrIsActive] = useState(true);
  const [savingErrorType, setSavingErrorType] = useState(false);

  // History Search & Filtering & Multi-Selection State
  const [historySearch, setHistorySearch] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [selectedExamIds, setSelectedExamIds] = useState(new Set());

  // Initial Load
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      const [errorsRes, examsRes, groupsRes, sessionsRes] = await Promise.all([
        api.getExamErrorTypes(),
        api.getMemorizationExams(),
        api.getQuranGroups(),
        api.getQuranExamSessions()
      ]);
      if (errorsRes.success) setErrorTypes(errorsRes.data);
      if (examsRes.success) setHistoryExams(examsRes.data);
      if (groupsRes && groupsRes.success) setQuranGroups(groupsRes.data);
      if (sessionsRes && sessionsRes.success) {
        setExamSessions(sessionsRes.data);
        if (sessionsRes.data.length > 0 && !selectedExamSessionId) {
          setSelectedExamSessionId(sessionsRes.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
      showMessage('error', e.message || 'Cilad ayaa dhacday markii xogta la soo qaadayay.');
    } finally {
      setLoading(false);
    }
  }

  // Student search effect (debounced)
  useEffect(() => {
    if (!studentSearch.trim() || selectedStudent) {
      setSearchedStudents([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await api.searchStudentsForExam(`?q=${encodeURIComponent(studentSearch.trim())}`);
        if (res.success) {
          setSearchedStudents(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [studentSearch, selectedStudent]);

  // ==========================================================================
  // 3. ERROR OCCURRENCE HELPERS & SCORE CALCULATIONS
  // ==========================================================================
  function addOrIncrementError(typeId) {
    setRecordedErrors(prev => {
      const idx = prev.findIndex(e => e.error_type_id === typeId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], occurrences: copy[idx].occurrences + 1 };
        return copy;
      } else {
        return [...prev, { error_type_id: typeId, occurrences: 1, notes: '' }];
      }
    });
  }

  function decrementError(typeId) {
    setRecordedErrors(prev => {
      const idx = prev.findIndex(e => e.error_type_id === typeId);
      if (idx < 0) return prev;
      if (prev[idx].occurrences > 1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], occurrences: copy[idx].occurrences - 1 };
        return copy;
      } else {
        return prev.filter(e => e.error_type_id !== typeId);
      }
    });
  }

  function updateErrorNotes(typeId, notes) {
    setRecordedErrors(prev =>
      prev.map(e => (e.error_type_id === typeId ? { ...e, notes } : e))
    );
  }

  function removeError(typeId) {
    setRecordedErrors(prev => prev.filter(e => e.error_type_id !== typeId));
  }

  // Calculate live deductions and final score
  const totalErrorCount = recordedErrors.reduce((sum, e) => sum + e.occurrences, 0);

  const totalDeductions = recordedErrors.reduce((sum, e) => {
    const typeObj = errorTypes.find(t => t.id === e.error_type_id);
    const rate = typeObj ? parseFloat(typeObj.deduction_points) : 0;
    return sum + rate * e.occurrences;
  }, 0);

  const roundedDeductions = Math.round(totalDeductions * 100) / 100;
  const parsedMaxMarks = parseFloat(maxMarks) || 100;
  const finalScore = Math.max(0, Math.round((parsedMaxMarks - roundedDeductions) * 100) / 100);

  function getGradeLabel(score, max) {
    const pct = max > 0 ? (score / max) * 100 : 0;
    if (pct >= 90) return { label: 'Mumtaz (ممتاز)', color: '#059669', bg: '#ecfdf5' };
    if (pct >= 80) return { label: 'Jayyid Jiddan (جيد جداً)', color: '#0284c7', bg: '#f0f9ff' };
    if (pct >= 65) return { label: 'Jayyid (جيد)', color: '#0d9488', bg: '#f0fdfa' };
    if (pct >= 50) return { label: 'Maqbul (مقبول)', color: '#d97706', bg: '#fffbeb' };
    return { label: 'Daeef / Haray (ضعيف)', color: '#dc2626', bg: '#fef2f2' };
  }

  const currentGrade = getGradeLabel(finalScore, parsedMaxMarks);

  // Check if selected student already has a graded result in the selected exam session
  const isStudentAlreadyInSession = useMemo(() => {
    if (!selectedStudent || !selectedExamSessionId) return false;
    return historyExams.some(
      h => h.student_id === selectedStudent.id && String(h.exam_id) === String(selectedExamSessionId)
    );
  }, [selectedStudent, selectedExamSessionId, historyExams]);

  // Session Handlers
  async function handleCreateSession(e) {
    e.preventDefault();
    if (!sessionTitle.trim()) {
      setSessionFormError('Fadlan geli magaca ama ciwaanka imtixaanka.');
      return;
    }
    setSessionFormError('');
    setSessionSubmitting(true);
    try {
      const res = await api.createQuranExamSession({
        title: sessionTitle.trim(),
        exam_date: sessionDate,
        academic_year: sessionAcademicYear,
        term: sessionTerm,
        total_marks: sessionTotalMarks
      });
      if (res.success) {
        showMessage('success', res.message || 'Kalka imtixaanka si guul leh ayaa loo abuuray.');
        setShowCreateSessionModal(false);
        setSessionTitle('');
        const sRes = await api.getQuranExamSessions();
        if (sRes.success) {
          setExamSessions(sRes.data);
          setSelectedExamSessionId(res.data.id);
        }
      }
    } catch (err) {
      setSessionFormError(err.message || 'Cilad ayaa dhacday markii kalka la abuurayay.');
    } finally {
      setSessionSubmitting(false);
    }
  }

  function handleOpenDeleteSession(session) {
    setSessionToDelete(session);
    setShowDeleteSessionModal(true);
  }

  async function handleConfirmDeleteSession() {
    if (!sessionToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await api.deleteQuranExamSession(sessionToDelete.id);
      if (res.success) {
        showMessage('success', res.message || 'Kalka imtixaanka si guul leh ayaa loo tirtiray.');
        setShowDeleteSessionModal(false);
        setSessionToDelete(null);
        const [sRes, eRes] = await Promise.all([
          api.getQuranExamSessions(),
          api.getMemorizationExams()
        ]);
        if (sRes.success) setExamSessions(sRes.data);
        if (eRes.success) setHistoryExams(eRes.data);
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday markii la tirtirayay kalka imtixaanka.');
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleOpenDeleteExam(ex) {
    setExamToDelete(ex);
    setShowDeleteExamModal(true);
  }

  async function handleConfirmDeleteExamResult() {
    if (!examToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await api.deleteMemorizationExam(examToDelete.id);
      if (res.success) {
        showMessage('success', res.message || 'Natiijada imtixaanka si buuxda ayaa loo tirtiray.');
        setShowDeleteExamModal(false);
        setExamToDelete(null);
        const [eRes, sRes] = await Promise.all([
          api.getMemorizationExams(),
          api.getQuranExamSessions()
        ]);
        if (eRes.success) setHistoryExams(eRes.data);
        if (sRes.success) setExamSessions(sRes.data);
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday markii la tirtirayay natiijada.');
    } finally {
      setDeleteLoading(false);
    }
  }

  // Reset exam form
  function resetExamForm() {
    setSelectedStudent(null);
    setStudentSearch('');
    setStartJuz(1);
    setEndJuz(1);
    setExamDate(new Date().toISOString().split('T')[0]);
    setRecordedErrors([]);
    setExamNotes('');
  }

  // Submit and confirm save exam
  async function handleConfirmSaveExam() {
    if (!selectedStudent) {
      showMessage('error', 'Fadlan dooro ardayga.');
      return;
    }
    if (isStudentAlreadyInSession) {
      showMessage('error', 'Ardaygani horey ayuu u galay imtixaankan. Lama gelin karo labo jeer.');
      return;
    }
    if (parseInt(startJuz, 10) > parseInt(endJuz, 10)) {
      showMessage('error', 'Juz-ka bilowgu kama weynaan karo Juz-ka dhammaadka.');
      return;
    }

    try {
      setSaveLoading(true);
      const payload = {
        student_id: selectedStudent.id,
        exam_id: selectedExamSessionId ? parseInt(selectedExamSessionId, 10) : null,
        group_id: selectedStudent.group_id || null,
        exam_date: examDate,
        start_juz: parseInt(startJuz, 10),
        end_juz: parseInt(endJuz, 10),
        examiner_name: examinerName || user?.full_name || 'Macallin',
        maximum_marks: parsedMaxMarks,
        errors: recordedErrors,
        notes: examNotes,
        result: currentGrade.label
      };

      const res = await api.createMemorizationExam(payload);
      if (res.success) {
        setShowConfirmModal(false);
        showMessage('success', 'Imtixaanka Quraanka si guul leh ayaa loo diiwaangeliyay!');

        // Refresh history and sessions
        const [listRes, sessRes] = await Promise.all([
          api.getMemorizationExams(),
          api.getQuranExamSessions()
        ]);
        if (listRes.success) setHistoryExams(listRes.data);
        if (sessRes.success) setExamSessions(sessRes.data);

        // Fetch newly created exam with full error breakdown for viewing & printing
        const fullExamRes = await api.getMemorizationExamById(res.data.id);
        if (fullExamRes.success) {
          setViewingExam(fullExamRes.data);
          setShowResultModal(true);
        }

        resetExamForm();
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday markii imtixaanka la kaydinayay.');
    } finally {
      setSaveLoading(false);
    }
  }

  // Open View / Print Result Modal
  async function handleViewExam(examId) {
    try {
      const res = await api.getMemorizationExamById(examId);
      if (res.success) {
        setViewingExam(res.data);
        setShowResultModal(true);
      }
    } catch (e) {
      showMessage('error', e.message || 'Lama soo kicin karo xogta imtixaanka.');
    }
  }

  // ==========================================================================
  // 4. SCORING SETTINGS HANDLERS
  // ==========================================================================
  function handleOpenCreateErrorType() {
    setEditingErrorType(null);
    setErrName('');
    setErrNameAr('');
    setErrDesc('');
    setErrSeverity('medium');
    setErrDeduction('1.00');
    setErrIsActive(true);
    setShowErrorTypeModal(true);
  }

  function handleOpenEditErrorType(errType) {
    setEditingErrorType(errType);
    setErrName(errType.name);
    setErrNameAr(errType.name_ar || '');
    setErrDesc(errType.description || '');
    setErrSeverity(errType.severity);
    setErrDeduction(String(errType.deduction_points));
    setErrIsActive(!!errType.is_active);
    setShowErrorTypeModal(true);
  }

  async function handleSaveErrorType(e) {
    e.preventDefault();
    if (!errName.trim()) {
      showMessage('error', 'Magaca nooca khaladka waa qasab.');
      return;
    }

    try {
      setSavingErrorType(true);
      const payload = {
        name: errName.trim(),
        name_ar: errNameAr.trim() || null,
        description: errDesc.trim() || null,
        severity: errSeverity,
        deduction_points: parseFloat(errDeduction),
        is_active: errIsActive
      };

      if (editingErrorType) {
        const res = await api.updateExamErrorType(editingErrorType.id, payload);
        if (res.success) showMessage('success', res.message);
      } else {
        const res = await api.createExamErrorType(payload);
        if (res.success) showMessage('success', res.message);
      }

      setShowErrorTypeModal(false);
      const ref = await api.getExamErrorTypes();
      if (ref.success) setErrorTypes(ref.data);
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday markii la kaydinayay.');
    } finally {
      setSavingErrorType(false);
    }
  }

  async function handleToggleErrorType(id) {
    try {
      const res = await api.toggleExamErrorType(id);
      if (res.success) {
        setErrorTypes(prev => prev.map(t => (t.id === id ? { ...t, is_active: res.is_active } : t)));
        showMessage('success', res.message);
      }
    } catch (err) {
      showMessage('error', err.message);
    }
  }

  async function handleDeleteErrorType(id) {
    if (!window.confirm('Ma hubtaa inaad tirtirto ama xannibto nooca khaladkan?')) return;
    try {
      const res = await api.deleteExamErrorType(id);
      showMessage('success', res.message);
      const ref = await api.getExamErrorTypes();
      if (ref.success) setErrorTypes(ref.data);
    } catch (err) {
      showMessage('error', err.message);
    }
  }

  // Filtered History Exams with Group & Text Search & Session Filter
  const filteredHistory = historyExams.filter(ex => {
    // 0. Session Filter
    if (historySessionFilter !== 'all') {
      if (String(ex.exam_id) !== String(historySessionFilter)) {
        return false;
      }
    }
    // 1. Group / Class Filter
    if (selectedGroupFilter !== 'all') {
      if (String(ex.group_id) !== String(selectedGroupFilter)) {
        return false;
      }
    }
    // 2. Search query (matches student Somali/English name, Arabic name, Student ID, Examiner, Group name)
    if (!historySearch.trim()) return true;
    const term = historySearch.toLowerCase();
    const nameMatch = (ex.student_name || '').toLowerCase().includes(term);
    const arMatch = (ex.student_name_ar || '').toLowerCase().includes(term);
    const codeMatch = (ex.student_code || '').toLowerCase().includes(term);
    const examinerMatch = (ex.examiner_name || '').toLowerCase().includes(term);
    const groupMatch = (ex.group_name || '').toLowerCase().includes(term);
    return nameMatch || arMatch || codeMatch || examinerMatch || groupMatch;
  });

  // Multi-Selection Logic for Batch Master Print
  const allFilteredSelected =
    filteredHistory.length > 0 && filteredHistory.every(ex => selectedExamIds.has(ex.id));

  function toggleSelectExam(id) {
    setSelectedExamIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      setSelectedExamIds(prev => {
        const next = new Set(prev);
        filteredHistory.forEach(ex => next.delete(ex.id));
        return next;
      });
    } else {
      setSelectedExamIds(prev => {
        const next = new Set(prev);
        filteredHistory.forEach(ex => next.add(ex.id));
        return next;
      });
    }
  }

  // Prepared & Sorted Exams for A4 Master Score Sheet Print
  // Strictly deduplicated by student_id: Each student is guaranteed to appear exactly 1 time!
  const examsForMasterPrint = useMemo(() => {
    let list = [];
    if (selectedExamIds.size > 0) {
      list = historyExams.filter(ex => selectedExamIds.has(ex.id));
    } else {
      list = [...filteredHistory];
    }

    // GUARANTEE: Dedup by student_id so NO student appears twice on Master Print
    const seenStudentIds = new Set();
    const dedupedList = [];
    for (const ex of list) {
      if (!seenStudentIds.has(ex.student_id)) {
        seenStudentIds.add(ex.student_id);
        dedupedList.push(ex);
      }
    }

    return dedupedList.sort((a, b) => {
      if (printSortBy === 'score_desc') {
        const scoreA = parseFloat(a.final_score !== null && a.final_score !== undefined ? a.final_score : a.marks_obtained || 0);
        const scoreB = parseFloat(b.final_score !== null && b.final_score !== undefined ? b.final_score : b.marks_obtained || 0);
        if (scoreB !== scoreA) return scoreB - scoreA; // Highest score first: 100, 100, 95...
        return (a.student_name_ar || a.student_name || '').localeCompare(b.student_name_ar || b.student_name || '', 'ar');
      } else if (printSortBy === 'name_asc') {
        return (a.student_name_ar || a.student_name || '').localeCompare(b.student_name_ar || b.student_name || '', 'ar');
      } else if (printSortBy === 'date_desc') {
        return new Date(b.exam_date || 0) - new Date(a.exam_date || 0);
      }
      return 0;
    });
  }, [historyExams, filteredHistory, selectedExamIds, printSortBy]);

  // Dynamic Error Columns for A4 Master Sheet
  const visibleErrorTypes = useMemo(() => {
    const map = new Map();
    // 1. Active configured error types
    errorTypes.filter(t => t.is_active).forEach(t => {
      map.set(t.id, t);
    });
    // 2. Any additional error types recorded in the selected exams
    examsForMasterPrint.forEach(ex => {
      (ex.errors || []).forEach(err => {
        if (err.error_type_id && !map.has(err.error_type_id)) {
          map.set(err.error_type_id, {
            id: err.error_type_id,
            name: err.error_name,
            name_ar: err.error_name_ar || err.error_name,
            deduction_points: err.deduction_per_unit || 1
          });
        }
      });
    });
    return Array.from(map.values());
  }, [errorTypes, examsForMasterPrint]);

  // ==========================================================================
  // EXPORT MASTER ROSTER / EXAM RESULTS TO EXCEL (.xlsx)
  // ==========================================================================
  function handleExportToExcel() {
    if (!examsForMasterPrint || examsForMasterPrint.length === 0) {
      showMessage('error', 'Ma jiraan xog imtixaan oo loo dhoofin karo Excel.');
      return;
    }

    try {
      const rows = examsForMasterPrint.map((ex, idx) => {
        const finalScoreVal = parseFloat(
          ex.final_score !== null && ex.final_score !== undefined
            ? ex.final_score
            : ex.marks_obtained || 0
        );
        const maxVal = parseFloat(ex.maximum_marks || 100);
        const grade = getGradeLabel(finalScoreVal, maxVal);
        const totalDed = parseFloat(ex.total_deductions) || 0;
        const pct = ((finalScoreVal / maxVal) * 100).toFixed(1) + '%';

        const rowObj = {
          'Kaalinta (Rank)': idx + 1,
          'Magaca Ardayga (Student Name)': ex.student_name_ar || ex.student_name || '',
          'Student ID': ex.student_code || '',
          'Halaqada (Class)': ex.group_name || 'Halaqo Guud',
          'Heerka Juz (Juz Range)':
            ex.start_juz === ex.end_juz
              ? `Juz ${ex.start_juz}`
              : `Juz ${ex.start_juz} - ${ex.end_juz}`
        };

        // Error breakdown columns
        visibleErrorTypes.forEach(et => {
          const match = (ex.errors || []).find(
            e => e.error_type_id === et.id || e.error_name === et.name
          );
          const colName = `${et.name_ar || et.name} (-${parseFloat(et.deduction_points)}d)`;
          rowObj[colName] = match ? match.occurrences : 0;
        });

        rowObj['Wadarta Jarista (Total Deductions)'] = totalDed > 0 ? -totalDed : 0;
        rowObj['Dhibcaha (Score)'] = finalScoreVal;
        rowObj['Dhibcaha Buuxa (Max)'] = maxVal;
        rowObj['Boqolkiiba (%)'] = pct;
        rowObj['Natiijada (Grade)'] = ex.result || grade.label;
        rowObj['Taariikhda (Exam Date)'] = ex.exam_date
          ? new Date(ex.exam_date).toLocaleDateString()
          : '';
        rowObj['Imtixaamayaha (Examiner)'] = ex.examiner_name || '';

        return rowObj;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Set column widths dynamically
      const colWidths = Object.keys(rows[0] || {}).map(key => {
        const maxLen = Math.max(
          key.length,
          ...rows.map(r => String(r[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 3, 10), 38) };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Natiijooyinka Imtixaanka');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Natiijooyinka_Quraanka_${dateStr}.xlsx`);
      showMessage('success', 'Faylka Excel (.xlsx) si guul leh ayaa loo soo dejiyay!');
    } catch (err) {
      console.error('Excel Export Error:', err);
      showMessage('error', 'Cilad ayaa dhacday markii Excel la dhoofinayay: ' + (err.message || ''));
    }
  }

  // Master Sheet KPI summary calculations
  const masterSheetStats = useMemo(() => {
    const total = examsForMasterPrint.length;
    if (total === 0) return { total: 0, avg: '0.0', mumtazCount: 0, maxScore: '0.0', topStudent: '-' };

    let sum = 0;
    let mumtazCount = 0;
    let maxScore = -1;
    let topStudent = '-';

    examsForMasterPrint.forEach(ex => {
      const score = parseFloat(ex.final_score !== null && ex.final_score !== undefined ? ex.final_score : ex.marks_obtained || 0);
      const max = parseFloat(ex.maximum_marks || 100);
      sum += score;
      if (score > maxScore) {
        maxScore = score;
        topStudent = ex.student_name_ar || ex.student_name;
      }
      const pct = (score / max) * 100;
      if (pct >= 90) mumtazCount++;
    });

    return {
      total,
      avg: (sum / total).toFixed(1),
      mumtazCount,
      maxScore: maxScore >= 0 ? maxScore.toFixed(1) : '0.0',
      topStudent
    };
  }, [examsForMasterPrint]);

  if (isTeacher) {
    return (
      <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
        <ShieldCheck size={48} style={{ margin: '0 auto 12px auto', color: '#cbd5e1' }} />
        <h3 style={{ margin: '0 0 6px 0', color: '#1e293b', fontWeight: 700 }}>
          Ma lihid fasax aad ku gasho qaybta Imtixaanaadka
        </h3>
        <p style={{ margin: 0, fontSize: '0.88rem' }}>
          Imtixaanaadka dugsiga waxaa si toos ah u maamula Xafiiska Imtixaanaadka (Examination Office).
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Feedback Toast */}
      {feedback.message && (
        <div
          className="card no-print"
          style={{
            marginBottom: '16px',
            backgroundColor: feedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${feedback.type === 'error' ? '#fca5a5' : '#86efac'}`,
            padding: '12px 16px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedback.type === 'error' ? (
              <AlertTriangle size={20} color="#dc2626" />
            ) : (
              <CheckCircle2 size={20} color="#16a34a" />
            )}
            <span
              style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: feedback.type === 'error' ? '#991b1b' : '#166534'
              }}
            >
              {feedback.message}
            </span>
          </div>
          <button
            onClick={() => setFeedback({ type: '', message: '' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main Page Header */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Imtixaanka Xifdiga Qur’aanka
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
            Diiwaangelinta, xisaabinta dhibcaha khaladaadka, iyo taariikhda imtixaanaadka xifdiga.
          </p>
        </div>

        {/* SuperAdmin Quick Switcher if applicable */}
        {isSuperAdmin && onSwitchToInstitute && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onSwitchToInstitute}
            title="U gudub Imtixaanaadka Machadka"
          >
            <ArrowRight size={14} /> Imtixaanka Machadka (Institute)
          </button>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('sessions')}
            style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Calendar size={15} />
            <span>1. Kalka Imtixaanka ({examSessions.length})</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'new_exam' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('new_exam')}
            style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Award size={15} />
            <span>2. Qaad Imtixaan Cusub</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
            style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={15} />
            <span>3. Diiwaanka Imtixaanaadka ({historyExams.length})</span>
          </button>

          {canManageScoring && (
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'scoring_settings' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('scoring_settings')}
              style={{ borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Settings size={15} />
              <span>4. Habaynta Khaladaadka & Dhibcaha</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: KALKA IMTIXAANKA (EXAM SESSIONS MENU)                         */}
      {/* ==================================================================== */}
      {activeTab === 'sessions' && (
        <div className="no-print">
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Kalka Imtixaanaadka Xifdiga Qur'aanka (Exam Sessions)
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                  Abuur ciwaanka iyo taariikhda imtixaanka. Arday kasta hal mar kaliya ayuu galayaa waxaana la damaanad qaadayaa inaan lagu celin daabacaadda.
                </p>
              </div>

              {canExamine && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSessionTitle('');
                    setSessionDate(new Date().toISOString().split('T')[0]);
                    setSessionFormError('');
                    setShowCreateSessionModal(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} />
                  <span>Abuur Kalka Cusub</span>
                </button>
              )}
            </div>
          </div>

          {/* Sessions Table */}
          <div className="card">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>CIWAANKA IMTIXAANKA</th>
                    <th style={{ width: '15%' }}>TAARIIKHDA</th>
                    <th style={{ width: '18%' }}>SANADKA & XILLIGA</th>
                    <th style={{ width: '12%' }}>ARDAYDA GASHAY</th>
                    <th style={{ width: '10%' }}>CELCELISKA</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>WAXQABAD</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        Soo dejinayaa xogta fadhiyada imtixaanka...
                      </td>
                    </tr>
                  ) : examSessions.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                        <Calendar size={40} style={{ margin: '0 auto 10px', color: '#cbd5e1' }} />
                        <h4 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                          Ma jiraan kalko imtixaan oo diiwaangashan
                        </h4>
                        <p style={{ fontSize: '0.85rem', margin: '0 0 16px 0' }}>
                          Guji batoonka kore si aad u abuurto kalkaaga ugu horreeya ee imtixaanka.
                        </p>
                        {canExamine && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setSessionTitle('');
                              setShowCreateSessionModal(true);
                            }}
                          >
                            <Plus size={14} /> Abuur Kalka Cusub
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    examSessions.map(session => (
                      <tr key={session.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                            {session.title}
                          </div>
                          {session.notes && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                              {session.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#334155' }}>
                          {session.exam_date ? new Date(session.exam_date).toLocaleDateString() : '-'}
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>
                            {session.academic_year || '2025/2026'} • {session.term || 'Term 1'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                            {session.student_count || 0} arday
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#0f766e', fontSize: '0.95rem' }}>
                            {session.average_score !== null && session.average_score !== undefined
                              ? parseFloat(session.average_score).toFixed(1)
                              : '-'}
                          </strong>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setSelectedExamSessionId(session.id);
                              setActiveTab('new_exam');
                            }}
                            title="U gudub si aad ardayda dhibcaha ugu geliso imtixaankan"
                            style={{ marginRight: '4px' }}
                          >
                            <Award size={13} />
                            <span>Geli Dhibco</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setHistorySessionFilter(String(session.id));
                              setShowMasterPrintModal(true);
                            }}
                            title="Daabac Shahaadada Guud ee Imtixaankan (A4 Master Sheet)"
                            style={{ marginRight: '4px' }}
                          >
                            <Printer size={13} />
                            <span>Daabac</span>
                          </button>

                          {canManageScoring && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleOpenDeleteSession(session)}
                              title="Tirtir kalka imtixaanka iyo dhibcihiisa (Permanent Delete)"
                            >
                              <Trash2 size={13} />
                              <span>Tirtir</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: QAAD IMTIXAAN CUSUB (NEW EXAMINATION WORKFLOW)               */}
      {/* ==================================================================== */}
      {activeTab === 'new_exam' && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '20px' }}>
          {/* Top Form Container */}
          <div className="card">
            <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Xogta Ardayga & Heerka Imtixaanka
              </h2>
            </div>

            <div className="card-body" style={{ padding: '20px' }}>
              {/* Exam Session Selector */}
              <div style={{ marginBottom: '16px', backgroundColor: '#f0fdfa', border: '1px solid #99f6e4', padding: '14px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f766e', margin: 0 }}>
                    Kalka Imtixaanka (Exam Session) *
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSessionTitle('');
                      setSessionFormError('');
                      setShowCreateSessionModal(true);
                    }}
                    style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                  >
                    <Plus size={13} /> + Kalka Cusub
                  </button>
                </div>
                <select
                  className="form-select"
                  value={selectedExamSessionId}
                  onChange={e => setSelectedExamSessionId(e.target.value)}
                  style={{ backgroundColor: '#ffffff', fontWeight: 600 }}
                >
                  <option value="">-- Dooro Kalka Imtixaanka (Select Exam Session) --</option>
                  {examSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.exam_date ? new Date(s.exam_date).toLocaleDateString() : '-'}) — {s.student_count || 0} Arday
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: '#0d9488', marginTop: '4px' }}>
                  * Doorashada kalka waxay xaqiijinaysaa in arday kasta hal mar oo qudha dhibco la siiyo loona daabaco.
                </div>
              </div>

              {/* Duplicate Entry Warning Banner */}
              {isStudentAlreadyInSession && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #f87171',
                  color: '#991b1b',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <AlertCircle size={20} />
                  <span>Digniin: Ardaygani horey ayuu u galay imtixaankan! Nidaamku ma ogola in hal arday 2 jeer lagu daro isla imtixaanka.</span>
                </div>
              )}

              {/* 1. Student Search & Arabic Name Display */}
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>
                  1. Raadi oo Dooro Ardayga (Search by Arabic Name, Somali Name, or ID) *
                </label>

                {!selectedStudent ? (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Qor magaca Carabiga (مثال: محمد), magaca Soomaaliga, ama ID-ga (STU-...)..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      style={{ paddingLeft: '38px', fontSize: '0.95rem' }}
                    />
                    <Search
                      size={18}
                      style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }}
                    />

                    {/* Autocomplete Dropdown */}
                    {searchedStudents.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          marginTop: '4px',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                          maxHeight: '260px',
                          overflowY: 'auto'
                        }}
                      >
                        {searchedStudents.map(st => (
                          <div
                            key={st.id}
                            onClick={() => {
                              setSelectedStudent(st);
                              setStudentSearch('');
                              setSearchedStudents([]);
                            }}
                            style={{
                              padding: '10px 14px',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: '1.05rem',
                                  fontWeight: 700,
                                  color: '#0f172a',
                                  fontFamily: 'Arial, sans-serif'
                                }}
                                dir="rtl"
                              >
                                {st.name_ar || st.full_name}
                              </div>
                              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                                {st.full_name} • <span style={{ fontWeight: 600 }}>{st.student_id}</span>
                              </div>
                            </div>
                            <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                              {st.group_name || 'Halaqo'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {searchLoading && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                        Raadinaya ardayda...
                      </div>
                    )}
                  </div>
                ) : (
                  /* Selected Student Card */
                  <div
                    style={{
                      padding: '16px 20px',
                      borderRadius: '10px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #86efac',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #0d9488, #059669)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          fontWeight: 800
                        }}
                      >
                        ق
                      </div>
                      <div>
                        {/* Registered Arabic Name Display */}
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: '#065f46',
                            fontFamily: 'Arial, sans-serif'
                          }}
                          dir="rtl"
                        >
                          {selectedStudent.name_ar || selectedStudent.full_name}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600, marginTop: '2px' }}>
                          {selectedStudent.full_name} • ID: {selectedStudent.student_id}
                          {selectedStudent.group_name && ` • ${selectedStudent.group_name}`}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedStudent(null)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      Baddel Ardayga
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Juz Range Selection & Exam Metadata */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '16px',
                  backgroundColor: '#f8fafc',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '20px'
                }}
              >
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    Juz-ka Bilowga (Start Juz) *
                  </label>
                  <select
                    className="form-select"
                    value={startJuz}
                    onChange={e => setStartJuz(parseInt(e.target.value, 10))}
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                      <option key={j} value={j}>
                        Juz {j}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    Juz-ka Dhammaadka (End Juz) *
                  </label>
                  <select
                    className="form-select"
                    value={endJuz}
                    onChange={e => setEndJuz(parseInt(e.target.value, 10))}
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                      <option key={j} value={j}>
                        Juz {j}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    Taariikhda Imtixaanka *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={examDate}
                    onChange={e => setExamDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    Imtixaamayaha (Examiner) *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={examinerName}
                    onChange={e => setExaminerName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Juz Range Validation / Banner */}
              {startJuz > endJuz ? (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    fontSize: '0.85rem',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <AlertTriangle size={18} />
                  <span>Digniin: Juz-ka bilowgu ({startJuz}) kama weynaan karo Juz-ka dhammaadka ({endJuz}).</span>
                </div>
              ) : (
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <BookMarked size={16} />
                  <span>
                    Heerka Imtixaanka: Juz {startJuz} ilaa Juz {endJuz} (Wadarta: {endJuz - startJuz + 1} Juz)
                  </span>
                </div>
              )}

              {/* 3. Error Recording Section */}
              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Diiwaanka Khaladaadka Recitation-ka (Record Observed Errors)
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
                      Guji batoonka khaladka si aad u kordhiso tirada khaladaadka xilliga dhageysiga xifdiga.
                    </p>
                  </div>
                </div>

                {/* Available Configured Error Buttons */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '12px',
                    marginBottom: '20px'
                  }}
                >
                  {errorTypes
                    .filter(t => t.is_active)
                    .map(errType => {
                      const recorded = recordedErrors.find(e => e.error_type_id === errType.id);
                      const count = recorded ? recorded.occurrences : 0;
                      return (
                        <div
                          key={errType.id}
                          style={{
                            border: `1.5px solid ${count > 0 ? '#0d9488' : '#e2e8f0'}`,
                            borderRadius: '10px',
                            padding: '12px 14px',
                            backgroundColor: count > 0 ? '#f0fdfa' : '#ffffff',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                                {errType.name}
                              </div>
                              {errType.name_ar && (
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    color: '#0d9488',
                                    fontWeight: 700,
                                    fontFamily: 'Arial, sans-serif'
                                  }}
                                  dir="rtl"
                                >
                                  {errType.name_ar}
                                </div>
                              )}
                            </div>
                            <span
                              className={`badge ${
                                errType.severity === 'high'
                                  ? 'badge-danger'
                                  : errType.severity === 'medium'
                                  ? 'badge-warning'
                                  : 'badge-info'
                              }`}
                              style={{ fontSize: '0.72rem' }}
                            >
                              -{parseFloat(errType.deduction_points)} dhibic
                            </span>
                          </div>

                          {errType.description && (
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', marginBottom: '8px' }}>
                              {errType.description}
                            </p>
                          )}

                          {/* Interactive Counter Controls */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginTop: '8px',
                              paddingTop: '8px',
                              borderTop: '1px solid #f1f5f9'
                            }}
                          >
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                              Tirada: <strong style={{ color: count > 0 ? '#0d9488' : '#64748b' }}>{count}</strong>
                            </span>

                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => decrementError(errType.id)}
                                disabled={count === 0}
                                style={{ padding: '3px 8px' }}
                              >
                                <Minus size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => addOrIncrementError(errType.id)}
                                style={{ padding: '3px 8px' }}
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Table of Currently Recorded Errors with Notes */}
                {recordedErrors.length > 0 && (
                  <div className="table-container" style={{ marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>KHALADKA LA QORAY</th>
                          <th>CULEYSKA</th>
                          <th>TIRADA</th>
                          <th>JARISTA / MIDKIBA</th>
                          <th>WADARTA JARISTA</th>
                          <th>XUSUUSIN / MEESHA UU KU DHACAY</th>
                          <th style={{ textAlign: 'right' }}>KA SAAR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recordedErrors.map(item => {
                          const typeObj = errorTypes.find(t => t.id === item.error_type_id);
                          const unit = typeObj ? parseFloat(typeObj.deduction_points) : 0;
                          const subTotal = Math.round(unit * item.occurrences * 100) / 100;
                          return (
                            <tr key={item.error_type_id}>
                              <td>
                                <strong>{typeObj?.name || 'Khalad'}</strong>
                                {typeObj?.name_ar && (
                                  <span style={{ marginRight: '6px', color: '#0d9488', fontSize: '0.85rem', fontWeight: 600 }} dir="rtl">
                                    {' '}({typeObj.name_ar})
                                  </span>
                                )}
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    typeObj?.severity === 'high'
                                      ? 'badge-danger'
                                      : typeObj?.severity === 'medium'
                                      ? 'badge-warning'
                                      : 'badge-info'
                                  }`}
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  {typeObj?.severity === 'high' ? 'Culus' : typeObj?.severity === 'medium' ? 'Dhexe' : 'Khafiif'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => decrementError(item.error_type_id)}
                                    style={{ padding: '2px 6px' }}
                                  >
                                    -
                                  </button>
                                  <strong style={{ minWidth: '16px', textAlign: 'center' }}>{item.occurrences}</strong>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => addOrIncrementError(item.error_type_id)}
                                    style={{ padding: '2px 6px' }}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td>-{unit.toFixed(1)}</td>
                              <td style={{ color: '#dc2626', fontWeight: 700 }}>-{subTotal.toFixed(1)}</td>
                              <td>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="e.g. Aayadda 15aad ee Al-Baqarah..."
                                  value={item.notes || ''}
                                  onChange={e => updateErrorNotes(item.error_type_id, e.target.value)}
                                  style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                                />
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  onClick={() => removeError(item.error_type_id)}
                                  style={{ padding: '3px 6px' }}
                                >
                                  <X size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* General Exam Notes */}
                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Faallo Guud ee Imtixaamayaha (Examiner General Notes)
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Qor talooyinka, dardaaranka xifdiga, ama xaaladda guud ee akhriska ardayga..."
                    value={examNotes}
                    onChange={e => setExamNotes(e.target.value)}
                  />
                </div>

                {/* 4. Live Calculated Score Summary Card */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '16px',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block' }}>
                      DHIBCAHA BUUXA (MAX)
                    </span>
                    <strong style={{ fontSize: '1.4rem', color: '#0f172a' }}>{parsedMaxMarks}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block' }}>
                      KHALADAADKA LA QORAY
                    </span>
                    <strong style={{ fontSize: '1.4rem', color: '#0f172a' }}>{totalErrorCount}</strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 600, display: 'block' }}>
                      WADARTA LAGA JARAY
                    </span>
                    <strong style={{ fontSize: '1.4rem', color: '#dc2626' }}>-{roundedDeductions.toFixed(1)}</strong>
                  </div>

                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: currentGrade.bg,
                      borderRadius: '10px',
                      border: `1.5px solid ${currentGrade.color}40`,
                      textAlign: 'center'
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', color: currentGrade.color, fontWeight: 700, display: 'block' }}>
                      DHIBCAHA GUUD (FINAL SCORE)
                    </span>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: currentGrade.color }}>
                      {finalScore.toFixed(1)} / {parsedMaxMarks}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: currentGrade.color }}>
                      {currentGrade.label}
                    </span>
                  </div>
                </div>

                {/* Action Submit */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={resetExamForm}>
                    Nadiifi Foomka
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!selectedStudent || startJuz > endJuz || isStudentAlreadyInSession}
                    onClick={() => setShowConfirmModal(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 24px' }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Dib u Eeg & Xaqiiji Imtixaanka</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: DIIWAANKA IMTIXAANAADKA HORE (HISTORY & SEARCH)               */}
      {/* ==================================================================== */}
      {activeTab === 'history' && (
        <div className="no-print">
          {/* History Search & Filter Bar */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '320px', flexWrap: 'wrap' }}>
                  {/* Search input */}
                  <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Raadi magaca Carabiga, Soomaaliga, ID-ga, macallinka, halaqada..."
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      style={{ paddingLeft: '36px' }}
                    />
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                  </div>

                  {/* Exam Session Filter Dropdown */}
                  <div style={{ minWidth: '220px' }}>
                    <select
                      className="form-select"
                      value={historySessionFilter}
                      onChange={e => setHistorySessionFilter(e.target.value)}
                      style={{ fontSize: '0.9rem', backgroundColor: '#f0fdfa', borderColor: '#99f6e4' }}
                    >
                      <option value="all">Dhammaan Kalka Imtixaanaadka (All Sessions)</option>
                      {examSessions.map(s => (
                        <option key={s.id} value={String(s.id)}>
                          {s.title} ({s.exam_date ? new Date(s.exam_date).toLocaleDateString() : '-'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Class / Group Filter Dropdown */}
                  <div style={{ minWidth: '180px' }}>
                    <select
                      className="form-select"
                      value={selectedGroupFilter}
                      onChange={e => setSelectedGroupFilter(e.target.value)}
                      style={{ fontSize: '0.9rem' }}
                    >
                      <option value="all">Dhammaan Halaqadaha</option>
                      {quranGroups.map(grp => (
                        <option key={grp.id} value={grp.id}>
                          {grp.name} {grp.shift ? `(${grp.shift})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Action Buttons: Refresh & Print Master Sheet */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      const [examsRes, grpRes] = await Promise.all([
                        api.getMemorizationExams(),
                        api.getQuranGroups()
                      ]);
                      if (examsRes.success) setHistoryExams(examsRes.data);
                      if (grpRes && grpRes.success) setQuranGroups(grpRes.data);
                    }}
                  >
                    <RefreshCw size={14} /> Cusbooneysii
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowMasterPrintModal(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#0d9488',
                      borderColor: '#0d9488',
                      fontWeight: 700
                    }}
                    title="Daabac Kalka A4 (Print A4 Master Score Sheet)"
                  >
                    <Printer size={15} />
                    <span>
                      {selectedExamIds.size > 0
                        ? `Daabac Ardayda La Doortay (${selectedExamIds.size})`
                        : `Daabac Kalka A4 (${filteredHistory.length})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={handleExportToExcel}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 700
                    }}
                    title="Dhoofi Natiijooyinka Excel (.xlsx)"
                  >
                    <FileSpreadsheet size={15} />
                    <span>Excel (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Selection Bar & Controls */}
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#64748b' }}>
                    Wadarta imtixaanaadka: <strong>{filteredHistory.length}</strong>
                  </span>
                  {selectedExamIds.size > 0 && (
                    <span className="badge badge-primary" style={{ backgroundColor: '#0d9488' }}>
                      {selectedExamIds.size} arday ayaa la doortay
                    </span>
                  )}
                  {selectedGroupFilter !== 'all' && (
                    <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                      Halaqada: {quranGroups.find(g => String(g.id) === String(selectedGroupFilter))?.name || selectedGroupFilter}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={toggleSelectAllFiltered}
                    style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                  >
                    {allFilteredSelected ? 'Ka Noqo Doorashada' : 'Dooro Dhammaan (Select All)'}
                  </button>
                  {selectedExamIds.size > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => setSelectedExamIds(new Set())}
                      style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                    >
                      Nadiifi
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="card">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '38px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        title="Dooro Dhammaan / Ka Noqo"
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </th>
                    <th style={{ width: '25%' }}>ARDAYGA (STUDENT)</th>
                    <th style={{ width: '12%' }}>HEERKA JUZ</th>
                    <th style={{ width: '14%' }}>HALAQADA / FASALKA</th>
                    <th style={{ width: '12%' }}>TAARIIKHDA</th>
                    <th style={{ width: '15%' }}>IMTIXAAMAYAHA</th>
                    <th style={{ width: '12%' }}>NATIIJADA</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>HAWLAHA</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        Soo dejinayaa xogta imtixaanaadka...
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                        <Award size={40} style={{ margin: '0 auto 10px', color: '#cbd5e1' }} />
                        <h4 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                          Ma jiraan imtixaanaad la helay
                        </h4>
                        <p style={{ fontSize: '0.85rem', margin: 0 }}>
                          Weli lama diiwaangelin imtixaan ama ma jiro natiijo u dhiganta raadintaada.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(ex => {
                      const finalScoreVal = parseFloat(ex.final_score !== null && ex.final_score !== undefined ? ex.final_score : ex.marks_obtained || 0);
                      const maxVal = parseFloat(ex.maximum_marks || 100);
                      const grade = getGradeLabel(finalScoreVal, maxVal);
                      const isChecked = selectedExamIds.has(ex.id);
                      return (
                        <tr
                          key={ex.id}
                          style={{
                            backgroundColor: isChecked ? '#f0fdfa' : 'transparent',
                            transition: 'background-color 0.15s'
                          }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectExam(ex.id)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>

                          <td>
                            <div
                              style={{
                                fontSize: '1rem',
                                fontWeight: 800,
                                color: '#0f172a',
                                fontFamily: 'Arial, sans-serif'
                              }}
                              dir="rtl"
                            >
                              {ex.student_name_ar || ex.student_name}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                              {ex.student_name} • <strong>{ex.student_code}</strong>
                            </div>
                          </td>

                          <td>
                            <span
                              className="badge badge-info"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <BookMarked size={12} />
                              <span>Juz {ex.start_juz} - {ex.end_juz}</span>
                            </span>
                          </td>

                          <td>
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: '#0369a1',
                                backgroundColor: '#f0f9ff',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                display: 'inline-block'
                              }}
                            >
                              {ex.group_name || 'Halaqo Guud'}
                            </span>
                          </td>

                          <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                            {ex.exam_date ? new Date(ex.exam_date).toLocaleDateString() : '-'}
                          </td>

                          <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                            {ex.examiner_name}
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 800, color: grade.color, fontSize: '0.95rem' }}>
                                {finalScoreVal.toFixed(1)} / {maxVal}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: grade.color
                                }}
                              >
                                {ex.result || grade.label}
                              </span>
                            </div>
                          </td>

                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleViewExam(ex.id)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Fiiri Shahaadada Ardaygan Gaarka ah"
                            >
                              <Printer size={13} />
                              <span>Fiiri</span>
                            </button>

                            {canManageScoring && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleOpenDeleteExam(ex)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}
                                title="Tirtir natiijadan imtixaanka (Permanent Delete)"
                              >
                                <Trash2 size={13} />
                                <span>Tirtir</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: HABAYNTA KHALADAADKA (SCORING CONFIGURATION - ADMIN ONLY)     */}
      {/* ==================================================================== */}
      {activeTab === 'scoring_settings' && canManageScoring && (
        <div className="no-print">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Habaynta Noocyada Khaladaadka & Dhibcaha Jarista
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                Maamulka noocyada khaladaadka (Rujuuc, Gaf, Xaraf khaldan), culeyskooda, iyo dhibcaha laga jarayo.
              </p>
            </div>

            <button type="button" className="btn btn-primary" onClick={handleOpenCreateErrorType}>
              <Plus size={16} /> Ku dar Nooc Khalad Cusub
            </button>
          </div>

          <div className="card">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>MAGACA KHALADKA</th>
                    <th>MAGACA CARABIGA</th>
                    <th>CULEYSKA (SEVERITY)</th>
                    <th>DHIBCUHU KA GO'AYAAN</th>
                    <th>FAAHLAAHIN</th>
                    <th>XAALADDA</th>
                    <th style={{ textAlign: 'right' }}>WAXQABAD</th>
                  </tr>
                </thead>
                <tbody>
                  {errorTypes.map(t => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.name}</strong>
                      </td>
                      <td style={{ fontFamily: 'Arial, sans-serif', fontSize: '1rem', color: '#0d9488', fontWeight: 700 }} dir="rtl">
                        {t.name_ar || '-'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            t.severity === 'high'
                              ? 'badge-danger'
                              : t.severity === 'medium'
                              ? 'badge-warning'
                              : 'badge-info'
                          }`}
                        >
                          {t.severity === 'high' ? 'Culus (High)' : t.severity === 'medium' ? 'Dhexe (Medium)' : 'Khafiif (Low)'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, color: '#dc2626' }}>
                        -{parseFloat(t.deduction_points).toFixed(2)} pts
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '240px' }}>
                        {t.description || '-'}
                      </td>
                      <td>
                        <span className={`badge ${t.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {t.is_active ? 'Shaqaynaya' : 'Xanniban'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenEditErrorType(t)}
                            title="Wax ka beddel"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${t.is_active ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => handleToggleErrorType(t.id)}
                            title={t.is_active ? 'Xannib' : 'Fur'}
                          >
                            {t.is_active ? 'Xannib' : 'Dhaqaaji'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteErrorType(t.id)}
                            title="Tirtir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: CONFIRM AND REVIEW EXAMINATION BEFORE SAVING                */}
      {/* ==================================================================== */}
      {showConfirmModal && selectedStudent && (
        <div className="modal-overlay no-print">
          <div className="modal-container" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Xaqiiji Natiijada Imtixaanka Xifdiga
              </h2>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowConfirmModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px'
                }}
              >
                <div
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    fontFamily: 'Arial, sans-serif',
                    marginBottom: '4px'
                  }}
                  dir="rtl"
                >
                  {selectedStudent.name_ar || selectedStudent.full_name}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  {selectedStudent.full_name} • ID: {selectedStudent.student_id}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 600, marginTop: '4px' }}>
                  Heerka: Juz {startJuz} ilaa Juz {endJuz} • Taariikhda: {examDate} • Macallinka: {examinerName}
                </div>
              </div>

              {/* Recorded Errors Summary */}
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Khaladaadka La Qoray:
                </strong>
                {recordedErrors.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#059669', margin: 0 }}>
                    Ma jiraan wax khaladaad ah oo la qoray (Akhris sax ah).
                  </p>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    {recordedErrors.map((err, i) => {
                      const typeObj = errorTypes.find(t => t.id === err.error_type_id);
                      const unit = typeObj ? parseFloat(typeObj.deduction_points) : 0;
                      return (
                        <div
                          key={i}
                          style={{
                            padding: '8px 12px',
                            borderBottom: i < recordedErrors.length - 1 ? '1px solid #f1f5f9' : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700 }}>{typeObj?.name}</span>
                            {typeObj?.name_ar && <span style={{ color: '#0d9488' }}> ({typeObj.name_ar})</span>}
                            <span style={{ color: '#64748b' }}> x {err.occurrences}</span>
                            {err.notes && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{err.notes}</div>}
                          </div>
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            -{(unit * err.occurrences).toFixed(1)} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total Score Confirmation */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: currentGrade.bg,
                  borderRadius: '10px',
                  border: `1.5px solid ${currentGrade.color}40`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.78rem', color: currentGrade.color, fontWeight: 700 }}>
                    Wadarta Dhibcaha Laga Jaray: -{roundedDeductions.toFixed(1)}
                  </span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: currentGrade.color }}>
                    Natiijada: {finalScore.toFixed(1)} / {parsedMaxMarks}
                  </div>
                </div>
                <span className="badge" style={{ backgroundColor: currentGrade.color, color: '#ffffff', fontSize: '0.9rem' }}>
                  {currentGrade.label}
                </span>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={saveLoading}
              >
                Ka Noqo si aad wax uga beddesho
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmSaveExam}
                disabled={saveLoading}
              >
                {saveLoading ? 'Kaydinayaa...' : 'Xaqiiji & Kaydi Imtixaanka'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: PRINTABLE ARABIC RESULT CARD / CERTIFICATE                  */}
      {/* ==================================================================== */}
      {showResultModal && viewingExam && (
        <div className="modal-overlay" style={{ zIndex: 9998, padding: '16px 12px', overflowY: 'auto' }}>
          <div
            className="modal-content"
            style={{
              maxWidth: 'min(96vw, 760px)',
              width: '100%',
              maxHeight: '94vh',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              margin: 'auto 0',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.45)'
            }}
          >
            {/* Modal Controls Bar (Sticky at top, hidden in print) */}
            <div
              className="no-print"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 30,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 18px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                flexShrink: 0,
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} color="#0d9488" />
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                  Natiijada Imtixaanka & Daabacaadda
                </span>
              </div>

              {/* In-Modal Zoom & View Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setCertZoom(prev => Math.max(0.5, +(prev - 0.1).toFixed(2)))}
                    title="Yaree (Zoom out)"
                    style={{ border: 'none', background: 'transparent', padding: '4px 8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center' }}
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertZoom(1)}
                    title="Dib ugu celi 100% (Reset to 100%)"
                    style={{ border: 'none', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: 'transparent', padding: '4px 8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}
                  >
                    {Math.round(certZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertZoom(prev => Math.min(1.4, +(prev + 0.1).toFixed(2)))}
                    title="Weyneey (Zoom in)"
                    style={{ border: 'none', background: 'transparent', padding: '4px 8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center' }}
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCertZoom(certZoom <= 0.82 ? 1 : 0.8)}
                  style={{ padding: '4px 10px', fontSize: '0.76rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                  title="Ku hagaaji shaashadda si dhan (Fit full certificate on screen)"
                >
                  <Eye size={13} /> {certZoom <= 0.82 ? '100% (Original)' : 'Fit Screen'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => window.print()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#0d9488', borderColor: '#0d9488', fontWeight: 700 }}
                >
                  <Printer size={14} /> Daabac (Print)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowResultModal(false)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable Viewport Container */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'auto',
                padding: '16px',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start'
              }}
            >
              {/* Printable Certificate Sheet (Arabic & Somali) */}
              <div
                className="printable-sheet"
                style={{
                  width: '100%',
                  maxWidth: '680px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '12px',
                  padding: '24px 26px',
                  border: '3px double #0d9488',
                  boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.1)',
                  zoom: certZoom,
                  margin: '0 auto'
                }}
              >
                {/* Islamic Arabic Header */}
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <img
                    src="/branding/tafsiir-institute-logo.jpeg"
                    alt="Tafsiir Institute logo"
                    style={{ display: 'block', width: 'min(100%, 380px)', maxHeight: '76px', objectFit: 'contain', margin: '0 auto 10px' }}
                  />
                  <div style={{ fontSize: '1.15rem', color: '#065f46', fontFamily: 'Arial, sans-serif', fontWeight: 700, margin: '2px 0' }}>
                    بسم الله الرحمن الرحيم
                  </div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px 0' }}>
                    معهد التفسير للعلوم الشرعية والعربية
                  </h1>
                  <p style={{ fontSize: '0.88rem', color: '#047857', fontWeight: 700, margin: 0 }}>
                    Dugsiga Qur’aanka Kariimka — كشف نتيجة اختبار حفظ القرآن الكريم
                  </p>
                  <div style={{ width: '70px', height: '2px', backgroundColor: '#0d9488', margin: '8px auto' }} />
                </div>

                {/* Student Details Grid (RTL Arabic Emphasis) */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    marginBottom: '14px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>اسم الطالب:</span>
                    <div
                      style={{ fontSize: '1.2rem', fontWeight: 900, color: '#065f46', fontFamily: 'Arial, sans-serif' }}
                      dir="rtl"
                    >
                      {viewingExam.student_name_ar || viewingExam.student_name}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>الرقم التعريفي (Student ID):</span>
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{viewingExam.student_code}</strong>
                    {viewingExam.group_name && (
                      <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: '2px' }}>
                        الحلقة: {viewingExam.group_name}
                      </div>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>نطاق الاختبار (Juz Range):</span>
                    <strong style={{ fontSize: '0.95rem', color: '#0369a1' }}>
                      من الجزء {viewingExam.start_juz} إلى الجزء {viewingExam.end_juz} (Juz {viewingExam.start_juz} - {viewingExam.end_juz})
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>الممتحِن وتاريخ الاختبار:</span>
                    <div style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: 600 }}>
                      {viewingExam.examiner_name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {viewingExam.exam_date ? new Date(viewingExam.exam_date).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>

                {/* Score Display Card */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    backgroundColor: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    textAlign: 'center',
                    marginBottom: '14px'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700, display: 'block' }}>
                      الدرجة الكاملة (Max)
                    </span>
                    <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>
                      {parseFloat(viewingExam.maximum_marks || 100)}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700, display: 'block' }}>
                      مجموع الخصم (Deductions)
                    </span>
                    <strong style={{ fontSize: '1.2rem', color: '#dc2626' }}>
                      -{parseFloat(viewingExam.total_deductions || 0).toFixed(1)}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 800, display: 'block' }}>
                      الدرجة النهائية (Final Score)
                    </span>
                    <strong style={{ fontSize: '1.35rem', color: '#059669' }}>
                      {parseFloat(viewingExam.final_score !== null && viewingExam.final_score !== undefined ? viewingExam.final_score : viewingExam.marks_obtained || 0).toFixed(1)}
                    </strong>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#047857' }}>
                      {viewingExam.result}
                    </div>
                  </div>
                </div>

                {/* Error Breakdown Table in Arabic */}
                {viewingExam.errors && viewingExam.errors.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                      تفاصيل الأخطاء المرصودة (Observed Errors Breakdown):
                    </div>
                    <div className="table-container">
                      <table style={{ width: '100%', minWidth: '460px', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                            <th style={{ padding: '5px 8px', textAlign: 'left' }}>نوع الخطأ (Error)</th>
                            <th style={{ padding: '5px 8px', textAlign: 'center' }}>التكرار (Count)</th>
                            <th style={{ padding: '5px 8px', textAlign: 'center' }}>الخصم (Rate)</th>
                            <th style={{ padding: '5px 8px', textAlign: 'right' }}>الإجمالي (Total)</th>
                            <th style={{ padding: '5px 8px', textAlign: 'left' }}>ملاحظات (Notes)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingExam.errors.map((e, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '5px 8px' }}>
                                <strong>{e.error_name}</strong>
                                {e.error_name_ar && <span style={{ color: '#0d9488' }}> ({e.error_name_ar})</span>}
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'center' }}>{e.occurrences}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'center' }}>-{parseFloat(e.deduction_per_unit).toFixed(1)}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>
                                -{parseFloat(e.total_deduction).toFixed(1)}
                              </td>
                              <td style={{ padding: '5px 8px', color: '#64748b', fontSize: '0.78rem' }}>{e.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Examiner Notes */}
                {viewingExam.notes && (
                  <div style={{ marginBottom: '16px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block' }}>
                      ملاحظات الممتحن (Examiner Notes):
                    </span>
                    <p style={{ fontSize: '0.82rem', color: '#1e293b', margin: '4px 0 0 0' }}>
                      {viewingExam.notes}
                    </p>
                  </div>
                )}

                {/* Official Signatures */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '22px',
                    paddingTop: '14px',
                    borderTop: '1px dashed #cbd5e1'
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                      توقيع الممتحِن (Examiner Signature)
                    </div>
                    <div style={{ height: '32px' }} />
                    <div style={{ width: '150px', borderTop: '1px solid #94a3b8', margin: '0 auto' }} />
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                      ختم الإدارة (Administration Seal)
                    </div>
                    <div style={{ height: '32px' }} />
                    <div style={{ width: '150px', borderTop: '1px solid #94a3b8', margin: '0 auto' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: PRINTABLE A4 MASTER SCORE SHEET (MULTI-STUDENT / BATCH ROSTER) */}
      {/* ==================================================================== */}
      {showMasterPrintModal && (
        <div className="modal-overlay" style={{ zIndex: 9998, overflowY: 'auto', padding: '16px' }}>
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              .quran-master-sheet-print, .quran-master-sheet-print * { visibility: visible !important; }
              .quran-master-sheet-print {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: none !important;
                box-shadow: none !important;
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .master-sheet-no-print { display: none !important; }
              @page {
                size: A4 ${printOrientation};
                margin: 8mm 8mm 8mm 8mm;
              }
              table.master-roster-table {
                border-collapse: collapse !important;
                width: 100% !important;
                font-size: ${printOrientation === 'landscape' ? '9.5pt' : '8pt'} !important;
              }
              table.master-roster-table th, table.master-roster-table td {
                border: 1px solid #334155 !important;
                padding: ${printOrientation === 'landscape' ? '4px 6px' : '3px 4px'} !important;
                text-align: center !important;
              }
              table.master-roster-table th {
                background-color: #f1f5f9 !important;
                color: #0f172a !important;
                font-weight: 800 !important;
              }
              .avoid-break {
                page-break-inside: avoid !important;
              }
            }
          `}</style>

          <div
            className="quran-master-sheet-print"
            style={{
              width: printOrientation === 'landscape' ? 'min(1150px, 98vw)' : 'min(820px, 98vw)',
              margin: '0 auto',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              color: '#0f172a'
            }}
          >
            {/* Modal Controls Bar (Hidden during printing) */}
            <div
              className="master-sheet-no-print"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 50,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Printer size={20} color="#0d9488" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    Daabacaadda Kalka Guud ee Imtixaanka (A4 Master Sheet)
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Ardayda xaadirka ah: <strong>{examsForMasterPrint.length}</strong> • Kala-horeynta dhibcaha (Highest Rank First)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Orientation Selector Toggle: Landscape vs Portrait */}
                <div style={{ display: 'inline-flex', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('landscape')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: printOrientation === 'landscape' ? '#0d9488' : '#ffffff',
                      color: printOrientation === 'landscape' ? '#ffffff' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    title="A4 Landscape (بالعرض)"
                  >
                    <span>📑 Landscape (بالعرض)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOrientation('portrait')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      border: 'none',
                      borderLeft: '1px solid #cbd5e1',
                      cursor: 'pointer',
                      backgroundColor: printOrientation === 'portrait' ? '#0d9488' : '#ffffff',
                      color: printOrientation === 'portrait' ? '#ffffff' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    title="A4 Portrait (بالطول)"
                  >
                    <span>📄 Portrait (بالطول)</span>
                  </button>
                </div>

                {/* Sort selector */}
                <select
                  className="form-select form-select-sm"
                  value={printSortBy}
                  onChange={e => setPrintSortBy(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '6px 10px', borderRadius: '8px' }}
                >
                  <option value="score_desc">🏆 Natiijada ugu sarreysa (#1, #2...)</option>
                  <option value="name_asc">🔤 Magaca Ardayga (Alphabetical)</option>
                  <option value="date_desc">📅 Taariikhda Imtixaanka (Date)</option>
                </select>

                {/* Print button */}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => window.print()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#0d9488',
                    borderColor: '#0d9488',
                    fontWeight: 700,
                    padding: '7px 16px'
                  }}
                >
                  <Printer size={15} /> Daabac (Print Sheet)
                </button>

                {/* Export to Excel button */}
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={handleExportToExcel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    padding: '7px 15px'
                  }}
                  title="Soo deji faylka Excel (.xlsx)"
                >
                  <FileSpreadsheet size={15} /> Excel (.xlsx)
                </button>

                {/* Close modal */}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowMasterPrintModal(false)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet (A4 Sized) */}
            <div style={{ padding: printOrientation === 'landscape' ? '24px 28px' : '20px' }}>
              {/* Official Islamic Academy Header */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <img
                  src="/branding/tafsiir-institute-logo.jpeg"
                  alt="Tafsiir Institute logo"
                  style={{
                    display: 'block',
                    width: 'min(100%, 360px)',
                    maxHeight: '75px',
                    objectFit: 'contain',
                    margin: '0 auto 10px'
                  }}
                />
                <div style={{ fontSize: '1.05rem', color: '#065f46', fontFamily: 'Arial, sans-serif', fontWeight: 700 }}>
                  بسم الله الرحمن الرحيم
                </div>
                <h2 style={{ fontSize: '1.15rem', color: '#0d9488', fontWeight: 800, margin: '4px 0 2px 0' }}>
                  كشف رصد نتائج اختبارات حفظ القرآن الكريم
                </h2>
                <div style={{ width: '60px', height: '2px', backgroundColor: '#0d9488', margin: '6px auto 10px' }} />

                {/* Metadata Badge Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                    fontSize: '0.84rem',
                    color: '#334155',
                    backgroundColor: '#f8fafc',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    margin: '0 auto',
                    maxWidth: '850px'
                  }}
                  dir="rtl"
                >
                  <span>
                    <strong>الفصل / الحلقة: </strong>
                    <span style={{ color: '#0369a1', fontWeight: 700 }}>
                      {(() => {
                        if (selectedGroupFilter !== 'all') {
                          return quranGroups.find(g => String(g.id) === String(selectedGroupFilter))?.name || 'فصل مختار';
                        }
                        const groupNames = Array.from(new Set(examsForMasterPrint.map(ex => ex.group_name).filter(Boolean)));
                        if (groupNames.length === 1) return groupNames[0];
                        if (groupNames.length > 1) return `فصول مجمعة (${groupNames.length} فصول)`;
                        return 'كافة الفصول والحلقات (عام)';
                      })()}
                    </span>
                  </span>
                  <span>•</span>
                  <span>
                    <strong>عدد الطلاب المختبرين: </strong>
                    <span style={{ color: '#0d9488', fontWeight: 700 }}>{examsForMasterPrint.length} طالب</span>
                  </span>
                  <span>•</span>
                  <span>
                    <strong>تاريخ الكشف: </strong>
                    <span>{new Date().toLocaleDateString()}</span>
                  </span>
                  <span>•</span>
                  <span>
                    <strong>نظام التقييم: </strong>
                    <span>الدرجة الكاملة (100) — خصم تراكمي</span>
                  </span>
                </div>
              </div>

              {/* Master Table of Students (RTL Arabic Emphasis) */}
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table
                  className="master-roster-table"
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: printOrientation === 'landscape' ? '0.85rem' : '0.78rem',
                    textAlign: 'center'
                  }}
                  dir="rtl"
                >
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
                      <th style={{ width: '40px', padding: '6px 4px', border: '1px solid #475569' }}>م</th>
                      <th style={{ minWidth: '150px', padding: '6px 8px', border: '1px solid #475569', textAlign: 'right' }}>
                        اسم الطالب (Student Name)
                      </th>
                      <th style={{ width: '90px', padding: '6px 4px', border: '1px solid #475569' }}>
                        الفصل / الحلقة
                      </th>
                      <th style={{ width: '80px', padding: '6px 4px', border: '1px solid #475569' }}>
                        نطاق الأجزاء
                      </th>
                      {/* Dynamic Error Breakdown Columns */}
                      {visibleErrorTypes.map(et => (
                        <th
                          key={et.id}
                          style={{
                            minWidth: '55px',
                            padding: '4px 3px',
                            border: '1px solid #475569',
                            backgroundColor: '#fffbeb',
                            color: '#92400e',
                            fontSize: '0.75rem'
                          }}
                        >
                          <div>{et.name_ar || et.name}</div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 'normal', color: '#b45309' }}>
                            (-{parseFloat(et.deduction_points)} د)
                          </div>
                        </th>
                      ))}
                      <th
                        style={{
                          width: '65px',
                          padding: '6px 4px',
                          border: '1px solid #475569',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c'
                        }}
                      >
                        مجموع الخصم
                      </th>
                      <th
                        style={{
                          width: '65px',
                          padding: '6px 4px',
                          border: '1px solid #475569',
                          backgroundColor: '#ecfdf5',
                          color: '#065f46',
                          fontWeight: 800
                        }}
                      >
                        الإجمالي
                      </th>
                      <th style={{ width: '60px', padding: '6px 4px', border: '1px solid #475569' }}>
                        المعدل
                      </th>
                      <th style={{ width: '100px', padding: '6px 6px', border: '1px solid #475569' }}>
                        التقدير
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {examsForMasterPrint.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7 + visibleErrorTypes.length}
                          style={{ padding: '24px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}
                        >
                          لا توجد نتائج مسجلة للطباعة وفقاً للاختيار الحالي.
                        </td>
                      </tr>
                    ) : (
                      examsForMasterPrint.map((ex, idx) => {
                        const finalScoreVal = parseFloat(
                          ex.final_score !== null && ex.final_score !== undefined
                            ? ex.final_score
                            : ex.marks_obtained || 0
                        );
                        const maxVal = parseFloat(ex.maximum_marks || 100);
                        const grade = getGradeLabel(finalScoreVal, maxVal);
                        const totalDed = parseFloat(ex.total_deductions) || 0;
                        const pct = ((finalScoreVal / maxVal) * 100).toFixed(1);

                        return (
                          <tr
                            key={ex.id}
                            className="avoid-break"
                            style={{
                              backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff'
                            }}
                          >
                            {/* Rank # */}
                            <td style={{ border: '1px solid #cbd5e1', fontWeight: 800, color: '#0f172a' }}>
                              {idx + 1}
                            </td>

                            {/* Student Name */}
                            <td style={{ border: '1px solid #cbd5e1', textAlign: 'right', padding: '5px 8px' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a', fontFamily: 'Arial, sans-serif' }}>
                                {ex.student_name_ar || ex.student_name}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                <span style={{ fontWeight: 600 }}>{ex.student_code}</span>
                              </div>
                            </td>

                            {/* Class / Group */}
                            <td style={{ border: '1px solid #cbd5e1', fontSize: '0.78rem', color: '#0369a1', fontWeight: 600 }}>
                              {ex.group_name || 'Halaqo Guud'}
                            </td>

                            {/* Juz Range */}
                            <td style={{ border: '1px solid #cbd5e1', fontSize: '0.76rem', color: '#334155' }}>
                              {ex.start_juz === ex.end_juz
                                ? `جزء ${ex.start_juz}`
                                : `جزء ${ex.start_juz} - ${ex.end_juz}`}
                            </td>

                            {/* Dynamic Error Occurrences */}
                            {visibleErrorTypes.map(et => {
                              const match = (ex.errors || []).find(
                                e => e.error_type_id === et.id || e.error_name === et.name
                              );
                              const count = match ? match.occurrences : 0;
                              return (
                                <td
                                  key={et.id}
                                  style={{
                                    border: '1px solid #cbd5e1',
                                    fontWeight: count > 0 ? 800 : 'normal',
                                    color: count > 0 ? '#b45309' : '#94a3b8',
                                    backgroundColor: count > 0 ? '#fffbeb' : 'transparent',
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  {count > 0 ? count : '-'}
                                </td>
                              );
                            })}

                            {/* Total Deductions */}
                            <td
                              style={{
                                border: '1px solid #cbd5e1',
                                color: totalDed > 0 ? '#dc2626' : '#16a34a',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                              }}
                            >
                              {totalDed > 0 ? `-${totalDed.toFixed(1)}` : '0.0'}
                            </td>

                            {/* Final Score */}
                            <td
                              style={{
                                border: '1px solid #cbd5e1',
                                fontWeight: 900,
                                color: grade.color,
                                fontSize: '0.95rem',
                                backgroundColor: '#f0fdf4'
                              }}
                            >
                              {finalScoreVal.toFixed(1)}
                            </td>

                            {/* Percentage % */}
                            <td style={{ border: '1px solid #cbd5e1', fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>
                              %{pct}
                            </td>

                            {/* Result Label */}
                            <td
                              style={{
                                border: '1px solid #cbd5e1',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                color: grade.color
                              }}
                            >
                              {ex.result || grade.label}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Minimal Stamp Footer (Meel yar oo timber-ka/shaambadda lagu dhufto) */}
              <div
                className="avoid-break"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  marginTop: '16px',
                  paddingTop: '10px',
                  borderTop: '1px solid #cbd5e1'
                }}
                dir="rtl"
              >
                <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                  عدد الطلاب المقيّمين: <strong style={{ color: '#0f172a' }}>{examsForMasterPrint.length} طالب</strong> • تاريخ الطباعة: <strong>{new Date().toLocaleDateString()}</strong>
                </div>

                {/* Discrete Stamp / Timber Spot */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                    ختم الإدارة (Timber / Stamp)
                  </div>
                  <div
                    style={{
                      width: '100px',
                      height: '52px',
                      border: '1.5px dashed #94a3b8',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    ختم رسمي
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: CREATE / EDIT ERROR TYPE                                    */}
      {/* ==================================================================== */}
      {showErrorTypeModal && (
        <div className="modal-overlay no-print">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                {editingErrorType ? 'Wax Ka Beddel Nooca Khaladka' : 'Abuur Nooc Khalad Cusub'}
              </h2>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowErrorTypeModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveErrorType}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Magaca Khaladka (Somali) *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rujuuc, Gaf, Xaraf khaldan..."
                    value={errName}
                    onChange={e => setErrName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Magaca Carabiga (Arabic Name - ikhtiyaari)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. رجوع, خطأ في الحفظ..."
                    value={errNameAr}
                    onChange={e => setErrNameAr(e.target.value)}
                    dir="rtl"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Culeyska (Severity) *
                    </label>
                    <select
                      className="form-select"
                      value={errSeverity}
                      onChange={e => setErrSeverity(e.target.value)}
                    >
                      <option value="low">Khafiif (Low)</option>
                      <option value="medium">Dhexe (Medium)</option>
                      <option value="high">Culus (High)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Dhibcaha Jarista (Deduction) *
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      className="form-input"
                      placeholder="e.g. 0.50, 1.00, 2.00"
                      value={errDeduction}
                      onChange={e => setErrDeduction(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Sharaxaad (Description)
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Sharax goorta la isticmaalayo khaladkan..."
                    value={errDesc}
                    onChange={e => setErrDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={errIsActive}
                      onChange={e => setErrIsActive(e.target.checked)}
                    />
                    <span>Shaqaynaya (Active) — diyaar u ah in imtixaanaadka lagu isticmaalo</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowErrorTypeModal(false)}
                  disabled={savingErrorType}
                >
                  Ka noqo
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingErrorType}>
                  {savingErrorType ? 'Kaydinayaa...' : 'Kaydi Nooca Khaladka'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREATE EXAM SESSION                                           */}
      {/* ==================================================================== */}
      {showCreateSessionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
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
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Abuur Kalka Imtixaan Cusub (New Exam Session)
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Qeex magaca iyo taariikhda imtixaanka ardaydu galayaan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSessionModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSession}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                {sessionFormError && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.85rem' }}>
                    {sessionFormError}
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    Ciwaanka / Magaca Imtixaanka (Exam Title) *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tusaale: Imtixaanka Xifdiga ee Bisha 10aad (October 2026)"
                    value={sessionTitle}
                    onChange={e => setSessionTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      Taariikhda Imtixaanka *
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={sessionDate}
                      onChange={e => setSessionDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      Sanad Dugsiyeedka
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="2025/2026"
                      value={sessionAcademicYear}
                      onChange={e => setSessionAcademicYear(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      Xilliga / Kalka (Term)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Term 1 ama Kalka 1aad"
                      value={sessionTerm}
                      onChange={e => setSessionTerm(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      Dhibcaha Buuxa (Max Marks)
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      value={sessionTotalMarks}
                      onChange={e => setSessionTotalMarks(parseInt(e.target.value, 10) || 100)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateSessionModal(false)}
                  disabled={sessionSubmitting}
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sessionSubmitting}
                >
                  {sessionSubmitting ? 'Abuurayaa...' : 'Abuur Kalka Imtixaanka'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DELETE EXAM SESSION CONFIRMATION                              */}
      {/* ==================================================================== */}
      {showDeleteSessionModal && sessionToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', backgroundColor: '#fef2f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626'
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                    Xaqiiji Tirtiridda Kalka Imtixaanka
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#b91c1c', margin: '2px 0 0 0' }}>
                    Ficilkan lagama noqon karo marka la fuliyo!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowDeleteSessionModal(false); setSessionToDelete(null); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, margin: '0 0 14px 0' }}>
                Ma hubtaa inaad rabto inaad si joogto ah u tirtirto kalka{' '}
                <strong style={{ color: '#0f172a' }}>"{sessionToDelete.title}"</strong>{' '}
                ({sessionToDelete.student_count || 0} arday ayaa ku xiran)?
              </p>

              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                fontSize: '0.8rem',
                color: '#9f1239'
              }}>
                <strong>Digniin:</strong> Dhammaan dhibcaha iyo imtixaanaadka ardayda ee ku xiran kalkaan sidoo kale si toos ah ayaa loo tirtiri doonaa.
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleteLoading}
                onClick={() => { setShowDeleteSessionModal(false); setSessionToDelete(null); }}
              >
                Ka noqo
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleteLoading}
                onClick={handleConfirmDeleteSession}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} />
                {deleteLoading ? 'Tirtirayaa...' : 'Haa, Tirtir Kalka'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DELETE INDIVIDUAL EXAM RESULT CONFIRMATION                     */}
      {/* ==================================================================== */}
      {showDeleteExamModal && examToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', backgroundColor: '#fef2f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626'
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                    Xaqiiji Tirtiridda Natiijada
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#b91c1c', margin: '2px 0 0 0' }}>
                    Ficilkan lagama noqon karo marka la fuliyo!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowDeleteExamModal(false); setExamToDelete(null); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, margin: '0 0 14px 0' }}>
                Ma hubtaa inaad rabto inaad si joogto ah u tirtirto natiijada ardayga{' '}
                <strong style={{ color: '#0f172a' }}>{examToDelete.student_name_ar || examToDelete.student_name}</strong>{' '}
                (Dhibcaha: <span style={{ color: '#0f766e', fontWeight: 700 }}>{parseFloat(examToDelete.final_score !== null && examToDelete.final_score !== undefined ? examToDelete.final_score : examToDelete.marks_obtained || 0).toFixed(1)} / {examToDelete.maximum_marks || 100}</span>)?
              </p>

              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                fontSize: '0.8rem',
                color: '#9f1239'
              }}>
                <strong>Digniin:</strong> Natiijadan iyo dhammaan khaladaadkii la diiwaangeliyay gabi ahaanba waa la tirtiri doonaa.
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleteLoading}
                onClick={() => { setShowDeleteExamModal(false); setExamToDelete(null); }}
              >
                Ka noqo
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleteLoading}
                onClick={handleConfirmDeleteExamResult}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} />
                {deleteLoading ? 'Tirtirayaa...' : 'Haa, Tirtir Natiijada'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
