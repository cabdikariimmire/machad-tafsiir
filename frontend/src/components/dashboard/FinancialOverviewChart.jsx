import { useState } from 'react';
import { DollarSign, ShieldAlert, CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react';

export default function FinancialOverviewChart({ overview = {}, setActiveTab }) {
  const [hoveredMonth, setHoveredMonth] = useState(null);

  if (overview.can_view_finance === false) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={16} color="#64748b" />
            </div>
            <div>
              <h3 className="card-title" style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Xogta Maaliyadda (Financial Overview)
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Ogolaanshaha Maamulka Maaliyadda</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
          <ShieldAlert size={32} color="#94a3b8" style={{ marginBottom: '10px' }} />
          <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
            Ogolaansho Xadidan
          </h4>
          <p style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '300px', margin: 0 }}>
            Qaybta maaliyadda waxaa u xiran mas'uuliyiinta maaliyadda iyo maamulka sare oo kaliya.
          </p>
        </div>
      </div>
    );
  }

  const monthly = overview.monthly || [];
  const totalCollected = Number(overview.total_collected || 0);
  const totalOutstanding = Number(overview.total_outstanding || 0);
  const collectionRate = overview.collection_rate || 0;

  // SVG dimensions for compact monthly bars
  const svgWidth = 520;
  const svgHeight = 150;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 30;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const maxFinancial = Math.max(
    ...monthly.map(m => Math.max(m.collected, m.invoiced || 0, m.outstanding || 0)),
    totalCollected,
    totalOutstanding,
    100
  );

  const barGroupWidth = monthly.length > 0 ? chartW / monthly.length : chartW;
  const barWidth = Math.min(22, Math.max(12, barGroupWidth * 0.35));

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
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={16} color="#0d9488" />
          </div>
          <div>
            <h3 className="card-title" style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Warbixinta Maaliyadda (Financial Overview)
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Lacagaha la qabtay iyo haraaga dhiman</span>
          </div>
        </div>

        {setActiveTab && (
          <button
            type="button"
            onClick={() => setActiveTab('finance')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.74rem',
              color: '#0d9488',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <span>Qaybta Maaliyadda</span>
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>

      <div className="card-body" style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Summary Metrics Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          background: '#f8fafc',
          padding: '12px 14px',
          borderRadius: '10px',
          border: '1px solid #f1f5f9',
          marginBottom: '14px'
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>La Qabtay (Collected):</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f766e', marginTop: '2px' }}>
              ${totalCollected.toFixed(2)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Haraaga (Outstanding):</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#d97706', marginTop: '2px' }}>
              ${totalOutstanding.toFixed(2)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Heerka Qabashada:</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
              {collectionRate}%
            </div>
          </div>
        </div>

        {/* Comparative Monthly Bars */}
        {monthly.length > 0 ? (
          <div style={{ width: '100%', height: '140px', position: 'relative' }}>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Horizontal Grid lines */}
              {[0, Math.round(maxFinancial / 2), Math.round(maxFinancial)].map((tick, idx) => {
                const y = padTop + chartH - (tick / maxFinancial) * chartH;
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
                      fontSize="9.5"
                      fontWeight="500"
                    >
                      ${tick}
                    </text>
                  </g>
                );
              })}

              {/* Monthly grouped bars */}
              {monthly.map((item, idx) => {
                const groupCenterX = padLeft + idx * barGroupWidth + barGroupWidth / 2;
                const collectedHeight = (item.collected / maxFinancial) * chartH;
                const outstandingHeight = ((item.outstanding || 0) / maxFinancial) * chartH;

                const colX = groupCenterX - barWidth - 1;
                const colY = padTop + chartH - collectedHeight;

                const outX = groupCenterX + 1;
                const outY = padTop + chartH - outstandingHeight;

                const isHovered = hoveredMonth?.idx === idx;

                return (
                  <g
                    key={idx}
                    onMouseEnter={() => setHoveredMonth({ ...item, idx, groupCenterX, colY })}
                    onMouseLeave={() => setHoveredMonth(null)}
                    style={{ cursor: 'pointer' }}
                  >
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

                    {/* Collected Bar */}
                    <rect
                      x={colX}
                      y={colY}
                      width={barWidth}
                      height={Math.max(collectedHeight, 2)}
                      rx="3"
                      fill={isHovered ? '#0f766e' : '#0d9488'}
                    />

                    {/* Outstanding Bar */}
                    <rect
                      x={outX}
                      y={outY}
                      width={barWidth}
                      height={Math.max(outstandingHeight, 2)}
                      rx="3"
                      fill={isHovered ? '#b45309' : '#d97706'}
                    />

                    {/* X Axis Label */}
                    <text
                      x={groupCenterX}
                      y={padTop + chartH + 16}
                      textAnchor="middle"
                      fill={isHovered ? '#0f172a' : '#64748b'}
                      fontSize="9.5"
                      fontWeight={isHovered ? '700' : '500'}
                    >
                      {item.period}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredMonth && (
              <div style={{
                position: 'absolute',
                left: `${(hoveredMonth.groupCenterX / svgWidth) * 100}%`,
                top: `${Math.max(5, (hoveredMonth.colY / svgHeight) * 100 - 25)}%`,
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
                  {hoveredMonth.period}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ color: '#34d399' }}>La Qabtay:</span>
                  <strong>${Number(hoveredMonth.collected).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ color: '#fbbf24' }}>Haraaga:</span>
                  <strong>${Number(hoveredMonth.outstanding || 0).toFixed(2)}</strong>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.84rem' }}>
            Ma jiraan xog bishiile oo diiwaangashan.
          </div>
        )}
      </div>
    </div>
  );
}
