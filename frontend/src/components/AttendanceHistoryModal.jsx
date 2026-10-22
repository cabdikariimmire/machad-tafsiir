import { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  X, Calendar, Clock, CheckCircle, AlertCircle, 
  Phone, User, History, Check, Shield
} from 'lucide-react';

export default function AttendanceHistoryModal({ studentId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (studentId) {
      loadHistory();
    }
  }, [studentId]);

  async function loadHistory() {
    try {
      setLoading(true);
      setError('');
      const res = await api.getStudentAttendanceHistory(`?student_id=${studentId}`);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error || 'Khalad ayaa dhacay markii la soo gelinayay taariikhda xaadirinta.');
      }
    } catch (err) {
      setError(err.message || 'Khalad ayaa dhacay.');
    } finally {
      setLoading(false);
    }
  }

  if (!studentId) return null;

  const student = data?.student;
  const summary = data?.summary || { total_sessions: 0, present_count: 0, absent_count: 0, late_count: 0, excused_count: 0, attendance_rate: 0 };
  const history = data?.history || [];

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '850px', 
          width: '95%', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Taariikhda Xaadirinta Ardayga
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                Student Attendance History & Attendance Rate
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #0d9488', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '12px', fontSize: '0.88rem' }}>Soo dejinayaa taariikhda xaadirinta...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: '14px 18px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '10px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {!loading && data && (
            <div>
              {/* Student Info Card */}
              <div style={{ 
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', 
                color: '#ffffff', 
                borderRadius: '12px', 
                padding: '16px 20px', 
                marginBottom: '18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{student?.full_name}</span>
                    {student?.name_ar && (
                      <span style={{ 
                        background: 'rgba(255,255,255,0.15)', 
                        padding: '2px 8px', 
                        borderRadius: '6px', 
                        fontSize: '0.9rem',
                        fontFamily: 'Traditional Arabic, Arial, sans-serif'
                      }}>
                        {student.name_ar}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <span>ID: <strong style={{ color: '#5eead4', fontFamily: 'monospace' }}>{student?.student_id}</strong></span>
                    {student?.phone && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} /> {student.phone}
                      </span>
                    )}
                    {student?.guardian_phone && (
                      <span>Waalidka: {student.guardian_phone}</span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.04em' }}>Boqolkiiba Xaadirinta</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: summary.attendance_rate >= 80 ? '#10b981' : summary.attendance_rate >= 50 ? '#f59e0b' : '#ef4444' }}>
                    {summary.attendance_rate}%
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Wadarta Kulamada</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{summary.total_sessions}</div>
                </div>

                <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: '10px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#065f46', fontWeight: 600 }}>Jooga (Present)</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#047857', marginTop: '2px' }}>{summary.present_count}</div>
                </div>

                <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#991b1b', fontWeight: 600 }}>Maqan (Absent)</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#b91c1c', marginTop: '2px' }}>{summary.absent_count}</div>
                </div>

                <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#92400e', fontWeight: 600 }}>Daahey (Late)</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#b45309', marginTop: '2px' }}>{summary.late_count}</div>
                </div>

                <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#1e40af', fontWeight: 600 }}>Cudurdaar (Excused)</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1d4ed8', marginTop: '2px' }}>{summary.excused_count}</div>
                </div>
              </div>

              {/* History Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                  Liiska Taariikhda Xaadirinta ({history.length} kulan)
                </div>

                <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Taariikhda (Date)</th>
                        <th>Waaxda & Fasalka</th>
                        <th>Xaaladda (Status)</th>
                        <th>Sababta / Xusuusin</th>
                        <th>Diiwaangeliyaha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                            Weli wax xaadirin ah looma diiwaangelin ardaygan (No attendance recorded yet).
                          </td>
                        </tr>
                      ) : (
                        history.map((rec, idx) => {
                          const dateStr = rec.session_date ? new Date(rec.session_date).toISOString().split('T')[0] : '';
                          const isPresent = rec.status === 'present';
                          const isAbsent = rec.status === 'absent';
                          const isLate = rec.status === 'late';
                          const isExcused = rec.status === 'excused';

                          return (
                            <tr key={idx} style={{ backgroundColor: isAbsent ? '#fef2f2' : isLate ? '#fffbeb' : isExcused ? '#f0f9ff' : '#ffffff' }}>
                              <td style={{ fontWeight: 600, color: '#0f172a' }}>
                                <div>{dateStr}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{rec.day_of_week}</div>
                              </td>

                              <td>
                                <span style={{ 
                                  fontSize: '0.72rem', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  marginRight: '6px',
                                  backgroundColor: rec.division === 'quran' ? '#ecfdf5' : '#eff6ff',
                                  color: rec.division === 'quran' ? '#047857' : '#1d4ed8',
                                  fontWeight: 700
                                }}>
                                  {rec.division === 'quran' ? 'Quraan' : 'Machad'}
                                </span>
                                <strong style={{ fontSize: '0.84rem' }}>{rec.class_name}</strong>
                              </td>

                              <td>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.76rem',
                                  fontWeight: 700,
                                  backgroundColor: isPresent ? '#ecfdf5' : isAbsent ? '#fee2e2' : isLate ? '#fef3c7' : '#e0e7ff',
                                  color: isPresent ? '#065f46' : isAbsent ? '#991b1b' : isLate ? '#92400e' : '#3730a3'
                                }}>
                                  {isPresent && '✓ Jooga'}
                                  {isAbsent && '✗ Maqan'}
                                  {isLate && '⏱ Daahey'}
                                  {isExcused && '✉ Cudurdaar'}
                                </span>
                              </td>

                              <td style={{ fontSize: '0.82rem', color: rec.remarks ? '#0f172a' : '#94a3b8' }}>
                                {rec.remarks || '-'}
                              </td>

                              <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                {rec.recorded_by_name || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} style={{ fontWeight: 600 }}>
            Xir (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
