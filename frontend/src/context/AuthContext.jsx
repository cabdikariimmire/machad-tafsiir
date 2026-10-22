import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const res = await api.login({ username, password });
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }

  // Permission helpers
  const isSuperAdmin = user?.role === 'super_admin';
  const isInstituteAdmin = user?.role === 'institute_admin';
  const isQuranAdmin = user?.role === 'quran_admin';
  const isFinanceUser = user?.role === 'finance_user';
  const isAttendanceOfficer = user?.role === 'attendance_officer';
  const isExamOfficer = user?.role === 'examination_officer';
  const isTeacher = user?.role === 'teacher';

  const hasInstituteAccess = isSuperAdmin || user?.division_scope === 'all' || user?.division_scope === 'institute' || isInstituteAdmin;
  const hasQuranAccess = isSuperAdmin || user?.division_scope === 'all' || user?.division_scope === 'quran' || isQuranAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      checkAuth,
      isSuperAdmin,
      isInstituteAdmin,
      isQuranAdmin,
      isFinanceUser,
      isAttendanceOfficer,
      isExamOfficer,
      isTeacher,
      hasInstituteAccess,
      hasQuranAccess
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
