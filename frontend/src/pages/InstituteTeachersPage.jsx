import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function InstituteTeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (!classId) { setClassSubjects([]); setSubjectId(''); return; }
    api.getClassSubjects(classId).then(res => {
      const list = res.success ? (res.data || []) : [];
      setClassSubjects(list);
      setSubjectId(prev => list.some(s => String(s.id) === String(prev)) ? prev : String(list[0]?.id || ''));
    }).catch(err => showFeedback('error', err.message));
  }, [classId]);

  function showFeedback(type, message) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
  }

  async function loadData() {
    try {
      setLoading(true);
      const [teacherRes, classRes, assignmentRes] = await Promise.all([
        api.getInstituteTeachers(), api.getClasses(), api.getInstituteTeacherAssignments()
      ]);
      if (teacherRes.success) setTeachers(teacherRes.data || []);
      if (classRes.success) {
        const list = classRes.data || [];
        setClasses(list);
        setClassId(prev => prev || String(list[0]?.id || ''));
      }
      if (assignmentRes.success) setAssignments(assignmentRes.data || []);
    } catch (err) {
      showFeedback('error', err.message || 'Xogta macallimiinta lama soo gelin karin.');
    } finally { setLoading(false); }
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!teacherId || !classId || !subjectId) return;
    try {
      setSaving(true);
      const res = await api.assignInstituteTeacher({ teacher_id: Number(teacherId), class_id: Number(classId), subject_id: Number(subjectId) });
      showFeedback('success', res.message || 'Macallinka waa la xilsaaray.');
      setTeacherId('');
      const assignmentRes = await api.getInstituteTeacherAssignments();
      if (assignmentRes.success) setAssignments(assignmentRes.data || []);
    } catch (err) { showFeedback('error', err.message || 'Xilsaarka lama kaydin karin.'); }
    finally { setSaving(false); }
  }

  async function handleRemove(assignment) {
    if (!window.confirm(`Ma ka saartaa ${assignment.teacher_name} maaddada ${assignment.subject_name}?`)) return;
    try {
      await api.removeInstituteTeacherAssignment(assignment.id);
      setAssignments(prev => prev.filter(item => item.id !== assignment.id));
      showFeedback('success', 'Xilsaarka waa laga saaray.');
    } catch (err) { showFeedback('error', err.message || 'Xilsaarka lama saari karin.'); }
  }

  const activeTeachers = useMemo(() => teachers.filter(t => t.is_active), [teachers]);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Macallimiinta Machadka</h1>
        <p style={{ color: '#64748b', fontSize: '0.86rem' }}>Ku xilsaar macallin fasal iyo maaddo si uu u hubiyo xaadirinta maaddadiisa.</p>
      </div>
      {feedback.message && <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: feedback.type === 'error' ? '#fef2f2' : '#f0fdf4', color: feedback.type === 'error' ? '#991b1b' : '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>{feedback.type === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{feedback.message}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus size={18} color="#0f766e" /> Xilsaar Macallin</h3>
          <form onSubmit={handleAssign} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'end' }}>
            <div className="form-group"><label className="form-label">Macallinka</label><select className="form-select" value={teacherId} onChange={e => setTeacherId(e.target.value)} required><option value="">-- Dooro --</option>{activeTeachers.map(t => <option key={t.id} value={t.id}>{t.full_name} (@{t.username})</option>)}</select></div>
            <div className="form-group"><label className="form-label">Fasalka</label><select className="form-select" value={classId} onChange={e => setClassId(e.target.value)} required>{classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>)}</select></div>
            <div className="form-group"><label className="form-label">Maaddada</label><select className="form-select" value={subjectId} onChange={e => setSubjectId(e.target.value)} required><option value="">-- Dooro --</option>{classSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select></div>
            <button type="submit" className="btn btn-primary" disabled={saving || !subjectId}>{saving ? 'Waa la kaydinayaa...' : 'Xilsaar'}</button>
          </form>
          {activeTeachers.length === 0 && <div style={{ marginTop: 12, color: '#b45309', fontSize: '0.82rem' }}>Marka hore ka samee Users & Roles user leh doorka Teacher.</div>}
        </div>
      </div>

      <div className="card"><div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 className="card-title">Xilsaarrada Maaddooyinka</h3><button className="btn btn-secondary btn-sm" onClick={loadData}><RefreshCw size={14} /> Cusboonaysii</button></div><div className="table-container"><table className="data-table"><thead><tr><th>Macallin</th><th>Fasal</th><th>Maaddo</th><th style={{ textAlign: 'right' }}>Hawl</th></tr></thead><tbody>{loading ? <tr><td colSpan="4" style={{ textAlign: 'center', padding: 30 }}>Waa la soo gelinayaa...</td></tr> : assignments.length === 0 ? <tr><td colSpan="4" style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>Weli xil saarid ma jirto.</td></tr> : assignments.map(a => <tr key={a.id}><td><strong>{a.teacher_name}</strong></td><td>{a.class_name}</td><td><span className="badge badge-info">{a.subject_name}</span></td><td style={{ textAlign: 'right' }}><button className="btn btn-secondary btn-sm" onClick={() => handleRemove(a)} title="Ka saar xilsaarka"><Trash2 size={14} /></button></td></tr>)}</tbody></table></div></div>
    </div>
  );
}
