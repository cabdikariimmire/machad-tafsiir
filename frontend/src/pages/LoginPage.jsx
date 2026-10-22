import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Magaca isticmaalaha ama furaha sirta ah waa khalad.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0f172a',
      background: 'radial-gradient(circle at top right, #134e4a, #0f172a 60%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        padding: '36px 32px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/branding/tafsiir-institute-logo.jpeg"
            alt="Tafsiir Institute logo"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '360px',
              height: 'auto',
              margin: '0 auto 18px',
              objectFit: 'contain'
            }}
          />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-arabic)' }}>
            معهد التفسير للعلوم الشرعية والعربية
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
            Nidaamka Maamulka Gudaha (Internal Management System)
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '20px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={15} color="#0d9488" />
              Magaca Isticmaalaha (Username)
            </label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. superadmin ama instadmin"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={15} color="#0d9488" />
              Furaha Sirta ah (Password)
            </label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Hubinayaa...' : (
              <>
                <span>Gal Nidaamka (Sign In)</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#94a3b8'
        }}>
          Nidaam gaar ah oo loogu talagalay maamulka & macallimiinta oo keliya.
        </div>
      </div>
    </div>
  );
}
