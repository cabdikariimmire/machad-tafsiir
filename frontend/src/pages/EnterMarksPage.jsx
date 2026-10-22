import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FileSpreadsheet, Award, Printer, Download, Search, RefreshCw,
  CheckCircle, AlertCircle, Clock, Eye, ArrowLeft, User, Check, X,
  AlertTriangle, BookOpen, Layers, GraduationCap
} from 'lucide-react';

export default function EnterMarksPage() {
  const { user, isSuperAdmin, isInstituteAdmin, isExamOfficer } = useAuth();

  // Mode: 'entry' (Enter Marks) | 'preview' (Result Preview)
  const [viewMode, setViewMode] = useState('entry');

  // Filters & Selectors
  const [academicYear, setAcademicYear] = useState('2026');
  const [examPeriods, setExamPeriods] = useState([]);
  const [examSet, setExamSet] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('all'); // 'all' or specific subject_id

  // Assessment Config for selected academic year
  const [assessmentConfig, setAssessmentConfig] = useState(null);

  // Sheet Data
  const [loading, setLoading] = useState(false);
  const [sheetData, setSheetData] = useState(null); // { class_info, subjects, students }
  const [marksState, setMarksState] = useState({}); // { `${studentId}_${subjectId}`: { marks: '', is_absent: false } }
  const [cellStatus, setCellStatus] = useState({}); // { `${studentId}_${subjectId}`: 'saving' | 'saved' | 'error' | null }
  const [cellErrors, setCellErrors] = useState({}); // { `${studentId}_${subjectId}`: 'Error message' }
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });


  function showMessage(type, message) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
  }

  // 1. Initial Load: Exam Periods, Classes, Assessment Config
  useEffect(() => {
    loadInitialData();
  }, [academicYear]);

  async function loadInitialData() {
    try {
      const [periodsRes, classesRes, configRes, setRes] = await Promise.all([
        api.getExamPeriods({ academic_year: academicYear }),
        api.getClasses({ academic_year: academicYear }),
        api.getAssessmentConfig({ academic_year: academicYear }),
        api.getExamSets({ academic_year: academicYear })
      ]);

      if (periodsRes.success) {
        const pList = periodsRes.data || [];
        setExamPeriods(pList);
        if (pList.length > 0) {
          setSelectedPeriod(prev => (prev && pList.some(p => p.name === prev)) ? prev : pList[0].name);
        }
      }

      if (classesRes.success) {
        const cList = classesRes.data || [];
        setClasses(cList);
        if (cList.length > 0) {
          setSelectedClassId(prev => (prev && cList.some(c => String(c.id) === String(prev))) ? prev : cList[0].id);
        }
      }

      if (configRes.success && configRes.data) {
        setAssessmentConfig(configRes.data);
      }
      if (setRes.success) {
        setExamSet(setRes.data || null);
        if (setRes.data?.members?.length) {
          setPreviewPeriod('final_combined');
        }
      }
    } catch (err) {
      console.error('Failed to load initial exam data:', err);
      showMessage('error', 'Cilad ayaa dhacday markii la soo qaadayay xogta imtixaanaadka.');
    }
  }

  // 2. Fetch Marks Sheet when Class or Period changes
  const fetchMarksSheet = useCallback(async () => {
    if (!selectedClassId || !selectedPeriod) return;
    setLoading(true);
    try {
      const res = await api.getUnifiedClassMarksSheet({
        class_id: selectedClassId,
        exam_period: selectedPeriod,
        academic_year: academicYear
      });

      if (res.success && res.data) {
        setSheetData(res.data);

        // Build marks state map
        const initialMarks = {};
        const students = res.data.students || [];
        const subjects = res.data.subjects || [];

        students.forEach(student => {
          subjects.forEach(subject => {
            const key = `${student.id}_${subject.id}`;
            const existing = student.marks?.[subject.id];
            initialMarks[key] = {
              marks: existing?.marks !== null && existing?.marks !== undefined ? String(existing.marks) : '',
              is_absent: Boolean(existing?.is_absent)
            };
          });
        });

        setMarksState(initialMarks);
        setCellStatus({});
        setCellErrors({});
      }
    } catch (err) {
      console.error('Error fetching marks sheet:', err);
      showMessage('error', err.message || 'Lama soo kicin karo xaashida dhibcaha.');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedPeriod, academicYear]);

  useEffect(() => {
    if (viewMode === 'entry') {
      fetchMarksSheet();
    }
  }, [fetchMarksSheet, viewMode]);

  // 3. Automatic Single Mark Saving (per cell)
  const triggerAutoSave = (studentId, subjectId, marksVal, isAbsentVal) => {
    const cellKey = `${studentId}_${subjectId}`;

    if (saveTimersRef.current[cellKey]) {
      clearTimeout(saveTimersRef.current[cellKey]);
    }

    setCellStatus(prev => ({ ...prev, [cellKey]: 'saving' }));
    setCellErrors(prev => ({ ...prev, [cellKey]: null }));

    saveTimersRef.current[cellKey] = setTimeout(async () => {
      try {
        const payload = {
          class_id: selectedClassId,
          exam_period: selectedPeriod,
          subject_id: subjectId,
          student_id: studentId,
          academic_year: academicYear,
          marks_obtained: isAbsentVal ? null : (marksVal === '' ? null : parseFloat(marksVal)),
          is_absent: Boolean(isAbsentVal)
        };

        const res = await api.saveSingleMark(payload);
        if (res.success) {
          setCellStatus(prev => ({ ...prev, [cellKey]: 'saved' }));
          
          if (res.data) {
            setSheetData(prev => {
              if (!prev) return prev;
              const updatedStudents = prev.students.map(s => {
                if (s.id === studentId) {
                  return {
                    ...s,
                    total_marks: res.data.student_total,
                    average_percentage: res.data.student_average,
                    is_provisional: res.data.is_provisional
                  };
                }
                return s;
              });
              return { ...prev, students: updatedStudents };
            });
          }

          setTimeout(() => {
            setCellStatus(prev => {
              if (prev[cellKey] === 'saved') {
                return { ...prev, [cellKey]: null };
              }
              return prev;
            });
          }, 3000);
        } else {
          setCellStatus(prev => ({ ...prev, [cellKey]: 'error' }));
          setCellErrors(prev => ({ ...prev, [cellKey]: res.error || 'Kaydinta waa fashilantay' }));
        }
      } catch (err) {
        setCellStatus(prev => ({ ...prev, [cellKey]: 'error' }));
        setCellErrors(prev => ({ ...prev, [cellKey]: err.message || 'Cilad xiriir' }));
      }
    }, 400);
  };

  const handleMarkChange = (studentId, subjectId, value) => {
    const cellKey = `${studentId}_${subjectId}`;
    setMarksState(prev => ({
      ...prev,
      [cellKey]: {
        marks: value,
        is_absent: false
      }
    }));
    triggerAutoSave(studentId, subjectId, value, false);
  };

  const handleToggleAbsent = (studentId, subjectId) => {
    const cellKey = `${studentId}_${subjectId}`;
    const current = marksState[cellKey] || { marks: '', is_absent: false };
    const nextAbsent = !current.is_absent;

    setMarksState(prev => ({
      ...prev,
      [cellKey]: {
        marks: nextAbsent ? '' : current.marks,
        is_absent: nextAbsent
      }
    }));

    triggerAutoSave(studentId, subjectId, nextAbsent ? '' : current.marks, nextAbsent);
  };

  // Result Preview Data & Selection
  const [previewPeriod, setPreviewPeriod] = useState('final_combined');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Debounce timers ref
  const saveTimersRef = useRef({});

  const getExamMax = (periodName) => {
    const found = examPeriods.find(p => p.name === periodName);
    return found?.max_contribution || 100;
  };

  const maxContribution = getExamMax(selectedPeriod);

  // 4. Fetch Result Preview
  const loadResultPreview = async (periodToView) => {
    if (!selectedClassId) return;
    const targetPeriod = periodToView || previewPeriod || 'final_combined';
    setPreviewLoading(true);
    setViewMode('preview');
    try {
      const configuredMemberId = targetPeriod.startsWith('configured_midterm:')
        ? targetPeriod.split(':')[1]
        : null;
      const res = await api.getClassResults({
        class_id: selectedClassId,
        academic_year: academicYear,
        exam_title: configuredMemberId ? 'configured_midterm' : targetPeriod,
        exam_period_id: configuredMemberId || undefined,
        exam_set_id: examSet?.id || undefined
      });
      if (res.success && res.data) {
        setPreviewData(res.data);
      } else {
        showMessage('error', 'Lama soo kicin karo natiijada fasalka.');
      }
    } catch (err) {
      console.error('Error loading result preview:', err);
      showMessage('error', err.message || 'Cilad ayaa dhacday markii la soo saarayay natiijada.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewPeriodChange = (newPeriod) => {
    setPreviewPeriod(newPeriod);
    loadResultPreview(newPeriod);
  };

  const [promotingLoading, setPromotingLoading] = useState(false);

  const handleProcessAutomaticPromotion = async () => {
    const currentClass = classes.find(c => String(c.id) === String(selectedClassId));
    if (!currentClass) return;

    const confirmMsg = currentClass.is_final_class
      ? `Ma hubtaa inaad fuliso qalin-jabinta ardayda baastay ee fasalka "${currentClass.name}"? Kuwa dhacay waxay ku sii jiraan fasalka.`
      : `Ma hubtaa inaad ardayda baastay ee fasalka "${currentClass.name}" u dallacsiiso fasalka xiga ("${currentClass.next_class_name || 'Fasalka Xiga'}")? Kuwa dhacay waxay ku sii jiraan fasalka.`;

    if (!window.confirm(confirmMsg)) return;

    setPromotingLoading(true);
    try {
      const targetYear = String(parseInt(academicYear, 10) + 1);
      const res = await api.executePromotions({
        class_id: selectedClassId,
        from_academic_year: academicYear,
        to_academic_year: targetYear,
        auto_confirm: true
      });

      if (res.success) {
        showMessage('success', `Dallacsiinta tooska ah waa la fuliyay! (${res.data?.promoted || 0} loo dallacsiiyay fasalka xiga, ${res.data?.graduated || 0} qalin-jabiyay, ${res.data?.retained || 0} ku haray fasalka).`);
        await loadInitialData();
        await loadResultPreview(previewPeriod);
      } else {
        showMessage('error', res.error || 'Fulinta dallacsiinta waa fashilantay.');
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday markii la fulinayay dallacsiinta.');
    } finally {
      setPromotingLoading(false);
    }
  };

  const printConfiguredResult = async (selection) => {
    await loadResultPreview(selection);
    window.setTimeout(() => window.print(), 250);
  };

  const visibleSubjects = sheetData?.subjects?.filter(sub => {
    if (selectedSubjectId === 'all') return true;
    return String(sub.id) === String(selectedSubjectId);
  }) || [];

  const filteredStudents = sheetData?.students?.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.student_id?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    );
  }) || [];

  // Exclude students with no saved marks, order descending by total obtained
  const previewStudents = (previewData?.students || [])
    .filter(s => previewData?.is_configured_result || s.has_saved_marks !== false)
    .sort((a, b) => (parseFloat(b.total_obtained) || 0) - (parseFloat(a.total_obtained) || 0));

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
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

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }} className="no-print">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(13, 148, 136, 0.08)', borderRadius: '9999px', color: '#0f766e', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
            <Award size={14} />
            <span>Xafiiska Imtixaanaadka — Configurable Examination System</span>
          </div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
            {viewMode === 'entry' ? 'Gelinta Dhibcaha Imtixaanka (Enter Marks)' : 'Dib-u-eegista Natiijada (Result Preview)'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.865rem', marginTop: '4px' }}>
            {viewMode === 'entry'
              ? 'Dhibcaha si toos ah ayaa loo kaydiyaa (Auto-save). Maximum marks-ka wuxuu ka imanayaa examination set-ka la dejiyay.'
              : 'Warqad natiijo rasmi ah oo diyaar u ah daabacaad (Print) iyo soo dejin Excel ah.'}
          </p>
        </div>

        {/* Action Button: Result Preview Toggle */}
        <div>
          {viewMode === 'preview' ? (
            <button
              type="button"
              onClick={() => setViewMode('entry')}
              className="btn btn-secondary"
              style={{ fontWeight: 700 }}
            >
              <ArrowLeft size={16} />
              <span>Ku Noqo Gelinta Dhibcaha</span>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {examSet?.members?.length > 0 && (
                <>
                  <button type="button" onClick={() => printConfiguredResult(`configured_midterm:${examSet.members[0].exam_period_id}`)} disabled={!selectedClassId} className="btn btn-secondary" style={{ fontWeight: 700 }}>
                    <Printer size={16} /><span>Print Midterm Results</span>
                  </button>
                  <button type="button" onClick={() => printConfiguredResult('final_combined')} disabled={!selectedClassId} className="btn btn-primary" style={{ fontWeight: 700 }}>
                    <Printer size={16} /><span>Print Final Results</span>
                  </button>
                </>
              )}
              <button type="button" onClick={() => loadResultPreview(previewPeriod)} disabled={!selectedClassId} className="btn btn-secondary" style={{ fontWeight: 700 }}>
                <Eye size={17} /><span>Result Preview</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Selection Bar */}
      <div className="card no-print" style={{ marginBottom: '22px' }}>
        <div className="card-body" style={{ padding: '18px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
            {/* Academic Year */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Sannad-Dugsiyeedka</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="form-select"
                style={{ fontWeight: 600 }}
              >
                <option value="2026">2026–2027</option>
                <option value="2025">2025–2026</option>
                <option value="2024">2024–2025</option>
              </select>
            </div>

            {/* Exam Period or Preview Selector */}
            {viewMode === 'entry' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Imtixaanka la Geliyo (Exam Period)</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="form-select"
                  style={{ fontWeight: 700, color: '#0f766e' }}
                >
                  {examPeriods.length === 0 ? (
                    <option value="">-- Ma jiraan imtixaanno --</option>
                  ) : (
                    examPeriods.map(p => (
                      <option key={p.id} value={p.name}>
                        {p.name} (Max: {getExamMax(p.name)})
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Natiijada la Eegayo (Result to Preview)</label>
                <select
                  value={previewPeriod}
                  onChange={(e) => handlePreviewPeriodChange(e.target.value)}
                  className="form-select"
                  style={{ fontWeight: 700, color: '#0f766e' }}
                >
                  {examSet?.members?.length ? (
                    <optgroup label="Configured Results">
                      <option value="final_combined">Final Combined Results (Wadarta Set-ka)</option>
                      {examSet.members.map(member => (
                        <option key={member.exam_period_id} value={`configured_midterm:${member.exam_period_id}`}>
                          {member.exam_name} (Max: {member.maximum_marks})
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <optgroup label="Legacy Results">
                      <option value="all">Dhammaan Imtixaanaadka (Full Year Sheet)</option>
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {/* Class Selection */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fasalka (Class)</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="form-select"
                style={{ fontWeight: 600 }}
              >
                {classes.length === 0 ? (
                  <option value="">-- Ma jiraan fasallo --</option>
                ) : (
                  classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.class_name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Subject Filter (in Entry mode) OR Export Buttons (in Preview mode) */}
            {viewMode === 'entry' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Maaddada (Subject Filter)</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="form-select"
                  style={{ fontWeight: 600 }}
                >
                  <option value="all">Dhammaan Maaddooyinka (Matrix Sheet)</option>
                  {sheetData?.subjects?.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center', fontWeight: 700 }}
                >
                  <Printer size={16} />
                  <span>{previewData?.is_midterm_result ? 'Print Midterm Results' : 'Print Final Results'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => api.downloadClassResultsExcel({
                    class_id: selectedClassId,
                    academic_year: academicYear,
                    exam_title: previewPeriod
                  })}
                  className="btn btn-secondary"
                  title="Soo deji Excel"
                  style={{ fontWeight: 700 }}
                >
                  <Download size={16} />
                  <span>Excel</span>
                </button>
              </div>
            )}
          </div>

          {/* Assessment Scheme Badge & Auto-Save Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: 700, color: '#475569' }}>Qaabka Qiimeynta:</span>
              <span className="badge" style={{ backgroundColor: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', fontSize: '0.78rem', fontWeight: 700 }}>
                {examSet?.members?.length
                  ? `${examSet.members.map(member => `${member.exam_name} (${member.maximum_marks})`).join(' + ')} = ${examSet.members.reduce((sum, member) => sum + Number(member.maximum_marks || 0), 0)}`
                  : 'Midterm (40) + Final (60) = 100'}
              </span>
              <span className="badge" style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontSize: '0.78rem' }}>
                Heerka Baasidda: {assessmentConfig?.pass_threshold || 50}%
              </span>
            </div>

            {viewMode === 'entry' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }}></span>
                <span>Auto-save waa shaqeynayaa (Waqti-xaadirka)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: ENTER MARKS GRID (Auto-Saving Sheet)             */}
      {/* ======================================================== */}
      {viewMode === 'entry' && (
        <div className="card">
          {/* Table Header Controls */}
          <div className="card-header" style={{ background: '#f8fafc', padding: '14px 20px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Raadi magaca, ID-ga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '36px', height: '36px', fontSize: '0.84rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.82rem', color: '#64748b' }}>
              <span>Ardayda fasalka: <strong style={{ color: '#0f172a' }}>{filteredStudents.length}</strong></span>
              <span>Maaddooyinka: <strong style={{ color: '#0f172a' }}>{visibleSubjects.length}</strong></span>
              <button
                type="button"
                onClick={fetchMarksSheet}
                className="btn btn-secondary btn-sm"
                title="Dib u cusboonaysii"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Marks Table Container */}
          <div className="table-container">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 8px', color: '#0d9488' }} />
                <p style={{ fontSize: '0.88rem' }}>Soo qaadaya xaashida dhibcaha...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                <User size={36} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Arday kuma qorna fasalkan ama ma jiro arday buuxiya shuruudaha.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                    <th style={{ minWidth: '220px' }}>Ardayga (Student Name)</th>
                    {visibleSubjects.map(sub => (
                      <th key={sub.id} style={{ textAlign: 'center', minWidth: '150px' }}>
                        <div>{sub.name}</div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8', textTransform: 'none' }}>
                          (Max: {sub.maximum_marks || maxContribution})
                        </div>
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', width: '110px', background: '#f1f5f9' }}>Wadarta</th>
                    <th style={{ textAlign: 'center', width: '110px', background: '#f1f5f9' }}>Celcelis</th>
                    <th style={{ textAlign: 'center', width: '130px', background: '#f1f5f9' }}>Xaaladda</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, idx) => (
                    <tr key={student.id}>
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                        {idx + 1}
                      </td>
                      <td>
                        <strong>{student.full_name}</strong>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontFamily: 'monospace' }}>{student.student_id}</div>
                      </td>

                      {/* Subject Mark Inputs */}
                      {visibleSubjects.map(sub => {
                        const cellKey = `${student.id}_${sub.id}`;
                        const current = marksState[cellKey] || { marks: '', is_absent: false };
                        const status = cellStatus[cellKey];
                        const err = cellErrors[cellKey];

                        return (
                          <td key={sub.id} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '10px 8px' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={sub.maximum_marks || maxContribution}
                                  disabled={current.is_absent}
                                  placeholder={current.is_absent ? 'ABS' : `0 - ${sub.maximum_marks || maxContribution}`}
                                  value={current.is_absent ? '' : current.marks}
                                  onChange={(e) => handleMarkChange(student.id, sub.id, e.target.value)}
                                  className={`marks-cell-input ${current.is_absent ? 'absent' : ''} ${err ? 'has-error' : ''}`}
                                />

                                {/* ABS Button */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleAbsent(student.id, sub.id)}
                                  className={`marks-abs-btn ${current.is_absent ? 'active' : ''}`}
                                  title="Geli Maqnaansho (ABS)"
                                >
                                  ABS
                                </button>
                              </div>

                              {/* Auto-Save Indicator */}
                              <div style={{ height: '14px', fontSize: '0.68rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                {status === 'saving' && (
                                  <span style={{ color: '#0d9488', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <Clock size={10} className="animate-spin" /> Kaydinayaa...
                                  </span>
                                )}
                                {status === 'saved' && (
                                  <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <Check size={10} /> Saved
                                  </span>
                                )}
                                {status === 'error' && (
                                  <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '2px' }} title={err}>
                                    <AlertTriangle size={10} /> {err?.slice(0, 15)}...
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}

                      {/* Student Live Calculated Total & Average */}
                      <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a', background: 'rgba(241, 245, 249, 0.4)' }}>
                        {student.total_marks !== null && student.total_marks !== undefined ? student.total_marks : '—'}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a', background: 'rgba(241, 245, 249, 0.4)' }}>
                        {student.average_percentage !== null && student.average_percentage !== undefined ? `${student.average_percentage}%` : '—'}
                      </td>
                      <td style={{ textAlign: 'center', background: 'rgba(241, 245, 249, 0.4)' }}>
                        {student.is_provisional ? (
                          <span className="badge badge-warning">Provisional (KMG)</span>
                        ) : student.average_percentage >= (assessmentConfig?.pass_threshold || 50) ? (
                          <span className="badge badge-success">Baasay</span>
                        ) : (
                          <span className="badge badge-danger">Dhacay</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: FORMAL PRINTABLE RESULT PREVIEW (Landscape Sheet) */}
      {/* ======================================================== */}
      {viewMode === 'preview' && (
        <div>
          {previewLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 12px', color: '#0d9488' }} />
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#334155' }}>Diyaarinayaa Natiijada Fasalka...</p>
            </div>
          ) : (
            <div className="card printable-result-sheet">
              <div style={{ padding: '36px 32px' }}>
                {/* Document Formal Header - Class name above result table as required */}
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
                        Ma'had Al-Tafsiir Li Al-Culuum Al-Sharciyyah Wal-Carabiyyah
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '14px', display: 'inline-block', background: '#f8fafc', padding: '10px 24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {previewData?.exam_title || previewPeriod} — {academicYear}
                    </h3>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f766e', marginTop: '2px' }}>
                      Fasalka (Class): {previewData?.class_info?.name || sheetData?.class_info?.name || classes.find(c => String(c.id) === String(selectedClassId))?.name || 'Class'}
                    </div>
                  </div>
                </div>

                {/* Automatic Class Promotion Banner */}
                {(() => {
                  const currentClass = classes.find(c => String(c.id) === String(selectedClassId));
                  const passThreshold = assessmentConfig?.pass_threshold || 50;
                  const passedStudents = previewStudents.filter(s => !s.is_provisional && (parseFloat(s.average_percentage) || 0) >= passThreshold);
                  const failedStudents = previewStudents.filter(s => !s.is_provisional && (parseFloat(s.average_percentage) || 0) < passThreshold);

                  return currentClass ? (
                    <div className="no-print" style={{
                      marginBottom: '24px',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      backgroundColor: '#f0fdfa',
                      border: '1px solid #99f6e4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '14px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontWeight: 800, fontSize: '0.95rem' }}>
                          <GraduationCap size={20} />
                          <span>Dallacsiinta Tooska ah ee Fasalka (Automatic Class Promotion)</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#334155' }}>
                          {currentClass.is_final_class ? (
                            <>Fasalkan waa kan ugu dambeeya <strong>({currentClass.name})</strong>. Ardayda imtixaanka baasta ({passedStudents.length}) waxay toos u <strong>qalin-jabinayaan (Graduated)</strong>, kuwa dhacayna ({failedStudents.length}) fasalkooda ayey ku harayaan.</>
                          ) : (
                            <>Fasalka: <strong>{currentClass.name}</strong> → Fasalka xiga: <strong>{currentClass.next_class_name || 'Heerka xiga'}</strong>. Ardayda baasta ({passedStudents.length}) waxay toos ugu <strong>gudbayaan fasalka xiga</strong>, kuwa dhacayna ({failedStudents.length}) fasalka ayey ku harayaan.</>
                          )}
                        </p>
                      </div>

                      {(isSuperAdmin || isInstituteAdmin || isExamOfficer) && (
                        <button
                          type="button"
                          onClick={handleProcessAutomaticPromotion}
                          disabled={promotingLoading || passedStudents.length === 0}
                          className="btn btn-primary"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 700,
                            padding: '9px 18px'
                          }}
                        >
                          <Check size={16} />
                          <span>{promotingLoading ? 'Fuliyayaa...' : currentClass.is_final_class ? 'Fuli Qalin-jabinta Tooska ah' : 'Fuli Dallacsiinta Tooska ah'}</span>
                        </button>
                      )}
                    </div>
                  ) : null;
                })()}

                {/* Printable Results Grid */}
                {previewStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Wax dhibco ah oo la kaydiyay lagama helin fasalkan.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table" style={{ border: '1px solid #cbd5e1' }}>
                      <thead>
                        <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                          <th style={{ background: '#0f172a', color: '#ffffff', width: '45px', textAlign: 'center', borderRight: '1px solid #334155' }}>#</th>
                          <th style={{ background: '#0f172a', color: '#ffffff', minWidth: '220px', borderRight: '1px solid #334155' }}>Magaca Ardayga (Student Name)</th>

                          {/* Column Headers: Configured Result vs Legacy View */}
                          {previewData?.is_configured_result ? (
                            (previewData?.distinct_subjects || previewData?.subjects || []).map(sub => (
                              <th key={sub.id} style={{ background: '#0f172a', color: '#ffffff', textAlign: 'center', minWidth: '130px', borderRight: '1px solid #334155' }}>
                                <div>{sub.name}</div>
                                <div style={{ fontSize: '0.72rem', color: '#5eead4', fontWeight: 700 }}>Max: {sub.maximum_marks}</div>
                              </th>
                            ))
                          ) : (previewData?.is_first_half || previewData?.is_second_half) ? (
                            (previewData?.distinct_subjects || previewData?.subjects || []).map(sub => (
                              <th key={sub.id} style={{ background: '#0f172a', color: '#ffffff', textAlign: 'center', minWidth: '130px', borderRight: '1px solid #334155' }}>
                                <div>{sub.name}</div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 400, opacity: 0.85 }}>
                                  {previewData?.is_first_half ? 'Combined half result' : 'Combined half result'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#5eead4', fontWeight: 700 }}>Max: {sub.maximum_marks || 100}</div>
                              </th>
                            ))
                          ) : (
                            (previewData?.exams || []).map(ex => (
                              <th key={ex.exam_id} style={{ background: '#0f172a', color: '#ffffff', textAlign: 'center', minWidth: '110px', borderRight: '1px solid #334155' }}>
                                <div>{ex.subject_name}</div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 400, opacity: 0.75 }}>
                                  {ex.title} (Max: {ex.maximum_marks || 100})
                                </div>
                              </th>
                            ))
                          )}

                          <th style={{ background: '#090e1a', color: '#ffffff', textAlign: 'center', width: '90px', borderRight: '1px solid #334155' }}>Wadarta</th>
                          <th style={{ background: '#090e1a', color: '#ffffff', textAlign: 'center', width: '90px', borderRight: '1px solid #334155' }}>Celcelis</th>
                          <th style={{ background: '#090e1a', color: '#ffffff', textAlign: 'center', width: '130px' }}>Xaaladda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewStudents.map((st, idx) => (
                          <tr key={st.student_id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ textAlign: 'center', color: '#94a3b8', borderRight: '1px solid #e2e8f0' }}>{idx + 1}</td>
                            <td style={{ borderRight: '1px solid #e2e8f0' }}>
                              <strong>{st.student_name}</strong>
                              <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontFamily: 'monospace' }}>{st.student_code}</div>
                            </td>

                            {/* Marks Display: Configured Result vs Legacy View */}
                            {previewData?.is_configured_result ? (
                              (previewData?.distinct_subjects || previewData?.subjects || []).map(sub => {
                                const result = st.subject_results?.[sub.id];
                                const value = result?.combined_total;
                                const isAbsent = result?.status === 'completed' && Object.values(result?.components || {}).every(component => component.status === 'absent');
                                return (
                                  <td key={sub.id} style={{ textAlign: 'center', borderRight: '1px solid #e2e8f0', padding: '8px' }}>
                                    {isAbsent ? <span style={{ color: '#dc2626', fontWeight: 700 }}>ABS</span> : value !== null && value !== undefined ? <span style={{ fontWeight: 800, color: value < (Number(sub.maximum_marks || 0) * 0.5) ? '#dc2626' : '#0f172a' }}>{value}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                                  </td>
                                );
                              })
                            ) : (previewData?.is_first_half || previewData?.is_second_half) ? (
                              (previewData?.distinct_subjects || previewData?.subjects || []).map(sub => {
                                const sh = st.subject_halves?.[sub.id];
                                const halfTotal = previewData?.is_first_half ? sh?.h1_total : sh?.h2_total;
                                const midMark = previewData?.is_first_half ? sh?.h1_mid : sh?.h2_mid;
                                const finMark = previewData?.is_first_half ? sh?.h1_final : sh?.h2_final;
                                const isProv = (previewData?.is_first_half ? sh?.h1_status : sh?.h2_status) === 'provisional';
                                const isAbsent = midMark === 'ABS' && finMark === 'ABS';

                                return (
                                  <td key={sub.id} style={{ textAlign: 'center', borderRight: '1px solid #e2e8f0', padding: '8px' }}>
                                    {isAbsent ? (
                                      <span style={{ color: '#dc2626', fontWeight: 700 }}>ABS</span>
                                    ) : halfTotal !== null && halfTotal !== undefined ? (
                                      <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: halfTotal < 50 ? '#dc2626' : '#0f172a' }}>
                                          {halfTotal}
                                          {isProv && <span style={{ fontSize: '0.68rem', color: '#d97706', marginLeft: '3px' }}>(KMG)</span>}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                          ({midMark} + {finMark})
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ color: '#cbd5e1', fontWeight: 400 }}>—</span>
                                    )}
                                  </td>
                                );
                              })
                            ) : (
                              (previewData?.exams || []).map(ex => {
                                const sm = st.subject_marks?.[ex.exam_id];
                                const isMissing = !sm || sm.marks_obtained === null || sm.obtained === null;
                                const isAbs = sm?.is_absent || sm?.status === 'absent';
                                const val = sm?.marks_obtained !== undefined ? sm?.marks_obtained : sm?.obtained;

                                return (
                                  <td key={ex.exam_id} style={{ textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e2e8f0' }}>
                                    {isAbs ? (
                                      <span style={{ color: '#dc2626' }}>ABS</span>
                                    ) : isMissing || val === null || val === undefined ? (
                                      <span style={{ color: '#cbd5e1', fontWeight: 400 }}>—</span>
                                    ) : (
                                      <span style={{ color: val < (ex.maximum_marks * 0.5) ? '#dc2626' : '#0f172a' }}>
                                        {val}
                                      </span>
                                    )}
                                  </td>
                                );
                              })
                            )}

                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a', background: 'rgba(241, 245, 249, 0.5)', borderRight: '1px solid #e2e8f0' }}>
                              {st.total_obtained !== null && st.total_obtained !== undefined ? st.total_obtained : '—'}
                            </td>

                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a', background: 'rgba(241, 245, 249, 0.5)', borderRight: '1px solid #e2e8f0' }}>
                              {st.average_percentage !== null && st.average_percentage !== undefined ? `${st.average_percentage}%` : '—'}
                            </td>

                            <td style={{ textAlign: 'center' }}>
                              {(() => {
                                const currentClass = classes.find(c => String(c.id) === String(selectedClassId));
                                const passThreshold = assessmentConfig?.pass_threshold || 50;
                                const isPassed = (parseFloat(st.average_percentage) || 0) >= passThreshold;
                                if (st.is_provisional) {
                                  return <span className="badge badge-warning">Provisional (KMG)</span>;
                                }
                                if (isPassed) {
                                  if (currentClass?.is_final_class) {
                                    return <span className="badge badge-purple" style={{ fontSize: '0.74rem' }}>🎓 Qalin-jabin</span>;
                                  }
                                  return (
                                    <span className="badge badge-success" style={{ fontSize: '0.74rem' }}>
                                      Baasay → {currentClass?.next_class_name || 'Xiga'}
                                    </span>
                                  );
                                }
                                return <span className="badge badge-danger" style={{ fontSize: '0.74rem' }}>Dhacay (Ku haray)</span>;
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Document Signatures Footer */}
                <div style={{ marginTop: '48px', paddingTop: '28px', borderTop: '1px solid #cbd5e1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', textAlign: 'center', fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                  <div>
                    <div style={{ marginBottom: '32px', color: '#64748b' }}>Macallinka Fasalka</div>
                    <div style={{ borderTop: '1px solid #94a3b8', width: '160px', margin: '0 auto', paddingTop: '4px' }}>Saxiixa & Taariikhda</div>
                  </div>
                  <div>
                    <div style={{ marginBottom: '32px', color: '#64748b' }}>Xafiiska Imtixaanaadka</div>
                    <div style={{ borderTop: '1px solid #94a3b8', width: '160px', margin: '0 auto', paddingTop: '4px' }}>Saxiixa & Shaabadda</div>
                  </div>
                  <div>
                    <div style={{ marginBottom: '32px', color: '#64748b' }}>Maamulaha Guud</div>
                    <div style={{ borderTop: '1px solid #94a3b8', width: '160px', margin: '0 auto', paddingTop: '4px' }}>Saxiixa & Oggolaanshaha</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
