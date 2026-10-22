import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  X, User, BookOpen, Award, Calendar, DollarSign,
  CheckCircle, Clock, AlertCircle, Bookmark, Check, Shield
} from 'lucide-react';

export default function StudentProfileModal({ studentId, onClose }) {
  const { isTeacher } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'surahs' | 'exams' | 'attendance_fee'
  const [surahFilter, setSurahFilter] = useState('all'); // 'all' | 'completed' | 'in_progress' | 'not_started'
  const [surahSearch, setSurahSearch] = useState('');

  useEffect(() => {
    if (studentId) {
      loadProfile();
    }
  }, [studentId]);

  async function loadProfile() {
    try {
      setLoading(true);
      setError('');
      const res = await api.getQuranStudentSummary(studentId);
      if (res.success) {
        setProfileData(res.data);
      } else {
        setError(res.error || 'Khalad ayaa dhacay markii la soo gelinayay xogta ardayga.');
      }
    } catch (err) {
      setError(err.message || 'Khalad ayaa dhacay.');
    } finally {
      setLoading(false);
    }
  }

  if (!studentId) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1050 }}>
      <div className="modal-content" style={{ maxWidth: '960px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
        
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Xogta Ardayga & Xifdiga Quraanka (Student Profile)
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
              Daba-galka heerka xifdiga, 30-ka Juz, imtixaannada, xaadirinta iyo lacagaha
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '6px', color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #0d9488', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Soo diyaarinayaa xogta ardayga...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '16px' }}>
              <AlertCircle size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
              {error}
            </div>
          )}

          {!loading && profileData && (
            <div>
              {/* Student Header Card */}
              <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                borderRadius: '14px',
                padding: '20px 24px',
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0d9488, #059669)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    boxShadow: '0 4px 10px rgba(13,148,136,0.35)'
                  }}>
                    {profileData.student.name_ar ? profileData.student.name_ar.charAt(0) : profileData.student.full_name.charAt(0)}
                  </div>
                  <div>
                    {profileData.student.name_ar && (
                      <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '1.45rem', fontWeight: 700, color: '#2dd4bf', direction: 'rtl' }}>
                        {profileData.student.name_ar}
                      </div>
                    )}
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2px 0 4px', color: '#f8fafc' }}>
                      {profileData.student.full_name}
                    </h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>
                      <span><strong>ID:</strong> {profileData.student.student_code}</span>
                      <span>•</span>
                      <span><strong>Fasalka/Halaqada:</strong> {profileData.student.group_name || 'Lama qorin'}</span>
                      {profileData.student.teachers?.length > 0 && (
                        <>
                          <span>•</span>
                          <span><strong>Macallinka:</strong> {profileData.student.teachers.map(t => t.full_name).join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Overall Memorization Ring/Pill */}
                <div style={{
                  background: 'rgba(255,255,255,0.08)',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  textAlign: 'right',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Wadarta Xifdiga Guud
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
                    {profileData.memorization.overall_percentage}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                    {profileData.memorization.memorized_verses} / {profileData.memorization.total_verses} aayadood
                  </div>
                </div>
              </div>

              {/* Navigation Sub-Tabs */}
              <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '2px solid #e2e8f0',
                marginBottom: '20px'
              }}>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: activeTab === 'overview' ? '3px solid #0d9488' : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === 'overview' ? '#0d9488' : '#64748b',
                    fontWeight: activeTab === 'overview' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    marginBottom: '-2px'
                  }}
                  onClick={() => setActiveTab('overview')}
                >
                  Guudmar & 30-ka Juz
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: activeTab === 'surahs' ? '3px solid #0d9488' : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === 'surahs' ? '#0d9488' : '#64748b',
                    fontWeight: activeTab === 'surahs' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    marginBottom: '-2px'
                  }}
                  onClick={() => setActiveTab('surahs')}
                >
                  Xifdiga 114-ka Suuradood ({profileData.memorization.completed_surahs_count} dhammaystiran)
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: activeTab === 'exams' ? '3px solid #0d9488' : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === 'exams' ? '#0d9488' : '#64748b',
                    fontWeight: activeTab === 'exams' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    marginBottom: '-2px'
                  }}
                  onClick={() => setActiveTab('exams')}
                >
                  Imtixaannada Quraanka ({profileData.examinations.length})
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: activeTab === 'attendance_fee' ? '3px solid #0d9488' : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === 'attendance_fee' ? '#0d9488' : '#64748b',
                    fontWeight: activeTab === 'attendance_fee' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    marginBottom: '-2px'
                  }}
                  onClick={() => setActiveTab('attendance_fee')}
                >
                  {isTeacher ? 'Xaadirinta' : 'Xaadirinta & Lacagaha'}
                </button>
              </div>

              {/* TAB 1: OVERVIEW & 30 JUZ */}
              {activeTab === 'overview' && (
                <div>
                  {/* KPI Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>JUZ DHAMMAYSATAY</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', margin: '4px 0' }}>
                        {profileData.memorization.completed_juz_count} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>/ 30 Juz</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#059669' }}>
                        {profileData.memorization.completed_juz_list.length > 0 ? `Juz: ${profileData.memorization.completed_juz_list.join(', ')}` : 'Weli lama dhammaystirin'}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>JUZ GACANTA KU JIRA</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', margin: '4px 0' }}>
                        {profileData.memorization.in_progress_juz_count} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>qaybood</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Qayb ahaan la xifdiyay
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SUURADAHA DHAMMAADAY</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0d9488', margin: '4px 0' }}>
                        {profileData.memorization.completed_surahs_count} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>/ 114</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {profileData.memorization.in_progress_surahs_count} socda
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>AAYADAHA LA XIFDIYAY</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7', margin: '4px 0' }}>
                        {profileData.memorization.memorized_verses}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Wadarta: 6,236 aayadood
                      </div>
                    </div>
                  </div>

                  {/* 30 Juz Complete Map */}
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                    Qariiradda 30-ka Juz (Juz Progress Map)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '10px' }}>
                    {profileData.memorization.juz.map(j => {
                      const isComplete = j.is_completed;
                      const hasStarted = j.memorized_verses > 0;

                      return (
                        <div
                          key={j.juz_number}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            border: isComplete ? '2px solid #10b981' : hasStarted ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                            backgroundColor: isComplete ? '#ecfdf5' : hasStarted ? '#fffbeb' : '#ffffff',
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isComplete ? '#047857' : hasStarted ? '#b45309' : '#64748b' }}>
                              Juz {j.juz_number}
                            </span>
                            {isComplete && <CheckCircle size={14} color="#10b981" />}
                          </div>
                          <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '0.85rem', color: isComplete ? '#047857' : '#334155', fontWeight: 600, direction: 'rtl' }}>
                            {j.name_ar}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                            {j.memorized_verses}/{j.total_verses} ({j.percentage}%)
                          </div>
                          <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${j.percentage}%`,
                              height: '100%',
                              backgroundColor: isComplete ? '#10b981' : '#f59e0b'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: SURAHS PROGRESS */}
              {activeTab === 'surahs' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Raadi suurad magac ama lambar..."
                      value={surahSearch}
                      onChange={(e) => setSurahSearch(e.target.value)}
                      style={{ maxWidth: '280px' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['all', 'completed', 'in_progress', 'not_started'].map(f => (
                        <button
                          key={f}
                          type="button"
                          className={`btn btn-sm ${surahFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setSurahFilter(f)}
                        >
                          {f === 'all' && 'Dhammaan (114)'}
                          {f === 'completed' && `Dhammaaday (${profileData.memorization.completed_surahs_count})`}
                          {f === 'in_progress' && `Socda (${profileData.memorization.in_progress_surahs_count})`}
                          {f === 'not_started' && `Aan bilaaban (${profileData.memorization.not_started_surahs_count})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="table-responsive" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>#</th>
                          <th>Magaca Suuradda</th>
                          <th style={{ textAlign: 'right' }}>الاسم بالعربية</th>
                          <th>Aayadaha La Xifdiyay</th>
                          <th>Boqolkiiba (%)</th>
                          <th>Xaaladda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profileData.memorization.surahs
                          .filter(s => {
                            if (surahFilter === 'completed') return s.is_completed;
                            if (surahFilter === 'in_progress') return s.memorized_verses > 0 && !s.is_completed;
                            if (surahFilter === 'not_started') return s.memorized_verses === 0;
                            return true;
                          })
                          .filter(s => {
                            if (!surahSearch) return true;
                            const q = surahSearch.toLowerCase().trim();
                            return (
                              s.number.toString().includes(q) ||
                              s.name_en.toLowerCase().includes(q) ||
                              s.name_ar.includes(q)
                            );
                          })
                          .map(s => (
                            <tr key={s.number}>
                              <td style={{ fontWeight: 700, color: '#64748b' }}>{s.number}</td>
                              <td style={{ fontWeight: 600 }}>{s.name_en}</td>
                              <td style={{ fontFamily: 'var(--font-arabic)', fontSize: '1.05rem', color: '#0d9488', direction: 'rtl', textAlign: 'right' }}>
                                {s.name_ar}
                              </td>
                              <td>{s.memorized_verses} / {s.total_verses} aayadood</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '60px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${s.percentage}%`, height: '100%', backgroundColor: s.is_completed ? '#10b981' : '#0d9488' }} />
                                  </div>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{s.percentage}%</span>
                                </div>
                              </td>
                              <td>
                                {s.is_completed ? (
                                  <span className="badge badge-success">Dhameystiran</span>
                                ) : s.memorized_verses > 0 ? (
                                  <span className="badge badge-warning">Gacanta ku jira</span>
                                ) : (
                                  <span className="badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Aan bilaaban</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: QURAN EXAMINATIONS */}
              {activeTab === 'exams' && (
                <div>
                  <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                      Taariikhda Imtixaannada Quraanka ee Ardayga
                    </h4>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Natiijooyinka imtixaanku waxba kama beddelaan xifdiga aayadaha
                    </span>
                  </div>

                  {profileData.examinations.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                      Ardaygan weli lagama diiwaangelin imtixaan Quraan ah.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Taariikhda</th>
                            <th>Heerka Juz (Range)</th>
                            <th>Dhibcaha Helay</th>
                            <th>Boqolkiiba (%)</th>
                            <th>Natiijada</th>
                            <th>Imtixaamayaha</th>
                            <th>Faallo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileData.examinations.map(ex => (
                            <tr key={ex.id}>
                              <td style={{ fontWeight: 600 }}>{new Date(ex.exam_date).toLocaleDateString()}</td>
                              <td>
                                <span className="badge badge-info" style={{ fontWeight: 700 }}>
                                  Juz {ex.start_juz} ilaa {ex.end_juz}
                                </span>
                              </td>
                              <td>
                                {ex.marks_obtained !== null ? `${ex.marks_obtained} / ${ex.maximum_marks}` : '-'}
                              </td>
                              <td>
                                {ex.score !== null ? (
                                  <span style={{ fontWeight: 700, color: ex.score >= 50 ? '#059669' : '#dc2626' }}>
                                    {ex.score}%
                                  </span>
                                ) : '-'}
                              </td>
                              <td>
                                <span className={`badge ${ex.score >= 50 ? 'badge-success' : 'badge-danger'}`}>
                                  {ex.result || (ex.score >= 50 ? 'Gudbay' : 'Haray')}
                                </span>
                              </td>
                              <td>{ex.examiner_name}</td>
                              <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{ex.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: ATTENDANCE & FEES */}
              {activeTab === 'attendance_fee' && (
                <div style={{ display: 'grid', gridTemplateColumns: isTeacher ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  {/* Attendance Card */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#f8fafc' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} color="#0d9488" />
                      Soo Koobidda Xaadirinta Dugsiga Quraanka
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Kulamada Guud</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                          {profileData.attendance.total_sessions || 0}
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#059669' }}>Waa Joogay</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>
                          {profileData.attendance.present_count || 0}
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>Wuu Maqnaa</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>
                          {profileData.attendance.absent_count || 0}
                        </div>
                      </div>
                      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#d97706' }}>Wuu Daahay</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>
                          {profileData.attendance.late_count || 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fee Card (Hidden completely from teachers) */}
                  {!isTeacher && profileData.fee && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#f8fafc' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DollarSign size={18} color="#0d9488" />
                        Lacagaha Dugsiga Quraanka
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Wadarta Lacagta Ku Dhacday:</span>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            ${parseFloat(profileData.fee.total_due || 0).toFixed(2)}
                          </span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: '#059669' }}>Lacagta La Bixiyay:</span>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#059669' }}>
                            ${parseFloat(profileData.fee.total_paid || 0).toFixed(2)}
                          </span>
                        </div>
                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: '#dc2626' }}>Haraaga Dhiman (Balance):</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>
                            ${parseFloat(profileData.fee.total_balance || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Xir (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
