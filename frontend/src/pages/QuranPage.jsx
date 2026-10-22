import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  BookOpen, Users, Plus, CheckCircle, AlertTriangle, Save,
  Search, Check, UserPlus, UserCheck, Trash2, Edit3, X,
  GraduationCap, Calendar, Clock, ArrowRight, ShieldCheck,
  Award, RefreshCw
} from 'lucide-react';

export default function QuranPage() {
  const { user, isSuperAdmin, isQuranAdmin, isTeacher } = useAuth();
  const canManageClasses = isSuperAdmin || isQuranAdmin;

  // Quran workspace sections: memorization, class management, and audited transfers.
  const [activeSection, setActiveSection] = useState('memorization');

  // Master Data
  const [classes, setClasses] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [surahs, setSurahs] = useState([]);
  const [juzList, setJuzList] = useState([]);
  const [showJuzBreakdown, setShowJuzBreakdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // =========================================================================
  // SECTION 1: DIIWAANKA XIFDIGA STATE
  // =========================================================================
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classStudents, setClassStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSummary, setStudentSummary] = useState(null);
  const [studentSurahsLoading, setStudentSurahsLoading] = useState(false);
  const [selectedSurahNumbers, setSelectedSurahNumbers] = useState(new Set());
  const [originalSurahNumbers, setOriginalSurahNumbers] = useState(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingSurahs, setSavingSurahs] = useState(false);

  // Surah filter & search
  const [surahSearch, setSurahSearch] = useState('');
  const [surahFilter, setSurahFilter] = useState('all'); // 'all' | 'memorized' | 'not_memorized'

  // =========================================================================
  // SECTION 2: FASALLADA (CLASS MANAGEMENT) STATE (ADMIN ONLY)
  // =========================================================================
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [className, setClassName] = useState('');
  const [classSchedule, setClassSchedule] = useState('Subax'); // 'Subax' | 'Galab' | 'Subax iyo Galab'
  const [classTeacherId, setClassTeacherId] = useState('');
  const [classSaving, setClassSaving] = useState(false);

  // Register New Student directly into Class Modal
  const [showRegisterStudentModal, setShowRegisterStudentModal] = useState(false);
  const [targetClassForStudent, setTargetClassForStudent] = useState(null);
  const [regFullName, setRegFullName] = useState('');
  const [regNameAr, setRegNameAr] = useState('');
  const [regGender, setRegGender] = useState('male');
  const [regPhone, setRegPhone] = useState('');
  const [regGuardianName, setRegGuardianName] = useState('');
  const [regGuardianPhone, setRegGuardianPhone] = useState('');
  const [registeringStudent, setRegisteringStudent] = useState(false);

  // Add Already Registered Student to Class Modal
  const [showAddExistingModal, setShowAddExistingModal] = useState(false);
  const [existingSearch, setExistingSearch] = useState('');
  const [availableStudents, setAvailableStudents] = useState([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [enrollingStudentId, setEnrollingStudentId] = useState(null);

  // Student transfer workflow (administrators only)
  const [transferSearch, setTransferSearch] = useState('');
  const [transferCandidates, setTransferCandidates] = useState([]);
  const [selectedTransferStudent, setSelectedTransferStudent] = useState(null);
  const [destinationGroupId, setDestinationGroupId] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferReason, setTransferReason] = useState('');
  const [transferSearching, setTransferSearching] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [transferHistoryLoading, setTransferHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyGroupId, setHistoryGroupId] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  function showMessage(type, message) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
  }

  // Load initial classes, teachers, and surahs
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      const [groupsRes, surahsRes, juzRes] = await Promise.all([
        api.getQuranGroups(),
        api.getQuranSurahs(),
        api.getQuranJuz()
      ]);

      if (groupsRes.success) {
        setClasses(groupsRes.data || []);
        if (groupsRes.data?.length > 0 && !selectedClassId) {
          setSelectedClassId(groupsRes.data[0].id.toString());
        }
      }

      if (surahsRes.success) {
        setSurahs(surahsRes.data || []);
      }

      if (juzRes.success) {
        setJuzList(juzRes.data || []);
      }

      // If admin, load teachers for assignment
      if (canManageClasses) {
        const teachersRes = await api.getQuranTeachers();
        if (teachersRes.success) {
          setTeachersList(teachersRes.data || []);
        } else {
          // Fallback to getUsers
          const usersRes = await api.getUsers();
          if (usersRes.success) {
            setTeachersList(usersRes.data.filter(u => u.role_name === 'teacher' || u.role_id === 7));
          }
        }
      }
    } catch (err) {
      console.error(err);
      showMessage('error', err.message || 'Cilad ayaa dhacday markii la soo gelinayay xogta.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeSection === 'transfer' && canManageClasses) {
      loadTransferHistory();
    }
  }, [activeSection, canManageClasses, historySearch, historyGroupId, historyStartDate, historyEndDate]);

  // Load students when selectedClassId changes in Diiwaanka Xifdiga
  useEffect(() => {
    if (selectedClassId) {
      loadStudentsForClass(selectedClassId);
    } else {
      setClassStudents([]);
      setSelectedStudentId('');
    }
  }, [selectedClassId]);

  async function loadStudentsForClass(classId) {
    try {
      setStudentsLoading(true);
      const res = await api.getGroupStudents(classId);
      if (res.success) {
        setClassStudents(res.data || []);
        if (res.data?.length > 0) {
          setSelectedStudentId(res.data[0].id.toString());
        } else {
          setSelectedStudentId('');
          setStudentSummary(null);
          setSelectedSurahNumbers(new Set());
          setOriginalSurahNumbers(new Set());
        }
      }
    } catch (err) {
      console.error(err);
      showMessage('error', err.message || 'Cilad ayaa dhacday soo gelinta ardayda fasalka.');
    } finally {
      setStudentsLoading(false);
    }
  }

  // Load student's 114 Surahs memorization when selectedStudentId changes
  useEffect(() => {
    if (selectedStudentId) {
      loadStudentSurahs(selectedStudentId);
    } else {
      setStudentSummary(null);
      setSelectedSurahNumbers(new Set());
      setOriginalSurahNumbers(new Set());
      setHasUnsavedChanges(false);
    }
  }, [selectedStudentId]);

  async function loadStudentSurahs(studentId) {
    try {
      setStudentSurahsLoading(true);
      const [surahsRes, summaryRes] = await Promise.all([
        api.getStudentSurahs(studentId),
        api.getQuranStudentSummary(studentId)
      ]);

      if (surahsRes.success) {
        const completedSet = new Set();
        (surahsRes.data?.surahs || []).forEach(s => {
          if (s.is_memorized) {
            completedSet.add(s.number);
          }
        });
        setSelectedSurahNumbers(new Set(completedSet));
        setOriginalSurahNumbers(new Set(completedSet));
        setHasUnsavedChanges(false);
      }

      if (summaryRes.success) {
        setStudentSummary(summaryRes.data);
      }
    } catch (err) {
      console.error(err);
      showMessage('error', err.message || 'Cilad ayaa dhacday soo gelinta xifdiga ardayga.');
    } finally {
      setStudentSurahsLoading(false);
    }
  }

  // Toggle single Surah selection (Finality enforced for teachers)
  function handleToggleSurah(surahNumber) {
    if (isTeacher && originalSurahNumbers.has(surahNumber)) {
      showMessage('warning', 'Go’aanka xifdiga suuraddan hore ayaa loo kaydiyay (Final), ma tirtiri kartid. Kaliya maamulka ayaa wax ka beddeli kara.');
      return;
    }
    const updated = new Set(selectedSurahNumbers);
    if (updated.has(surahNumber)) {
      updated.delete(surahNumber);
    } else {
      updated.add(surahNumber);
    }
    setSelectedSurahNumbers(updated);

    // Check if changes differ from original
    const hasDiff = updated.size !== originalSurahNumbers.size ||
      Array.from(updated).some(n => !originalSurahNumbers.has(n));
    setHasUnsavedChanges(hasDiff);
  }

  // Quick selection helpers
  function handleSelectAll() {
    const allSet = new Set(surahs.map(s => s.number));
    setSelectedSurahNumbers(allSet);
    setHasUnsavedChanges(true);
  }

  function handleDeselectAll() {
    if (isTeacher) {
      // For teachers, retain previously saved surahs and only deselect newly added unsaved ones
      setSelectedSurahNumbers(new Set(originalSurahNumbers));
      setHasUnsavedChanges(false);
      showMessage('info', 'Suuradihii hore loo xifdiyay waa final lama tirtiri karo. Waxaa laga noqday kuwa cusub oo kaliya.');
      return;
    }
    setSelectedSurahNumbers(new Set());
    setHasUnsavedChanges(true);
  }

  function handleSelectJuz30() {
    // Surahs 78 to 114 (Juz Camma)
    const updated = new Set(selectedSurahNumbers);
    for (let i = 78; i <= 114; i++) {
      updated.add(i);
    }
    setSelectedSurahNumbers(updated);
    setHasUnsavedChanges(true);
  }

  function handleSelectJuz29() {
    // Surahs 67 to 77 (Juz Tabaarak)
    const updated = new Set(selectedSurahNumbers);
    for (let i = 67; i <= 77; i++) {
      updated.add(i);
    }
    setSelectedSurahNumbers(updated);
    setHasUnsavedChanges(true);
  }

  // Save Memorization for selected student
  async function handleSaveMemorization() {
    if (!selectedStudentId) {
      showMessage('error', 'Fadlan dooro ardayga aad u kaydinayso xifdiga.');
      return;
    }

    try {
      setSavingSurahs(true);
      const surahArray = Array.from(selectedSurahNumbers);
      const res = await api.saveStudentSurahs(selectedStudentId, {
        surah_numbers: surahArray
      });

      if (res.success) {
        showMessage('success', `Xifdiga suuradaha (${surahArray.length}/114) si guul leh ayaa loo kaydiyay!`);
        setOriginalSurahNumbers(new Set(selectedSurahNumbers));
        setHasUnsavedChanges(false);
        if (res.data?.student_summary) {
          setStudentSummary(res.data.student_summary);
        } else {
          loadStudentSurahs(selectedStudentId);
        }
      }
    } catch (err) {
      console.error(err);
      showMessage('error', err.message || 'Khalad ayaa dhacay markii la kaydinayay xifdiga.');
    } finally {
      setSavingSurahs(false);
    }
  }

  // Filtered surahs for display
  const displayedSurahs = useMemo(() => {
    return surahs.filter(s => {
      // Search filter (number or Arabic name or English name)
      if (surahSearch.trim()) {
        const q = surahSearch.trim().toLowerCase();
        const matchNum = s.number.toString().includes(q);
        const matchAr = s.name_ar && s.name_ar.toLowerCase().includes(q);
        const matchEn = s.name_en && s.name_en.toLowerCase().includes(q);
        if (!matchNum && !matchAr && !matchEn) return false;
      }

      // Status filter
      const isSelected = selectedSurahNumbers.has(s.number);
      if (surahFilter === 'memorized' && !isSelected) return false;
      if (surahFilter === 'not_memorized' && isSelected) return false;

      return true;
    });
  }, [surahs, surahSearch, surahFilter, selectedSurahNumbers]);

  // Selected student object
  const currentStudent = classStudents.find(s => s.id.toString() === selectedStudentId);

  // Live reactive Quran memorization & exact Juz progress calculation
  const calculatedProgress = useMemo(() => {
    // If metadata is not loaded yet, fallback to studentSummary
    if (!juzList || juzList.length === 0 || !surahs || surahs.length === 0) {
      const summaryMem = studentSummary?.memorization;
      return {
        completedSurahsCount: selectedSurahNumbers.size,
        totalSurahsCount: 114,
        completedJuzCount: summaryMem?.completed_juz_count || 0,
        completedJuzList: summaryMem?.completed_juz_list || [],
        inProgressJuzList: (summaryMem?.juz || []).filter(j => !j.is_completed && j.memorized_verses > 0),
        totalMemorizedVerses: summaryMem?.memorized_verses || 0,
        overallPercentage: summaryMem?.overall_percentage || 0,
        juzProgress: summaryMem?.juz || []
      };
    }

    // Build the set of memorized verses:
    // 1. Any surah currently checked in selectedSurahNumbers contributes ALL its verses (1 .. total_verses).
    // 2. Any surah that is NOT checked, but has individual saved verse-level progress in studentSummary, contributes those saved verses.
    const memorizedVerseSet = new Set();

    // From selected completed surahs:
    for (const sNum of selectedSurahNumbers) {
      const sMeta = surahs.find(s => s.number === sNum);
      if (sMeta) {
        for (let v = 1; v <= sMeta.total_verses; v++) {
          memorizedVerseSet.add(`${sNum}:${v}`);
        }
      }
    }

    // From partial saved verses in studentSummary (for unselected surahs):
    if (studentSummary?.memorization?.memorized_verse_keys) {
      for (const key of studentSummary.memorization.memorized_verse_keys) {
        const [sNumStr] = key.split(':');
        const sNum = parseInt(sNumStr, 10);
        if (!selectedSurahNumbers.has(sNum) && (originalSurahNumbers.has(sNum) || !hasUnsavedChanges)) {
          memorizedVerseSet.add(key);
        }
      }
    } else if (studentSummary?.memorization?.surahs) {
      studentSummary.memorization.surahs.forEach(s => {
        if (!selectedSurahNumbers.has(s.number) && s.memorized_verses > 0 && s.memorized_verses < s.total_verses) {
          for (let v = 1; v <= s.memorized_verses; v++) {
            memorizedVerseSet.add(`${s.number}:${v}`);
          }
        }
      });
    }

    // Calculate exact Juz completion and partial progress across all 30 Juz
    let completedJuzCount = 0;
    const completedJuzList = [];
    const inProgressJuzList = [];

    const computedJuzProgress = juzList.map(j => {
      let memorizedInJuz = 0;

      for (let sNum = j.start_surah; sNum <= j.end_surah; sNum++) {
        const sMeta = surahs.find(s => s.number === sNum);
        if (!sMeta) continue;

        const startV = (sNum === j.start_surah) ? j.start_verse : 1;
        const endV = (sNum === j.end_surah) ? j.end_verse : sMeta.total_verses;

        for (let v = startV; v <= endV; v++) {
          if (memorizedVerseSet.has(`${sNum}:${v}`)) {
            memorizedInJuz++;
          }
        }
      }

      const isCompleted = (memorizedInJuz === j.total_verses);
      const percentage = j.total_verses > 0 
        ? Math.round((memorizedInJuz / j.total_verses) * 1000) / 10 
        : 0;

      const item = {
        juz_number: j.juz_number,
        name_ar: j.name_ar,
        start_surah: j.start_surah,
        start_verse: j.start_verse,
        end_surah: j.end_surah,
        end_verse: j.end_verse,
        total_verses: j.total_verses,
        memorized_verses: memorizedInJuz,
        percentage,
        is_completed: isCompleted
      };

      if (isCompleted) {
        completedJuzCount++;
        completedJuzList.push(j.juz_number);
      } else if (memorizedInJuz > 0) {
        inProgressJuzList.push(item);
      }

      return item;
    });

    const TOTAL_QURAN_VERSES = 6236;
    const totalMemorizedVerses = memorizedVerseSet.size;
    const overallPercentage = Math.round((totalMemorizedVerses / TOTAL_QURAN_VERSES) * 1000) / 10;

    return {
      completedSurahsCount: selectedSurahNumbers.size,
      totalSurahsCount: 114,
      completedJuzCount,
      completedJuzList,
      inProgressJuzList,
      totalMemorizedVerses,
      overallPercentage,
      juzProgress: computedJuzProgress
    };
  }, [selectedSurahNumbers, surahs, juzList, studentSummary, hasUnsavedChanges, originalSurahNumbers]);

  // =========================================================================
  // FASALLADA (CLASS MANAGEMENT) HANDLERS (ADMIN ONLY)
  // =========================================================================

  function openCreateClassModal() {
    setEditingClass(null);
    setClassName('');
    setClassSchedule('Subax');
    setClassTeacherId(teachersList[0]?.id || '');
    setShowClassModal(true);
  }

  function openEditClassModal(cls) {
    setEditingClass(cls);
    setClassName(cls.name || '');
    setClassSchedule(cls.shift || 'Subax');
    setClassTeacherId(cls.assigned_teacher_id || teachersList[0]?.id || '');
    setShowClassModal(true);
  }

  async function handleSaveClass(e) {
    e.preventDefault();
    if (!className.trim()) {
      alert('Fadlan geli magaca fasalka.');
      return;
    }
    if (!classTeacherId) {
      alert('Fadlan dooro macallinka fasalka (Xilsaar hal macallin).');
      return;
    }

    try {
      setClassSaving(true);
      if (editingClass) {
        await api.updateQuranGroup(editingClass.id, {
          name: className.trim(),
          shift: classSchedule,
          teacher_id: classTeacherId
        });
        showMessage('success', `Fasalka ${className.trim()} si guul leh ayaa loo cusbooneysiiyay.`);
      } else {
        await api.createQuranGroup({
          name: className.trim(),
          shift: classSchedule,
          teacher_id: classTeacherId
        });
        showMessage('success', `Fasalka ${className.trim()} si guul leh ayaa loo abuuray.`);
      }
      setShowClassModal(false);
      loadInitialData();
    } catch (err) {
      alert(err.message || 'Cilad ayaa dhacday kaydinta fasalka.');
    } finally {
      setClassSaving(false);
    }
  }

  async function handleDeleteClass(cls) {
    if (!window.confirm(`Ma hubtaa inaad tirto fasalka "${cls.name}"?`)) return;
    try {
      await api.deleteQuranGroup(cls.id);
      showMessage('success', 'Fasalka waa la tiray.');
      loadInitialData();
    } catch (err) {
      alert(err.message || 'Cilad ayaa dhacday tirtiridda fasalka.');
    }
  }

  // Register New Student directly in Class
  function openRegisterStudentModal(cls) {
    setTargetClassForStudent(cls);
    setRegFullName('');
    setRegNameAr('');
    setRegGender('male');
    setRegPhone('');
    setRegGuardianName('');
    setRegGuardianPhone('');
    setShowRegisterStudentModal(true);
  }

  async function handleRegisterStudent(e) {
    e.preventDefault();
    if (!regFullName.trim() || !regPhone.trim()) {
      alert('Magaca ardayga iyo taleefanka waa qasab.');
      return;
    }

    try {
      setRegisteringStudent(true);
      const res = await api.registerStudentToGroup(targetClassForStudent.id, {
        full_name: regFullName.trim(),
        name_ar: regNameAr.trim() || null,
        gender: regGender,
        phone: regPhone.trim(),
        guardian_name: regGuardianName.trim() || null,
        guardian_phone: regGuardianPhone.trim() || null
      });

      if (res.success) {
        showMessage('success', res.message || 'Ardayga si toos ah ayaa loogu diiwaangeliyay fasalka.');
        setShowRegisterStudentModal(false);
        loadInitialData();
      }
    } catch (err) {
      alert(err.message || 'Cilad ayaa dhacday diiwaangelinta ardayga.');
    } finally {
      setRegisteringStudent(false);
    }
  }

  // Add Existing Student Modal
  function openAddExistingModal(cls) {
    setTargetClassForStudent(cls);
    setExistingSearch('');
    setShowAddExistingModal(true);
    loadAvailableStudents('', cls.id);
  }

  async function loadAvailableStudents(q = '', excludeGroupId) {
    try {
      setAvailableLoading(true);
      const queryParams = `?search=${encodeURIComponent(q)}&exclude_group_id=${excludeGroupId || targetClassForStudent?.id || ''}`;
      const res = await api.getAvailableStudentsForGroup(queryParams);
      if (res.success) {
        setAvailableStudents(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAvailableLoading(false);
    }
  }

  async function handleEnrollExistingStudent(studentId, studentName) {
    try {
      setEnrollingStudentId(studentId);
      const res = await api.enrollStudentToGroup(targetClassForStudent.id, {
        student_id: studentId
      });
      if (res.success) {
        showMessage('success', `Ardayga "${studentName}" si guul leh ayaa loogu daray fasalka.`);
        loadAvailableStudents(existingSearch, targetClassForStudent.id);
        loadInitialData();
      }
    } catch (err) {
      alert(err.message || 'Cilad ayaa dhacday ku darista ardayga.');
    } finally {
      setEnrollingStudentId(null);
    }
  }

  async function searchTransferStudents(value) {
    setTransferSearch(value);
    setSelectedTransferStudent(null);
    setDestinationGroupId('');
    if (value.trim().length < 2) {
      setTransferCandidates([]);
      return;
    }

    try {
      setTransferSearching(true);
      const res = await api.searchQuranTransferStudents({ search: value.trim() });
      if (res.success) setTransferCandidates(res.data || []);
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday raadinta ardayga.');
    } finally {
      setTransferSearching(false);
    }
  }

  async function loadTransferHistory() {
    try {
      setTransferHistoryLoading(true);
      const res = await api.getQuranTransferHistory({
        search: historySearch,
        group_id: historyGroupId,
        start_date: historyStartDate,
        end_date: historyEndDate
      });
      if (res.success) setTransferHistory(res.data || []);
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday soo gelinta taariikhda wareejinta.');
    } finally {
      setTransferHistoryLoading(false);
    }
  }

  async function handleTransferStudent() {
    if (!selectedTransferStudent) {
      showMessage('error', 'Fadlan marka hore dooro ardayga.');
      return;
    }
    if (!destinationGroupId) {
      showMessage('error', 'Fadlan dooro fasalka cusub.');
      return;
    }
    if (Number(destinationGroupId) === Number(selectedTransferStudent.current_group_id)) {
      showMessage('error', 'Fasalka cusub waa inuu ka duwanaadaa fasalka hadda.');
      return;
    }

    const destination = classes.find(group => Number(group.id) === Number(destinationGroupId));
    const confirmation = [
      'Ma xaqiijinaysaa wareejinta ardaygan?',
      `Arday: ${selectedTransferStudent.full_name} (${selectedTransferStudent.student_id})`,
      `Fasalka hadda: ${selectedTransferStudent.current_group_name}`,
      `Fasalka cusub: ${destination?.name || '-'}`,
      `Taariikhda: ${transferDate}`
    ].join('\n');
    if (!window.confirm(confirmation)) return;

    try {
      setTransferSaving(true);
      const res = await api.transferQuranStudent({
        student_id: selectedTransferStudent.id,
        to_group_id: Number(destinationGroupId),
        transfer_date: transferDate,
        reason: transferReason.trim() || null
      });
      if (res.success) {
        showMessage('success', res.message || 'Ardayga si guul leh ayaa loo wareejiyay.');
        setTransferSearch('');
        setTransferCandidates([]);
        setSelectedTransferStudent(null);
        setDestinationGroupId('');
        setTransferReason('');
        setTransferDate(new Date().toISOString().slice(0, 10));
        await loadInitialData();
        await loadTransferHistory();
      }
    } catch (err) {
      showMessage('error', err.message || 'Wareejintu way fashilantay; xogta ardayga lama beddelin.');
    } finally {
      setTransferSaving(false);
    }
  }

  return (
    <div className="quran-page-container">
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen style={{ color: '#0d9488' }} size={24} />
            Dugsiga Quraanka Kariimka
          </h1>
          <p style={{ color: '#64748b', margin: '2px 0 0 0', fontSize: '0.82rem' }}>
            Diiwaangelinta xifdiga 114 suuradood iyo maamulka fasallada dugsiga Quraanka.
          </p>
        </div>

        {/* Admin Quick Action */}
        {canManageClasses && activeSection === 'classes' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={openCreateClassModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0d9488', borderColor: '#0d9488' }}
          >
            <Plus size={16} /> Fasal Cusub Abuur
          </button>
        )}
      </div>

      {/* Global Feedback Alert */}
      {feedback.message && (
        <div style={{
          padding: '10px 14px',
          marginBottom: '16px',
          borderRadius: '8px',
          backgroundColor: feedback.type === 'success' ? '#ecfdf5' : '#fee2e2',
          color: feedback.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Quran workspace tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '16px',
        background: '#ffffff',
        padding: '2px 4px 0 4px',
        borderRadius: '8px 8px 0 0'
      }}>
        {/* Section 1: Diiwaanka Xifdiga (Available to Teachers and Admins) */}
        <button
          type="button"
          onClick={() => {
            if (hasUnsavedChanges && activeSection === 'memorization') {
              if (!window.confirm('Waxaa jira suurado aan la kaydin. Ma hubtaa inaad ka tagto?')) return;
            }
            setActiveSection('memorization');
          }}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.88rem',
            color: activeSection === 'memorization' ? '#0d9488' : '#64748b',
            borderBottom: activeSection === 'memorization' ? '3px solid #0d9488' : '3px solid transparent',
            cursor: 'pointer',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <BookOpen size={16} />
          Diiwaanka Xifdiga (114 Suuradood)
        </button>

        {/* Section 2: Fasallada (Visible & Accessible to Admins only) */}
        {canManageClasses && (
          <>
            <button
              type="button"
              onClick={() => {
                if (hasUnsavedChanges && activeSection === 'memorization') {
                  if (!window.confirm('Waxaa jira suurado aan la kaydin. Ma hubtaa inaad ka tagto?')) return;
                }
                setActiveSection('classes');
              }}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: activeSection === 'classes' ? '#0d9488' : '#64748b',
                borderBottom: activeSection === 'classes' ? '3px solid #0d9488' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '-2px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <Users size={16} /> Fasallada ({classes.length})
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasUnsavedChanges && activeSection === 'memorization') {
                  if (!window.confirm('Waxaa jira suurado aan la kaydin. Ma hubtaa inaad ka tagto?')) return;
                }
                setActiveSection('transfer');
              }}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: activeSection === 'transfer' ? '#0d9488' : '#64748b',
                borderBottom: activeSection === 'transfer' ? '3px solid #0d9488' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '-2px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowRight size={16} /> Beddel / Transfer Arday
            </button>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: DIIWAANKA XIFDIGA (114 SURAHS MEMORIZATION MANAGEMENT) */}
      {/* ========================================================================= */}
      {activeSection === 'memorization' && (
        <div>
          {/* Top Controls: Class & Student Selectors */}
          <div className="card" style={{ padding: '16px', marginBottom: '16px', borderTop: '4px solid #0d9488' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', alignItems: 'center' }}>
              
              {/* Class Selector */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="#0d9488" />
                  1. Dooro Fasalka / Halaqada {isTeacher && '(Laguu xilsaaray)'}:
                </label>
                <select
                  className="form-select"
                  value={selectedClassId}
                  onChange={(e) => {
                    if (hasUnsavedChanges) {
                      if (!window.confirm('Waxaa jira suurado aan la kaydin. Ma hubtaa inaad fasal kale u wareegto?')) return;
                    }
                    setSelectedClassId(e.target.value);
                  }}
                  disabled={classes.length === 0}
                  style={{ fontWeight: 600, fontSize: '0.88rem' }}
                >
                  {classes.length === 0 ? (
                    <option value="">-- Wax fasal ah laguma qorin --</option>
                  ) : (
                    classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.shift}) — {c.student_count || 0} Arday
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Student Selector */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GraduationCap size={15} color="#0d9488" />
                  2. Dooro Ardayga:
                </label>
                <select
                  className="form-select"
                  value={selectedStudentId}
                  onChange={(e) => {
                    if (hasUnsavedChanges) {
                      if (!window.confirm('Waxaa jira suurado aan la kaydin. Ma hubtaa inaad arday kale u wareegto?')) return;
                    }
                    setSelectedStudentId(e.target.value);
                  }}
                  disabled={studentsLoading || classStudents.length === 0}
                  style={{ fontWeight: 600, fontSize: '0.88rem' }}
                >
                  {classStudents.length === 0 ? (
                    <option value="">-- Fasalkan arday kuma jiraan --</option>
                  ) : (
                    classStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} {s.name_ar ? `(${s.name_ar})` : ''} — [{s.student_id}]
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Selected Student Banner & Live Stats */}
            {currentStudent && (
              <div style={{
                marginTop: '14px',
                paddingTop: '14px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: '#ccfbf1',
                    color: '#0f766e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    flexShrink: 0
                  }}>
                    {currentStudent.full_name.charAt(0)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <span>{currentStudent.full_name}</span>
                      {currentStudent.name_ar && (
                        <span style={{
                          color: '#0d9488',
                          fontFamily: "'Amiri', 'Traditional Arabic', serif",
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          direction: 'rtl'
                        }}>
                          ({currentStudent.name_ar})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      ID: <strong>{currentStudent.student_id}</strong> • Tel: {currentStudent.phone}
                    </div>
                  </div>
                </div>

                {/* Progress Badges in a Balanced 3-Column Mini Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  marginTop: '4px'
                }}>
                  {/* Metric 1: Completed Surahs out of 114 */}
                  <div style={{
                    textAlign: 'center',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1'
                  }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Suuradaha (Surahs)</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0d9488' }}>
                      {calculatedProgress.completedSurahsCount} / 114
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1px' }}>
                      suuradood
                    </div>
                  </div>

                  {/* Metric 2: Quran Verses & Overall Percentage */}
                  <div style={{
                    textAlign: 'center',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0'
                  }}>
                    <div style={{ fontSize: '0.68rem', color: '#065f46', fontWeight: 600 }}>Xifdiga Quraanka</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#065f46' }}>
                      {calculatedProgress.overallPercentage}%
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#059669', marginTop: '1px' }}>
                      {calculatedProgress.totalMemorizedVerses} / 6,236 aayadood
                    </div>
                  </div>

                  {/* Metric 3: Completed Juz out of 30 */}
                  <div style={{
                    textAlign: 'center',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe'
                  }}>
                    <div style={{ fontSize: '0.68rem', color: '#1e40af', fontWeight: 600 }}>Juz Dhameystiran</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e40af' }}>
                      {calculatedProgress.completedJuzCount} / 30
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#2563eb', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {calculatedProgress.completedJuzList.length > 0 
                        ? `Juz: ${calculatedProgress.completedJuzList.join(', ')}` 
                        : calculatedProgress.inProgressJuzList.length > 0 
                          ? `${calculatedProgress.inProgressJuzList.length} qaybood oo socda` 
                          : 'Weli ma jiro Juz'}
                    </div>
                  </div>
                </div>

                {/* Real-time Juz Status Strip: Completed & In-Progress Breakdown */}
                {(calculatedProgress.completedJuzCount > 0 || calculatedProgress.inProgressJuzList.length > 0) && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                        Xaaladda 30-ka Juz (Juz Completion & Partial Progress):
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowJuzBreakdown(prev => !prev)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0d9488',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0
                        }}
                      >
                        {showJuzBreakdown ? 'Qari Faahfaahinta ▲' : 'Eeg Qariiradda 30-ka Juz ▼'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {/* Completed Juz Pills */}
                      {calculatedProgress.completedJuzList.map(jNum => (
                        <span key={jNum} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          fontSize: '0.7rem',
                          fontWeight: 700
                        }}>
                          <Check size={11} strokeWidth={3} /> Juz {jNum} (100% Dhameystiran)
                        </span>
                      ))}

                      {/* In-Progress Juz Pills */}
                      {calculatedProgress.inProgressJuzList.map(j => (
                        <span key={j.juz_number} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#fffbeb',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          fontSize: '0.7rem',
                          fontWeight: 600
                        }}>
                          Juz {j.juz_number}: {j.percentage}% ({j.memorized_verses}/{j.total_verses} aayad)
                        </span>
                      ))}
                    </div>

                    {/* Expandable 30 Juz Visual Map */}
                    {showJuzBreakdown && (
                      <div style={{
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid #e2e8f0',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '6px'
                      }}>
                        {calculatedProgress.juzProgress.map(j => {
                          const isComp = j.is_completed;
                          const hasMem = j.memorized_verses > 0;
                          return (
                            <div key={j.juz_number} style={{
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: isComp ? '1.5px solid #10b981' : hasMem ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                              backgroundColor: isComp ? '#ecfdf5' : hasMem ? '#fffbeb' : '#ffffff',
                              fontSize: '0.68rem'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ color: isComp ? '#047857' : hasMem ? '#b45309' : '#64748b' }}>
                                  Juz {j.juz_number}
                                </strong>
                                {isComp ? (
                                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                                ) : (
                                  <span style={{ color: '#64748b' }}>{j.percentage}%</span>
                                )}
                              </div>
                              <div style={{ color: '#64748b', fontSize: '0.62rem', marginTop: '2px' }}>
                                {j.memorized_verses}/{j.total_verses} aayad
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search, Filter & Action Bar */}
          <div className="card" style={{
            padding: '12px 14px',
            marginBottom: '16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {/* Row 1: Search Input & Desktop Save Button */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Raadi suurad (Magac ama Lambar)..."
                  value={surahSearch}
                  onChange={(e) => setSurahSearch(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Desktop-only Save Button */}
              <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveMemorization}
                  disabled={savingSurahs || !selectedStudentId}
                  style={{
                    backgroundColor: '#0d9488',
                    borderColor: '#0d9488',
                    padding: '8px 18px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {savingSurahs ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  Kaydi Xifdiga ({selectedSurahNumbers.size})
                </button>
              </div>
            </div>

            {/* Row 2: Status Filter Chips (Horizontal Scrollable) */}
            <div style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
              WebkitOverflowScrolling: 'touch'
            }}>
              <button
                type="button"
                onClick={() => setSurahFilter('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: surahFilter === 'all' ? '#0d9488' : '#e2e8f0',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  backgroundColor: surahFilter === 'all' ? '#0d9488' : '#ffffff',
                  color: surahFilter === 'all' ? '#ffffff' : '#64748b'
                }}
              >
                Dhammaan (114)
              </button>

              <button
                type="button"
                onClick={() => setSurahFilter('memorized')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: surahFilter === 'memorized' ? '#16a34a' : '#e2e8f0',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  backgroundColor: surahFilter === 'memorized' ? '#16a34a' : '#ffffff',
                  color: surahFilter === 'memorized' ? '#ffffff' : '#64748b'
                }}
              >
                ✓ La Xifdiyay ({selectedSurahNumbers.size})
              </button>

              <button
                type="button"
                onClick={() => setSurahFilter('not_memorized')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: surahFilter === 'not_memorized' ? '#64748b' : '#e2e8f0',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  backgroundColor: surahFilter === 'not_memorized' ? '#64748b' : '#ffffff',
                  color: surahFilter === 'not_memorized' ? '#ffffff' : '#64748b'
                }}
              >
                Aan la xifdin ({114 - selectedSurahNumbers.size})
              </button>
            </div>

            {/* Row 3: Quick Select Helpers */}
            <div style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
              WebkitOverflowScrolling: 'touch'
            }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSelectJuz30}
                style={{ fontSize: '0.72rem', padding: '4px 10px', whiteSpace: 'nowrap', borderRadius: '16px' }}
              >
                + Juz Camma (78-114)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSelectJuz29}
                style={{ fontSize: '0.72rem', padding: '4px 10px', whiteSpace: 'nowrap', borderRadius: '16px' }}
              >
                + Juz Tabaarak (67-77)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSelectAll}
                style={{ fontSize: '0.72rem', padding: '4px 10px', whiteSpace: 'nowrap', borderRadius: '16px' }}
              >
                Dooro Dhammaan
              </button>
              {selectedSurahNumbers.size > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDeselectAll}
                  style={{ fontSize: '0.72rem', padding: '4px 10px', color: '#dc2626', whiteSpace: 'nowrap', borderRadius: '16px' }}
                >
                  Ka noqo Dhammaan
                </button>
              )}
            </div>
          </div>

          {/* 114 Surahs Cards Grid (2-column on mobile, multi-column on desktop) */}
          {studentSurahsLoading ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 10px auto', color: '#0d9488' }} />
              <div style={{ fontSize: '0.9rem' }}>Fadlan sug, waxaa la soo gelinayaa suuradaha ardayga...</div>
            </div>
          ) : !selectedStudentId ? (
            <div className="card" style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
              <BookOpen size={42} style={{ margin: '0 auto 12px auto', color: '#cbd5e1' }} />
              <h3 style={{ margin: '0 0 6px 0', color: '#334155', fontWeight: 700, fontSize: '1.1rem' }}>
                Dooro Arday si aad u aragto 114-ka Suuradood
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                Fadlan kor ka dooro fasalka iyo ardayga aad doonayso inaad diiwaangeliso xifdigiisa.
              </p>
            </div>
          ) : (
            <div className="surahs-grid">
              {displayedSurahs.map((surah) => {
                const isSelected = selectedSurahNumbers.has(surah.number);
                const isPreviouslySaved = originalSurahNumbers.has(surah.number);
                const isLockedForTeacher = isTeacher && isPreviouslySaved;

                return (
                  <div
                    key={surah.number}
                    onClick={() => handleToggleSurah(surah.number)}
                    title={isLockedForTeacher ? "Xifdiga suuraddan hore ayaa loo kaydiyay (Go'aanku waa final). Maamulka oo kaliya ayaa wax ka beddeli kara." : ""}
                    style={{
                      backgroundColor: isLockedForTeacher ? '#f0fdf4' : isSelected ? '#ecfdf5' : '#ffffff',
                      border: isLockedForTeacher ? '2px solid #059669' : isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      cursor: isLockedForTeacher ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 6px rgba(16, 185, 129, 0.15)' : '0 1px 2px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      userSelect: 'none',
                      touchAction: 'manipulation',
                      position: 'relative'
                    }}
                  >
                    {/* Top Row: Surah Number and Checkbox / Final Pill */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: isSelected ? '#dcfce7' : '#f1f5f9',
                        color: isSelected ? '#15803d' : '#64748b',
                        padding: '1px 6px',
                        borderRadius: '10px'
                      }}>
                        #{surah.number}
                      </span>

                      {/* Interactive Selection Checkmark or Final Lock */}
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        backgroundColor: isLockedForTeacher ? '#059669' : isSelected ? '#10b981' : '#ffffff',
                        border: isLockedForTeacher ? '2px solid #059669' : isSelected ? '2px solid #10b981' : '2px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        transition: 'all 0.15s ease'
                      }}>
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                    </div>

                    {/* Surah Arabic Name (Prominent Arabic Calligraphy) */}
                    <div style={{ textAlign: 'center', margin: '2px 0' }}>
                      <div style={{
                        fontFamily: "'Amiri', 'Traditional Arabic', 'Scheherazade New', serif",
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: isSelected ? '#047857' : '#0f172a',
                        lineHeight: 1.25,
                        direction: 'rtl'
                      }}>
                        {surah.name_ar}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                        {surah.name_en}
                      </div>
                    </div>

                    {/* Bottom Row: Verses Count & Status */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '6px',
                      paddingTop: '4px',
                      borderTop: '1px solid',
                      borderColor: isSelected ? '#dcfce7' : '#f1f5f9',
                      fontSize: '0.7rem'
                    }}>
                      <span style={{ color: '#64748b' }}>
                        {surah.total_verses} aayad
                      </span>

                      <span style={{
                        fontWeight: 700,
                        color: isLockedForTeacher ? '#047857' : isSelected ? '#16a34a' : '#94a3b8'
                      }}>
                        {isLockedForTeacher ? '✓ Xifdiyay (Final)' : isSelected ? '✓ Xifdiyay' : 'Lama xifdin'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating Save Bar on Mobile Screen (Sticky Bottom) */}
          {selectedStudentId && (
            <div className="mobile-floating-save-bar">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{selectedSurahNumbers.size} / 114</span>
                  {hasUnsavedChanges && (
                    <span style={{ fontSize: '0.65rem', backgroundColor: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '4px' }}>
                      Aan la kaydin
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Suuradood la doortay
                </span>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveMemorization}
                disabled={savingSurahs}
                style={{
                  backgroundColor: '#0d9488',
                  borderColor: '#0d9488',
                  padding: '9px 18px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.35)'
                }}
              >
                {savingSurahs ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                Kaydi Xifdiga
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: FASALLADA (CLASS MANAGEMENT FOR ADMINISTRATORS ONLY) */}
      {/* ========================================================================= */}
      {activeSection === 'classes' && canManageClasses && (
        <div>
          {/* Header Description & Summary */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                  Maamulka Fasallada & Xilsaaridda Macallimiinta
                </h2>
                <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem' }}>
                  Fasallada dugsiga Quraanka, jadwallada waxbarashada (<strong>Subax</strong>, <strong>Galab</strong>, <strong>Subax iyo Galab</strong>), iyo hal macallin oo fasal kasta loo xilsaaray.
                </p>
              </div>

              <button
                className="btn btn-primary"
                onClick={openCreateClassModal}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#0d9488', borderColor: '#0d9488' }}
              >
                <Plus size={16} /> Fasal Cusub Abuur
              </button>
            </div>
          </div>

          {/* Classes Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px'
          }}>
            {classes.map(cls => (
              <div
                key={cls.id}
                className="card"
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  borderTop: '4px solid #0d9488',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  {/* Class Title and Schedule Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                        {cls.name}
                      </h3>
                      {cls.level_name && (
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Heerka: {cls.level_name}
                        </span>
                      )}
                    </div>

                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '14px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: cls.shift === 'Subax iyo Galab' ? '#fef3c7' : cls.shift === 'Galab' ? '#fed7aa' : '#e0f2fe',
                      color: cls.shift === 'Subax iyo Galab' ? '#92400e' : cls.shift === 'Galab' ? '#c2410c' : '#0369a1'
                    }}>
                      <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {cls.shift}
                    </span>
                  </div>

                  {/* Assigned Teacher (Enforce exactly 1 teacher) */}
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    marginBottom: '14px'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>
                      Macallinka Fasalka (Hal Macallin):
                    </div>
                    <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={16} color="#0d9488" />
                      {cls.assigned_teacher_name || 'Lama xilsaarin macallin'}
                    </div>
                    {cls.assigned_teacher_phone && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        Tel: {cls.assigned_teacher_phone}
                      </div>
                    )}
                  </div>

                  {/* Student Count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#334155', fontSize: '0.9rem' }}>
                    <Users size={16} color="#64748b" />
                    Tirada Ardayda: <strong style={{ color: '#0d9488', fontSize: '1.05rem' }}>{cls.student_count || 0}</strong> arday
                  </div>
                </div>

                {/* Class Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openRegisterStudentModal(cls)}
                      style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <UserPlus size={14} color="#0d9488" />
                      + Diiwaangeli Arday
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openAddExistingModal(cls)}
                      style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <UserCheck size={14} color="#0d9488" />
                      + Ku Dar Arday Jira
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditClassModal(cls)}
                        title="Wax ka beddel fasalka"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDeleteClass(cls)}
                        title="Tir fasalka"
                        style={{ color: '#dc2626' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: BEDDEL / TRANSFER ARDAY (ADMINISTRATORS ONLY) */}
      {/* ========================================================================= */}
      {activeSection === 'transfer' && canManageClasses && (
        <div>
          <div className="card" style={{ padding: '16px 20px', marginBottom: '16px', borderTop: '4px solid #0d9488' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              Beddel / Transfer Arday
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.84rem' }}>
              Ardayga fasal kale ugu wareeji si ammaan ah; xifdiga, xaadirinta, imtixaanka iyo taariikhda kale lama tirtirayo.
            </p>
          </div>

          <div className="card" style={{ padding: '18px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(220px, 0.8fr)', gap: '16px', alignItems: 'start' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700 }}>1. Raadi Ardayga</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '11px', top: '11px', color: '#94a3b8' }} />
                  <input
                    type="search"
                    className="form-input"
                    value={transferSearch}
                    onChange={(e) => searchTransferStudents(e.target.value)}
                    placeholder="Magac, magaca Carabiga, ama Student ID..."
                    style={{ paddingLeft: '34px' }}
                  />
                </div>
                {transferSearching && <div style={{ marginTop: '6px', color: '#64748b', fontSize: '0.78rem' }}>Raadin ayaa socota...</div>}
                {transferCandidates.length > 0 && !selectedTransferStudent && (
                  <div style={{ marginTop: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                    {transferCandidates.map(student => (
                      <button
                        type="button"
                        key={`${student.id}-${student.current_group_id}`}
                        onClick={() => {
                          setSelectedTransferStudent(student);
                          setTransferCandidates([]);
                          setDestinationGroupId('');
                        }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{student.full_name}</div>
                        {student.name_ar && <div dir="rtl" style={{ color: '#0d9488', fontSize: '0.86rem' }}>{student.name_ar}</div>}
                        <div style={{ color: '#64748b', fontSize: '0.76rem' }}>
                          ID: {student.student_id} • Hadda: {student.current_group_name} ({student.current_group_shift || 'Jadwal lama'})
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {transferSearch.trim().length >= 2 && !transferSearching && transferCandidates.length === 0 && !selectedTransferStudent && (
                  <div style={{ marginTop: '8px', color: '#64748b', fontSize: '0.8rem' }}>Arday ku habboon lama helin.</div>
                )}
              </div>

              <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', minHeight: '92px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '5px' }}>2. Fasalka Hadda (Akhris Keliya)</div>
                {selectedTransferStudent ? (
                  <>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{selectedTransferStudent.current_group_name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '3px' }}>
                      {selectedTransferStudent.current_group_shift || 'Jadwal lama hayo'}
                      {selectedTransferStudent.current_teacher_name ? ` • Macallin: ${selectedTransferStudent.current_teacher_name}` : ''}
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Marka hore dooro arday.</div>
                )}
              </div>
            </div>

            {selectedTransferStudent && (
              <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 180px', gap: '14px', alignItems: 'end' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700 }}>3. Fasalka Loo Wareejinayo</label>
                    <select className="form-select" value={destinationGroupId} onChange={(e) => setDestinationGroupId(e.target.value)}>
                      <option value="">-- Dooro fasal cusub --</option>
                      {classes
                        .filter(group => Number(group.is_active) !== 0 && Number(group.id) !== Number(selectedTransferStudent.current_group_id))
                        .map(group => (
                          <option key={group.id} value={group.id}>
                            {group.name} • {group.shift || 'Jadwal lama hayo'} • {group.assigned_teacher_name || 'Macallin lama xilsaarin'}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700 }}>4. Taariikhda Wareejinta</label>
                    <input type="date" className="form-input" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>5. Sababta Wareejinta (Ikhtiyaari)</label>
                  <textarea className="form-input" rows="2" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Tusaale: Jadwalka ardayga ayaa is beddelay..." />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setSelectedTransferStudent(null); setTransferCandidates([]); setTransferSearch(''); setDestinationGroupId(''); }}>
                    Nadiifi
                  </button>
                  <button type="button" className="btn btn-primary" disabled={transferSaving || !destinationGroupId} onClick={handleTransferStudent} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0d9488', borderColor: '#0d9488' }}>
                    <ArrowRight size={15} /> {transferSaving ? 'Waa la wareejinayaa...' : 'Xaqiiji Wareejinta Ardayga'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Taariikhda Wareejinta</h3>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{transferHistory.length} wareejin</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 180px 150px 150px', gap: '8px', marginBottom: '12px' }}>
              <input className="form-input" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Raadi arday ama fasal..." />
              <select className="form-select" value={historyGroupId} onChange={(e) => setHistoryGroupId(e.target.value)}>
                <option value="">Dhammaan fasallada</option>
                {classes.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <input type="date" className="form-input" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} aria-label="Laga bilaabo" />
              <input type="date" className="form-input" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} aria-label="Ilaa" />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '850px' }}>
                <thead><tr><th>Arday</th><th>Student ID</th><th>Fasalkii Hore</th><th>Fasalka Cusub</th><th>Taariikh</th><th>Sabab</th><th>Qabtay</th></tr></thead>
                <tbody>
                  {transferHistoryLoading ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>Soo gelinaya taariikhda...</td></tr>
                  ) : transferHistory.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>Taariikh wareejin lama helin.</td></tr>
                  ) : transferHistory.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.student_name}</strong>{item.name_ar && <div dir="rtl" style={{ color: '#0d9488', fontSize: '0.78rem' }}>{item.name_ar}</div>}</td>
                      <td>{item.student_code}</td>
                      <td>{item.from_group_name}</td>
                      <td>{item.to_group_name}</td>
                      <td>{item.transfer_date ? new Date(item.transfer_date).toLocaleDateString('en-GB') : '-'}</td>
                      <td>{item.reason || '-'}</td>
                      <td>{item.transferred_by_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT CLASS (FASAL ABUUR AMA WAX KA BEDDEL) */}
      {/* ========================================================================= */}
      {showClassModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>
                {editingClass ? 'Wax ka beddel Fasalka' : 'Abuur Fasal Cusub'}
              </h3>
              <button
                type="button"
                onClick={() => setShowClassModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveClass}>
              {/* Class Name */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Magaca Fasalka / Halaqada: *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="tusaale: Halaqada 1aad (Halaqatu Cali)"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  required
                />
              </div>

              {/* Education Schedule (Subax, Galab, Subax iyo Galab) */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Jadwalka Waxbarashada: *
                </label>
                <select
                  className="form-select"
                  value={classSchedule}
                  onChange={(e) => setClassSchedule(e.target.value)}
                  required
                  style={{ fontWeight: 600 }}
                >
                  <option value="Subax">Subax (Morning Session)</option>
                  <option value="Galab">Galab (Afternoon Session)</option>
                  <option value="Subax iyo Galab">Subax iyo Galab (Both Sessions)</option>
                </select>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                  Dooro mid ka mid ah: Subax, Galab, ama Subax iyo Galab.
                </div>
              </div>

              {/* Assigned Teacher (Exactly ONE teacher per class) */}
              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Macallinka Fasalka (Hal Macallin): *
                </label>
                <select
                  className="form-select"
                  value={classTeacherId}
                  onChange={(e) => setClassTeacherId(e.target.value)}
                  required
                  style={{ fontWeight: 600 }}
                >
                  <option value="">-- Dooro Macallin --</option>
                  {teachersList.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.phone ? `(${t.phone})` : ''}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                  Fasal kasta waxaa loo xilsaaraa <strong>hal macallin oo keliya</strong>.
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowClassModal(false)}
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={classSaving}
                  style={{ backgroundColor: '#0d9488', borderColor: '#0d9488' }}
                >
                  {classSaving ? 'Waa la kaydinayaa...' : editingClass ? 'Cusbooneysii Fasalka' : 'Abuur Fasalka'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTER NEW STUDENT DIRECTLY INTO CLASS */}
      {/* ========================================================================= */}
      {showRegisterStudentModal && targetClassForStudent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '550px', padding: '24px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontWeight: 800, color: '#0f172a' }}>
                  Diiwaangeli Arday Cusub
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#0d9488', fontWeight: 700 }}>
                  Fasalka: {targetClassForStudent.name} ({targetClassForStudent.shift})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterStudentModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterStudent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Magaca Ardayga (Af-Soomaali): *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="tusaale: Cabdiraxmaan Cali Xasan"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Magaca Carabiga (الاسم بالعربية):
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    dir="rtl"
                    placeholder="عبد الرحمن علي حسن"
                    value={regNameAr}
                    onChange={(e) => setRegNameAr(e.target.value)}
                    style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif", fontSize: '1rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Jinsiga: *
                  </label>
                  <select
                    className="form-select"
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value)}
                    required
                  >
                    <option value="male">Lab (Wiil)</option>
                    <option value="female">Dhedig (Gabar)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Taleefanka: *
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="+252 61..."
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Magaca Masuulka:
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Magaca waalidka / masuulka"
                    value={regGuardianName}
                    onChange={(e) => setRegGuardianName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Taleefanka Masuulka:
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="+252 61..."
                    value={regGuardianPhone}
                    onChange={(e) => setRegGuardianPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRegisterStudentModal(false)}
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={registeringStudent}
                  style={{ backgroundColor: '#0d9488', borderColor: '#0d9488' }}
                >
                  {registeringStudent ? 'Waa la diiwaangelinayaa...' : 'Diiwaangeli oo Faskan Ku Dar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD ALREADY REGISTERED STUDENT TO CLASS */}
      {/* ========================================================================= */}
      {showAddExistingModal && targetClassForStudent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '650px', padding: '24px', borderRadius: '12px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontWeight: 800, color: '#0f172a' }}>
                  Ku Dar Arday Jira Fasalka
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#0d9488', fontWeight: 700 }}>
                  Fasalka: {targetClassForStudent.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExistingModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Raadi magaca ardayga, magaca carabiga, ama student ID..."
                value={existingSearch}
                onChange={(e) => {
                  setExistingSearch(e.target.value);
                  loadAvailableStudents(e.target.value, targetClassForStudent.id);
                }}
                style={{ paddingLeft: '36px' }}
              />
            </div>

            {/* Students List */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
              {availableLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#0d9488' }} />
                  Raadinta ardayda...
                </div>
              ) : availableStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Arday ku habboon lama helin.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {availableStudents.map(st => (
                    <div
                      key={st.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {st.full_name}
                          {st.name_ar && (
                            <span style={{
                              marginRight: '8px',
                              color: '#0d9488',
                              fontFamily: "'Amiri', 'Traditional Arabic', serif",
                              direction: 'rtl'
                            }}>
                              {' '}({st.name_ar})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ID: {st.student_id} • Tel: {st.phone}
                          {st.current_group_name && ` • Fasal hadda: ${st.current_group_name}`}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleEnrollExistingStudent(st.id, st.full_name)}
                        disabled={enrollingStudentId === st.id}
                        style={{
                          backgroundColor: '#0d9488',
                          borderColor: '#0d9488',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {enrollingStudentId === st.id ? 'Waa la darayaa...' : '+ Ku Dar Fasalka'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddExistingModal(false)}
              >
                Xir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
