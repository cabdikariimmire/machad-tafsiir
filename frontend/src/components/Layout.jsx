import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  FileSpreadsheet,
  DollarSign,
  FileText,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  CreditCard,
  Settings,
  Clock,
  Award,
  Layers,
  BookMarked,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Layout({ activeTab, setActiveTab, children }) {
  const { user, logout, isSuperAdmin, isInstituteAdmin, isQuranAdmin, isFinanceUser, isAttendanceOfficer, isExamOfficer, isTeacher } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Generate menu items based on exact specifications
  const getNavItems = () => {
    // 1. Super Admin
    if (isSuperAdmin) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'users', label: 'Users & Roles', icon: Users },
        { id: 'students', label: 'Students (Ardayda)', icon: GraduationCap },
        { id: 'institute', label: 'Institute (Machadka)', icon: BookOpen },
        { id: 'quran', label: 'Quran (Dugsiga)', icon: BookMarked },
        { id: 'attendance', label: 'Attendance (Xaadirinta)', icon: CalendarCheck },
        { id: 'exams', label: 'Exams (Imtixaanaadka)', icon: Award },
        { id: 'enter_marks', label: 'Enter Marks (Geli Dhibcaha)', icon: FileSpreadsheet },
        { id: 'reports', label: 'Reports & Exports', icon: FileText },
        { id: 'finance', label: 'Financial Management', icon: DollarSign },
        { id: 'audit_logs', label: 'Audit Logs', icon: ShieldAlert },
        { id: 'settings', label: 'Fee Settings', icon: Settings }
      ];
    }

    // 2. Institute Admin
    if (isInstituteAdmin) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'students', label: 'Students (Ardayda)', icon: GraduationCap },
        { id: 'institute', label: 'Institute Academic', icon: BookOpen },
        { id: 'attendance', label: 'Attendance (Xaadirinta)', icon: CalendarCheck },
        { id: 'exams', label: 'Exams (Imtixaanaadka)', icon: Award },
        { id: 'enter_marks', label: 'Enter Marks (Geli Dhibcaha)', icon: FileSpreadsheet },
        { id: 'reports', label: 'Reports & Exports', icon: FileText },
        { id: 'finance', label: 'Institute Finance', icon: DollarSign },
        { id: 'users', label: 'Institute Staff', icon: Users }
      ];
    }

    // 3. Quran Admin (Numbered Menu Structure)
    if (isQuranAdmin) {
      return [
        { id: 'dashboard', label: '1. Dashboard', icon: LayoutDashboard },
        { id: 'students', label: '2. Ardayda', icon: GraduationCap },
        { id: 'teachers', label: '3. Teachers', icon: Users },
        { id: 'quran', label: '4. Quran', icon: BookMarked },
        { id: 'exams', label: '5. Exam', icon: Award },
        { id: 'attendance', label: '6. Xadirin', icon: CalendarCheck },
        { id: 'finance', label: '7. Fee', icon: DollarSign },
        { id: 'reports', label: '8. Report', icon: FileText },
        { id: 'users', label: '9. User / Staff', icon: Users }
      ];
    }

    // 4. Finance User (Exact 4-menu structure)
    if (isFinanceUser) {
      return [
        { id: 'finance_payments', label: '1. Payments (Qabo Lacag)', icon: CreditCard },
        { id: 'finance_reports', label: '2. Reports (Taariikhda)', icon: FileText },
        { id: 'finance_settings', label: '3. Settings (Fee Rules)', icon: Settings }
      ];
    }

    // 5. Attendance Officer
    if (isAttendanceOfficer) {
      return [
        { id: 'attendance', label: 'Student Attendance', icon: CalendarCheck },
        { id: 'attendance_reports', label: 'Attendance Reports', icon: FileText }
      ];
    }

    // 6. Examination Officer (Exactly 3 Main Menus)
    if (isExamOfficer) {
      return [
        { id: 'exams', label: '1. Exams', icon: Award },
        { id: 'enter_marks', label: '2. Enter Marks', icon: FileSpreadsheet },
        { id: 'reports', label: '3. Reports', icon: FileText }
      ];
    }

    // 7. Teacher (Dedicated Exam menu removed; managed by Examination Office)
    return [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'Ardayda', icon: GraduationCap },
      { id: 'quran', label: 'Quran (Hifdh)', icon: BookMarked },
      { id: 'attendance', label: 'Xadirin', icon: CalendarCheck }
    ];
  };

  const navItems = getNavItems();

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <img
            className="sidebar-logo"
            src="/branding/tafsiir-institute-logo.jpeg"
            alt="Tafsiir Institute logo"
          />
          <div className="sidebar-brand">
            <h1>معهد التفسير</h1>
            <p>للعلوم الشرعية والعربية</p>
          </div>
        </div>

        <div className="sidebar-nav">
          <div className="nav-section-title">Liiska Qaybaha (Navigation)</div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">
              {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <div className="user-name" title={user?.full_name}>{user?.full_name}</div>
              <div className="user-role">{user?.role_display || user?.role}</div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={logout} 
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' }}
            title="Ka bax nidaamka (Logout)"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay Backdrop */}
      {mobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="top-navbar">
          <div className="top-nav-left">
            <button 
              type="button" 
              className="mobile-toggle-btn" 
              onClick={() => setMobileOpen(!mobileOpen)}
              title="Mobile Menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <button
              type="button"
              className="sidebar-collapse-toggle-btn"
              onClick={toggleSidebar}
              title={collapsed ? "Ballaari Sidebar-ka (Expand sidebar)" : "Yaree Sidebar-ka (Collapse sidebar for full-screen view)"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                cursor: 'pointer',
                color: '#334155'
              }}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <img
              className="top-navbar-logo"
              src="/branding/tafsiir-institute-logo.jpeg"
              alt="Tafsiir Institute logo"
            />
            <div className="page-title-badge">
              <h2>معهد التفسير للعلوم الشرعية والعربية</h2>
              <span className="division-pill">
                {user?.division_scope === 'all' ? 'All Divisions (Dhammaan)' : user?.division_scope === 'institute' ? 'Machadka (Institute)' : 'Dugsiga Quraanka (Quran)'}
              </span>
            </div>
          </div>

          <div className="top-nav-right">
            <NotificationBell />
          </div>
        </header>

        <main className="content-body">
          {children}
        </main>
      </div>
    </div>
  );
}
