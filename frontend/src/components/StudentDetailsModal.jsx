import { useEffect, useState } from 'react';
import { X, User, CalendarCheck, CreditCard, BookOpen, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function StudentDetailsModal({ studentId, onClose }) {
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    Promise.all([
      api.getStudentById(studentId),
      api.getStudentAttendanceHistory(`?student_id=${encodeURIComponent(studentId)}`).catch(() => null)
    ]).then(([profileRes, attendanceRes]) => {
      if (cancelled) return;
      if (!profileRes?.success) throw new Error(profileRes?.error || 'Xogta ardayga lama helin.');
      setStudent(profileRes.data);
      if (attendanceRes?.success) setAttendance(attendanceRes.data);
    }).catch(err => {
      if (!cancelled) setError(err.message || 'Khalad ayaa dhacay markii xogta ardayga la soo gelinayay.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [studentId]);

  if (!studentId) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '92vh', padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ padding: '16px 22px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Faahfaahinta Buuxda ee Ardayga</h3>
            {student && <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>{student.full_name} · {student.student_id}</div>}
          </div>
          <button type="button" onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ overflowY: 'auto', padding: '20px 22px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Soo diyaarinayaa xogta ardayga...</div>}
          {error && <div style={{ padding: 14, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}><AlertCircle size={16} /> {error}</div>}
          {!loading && student && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 20 }}>
                {[
                  ['Student ID', student.student_id], ['Magaca', student.full_name], ['Magaca Carabiga', student.name_ar],
                  ['Jinsiga', student.gender === 'male' ? 'Lab' : 'Dheddig'], ['Taariikhda dhalashada', student.date_of_birth],
                  ['Telefoonka', student.phone], ['Waalidka / Masuulka', student.guardian_name], ['Telefoonka masuulka', student.guardian_phone],
                  ['Xiriirka', student.guardian_relationship], ['Cinwaanka', student.address], ['Xaaladda', student.is_active ? 'Active' : 'Archived']
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: 11, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 3 }}>{label}</div>
                    <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{value || '—'}</strong>
                  </div>
                ))}
              </div>

              <section style={{ marginBottom: 20 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 10px', color: '#0f766e' }}><BookOpen size={17} /> Diiwaangelinta</h4>
                <div style={{ display: 'grid', gap: 7 }}>
                  {(student.institute_enrollments || []).map(en => <div key={`i-${en.id}`} style={{ padding: 10, border: '1px solid #ccfbf1', borderRadius: 7 }}>Machadka: <strong>{en.class_name}</strong> · {en.academic_year} · {en.status}</div>)}
                  {(student.quran_enrollments || []).map(en => <div key={`q-${en.id}`} style={{ padding: 10, border: '1px solid #fde68a', borderRadius: 7 }}>Quraanka: <strong>{en.group_name}</strong> · {en.level_name || '—'} · {en.status}</div>)}
                  {!student.institute_enrollments?.length && !student.quran_enrollments?.length && <div style={{ color: '#64748b' }}>Diiwaangelin lama helin.</div>}
                </div>
              </section>

              <section style={{ marginBottom: 20 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 10px', color: '#2563eb' }}><CalendarCheck size={17} /> Xaadirinta</h4>
                <div style={{ padding: 12, background: '#eff6ff', borderRadius: 8, marginBottom: 8 }}>Kulamo: <strong>{attendance?.summary?.total_sessions || 0}</strong> · Joogay: <strong>{attendance?.summary?.present_count || 0}</strong> · Maqan: <strong>{attendance?.summary?.absent_count || 0}</strong> · Heerka: <strong>{attendance?.summary?.attendance_rate || 0}%</strong></div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {(attendance?.history || []).slice(0, 20).map((row, index) => <div key={`${row.session_date}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}><span>{row.session_date} · {row.class_name}</span><strong>{row.status}</strong></div>)}
                </div>
              </section>

              <section>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 10px', color: '#7c3aed' }}><CreditCard size={17} /> Maaliyadda</h4>
                <div style={{ padding: 10, background: '#faf5ff', borderRadius: 8, marginBottom: 8 }}>Invoices: <strong>{(student.invoices || []).length}</strong> · Payments: <strong>{(student.payments || []).length}</strong></div>
                {(student.payments || []).slice(0, 10).map(payment => <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}><span>{payment.receipt_number} · {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '—'}</span><strong>${Number(payment.amount_paid || 0).toFixed(2)}</strong></div>)}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
