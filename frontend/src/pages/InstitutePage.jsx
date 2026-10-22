import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  BookOpen, Plus, Calendar, Clock, Edit2, Trash2, X, Search,
  CheckCircle, AlertCircle, Layers, ToggleLeft, ToggleRight,
  Filter, Check, HelpCircle
} from 'lucide-react';

export default function InstitutePage() {
  const { isSuperAdmin, isInstituteAdmin } = useAuth();
  const canManage = isSuperAdmin || isInstituteAdmin;

  // Exactly 3 main tabs: Classes, Subjects, Timetable
  const [activeTab, setActiveTab] = useState('classes'); // 'classes' | 'subjects' | 'timetable'

  // Data states
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter states
  const [classSearch, setClassSearch] = useState('');
  const [classStatusFilter, setClassStatusFilter] = useState('all');

  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectStatusFilter, setSubjectStatusFilter] = useState('all');

  const [ttClassFilter, setTtClassFilter] = useState('all');
  const [ttDayFilter, setTtDayFilter] = useState('all');

  // Alerts & Notifications
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Modals state
  const [modalType, setModalType] = useState(''); // 'create_class' | 'edit_class' | 'create_subject' | 'edit_subject' | 'manage_subjects' | 'create_timetable' | 'edit_timetable'
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Selected item for edit or manage
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTimetable, setSelectedTimetable] = useState(null);

  // Class Form fields
  const [className, setClassName] = useState('');
  const [academicYear, setAcademicYear] = useState('2026');
  const [classSection, setClassSection] = useState('Qaybta A');
  const [classDescription, setClassDescription] = useState('');
  const [classCourseId, setClassCourseId] = useState('');
  const [classProgressionOrder, setClassProgressionOrder] = useState(1);
  const [classIsFinal, setClassIsFinal] = useState(false);
  const [classNextClassId, setClassNextClassId] = useState('');

  // Subject Form fields
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [subjectCourseId, setSubjectCourseId] = useState('');

  // Class-Subject Assignment state
  const [classAssignedSubjects, setClassAssignedSubjects] = useState([]);
  const [classAvailableSubjects, setClassAvailableSubjects] = useState([]);
  const [selectedSubjectsToAdd, setSelectedSubjectsToAdd] = useState([]);

  // Timetable Form fields
  const [ttClassId, setTtClassId] = useState('');
  const [ttSubjectId, setTtSubjectId] = useState('');
  const [ttClassSubjectsList, setTtClassSubjectsList] = useState([]);
  const [ttDay, setTtDay] = useState('Saturday');
  const [ttStart, setTtStart] = useState('08:00');
  const [ttEnd, setTtEnd] = useState('09:30');
  const [ttRoom, setTtRoom] = useState('Qolka 1');
  const [ttNotes, setTtNotes] = useState('');

  // Days list (all 7 weekdays)
  const DAYS_LIST = [
    { key: 'Saturday', label: 'Sabti (Saturday)' },
    { key: 'Sunday', label: 'Axad (Sunday)' },
    { key: 'Monday', label: 'Isniin (Monday)' },
    { key: 'Tuesday', label: 'Talaado (Tuesday)' },
    { key: 'Wednesday', label: 'Arbaco (Wednesday)' },
    { key: 'Thursday', label: 'Khamiis (Thursday)' },
    { key: 'Friday', label: 'Jimce (Friday)' }
  ];

  useEffect(() => {
    loadAllData();
  }, []);

  function showMessage(type, message) {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 5000);
  }

  async function loadAllData() {
    try {
      setLoading(true);
      const [clsRes, subRes, ttRes, crsRes] = await Promise.all([
        api.getClasses(),
        api.getSubjects(),
        api.getTimetable(),
        api.getCourses().catch(() => ({ success: false, data: [] }))
      ]);

      if (clsRes.success) setClasses(clsRes.data || []);
      if (subRes.success) setSubjects(subRes.data || []);
      if (ttRes.success) setTimetable(ttRes.data || []);
      if (crsRes.success) setCourses(crsRes.data || []);
    } catch (e) {
      console.error('Failed to load institute data:', e);
      showMessage('error', 'Khalad ayaa dhacay markii la soo gelinayay xogta.');
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // CLASSES ACTIONS
  // ==========================================
  function openCreateClassModal() {
    setClassName('');
    setAcademicYear('2026');
    setClassSection('Qaybta A');
    setClassDescription('');
    setClassCourseId('');
    const maxOrder = classes.reduce((max, c) => Math.max(max, Number(c.progression_order) || 0), 0);
    setClassProgressionOrder(maxOrder + 1);
    setClassIsFinal(false);
    setClassNextClassId('');
    setModalError('');
    setModalType('create_class');
  }

  function openEditClassModal(cls) {
    setSelectedClass(cls);
    setClassName(cls.name || cls.class_name);
    setAcademicYear(cls.academic_year || '2026');
    setClassSection(cls.section || '');
    setClassDescription(cls.description || '');
    setClassCourseId(cls.course_id || '');
    setClassProgressionOrder(cls.progression_order || 1);
    setClassIsFinal(Boolean(cls.is_final_class));
    setClassNextClassId(cls.next_class_id ? String(cls.next_class_id) : '');
    setModalError('');
    setModalType('edit_class');
  }

  async function handleSaveClass(e) {
    e.preventDefault();
    if (!className.trim()) {
      setModalError('Magaca fasalka waa qasab.');
      return;
    }
    if (!academicYear.trim()) {
      setModalError('Sannadka waxbarashada waa qasab.');
      return;
    }

    try {
      setModalLoading(true);
      setModalError('');

      if (modalType === 'create_class') {
        const res = await api.createClass({
          class_name: className.trim(),
          academic_year: academicYear.trim(),
          section: classSection.trim() || null,
          description: classDescription.trim() || null,
          course_id: classCourseId || null,
          progression_order: Number(classProgressionOrder) || 1,
          is_final_class: Boolean(classIsFinal),
          next_class_id: classIsFinal ? null : (classNextClassId ? Number(classNextClassId) : null)
        });
        if (res.success) {
          showMessage('success', res.message || 'Fasalka cusub si guul leh ayaa loo abuuray.');
          setModalType('');
          loadAllData();
        }
      } else {
        const res = await api.updateClass(selectedClass.id, {
          class_name: className.trim(),
          academic_year: academicYear.trim(),
          section: classSection.trim() || null,
          description: classDescription.trim() || null,
          course_id: classCourseId || null,
          progression_order: Number(classProgressionOrder) || 1,
          is_final_class: Boolean(classIsFinal),
          next_class_id: classIsFinal ? null : (classNextClassId ? Number(classNextClassId) : null)
        });
        if (res.success) {
          showMessage('success', res.message || 'Fasalka waa la cusboonaysiiyay.');
          setModalType('');
          loadAllData();
        }
      }
    } catch (err) {
      setModalError(err.message || 'Khalad ayaa dhacay.');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleToggleClassStatus(cls) {
    const confirmMsg = cls.is_active === 1
      ? `Ma hubtaa inaad xidho (deactivate) fasalka "${cls.name}"? Ardayda iyo xogtiisu ma lumi doonaan.`
      : `Ma hubtaa inaad hawlgeliso (activate) fasalka "${cls.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.toggleClassStatus(cls.id);
      if (res.success) {
        showMessage('success', res.message);
        loadAllData();
      }
    } catch (err) {
      showMessage('error', err.message || 'Failed to update class status.');
    }
  }

  // ==========================================
  // SUBJECTS ACTIONS
  // ==========================================
  function openCreateSubjectModal() {
    setSubjectName('');
    setSubjectCode('');
    setSubjectDescription('');
    setSubjectCourseId('');
    setModalError('');
    setModalType('create_subject');
  }

  function openEditSubjectModal(sub) {
    setSelectedSubject(sub);
    setSubjectName(sub.name || sub.subject_name);
    setSubjectCode(sub.code || sub.subject_code || '');
    setSubjectDescription(sub.description || '');
    setSubjectCourseId(sub.course_id || '');
    setModalError('');
    setModalType('edit_subject');
  }

  async function handleSaveSubject(e) {
    e.preventDefault();
    if (!subjectName.trim()) {
      setModalError('Magaca maaddada waa qasab.');
      return;
    }

    try {
      setModalLoading(true);
      setModalError('');

      if (modalType === 'create_subject') {
        const res = await api.createSubject({
          subject_name: subjectName.trim(),
          subject_code: subjectCode.trim() || undefined,
          description: subjectDescription.trim() || null,
          course_id: subjectCourseId || null
        });
        if (res.success) {
          showMessage('success', res.message || 'Maaddada cusub si guul leh ayaa loo diiwaangeliyay.');
          setModalType('');
          loadAllData();
        }
      } else {
        const res = await api.updateSubject(selectedSubject.id, {
          subject_name: subjectName.trim(),
          subject_code: subjectCode.trim() || undefined,
          description: subjectDescription.trim() || null,
          course_id: subjectCourseId || null
        });
        if (res.success) {
          showMessage('success', res.message || 'Maaddada waa la cusboonaysiiyay.');
          setModalType('');
          loadAllData();
        }
      }
    } catch (err) {
      setModalError(err.message || 'Khalad ayaa dhacay.');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleToggleSubjectStatus(sub) {
    const confirmMsg = sub.is_active === 1
      ? `Ma hubtaa inaad xidho (deactivate) maaddada "${sub.name}"? Diiwaannada hore ma lumi doonaan.`
      : `Ma hubtaa inaad hawlgeliso (activate) maaddada "${sub.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.toggleSubjectStatus(sub.id);
      if (res.success) {
        showMessage('success', res.message);
        loadAllData();
      }
    } catch (err) {
      showMessage('error', err.message || 'Failed to update subject status.');
    }
  }

  // ==========================================
  // MANAGE CLASS SUBJECTS (JUNCTION)
  // ==========================================
  async function openManageClassSubjects(cls) {
    setSelectedClass(cls);
    setModalError('');
    setSelectedSubjectsToAdd([]);
    setModalType('manage_subjects');
    await loadClassSubjectsData(cls.id);
  }

  async function loadClassSubjectsData(classId) {
    try {
      setModalLoading(true);
      const res = await api.getClassSubjects(classId);
      if (res.success) {
        setClassAssignedSubjects(res.data || []);
        setClassAvailableSubjects(res.available || []);
      }
    } catch (err) {
      setModalError('Lama soo kicin karo maaddooyinka fasalka: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  }

  async function handleAssignSubjectsToClass(e) {
    e.preventDefault();
    if (selectedSubjectsToAdd.length === 0) {
      setModalError('Fadlan dooro ugu yaraan hal maaddo oo lagu daro fasalka.');
      return;
    }

    try {
      setModalLoading(true);
      setModalError('');
      const res = await api.assignClassSubjects(selectedClass.id, {
        subject_ids: selectedSubjectsToAdd
      });
      if (res.success) {
        showMessage('success', res.message || 'Maaddooyinka waa lagu daray fasalka.');
        setSelectedSubjectsToAdd([]);
        await loadClassSubjectsData(selectedClass.id);
        loadAllData();
      }
    } catch (err) {
      setModalError(err.message || 'Khalad ayaa dhacay xilsaarka maaddooyinka.');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleRemoveClassSubject(subjectId, subjectName) {
    if (!window.confirm(`Ma hubtaa inaad maaddada "${subjectName}" ka saarto fasalka "${selectedClass.name}"?`)) return;

    try {
      setModalLoading(true);
      setModalError('');
      const res = await api.removeClassSubject(selectedClass.id, subjectId);
      if (res.success) {
        showMessage('success', res.message || 'Maaddada waa laga saaray fasalka.');
        await loadClassSubjectsData(selectedClass.id);
        loadAllData();
      }
    } catch (err) {
      setModalError(err.message || 'Lama saari karo maaddada fasalka.');
    } finally {
      setModalLoading(false);
    }
  }

  // ==========================================
  // TIMETABLE ACTIONS
  // ==========================================
  async function openCreateTimetableModal() {
    setModalError('');
    const initialClassId = classes[0]?.id ? String(classes[0].id) : '';
    setTtClassId(initialClassId);
    setTtSubjectId('');
    setTtDay('Saturday');
    setTtStart('08:00');
    setTtEnd('09:30');
    setTtRoom('Qolka 1');
    setTtNotes('');
    setModalType('create_timetable');

    if (initialClassId) {
      await loadTimetableSubjectsForClass(initialClassId);
    } else {
      setTtClassSubjectsList([]);
    }
  }

  async function openEditTimetableModal(item) {
    setSelectedTimetable(item);
    setModalError('');
    setTtClassId(String(item.class_id));
    setTtDay(item.day_of_week);
    setTtStart(item.start_time.slice(0, 5));
    setTtEnd(item.end_time.slice(0, 5));
    setTtRoom(item.room || '');
    setTtNotes(item.notes || '');
    setModalType('edit_timetable');

    await loadTimetableSubjectsForClass(item.class_id, item.subject_id);
  }

  async function loadTimetableSubjectsForClass(classId, preserveSubjectId = '') {
    try {
      const res = await api.getClassSubjects(classId);
      if (res.success) {
        const assigned = res.data || [];
        setTtClassSubjectsList(assigned);
        if (preserveSubjectId && assigned.some(s => String(s.id) === String(preserveSubjectId))) {
          setTtSubjectId(String(preserveSubjectId));
        } else if (assigned.length > 0) {
          setTtSubjectId(String(assigned[0].id));
        } else {
          setTtSubjectId('');
        }
      }
    } catch (e) {
      console.error(e);
      setTtClassSubjectsList([]);
      setTtSubjectId('');
    }
  }

  async function handleTimetableClassChange(newClassId) {
    setTtClassId(newClassId);
    setTtSubjectId('');
    if (newClassId) {
      await loadTimetableSubjectsForClass(newClassId);
    } else {
      setTtClassSubjectsList([]);
    }
  }

  async function handleSaveTimetable(e) {
    e.preventDefault();
    if (!ttClassId) {
      setModalError('Fadlan dooro fasalka.');
      return;
    }
    if (!ttSubjectId) {
      setModalError('Fadlan dooro maaddada. Fasalkan waa in marka hore maaddooyin loo xilsaaraa.');
      return;
    }
    if (!ttDay) {
      setModalError('Fadlan dooro maalinta.');
      return;
    }
    if (ttEnd <= ttStart) {
      setModalError(`Saacadda dhamaadku (${ttEnd}) waa inay ka dambaysaa saacadda bilaabashada (${ttStart}).`);
      return;
    }

    try {
      setModalLoading(true);
      setModalError('');

      if (modalType === 'create_timetable') {
        const res = await api.createTimetable({
          class_id: ttClassId,
          subject_id: ttSubjectId,
          day_of_week: ttDay,
          start_time: ttStart,
          end_time: ttEnd,
          room: ttRoom.trim() || null,
          notes: ttNotes.trim() || null
        });
        if (res.success) {
          showMessage('success', res.message || 'Darsiga jadwalka si guul leh ayaa loo kaydiyay.');
          setModalType('');
          loadAllData();
        }
      } else {
        const res = await api.updateTimetable(selectedTimetable.id, {
          class_id: ttClassId,
          subject_id: ttSubjectId,
          day_of_week: ttDay,
          start_time: ttStart,
          end_time: ttEnd,
          room: ttRoom.trim() || null,
          notes: ttNotes.trim() || null
        });
        if (res.success) {
          showMessage('success', res.message || 'Darsiga jadwalka waa la cusboonaysiiyay.');
          setModalType('');
          loadAllData();
        }
      }
    } catch (err) {
      setModalError(err.message || 'Khalad ayaa dhacay kaydinta jadwalka.');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDeleteTimetable(item) {
    if (!window.confirm(`Ma hubtaa inaad jadwalka ka saarto darsiga "${item.subject_name}" ee fasalka "${item.class_name}" (${item.day_of_week})?`)) return;

    try {
      const res = await api.deleteTimetable(item.id);
      if (res.success) {
        showMessage('success', res.message || 'Darsiga waa laga saaray jadwalka.');
        loadAllData();
      }
    } catch (err) {
      showMessage('error', err.message || 'Lama saari karo darsiga jadwalka.');
    }
  }

  // ==========================================
  // FILTERED DATA
  // ==========================================
  const filteredClasses = classes.filter(c => {
    const matchSearch = (c.name || '').toLowerCase().includes(classSearch.toLowerCase()) ||
      (c.academic_year || '').toLowerCase().includes(classSearch.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(classSearch.toLowerCase());
    const matchStatus = classStatusFilter === 'all' ||
      (classStatusFilter === 'active' && c.is_active === 1) ||
      (classStatusFilter === 'inactive' && c.is_active === 0);
    return matchSearch && matchStatus;
  });

  const filteredSubjects = subjects.filter(s => {
    const matchSearch = (s.name || '').toLowerCase().includes(subjectSearch.toLowerCase()) ||
      (s.code || '').toLowerCase().includes(subjectSearch.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(subjectSearch.toLowerCase());
    const matchStatus = subjectStatusFilter === 'all' ||
      (subjectStatusFilter === 'active' && s.is_active === 1) ||
      (subjectStatusFilter === 'inactive' && s.is_active === 0);
    return matchSearch && matchStatus;
  });

  const filteredTimetable = timetable.filter(t => {
    const matchClass = ttClassFilter === 'all' || String(t.class_id) === String(ttClassFilter);
    const matchDay = ttDayFilter === 'all' || t.day_of_week === ttDayFilter;
    return matchClass && matchDay;
  });

  return (
    <div className="container mx-auto px-4 py-4" style={{ maxWidth: '1280px' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={24} color="#0f766e" />
            Waaxda Waxbarashada Machadka (Academic Module)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '4px' }}>
            Maamulka dhammaystiran ee Fasallada, Maaddooyinka guud, Xilsaarka Maaddooyinka, iyo Jadwalka Toddobaadlaha ah
          </p>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {activeTab === 'classes' && (
              <button className="btn btn-primary btn-sm" onClick={openCreateClassModal}>
                <Plus size={15} /> Fasal Cusub
              </button>
            )}
            {activeTab === 'subjects' && (
              <button className="btn btn-primary btn-sm" onClick={openCreateSubjectModal}>
                <Plus size={15} /> Maaddo Cusub
              </button>
            )}
            {activeTab === 'timetable' && (
              <button className="btn btn-primary btn-sm" onClick={openCreateTimetableModal}>
                <Plus size={15} /> Darsi Jadwalka
              </button>
            )}
          </div>
        )}
      </div>

      {/* Global Feedback Banner */}
      {feedback.message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: feedback.type === 'success' ? '#166534' : '#991b1b',
          fontSize: '0.9rem'
        }}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Primary 3 Tabs (Classes, Subjects, Timetable ONLY) */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '20px',
        backgroundColor: '#f8fafc',
        padding: '6px 8px 0',
        borderRadius: '8px 8px 0 0'
      }}>
        {[
          { id: 'classes', label: '1. Fasallada (Classes)', count: classes.length },
          { id: 'subjects', label: '2. Maaddooyinka (Subjects)', count: subjects.length },
          { id: 'timetable', label: '3. Jadwalka (Timetable)', count: timetable.length }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: activeTab === tab.id ? '#ffffff' : 'transparent',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.9rem',
              color: activeTab === tab.id ? '#0f766e' : '#64748b',
              borderBottom: activeTab === tab.id ? '3px solid #0f766e' : '3px solid transparent',
              borderRadius: activeTab === tab.id ? '6px 6px 0 0' : '0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === tab.id ? '0 -1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span>{tab.label}</span>
            <span style={{
              fontSize: '0.75rem',
              padding: '2px 7px',
              borderRadius: '10px',
              backgroundColor: activeTab === tab.id ? '#ccfbf1' : '#e2e8f0',
              color: activeTab === tab.id ? '#0f766e' : '#475569'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ======================================================================== */}
      {/* TAB 1: CLASSES MANAGEMENT                                                */}
      {/* ======================================================================== */}
      {activeTab === 'classes' && (
        <div className="card">
          {/* Search & Filters */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '260px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                  placeholder="Raadi fasal ama sannad..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                />
              </div>
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={classStatusFilter}
                onChange={(e) => setClassStatusFilter(e.target.value)}
              >
                <option value="all">Dhammaan Xaaladaha</option>
                <option value="active">Active Kaliya</option>
                <option value="inactive">Inactive Kaliya</option>
              </select>
            </div>

            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Wadarta: <strong>{filteredClasses.length}</strong> fasal
            </span>
          </div>

          {/* Classes Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Magaca Fasalka</th>
                  <th>Sannadka</th>
                  <th>Qaybta</th>
                  <th>Heerka & Dallacsiinta</th>
                  <th>Maaddooyinka U Qoran</th>
                  <th>Ardayda Ku Qoran</th>
                  <th>Faahfaahin</th>
                  <th>Xaaladda</th>
                  <th style={{ textAlign: 'right' }}>Hawlaha</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '24px' }}>Waa la soo kicinayaa xogta...</td></tr>
                ) : filteredClasses.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Wax fasal ah lama helin.</td></tr>
                ) : (
                  filteredClasses.map(c => (
                    <tr key={c.id}>
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{c.name}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>{c.academic_year}</span>
                      </td>
                      <td>{c.section || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: c.is_final_class ? '#f5f3ff' : '#f1f5f9',
                            color: c.is_final_class ? '#6d28d9' : '#0f766e',
                            border: `1px solid ${c.is_final_class ? '#ddd6fe' : '#ccfbf1'}`
                          }}>
                            Level {c.progression_order || 1}
                          </span>
                          {c.is_final_class ? (
                            <span className="badge badge-purple" style={{ fontSize: '0.72rem' }}>🎓 Final (Qalin-jabin)</span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                              → {c.next_class_name || 'Auto Next'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => openManageClassSubjects(c)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#f0fdfa',
                            border: '1px solid #99f6e4',
                            color: '#0f766e',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Guji si aad u maamusho maaddooyinka fasalka"
                        >
                          <Layers size={13} />
                          <span>{c.subjects_count || 0} maaddo</span>
                        </button>
                      </td>
                      <td>
                        <span className="badge badge-info">{c.student_count || 0} arday</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.description || '-'}</span>
                      </td>
                      <td>
                        <span className={`badge ${c.is_active === 1 ? 'badge-success' : 'badge-danger'}`}>
                          {c.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px' }}
                            onClick={() => openManageClassSubjects(c)}
                            title="Maamul Maaddooyinka Fasalka"
                          >
                            <Layers size={13} /> Maaddooyinka
                          </button>
                          {canManage && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px' }}
                                onClick={() => openEditClassModal(c)}
                                title="Wax ka beddel fasalka"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                className={`btn btn-sm ${c.is_active === 1 ? 'btn-secondary' : 'btn-primary'}`}
                                style={{ padding: '4px 8px' }}
                                onClick={() => handleToggleClassStatus(c)}
                                title={c.is_active === 1 ? 'Xidh fasalka (Deactivate)' : 'Hawlgeli fasalka (Activate)'}
                              >
                                {c.is_active === 1 ? <ToggleRight size={15} color="#0f766e" /> : <ToggleLeft size={15} />}
                              </button>
                            </>
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

      {/* ======================================================================== */}
      {/* TAB 2: SUBJECTS MANAGEMENT (Centrally Registered)                        */}
      {/* ======================================================================== */}
      {activeTab === 'subjects' && (
        <div className="card">
          {/* Search & Filters */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '260px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                  placeholder="Raadi koodh ama magac maaddo..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                />
              </div>
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.85rem' }}
                value={subjectStatusFilter}
                onChange={(e) => setSubjectStatusFilter(e.target.value)}
              >
                <option value="all">Dhammaan Xaaladaha</option>
                <option value="active">Active Kaliya</option>
                <option value="inactive">Inactive Kaliya</option>
              </select>
            </div>

            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Wadarta: <strong>{filteredSubjects.length}</strong> maaddo
            </span>
          </div>

          {/* Subjects Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Koodhka Maaddada</th>
                  <th>Magaca Maaddada</th>
                  <th>Fasallada ay ka tirsan tahay</th>
                  <th>Faahfaahin</th>
                  <th>Xaaladda</th>
                  <th style={{ textAlign: 'right' }}>Hawlaha</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>Waa la soo kicinayaa xogta...</td></tr>
                ) : filteredSubjects.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Wax maaddo ah lama helin.</td></tr>
                ) : (
                  filteredSubjects.map(s => (
                    <tr key={s.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: '#0f766e', fontFamily: 'monospace' }}>
                          {s.code}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{s.name}</strong>
                      </td>
                      <td>
                        <span className="badge badge-info">{s.classes_count || 0} fasal</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{s.description || '-'}</span>
                      </td>
                      <td>
                        <span className={`badge ${s.is_active === 1 ? 'badge-success' : 'badge-danger'}`}>
                          {s.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {canManage && (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px' }}
                              onClick={() => openEditSubjectModal(s)}
                              title="Wax ka beddel maaddada"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className={`btn btn-sm ${s.is_active === 1 ? 'btn-secondary' : 'btn-primary'}`}
                              style={{ padding: '4px 8px' }}
                              onClick={() => handleToggleSubjectStatus(s)}
                              title={s.is_active === 1 ? 'Xidh maaddada (Deactivate)' : 'Hawlgeli maaddada (Activate)'}
                            >
                              {s.is_active === 1 ? <ToggleRight size={15} color="#0f766e" /> : <ToggleLeft size={15} />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* TAB 3: TIMETABLE MANAGEMENT (Weekly Schedule, Overlap Detection)         */}
      {/* ======================================================================== */}
      {activeTab === 'timetable' && (
        <div className="card">
          {/* Header info & filters */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Class Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Fasalka:</span>
                <select
                  className="form-select"
                  style={{ width: 'auto', fontSize: '0.85rem' }}
                  value={ttClassFilter}
                  onChange={(e) => setTtClassFilter(e.target.value)}
                >
                  <option value="all">Dhammaan Fasallada</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Day Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Maalinta:</span>
                <select
                  className="form-select"
                  style={{ width: 'auto', fontSize: '0.85rem' }}
                  value={ttDayFilter}
                  onChange={(e) => setTtDayFilter(e.target.value)}
                >
                  <option value="all">Dhammaan Maalmaha (Sabti - Jimce)</option>
                  {DAYS_LIST.map(d => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Casharrada la qorsheeyay: <strong>{filteredTimetable.length}</strong>
            </span>
          </div>

          {/* Timetable Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Maalinta</th>
                  <th>Saacadda</th>
                  <th>Fasalka</th>
                  <th>Maaddada</th>
                  <th>Qolka / Hoolka</th>
                  <th>Xusuusin (Notes)</th>
                  <th style={{ textAlign: 'right' }}>Hawlaha</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>Waa la soo kicinayaa jadwalka...</td></tr>
                ) : filteredTimetable.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      Jadwalka casharro kuma jiraan xilligan.
                    </td>
                  </tr>
                ) : (
                  filteredTimetable.map(t => {
                    const dayObj = DAYS_LIST.find(d => d.key === t.day_of_week);
                    return (
                      <tr key={t.id}>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: '#1e293b',
                            fontSize: '0.82rem'
                          }}>
                            <Calendar size={12} color="#0f766e" />
                            {dayObj ? dayObj.label : t.day_of_week}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                            <Clock size={13} color="#64748b" />
                            <span>{t.start_time.slice(0, 5)} - {t.end_time.slice(0, 5)}</span>
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: '#0f172a' }}>{t.class_name}</strong>
                        </td>
                        <td>
                          <div>
                            <span style={{ fontWeight: 600 }}>{t.subject_name}</span>
                            {t.subject_code && (
                              <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '6px' }}>
                                ({t.subject_code})
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{t.room || '-'}</td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t.notes || '-'}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {canManage && (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px' }}
                                onClick={() => openEditTimetableModal(t)}
                                title="Wax ka beddel darsiga"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ padding: '4px 8px' }}
                                onClick={() => handleDeleteTimetable(t)}
                                title="Ka saar jadwalka"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
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
      )}

      {/* ======================================================================== */}
      {/* MODAL 1: CREATE OR EDIT CLASS                                            */}
      {/* ======================================================================== */}
      {(modalType === 'create_class' || modalType === 'edit_class') && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {modalType === 'create_class' ? 'Ku dar Fasal Cusub' : 'Wax ka beddel Fasalka'}
              </h3>
              <button type="button" onClick={() => setModalType('')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{
                margin: '12px 16px 0',
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                fontSize: '0.85rem',
                border: '1px solid #fecaca'
              }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveClass}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Magaca Fasalka (Class Name) *</label>
                  <input
                    className="form-input"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    required
                    placeholder="e.g. F1, F2, ama Sanadka 1-aad"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sannadka Waxbarashada (Academic Year) *</label>
                  <input
                    className="form-input"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    required
                    placeholder="e.g. 2026"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Qaybta (Section / Group)</label>
                  <input
                    className="form-input"
                    value={classSection}
                    onChange={(e) => setClassSection(e.target.value)}
                    placeholder="e.g. Qaybta A, Gelinka Hore"
                  />
                </div>

                {/* Class Level & Progression Configuration */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f766e', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} />
                    <span>Heerka Fasalka & Dallacsiinta (Level & Progression)</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>
                        Tartanka / Heerka (Order) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={classProgressionOrder}
                        onChange={(e) => setClassProgressionOrder(e.target.value)}
                        required
                        placeholder="1 = F1, 2 = F2..."
                      />
                      <small style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        1 = Heerka 1-aad (e.g. F1), 2 = F2, 3 = F3...
                      </small>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>
                        Nooca Heerka (Class Stage) *
                      </label>
                      <select
                        className="form-select"
                        value={classIsFinal ? 'final' : 'normal'}
                        onChange={(e) => {
                          const isFinal = e.target.value === 'final';
                          setClassIsFinal(isFinal);
                          if (isFinal) setClassNextClassId('');
                        }}
                      >
                        <option value="normal">Fasal Caadi / Dhexe (Middle)</option>
                        <option value="final">Fasalka Ugu Dambeeya (Final)</option>
                      </select>
                      <small style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {classIsFinal ? 'Ardaydu way qalin-jabinayaan' : 'U gudbaya fasalka xiga'}
                      </small>
                    </div>
                  </div>

                  {!classIsFinal ? (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>
                        Fasalka Xiga ee Dallacsiinta (Next Class)
                      </label>
                      <select
                        className="form-select"
                        value={classNextClassId}
                        onChange={(e) => setClassNextClassId(e.target.value)}
                      >
                        <option value="">-- Si Toos ah ugu xir heerka xiga (Auto-link) --</option>
                        {classes.filter(c => !selectedClass || c.id !== selectedClass.id).map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.academic_year}) {c.is_final_class ? '— [Final Class]' : ''}
                          </option>
                        ))}
                      </select>
                      <small style={{ fontSize: '0.72rem', color: '#0f766e' }}>
                        Ardayda baasta imtixaanka kama-dambaysta ah waxay toos ugu dallacayaan fasalkan.
                      </small>
                    </div>
                  ) : (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#f5f3ff',
                      border: '1px solid #ddd6fe',
                      color: '#6d28d9',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Award size={15} />
                      <span>Fasalkan waa kan ugu dambeeya (Final). Ardayda baasta waxay si toos ah u qaadanayaan <strong>Qalin-jabin (Graduated)</strong>.</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Faahfaahin (Description)</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={classDescription}
                    onChange={(e) => setClassDescription(e.target.value)}
                    placeholder="Faahfaahin ku saabsan heerka fasalkan..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalType('')}>
                  Ka noqo
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Waa la kaydinayaa...' : (modalType === 'create_class' ? 'Abuur Fasalka' : 'Cusboonaysii Fasalka')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* MODAL 2: CREATE OR EDIT SUBJECT                                          */}
      {/* ======================================================================== */}
      {(modalType === 'create_subject' || modalType === 'edit_subject') && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {modalType === 'create_subject' ? 'Diiwaangeli Maaddo Cusub' : 'Wax ka beddel Maaddada'}
              </h3>
              <button type="button" onClick={() => setModalType('')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{
                margin: '12px 16px 0',
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                fontSize: '0.85rem',
                border: '1px solid #fecaca'
              }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveSubject}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Magaca Maaddada (Subject Name) *</label>
                  <input
                    className="form-input"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    required
                    placeholder="e.g. Tafsiir, Xadiith, Naxwe, Sarf, Tawxiid"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Koodhka Maaddada (Subject Code)</label>
                  <input
                    className="form-input"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    placeholder="Haddii aad ka tagto, si toos ah ayaa loo samaynayaa (e.g. SUB-TAF01)"
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    Koodhku waa inuu ahaadaa mid u gaar ah maaddadan (unique).
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Faahfaahin (Description)</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={subjectDescription}
                    onChange={(e) => setSubjectDescription(e.target.value)}
                    placeholder="Kutubta la dhigto ama faahfaahin kale..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalType('')}>
                  Ka noqo
                </button>
                <button type="submit" className="btn btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Waa la kaydinayaa...' : (modalType === 'create_subject' ? 'Diiwaangeli Maaddada' : 'Cusboonaysii')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* MODAL 3: MANAGE CLASS SUBJECTS (JUNCTION TABLE)                          */}
      {/* ======================================================================== */}
      {modalType === 'manage_subjects' && selectedClass && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Maamul Maaddooyinka Fasalka: <span style={{ color: '#0f766e' }}>{selectedClass.name}</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Sannadka Waxbarashada: {selectedClass.academic_year} | Dooro maaddooyinka lagu dhigayo fasalkan
                </p>
              </div>
              <button type="button" onClick={() => setModalType('')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{
                margin: '12px 16px 0',
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                fontSize: '0.85rem',
                border: '1px solid #fecaca'
              }}>
                {modalError}
              </div>
            )}

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* SECTION A: Currently Assigned Subjects */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Maaddooyinka Hadda U Qoran Fasalkan ({classAssignedSubjects.length})
                </h4>

                {classAssignedSubjects.length === 0 ? (
                  <div style={{
                    padding: '16px',
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '0.85rem'
                  }}>
                    Fasalkan wax maaddo ah weli looma xilsaarin. Fadlan hoos ka dooro maaddooyinka la dhigo.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Koodhka</th>
                          <th>Magaca Maaddada</th>
                          <th style={{ textAlign: 'right' }}>Hawlaha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classAssignedSubjects.map(sub => (
                          <tr key={sub.id}>
                            <td>
                              <span style={{ fontWeight: 600, color: '#0f766e', fontFamily: 'monospace' }}>
                                {sub.code}
                              </span>
                            </td>
                            <td>
                              <strong>{sub.name}</strong>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {canManage && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                  onClick={() => handleRemoveClassSubject(sub.id, sub.name)}
                                  disabled={modalLoading}
                                  title="Ka saar fasalkan"
                                >
                                  <Trash2 size={12} /> Ka Saar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SECTION B: Add Available Subjects to this Class */}
              {canManage && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f0fdfa',
                  border: '1px solid #ccfbf1',
                  borderRadius: '8px'
                }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f766e', marginBottom: '8px' }}>
                    Ku Dar Maaddooyin Cusub Fasalkan
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '12px' }}>
                    Dooro maaddooyinka ka diiwaangashan Machadka ee aad rabto inaad ku darto fasalka <strong>{selectedClass.name}</strong>:
                  </p>

                  {classAvailableSubjects.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                      Dhammaan maaddooyinka jira horey ayaa loogu xilsaaray fasalkan. Haddii aad u baahan tahay maaddo kale, marka hore ka soo diiwaangeli tab-ka <em>Maaddooyinka</em>.
                    </div>
                  ) : (
                    <form onSubmit={handleAssignSubjectsToClass}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '8px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        padding: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        marginBottom: '12px'
                      }}>
                        {classAvailableSubjects.map(sub => {
                          const isChecked = selectedSubjectsToAdd.includes(sub.id);
                          return (
                            <label
                              key={sub.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                backgroundColor: isChecked ? '#e6fffa' : 'transparent',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                border: `1px solid ${isChecked ? '#5eead4' : 'transparent'}`
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSubjectsToAdd(prev => [...prev, sub.id]);
                                  } else {
                                    setSelectedSubjectsToAdd(prev => prev.filter(id => id !== sub.id));
                                  }
                                }}
                              />
                              <div>
                                <strong style={{ display: 'block' }}>{sub.name}</strong>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{sub.code}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={modalLoading || selectedSubjectsToAdd.length === 0}
                        >
                          <Plus size={14} /> Ku Dar ({selectedSubjectsToAdd.length}) Fasalka
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModalType('')}>
                Xidh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* MODAL 4: CREATE OR EDIT TIMETABLE ENTRY                                  */}
      {/* ======================================================================== */}
      {(modalType === 'create_timetable' || modalType === 'edit_timetable') && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {modalType === 'create_timetable' ? 'Ku dar Darsi Jadwalka' : 'Wax ka beddel Darsiga Jadwalka'}
              </h3>
              <button type="button" onClick={() => setModalType('')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{
                margin: '12px 16px 0',
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                fontSize: '0.85rem',
                border: '1px solid #fecaca'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>{modalError}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveTimetable}>
              <div className="modal-body">
                {/* 1. Class Selection */}
                <div className="form-group">
                  <label className="form-label">Fasalka (Class) *</label>
                  <select
                    className="form-select"
                    value={ttClassId}
                    onChange={(e) => handleTimetableClassChange(e.target.value)}
                    required
                  >
                    <option value="">-- Dooro Fasalka --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Subject Selection (Strictly restricted to subjects assigned to this class) */}
                <div className="form-group">
                  <label className="form-label">Maaddada (Subject) *</label>
                  {ttClassSubjectsList.length === 0 ? (
                    <div style={{
                      padding: '10px 12px',
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fef3c7',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      color: '#b45309'
                    }}>
                      Fasalkan wax maaddooyin ah looma xilsaarin. Fadlan tag qaybta <strong>Fasallada</strong> oo ku dar maaddooyinka fasalka ka hor inta aadan jadwalka gelin.
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={ttSubjectId}
                      onChange={(e) => setTtSubjectId(e.target.value)}
                      required
                    >
                      <option value="">-- Dooro Maaddada --</option>
                      {ttClassSubjectsList.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  )}
                  <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    Waxaa halkan ka soo muuqanaya maaddooyinka loo xilsaaray fasalkan oo keliya.
                  </small>
                </div>

                {/* 3. Day of the Week (All 7 Days) */}
                <div className="form-group">
                  <label className="form-label">Maalinta Toddobaadka (Day of Week) *</label>
                  <select
                    className="form-select"
                    value={ttDay}
                    onChange={(e) => setTtDay(e.target.value)}
                    required
                  >
                    {DAYS_LIST.map(d => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Time Range */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Waqtiga Bilowga (Start) *</label>
                    <input
                      type="time"
                      className="form-input"
                      value={ttStart}
                      onChange={(e) => setTtStart(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Waqtiga Dhammaadka (End) *</label>
                    <input
                      type="time"
                      className="form-input"
                      value={ttEnd}
                      onChange={(e) => setTtEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* 5. Room & Notes */}
                <div className="form-group">
                  <label className="form-label">Qolka / Hoolka (Room / Hall)</label>
                  <input
                    className="form-input"
                    value={ttRoom}
                    onChange={(e) => setTtRoom(e.target.value)}
                    placeholder="e.g. Qolka 1, Hoolka Guud"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Xusuusin (Notes)</label>
                  <input
                    className="form-input"
                    value={ttNotes}
                    onChange={(e) => setTtNotes(e.target.value)}
                    placeholder="Faahfaahin ku saabsan darsiga..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalType('')}>
                  Ka noqo
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading || ttClassSubjectsList.length === 0}
                >
                  {modalLoading ? 'Waa la kaydinayaa...' : (modalType === 'create_timetable' ? 'Kaydi Jadwalka' : 'Cusboonaysii')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
