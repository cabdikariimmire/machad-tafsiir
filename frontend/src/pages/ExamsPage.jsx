import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Award, Calendar, Layers, Plus, Edit2, Trash2, Printer, CheckCircle,
  AlertCircle, Search, Filter, RefreshCw, Clock, ArrowRight, ShieldCheck,
  GraduationCap, Check, X, AlertTriangle, Users, BookOpen
} from 'lucide-react';

export default function ExamsPage() {
  const { user, isSuperAdmin, isInstituteAdmin, isExamOfficer } = useAuth();

  // Active Tab: 'plan' | 'timetables' | 'progression'
  const [activeTab, setActiveTab] = useState('plan');

  // Academic Year
  const [academicYear, setAcademicYear] = useState('2026');

  // Global Notification
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  function showMessage(type, message) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
  }

  // ========================================================
  // TAB 1: ACADEMIC-YEAR EXAM PLAN & ASSESSMENT CONFIG
  // ========================================================
  const [examPeriods, setExamPeriods] = useState([]);
  const [examSet, setExamSet] = useState(null);
  const [examSetDraft, setExamSetDraft] = useState({ name: '', description: '', members: [] });
  const [examSetSaving, setExamSetSaving] = useState(false);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [assessmentConfig, setAssessmentConfig] = useState({
    marking_mode: 'mode_b',
    mode_b_calculation: 'average',
    pass_threshold: 50.0,
    description: ''
  });
  const [configSaving, setConfigSaving] = useState(false);

  // Period Modal
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodModalMode, setPeriodModalMode] = useState('create'); // 'create' | 'edit'
  const [periodForm, setPeriodForm] = useState({
    id: null,
    name: '',
    exam_type: 'monthly',
    sequence_order: 1,
    max_contribution: 100,
    start_date: '',
    end_date: '',
    status: 'active'
  });
  const [periodSaving, setPeriodSaving] = useState(false);

  // Admin Exam Scheme Rule Builder State
  const [isEditingRule, setIsEditingRule] = useState(false);
  const [ruleDraftExams, setRuleDraftExams] = useState([
    { name: 'Imtixaanka Niska (Midterm)', exam_type: 'midterm', max_contribution: 40, sequence_order: 1 },
    { name: 'Kama-Dambays (Final)', exam_type: 'final', max_contribution: 60, sequence_order: 2 }
  ]);
  const [rulePassThreshold, setRulePassThreshold] = useState(50);
  const [ruleSaving, setRuleSaving] = useState(false);

  const loadExamPlanData = useCallback(async () => {
    setPeriodsLoading(true);
    try {
      const [periodsRes, configRes, setRes] = await Promise.all([
        api.getExamPeriods({ academic_year: academicYear }),
        api.getAssessmentConfig({ academic_year: academicYear }),
        api.getExamSets({ academic_year: academicYear })
      ]);

      if (periodsRes.success) {
        const pList = periodsRes.data || [];
        setExamPeriods(pList);
        if (pList.length > 0) {
          const firstPeriod = pList.find(p => p.sequence_order === 1 || p.exam_type === 'midterm') || pList[0];
          const secondPeriod = pList.find(p => p.sequence_order === 2 || p.exam_type === 'final') || pList[1];
          setRuleDraftExams([
            {
              id: firstPeriod?.id,
              name: firstPeriod?.name || 'Imtixaanka Niska (Midterm)',
              exam_type: 'midterm',
              max_contribution: 40,
              sequence_order: 1
            },
            {
              id: secondPeriod?.id,
              name: secondPeriod?.name || 'Kama-Dambays (Final)',
              exam_type: 'final',
              max_contribution: 60,
              sequence_order: 2
            }
          ]);
        }
      }
      if (configRes.success && configRes.data) {
        setAssessmentConfig(configRes.data);
        if (configRes.data.pass_threshold !== undefined) {
          setRulePassThreshold(parseFloat(configRes.data.pass_threshold) || 50);
        }
      }
      if (setRes.success) {
        const configuredSet = setRes.data || null;
        setExamSet(configuredSet);
        setExamSetDraft(configuredSet ? {
          name: configuredSet.name || '',
          description: configuredSet.description || '',
          members: (configuredSet.members || []).map(member => ({
            exam_period_id: member.exam_period_id,
            sequence_order: member.sequence_order,
            maximum_marks: member.maximum_marks,
            is_required: member.is_required !== false
          }))
        } : { name: '', description: '', members: [] });
      }
    } catch (err) {
      console.error(err);
      showMessage('error', 'Cilad ayaa dhacday markii la soo qaadayay qorshaha imtixaanka.');
    } finally {
      setPeriodsLoading(false);
    }
  }, [academicYear]);

  const handleSaveExamSet = async (e) => {
    e.preventDefault();
    if (!examSetDraft.name.trim() || examSetDraft.members.length === 0) {
      showMessage('error', 'Geli magaca set-ka oo dooro ugu yaraan hal imtixaan.');
      return;
    }
    setExamSetSaving(true);
    try {
      const res = await api.saveExamSet({ academic_year: academicYear, ...examSetDraft });
      if (res.success) {
        showMessage('success', 'Connected examination set-ka waa la kaydiyay.');
        await loadExamPlanData();
      } else {
        showMessage('error', res.error || 'Kaydinta set-ka waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday.');
    } finally {
      setExamSetSaving(false);
    }
  };

  const toggleExamSetMember = (period) => {
    setExamSetDraft(prev => {
      const existing = prev.members.find(member => Number(member.exam_period_id) === Number(period.id));
      if (existing) {
        return { ...prev, members: prev.members.filter(member => Number(member.exam_period_id) !== Number(period.id)) };
      }
      return {
        ...prev,
        members: [...prev.members, {
          exam_period_id: period.id,
          sequence_order: prev.members.length + 1,
          maximum_marks: Number(period.max_contribution) || 100,
          is_required: true
        }]
      };
    });
  };

  const [standardSetupSaving, setStandardSetupSaving] = useState(false);

  const handleSetupStandardScheme = async () => {
    if (!window.confirm(`Ma hubtaa inaad sannadka ${academicYear} u dejiso nidaamka rasmiga ah ee 40/60 (Midterm 40 dhibcood & Final 60 dhibcood)?`)) return;
    setStandardSetupSaving(true);
    try {
      const res = await api.setupStandardExamScheme({
        academic_year: academicYear,
        pass_threshold: assessmentConfig.pass_threshold || 50
      });
      if (res.success) {
        showMessage('success', 'Nidaamka rasmiga ah ee 40/60 (Midterm 40 & Final 60) si guul leh ayaa loo dejiyay.');
        await loadExamPlanData();
      } else {
        showMessage('error', res.error || 'Dejinta nidaamka waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday.');
    } finally {
      setStandardSetupSaving(false);
    }
  };

  const handleRuleExamNameChange = (index, newName) => {
    const updated = [...ruleDraftExams];
    if (updated[index]) {
      updated[index] = { ...updated[index], name: newName };
      setRuleDraftExams(updated);
    }
  };

  const handleSaveSchemeRule = async (e) => {
    if (e) e.preventDefault();
    const name1 = (ruleDraftExams[0]?.name || '').trim();
    const name2 = (ruleDraftExams[1]?.name || '').trim();

    if (!name1) {
      showMessage('error', 'Fadlan geli magaca Imtixaanka 1-aad (Midterm - 40 dhibcood).');
      return;
    }
    if (!name2) {
      showMessage('error', 'Fadlan geli magaca Imtixaanka 2-aad ee Kama-dambaysta ah (Final - 60 dhibcood).');
      return;
    }

    setRuleSaving(true);
    try {
      const res = await api.saveSchemeRule({
        academic_year: academicYear,
        pass_threshold: rulePassThreshold,
        exam1_name: name1,
        exam2_name: name2,
        exams: [
          { ...ruleDraftExams[0], name: name1, max_contribution: 40, sequence_order: 1, exam_type: 'midterm' },
          { ...ruleDraftExams[1], name: name2, max_contribution: 60, sequence_order: 2, exam_type: 'final' }
        ]
      });
      if (res.success) {
        showMessage('success', 'Xeerka 40/60 ee labada imtixaan si guul leh ayaa loo kaydiyay!');
        setIsEditingRule(false);
        await loadExamPlanData();
      } else {
        showMessage('error', res.error || 'Kaydinta xeerka imtixaanka waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday markii la kaydinayay xeerka.');
    } finally {
      setRuleSaving(false);
    }
  };

  const handleSaveAssessmentConfig = async (e) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      const res = await api.saveAssessmentConfig({
        academic_year: academicYear,
        marking_mode: 'mode_a',
        mode_b_calculation: 'average',
        pass_threshold: assessmentConfig.pass_threshold || 50,
        description: assessmentConfig.description || 'Standard 40/60 Assessment Scheme'
      });
      if (res.success) {
        showMessage('success', 'Xeerka baasidda sannadka si guul leh ayaa loo kaydiyay.');
      } else {
        showMessage('error', res.error || 'Kaydinta waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday.');
    } finally {
      setConfigSaving(false);
    }
  };

  const [deleteAllSaving, setDeleteAllSaving] = useState(false);

  const handleDeletePeriod = async (periodId) => {
    const period = examPeriods.find(p => p.id === periodId);
    const name = period?.name || 'imtixaankan';
    if (!window.confirm(`Ma hubtaa inaad tirtirto imtixaanka '${name}'? Tallaabadan dib looma noqon karo.`)) {
      return;
    }
    try {
      const res = await api.deleteExamPeriod(periodId);
      if (res.success) {
        showMessage('success', res.message || 'Imtixaanka si guul leh ayaa loo tiray.');
        await loadExamPlanData();
      } else {
        showMessage('error', res.error || 'Tirtirista imtixaanka waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday markii imtixaanka la tirtirayay.');
    }
  };

  const handleDeleteAllPeriods = async () => {
    if (!window.confirm(`DIGTOONI: Ma hubtaa inaad wada tirtirto DHAMMAAN imtixaanaadka sannadka ${academicYear} (${examPeriods.length} imtixaan)?\n\nTallaabadan dhammaan imtixaanaadka qorshaysan ee sannadka way tirtiraysaa si aad meel nadiif ah uga bilowdo.`)) {
      return;
    }
    setDeleteAllSaving(true);
    try {
      const res = await api.deleteAllExamPeriods({ academic_year: academicYear });
      if (res.success) {
        showMessage('success', res.message || `Dhammaan imtixaanaadkii sannadka ${academicYear} waa la wada tiray.`);
        await loadExamPlanData();
      } else {
        showMessage('error', res.error || 'Tirtirista dhammaan imtixaanaadka waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday markii la tirtirayay imtixaanaadka.');
    } finally {
      setDeleteAllSaving(false);
    }
  };

  const handleOpenCreatePeriod = () => {
    setPeriodModalMode('create');
    setPeriodForm({
      id: null,
      name: examPeriods.length === 0 ? 'Midterm (Imtixaanka Niska)' : 'Final (Imtixaanka Kama-dambaysta ah)',
      exam_type: examPeriods.length === 0 ? 'midterm' : 'final',
      sequence_order: examPeriods.length + 1,
      max_contribution: examPeriods.length === 0 ? 40 : 60,
      start_date: '',
      end_date: '',
      status: 'active'
    });
    setShowPeriodModal(true);
  };

  const handleOpenEditPeriod = (p) => {
    setPeriodModalMode('edit');
    setPeriodForm({
      id: p.id,
      name: p.name,
      exam_type: p.exam_type || 'monthly',
      sequence_order: p.sequence_order || 1,
      max_contribution: p.max_contribution || 100,
      start_date: p.start_date ? p.start_date.split('T')[0] : '',
      end_date: p.end_date ? p.end_date.split('T')[0] : '',
      status: p.status || 'active'
    });
    setShowPeriodModal(true);
  };

  const handleSavePeriod = async (e) => {
    e.preventDefault();
    if (!periodForm.name.trim()) {
      showMessage('error', 'Fadlan geli magaca imtixaanka.');
      return;
    }
    setPeriodSaving(true);
    try {
      const payload = {
        ...periodForm,
        academic_year: academicYear
      };
      let res;
      if (periodModalMode === 'create') {
        res = await api.createExamPeriod(payload);
      } else {
        res = await api.updateExamPeriod(periodForm.id, payload);
      }
      if (res.success) {
        showMessage('success', 'Imtixaanka si guul leh ayaa loo diiwaangeliyay.');
        setShowPeriodModal(false);
        loadExamPlanData();
      } else {
        showMessage('error', res.error || 'Kaydinta waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday.');
    } finally {
      setPeriodSaving(false);
    }
  };

  // ========================================================
  // TAB 2: CONFIGURABLE EXAMINATION TIMETABLES
  // ========================================================
  const [classes, setClasses] = useState([]);
  const [timetableExam, setTimetableExam] = useState('');
  const [timetableClassId, setTimetableClassId] = useState('');
  const [timetableData, setTimetableData] = useState(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [classAssignedSubjects, setClassAssignedSubjects] = useState([]);

  // Timetable Add Entry Modal
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [entryForm, setEntryForm] = useState({
    subject_id: '',
    exam_date: '',
    day_of_week: 'Sabti (Saturday)',
    start_time: '08:00',
    end_time: '09:30'
  });
  const [entrySaving, setEntrySaving] = useState(false);

  const loadTimetableClassesAndExams = useCallback(async () => {
    try {
      const [clsRes, pRes] = await Promise.all([
        api.getClasses({ academic_year: academicYear }),
        api.getExamPeriods({ academic_year: academicYear })
      ]);
      if (clsRes.success) {
        const cList = clsRes.data || [];
        setClasses(cList);
        if (cList.length > 0) {
          setTimetableClassId(prev => (prev && cList.some(c => String(c.id) === String(prev))) ? prev : cList[0].id);
        }
      }
      if (pRes.success) {
        const pList = pRes.data || [];
        if (pList.length > 0) {
          setTimetableExam(prev => (prev && pList.some(p => p.name === prev)) ? prev : pList[0].name);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [academicYear]);

  const fetchTimetable = useCallback(async () => {
    if (!timetableClassId || !timetableExam) return;
    setTimetableLoading(true);
    try {
      const periodObj = examPeriods.find(p => p.name === timetableExam || String(p.id) === String(timetableExam));
      const res = await api.getClassExamTimetable({
        class_id: timetableClassId,
        exam_period_id: periodObj ? periodObj.id : undefined,
        exam_period: timetableExam,
        academic_year: academicYear
      });
      if (res.success && res.data) {
        setTimetableData(res.data);
        if (Array.isArray(res.data.assigned_subjects) && res.data.assigned_subjects.length > 0) {
          setClassAssignedSubjects(res.data.assigned_subjects);
        }
      }

      // Also fallback fetch subjects assigned to this class for the dropdown
      const subRes = await api.getSubjects(`?class_id=${timetableClassId}`);
      if (subRes.success && subRes.data?.length > 0) {
        setClassAssignedSubjects(prev => (prev && prev.length > 0) ? prev : subRes.data);
      }
    } catch (err) {
      console.error(err);
      showMessage('error', 'Cilad ayaa dhacday soo qaadista jadwalka imtixaanka.');
    } finally {
      setTimetableLoading(false);
    }
  }, [timetableClassId, timetableExam, academicYear, examPeriods]);

  const handleSaveTimetableEntry = async (e) => {
    e.preventDefault();
    if (!entryForm.subject_id) {
      showMessage('error', 'Fadlan dooro maaddada loo xilsaaray fasalka.');
      return;
    }
    setEntrySaving(true);
    try {
      const periodObj = examPeriods.find(p => p.name === timetableExam || String(p.id) === String(timetableExam));
      const payload = {
        class_id: timetableClassId,
        exam_period_id: periodObj ? periodObj.id : undefined,
        exam_period: timetableExam,
        subject_id: entryForm.subject_id,
        exam_date: entryForm.exam_date || new Date().toISOString().split('T')[0],
        day_of_week: entryForm.day_of_week,
        start_time: entryForm.start_time,
        end_time: entryForm.end_time,
        academic_year: academicYear
      };

      const res = await api.saveClassExamTimetable(payload);
      if (res.success) {
        showMessage('success', 'Jadwalka maaddada si guul leh ayaa loo kaydiyay.');
        setShowTimetableModal(false);
        fetchTimetable();
      } else {
        showMessage('error', res.error || 'Kaydinta waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday.');
    } finally {
      setEntrySaving(false);
    }
  };

  const handleDeleteTimetableEntry = async (id) => {
    if (!window.confirm('Ma hubtaa inaad tirtirto maaddadan jadwalka?')) return;
    try {
      const res = await api.deleteClassExamTimetableEntry(id);
      if (res.success) {
        showMessage('success', 'Waa la tirtiray maaddada jadwalka.');
        fetchTimetable();
      } else {
        showMessage('error', res.error || 'Tirtiristu waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday.');
    }
  };

  // Group timetable entries by day for horizontal single-row layout
  const groupedTimetableByDay = {};
  (timetableData?.entries || []).forEach(entry => {
    const day = entry.day_of_week || 'Sabti';
    if (!groupedTimetableByDay[day]) {
      groupedTimetableByDay[day] = [];
    }
    groupedTimetableByDay[day].push(entry);
  });

  const maxSubjectsInDay = Math.max(
    1,
    ...Object.values(groupedTimetableByDay).map(arr => arr.length)
  );

  // Run tabs loaders
  useEffect(() => {
    if (activeTab === 'plan') {
      loadExamPlanData();
    } else if (activeTab === 'timetables') {
      loadTimetableClassesAndExams();
    }
  }, [activeTab, loadExamPlanData, loadTimetableClassesAndExams]);

  useEffect(() => {
    if (activeTab === 'timetables' && timetableClassId && timetableExam) {
      fetchTimetable();
    }
  }, [activeTab, timetableClassId, timetableExam, fetchTimetable]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(13, 148, 136, 0.08)', borderRadius: '9999px', color: '#0f766e', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
            <Award size={14} />
            <span>Xafiiska Imtixaanaadka & Qiimeynta (Examination Office)</span>
          </div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            Maamulka Imtixaanaadka & Fasallada (Exams)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.865rem', marginTop: '4px' }}>
            Qorshaynta imtixaanaadka sannadlaha ah iyo jadwalka maaddooyinka
          </p>
        </div>

        {/* Academic Year Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="no-print">
          <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569' }}>
            Sannad-Dugsiyeedka:
          </label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="form-select"
            style={{ width: '160px', fontWeight: 700, borderColor: '#cbd5e1' }}
          >
            <option value="2026">2026–2027</option>
            <option value="2025">2025–2026</option>
            <option value="2024">2024–2025</option>
          </select>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback.message && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#166534' : '#991b1b',
          fontSize: '0.88rem',
          fontWeight: 600
        }}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 2 Internal Navigation Tabs (Exam Plan, Timetables) */}
      <div className="exam-tabs-nav no-print" style={{ marginBottom: '22px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('plan')}
          className={`exam-tab-btn ${activeTab === 'plan' ? 'active' : ''}`}
        >
          <Calendar size={16} />
          <span>1. Qorshaha Imtixaanka (Exam Plan)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timetables')}
          className={`exam-tab-btn ${activeTab === 'timetables' ? 'active' : ''}`}
        >
          <Clock size={16} />
          <span>2. Jadwalka Imtixaanka (Timetables)</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ACADEMIC-YEAR EXAM PLAN & ASSESSMENT SETTINGS     */}
      {/* ======================================================== */}
      {activeTab === 'plan' && (
        <div>
          {/* Card 1: Official 40/60 Two-Exam Connected Rule */}
          {isEditingRule ? (
            <div className="card" style={{ marginBottom: '22px', borderLeft: '4px solid #0f766e', background: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div className="card-body" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Award size={16} />
                      Xeerka Imtixaanaadka: 2 Imtixaan oo Isku Xiran (40 & 60 = 100 Dhibcood)
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '6px 0 4px' }}>
                      Wax Ka Beddel Magacyada Labada Imtixaan ({academicYear})
                    </h3>
                    <p style={{ color: '#475569', fontSize: '0.865rem', margin: 0, maxWidth: '820px' }}>
                      Fasallada oo dhan waxay leeyihiin <strong>2 imtixaan oo kaliya oo isku xiran</strong>: Imtixaanka 1-aad (40 dhibcood) iyo Imtixaanka Kama-dambaysta ah (60 dhibcood) = Wadarta 100 dhibcood. Waxa aad beddeli karto oo kaliya waa <strong>magacyada labada imtixaan</strong>.
                    </p>
                  </div>
                </div>

                {/* 2 Connected Exam Form Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', marginBottom: '20px' }}>
                  {/* Exam 1 (Fixed 40 marks) */}
                  <div style={{ background: '#f8fafc', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#166534', color: '#ffffff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 800 }}>1</span>
                        <strong style={{ color: '#166534', fontSize: '0.92rem' }}>Imtixaanka 1-aad (First Exam)</strong>
                      </div>
                      <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 800, fontSize: '0.78rem', padding: '4px 10px', borderRadius: '6px' }}>
                        🔒 40 Dhibcood (Fixed)
                      </span>
                    </div>

                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                        Magaca Imtixaanka 1-aad
                      </label>
                      <input
                        type="text"
                        value={ruleDraftExams[0]?.name || ''}
                        onChange={(e) => handleRuleExamNameChange(0, e.target.value)}
                        placeholder="tusaale: Imtixaanka Niska (Midterm)"
                        className="form-input"
                        style={{ fontWeight: 600, fontSize: '0.92rem' }}
                      />
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 600 }}>
                      Baasidda: 20/40 (50%) — Wuxuu ku xiran yahay imtixaanka 2-aad
                    </div>
                  </div>

                  {/* Exam 2 (Fixed 60 marks) */}
                  <div style={{ background: '#f8fafc', border: '1px solid #99f6e4', borderRadius: '12px', padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#0f766e', color: '#ffffff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 800 }}>2</span>
                        <strong style={{ color: '#0f766e', fontSize: '0.92rem' }}>Imtixaanka 2-aad (Final Exam)</strong>
                      </div>
                      <span style={{ background: '#ccfbf1', color: '#0f766e', fontWeight: 800, fontSize: '0.78rem', padding: '4px 10px', borderRadius: '6px' }}>
                        🔒 60 Dhibcood (Fixed)
                      </span>
                    </div>

                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                        Magaca Imtixaanka 2-aad
                      </label>
                      <input
                        type="text"
                        value={ruleDraftExams[1]?.name || ''}
                        onChange={(e) => handleRuleExamNameChange(1, e.target.value)}
                        placeholder="tusaale: Imtixaanka Kama-dambaysta ah (Final)"
                        className="form-input"
                        style={{ fontWeight: 600, fontSize: '0.92rem' }}
                      />
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#0f766e', fontWeight: 600 }}>
                      Baasidda: 30/60 (50%) — Wuxuu ku xiran yahay imtixaanka 1-aad
                    </div>
                  </div>
                </div>

                {/* Connected Total Banner */}
                <div style={{ background: '#f0fdf4', border: '1px dashed #22c55e', borderRadius: '10px', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: '#166534' }}>
                    <ShieldCheck size={18} color="#166534" />
                    <span><strong>Xeerka Isku-xirka:</strong> Labada imtixaan way isku xiran yihiin, wadartooda guud ee maaddaduna waa <strong>40 + 60 = 100 dhibcood</strong>.</span>
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: 900, color: '#166534' }}>
                    Wadarta Maaddada: 100 dh
                  </span>
                </div>

                {/* Action Buttons: Save or Cancel */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  {examPeriods.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsEditingRule(false)}
                      className="btn btn-secondary"
                    >
                      Ka Noqo (Cancel)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveSchemeRule}
                    disabled={ruleSaving}
                    className="btn btn-primary"
                    style={{ minWidth: '180px' }}
                  >
                    <Check size={16} />
                    <span>{ruleSaving ? 'Kaydinayaa...' : 'Kaydi Xeerka Imtixaanka'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: '22px', borderLeft: '4px solid #0f766e', background: 'linear-gradient(to right, #f0fdfa, #ffffff)' }}>
              <div className="card-body" style={{ padding: '22px 26px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Award size={16} />
                      Xeerka Rasmiga ah ee Imtixaanaadka (2 Imtixaan: 40/60) — Sannadka {academicYear}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '6px 0 4px' }}>
                      Nidaamka Qiimeynta ee {ruleDraftExams[0]?.name || 'Midterm'} (40) iyo {ruleDraftExams[1]?.name || 'Final'} (60)
                    </h3>
                    <p style={{ color: '#475569', fontSize: '0.865rem', margin: 0, maxWidth: '820px' }}>
                      Fasal kasta wuxuu leeyahay <strong>2 imtixaan oo kaliya oo isku xiran</strong>: 40 dhibcood imtixaanka 1-aad iyo 60 dhibcood imtixaanka kama-dambaysta ah = <strong>100 dhibcood</strong> guud.
                    </p>
                  </div>

                  {/* Edit Exam Names Button */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingRule(true)}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                    >
                      <Edit2 size={15} />
                      <span>Wax Ka Beddel Magacyada Imtixaanaadka</span>
                    </button>
                  </div>
                </div>

                {/* 3 Metric Breakdown Cards */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
                  {/* Exam 1 Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 18px', minWidth: '170px', flex: '1 1 180px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      1. {ruleDraftExams[0]?.name || 'Imtixaanka Niska (Midterm)'}
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>
                      40 <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>dhibcood</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 600 }}>
                      Baasidda: 20/40 (50%)
                    </div>
                  </div>

                  {/* Exam 2 Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #99f6e4', borderRadius: '12px', padding: '14px 18px', minWidth: '170px', flex: '1 1 180px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      2. {ruleDraftExams[1]?.name || 'Kama-Dambays (Final)'}
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: '4px 0 2px' }}>
                      60 <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>dhibcood</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#0f766e', fontWeight: 600 }}>
                      Baasidda: 30/60 (50%)
                    </div>
                  </div>

                  {/* Combined Subject Total Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '14px 18px', minWidth: '170px', flex: '1 1 180px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Wadarta Maaddada (Connected)
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f766e', margin: '4px 0 2px' }}>
                      100 <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>dhibcood</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#0f766e', fontWeight: 700 }}>
                      Baasidda: 50/100 (50%)
                    </div>
                  </div>
                </div>

                {/* Dynamic Clarification Callout Box */}
                <div style={{ marginTop: '16px', padding: '12px 18px', background: '#ffffff', border: '1px dashed #0d9488', borderRadius: '10px', fontSize: '0.84rem', color: '#334155', lineHeight: 1.55 }}>
                  <strong style={{ color: '#0f766e' }}>📝 Xeerka Isku-xirka Labada Imtixaan:</strong> Ma jiro imtixaan kale oo dheeraad ah. Labadan imtixaan way isku xiran yihiin. Haddii ardaygu imtixaanka 1-aad ({ruleDraftExams[0]?.name || 'Midterm'}) ku helo <strong>19/40</strong> (oo uu ku dhaco xilligaas), balse imtixaanka kama-dambaysta ah ({ruleDraftExams[1]?.name || 'Final'}) uu ku helo <strong>31/60</strong>, wadarta maaddadu waa <strong>19 + 31 = 50 dhibcood</strong> (100-kii) — ardayguse maaddadaas guud ahaan wuu <strong>baasay</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Card 2: Overall Promotion & Pass Rule (300/600 rule) */}
          <div className="card" style={{ marginBottom: '22px' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#0f766e" />
                  Xeerka Baasidda Guud & Dallacsiinta Fasalka ({academicYear})
                </h3>
                <p className="card-subtitle">
                  Qeex boqolkiiba inta ugu yar ee ardaygu ku baasayo guud ahaan sannadkan.
                </p>
              </div>
            </div>

            <div className="card-body">
              <form onSubmit={handleSaveAssessmentConfig}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: '24px', alignItems: 'center' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Heerka Baasidda Guud ee Fasalka (%)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={assessmentConfig.pass_threshold}
                        onChange={(e) => setAssessmentConfig({ ...assessmentConfig, pass_threshold: parseFloat(e.target.value) || 50 })}
                        className="form-input"
                        style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}
                      />
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#64748b' }}>%</span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '6px', display: 'block' }}>
                      Heerka caadiga ah ee machadka waa <strong>50%</strong>.
                    </span>
                  </div>

                  {/* Informative illustration card: 300 / 600 rule */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', fontSize: '0.84rem', color: '#334155' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={15} color="#0f766e" />
                      Tusaalaha Xeerka Dallacsiinta (Tusaale 6 Maaddood):
                    </div>
                    <p style={{ margin: '0 0 6px', color: '#475569' }}>
                      Haddii ardaygu galo <strong>6 maaddo</strong>, wadarta guud ee dhibcuhu waa <strong>600 dhibcood</strong>.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 12px', color: '#166534', fontWeight: 600, fontSize: '0.8rem' }}>
                        ✅ <strong>300 ama ka badan (≥50%):</strong> Wuu baasay oo toos ayuu u dallacayaa fasalka xiga (xataa haddii uu dhowr maaddo ku dhacay).
                      </div>
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 12px', color: '#991b1b', fontWeight: 600, fontSize: '0.8rem' }}>
                        ❌ <strong>299 ama ka yar (&lt;50%):</strong> Wuu dhacay waxaana lagu reebayaa isla fasalkiisa.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button type="submit" disabled={configSaving} className="btn btn-primary">
                    <Check size={16} />
                    <span>{configSaving ? 'Kaydinayaa...' : 'Kaydi Xeerka Baasidda'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Card 3: Registered Planned Examinations */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  Liiska Imtixaanaadka Qorshaysan ee Sannadka ({academicYear})
                </h3>
                <p className="card-subtitle">
                  Diiwaangeli dhammaan imtixaanaadka sannadka ka hor inta aysan bilaaban.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {examPeriods.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllPeriods}
                    disabled={deleteAllSaving}
                    className="btn btn-secondary btn-sm"
                    style={{ borderColor: '#fca5a5', color: '#b91c1c', fontWeight: 700 }}
                    title={`Tirtir dhammaan ${examPeriods.length} imtixaan ee sannadka ${academicYear}`}
                  >
                    <Trash2 size={15} />
                    <span>{deleteAllSaving ? 'Tirtirayaa...' : `Tirtir Dhammaan Imtixaanaadka (${examPeriods.length})`}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSetupStandardScheme}
                  disabled={standardSetupSaving}
                  className="btn btn-secondary btn-sm"
                  style={{ borderColor: '#0d9488', color: '#0f766e', fontWeight: 700 }}
                  title="Deji Midterm (40) iyo Final (60) oo toos ah"
                >
                  <Award size={15} />
                  <span>{standardSetupSaving ? 'Dejinayaa...' : 'Deji Qaabka Rasmiga ah (40 / 60)'}</span>
                </button>

                <button type="button" onClick={handleOpenCreatePeriod} className="btn btn-primary btn-sm">
                  <Plus size={15} />
                  <span>Ku Dar Imtixaan Cusub</span>
                </button>
              </div>
            </div>

            <div className="table-container">
              {periodsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#0d9488' }} />
                  <p style={{ fontSize: '0.85rem' }}>Soo qaadaya liiska imtixaanaadka...</p>
                </div>
              ) : examPeriods.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <Award size={36} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                  <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Wax imtixaan ah lama diiwaangelin sannadkan.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center' }}>Tartan</th>
                      <th>Magaca Imtixaanka</th>
                      <th>Nooca (Category)</th>
                      <th style={{ textAlign: 'center' }}>
                        Dhibcaha Ugu Sarreeya (Max Marks)
                      </th>
                      <th>Taariikhaha</th>
                      <th style={{ textAlign: 'center' }}>Xaaladda</th>
                      <th style={{ textAlign: 'right' }}>Ficillada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examPeriods.map((p) => (
                      <tr key={p.id}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                          {p.sequence_order || '—'}
                        </td>
                        <td>
                          <strong>{p.name}</strong>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontSize: '0.82rem', color: '#475569' }}>
                          {p.exam_type || 'Monthly'}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#0f766e' }}>
                          {p.max_contribution ? `${p.max_contribution}` : '100'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                          {p.start_date ? p.start_date.split('T')[0] : '—'} ilaa {p.end_date ? p.end_date.split('T')[0] : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-info'}`}>
                            {p.status || 'Active'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPeriod(p)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '5px 8px' }}
                              title="Wax ka beddel"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePeriod(p.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '5px 8px', color: '#dc2626', borderColor: '#fecaca' }}
                              title="Tirtir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CONFIGURABLE EXAMINATION TIMETABLES               */}
      {/* ======================================================== */}
      {activeTab === 'timetables' && (
        <div>
          {/* Timetable Selection Toolbar */}
          <div className="card no-print" style={{ marginBottom: '20px' }}>
            <div className="card-body" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '220px' }}>
                  <label className="form-label">Dooro Imtixaanka (Examination)</label>
                  <select
                    value={timetableExam}
                    onChange={(e) => setTimetableExam(e.target.value)}
                    className="form-select"
                  >
                    {examPeriods.length === 0 ? (
                      <option value="">-- Ma jiraan imtixaanno --</option>
                    ) : (
                      examPeriods.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
                  <label className="form-label">Dooro Fasalka (Class)</label>
                  <select
                    value={timetableClassId}
                    onChange={(e) => setTimetableClassId(e.target.value)}
                    className="form-select"
                  >
                    {classes.length === 0 ? (
                      <option value="">-- Ma jiraan fasallo --</option>
                    ) : (
                      classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name || c.class_name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowTimetableModal(true)}
                    className="btn btn-primary"
                  >
                    <Plus size={16} />
                    <span>Ku Dar Maaddo Jadwalka</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-secondary"
                  >
                    <Printer size={16} />
                    <span>Daabac Jadwalka</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Formal Printable Timetable Card */}
          <div className="card printable-timetable-sheet">
            <div style={{ padding: '36px 32px' }}>
              {/* Document Header - Class Name displayed prominently above timetable */}
              <div style={{ textAlign: 'center', paddingBottom: '24px', marginBottom: '24px', borderBottom: '2px solid #0f172a' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <img
                    src="/branding/tafsiir-institute-logo.jpeg"
                    alt="Tafsiir Institute logo"
                    style={{ display: 'block', width: 'min(100%, 300px)', maxHeight: '70px', objectFit: 'contain' }}
                  />
                  <div>
                    <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'var(--font-arabic)' }}>
                      معهد التفسير للعلوم الشرعية والعربية
                    </h2>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '2px 0 0' }}>
                      Jadwalka Rasmiga ah ee Imtixaanaadka (Examination Timetable)
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: '14px', display: 'inline-block', background: '#f8fafc', padding: '10px 24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {timetableExam} — {academicYear}
                  </h3>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f766e', marginTop: '2px' }}>
                    Fasalka (Class): {timetableData?.class_info?.name || classes.find(c => String(c.id) === String(timetableClassId))?.name || 'Class'}
                  </div>
                </div>
              </div>

              {/* Timetable Table: Grouped by day, each day one row with horizontal subject/time pairs */}
              <div className="table-container">
                {timetableLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#0d9488' }} />
                    <p style={{ fontSize: '0.85rem' }}>Soo qaadaya jadwalka...</p>
                  </div>
                ) : Object.keys(groupedTimetableByDay).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <Calendar size={36} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Jadwal looma diyaarin fasalkan weli.</p>
                  </div>
                ) : (
                  <table className="data-table" style={{ border: '1px solid #cbd5e1' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                        <th style={{ background: '#0f172a', color: '#ffffff', width: '160px', textAlign: 'center', borderRight: '1px solid #334155' }}>
                          Maalinta (Day)
                        </th>
                        {Array.from({ length: maxSubjectsInDay }).map((_, idx) => (
                          <th key={idx} colSpan={2} style={{ background: '#0f172a', color: '#ffffff', textAlign: 'center', borderRight: '1px solid #334155' }}>
                            Maaddada {idx + 1} & Waqtiga (Subject {idx + 1} & Time)
                          </th>
                        ))}
                        <th className="no-print" style={{ background: '#0f172a', color: '#ffffff', width: '80px', textAlign: 'center' }}>
                          Tirtir
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedTimetableByDay).map(([day, entries], rowIdx) => (
                        <tr key={day} style={{ background: rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a', borderRight: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <div>{day}</div>
                            {entries[0]?.exam_date && (
                              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
                                {entries[0].exam_date.split('T')[0]}
                              </div>
                            )}
                          </td>

                          {/* Horizontal Subject/Time pairs */}
                          {Array.from({ length: maxSubjectsInDay }).map((_, colIdx) => {
                            const item = entries[colIdx];
                            return (
                              <td key={colIdx} colSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0', padding: '12px' }}>
                                {item ? (
                                  <div>
                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.98rem' }}>
                                      {item.subject_name}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f766e', marginTop: '3px', display: 'inline-block', background: '#ccfbf1', padding: '2px 8px', borderRadius: '4px' }}>
                                      {item.start_time?.slice(0, 5)} – {item.end_time?.slice(0, 5)}
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: '#cbd5e1' }}>—</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Actions - Hidden in Print */}
                          <td className="no-print" style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                              {entries.map(e => (
                                <button
                                  key={e.id}
                                  type="button"
                                  onClick={() => handleDeleteTimetableEntry(e.id)}
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px' }}
                                  title={`Tirtir ${e.subject_name}`}
                                >
                                  <Trash2 size={14} color="#dc2626" />
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Document Signatures Footer */}
              <div style={{ marginTop: '48px', paddingTop: '28px', borderTop: '1px solid #cbd5e1', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px', textAlign: 'center', fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                <div>
                  <div style={{ marginBottom: '32px', color: '#64748b' }}>Guddiga Imtixaanaadka</div>
                  <div style={{ borderTop: '1px solid #94a3b8', width: '180px', margin: '0 auto', paddingTop: '4px' }}>Saxiixa & Taariikhda</div>
                </div>
                <div>
                  <div style={{ marginBottom: '32px', color: '#64748b' }}>Maamulaha Machadka</div>
                  <div style={{ borderTop: '1px solid #94a3b8', width: '180px', margin: '0 auto', paddingTop: '4px' }}>Saxiixa & Shaabadda</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ======================================================== */}
      {/* MODAL 1: REGISTER / EDIT EXAM PERIOD                     */}
      {/* ======================================================== */}
      {showPeriodModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
                {periodModalMode === 'create' ? 'Diiwaangeli Imtixaan Cusub' : 'Wax ka beddel Imtixaanka'}
              </h3>
              <button
                type="button"
                onClick={() => setShowPeriodModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePeriod}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    Magaca Imtixaanka (e.g. First Monthly, Midterm, Final)
                  </label>
                  <input
                    type="text"
                    required
                    value={periodForm.name}
                    onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                    placeholder="Geli magaca..."
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Nooca Imtixaanka</label>
                    <select
                      value={periodForm.exam_type}
                      onChange={(e) => setPeriodForm({ ...periodForm, exam_type: e.target.value })}
                      className="form-select"
                    >
                      <option value="monthly">Monthly Exam</option>
                      <option value="term">Term / Midterm</option>
                      <option value="final">Final Exam</option>
                      <option value="special">Special Assessment</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tartanka (Sequence)</label>
                    <input
                      type="number"
                      min="1"
                      value={periodForm.sequence_order}
                      onChange={(e) => setPeriodForm({ ...periodForm, sequence_order: parseInt(e.target.value, 10) || 1 })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Dhibcaha Ugu Sarreeya ee Imtixaankan (Max Marks)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={periodForm.max_contribution}
                      onChange={(e) => setPeriodForm({ ...periodForm, max_contribution: parseFloat(e.target.value) || 40 })}
                      className="form-input"
                      style={{ fontWeight: 700 }}
                    />
                    <button
                      type="button"
                      onClick={() => setPeriodForm({ ...periodForm, max_contribution: 40, name: periodForm.name || 'Midterm (Imtixaanka Niska)', exam_type: 'midterm' })}
                      className="btn btn-secondary btn-sm"
                      style={{ whiteSpace: 'nowrap', fontSize: '0.76rem' }}
                    >
                      Midterm (40)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodForm({ ...periodForm, max_contribution: 60, name: periodForm.name || 'Final (Imtixaanka Kama-dambaysta ah)', exam_type: 'final' })}
                      className="btn btn-secondary btn-sm"
                      style={{ whiteSpace: 'nowrap', fontSize: '0.76rem' }}
                    >
                      Final (60)
                    </button>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Nidaamka rasmiga ah: Midterm = 40 dhibcood, Final = 60 dhibcood (Wadarta maaddadu waa 100).
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Bilaabashada</label>
                    <input
                      type="date"
                      value={periodForm.start_date}
                      onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dhammaadka</label>
                    <input
                      type="date"
                      value={periodForm.end_date}
                      onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowPeriodModal(false)}
                  className="btn btn-secondary"
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  disabled={periodSaving}
                  className="btn btn-primary"
                >
                  {periodSaving ? 'Kaydinayaa...' : 'Kaydi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADD TIMETABLE ENTRY (SUBJECT RESTRICTION)       */}
      {/* ======================================================== */}
      {showTimetableModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="card-title" style={{ fontSize: '1.1rem' }}>
                Ku Dar Maaddo Jadwalka Imtixaanka
              </h3>
              <button
                type="button"
                onClick={() => setShowTimetableModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTimetableEntry}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Maaddada (Strictly assigned to class)</label>
                  <select
                    required
                    value={entryForm.subject_id}
                    onChange={(e) => setEntryForm({ ...entryForm, subject_id: e.target.value })}
                    className="form-select"
                  >
                    <option value="">-- Dooro Maaddo --</option>
                    {classAssignedSubjects.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    Maaddooyinka waxaa laga soo qaadayaa kuwa fasalkan loo xilsaaray oo keliya.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Maalinta (Day of the Week)</label>
                  <select
                    value={entryForm.day_of_week}
                    onChange={(e) => setEntryForm({ ...entryForm, day_of_week: e.target.value })}
                    className="form-select"
                  >
                    <option value="Sabti (Saturday)">Sabti (Saturday)</option>
                    <option value="Axad (Sunday)">Axad (Sunday)</option>
                    <option value="Isniin (Monday)">Isniin (Monday)</option>
                    <option value="Talaado (Tuesday)">Talaado (Tuesday)</option>
                    <option value="Arbaco (Wednesday)">Arbaco (Wednesday)</option>
                    <option value="Khamiis (Thursday)">Khamiis (Thursday)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Taariikhda (Exam Date)</label>
                  <input
                    type="date"
                    value={entryForm.exam_date}
                    onChange={(e) => setEntryForm({ ...entryForm, exam_date: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Waqtiga Bilaabashada</label>
                    <input
                      type="time"
                      value={entryForm.start_time}
                      onChange={(e) => setEntryForm({ ...entryForm, start_time: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Waqtiga Dhammaadka</label>
                    <input
                      type="time"
                      value={entryForm.end_time}
                      onChange={(e) => setEntryForm({ ...entryForm, end_time: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowTimetableModal(false)}
                  className="btn btn-secondary"
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  disabled={entrySaving}
                  className="btn btn-primary"
                >
                  {entrySaving ? 'Kaydinayaa...' : 'Kaydi Maaddada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
