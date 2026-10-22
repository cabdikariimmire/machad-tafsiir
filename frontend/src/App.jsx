import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import InstitutePage from './pages/InstitutePage';
import QuranPage from './pages/QuranPage';
import AttendancePage from './pages/AttendancePage';
import ExamsPage from './pages/ExamsPage';
import EnterMarksPage from './pages/EnterMarksPage';
import FinancePage from './pages/FinancePage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import TeachersPage from './pages/TeachersPage';
import InstituteTeachersPage from './pages/InstituteTeachersPage';
import QuranExamsPage from './pages/QuranExamsPage';

function MainApp() {
  const { user, loading, isSuperAdmin, isQuranAdmin, isTeacher } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [superAdminExamDivision, setSuperAdminExamDivision] = useState('quran');

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <img
            src="/branding/tafsiir-institute-logo.jpeg"
            alt="Tafsiir Institute logo"
            style={{ display: 'block', width: '240px', maxWidth: '80vw', height: 'auto', margin: '0 auto 16px', objectFit: 'contain' }}
          />
          <p style={{ color: '#94a3b8' }}>Soo diyaarinayaa nidaamka...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage setActiveTab={setActiveTab} />;
      case 'students':
        return <StudentsPage />;
      case 'institute':
        return <InstitutePage />;
      case 'quran':
        return <QuranPage />;
      case 'teachers':
        return <TeachersPage />;
      case 'institute_teachers':
        return <InstituteTeachersPage />;
      case 'attendance':
      case 'attendance_reports':
        return <AttendancePage />;
      case 'exams':
        // Teachers cannot access examination management; managed by Examination Office and Admins
        if (isTeacher) {
          return <DashboardPage setActiveTab={setActiveTab} />;
        }
        if (isQuranAdmin || (user?.division_scope === 'quran')) {
          return <QuranExamsPage />;
        }
        if (isSuperAdmin) {
          if (superAdminExamDivision === 'quran') {
            return <QuranExamsPage onSwitchToInstitute={() => setSuperAdminExamDivision('institute')} />;
          }
          return <ExamsPage onSwitchToQuran={() => setSuperAdminExamDivision('quran')} />;
        }
        return <ExamsPage />;
      case 'enter_marks':
      case 'exam_marks':
        if (isTeacher) {
          return <DashboardPage setActiveTab={setActiveTab} />;
        }
        return <EnterMarksPage />;
      case 'finance':
      case 'finance_payments':
      case 'finance_dashboard':
      case 'finance_students_fees':
        return <FinancePage initialMenu="payments" />;
      case 'finance_matrix':
        return <FinancePage initialMenu="reports" />;
      case 'finance_reports':
        return <FinancePage initialMenu="reports" />;
      case 'finance_settings':
      case 'settings':
        return <FinancePage initialMenu="settings" />;
      case 'reports':
        return <ReportsPage />;
      case 'users':
        return <UsersPage />;
      case 'audit_logs':
        return <AuditLogsPage />;
      default:
        return <DashboardPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
