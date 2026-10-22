import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  Users, 
  GraduationCap, 
  DollarSign, 
  BookOpen, 
  CalendarCheck, 
  Award, 
  RefreshCw,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';

import EnrollmentTrendChart from '../components/dashboard/EnrollmentTrendChart';
import AttendanceOverviewChart from '../components/dashboard/AttendanceOverviewChart';

export default function DashboardPage({ setActiveTab }) {
  const { user, isSuperAdmin, isInstituteAdmin, isQuranAdmin } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [divisionFilter, setDivisionFilter] = useState('all');

  useEffect(() => {
    fetchDashboardData(divisionFilter);
  }, [divisionFilter]);

  async function fetchDashboardData(div) {
    try {
      if (!loading) setRefreshing(true);
      const params = div && div !== 'all' ? `?division=${div}` : '';
      const res = await api.getDashboardAnalytics(params);
      if (res.success) {
        setAnalytics(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard analytics:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    fetchDashboardData(divisionFilter);
  }

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ 
          display: 'inline-block', 
          width: '32px', 
          height: '32px', 
          border: '3px solid #e2e8f0', 
          borderTopColor: '#0d9488', 
          borderRadius: '50%', 
          animation: 'spin 0.8s linear infinite', 
          marginBottom: '14px' 
        }} />
        <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>Soo dejinayaa xogta guud ee maamulka...</p>
      </div>
    );
  }

  const kpis = analytics?.kpis || {};
  const charts = analytics?.charts || {};
  const activeDiv = analytics?.active_division || divisionFilter;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '30px' }}>
      
      {/* 1. Compact Dashboard Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '14px 20px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Title and Subtitle */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Dashboard
            </h1>
            <span style={{ 
              fontSize: '0.72rem', 
              fontWeight: 700, 
              background: '#f0fdfa', 
              color: '#0f766e', 
              padding: '2px 8px', 
              borderRadius: '6px',
              border: '1px solid #ccfbf1'
            }}>
              Sanad-Dugsiyeedka: {analytics?.academic_year || '2026'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '3px 0 0 0' }}>
            Institute overview and academic insights
          </p>
        </div>

        {/* Action Controls & Division Scope */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Division Selector for Super Admin */}
          {isSuperAdmin && (
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setDivisionFilter('all')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: divisionFilter === 'all' ? '#ffffff' : 'transparent',
                  color: divisionFilter === 'all' ? '#0f766e' : '#64748b',
                  boxShadow: divisionFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                Dhammaan (All)
              </button>
              <button
                type="button"
                onClick={() => setDivisionFilter('institute')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: divisionFilter === 'institute' ? '#ffffff' : 'transparent',
                  color: divisionFilter === 'institute' ? '#0f766e' : '#64748b',
                  boxShadow: divisionFilter === 'institute' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                Machadka
              </button>
              <button
                type="button"
                onClick={() => setDivisionFilter('quran')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: divisionFilter === 'quran' ? '#ffffff' : 'transparent',
                  color: divisionFilter === 'quran' ? '#0f766e' : '#64748b',
                  boxShadow: divisionFilter === 'quran' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                Quraanka
              </button>
            </div>
          )}

          {/* Scoped badge for non-super admins */}
          {!isSuperAdmin && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.76rem',
              fontWeight: 600,
              color: '#334155'
            }}>
              <Building2 size={14} color="#64748b" />
              <span>
                {user?.role === 'institute_admin' ? 'Waaxda Machadka' : user?.role === 'quran_admin' ? 'Waaxda Quraanka' : user?.role_display || user?.role}
              </span>
            </div>
          )}

          {/* Refresh Action */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
            title="Dib u cusbooneysii xogta"
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            <span>{refreshing ? 'Cusbooneysiinayaa...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. Section A — Compact KPI Summary Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* KPI 1: Total Students */}
        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #0d9488' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b' }}>
              {activeDiv === 'institute' ? 'Ardayda Machadka' : activeDiv === 'quran' ? 'Ardayda Quraanka' : 'Wadarta Ardayda'}
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#0d9488" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {kpis.total_students || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
            Firfircoon (Active Enrollments)
          </div>
        </div>

        {/* KPI 2: Total Classes */}
        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b' }}>
              {kpis.classes_label || 'Fasallada Firfircoon'}
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={16} color="#3b82f6" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {kpis.total_classes || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600, marginTop: '4px' }}>
            Sanadkan 2026
          </div>
        </div>

        {/* KPI 3: Attendance Rate */}
        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b' }}>
              Heerka Xaadirinta
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarCheck size={16} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {kpis.attendance_recorded ? `${kpis.attendance_rate}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
            {kpis.attendance_recorded ? 'Celceliska joogitaanka' : 'Weli lama xaadirin'}
          </div>
        </div>

        {/* KPI 4: Outstanding Fees (or Teachers if finance restricted) */}
        {kpis.can_view_finance ? (
          <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b' }}>
                Haraaga Dhiman (Due)
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={16} color="#d97706" />
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              ${Number(kpis.outstanding_fees || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600, marginTop: '4px' }}>
              Biilasha aan weli la bixin
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #6366f1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b' }}>
                Maamulka Fasallada
              </span>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GraduationCap size={16} color="#4f46e5" />
              </div>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {kpis.total_classes || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#4338ca', fontWeight: 600, marginTop: '4px' }}>
              Fasallo u diyaarsan casharada
            </div>
          </div>
        )}

        {/* KPI 5: Academic Performance */}
        <div className="card" style={{ padding: '16px 18px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b' }}>
              Celceliska Imtixaanaadka
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={16} color="#7c3aed" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {kpis.academic_performance_available ? `${kpis.academic_performance}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '0.72rem', color: kpis.academic_performance_available ? '#6d28d9' : '#94a3b8', fontWeight: 600, marginTop: '4px' }}>
            {kpis.academic_performance_available ? 'Natiijooyinka la xaqiijiyay' : 'Weli imtixaan lama qiimeyn'}
          </div>
        </div>
      </div>

      {/* 3. Section B — Main Analytics Section: 2-Column Responsive Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Chart 1: Student Enrollment Trend */}
        <EnrollmentTrendChart data={charts.enrollment_trend || []} />

        {/* Chart 2: Attendance Overview */}
        <AttendanceOverviewChart data={charts.attendance_trend || []} />
      </div>

    </div>
  );
}
