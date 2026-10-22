import { useState, useEffect } from 'react';
import { Bell, Check, Clock } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell() {
  const { isTeacher } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isTeacher]);

  async function fetchNotifications() {
    try {
      const res = await api.getNotifications();
      if (res.success) {
        let list = res.data || [];
        if (isTeacher) {
          list = list.filter(n => 
            !n.type?.startsWith('payment_') && 
            !n.type?.startsWith('fee_') &&
            n.type !== 'payment_recorded' &&
            n.type !== 'fee_adjusted'
          );
        }
        setNotifications(list);
        setUnreadCount(list.filter(n => !n.is_read).length);
      }
    } catch (e) {
      // Quiet fail
    }
  }

  async function handleMarkRead(id) {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '8px',
          color: '#475569'
        }}
        title="Ogeysiisyada"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: '#ef4444',
            color: 'white',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 'bold',
            padding: '1px 5px',
            minWidth: '16px',
            textAlign: 'center'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          width: '320px',
          maxHeight: '400px',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
          zIndex: 100,
          overflowY: 'auto'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Ogeysiisyada Nidaamka</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{unreadCount} cusub</span>
          </div>

          <div style={{ padding: '8px' }}>
            {notifications.length === 0 ? (
              <p style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Wax ogeysiis ah ma jiraan
              </p>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{
                  padding: '10px',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  backgroundColor: n.is_read ? '#ffffff' : '#f0fdfa',
                  border: n.is_read ? '1px solid #f1f5f9' : '1px solid #ccfbf1'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>
                      {n.title}
                    </h4>
                    {!n.is_read && (
                      <button 
                        type="button" 
                        onClick={() => handleMarkRead(n.id)}
                        style={{ border: 'none', background: 'none', color: '#0d9488', cursor: 'pointer', padding: '2px' }}
                        title="U calaamadee in la akhriyay"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>{n.message}</p>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} />
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
