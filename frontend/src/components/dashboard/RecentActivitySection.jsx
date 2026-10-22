import { 
  Clock, 
  UserPlus, 
  CalendarCheck, 
  Award, 
  DollarSign, 
  BookOpen, 
  Shield, 
  Activity,
  ArrowRight
} from 'lucide-react';

export default function RecentActivitySection({ activities = [], setActiveTab, isSuperAdmin }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="card" style={{ marginTop: '22px' }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 className="card-title" style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Dhaqdhaqaaqyadii Ugu Dambeeyay (Recent Updates)
          </h3>
        </div>
        <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
          Wax dhaqdhaqaaq ah weli lama diiwaangelin.
        </div>
      </div>
    );
  }

  function getActivityIcon(type) {
    switch (type) {
      case 'student':
        return <UserPlus size={16} color="#0d9488" />;
      case 'attendance':
        return <CalendarCheck size={16} color="#059669" />;
      case 'exam':
        return <Award size={16} color="#4f46e5" />;
      case 'finance':
        return <DollarSign size={16} color="#d97706" />;
      case 'academic':
        return <BookOpen size={16} color="#0284c7" />;
      case 'security':
        return <Shield size={16} color="#64748b" />;
      default:
        return <Activity size={16} color="#64748b" />;
    }
  }

  function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Hada';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} daqiiqo ka hor`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} saacadood ka hor`;
    return date.toLocaleDateString('so-SO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="card" style={{ marginTop: '24px' }}>
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
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={16} color="#475569" />
          </div>
          <div>
            <h3 className="card-title" style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Dhaqdhaqaaqyadii Ugu Dambeeyay (Recent Academic Updates)
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Diiwaanka howlaha waxbarasho, xaadirinta, imtixaanaadka, iyo maamulka
            </span>
          </div>
        </div>

        {isSuperAdmin && setActiveTab && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setActiveTab('audit_logs')}
            style={{
              fontWeight: 600,
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid #e2e8f0',
              padding: '5px 12px'
            }}
          >
            <span>Diiwaanka Dhameystiran</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div style={{ padding: '4px 0' }}>
        {activities.map((act, idx) => {
          const isLast = idx === activities.length - 1;
          return (
            <div
              key={act.id || idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderBottom: isLast ? 'none' : '1px solid #f8fafc',
                gap: '14px',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  {getActivityIcon(act.type)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                      {act.title}
                    </span>
                    {act.division && act.division !== 'system' && (
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: act.division === 'institute' ? '#f0fdfa' : '#fffbeb',
                        color: act.division === 'institute' ? '#0f766e' : '#b45309',
                        textTransform: 'capitalize'
                      }}>
                        {act.division}
                      </span>
                    )}
                  </div>
                  <p style={{
                    margin: '3px 0 0 0',
                    fontSize: '0.78rem',
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {act.description}
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  {formatRelativeTime(act.created_at)}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                  {act.actor}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
