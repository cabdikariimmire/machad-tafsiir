import { Router } from 'express';
import {
  getFinanceDashboard,
  getStudentsAndFees,
  getStudentPaymentDetails,
  receivePayment,
  getReceipt,
  adjustPayment,
  getFeeRules,
  setFeeRule,
  getStudentDiscounts,
  createStudentDiscount,
  getPaymentMatrix
} from '../controllers/financeController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
// Strictly prevent teachers and unauthorized staff from accessing financial data
router.use(requireRole(['super_admin', 'institute_admin', 'quran_admin', 'finance_user']));
router.get('/dashboard', getFinanceDashboard);

// 2. Students & Fees & Matrix
router.get('/students-fees', getStudentsAndFees);
router.get('/payment-details', getStudentPaymentDetails);
router.get('/payment-matrix', getPaymentMatrix);

// 3. Payments (Receive payment & generate receipt - strictly NO payment method)
router.post('/receive-payment', requireRole(['super_admin', 'institute_admin', 'quran_admin', 'finance_user']), receivePayment);
router.get('/receipt/:receipt_number', getReceipt);
router.post('/adjust-payment', requireRole(['super_admin', 'finance_user']), adjustPayment);

// 5. Settings: Fee Rules & Discounts (Super Admin / Admin)
router.get('/fee-rules', getFeeRules);
router.post('/fee-rules', requireRole(['super_admin']), setFeeRule);
router.get('/discounts', getStudentDiscounts);
router.post('/discounts', requireRole(['super_admin']), createStudentDiscount);

export default router;
