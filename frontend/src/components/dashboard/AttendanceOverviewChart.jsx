import { useState } from 'react';
import { CalendarCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function AttendanceOverviewChart({ data = [] }) {
  const [hoveredBar, setHoveredBar] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 className="card-title" style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Xaadirinta Guud (Attendance Overview)
          </h3>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: '#94a3b8' }}>
          Diiwaanka xaadirinta weli lama bilaabin.
        </div>
      </div>
    );
  }

  // Calculate overall metrics
  const totalSessions = data.length;
  const totalPres = data.reduce((sum, d) => sum + d.present, 0);
  const totalAbs = data.reduce((sum, d) => sum + d.absent, 0);
  const totalLate = data.reduce((sum, d) => sum + (d.late || 0), 0);
  const totalAll = totalPres + totalAbs + totalLate;
  const overallRate = totalAll > 0 ? (((totalPres + 0.5 * totalLate) / totalAll) * 100).toFixed(1) : 0;

  const maxStudentsInSession = Math.max(...data.map(d => Math.max(d.present + d.absent + (d.late || 0), 1)), 5);

  // SVG Chart Dimensions
  const svgWidth = 520;
  const svgHeight = 220;
  const padLeft = 35;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const barGroupWidth = chartW / data.length;
  const barWidth = Math.min(22, Math.max(10, barGroupWidth * 0.42));

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
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarCheck size={16} color="#059669" />
          </div>
          <div>
            <h3 className="card-title" style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Xaadirinta Guud (Attendance Overview)
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Joogitaanka ardayda casharada dambe ({totalSessions} fadhi)
            </span>
          </div>
        </div>

        {/* Legend & Rate badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#0d9488' }}></span>
            Jooga
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#be123c', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f43f5e' }}></span>
            Maqan
          </div>
          <span style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            background: Number(overallRate) >= 75 ? '#ecfdf5' : '#fffbeb',
            color: Number(overallRate) >= 75 ? '#065f46' : '#b45309',
            padding: '2px 8px',
            borderRadius: '6px'
          }}>
            {overallRate}% Celcelis
          </span>
        </div>
      </div>

      <div className="card-body" style={{ padding: '16px 20px', flex: 1, position: 'relative' }}>
        <div style={{ width: '100%', height: '220px', position: 'relative' }}>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            {/* Horizontal Grid lines */}
            {[0, Math.round(maxStudentsInSession / 2), maxStudentsInSession].map((tick, idx) => {
              const y = padTop + chartH - (tick / maxStudentsInSession) * chartH;
              return (
                <g key={idx}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + chartW}
                    y2={y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray={idx === 0 ? 'none' : '3 3'}
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 4}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="500"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Bars for each session */}
            {data.map((item, idx) => {
              const groupCenterX = padLeft + idx * barGroupWidth + barGroupWidth / 2;
              const presentHeight = (item.present / maxStudentsInSession) * chartH;
              const absentHeight = (item.absent / maxStudentsInSession) * chartH;
              const isHovered = hoveredBar?.idx === idx;

              const presX = groupCenterX - barWidth - 1;
              const presY = padTop + chartH - presentHeight;

              const absX = groupCenterX + 1;
              const absY = padTop + chartH - absentHeight;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredBar({ ...item, idx, groupCenterX, presY })}
                  onMouseLeave={() => setHoveredBar(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Subtle hover background pillar */}
                  {isHovered && (
                    <rect
                      x={groupCenterX - barGroupWidth / 2}
                      y={padTop}
                      width={barGroupWidth}
                      height={chartH}
                      fill="#f8fafc"
                      rx="4"
                    />
                  )}

                  {/* Present bar */}
                  <rect
                    x={presX}
                    y={presY}
                    width={barWidth}
                    height={Math.max(presentHeight, 2)}
                    rx="3"
                    fill={isHovered ? '#0f766e' : '#0d9488'}
                  />

                  {/* Absent bar */}
                  <rect
                    x={absX}
                    y={absY}
                    width={barWidth}
                    height={Math.max(absentHeight, 2)}
                    rx="3"
                    fill={isHovered ? '#e11d48' : '#f43f5e'}
                  />

                  {/* X Axis Date Label */}
                  <text
                    x={groupCenterX}
                    y={padTop + chartH + 18}
                    textAnchor="middle"
                    fill={isHovered ? '#0f172a' : '#64748b'}
                    fontSize="9.5"
                    fontWeight={isHovered ? '700' : '500'}
                  >
                    {item.display_date || item.date}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hoveredBar && (
            <div style={{
              position: 'absolute',
              left: `${(hoveredBar.groupCenterX / svgWidth) * 100}%`,
              top: `${Math.max(10, (hoveredBar.presY / svgHeight) * 100 - 30)}%`,
              transform: 'translate(-50%, -100%)',
              background: '#0f172a',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
              zIndex: 10,
              minWidth: '130px'
            }}>
              <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px', borderBottom: '1px solid #334155', paddingBottom: '3px' }}>
                {hoveredBar.display_date || hoveredBar.date}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                <span style={{ color: '#34d399' }}>✓ Jooga:</span>
                <strong>{hoveredBar.present}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                <span style={{ color: '#fb7185' }}>✕ Maqan:</span>
                <strong>{hoveredBar.absent}</strong>
              </div>
              {hoveredBar.late > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ color: '#fcd34d' }}>⏱ Daahay:</span>
                  <strong>{hoveredBar.late}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid #334155', paddingTop: '3px', marginTop: '3px' }}>
                <span style={{ color: '#94a3b8' }}>Heerka:</span>
                <strong style={{ color: '#2dd4bf' }}>{hoveredBar.rate}%</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
