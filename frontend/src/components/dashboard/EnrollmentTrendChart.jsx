import { useState } from 'react';
import { TrendingUp, Users } from 'lucide-react';

export default function EnrollmentTrendChart({ data = [] }) {
  const [metric, setMetric] = useState('cumulative'); // 'cumulative' | 'new_students'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 className="card-title" style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Diiwaangelinta Ardayda (Enrollment Trend)
          </h3>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: '#94a3b8' }}>
          Xog diiwaangelineed weli lama helin.
        </div>
      </div>
    );
  }

  const values = data.map(d => metric === 'cumulative' ? d.cumulative : d.new_students);
  const maxVal = Math.max(...values, 5);
  const minVal = 0;

  // SVG Chart dimensions
  const svgWidth = 520;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 25;
  const padTop = 25;
  const padBottom = 35;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const points = data.map((d, i) => {
    const val = metric === 'cumulative' ? d.cumulative : d.new_students;
    const x = data.length > 1 ? padLeft + (i / (data.length - 1)) * chartW : padLeft + chartW / 2;
    const y = padTop + chartH - ((val - minVal) / (maxVal - minVal || 1)) * chartH;
    return { x, y, val, label: d.period || d.ym, raw: d };
  });

  const pathD = points.length > 1
    ? points.reduce((acc, curr, i, arr) => {
        if (i === 0) return `M ${curr.x} ${curr.y}`;
        // Bezier curve control points
        const prev = arr[i - 1];
        const cp1x = prev.x + (curr.x - prev.x) / 2;
        const cp1y = prev.y;
        const cp2x = prev.x + (curr.x - prev.x) / 2;
        const cp2y = curr.y;
        return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }, '')
    : `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y}`;

  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`
    : '';

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

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
            <TrendingUp size={16} color="#0d9488" />
          </div>
          <div>
            <h3 className="card-title" style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Kordhinta Ardayda (Enrollment Trend)
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              {metric === 'cumulative' ? 'Wadarta isbiirsatay (Cumulative)' : 'Diiwaangelin cusub bil kasta'}
            </span>
          </div>
        </div>

        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setMetric('cumulative')}
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: metric === 'cumulative' ? '#ffffff' : 'transparent',
              color: metric === 'cumulative' ? '#0f766e' : '#64748b',
              boxShadow: metric === 'cumulative' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            Wadarta (Total)
          </button>
          <button
            type="button"
            onClick={() => setMetric('new_students')}
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: metric === 'new_students' ? '#ffffff' : 'transparent',
              color: metric === 'new_students' ? '#0f766e' : '#64748b',
              boxShadow: metric === 'new_students' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            Bil Kasta (Monthly)
          </button>
        </div>
      </div>

      <div className="card-body" style={{ padding: '16px 20px', flex: 1, position: 'relative' }}>
        <div style={{ width: '100%', height: '220px', position: 'relative' }}>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id="enrollmentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {yTicks.map((tick, idx) => {
              const y = padTop + chartH - ((tick - minVal) / (maxVal - minVal || 1)) * chartH;
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
                    x={padLeft - 8}
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

            {/* Area fill */}
            {areaD && <path d={areaD} fill="url(#enrollmentGrad)" />}

            {/* Main Path */}
            <path
              d={pathD}
              fill="none"
              stroke="#0d9488"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {points.map((pt, idx) => {
              const isHovered = hoveredPoint?.idx === idx;
              return (
                <g key={idx}>
                  {/* Interactive hit circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={14}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint({ ...pt, idx })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* Outer circle on hover */}
                  {isHovered && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={7}
                      fill="#ccfbf1"
                      stroke="#0d9488"
                      strokeWidth="2"
                    />
                  )}
                  {/* Inner dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 4 : 3}
                    fill={isHovered ? "#0f766e" : "#0d9488"}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  {/* X Axis Label */}
                  <text
                    x={pt.x}
                    y={padTop + chartH + 18}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="10"
                    fontWeight={isHovered ? "700" : "500"}
                  >
                    {pt.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Floating Tooltip */}
          {hoveredPoint && (
            <div style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: `${Math.max(10, (hoveredPoint.y / svgHeight) * 100 - 30)}%`,
              transform: 'translate(-50%, -100%)',
              background: '#0f172a',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap'
            }}>
              <div style={{ fontWeight: 700, color: '#2dd4bf', marginBottom: '2px' }}>{hoveredPoint.label}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span>{metric === 'cumulative' ? 'Wadarta Ardayda:' : 'Cusub Bishan:'}</span>
                <strong style={{ color: '#ffffff' }}>{hoveredPoint.val} arday</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
