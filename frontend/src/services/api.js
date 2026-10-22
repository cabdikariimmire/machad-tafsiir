/**
 * Centralized API client with credentials for session cookies
 */

const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include' // Always send session cookie
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);

  // If response is a blob (e.g. Excel download)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument')) {
    if (!response.ok) throw new Error('Cilad ayaa dhacday markii la soo dejinayay faylka Excel.');
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Khalad ayaa dhacay (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

export function toQuery(params = '') {
  if (!params) return '';
  if (typeof params === 'string') return params.startsWith('?') ? params : `?${params}`;
  if (typeof params === 'object') {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    }
    const str = searchParams.toString();
    return str ? `?${str}` : '';
  }
  return '';
}

export default {
  // Auth
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  getMe: () => apiRequest('/auth/me'),
  changePassword: (data) => apiRequest('/auth/change-password', { method: 'POST', body: data }),

  // Dashboard & System
  getDashboardStats: () => apiRequest('/dashboard/stats'),
  getDashboardAnalytics: (params = '') => apiRequest(`/dashboard/analytics${params}`),
  getNotifications: () => apiRequest('/dashboard/notifications'),
  markNotificationRead: (id) => apiRequest(`/dashboard/notifications/${id}/read`, { method: 'PATCH' }),
  getAuditLogs: (params = '') => apiRequest(`/dashboard/audit-logs${params}`),

  // Users & Roles
  getUsers: () => apiRequest('/users'),
  getRoles: () => apiRequest('/users/roles'),
  createUser: (data) => apiRequest('/users', { method: 'POST', body: data }),
  updateUser: (id, data) => apiRequest(`/users/${id}`, { method: 'PUT', body: data }),
  resetUserPassword: (id, new_password) => apiRequest(`/users/${id}/reset-password`, { method: 'POST', body: { new_password } }),
  toggleUserStatus: (id) => apiRequest(`/users/${id}/toggle-status`, { method: 'PATCH' }),
  deleteUser: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),

  // Students
  getStudents: (params = '') => apiRequest(`/students${toQuery(params)}`),
  getStudentById: (id) => apiRequest(`/students/${id}`),
  createStudent: (data) => apiRequest('/students', { method: 'POST', body: data }),
  updateStudent: (id, data) => apiRequest(`/students/${id}`, { method: 'PUT', body: data }),
  archiveStudent: (id) => apiRequest(`/students/${id}/archive`, { method: 'PATCH' }),
  deleteStudent: (id) => apiRequest(`/students/${id}`, { method: 'DELETE' }),

  // Institute Academic Module
  getCourses: () => apiRequest('/institute/courses'),
  createCourse: (data) => apiRequest('/institute/courses', { method: 'POST', body: data }),
  getSubjects: (params = '') => apiRequest(`/institute/subjects${toQuery(params)}`),
  createSubject: (data) => apiRequest('/institute/subjects', { method: 'POST', body: data }),
  updateSubject: (id, data) => apiRequest(`/institute/subjects/${id}`, { method: 'PUT', body: data }),
  toggleSubjectStatus: (id) => apiRequest(`/institute/subjects/${id}/toggle-status`, { method: 'PATCH' }),
  deleteSubject: (id) => apiRequest(`/institute/subjects/${id}`, { method: 'DELETE' }),

  getClasses: (params = '') => apiRequest(`/institute/classes${toQuery(params)}`),
  createClass: (data) => apiRequest('/institute/classes', { method: 'POST', body: data }),
  updateClass: (id, data) => apiRequest(`/institute/classes/${id}`, { method: 'PUT', body: data }),
  toggleClassStatus: (id) => apiRequest(`/institute/classes/${id}/toggle-status`, { method: 'PATCH' }),
  deleteClass: (id) => apiRequest(`/institute/classes/${id}`, { method: 'DELETE' }),
  getClassStudents: (id) => apiRequest(`/institute/classes/${id}/students`),

  // Class-Subject Junction
  getClassSubjects: (classId) => apiRequest(`/institute/classes/${classId}/subjects`),
  assignClassSubjects: (classId, data) => apiRequest(`/institute/classes/${classId}/subjects`, { method: 'POST', body: data }),
  removeClassSubject: (classId, subjectId) => apiRequest(`/institute/classes/${classId}/subjects/${subjectId}`, { method: 'DELETE' }),

  // Timetable
  getTimetable: (params = '') => apiRequest(`/institute/timetable${toQuery(params)}`),
  createTimetable: (data) => apiRequest('/institute/timetable', { method: 'POST', body: data }),
  updateTimetable: (id, data) => apiRequest(`/institute/timetable/${id}`, { method: 'PUT', body: data }),
  deleteTimetable: (id) => apiRequest(`/institute/timetable/${id}`, { method: 'DELETE' }),

  getInstituteTeacherAssignments: () => apiRequest('/institute/teacher-assignments'),
  assignInstituteTeacher: (data) => apiRequest('/institute/teacher-assignments', { method: 'POST', body: data }),
  removeInstituteTeacherAssignment: (id) => apiRequest(`/institute/teacher-assignments/${id}`, { method: 'DELETE' }),
  getInstituteTeachers: () => apiRequest('/institute/teachers'),

  // Quran
  getExamErrorTypes: (params = '') => apiRequest(`/quran/exam-error-types${params}`),
  createExamErrorType: (data) => apiRequest('/quran/exam-error-types', { method: 'POST', body: data }),
  updateExamErrorType: (id, data) => apiRequest(`/quran/exam-error-types/${id}`, { method: 'PUT', body: data }),
  toggleExamErrorType: (id) => apiRequest(`/quran/exam-error-types/${id}/toggle`, { method: 'PATCH' }),
  deleteExamErrorType: (id) => apiRequest(`/quran/exam-error-types/${id}`, { method: 'DELETE' }),
  searchStudentsForExam: (params = '') => apiRequest(`/quran/students-search${params}`),
  getMemorizationExams: (params = '') => apiRequest(`/quran/memorization-exams${toQuery(params)}`),
  getMemorizationExamById: (id) => apiRequest(`/quran/memorization-exams/${id}`),
  createMemorizationExam: (data) => apiRequest('/quran/memorization-exams', { method: 'POST', body: data }),
  updateMemorizationExam: (id, data) => apiRequest(`/quran/memorization-exams/${id}`, { method: 'PUT', body: data }),
  deleteMemorizationExam: (id) => apiRequest(`/quran/memorization-exams/${id}`, { method: 'DELETE' }),

  getQuranExamSessions: (params = '') => apiRequest(`/quran/exam-sessions${toQuery(params)}`),
  createQuranExamSession: (data) => apiRequest('/quran/exam-sessions', { method: 'POST', body: data }),
  deleteQuranExamSession: (id) => apiRequest(`/quran/exam-sessions/${id}`, { method: 'DELETE' }),

  getQuranTeachers: (params = '') => apiRequest(`/quran/teachers${toQuery(params)}`),
  createQuranTeacher: (data) => apiRequest('/quran/teachers', { method: 'POST', body: data }),
  updateQuranTeacher: (id, data) => apiRequest(`/quran/teachers/${id}`, { method: 'PUT', body: data }),
  toggleQuranTeacherStatus: (id) => apiRequest(`/quran/teachers/${id}/toggle-status`, { method: 'PATCH' }),
  archiveQuranTeacher: (id) => apiRequest(`/quran/teachers/${id}/archive`, { method: 'PATCH' }),
  deleteQuranTeacher: (id) => apiRequest(`/quran/teachers/${id}`, { method: 'DELETE' }),
  getQuranLevels: () => apiRequest('/quran/levels'),
  createQuranLevel: (data) => apiRequest('/quran/levels', { method: 'POST', body: data }),
  getQuranGroups: () => apiRequest('/quran/groups'),
  createQuranGroup: (data) => apiRequest('/quran/groups', { method: 'POST', body: data }),
  updateQuranGroup: (id, data) => apiRequest(`/quran/groups/${id}`, { method: 'PUT', body: data }),
  deleteQuranGroup: (id) => apiRequest(`/quran/groups/${id}`, { method: 'DELETE' }),
  getGroupStudents: (id) => apiRequest(`/quran/groups/${id}/students`),
  registerStudentToGroup: (groupId, data) => apiRequest(`/quran/groups/${groupId}/register-student`, { method: 'POST', body: data }),
  enrollStudentToGroup: (groupId, data) => apiRequest(`/quran/groups/${groupId}/enroll-student`, { method: 'POST', body: data }),
  removeStudentFromGroup: (groupId, studentId) => apiRequest(`/quran/groups/${groupId}/students/${studentId}`, { method: 'DELETE' }),
  getAvailableStudentsForGroup: (params = '') => apiRequest(`/quran/available-students${params}`),
  searchQuranTransferStudents: (params = '') => apiRequest(`/quran/transfer-students${toQuery(params)}`),
  getQuranTransferHistory: (params = '') => apiRequest(`/quran/transfer-history${toQuery(params)}`),
  transferQuranStudent: (data) => apiRequest('/quran/transfer-student', { method: 'POST', body: data }),
  getQuranTeacherAssignments: () => apiRequest('/quran/teacher-assignments'),
  assignQuranTeacher: (data) => apiRequest('/quran/teacher-assignments', { method: 'POST', body: data }),
  removeQuranTeacherAssignment: (id) => apiRequest(`/quran/teacher-assignments/${id}`, { method: 'DELETE' }),
  getQuranSurahs: () => apiRequest('/quran/surahs'),
  getQuranJuz: () => apiRequest('/quran/juz'),
  getStudentSurahs: (studentId) => apiRequest(`/quran/students/${studentId}/surahs`),
  saveStudentSurahs: (studentId, data) => apiRequest(`/quran/students/${studentId}/surahs`, { method: 'POST', body: data }),
  getSurahVerses: (surahNumber, studentId) => apiRequest(`/quran/surahs/${surahNumber}/verses?student_id=${studentId}`),
  saveSurahVerses: (surahNumber, data) => apiRequest(`/quran/surahs/${surahNumber}/verses`, { method: 'POST', body: data }),
  getQuranStudentSummary: (studentId) => apiRequest(`/quran/students/${studentId}/summary`),
  getQuranExaminations: (params = '') => apiRequest(`/quran/examinations${params}`),
  recordQuranExamination: (data) => apiRequest('/quran/examinations', { method: 'POST', body: data }),
  updateQuranExamination: (id, data) => apiRequest(`/quran/examinations/${id}`, { method: 'PUT', body: data }),
  getHifdhProgress: (params = '') => apiRequest(`/quran/progress${params}`),
  recordHifdhProgress: (data) => apiRequest('/quran/progress', { method: 'POST', body: data }),
  getQuranCertificates: (params = '') => apiRequest(`/quran/certificates${params}`),
  issueQuranCertificate: (data) => apiRequest('/quran/certificates', { method: 'POST', body: data }),

  // Attendance
  getAttendanceSheet: (params = '') => apiRequest(`/attendance/sheet${params}`),
  saveAttendance: (data) => apiRequest('/attendance/save', { method: 'POST', body: data }),
  getAttendanceReport: (params = '') => apiRequest(`/attendance/report${params}`),
  searchAttendanceStudents: (params = '') => apiRequest(`/attendance/search-students${params}`),
  getStudentAttendanceHistory: (params = '') => apiRequest(`/attendance/student-history${params}`),
  updateSingleStudentAttendance: (data) => apiRequest('/attendance/update-single', { method: 'POST', body: data }),


  // Exams & Results Module
  getExams: (params = '') => apiRequest(`/exams${toQuery(params)}`),
  createExam: (data) => apiRequest('/exams', { method: 'POST', body: data }),
  updateExam: (id, data) => apiRequest(`/exams/${id}`, { method: 'PUT', body: data }),
  deleteExam: (id, params = '') => apiRequest(`/exams/${id}${toQuery(params)}`, { method: 'DELETE' }),
  getExamSheet: (id, division) => apiRequest(`/exams/${id}/sheet?division=${division}`),
  saveExamMarks: (id, data) => apiRequest(`/exams/${id}/marks`, { method: 'POST', body: data }),
  getClassResults: (params = '') => apiRequest(`/exams/results/class${toQuery(params)}`),
  downloadClassResultsExcel: (params = '') => apiRequest(`/exams/results/class/export${toQuery(params)}`),
  getStudentResult: (studentId, params = '') => apiRequest(`/exams/results/student/${studentId}${toQuery(params)}`),
  downloadStudentResultExcel: (studentId, params = '') => apiRequest(`/exams/results/student/${studentId}/export${toQuery(params)}`),

  // Unified Examination Periods & Class-Wide Marks
  getExamPeriods: (params = '') => apiRequest(`/exams/periods${toQuery(params)}`),
  getExamSets: (params = '') => apiRequest(`/exams/exam-sets${toQuery(params)}`),
  saveExamSet: (data) => apiRequest('/exams/exam-sets', { method: 'POST', body: data }),
  createExamPeriod: (data) => apiRequest('/exams/periods', { method: 'POST', body: data }),
  updateExamPeriod: (id, data) => apiRequest(`/exams/periods/${id}`, { method: 'PUT', body: data }),
  deleteExamPeriod: (id) => apiRequest(`/exams/periods/${id}`, { method: 'DELETE' }),
  deleteAllExamPeriods: (data) => apiRequest('/exams/periods/delete-all', { method: 'POST', body: data }),
  getUnifiedClassMarksSheet: (params = '') => apiRequest(`/exams/unified-sheet${toQuery(params)}`),
  saveUnifiedClassMarks: (data) => apiRequest('/exams/unified-marks', { method: 'POST', body: data }),

  // Academic-Year Assessment Config & Marking Scheme
  getAssessmentConfig: (params = '') => apiRequest(`/exams/assessment-config${toQuery(params)}`),
  saveAssessmentConfig: (data) => apiRequest('/exams/assessment-config', { method: 'POST', body: data }),
  setupStandardExamScheme: (data) => apiRequest('/exams/setup-standard-scheme', { method: 'POST', body: data }),
  saveSchemeRule: (data) => apiRequest('/exams/scheme-rule', { method: 'POST', body: data }),

  // Examination Timetables
  getClassExamTimetable: (params = '') => apiRequest(`/exams/timetables${toQuery(params)}`),
  saveClassExamTimetable: (data) => apiRequest('/exams/timetables', { method: 'POST', body: data }),
  deleteClassExamTimetableEntry: (id) => apiRequest(`/exams/timetables/${id}`, { method: 'DELETE' }),

  // Automatic Single Mark Saving
  saveSingleMark: (data) => apiRequest('/exams/single-mark', { method: 'POST', body: data }),

  // Class Progression, Promotions & Graduation
  getClassProgression: () => apiRequest('/exams/classes/progression'),
  updateClassProgression: (data) => apiRequest('/exams/classes/progression', { method: 'PUT', body: data }),
  confirmFinalResults: (data) => apiRequest('/exams/promotions/confirm-results', { method: 'POST', body: data }),
  getPromotionPreview: (params = '') => apiRequest(`/exams/promotions/preview${toQuery(params)}`),
  executePromotions: (data) => apiRequest('/exams/promotions/execute', { method: 'POST', body: data }),
  overrideStudentPromotion: (data) => apiRequest('/exams/promotions/override', { method: 'POST', body: data }),
  getPromotionHistory: (params = '') => apiRequest(`/exams/promotions/history${toQuery(params)}`),

  // Comprehensive Searchable Historical Reports
  getHistoricalExamReports: (params = '') => apiRequest(`/reports/historical-exams${toQuery(params)}`),
  downloadHistoricalExamReportsExcel: (params = '') => {
    const q = toQuery(params);
    const connector = q.includes('?') ? '&' : '?';
    return apiRequest(`/reports/historical-exams${q}${connector}export_xlsx=true`);
  },

  // Exam Fee Management (رسوم الامتحان)
  getExamFeeRules: (params = '') => apiRequest(`/exams/fees/rules${toQuery(params)}`),
  setExamFeeRule: (data) => apiRequest('/exams/fees/rules', { method: 'POST', body: data }),
  getStudentExamFeeStatus: (params = '') => apiRequest(`/exams/fees/student-status${toQuery(params)}`),
  recordExamFeePayment: (data) => apiRequest('/exams/fees/pay', { method: 'POST', body: data }),
  getExamFeeHistory: (params = '') => apiRequest(`/exams/fees/history${toQuery(params)}`),
  getExamFeeReceipt: (id) => apiRequest(`/exams/fees/receipt/${id}`),

  // Finance (Simplified 4 sections)
  getFinanceDashboard: (division) => apiRequest(`/finance/dashboard${division ? `?division=${division}` : ''}`),
  getStudentsAndFees: (params = '') => apiRequest(`/finance/students-fees${params}`),
  getPaymentMatrix: (params = '') => apiRequest(`/finance/payment-matrix${params}`),
  getPaymentDetails: (studentId, division, period, feeType = 'monthly') =>
    apiRequest(`/finance/payment-details?student_id=${studentId}&division=${division}&billing_period=${encodeURIComponent(period)}&fee_type=${encodeURIComponent(feeType)}`),
  receivePayment: (data) => apiRequest('/finance/receive-payment', { method: 'POST', body: data }),
  getReceipt: (receiptNumber) => apiRequest(`/finance/receipt/${receiptNumber}`),
  adjustPayment: (data) => apiRequest('/finance/adjust-payment', { method: 'POST', body: data }),
  getFeeRules: () => apiRequest('/finance/fee-rules'),
  setFeeRule: (data) => apiRequest('/finance/fee-rules', { method: 'POST', body: data }),
  getStudentDiscounts: () => apiRequest('/finance/discounts'),
  createStudentDiscount: (data) => apiRequest('/finance/discounts', { method: 'POST', body: data }),

  // Reports
  getFinanceReports: (params = '') => apiRequest(`/reports/finance${params}`),
  downloadFinanceExcel: async (params = '') => apiRequest(`/reports/finance${params}&export_xlsx=true`),
  
  getOutstandingFeesReport: (params = '') => apiRequest(`/reports/outstanding-fees${params}`),
  getStudentFinancialProfile: (studentId) => apiRequest(`/reports/student-financial/${encodeURIComponent(studentId)}`),
  downloadOutstandingFeesExcel: async (params = '') => apiRequest(`/reports/outstanding-fees${params}&export_xlsx=true`),
  
  getAttendanceReports: (params = '') => apiRequest(`/reports/attendance${params}`),
  downloadAttendanceExcel: async (params = '') => apiRequest(`/reports/attendance${params}&export_xlsx=true`),
  
  getExamResultsReport: (examId, division) => apiRequest(`/reports/exams?exam_id=${examId}&division=${division}`),
  getAvailableExams: (division) => apiRequest(`/reports/exams?division=${division}`),
  downloadExamExcel: async (examId, division) => apiRequest(`/reports/exams?exam_id=${examId}&division=${division}&export_xlsx=true`),

  getStudentsRosterReport: (params = '') => apiRequest(`/reports/students${params}`),
  downloadStudentsExcel: async (params = '') => apiRequest(`/reports/students${params}&export_xlsx=true`),

  getQuranHifdhReport: (params = '') => apiRequest(`/reports/quran-hifdh${params}`),
  downloadQuranHifdhExcel: async (params = '') => apiRequest(`/reports/quran-hifdh${params}&export_xlsx=true`)
};

