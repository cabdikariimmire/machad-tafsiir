import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Users,
  Plus,
  Shield,
  UserX,
  UserCheck,
  X,
  Edit2,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  AlertTriangle
} from 'lucide-react';

export default function UsersPage() {
  const { isSuperAdmin, isInstituteAdmin, isQuranAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Delete User Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Create Modal
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [divisionScope, setDivisionScope] = useState('institute');
  const [formError, setFormError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  // Edit User Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editDivisionScope, setEditDivisionScope] = useState('institute');
  const [editFormError, setEditFormError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  useEffect(() => {
    loadUsersAndRoles();
  }, []);

  function handleOpenDelete(u) {
    setUserToDelete(u);
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    if (!userToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await api.deleteUser(userToDelete.id);
      if (res.success) {
        showMessage('success', res.message || 'Isticmaalaha si buuxda ayaa looga tirtiray nidaamka.');
        setShowDeleteModal(false);
        setUserToDelete(null);
        await loadUsersAndRoles();
      }
    } catch (err) {
      showMessage('error', err.message || 'Khalad ayaa dhacay markii la tirtirayay isticmaalaha.');
    } finally {
      setDeleteLoading(false);
    }
  }

  function showMessage(type, message) {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 6000);
  }

  async function loadUsersAndRoles() {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([
        api.getUsers(),
        api.getRoles()
      ]);
      if (uRes.success) setUsers(uRes.data || []);
      if (rRes.success) {
        setRoles(rRes.data || []);
        if (rRes.data && rRes.data.length > 0 && !roleId) {
          setRoleId(rRes.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
      showMessage('error', 'Cilad ayaa dhacday markii la soo qaadayay isticmaalayaasha.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(userId) {
    try {
      const res = await api.toggleUserStatus(userId);
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: res.is_active } : u));
        showMessage('success', `Xaaladda isticmaalaha waxaa loo beddelay ${res.is_active ? 'Active' : 'Inactive'}.`);
      }
    } catch (err) {
      showMessage('error', err.message || 'Cilad ayaa dhacday.');
    }
  }

  function handleOpenCreate() {
    setUsername('');
    setPassword('');
    setFullName('');
    setEmail('');
    setPhone('');
    setFormError('');
    if (roles.length > 0) setRoleId(roles[0].id);
    setDivisionScope(isInstituteAdmin ? 'institute' : isQuranAdmin ? 'quran' : 'institute');
    setShowModal(true);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setFormError('');
    setCreateSaving(true);
    try {
      await api.createUser({
        username,
        password,
        full_name: fullName,
        email,
        phone,
        role_id: roleId,
        division_scope: isSuperAdmin ? divisionScope : (isInstituteAdmin ? 'institute' : 'quran')
      });
      setShowModal(false);
      showMessage('success', `Isticmaalaha '${username}' si guul leh ayaa loo abuuray.`);
      await loadUsersAndRoles();
    } catch (err) {
      setFormError(err.message || 'Khalad ayaa dhacay markii isticmaalaha la abuurayay.');
    } finally {
      setCreateSaving(false);
    }
  }

  function handleOpenEdit(u) {
    setEditUserId(u.id);
    setEditUsername(u.username || '');
    setEditFullName(u.full_name || '');
    setEditEmail(u.email || '');
    setEditPhone(u.phone || '');
    setEditRoleId(u.role_id || (roles[0]?.id || ''));
    setEditDivisionScope(u.division_scope || 'institute');
    setEditFormError('');
    setShowEditModal(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setEditFormError('');
    if (!editUsername.trim()) {
      setEditFormError('Fadlan geli magaca isticmaalaha (username).');
      return;
    }
    if (!editFullName.trim()) {
      setEditFormError('Fadlan geli magaca buuxa.');
      return;
    }
    setEditSaving(true);
    try {
      const res = await api.updateUser(editUserId, {
        username: editUsername.trim(),
        full_name: editFullName.trim(),
        email: editEmail ? editEmail.trim() : null,
        phone: editPhone ? editPhone.trim() : null,
        role_id: editRoleId,
        division_scope: isSuperAdmin ? editDivisionScope : undefined
      });
      if (res.success) {
        setShowEditModal(false);
        showMessage('success', `Xogta isticmaalaha '${editUsername}' si guul leh ayaa loo cusbooneysiiyay.`);
        await loadUsersAndRoles();
      } else {
        setEditFormError(res.error || 'Cusboonaysiintu waa fashilantay.');
      }
    } catch (err) {
      setEditFormError(err.message || 'Cilad ayaa dhacday markii xogta la cusbooneysiinayay.');
    } finally {
      setEditSaving(false);
    }
  }

  function handleOpenResetPassword(u) {
    setResetUser(u);
    setResetNewPassword('');
    setResetConfirmPassword('');
    setShowPasswordText(false);
    setResetError('');
    setShowResetModal(true);
  }

  function handleGeneratePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetNewPassword(pwd);
    setResetConfirmPassword(pwd);
    setShowPasswordText(true);
  }

  async function handleSaveResetPassword(e) {
    e.preventDefault();
    setResetError('');
    if (!resetNewPassword || resetNewPassword.length < 4) {
      setResetError('Fadlan geli fure cusub oo ugu yaraan 4 xaraf ka kooban.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Labada fure ee aad gelisay isma laha (Furayaashu ma matches-gareynayaan).');
      return;
    }
    setResetSaving(true);
    try {
      const res = await api.resetUserPassword(resetUser.id, resetNewPassword);
      if (res.success) {
        setShowResetModal(false);
        showMessage(
          'success',
          `Furaha cusub ee '${resetUser.full_name}' (@${resetUser.username}) si guul leh ayaa loo dejiyay.`
        );
      } else {
        setResetError(res.error || 'Dib u dejinta furaha waa fashilantay.');
      }
    } catch (err) {
      setResetError(err.message || 'Cilad ayaa dhacday markii furaha la cusbooneysiinayay.');
    } finally {
      setResetSaving(false);
    }
  }

  const canManageUsers = isSuperAdmin || isInstituteAdmin || isQuranAdmin;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            Maamulka Shaqaalaha & Doorka (Users & Roles)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Abuurista shaqaalaha, wax ka beddelka xogta, dib u dejinta furayaasha, iyo maamulka xaaladda
          </p>
        </div>

        {canManageUsers && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Abuur Isticmaale Cusub
          </button>
        )}
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

      {/* Users Table Card */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Magaca Isticmaalaha</th>
                <th>Magaca Buuxa</th>
                <th>Doorka (Role)</th>
                <th>Xadka Waaxda (Scope)</th>
                <th>Xiriirka (Email/Phone)</th>
                <th>Xaaladda</th>
                <th style={{ textAlign: 'right' }}>Waxqabad</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: '8px' }} />
                    Soo dejinayaa isticmaalayaasha...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    Wax isticmaale ah lama helin.
                  </td>
                </tr>
              ) : (
                users.map(u => {
                  const isTargetSuperAdmin = u.role_name === 'super_admin';
                  const canEditThisUser =
                    isSuperAdmin ||
                    (isInstituteAdmin && u.division_scope === 'institute' && !isTargetSuperAdmin) ||
                    (isQuranAdmin && u.division_scope === 'quran' && !isTargetSuperAdmin);

                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.username}</strong>
                      </td>
                      <td>{u.full_name}</td>
                      <td>
                        <span className="badge badge-info">{u.role_display || u.role_name}</span>
                      </td>
                      <td>
                        <span className={`badge ${u.division_scope === 'all' ? 'badge-success' : u.division_scope === 'institute' ? 'badge-info' : 'badge-warning'}`}>
                          {u.division_scope}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {u.email || ''} {u.phone ? `(${u.phone})` : ''}
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {canEditThisUser ? (
                          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {/* Edit User Button */}
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleOpenEdit(u)}
                              title="Wax ka beddel xogta isticmaalaha"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit2 size={13} />
                              <span>Wax ka beddel</span>
                            </button>

                            {/* Reset Password Button */}
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleOpenResetPassword(u)}
                              title="Dib u deji furaha isticmaalaha haddii uu lumo"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderColor: '#f59e0b', color: '#b45309' }}
                            >
                              <Key size={13} />
                              <span>Beddel Furaha</span>
                            </button>

                            {/* Toggle Active / Inactive */}
                            <button
                              type="button"
                              className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-success'}`}
                              onClick={() => handleToggleStatus(u.id)}
                              title={u.is_active ? 'Xannib isticmaalaha' : 'Fur isticmaalaha'}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              {u.is_active ? <UserX size={13} color="#e11d48" /> : <UserCheck size={13} color="#059669" />}
                              <span>{u.is_active ? 'Xannib' : 'Fur'}</span>
                            </button>

                            {/* Delete User Button (Cannot delete self) */}
                            {u.id !== currentUser?.id && (
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => handleOpenDelete(u)}
                                title="Tirtir isticmaalaha (Delete Permanently)"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Trash2 size={13} />
                                <span>Tirtir</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Xadidan (Protected)</span>
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

      {/* ======================================================== */}
      {/* 1. CREATE USER MODAL                                      */}
      {/* ======================================================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Abuur Isticmaale Cusub</h3>
              <button type="button" onClick={() => setShowModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Magaca Gelitaanka (Username) *</label>
                  <input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="e.g. macallin_cali" />
                </div>

                <div className="form-group">
                  <label className="form-label">Furaha Sirta ah (Password) *</label>
                  <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} placeholder="Ugu yaraan 4 xaraf" />
                </div>

                <div className="form-group">
                  <label className="form-label">Magaca Buuxa *</label>
                  <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Cali Nuur Axmed" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@mahad.edu" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Taleefanka</label>
                    <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+252..." />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Doorka (Role) *</label>
                    <select className="form-select" value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.display_name || r.name}</option>
                      ))}
                    </select>
                  </div>

                  {isSuperAdmin ? (
                    <div className="form-group">
                      <label className="form-label">Xadka Waaxda (Scope) *</label>
                      <select className="form-select" value={divisionScope} onChange={(e) => setDivisionScope(e.target.value)}>
                        <option value="institute">Machadka (Institute)</option>
                        <option value="quran">Dugsiga Quraanka (Quran)</option>
                        <option value="all">Dhammaan (All Divisions)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Xadka Waaxda</label>
                      <input className="form-input" value={isInstituteAdmin ? 'Machadka (Institute)' : 'Dugsiga Quraanka'} disabled />
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Ka noqo</button>
                <button type="submit" className="btn btn-primary" disabled={createSaving}>
                  {createSaving ? 'Abuurayaa...' : 'Abuur Isticmaalaha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EDIT USER MODAL                                        */}
      {/* ======================================================== */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="#0d9488" />
                <span>Wax ka Beddel Isticmaalaha</span>
              </h3>
              <button type="button" onClick={() => setShowEditModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                {editFormError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span>{editFormError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Magaca Gelitaanka (Username) *</label>
                  <input
                    className="form-input"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                  />
                  <small style={{ color: '#64748b', fontSize: '0.78rem' }}>Magacan ayuu isticmaaluhu ku galayaa nidaamka.</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Magaca Buuxa *</label>
                  <input
                    className="form-input"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Taleefanka</label>
                    <input
                      className="form-input"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Doorka (Role) *</label>
                    <select
                      className="form-select"
                      value={editRoleId}
                      onChange={(e) => setEditRoleId(e.target.value)}
                      required
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.display_name || r.name}</option>
                      ))}
                    </select>
                  </div>

                  {isSuperAdmin ? (
                    <div className="form-group">
                      <label className="form-label">Xadka Waaxda (Scope) *</label>
                      <select
                        className="form-select"
                        value={editDivisionScope}
                        onChange={(e) => setEditDivisionScope(e.target.value)}
                      >
                        <option value="institute">Machadka (Institute)</option>
                        <option value="quran">Dugsiga Quraanka (Quran)</option>
                        <option value="all">Dhammaan (All Divisions)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Xadka Waaxda</label>
                      <input className="form-input" value={editDivisionScope} disabled />
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Ka noqo</button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                  {editSaving ? 'Kaydinayaa...' : 'Kaydi Isbeddelka'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. RESET PASSWORD MODAL                                   */}
      {/* ======================================================== */}
      {showResetModal && resetUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="#d97706" />
                <span>Dib u Deji Furaha Sirta ah</span>
              </h3>
              <button type="button" onClick={() => setShowResetModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveResetPassword}>
              <div className="modal-body">
                {/* Target User Summary Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Isticmaalaha la beddelayo furahiisa:</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {resetUser.full_name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#0d9488', fontWeight: 600 }}>
                    @{resetUser.username} ({resetUser.role_display || resetUser.role_name})
                  </div>
                </div>

                {resetError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    <span>{resetError}</span>
                  </div>
                )}

                {/* Generate Quick Password helper */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px' }}
                  >
                    <Sparkles size={13} color="#d97706" />
                    <span>Soo Saar Fure Toos ah (Auto-generate)</span>
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Furaha Cusub (New Password) *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      className="form-input"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      required
                      minLength={4}
                      placeholder="Geli fure cusub (ugu yaraan 4 xaraf)"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                      title={showPasswordText ? 'Qari furaha' : 'Muuji furaha'}
                    >
                      {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Xaqiiji Furaha Cusub (Confirm Password) *</label>
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    className="form-input"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    required
                    minLength={4}
                    placeholder="Ku celi furaha cusub"
                  />
                </div>

                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: '#92400e' }}>
                  💡 <strong>Ogeysiis:</strong> Marka aad kaydiso, isla markiiba sii furahan cusub isticmaalaha si uu ugu soo galo akoonkiisa.
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Ka noqo</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={resetSaving}
                  style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}
                >
                  {resetSaving ? 'Cusbooneysiinayaa...' : 'Cusbooneysii Furaha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
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
                    Xaqiiji Tirtiridda Isticmaalaha
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#b91c1c', margin: '2px 0 0 0' }}>
                    Ficilkan lagama noqon karo marka la fuliyo!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, margin: '0 0 14px 0' }}>
                Ma hubtaa inaad rabto inaad si joogto ah u tirtirto isticmaalaha{' '}
                <strong style={{ color: '#0f172a' }}>{userToDelete.full_name}</strong>{' '}
                (@<span style={{ color: '#0f766e', fontWeight: 700 }}>{userToDelete.username}</span>)?
              </p>

              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                fontSize: '0.8rem',
                color: '#9f1239',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ fontWeight: 700 }}>Digniin:</div>
                <div>
                  Akoonkan gabi ahaanba waa la tirtiri doonaa loomana isticmaali karo in nidaamka lagu galo. Haddii aad kaliya rabto inaad shaqada ka joojiso, isticmaal badhanka <strong>"Xannib (Disable)"</strong>.
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleteLoading}
                onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}
              >
                Ka noqo (Cancel)
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} />
                {deleteLoading ? 'Tirtirayaa...' : 'Haa, Tirtir Joogto ah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
