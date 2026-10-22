import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AttendanceHistoryModal from '../components/AttendanceHistoryModal';
import { 
  CalendarCheck, CheckSquare, Save, AlertCircle, CheckCircle, 
  Users, Calendar, Clock, HelpCircle, Check, X, Search, Phone, History, User
} from 'lucide-react';

export default function AttendancePage() {
  const { user, isSuperAdmin, hasInstituteAccess, hasQuranAccess } = useAuth();
  
  // Selection states
  const defaultDivision = hasInstituteAccess ? 'institute' : (hasQuranAccess ? 'quran' : 'institute');
  const [division, setDivision] = useState(defaultDivision);
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  
  // Date state: Defaults to today (allows every single day of the week: Mon - Sun)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Sheet data & state
  const [sheetData, setSheetData] = useState([]);
  const [sessionExists, setSessionExists] = useState(false);
  const [dayName, setDayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Student Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [historyStudentId, setHistoryStudentId] = useState(null);
  const [quickUpdateLoadingId, setQuickUpdateLoadingId] = useState(null);

  // Keep a snapshot to detect unsaved changes
  const initialSnapshotRef = useRef('');


  // 1. Load Classes or Groups based on division
  useEffect(() => {
    loadDropdowns();
  }, [division]);

  async function loadDropdowns() {
    try {
      if (division === 'institute') {
        const res = await api.getClasses();
        if (res.success && res.data.length > 0) {
          setClasses(res.data);
          setSelectedClassId(prev => {
            const exists = res.data.some(c => String(c.id) === String(prev));
            return exists ? prev : String(res.data[0].id);
          });
        } else {
          setClasses([]);
          setSelectedClassId('');
        }
      } else {
        const res = await api.getQuranGroups();
        if (res.success && res.data.length > 0) {
          setGroups(res.data);
          setSelectedGroupId(prev => {
            const exists = res.data.some(g => String(g.id) === String(prev));
            return exists ? prev : String(res.data[0].id);
          });
        } else {
          setGroups([]);
          setSelectedGroupId('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 2. Fetch attendance sheet whenever class/group or date changes
  useEffect(() => {
    if ((division === 'institute' && selectedClassId) || (division === 'quran' && selectedGroupId)) {
      fetchSheet();
    }
  }, [division, selectedClassId, selectedGroupId, selectedDate]);

  async function fetchSheet() {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const params = new URLSearchParams({
        division,
        date: selectedDate
      });

      if (division === 'institute') {
        params.append('class_id', selectedClassId);
      } else {
        params.append('group_id', selectedGroupId);
      }

      const res = await api.getAttendanceSheet(`?${params.toString()}`);
      if (res.success) {
        const students = res.data.students || [];
        setSheetData(students);
        setSessionExists(res.data.session_exists || false);
        setDayName(res.data.day_name || '');

        // Snapshot to track unsaved edits
        const snapshot = JSON.stringify(students.map(s => ({ id: s.student_id, st: s.status, r: s.remarks || '' })));
        initialSnapshotRef.current = snapshot;
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      setError(err.message || 'Khalad ayaa dhacay markii la soo dejinayay xaadirinta.');
      setSheetData([]);
      setSessionExists(false);
      setHasUnsavedChanges(false);
    } finally {
      setLoading(false);
    }
  }

  // Check unsaved changes helper before changing class/date
  function checkUnsavedBeforeAction(proceedCallback) {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'Waxaa jira isbeddelo aad samaysay oo aan weli la kaydin. Ma hubtaa inaad ka tagayso? (You have unsaved attendance changes. Discard and proceed?)'
      );
      if (!confirmed) return;
    }
    proceedCallback();
  }

  // 3. Mark All Present button
  function handleMarkAllPresent() {
    setSheetData(prev => {
      const updated = prev.map(s => ({ ...s, status: 'present' }));
      setHasUnsavedChanges(true);
      return updated;
    });
  }

  // 4. Toggle single student status between present and absent
  function toggleStudentStatus(studentId) {
    setSheetData(prev => {
      const updated = prev.map(s => {
        if (s.student_id === studentId) {
          const nextStatus = s.status === 'present' ? 'absent' : 'present';
          return { ...s, status: nextStatus };
        }
        return s;
      });
      setHasUnsavedChanges(true);
      return updated;
    });
  }

  // 5. Change student status to present, absent, late, or excused
  function handleStatusChange(studentId, newStatus) {
    setSheetData(prev => {
      const updated = prev.map(s => {
        if (s.student_id === studentId) {
          return { ...s, status: newStatus };
        }
        return s;
      });
      setHasUnsavedChanges(true);
      return updated;
    });
  }

  // 6. Update student remarks
  function handleRemarksChange(studentId, remarksValue) {
    setSheetData(prev => {
      const updated = prev.map(s => {
        if (s.student_id === studentId) {
          return { ...s, remarks: remarksValue };
        }
        return s;
      });
      setHasUnsavedChanges(true);
      return updated;
    });
  }

  // 7. Save Attendance
  async function handleSaveAttendance() {
    if (sheetData.length === 0) return;
    
    setError('');
    setMessage('');
    setSaveLoading(true);

    try {
      const records = sheetData.map(s => ({
        student_id: s.student_id,
        status: s.status || 'present',
        remarks: s.remarks || ''
      }));

      const payload = {
        division,
        date: selectedDate,
        records
      };

      if (division === 'institute') {
        payload.class_id = parseInt(selectedClassId, 10);
      } else {
        payload.group_id = parseInt(selectedGroupId, 10);
      }

      const res = await api.saveAttendance(payload);
      if (res.success) {
        setMessage(res.message || 'Xaadirinta si guul leh ayaa loo kaydiyay.');
        setSessionExists(true);
        setHasUnsavedChanges(false);
        // Refresh snapshot
        const snapshot = JSON.stringify(sheetData.map(s => ({ id: s.student_id, st: s.status, r: s.remarks || '' })));
        initialSnapshotRef.current = snapshot;
      }
    } catch (err) {
      setError(err.message || 'Khalad ayaa dhacay markii la kaydinayay xaadirinta.');
    } finally {
      setSaveLoading(false);
    }
  }

  // Current weekday name in Somali & English
  const dateObj = new Date(selectedDate);
  const weekdayEnglish = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const weekdaySomali = {
    'Sunday': 'Axad',
    'Monday': 'Isniin',
    'Tuesday': 'Talaado',
    'Wednesday': 'Arbaco',
    'Thursday': 'Khamiis',
    'Friday': 'Jimce',
    'Saturday': 'Sabti'
  }[weekdayEnglish] || weekdayEnglish;

  // Search students across assigned classes (debounced 300ms)
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedDate]);

  async function executeSearch(queryText) {
    if (!queryText) return;
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        q: queryText,
        date: selectedDate
      });
      const res = await api.searchAttendanceStudents(`?${params.toString()}`);
      if (res.success) {
        setSearchResults(res.data || []);
      }
    } catch (err) {
      console.error('Attendance student search error:', err);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleCardStatusChange(studentId, newStatus) {
    setSearchResults(prev => prev.map(item => {
      if (item.id === studentId) {
        return { ...item, editStatus: newStatus };
      }
      return item;
    }));
  }

  function handleCardRemarksChange(studentId, newRemarks) {
    setSearchResults(prev => prev.map(item => {
      if (item.id === studentId) {
        return { ...item, editRemarks: newRemarks };
      }
      return item;
    }));
  }

  async function handleQuickSaveStudentAttendance(studentItem, targetClass) {
    const statusToSave = studentItem.editStatus || (studentItem.status !== 'not_recorded' ? studentItem.status : 'present');
    const remarksToSave = studentItem.editRemarks !== undefined ? studentItem.editRemarks : studentItem.remarks;

    setQuickUpdateLoadingId(studentItem.id);
    try {
      const payload = {
        student_id: studentItem.id,
        division: targetClass.division,
        date: selectedDate,
        status: statusToSave,
        remarks: remarksToSave || ''
      };

      if (targetClass.division === 'institute') {
        payload.class_id = targetClass.class_id;
      } else {
        payload.group_id = targetClass.group_id || targetClass.class_id;
      }

      const res = await api.updateSingleStudentAttendance(payload);
      if (res.success) {
        // 1. Update searchResults state
        setSearchResults(prev => prev.map(item => {
          if (item.id === studentItem.id) {
            const updatedClasses = item.classes.map(c => {
              if (c.division === targetClass.division && (c.class_id === targetClass.class_id || c.group_id === targetClass.group_id)) {
                return { ...c, status: statusToSave, remarks: remarksToSave || '', has_record: true };
              }
              return c;
            });
            return {
              ...item,
              classes: updatedClasses,
              status: statusToSave,
              remarks: remarksToSave || '',
              editStatus: undefined,
              editRemarks: undefined,
              has_record: true
            };
          }
          return item;
        }));

        // 2. If student is currently in active sheetData, synchronize the table
        setSheetData(prev => prev.map(row => {
          if (row.student_id === studentItem.id) {
            return {
              ...row,
              status: statusToSave,
              remarks: remarksToSave || '',
              is_recorded: true
            };
          }
          return row;
        }));

        setMessage(`Xaadirinta ardayga ${studentItem.full_name} si guul leh ayaa loo kaydiyay.`);
        setTimeout(() => setMessage(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Khalad ayaa dhacay markii la kaydinayay xaadirinta ardayga.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setQuickUpdateLoadingId(null);
    }
  }

  function handleSwitchToClass(classObj) {
    checkUnsavedBeforeAction(() => {
      if (classObj.division === 'institute') {
        setDivision('institute');
        setSelectedClassId(String(classObj.class_id));
      } else {
        setDivision('quran');
        setSelectedGroupId(String(classObj.group_id || classObj.class_id));
      }
      window.scrollTo({ top: 450, behavior: 'smooth' });
    });
  }

  // Present/Absent counts summary
  const presentCount = sheetData.filter(s => s.status === 'present').length;
  const absentCount = sheetData.filter(s => s.status === 'absent').length;
  const lateCount = sheetData.filter(s => s.status === 'late').length;
  const excusedCount = sheetData.filter(s => s.status === 'excused').length;


  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(13, 148, 136, 0.08)', borderRadius: '9999px', color: '#0f766e', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          Maalin Kasta Waa Furan Tahay (Monday - Sunday)
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
          Diiwaangelinta Xaadirinta (Student Attendance)
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.86rem', marginTop: '4px' }}>
          Dooro fasalka iyo taariikh kasta si aad u diiwaangeliso ama u saxdo xaadirinta ardayda.
        </p>
      </div>

      {/* Control Card: Select Class & Date */}
      <div className="card" style={{ marginBottom: '22px' }}>
        <div className="card-body" style={{ padding: '22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', alignItems: 'flex-end' }}>
            {/* Division Selector if Super Admin */}
            {isSuperAdmin && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Waaxda (Division)</label>
                <select 
                  className="form-select"
                  value={division}
                  onChange={(e) => {
                    const newDiv = e.target.value;
                    checkUnsavedBeforeAction(() => {
                      setDivision(newDiv);
                    });
                  }}
                >
                  <option value="institute">Machadka (Institute)</option>
                  <option value="quran">Dugsiga Quraanka (Quran)</option>
                </select>
              </div>
            )}

            {/* Class / Group Selector */}
            {division === 'institute' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#0f172a' }}>
                  Fasalka Machadka *
                </label>
                <select 
                  className="form-select"
                  value={selectedClassId}
                  onChange={(e) => {
                    const newClassId = e.target.value;
                    checkUnsavedBeforeAction(() => {
                      setSelectedClassId(newClassId);
                    });
                  }}
                >
                  {classes.length === 0 ? (
                    <option value="">Ma jiro fasal la helay</option>
                  ) : (
                    classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.academic_year || '2026'})
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#0f172a' }}>
                  Halaqada Quraanka *
                </label>
                <select 
                  className="form-select"
                  value={selectedGroupId}
                  onChange={(e) => {
                    const newGroupId = e.target.value;
                    checkUnsavedBeforeAction(() => {
                      setSelectedGroupId(newGroupId);
                    });
                  }}
                >
                  {groups.length === 0 ? (
                    <option value="">Ma jirto halaqo la helay</option>
                  ) : (
                    groups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.shift})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Date Selector: Available for every day of the week */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
                <span>Taariikhda Xaadirinta *</span>
                <span style={{ color: '#0d9488', fontWeight: 600 }}>{weekdaySomali} ({weekdayEnglish})</span>
              </label>
              <input 
                type="date"
                className="form-input"
                value={selectedDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  checkUnsavedBeforeAction(() => {
                    setSelectedDate(newDate);
                  });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Student Search Bar Card */}
      <div className="card" style={{ marginBottom: '22px' }}>
        <div className="card-body" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={18} color="#0d9488" />
                  <span>Raadi Arday (Search Student)</span>
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '3px 0 0' }}>
                  Ka raadi ardayda fasallada laguu xilsaaray magaca (English/Carabi), ID-ga, ama telefoonka si aad u ogaato xaaladda xaadirinta ama sababta maqnaanshaha.
                </p>
              </div>

              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSearchQuery('')}
                  style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <X size={14} />
                  <span>Nadiifi (Clear)</span>
                </button>
              )}
            </div>

            {/* Search Input Field */}
            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#0d9488', pointerEvents: 'none' }}>
                <Search size={18} />
              </div>

              <input
                type="text"
                className="form-input"
                style={{ 
                  paddingLeft: '44px', 
                  paddingRight: searchQuery ? '42px' : '14px',
                  height: '46px',
                  fontSize: '0.92rem',
                  borderRadius: '10px',
                  borderColor: searchQuery.trim() ? '#0d9488' : '#cbd5e1',
                  boxShadow: searchQuery.trim() ? '0 0 0 3px rgba(13, 148, 136, 0.12)' : 'none'
                }}
                placeholder="Search student by name, ID, or phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              {searchLoading && (
                <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                  <div style={{ width: '18px', height: '18px', border: '2px solid #cbd5e1', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              )}

              {!searchLoading && searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ 
                    position: 'absolute', 
                    right: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="Nadiifi baaritaanka"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Search Results Area */}
          {searchQuery.trim().length > 0 && (
            <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              {searchLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                  <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '2px solid #e2e8f0', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '8px' }} />
                  <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>Raadinaya ardayda ku habboon...</div>
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '26px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <Users size={30} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                  <strong style={{ display: 'block', color: '#334155', fontSize: '0.92rem' }}>
                    Ma jiro arday ku habboon baaritaankaaga "{searchQuery}" fasalladaada
                  </strong>
                  <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '4px 0 0' }}>
                    Hubi magaca ardayga (English ama Carabi), lambarka aqoonsiga (tusaale: STU-2026-002), ama taleefanka. Kaliya ardayda ku qoran fasallada laguu xilsaaray ayaa la heli karaa.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                      Natiijooyinka: <span style={{ color: '#0d9488' }}>{searchResults.length}</span> arday ayaa la helay
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Xaaladda taariikhda: <strong style={{ color: '#0f172a' }}>{selectedDate}</strong> ({weekdaySomali})
                    </div>
                  </div>

                  {/* Student Cards Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
                    {searchResults.map((st) => {
                      const primaryClass = st.classes[0] || {};
                      const currentStatus = st.editStatus !== undefined ? st.editStatus : (st.status !== 'not_recorded' ? st.status : 'present');
                      const currentRemarks = st.editRemarks !== undefined ? st.editRemarks : (st.remarks || '');
                      const isRecorded = st.has_record;

                      return (
                        <div 
                          key={st.id} 
                          style={{ 
                            background: '#ffffff', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '12px', 
                            padding: '16px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}
                        >
                          {/* Student Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>{st.full_name}</strong>
                                {st.name_ar && (
                                  <span style={{ 
                                    background: '#f0fdf4', 
                                    color: '#166534', 
                                    padding: '1px 7px', 
                                    borderRadius: '5px', 
                                    fontSize: '0.82rem',
                                    fontFamily: 'Traditional Arabic, Arial, sans-serif'
                                  }}>
                                    {st.name_ar}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '0.78rem', color: '#64748b', flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>
                                  {st.student_id}
                                </span>
                                {st.phone && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <Phone size={11} /> {st.phone}
                                  </span>
                                )}
                                {st.guardian_phone && (
                                  <span>Waalidka: {st.guardian_phone}</span>
                                )}
                              </div>
                            </div>

                            {/* Attendance Status Badge on Selected Date */}
                            <div>
                              {isRecorded ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  backgroundColor: st.status === 'present' ? '#ecfdf5' : st.status === 'absent' ? '#fef2f2' : st.status === 'late' ? '#fffbeb' : '#eff6ff',
                                  color: st.status === 'present' ? '#065f46' : st.status === 'absent' ? '#991b1b' : st.status === 'late' ? '#92400e' : '#1e40af',
                                  border: `1px solid ${st.status === 'present' ? '#a7f3d0' : st.status === 'absent' ? '#fecaca' : st.status === 'late' ? '#fde68a' : '#bfdbfe'}`
                                }}>
                                  {st.status === 'present' && '✓ Jooga (Present)'}
                                  {st.status === 'absent' && '✗ Maqan (Absent)'}
                                  {st.status === 'late' && '⏱ Daahey (Late)'}
                                  {st.status === 'excused' && '✉ Cudurdaar (Excused)'}
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                  border: '1px solid #e2e8f0'
                                }}>
                                  ○ Aan weli la qorin
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Enrolled Classes List */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', padding: '6px 10px', background: '#f8fafc', borderRadius: '8px' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Fasallada:</span>
                            {st.classes.map((cls, cIdx) => (
                              <span 
                                key={cIdx} 
                                style={{ 
                                  fontSize: '0.74rem', 
                                  background: cls.division === 'quran' ? '#ecfdf5' : '#eff6ff',
                                  color: cls.division === 'quran' ? '#065f46' : '#1e40af',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 600
                                }}
                              >
                                {cls.class_name} {cls.shift ? `(${cls.shift})` : ''}
                              </span>
                            ))}
                          </div>

                          {/* Action Form: Update Status & Absence Reason */}
                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #edf2f7' }}>
                            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                              Diiwaangeli / Sax Xaadirinta ({selectedDate}):
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Xaaladda</label>
                                <select
                                  className="form-select"
                                  style={{ padding: '5px 8px', fontSize: '0.8rem', fontWeight: 600 }}
                                  value={currentStatus}
                                  onChange={(e) => handleCardStatusChange(st.id, e.target.value)}
                                >
                                  <option value="present">✓ Jooga (Present)</option>
                                  <option value="absent">✗ Maqan (Absent)</option>
                                  <option value="late">⏱ Daahey (Late)</option>
                                  <option value="excused">✉ Cudurdaar (Excused)</option>
                                </select>
                              </div>

                              <div>
                                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Sababta / Xusuusin</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                                  placeholder="Tus: Xanuun, Safar..."
                                  value={currentRemarks}
                                  onChange={(e) => handleCardRemarksChange(st.id, e.target.value)}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => setHistoryStudentId(st.id)}
                              >
                                <History size={13} color="#0d9488" />
                                <span>Taariikhda Xaadirinta</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.74rem', padding: '4px 12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                disabled={quickUpdateLoadingId === st.id}
                                onClick={() => handleQuickSaveStudentAttendance(st, primaryClass)}
                              >
                                <Save size={13} />
                                <span>{quickUpdateLoadingId === st.id ? 'Kaydinayaa...' : 'Kaydi Xaadirinta'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Notifications */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '12px', border: '1px solid #fecaca', marginBottom: '18px' }}>
          <AlertCircle size={20} />
          <span style={{ fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {message && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '12px', border: '1px solid #a7f3d0', marginBottom: '18px' }}>
          <CheckCircle size={20} />
          <span style={{ fontWeight: 600 }}>{message}</span>
        </div>
      )}

      {/* Attendance Spreadsheet Card */}
      <div className="card">
        <div className="card-header" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h3 className="card-title" style={{ fontSize: '1.12rem', margin: 0 }}>
              Liiska Xaadirinta Ardayda
            </h3>
            
            {sessionExists ? (
              <span className="badge badge-info" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} />
                Xaadirin Hore u Kaydsaneyd (Saved)
              </span>
            ) : (
              <span className="badge badge-warning" style={{ fontWeight: 600 }}>
                Xaadirin Cusub (New Sheet)
              </span>
            )}

            {hasUnsavedChanges && (
              <span style={{ fontSize: '0.74rem', background: '#fffbeb', color: '#b45309', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, border: '1px solid #fde68a' }}>
                Waxaa jira isbeddello aan la kaydin!
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Quick Stat Badges */}
            {sheetData.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginRight: '6px' }}>
                <span style={{ fontSize: '0.74rem', background: '#ecfdf5', color: '#065f46', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
                  Jooga: {presentCount}
                </span>
                <span style={{ fontSize: '0.74rem', background: '#fef2f2', color: '#991b1b', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
                  Maqan: {absentCount}
                </span>
                {lateCount > 0 && (
                  <span style={{ fontSize: '0.74rem', background: '#fffbeb', color: '#92400e', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
                    Daahey: {lateCount}
                  </span>
                )}
                {excusedCount > 0 && (
                  <span style={{ fontSize: '0.74rem', background: '#eff6ff', color: '#1e40af', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
                    Cudurdaar: {excusedCount}
                  </span>
                )}
              </div>
            )}

            {/* Workflow Action 4: Mark All Present */}
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={handleMarkAllPresent}
              disabled={loading || sheetData.length === 0}
              style={{ fontWeight: 600, border: '1px solid #cbd5e1' }}
            >
              <CheckSquare size={15} color="#0d9488" />
              <span>Dhammaan Waa Joogaan (Mark All Present)</span>
            </button>

            {/* Workflow Action 6: Save Attendance */}
            <button 
              type="button" 
              className="btn btn-primary btn-sm" 
              onClick={handleSaveAttendance}
              disabled={saveLoading || sheetData.length === 0}
              style={{ fontWeight: 600, minWidth: '170px' }}
            >
              <Save size={15} />
              <span>{saveLoading ? 'Kaydinayaa...' : 'Kaydi Xaadirinta (Save)'}</span>
            </button>
          </div>
        </div>

        {/* Student List Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>Jooga</th>
                <th>Aqoonsiga (ID)</th>
                <th>Magaca Ardayga</th>
                <th>Jinsiga</th>
                <th>Xaaladda (Status)</th>
                <th>Xusuusin (Remarks)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '10px' }}></div>
                    <div style={{ fontWeight: 600 }}>Soo dejinayaa liiska ardayda fasalka...</div>
                  </td>
                </tr>
              ) : sheetData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.5, display: 'block' }} />
                    <strong style={{ display: 'block', color: '#475569', fontSize: '0.95rem' }}>
                      Fasalkan weli wax arday ah kuma qorna (No enrolled students in this class).
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Fadlan arday ku dar fasalkan qaybta Students & Enrollments si ay halkan ugu soo baxaan.
                    </span>
                  </td>
                </tr>
              ) : (
                sheetData.map((st) => {
                  const isPresent = st.status === 'present';
                  const isAbsent = st.status === 'absent';
                  const isLate = st.status === 'late';
                  const isExcused = st.status === 'excused';

                  return (
                    <tr 
                      key={st.student_id}
                      style={{ 
                        backgroundColor: isAbsent ? '#fef2f2' : isLate ? '#fffbeb' : isExcused ? '#f0f9ff' : '#ffffff',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Checkbox for quick Present/Absent toggle */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isPresent}
                          onChange={() => toggleStudentStatus(st.student_id)}
                          style={{ 
                            width: '19px', 
                            height: '19px', 
                            cursor: 'pointer', 
                            accentColor: '#0d9488' 
                          }}
                          title="Calaamadee haduu joogo ama maqan yahay"
                        />
                      </td>

                      {/* Student ID */}
                      <td>
                        <span style={{ fontWeight: 700, color: '#0f766e', fontSize: '0.86rem', fontFamily: 'monospace' }}>
                          {st.student_code}
                        </span>
                      </td>

                      {/* Student Full Name */}
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{st.full_name}</strong>
                        {st.phone && (
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{st.phone}</div>
                        )}
                      </td>

                      {/* Gender */}
                      <td>
                        <span style={{ fontSize: '0.84rem', color: '#475569' }}>
                          {st.gender === 'male' ? 'Lab' : st.gender === 'female' ? 'Dheddig' : '-'}
                        </span>
                      </td>

                      {/* Status Selector Dropdown */}
                      <td>
                        <select
                          className="form-select"
                          value={st.status || 'present'}
                          onChange={(e) => handleStatusChange(st.student_id, e.target.value)}
                          style={{ 
                            padding: '5px 10px', 
                            fontSize: '0.82rem', 
                            fontWeight: 600,
                            width: 'auto',
                            borderColor: isPresent ? '#a7f3d0' : isAbsent ? '#fecaca' : '#cbd5e1',
                            color: isPresent ? '#065f46' : isAbsent ? '#991b1b' : '#334155',
                            backgroundColor: isPresent ? '#ecfdf5' : isAbsent ? '#fef2f2' : '#ffffff'
                          }}
                        >
                          <option value="present">✓ Jooga (Present)</option>
                          <option value="absent">✗ Maqan (Absent)</option>
                          <option value="late">⏱ Daahey (Late)</option>
                          <option value="excused">✉ Cudurdaar (Excused)</option>
                        </select>
                      </td>

                      {/* Remarks Input */}
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '6px 10px', fontSize: '0.82rem', maxWidth: '280px' }}
                          placeholder="Sabab/Xusuusin..."
                          value={st.remarks || ''}
                          onChange={(e) => handleRemarksChange(st.student_id, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Attendance History Modal */}
      {historyStudentId && (
        <AttendanceHistoryModal 
          studentId={historyStudentId} 
          onClose={() => setHistoryStudentId(null)} 
        />
      )}
    </div>
  );
}

