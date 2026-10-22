import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Search, Plus, Edit, Check, AlertCircle, AlertTriangle, X, GraduationCap, Phone, User, Eye, Trash2, Archive, RotateCcw } from 'lucide-react';
import StudentProfileModal from '../components/StudentProfileModal';

export default function StudentsPage() {
  const { isSuperAdmin, isInstituteAdmin, isQuranAdmin, hasInstituteAccess, hasQuranAccess } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  function showFeedback(type, message) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
  }
  
  // Profile modal state
  const [profileStudentId, setProfileStudentId] = useState(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [gender, setGender] = useState('male');
  const [phone, setPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [enrollInstitute, setEnrollInstitute] = useState(false);
  const [instituteClassId, setInstituteClassId] = useState('');
  const [enrollQuran, setEnrollQuran] = useState(false);
  const [quranGroupId, setQuranGroupId] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchStudents();
    loadClassesAndGroups();
  }, [divisionFilter, statusFilter]);

  async function fetchStudents() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (divisionFilter) params.append('division', divisionFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.getStudents(`?${params.toString()}`);
      if (res.success) {
        setStudents(res.data);
      }
    } catch (e) {
      console.error(e);
      showFeedback('error', 'Khalad ayaa dhacay markii la soo gelinayay ardayda');
    } finally {
      setLoading(false);
    }
  }

  async function handleArchiveStudent(st) {
    const actionName = st.is_active ? 'kaydinayo' : 'dib u hawlgelinayo';
    const confirmMsg = st.is_active 
      ? `Ma hubtaa inaad rabto inaad kaydiso ardayga ${st.name_ar || st.full_name}? Ardaygu wuu ka dhuuman doonaa liisaska firfircoon laakiin xogtisu waxay ku jiri doontaa Warbixinnada.`
      : `Ma hubtaa inaad rabto inaad dib u hawlgeliso ardayga ${st.name_ar || st.full_name}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.archiveStudent(st.id);
      if (res.success) {
        showFeedback('success', res.message || `Ardayga si guul leh ayaa loo ${st.is_active ? 'kaydiyay' : 'soo celiyay'}.`);
        fetchStudents();
      }
    } catch (err) {
      showFeedback('error', err.message || `Khalad ayaa dhacay markii la ${actionName} ardayga.`);
    }
  }

  function handleOpenDelete(st) {
    setStudentToDelete(st);
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    if (!studentToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await api.deleteStudent(studentToDelete.id);
      if (res.success) {
        showFeedback('success', res.message || 'Ardayga si buuxda ayaa looga tirtiray nidaamka.');
        setShowDeleteModal(false);
        setStudentToDelete(null);
        fetchStudents();
      }
    } catch (err) {
      showFeedback('error', err.message || 'Khalad ayaa dhacay markii la tirtirayay ardayga.');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function loadClassesAndGroups() {
    try {
      if (hasInstituteAccess) {
        const clsRes = await api.getClasses();
        if (clsRes.success) setClasses(clsRes.data);
      }
      if (hasQuranAccess) {
        const grpRes = await api.getQuranGroups();
        if (grpRes.success) setGroups(grpRes.data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    fetchStudents();
  }

  function openCreateModal() {
    setEditingStudent(null);
    setFullName('');
    setNameAr('');
    setGender('male');
    setPhone('');
    setGuardianName('');
    setGuardianPhone('');
    setAddress('');
    setNotes('');
    setEnrollInstitute(hasInstituteAccess);
    setInstituteClassId(classes[0]?.id || '');
    setEnrollQuran(hasQuranAccess && !hasInstituteAccess);
    setQuranGroupId(groups[0]?.id || '');
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(st) {
    setEditingStudent(st);
    setFullName(st.full_name);
    setNameAr(st.name_ar || '');
    setGender(st.gender || 'male');
    setPhone(st.phone);
    setGuardianName(st.guardian_name || '');
    setGuardianPhone(st.guardian_phone || '');
    setAddress(st.address || '');
    setNotes(st.notes || '');
    setEnrollInstitute(!!st.institute_class_id);
    setInstituteClassId(st.institute_class_id || '');
    setEnrollQuran(!!st.quran_group_id);
    setQuranGroupId(st.quran_group_id || '');
    setFormError('');
    setShowModal(true);
  }

  async function handleSaveStudent(e) {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (editingStudent) {
        await api.updateStudent(editingStudent.id, {
          full_name: fullName,
          name_ar: nameAr,
          gender,
          phone,
          guardian_name: guardianName,
          guardian_phone: guardianPhone,
          address,
          notes,
          institute_class_id: enrollInstitute ? instituteClassId : null,
          quran_group_id: enrollQuran ? quranGroupId : null
        });
      } else {
        await api.createStudent({
          full_name: fullName,
          name_ar: nameAr,
          gender,
          phone,
          guardian_name: guardianName,
          guardian_phone: guardianPhone,
          address,
          notes,
          enroll_institute: enrollInstitute,
          institute_class_id: instituteClassId,
          enroll_quran: enrollQuran,
          quran_group_id: quranGroupId
        });
      }
      setShowModal(false);
      fetchStudents();
    } catch (err) {
      setFormError(err.message || 'Khalad ayaa dhacay markii la kaydinayay ardayga.');
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            Maamulka Ardayda (Student Directory)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Diiwaanka guud ee ardayda Machadka iyo Dugsiga Quraanka
          </p>
        </div>

        {(isSuperAdmin || isInstituteAdmin || isQuranAdmin) && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} />
            Diiwaangeli Arday Cusub
          </button>
        )}
      </div>

      {/* Feedback Notification */}
      {feedback.message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '8px',
          backgroundColor: feedback.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: feedback.type === 'error' ? '#991b1b' : '#166534',
          border: `1px solid ${feedback.type === 'error' ? '#f87171' : '#86efac'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem',
          fontWeight: 600
        }}>
          {feedback.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ padding: '16px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Raadi magaca, ID-ga, ama taleefanka..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
            </div>

            {isSuperAdmin && (
              <select 
                className="form-select" 
                style={{ width: '180px' }}
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
              >
                <option value="">Dhammaan Waaxyaha</option>
                <option value="institute">Machadka Keliya</option>
                <option value="quran">Quraanka Keliya</option>
              </select>
            )}

            <select 
              className="form-select" 
              style={{ width: '190px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="active">Ardayda Firfircoon (Active)</option>
              <option value="archived">Ardayda Kaydsan (Archived)</option>
              <option value="all">Dhammaan (All Records)</option>
            </select>

            <button type="submit" className="btn btn-secondary">
              Raadi (Search)
            </button>
          </form>
        </div>
      </div>

      {/* Students Data Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Aqoonsiga (ID)</th>
                <th>Magaca Buuxa</th>
                <th>Taleefanka</th>
                <th>Waaxda & Diiwaangelinta</th>
                <th>Masuulka (Guardian)</th>
                <th>Xaaladda</th>
                <th style={{ textAlign: 'right' }}>Waxqabad</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>Soo dejinayaa xogta ardayda...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    Wax arday ah lama helin.
                  </td>
                </tr>
              ) : (
                students.map(st => {
                  const hasInst = !!st.institute_class_id;
                  const hasQur = !!st.quran_group_id;

                  return (
                    <tr key={st.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: '#0f766e', fontSize: '0.85rem' }}>
                          {st.student_id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', direction: 'rtl' }}>
                          {st.name_ar || st.full_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {st.gender === 'male' ? 'Lab (Male)' : 'Dhedig (Female)'}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{st.guardian_phone || st.phone || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {hasInst && (
                            <span className="badge badge-success" style={{ width: 'fit-content' }}>
                              Machad: {st.institute_class_name || 'Fasalka'}
                            </span>
                          )}
                          {hasQur && (
                            <span className="badge badge-warning" style={{ width: 'fit-content' }}>
                              Quraan: {st.quran_group_name || 'Halaqada'}
                            </span>
                          )}
                          {!hasInst && !hasQur && (
                            <span className="badge badge-danger">Lama diiwaangelin</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{st.guardian_name || '-'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{st.guardian_phone || ''}</div>
                      </td>
                      <td>
                        <span className={`badge ${st.is_active ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem' }}>
                          {st.is_active ? 'Firfircoon (Active)' : 'Kaydsan (Archived)'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setProfileStudentId(st.id)}
                          title="Arag Xogta Buuxda"
                          style={{ marginRight: '4px' }}
                        >
                          <Eye size={13} />
                          Arag
                        </button>
                        {(isSuperAdmin || isInstituteAdmin || isQuranAdmin) && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditModal(st)}
                              title="Wax ka beddel"
                              style={{ marginRight: '4px' }}
                            >
                              <Edit size={13} />
                              Beddel
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleArchiveStudent(st)}
                              title={st.is_active ? "Kaydi ardaygan (Archive)" : "Dib u soo celi (Unarchive)"}
                              style={{ marginRight: '4px', borderColor: st.is_active ? '#f59e0b' : '#10b981' }}
                            >
                              {st.is_active ? <Archive size={13} color="#d97706" /> : <RotateCcw size={13} color="#059669" />}
                              <span style={{ marginLeft: '3px', color: st.is_active ? '#b45309' : '#047857' }}>
                                {st.is_active ? 'Kaydi' : 'Soo celi'}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleOpenDelete(st)}
                              title="Tirtir ardaygan (Delete Permanently)"
                            >
                              <Trash2 size={13} />
                              <span style={{ marginLeft: '3px' }}>Tirtir</span>
                            </button>
                          </>
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

      {/* Create / Edit Student Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {editingStudent ? 'Wax ka beddel Ardayga' : 'Diiwaangeli Arday Cusub'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '14px' }}>
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Magaca Ardayga (اسم الطالب بالعربية) *</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Qor magaca rasmiga ah ee Carabiga (RTL)</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={nameAr}
                    onChange={(e) => {
                      setNameAr(e.target.value);
                      setFullName(e.target.value);
                    }}
                    placeholder="مثال: أحمد عبد الله محمد"
                    dir="rtl"
                    required
                    style={{ fontFamily: 'var(--font-arabic)', fontSize: '1.05rem', textAlign: 'right', fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Jinsiga (Gender) *</label>
                    <select className="form-select" value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="male">Lab (Male)</option>
                      <option value="female">Dhedig (Female)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Taleefanka Waalidka / Masuulka *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={guardianPhone}
                      onChange={(e) => {
                        setGuardianPhone(e.target.value);
                        setPhone(e.target.value);
                      }}
                      placeholder="+25261..."
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Magaca Waalidka / Masuulka (Carabi)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="مثال: عبد الله محمد علي"
                      dir="rtl"
                      style={{ textAlign: 'right' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cinwaanka (Deegaanka)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Degmada, Xaafadda..."
                    />
                  </div>
                </div>

                {/* Division Enrollment Options (Shared Identity) */}
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f766e', marginBottom: '10px' }}>
                    Diiwaangelinta Waaxyaha (Division Enrollments)
                  </h4>

                  {hasInstituteAccess && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={enrollInstitute}
                          onChange={(e) => setEnrollInstitute(e.target.checked)}
                        />
                        U qor Waaxda Machadka (Institute)
                      </label>
                      {enrollInstitute && (
                        <div style={{ marginTop: '8px', paddingLeft: '24px' }}>
                          <select
                            className="form-select"
                            value={instituteClassId}
                            onChange={(e) => setInstituteClassId(e.target.value)}
                            required={enrollInstitute}
                          >
                            <option value="">-- Dooro Fasalka Machadka --</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {hasQuranAccess && (
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={enrollQuran}
                          onChange={(e) => setEnrollQuran(e.target.checked)}
                        />
                        U qor Dugsiga Quraanka (Quran School)
                      </label>
                      {enrollQuran && (
                        <div style={{ marginTop: '8px', paddingLeft: '24px' }}>
                          <select
                            className="form-select"
                            value={quranGroupId}
                            onChange={(e) => setQuranGroupId(e.target.value)}
                            required={enrollQuran}
                          >
                            <option value="">-- Dooro Halaqada Quraanka --</option>
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name} ({g.shift})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Ka noqo
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Kaydinayaa...' : 'Kaydi Ardayga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      {profileStudentId && (
        <StudentProfileModal
          studentId={profileStudentId}
          onClose={() => {
            setProfileStudentId(null);
            fetchStudents();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && studentToDelete && (
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
                    Xaqiiji Tirtiridda Joogtada ah (Permanent Delete)
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#b91c1c', margin: '2px 0 0 0' }}>
                    Ficilkan lagama noqon karo marka la fuliyo!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setStudentToDelete(null); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, margin: '0 0 14px 0' }}>
                Ma hubtaa inaad rabto inaad si joogto ah u tirtirto ardayga{' '}
                <strong style={{ color: '#0f172a' }}>{studentToDelete.name_ar || studentToDelete.full_name}</strong>{' '}
                (ID: <span style={{ color: '#0f766e', fontWeight: 700 }}>{studentToDelete.student_id}</span>)?
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
                <div style={{ fontWeight: 700 }}>Digniin: Xogaha lala tirtiri doono waxaa ka mid ah:</div>
                <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                  <li>Dhammaan qaansheegyada iyo lacag bixinnada</li>
                  <li>Diiwaanka imaanshaha iyo maqnaanshaha</li>
                  <li>Dhibcaha imtixaannada Machadka iyo Quraanka</li>
                  <li>Diiwaanka xifdiga iyo horumarka kutubta</li>
                </ul>
                <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                  * Haddii aad rabto inaad xogta u ilaaliso warbixinnada laakiin ka dhuumato liiska, isticmaal badhanka <strong>"Kaydi (Archive)"</strong> halkii aad ka tirtiri lahayd.
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleteLoading}
                onClick={() => { setShowDeleteModal(false); setStudentToDelete(null); }}
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
