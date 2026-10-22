import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Phone,
  Mail,
  User,
  BookMarked,
  Layers,
  RefreshCw,
  Archive,
  RotateCcw
} from 'lucide-react';

export default function TeachersPage() {
  const { isSuperAdmin, isQuranAdmin } = useAuth();
  const canManage = isSuperAdmin || isQuranAdmin;

  // Data States
  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Form States (Create / Edit)
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Feedback Notification
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  function showNotification(type, message) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 6000);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [teachersRes, groupsRes] = await Promise.all([
        api.getQuranTeachers(),
        api.getQuranGroups()
      ]);
      if (teachersRes.success) setTeachers(teachersRes.data);
      if (groupsRes.success) setGroups(groupsRes.data);
    } catch (err) {
      console.error(err);
      showNotification('error', err.message || 'Cilad ayaa dhacday markii xogta macallimiinta la soo gelinayay.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      const teachersRes = await api.getQuranTeachers();
      if (teachersRes.success) setTeachers(teachersRes.data);
    } catch (err) {
      showNotification('error', err.message || 'Cilad ayaa dhacday.');
    } finally {
      setRefreshing(false);
    }
  }

  // Open Create Modal
  function handleOpenCreate() {
    setFullName('');
    setUsername('');
    setPassword('');
    setPhone('');
    setEmail('');
    setIsActive(true);
    setSelectedGroupIds([]);
    setFormError('');
    setShowCreateModal(true);
  }

  // Open Edit Modal
  function handleOpenEdit(teacher) {
    setSelectedTeacher(teacher);
    setFullName(teacher.full_name || '');
    setUsername(teacher.username || '');
    setPassword(''); // blank means do not change password
    setPhone(teacher.phone || '');
    setEmail(teacher.email || '');
    setIsActive(!!teacher.is_active);
    setSelectedGroupIds((teacher.classes || []).map(c => c.id));
    setFormError('');
    setShowEditModal(true);
  }

  // Open Delete Modal
  function handleOpenDelete(teacher) {
    setSelectedTeacher(teacher);
    setShowDeleteModal(true);
  }

  // Group selection toggle
  function toggleGroupSelection(groupId) {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  }

  // Save New Teacher
  async function handleCreateTeacher(e) {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim()) {
      setFormError('Magaca buuxa ee macallinka waa qasab.');
      return;
    }
    if (!username.trim()) {
      setFormError('Magaca isticmaalaha (username) waa qasab.');
      return;
    }
    if (!password || password.trim().length < 6) {
      setFormError('Furaha sirta ah waa inuu ugu yaraan ka koobnaadaa 6 xaraf.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createQuranTeacher({
        full_name: fullName.trim(),
        username: username.trim(),
        password: password.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        is_active: isActive,
        group_ids: selectedGroupIds
      });

      if (res.success) {
        setShowCreateModal(false);
        showNotification('success', res.message || 'Macallinka si guul leh ayaa loo diiwaangeliyay.');
        await handleRefresh();
      }
    } catch (err) {
      setFormError(err.message || 'Cilad ayaa dhacday markii macallinka la abuurayay.');
    } finally {
      setSubmitting(false);
    }
  }

  // Save Edited Teacher
  async function handleUpdateTeacher(e) {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim()) {
      setFormError('Magaca macallinka waa qasab.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        is_active: isActive,
        group_ids: selectedGroupIds
      };

      if (password && password.trim().length >= 6) {
        payload.new_password = password.trim();
      }

      const res = await api.updateQuranTeacher(selectedTeacher.id, payload);
      if (res.success) {
        setShowEditModal(false);
        showNotification('success', res.message || 'Xogta macallinka si guul leh ayaa loo cusbooneysiiyay.');
        await handleRefresh();
      }
    } catch (err) {
      setFormError(err.message || 'Cilad ayaa dhacday markii macallinka la cusbooneysiinayay.');
    } finally {
      setSubmitting(false);
    }
  }

  // Toggle Active / Inactive Status
  async function handleToggleStatus(teacher) {
    if (!canManage) return;
    try {
      const res = await api.toggleQuranTeacherStatus(teacher.id);
      if (res.success) {
        setTeachers(prev =>
          prev.map(t => (t.id === teacher.id ? { ...t, is_active: res.is_active } : t))
        );
        showNotification('success', res.message);
      }
    } catch (err) {
      showNotification('error', err.message || 'Cilad ayaa dhacday markii xaaladda la beddelayay.');
    }
  }

  function handleOpenDelete(teacher) {
    setSelectedTeacher(teacher);
    setShowDeleteModal(true);
  }

  async function handleArchiveTeacher(teacher) {
    if (!canManage) return;
    const action = teacher.is_active ? 'kaydinayo' : 'dib u soo celinayo';
    const confirmMsg = teacher.is_active
      ? `Ma hubtaa inaad rabto inaad kaydiso macallinka ${teacher.full_name}? Macallinku wuu ka dhuuman doonaa hawlaha laakiin xogtiisu waxay ku jiri doontaa warbixinnada.`
      : `Ma hubtaa inaad rabto inaad dib u soo celiso macallinka ${teacher.full_name}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.archiveQuranTeacher(teacher.id);
      if (res.success) {
        showNotification('success', res.message || `Macallinka si guul leh ayaa loo ${teacher.is_active ? 'kaydiyay' : 'soo celiyay'}.`);
        await handleRefresh();
      }
    } catch (err) {
      showNotification('error', err.message || 'Cilad ayaa dhacday markii la kaydinayay macallinka.');
    }
  }

  // Confirm Permanent Delete
  async function handleConfirmDelete() {
    if (!selectedTeacher || !canManage) return;
    try {
      setSubmitting(true);
      const res = await api.deleteQuranTeacher(selectedTeacher.id);
      setShowDeleteModal(false);
      showNotification(res.archived ? 'info' : 'success', res.message);
      await handleRefresh();
    } catch (err) {
      showNotification('error', err.message || 'Cilad ayaa dhacday markii macallinka la tirtirayay.');
    } finally {
      setSubmitting(false);
      setSelectedTeacher(null);
    }
  }

  // Filtered Teachers
  const filteredTeachers = teachers.filter(t => {
    // Status filter
    if (statusFilter === 'active' && !t.is_active) return false;
    if (statusFilter === 'inactive' && t.is_active) return false;

    // Search query
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = (t.full_name || '').toLowerCase().includes(term);
    const userMatch = (t.username || '').toLowerCase().includes(term);
    const phoneMatch = (t.phone || '').toLowerCase().includes(term);
    const classMatch = (t.classes || []).some(c => (c.name || '').toLowerCase().includes(term));

    return nameMatch || userMatch || phoneMatch || classMatch;
  });

  return (
    <div>
      {/* Feedback Toast */}
      {feedback.message && (
        <div
          className={`card`}
          style={{
            marginBottom: '16px',
            backgroundColor: feedback.type === 'error' ? '#fef2f2' : feedback.type === 'info' ? '#eff6ff' : '#f0fdf4',
            border: `1px solid ${feedback.type === 'error' ? '#fca5a5' : feedback.type === 'info' ? '#93c5fd' : '#86efac'}`,
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
            ) : feedback.type === 'info' ? (
              <AlertTriangle size={20} color="#2563eb" />
            ) : (
              <CheckCircle2 size={20} color="#16a34a" />
            )}
            <span
              style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: feedback.type === 'error' ? '#991b1b' : feedback.type === 'info' ? '#1e40af' : '#166534'
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

      {/* Header section matching exact specification */}
      <div
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Macallimiinta Dugsiga Qur'aanka & Xilsaarada
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
            Qorista macallimiinta halaqadaha iyo fasallada.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Dib u cusbooneysii liiska"
          >
            <RefreshCw size={15} className={refreshing ? 'spinning' : ''} />
            <span style={{ display: 'none', '@media (min-width: 640px)': { display: 'inline' } }}>Cusbooneysii</span>
          </button>

          {canManage && (
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} /> Qor Macallin Cusub
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Raadi macallin, username, taleefan, ama halaqo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '10px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Xaaladda:</label>
              <select
                className="form-select"
                style={{ width: '150px' }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">Dhammaan ({teachers.length})</option>
                <option value="active">Shaqaynaya ({teachers.filter(t => t.is_active).length})</option>
                <option value="inactive">Xanniban ({teachers.filter(t => !t.is_active).length})</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Teachers Table - Exactly 4 Columns */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '32%' }}>MACALLINKA</th>
                <th style={{ width: '38%' }}>FASALKA</th>
                <th style={{ width: '15%' }}>XAALADDA</th>
                <th style={{ width: '15%', textAlign: 'right' }}>HAWLAHA</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={18} className="spinning" />
                      <span>Soo dejinayaa xogta macallimiinta...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ maxWidth: '360px', margin: '0 auto', color: '#64748b' }}>
                      <Users size={48} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                        {searchTerm || statusFilter !== 'all'
                          ? 'Lama helin macallin u dhigma raadintaada'
                          : 'Ma jiraan macallimiin diiwaangashan'}
                      </h3>
                      <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                        {searchTerm || statusFilter !== 'all'
                          ? 'Fadlan hubi xuruufta raadinta ama baddel miiraha xaaladda.'
                          : "Weli lama qorin macallimiinta dugsiga Qur'aanka. Riix batoonka hoose si aad u diiwaangeliso macallin cusub."}
                      </p>
                      {canManage && !searchTerm && statusFilter === 'all' && (
                        <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
                          <Plus size={14} /> Qor Macallin Cusub
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTeachers.map(teacher => {
                  const teacherClasses = teacher.classes || [];
                  return (
                    <tr key={teacher.id}>
                      {/* Column 1: MACALLINKA */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              background: teacher.is_active
                                ? 'linear-gradient(135deg, #0d9488, #059669)'
                                : '#94a3b8',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.95rem',
                              flexShrink: 0
                            }}
                          >
                            {(teacher.full_name || 'M')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                              {teacher.full_name}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.78rem',
                                color: '#64748b',
                                marginTop: '2px',
                                flexWrap: 'wrap'
                              }}
                            >
                              <span>@{teacher.username}</span>
                              {teacher.phone && (
                                <>
                                  <span>•</span>
                                  <span>{teacher.phone}</span>
                                </>
                              )}
                              {teacher.email && (
                                <>
                                  <span>•</span>
                                  <span>{teacher.email}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: FASALKA */}
                      <td>
                        {teacherClasses.length === 0 ? (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                            Lama xilsaarin
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {teacherClasses.map(cls => (
                              <span
                                key={cls.id}
                                className="badge badge-info"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.8rem',
                                  padding: '4px 9px',
                                  borderRadius: '6px'
                                }}
                              >
                                <BookMarked size={12} />
                                <span>{cls.name}</span>
                                {cls.shift && (
                                  <span style={{ opacity: 0.75, fontSize: '0.72rem' }}>
                                    ({cls.shift === 'morning' ? 'Subax' : cls.shift === 'afternoon' ? 'Galab' : 'Fiid'})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Column 3: XAALADDA */}
                      <td>
                        <span
                          className={`badge ${teacher.is_active ? 'badge-success' : 'badge-danger'}`}
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: teacher.is_active ? '#16a34a' : '#dc2626'
                            }}
                          />
                          {teacher.is_active ? 'Shaqaynaya (Active)' : 'Xanniban (Inactive)'}
                        </span>
                      </td>

                      {/* Column 4: HAWLAHA */}
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '6px',
                            alignItems: 'center',
                            flexWrap: 'wrap'
                          }}
                        >
                          {canManage && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleOpenEdit(teacher)}
                                title="Wax ka beddel macallinka iyo fasallada"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleArchiveTeacher(teacher)}
                                title={teacher.is_active ? "Kaydi macallinka (Archive)" : "Dib u soo celi (Unarchive)"}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderColor: teacher.is_active ? '#f59e0b' : '#10b981' }}
                              >
                                {teacher.is_active ? <Archive size={13} color="#d97706" /> : <RotateCcw size={13} color="#059669" />}
                                <span style={{ color: teacher.is_active ? '#b45309' : '#047857' }}>
                                  {teacher.is_active ? 'Kaydi' : 'Soo celi'}
                                </span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => handleOpenDelete(teacher)}
                                title="Tirtir macallinka (Delete Permanently)"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Trash2 size={13} />
                                <span>Tirtir</span>
                              </button>
                            </>
                          )}
                          {!canManage && (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Akhris Keliya</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Register New Teacher */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Qor Macallin Cusub</h2>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {formError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fca5a5',
                      color: '#b91c1c',
                      fontSize: '0.85rem'
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Magaca Macallinka (اسم المعلم بالعربية) *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="مثال: الشيخ عبد الرحمن محمد"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    dir="rtl"
                    required
                    style={{ fontFamily: 'var(--font-arabic)', fontSize: '1rem', textAlign: 'right', fontWeight: 600 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Username-ka Galitaanka *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. teacher_abdirahman"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Furaha Sirta ah (Password) *
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Ugu yaraan 6 xaraf"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Taleefanka
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. +252615000000"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Email (ikhtiyaari)
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. teacher@mahad.edu"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Xaaladda Akoonka (Status)
                  </label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="create_status"
                        checked={isActive}
                        onChange={() => setIsActive(true)}
                      />
                      <span>Shaqaynaya (Active)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="create_status"
                        checked={!isActive}
                        onChange={() => setIsActive(false)}
                      />
                      <span>Xanniban (Inactive)</span>
                    </label>
                  </div>
                </div>

                {/* Class / Group Assignments */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>
                      U Xilsaar Fasallada / Halaqadaha (Class Assignments)
                    </label>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Dooro hal ama dhowr fasal
                    </span>
                  </div>

                  <div
                    style={{
                      maxHeight: '170px',
                      overflowY: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    {groups.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                        Weli ma jiraan halaqado ama fasallo la abuuray.
                      </p>
                    ) : (
                      groups.map(grp => {
                        const isChecked = selectedGroupIds.includes(grp.id);
                        return (
                          <label
                            key={grp.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              backgroundColor: isChecked ? '#e0f2fe' : 'transparent',
                              cursor: 'pointer',
                              marginBottom: '2px',
                              fontSize: '0.85rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleGroupSelection(grp.id)}
                              />
                              <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? '#0369a1' : '#1e293b' }}>
                                {grp.name}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {grp.shift === 'morning' ? 'Subax' : grp.shift === 'afternoon' ? 'Galab' : 'Fiid'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Ka noqo
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Diiwaangelinayaa...' : 'Diiwaangeli Macallinka'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Existing Teacher */}
      {showEditModal && selectedTeacher && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Wax Ka Beddel: {selectedTeacher.full_name}
              </h2>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateTeacher}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {formError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fca5a5',
                      color: '#b91c1c',
                      fontSize: '0.85rem'
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Magaca Macallinka (اسم المعلم بالعربية) *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="مثال: الشيخ عبد الرحمن محمد"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    dir="rtl"
                    required
                    style={{ fontFamily: 'var(--font-arabic)', fontSize: '1rem', textAlign: 'right', fontWeight: 600 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Username (Lama beddeli karo)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={username}
                      disabled
                      style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Furaha Cusub (haddii la baddalayo)
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Ka tag haddii aanad beddeleyn"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Taleefanka
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Xaaladda Macallinka (Status)
                  </label>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="edit_status"
                        checked={isActive}
                        onChange={() => setIsActive(true)}
                      />
                      <span>Shaqaynaya (Active)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="edit_status"
                        checked={!isActive}
                        onChange={() => setIsActive(false)}
                      />
                      <span>Xanniban (Inactive)</span>
                    </label>
                  </div>
                </div>

                {/* Class / Group Assignments */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>
                      Fasallada / Halaqadaha la Xilsaaray (Class Assignments)
                    </label>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Dooro ama ka saar fasallada
                    </span>
                  </div>

                  <div
                    style={{
                      maxHeight: '170px',
                      overflowY: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    {groups.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                        Weli ma jiraan halaqado ama fasallo la abuuray.
                      </p>
                    ) : (
                      groups.map(grp => {
                        const isChecked = selectedGroupIds.includes(grp.id);
                        return (
                          <label
                            key={grp.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              backgroundColor: isChecked ? '#e0f2fe' : 'transparent',
                              cursor: 'pointer',
                              marginBottom: '2px',
                              fontSize: '0.85rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleGroupSelection(grp.id)}
                              />
                              <span style={{ fontWeight: isChecked ? 700 : 500, color: isChecked ? '#0369a1' : '#1e293b' }}>
                                {grp.name}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {grp.shift === 'morning' ? 'Subax' : grp.shift === 'afternoon' ? 'Galab' : 'Fiid'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={submitting}
                >
                  Ka noqo
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Kaydinayaa...' : 'Kaydi Isbeddelada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Teacher Confirmation */}
      {showDeleteModal && selectedTeacher && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626'
                  }}
                >
                  <AlertTriangle size={20} />
                </div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Xaqiiji Tirtiridda Macallinka
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.92rem', color: '#334155', marginBottom: '14px', lineHeight: '1.5' }}>
                Ma hubtaa inaad tirtirto macallinka <strong>{selectedTeacher.full_name}</strong> (@{selectedTeacher.username})?
              </p>

              <div
                style={{
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '0.82rem',
                  color: '#9f1239',
                  lineHeight: '1.5'
                }}
              >
                <strong style={{ display: 'block', color: '#881337', marginBottom: '4px' }}>
                  Digniin: Tirtirid Joogto ah:
                </strong>
                Akoonka macallinka gabi ahaanba waa la tirtiri doonaa xilalka halaqadahana waa laga saarayaa.
                Haddii aad kaliya rabto in macallinku shaqada ka baxo laakiin xogtiisa warbixinnada loo hayo, fadlan isticmaal badhanka <strong>"Kaydi (Archive)"</strong> halkii aad ka tirtiri lahayd.
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={submitting}
              >
                Ka noqo
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={submitting}
              >
                {submitting ? 'Hubinayaa...' : 'Haa, Tirtir Macallinka'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
