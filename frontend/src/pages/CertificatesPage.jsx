import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Award, Search, Printer, CheckCircle, AlertTriangle,
  User, Calendar, FileText, RefreshCw, X, ShieldCheck
} from 'lucide-react';

export default function CertificatesPage() {
  const { user, isSuperAdmin, isQuranAdmin, isExamOfficer } = useAuth();
  const canIssue = isSuperAdmin || isQuranAdmin || isExamOfficer;

  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Groups and Students for Issuing Form
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupStudents, setGroupStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSummary, setStudentSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Form Fields
  const [certificateType, setCertificateType] = useState('full_quran');
  const [juzCompleted, setJuzCompleted] = useState(30);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [issuing, setIssuing] = useState(false);

  // Print / View Certificate Modal
  const [selectedCertificate, setSelectedCertificate] = useState(null);

  // Feedback
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  function showMessage(type, message) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 6000);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [certRes, grpRes] = await Promise.all([
        api.getQuranCertificates(),
        api.getQuranGroups()
      ]);

      if (certRes.success) setCertificates(certRes.data || []);
      if (grpRes.success && grpRes.data?.length > 0) {
        setGroups(grpRes.data);
        setSelectedGroupId(grpRes.data[0].id.toString());
      }
    } catch (err) {
      console.error(err);
      showMessage('error', 'Lama soo kicin karo xogta shahaadooyinka.');
    } finally {
      setLoading(false);
    }
  }

  // Load students when group changes
  useEffect(() => {
    if (selectedGroupId) {
      loadStudentsForGroup(selectedGroupId);
    } else {
      setGroupStudents([]);
      setSelectedStudentId('');
    }
  }, [selectedGroupId]);

  async function loadStudentsForGroup(gId) {
    try {
      const res = await api.getGroupStudents(gId);
      if (res.success) {
        setGroupStudents(res.data || []);
        if (res.data?.length > 0) {
          setSelectedStudentId(res.data[0].id.toString());
        } else {
          setSelectedStudentId('');
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // When student changes, load their verified memorization summary
  useEffect(() => {
    if (selectedStudentId) {
      loadStudentVerifiedSummary(selectedStudentId);
    } else {
      setStudentSummary(null);
    }
  }, [selectedStudentId]);

  async function loadStudentVerifiedSummary(sId) {
    try {
      setSummaryLoading(true);
      const res = await api.getQuranStudentSummary(sId);
      if (res.success) {
        setStudentSummary(res.data);
        const compJuz = res.data.memorization?.completed_juz_count || 0;
        if (compJuz >= 30) {
          setCertificateType('full_quran');
          setJuzCompleted(30);
        } else if (compJuz > 0) {
          setCertificateType('juz_range');
          setJuzCompleted(compJuz);
        } else {
          setCertificateType('single_juz');
          setJuzCompleted(1);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleIssueCertificate(e) {
    e.preventDefault();
    if (!selectedStudentId) {
      showMessage('error', 'Fadlan dooro ardayga shahaadada la siinayo.');
      return;
    }

    const verifiedJuz = studentSummary?.memorization?.completed_juz_count || 0;
    const requestedJuz = parseInt(juzCompleted, 10);

    if (verifiedJuz < requestedJuz) {
      showMessage(
        'error',
        `Ardaygu ma buuxin shuruudda: Wuxuu si xaqiiq ah u xifdiyay ${verifiedJuz} Juz oo keliya, laakiin waxaa la codsaday ${requestedJuz} Juz.`
      );
      return;
    }

    try {
      setIssuing(true);
      const res = await api.issueQuranCertificate({
        student_id: selectedStudentId,
        certificate_type: certificateType,
        juz_completed: requestedJuz,
        issue_date: issueDate,
        remarks: remarks.trim() || null
      });

      if (res.success) {
        showMessage('success', `Shahaadada si guul leh ayaa loo bixiyay! Lambarka: ${res.data.certificate_number}`);
        setRemarks('');
        // Reload certificates list
        const updated = await api.getQuranCertificates();
        if (updated.success) setCertificates(updated.data || []);
      }
    } catch (err) {
      console.error(err);
      showMessage('error', err.message || 'Khalad ayaa dhacay markii la bixinayay shahaadada.');
    } finally {
      setIssuing(false);
    }
  }

  function handlePrintCertificate() {
    window.print();
  }

  const verifiedJuzCount = studentSummary?.memorization?.completed_juz_count || 0;
  const isEligibleForAny = verifiedJuzCount > 0;

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 4px' }}>
            <Award size={28} color="#0d9488" />
            Shahaadooyinka Quraanka (Quran Certificates)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
            Bixinta shahaadooyinka xifdiga Quraanka Kariimka oo ku saleysan aayadaha dhabta ah ee la hubiyay
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadData}
          title="Dib u cusbooneysii"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Cusbooneysii</span>
        </button>
      </div>

      {/* Global Feedback */}
      {feedback.message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: feedback.type === 'success' ? '#ecfdf5' : '#fee2e2',
          color: feedback.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Grid: Issuing Form + History Table */}
      <div style={{ display: 'grid', gridTemplateColumns: canIssue ? 'repeat(auto-fit, minmax(360px, 1fr))' : '1fr', gap: '20px' }}>
        
        {/* Issuing Form (Authorized Users) */}
        {canIssue && (
          <div className="card" style={{ padding: '22px' }}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                Bixi Shahaado Cusub
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Shahaadada waxaa la bixin karaa oo keliya marka ardaygu dhammaystiro aayadaha Juz-ka
              </p>
            </div>

            <form onSubmit={handleIssueCertificate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Group Selector */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    1. Fasalka / Halaqada: *
                  </label>
                  <select
                    className="form-select"
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    required
                  >
                    <option value="">-- Dooro Fasal --</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.shift === 'morning' ? 'Subax' : g.shift === 'afternoon' ? 'Galab' : 'Fiid'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Student Selector */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    2. Ardayga: *
                  </label>
                  <select
                    className="form-select"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    required
                    disabled={groupStudents.length === 0}
                  >
                    {groupStudents.length === 0 ? (
                      <option value="">-- Fasikan arday kuma jiraan --</option>
                    ) : (
                      groupStudents.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.student_id} - {s.full_name} {s.name_ar ? `(${s.name_ar})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Verified Memorization Status Card */}
                {summaryLoading ? (
                  <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                    Hubinayaa xifdiga ardayga...
                  </div>
                ) : studentSummary && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: isEligibleForAny ? '#ecfdf5' : '#fffbeb',
                    border: `1px solid ${isEligibleForAny ? '#a7f3d0' : '#fde68a'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isEligibleForAny ? '#047857' : '#b45309', textTransform: 'uppercase' }}>
                        Xifdiga La Hubiyay (Verified):
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: isEligibleForAny ? '#065f46' : '#92400e' }}>
                        {verifiedJuzCount} / 30 Juz Dhammaystiran
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {studentSummary.memorization.memorized_verses} / {studentSummary.memorization.total_verses} aayadood ({studentSummary.memorization.overall_percentage}%)
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {verifiedJuzCount >= 30 ? (
                        <span className="badge badge-success" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                          ✓ Full Quran (30 Juz)
                        </span>
                      ) : verifiedJuzCount > 0 ? (
                        <span className="badge badge-info" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                          ✓ {verifiedJuzCount} Juz Buuxa
                        </span>
                      ) : (
                        <span className="badge badge-warning" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                          Ma dhammaystirin 1 Juz
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Certificate Type */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    3. Nooca Shahaadada: *
                  </label>
                  <select
                    className="form-select"
                    value={certificateType}
                    onChange={(e) => {
                      setCertificateType(e.target.value);
                      if (e.target.value === 'full_quran') setJuzCompleted(30);
                    }}
                    required
                  >
                    <option value="full_quran">Dhameystirka Quraanka oo Dhan (30 Juz)</option>
                    <option value="juz_range">Heer Juz (e.g. 5, 10, 15, 20 Juz)</option>
                    <option value="single_juz">Hal Juz (Single Juz)</option>
                  </select>
                </div>

                {/* Juz Completed Count */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    4. Tirada Juz ee Shahaadada: *
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={juzCompleted}
                    onChange={(e) => setJuzCompleted(parseInt(e.target.value, 10) || 1)}
                    min="1"
                    max="30"
                    disabled={certificateType === 'full_quran'}
                    required
                  />
                  {verifiedJuzCount < juzCompleted && (
                    <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>
                      Digniin: Ardaygu wuxuu si dhab ah u dhameeyay {verifiedJuzCount} Juz oo keliya.
                    </span>
                  )}
                </div>

                {/* Issue Date */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    5. Taariikhda Bixinta: *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                  />
                </div>

                {/* Remarks */}
                <div>
                  <label className="form-label">
                    Faahfaahin / Xusuusin:
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Faallo ku saabsan dadaalka ardayga ama xaaladda bixinta..."
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={issuing || !selectedStudentId || verifiedJuzCount < juzCompleted}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', fontWeight: 700, marginTop: '6px' }}
                >
                  <ShieldCheck size={18} />
                  {issuing ? 'Bixinayaa Shahaadada...' : 'Bixi Shahaadada (Issue Certificate)'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Certificates History Table */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                Diiwaanka Shahaadooyinka La Bixiyay
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Wadarta shahaadooyinka: <strong>{certificates.length}</strong>
              </p>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '0.85rem', width: '220px' }}
                placeholder="Raadi shahaado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lambarka</th>
                  <th>Ardayga</th>
                  <th>Nooca & Juz</th>
                  <th>Taariikhda</th>
                  <th>Bixiyaha</th>
                  <th style={{ textAlign: 'right' }}>Daabac</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>Soo kicinayaa shahaadooyinka...</td></tr>
                ) : certificates.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Weli wax shahaado ah lama bixin.</td></tr>
                ) : (
                  certificates
                    .filter(c => {
                      if (!search) return true;
                      const q = search.toLowerCase().trim();
                      return (
                        c.certificate_number.toLowerCase().includes(q) ||
                        (c.student_name && c.student_name.toLowerCase().includes(q)) ||
                        (c.student_name_ar && c.student_name_ar.includes(q)) ||
                        (c.student_code && c.student_code.toLowerCase().includes(q))
                      );
                    })
                    .map(cert => (
                      <tr key={cert.id}>
                        <td>
                          <strong style={{ color: '#0d9488', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                            {cert.certificate_number}
                          </strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {cert.student_name_ar && (
                              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '0.95rem', fontWeight: 700, color: '#0d9488', direction: 'rtl' }}>
                                {cert.student_name_ar}
                              </span>
                            )}
                            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{cert.student_name}</strong>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{cert.student_code}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${cert.juz_completed === 30 ? 'badge-success' : 'badge-info'}`}>
                            {cert.juz_completed === 30 ? '30 Juz (Dhameystiran)' : `${cert.juz_completed} Juz`}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {new Date(cert.issue_date).toLocaleDateString()}
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{cert.issued_by_name}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setSelectedCertificate(cert)}
                          >
                            <Printer size={12} /> Daabac
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Printable Islamic Certificate Modal */}
      {selectedCertificate && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%', padding: '0', overflow: 'hidden' }}>
            
            {/* Action Bar (Not Printed) */}
            <div style={{ padding: '12px 20px', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
                <Award size={18} color="#2dd4bf" />
                <span>Shahaadada Xifdiga Quraanka Kariimka</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handlePrintCertificate}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={14} /> Daabac Shahaadada
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCertificate(null)}
                  style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Certificate Canvas / Frame */}
            <div id="printable-certificate" style={{
              padding: '40px 48px',
              backgroundColor: '#fffdfa',
              border: '14px solid #0d9488',
              outline: '3px solid #d97706',
              outlineOffset: '-8px',
              fontFamily: 'serif',
              textAlign: 'center',
              position: 'relative'
            }}>
              {/* Bismillah Header */}
              <img
                src="/branding/tafsiir-institute-logo.jpeg"
                alt="Tafsiir Institute logo"
                style={{ display: 'block', width: 'min(100%, 440px)', maxHeight: '92px', objectFit: 'contain', margin: '0 auto 14px' }}
              />
              <div style={{ fontFamily: 'var(--font-arabic)', fontSize: '1.75rem', color: '#0d9488', marginBottom: '12px', direction: 'rtl' }}>
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </div>

              <div style={{ fontSize: '0.9rem', color: '#78350f', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                معهد التفسير للعلوم الشرعية والعربية
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '20px' }}>
                Dugsiga Quraanka Kariimka • Islamic & Arabic Studies Institute
              </div>

              {/* Certificate Title */}
              <div style={{
                display: 'inline-block',
                borderBottom: '2px solid #0d9488',
                paddingBottom: '6px',
                marginBottom: '24px'
              }}>
                <h2 style={{ fontFamily: 'var(--font-arabic)', fontSize: '2.2rem', color: '#0f172a', margin: '0 0 4px', direction: 'rtl' }}>
                  شَهَادَةُ حِفْظِ القُرْآنِ الكَرِيمِ
                </h2>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0d9488', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  CERTIFICATE OF QURAN MEMORIZATION
                </div>
              </div>

              {/* Student Details */}
              <p style={{ fontSize: '1rem', color: '#475569', margin: '0 0 8px' }}>
                Maamulka Dugsigu wuxuu ku caddaynayaa in ardayga/ardayadda:
              </p>

              {selectedCertificate.student_name_ar && (
                <div style={{
                  fontFamily: 'var(--font-arabic)',
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: '#0f766e',
                  margin: '6px 0',
                  direction: 'rtl'
                }}>
                  {selectedCertificate.student_name_ar}
                </div>
              )}

              <div style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                color: '#0f172a',
                borderBottom: '1px dashed #cbd5e1',
                display: 'inline-block',
                padding: '0 30px 4px',
                marginBottom: '16px'
              }}>
                {selectedCertificate.student_name}
              </div>

              <p style={{ fontSize: '1rem', lineHeight: 1.7, color: '#334155', maxWidth: '620px', margin: '0 auto 24px' }}>
                Uu/ay si guul iyo darajo sare leh ugu dhammaystiray/dhammaystirtay xifdiga{' '}
                <strong style={{ color: '#0d9488', fontSize: '1.15rem' }}>
                  {selectedCertificate.juz_completed === 30
                    ? '30-ka Juz ee Quraanka Kariimka (Dhammaystiran)'
                    : `${selectedCertificate.juz_completed} Juz oo Quraanka Kariimka ah`}
                </strong>, iyadoo la mariyay imtixaan adag oo la xiriira xifdiga, tartiilka, iyo ahkaamta tajwiidka.
              </p>

              {/* Verification & Signatures */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginTop: '40px',
                paddingTop: '20px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <div style={{ textAlign: 'left', fontSize: '0.85rem', color: '#475569' }}>
                  <div><strong>Taariikhda (Date):</strong> {new Date(selectedCertificate.issue_date).toLocaleDateString()}</div>
                  <div style={{ marginTop: '4px' }}><strong>Serial No:</strong> <span style={{ fontFamily: 'monospace', color: '#0d9488' }}>{selectedCertificate.certificate_number}</span></div>
                </div>

                {/* Decorative Seal */}
                <div style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  border: '3px double #d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  textTransform: 'uppercase'
                }}>
                  SEAL OF APPROVAL
                </div>

                <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#475569' }}>
                  <div style={{ borderBottom: '1px solid #000000', width: '160px', marginBottom: '6px' }} />
                  <div><strong>Maamulaha Dugsiga</strong></div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Authorized Signature</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
