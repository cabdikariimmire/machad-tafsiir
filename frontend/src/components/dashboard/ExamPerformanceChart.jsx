import { useState } from 'react';
import { Award, BookOpen, AlertCircle } from 'lucide-react';

export default function ExamPerformanceChart({ data = [] }) {
  const [hoveredSubject, setHoveredSubject] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={16} color="#4f46e5" />
            </div>
            <div>
              <h3 className="card-title" style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Natiijada Imtixaanaadka (Exam Performance)
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Celceliska maaddooyinka</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: '#94a3b8', gap: '8px' }}>
          <AlertCircle size={24} color="#cbd5e1" />
          <span style={{ fontSize: '0.86rem' }}>Weli ma jiraan imtixaanno natiijooyinkooda la xaqiijiyay.</span>
        </div>
      </div>
    );
  }

  // Calculate overall average across all subjects
  const overallAvg = (data.reduce((sum, s) => sum + Number(s.avg_pct || 0), 0) / data.length).toFixed(1);

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="card-header" style={{
        padding: '16px 20px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={16} color="#4f46e5" />
          </div>
          <div>
            <h3 className="card-title" style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Natiijada Imtixaanaadka (Exam Performance)
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Celceliska boqolleyda maaddooyinka (Excluding absentees)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Celcelis Guud:</span>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            background: Number(overallAvg) >= 80 ? '#ecfdf5' : '#eef2ff',
            color: Number(overallAvg) >= 80 ? '#065f46' : '#3730a3',
            padding: '3px 10px',
            borderRadius: '6px'
          }}>
            {overallAvg}%
          </span>
        </div>
      </div>

      <div className="card-body" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {data.map((subj, idx) => {
            const pct = Number(subj.avg_pct || 0);
            const isHovered = hoveredSubject?.idx === idx;

            // Restrained color palette based on academic thresholds
            let barColor = '#0d9488'; // emerald
            let badgeBg = '#f0fdfa';
            let badgeText = '#0f766e';
            let gradeLabel = 'Mumtaaz';

            if (pct < 50) {
              barColor = '#e11d48';
              badgeBg = '#fff1f2';
              badgeText = '#be123c';
              gradeLabel = 'Dhaafay';
            } else if (pct < 65) {
              barColor = '#d97706';
              badgeBg = '#fffbeb';
              badgeText = '#b45309';
              gradeLabel = 'Jayid';
            } else if (pct < 80) {
              barColor = '#0284c7';
              badgeBg = '#f0f9ff';
              badgeText = '#0369a1';
              gradeLabel = 'Jayid Jiddan';
            }

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredSubject({ ...subj, idx, gradeLabel })}
                onMouseLeave={() => setHoveredSubject(null)}
                style={{
                  cursor: 'pointer',
                  padding: '6px 8px',
                  borderRadius: '8px',
                  background: isHovered ? '#f8fafc' : 'transparent',
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={14} color="#64748b" />
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a' }}>
                      {subj.subject}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      ({subj.students_count} arday)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', background: badgeBg, color: badgeText, padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      {gradeLabel}
                    </span>
                    <strong style={{ fontSize: '0.88rem', color: '#0f172a', minWidth: '45px', textAlign: 'right' }}>
                      {pct}%
                    </strong>
                  </div>
                </div>

                {/* Progress track */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: '#f1f5f9',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    width: `${Math.min(pct, 100)}%`,
                    height: '100%',
                    background: barColor,
                    borderRadius: '9999px',
                    transition: 'width 0.4s ease-out'
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Reference marker footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #f1f5f9',
          paddingTop: '12px',
          marginTop: '8px',
          fontSize: '0.72rem',
          color: '#94a3b8'
        }}>
          <span>Heerka Gudbista: 50%</span>
          <span>Heerka Sare: 80%+</span>
        </div>
      </div>
    </div>
  );
}
