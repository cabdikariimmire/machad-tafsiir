import { useState, useEffect } from 'react';
import api from '../services/api';
import { ShieldAlert, Search, Filter } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter, divisionFilter]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (moduleFilter) params.append('module', moduleFilter);
      if (divisionFilter) params.append('division', divisionFilter);

      const res = await api.getAuditLogs(`?${params.toString()}`);
      if (res.success) {
        setLogs(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
          Diiwaanka Ilaalinta & Amniga (Audit Logs)
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Dabagalka tallaabooyinka muhiimka ah: lacag-qabashada, wax-ka-beddelka maaliyadda, dhibcaha, iyo isticmaalayaasha
        </p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
              <label className="form-label">Qaybta (Module)</label>
              <select className="form-select" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                <option value="">Dhammaan Qaybaha</option>
                <option value="finance">Maaliyadda (Finance)</option>
                <option value="attendance">Xaadirinta (Attendance)</option>
                <option value="exams">Imtixaanaadka (Exams)</option>
                <option value="users">Shaqaalaha (Users)</option>
                <option value="students">Ardayda (Students)</option>
                <option value="auth">Gelitaanka (Auth)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
              <label className="form-label">Waaxda (Division)</label>
              <select className="form-select" value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)}>
                <option value="">Dhammaan Waaxyaha</option>
                <option value="institute">Machadka</option>
                <option value="quran">Quraanka</option>
                <option value="system">Nidaamka Guud</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waqtiga</th>
                <th>Hawsha (Action)</th>
                <th>Qaybta</th>
                <th>Waaxda</th>
                <th>Qofka Sameeyay</th>
                <th>Cinwaanka IP-ga</th>
                <th>Faahfaahin</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>Soo dejinayaa diiwaanka...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Wax diiwaan ah lama helin.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className="badge badge-info">{log.action}</span>
                    </td>
                    <td>{log.module}</td>
                    <td>
                      <span className="badge badge-warning">{log.division}</span>
                    </td>
                    <td>
                      <strong>{log.actor_name || log.actor_username || 'System'}</strong>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{log.ip_address || '-'}</td>
                    <td style={{ maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
