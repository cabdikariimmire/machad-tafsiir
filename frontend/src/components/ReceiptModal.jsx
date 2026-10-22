import React from 'react';
import { Printer, X } from 'lucide-react';

/**
 * Compact academic receipt voucher.
 *
 * Financial balances remain in the API/database, but are intentionally not
 * printed on this voucher. The receipt is a record of the payment received,
 * not a statement of every outstanding obligation.
 */
export default function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const isInstitute = (receipt.division || '').toLowerCase() === 'institute';
  const logoSrc = isInstitute ? '/branding/tafsiir-institute-logo.jpeg' : null;

  const amountPaid = Number(receipt.amount_paid ?? receipt.amountPaid ?? 0);
  const receiptNumber = receipt.receipt_number || receipt.receiptNumber || 'REC-0000';
  const studentName = receipt.student_name || receipt.studentName || '-';
  const studentCode = receipt.student_code || receipt.studentCode || receipt.student_id || '-';
  const className = receipt.class_name || receipt.class_or_group_name || receipt.classOrGroupName || receipt.className || '-';
  const receivedBy = receipt.received_by_name || receipt.cashier || '-';
  const paymentDate = receipt.payment_date
    ? new Date(receipt.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const feeType = receipt.fee_type === 'registration' ? 'Registration Fee' : 'Monthly Tuition Fee';
  const feeTypeSomali = receipt.fee_type === 'registration' ? 'Lacagta Diiwaangelinta' : 'Lacagta Bisha';
  const period = receipt.billing_period || receipt.period || receipt.month || '-';
  const periodLabel = receipt.fee_type === 'registration' ? 'Registration Year' : 'Billing Period';
  const periodValue = receipt.fee_type === 'registration'
    ? String(period).replace(/^registration-/i, '')
    : period;

  return (
    <div className="receipt-modal-overlay receipt-print-scope" role="dialog" aria-modal="true" aria-label="Receipt voucher" dir="ltr">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }

        .receipt-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          overflow-y: auto;
          padding: 24px 16px;
          background: rgba(15, 23, 42, 0.72);
        }

        .receipt-screen-wrap { width: 100%; max-width: 780px; }

        .receipt-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          padding: 8px 12px;
          color: #fff;
          background: #111;
          border-radius: 4px;
          font-size: 13px;
        }

        .receipt-action-buttons { display: flex; align-items: center; gap: 8px; }

        .receipt-action-buttons button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 30px;
          padding: 5px 10px;
          border: 1px solid #fff;
          border-radius: 3px;
          color: #fff;
          background: #111;
          font: inherit;
          cursor: pointer;
        }

        .receipt-action-buttons button:hover { background: #333; }

        .receipt-paper {
          width: 100%;
          box-sizing: border-box;
          padding: 24px 30px 22px;
          color: #111;
          background: #fff;
          border: 1px solid #111;
          font-family: Arial, Helvetica, sans-serif;
        }

        .receipt-branding {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 66px;
          padding-bottom: 12px;
          border-bottom: 1px solid #111;
        }

        .receipt-branding img {
          display: block;
          width: min(100%, 360px);
          max-height: 76px;
          height: auto;
          object-fit: contain;
        }

        .quran-branding {
          width: 100%;
          text-align: center;
          direction: rtl;
          font-family: Arial, "Noto Naskh Arabic", Tahoma, sans-serif;
        }

        .quran-branding-ar { font-size: 21px; font-weight: 700; line-height: 1.5; }
        .quran-branding-en { margin-top: 3px; font-size: 12px; letter-spacing: 1px; font-weight: 700; }

        .receipt-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          padding: 14px 0 12px;
          border-bottom: 1px solid #111;
        }

        .receipt-title { margin: 0; font-size: 22px; line-height: 1.15; letter-spacing: 0.8px; font-weight: 800; }
        .receipt-subtitle { margin-top: 4px; font-family: Arial, "Noto Naskh Arabic", Tahoma, sans-serif; font-size: 13px; direction: rtl; }

        .receipt-meta { min-width: 210px; font-size: 12px; line-height: 1.7; text-align: right; }
        .receipt-meta-row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px dotted #555; }
        .receipt-label { font-size: 10px; letter-spacing: 0.45px; font-weight: 700; text-transform: uppercase; }

        .receipt-section-title { margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #111; font-size: 12px; letter-spacing: 0.6px; font-weight: 800; text-transform: uppercase; }

        .receipt-details-grid { display: grid; grid-template-columns: 1.25fr 0.75fr; border-top: 1px solid #111; border-left: 1px solid #111; }
        .receipt-detail { min-height: 52px; padding: 8px 10px; border-right: 1px solid #111; border-bottom: 1px solid #111; }
        .receipt-value { display: block; margin-top: 4px; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }

        .receipt-fee-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .receipt-fee-table th, .receipt-fee-table td { padding: 9px 10px; border: 1px solid #111; text-align: left; }
        .receipt-fee-table th { font-size: 10px; letter-spacing: 0.4px; text-transform: uppercase; }
        .receipt-amount-cell { width: 28%; text-align: right !important; white-space: nowrap; font-size: 17px; font-weight: 800; }

        .receipt-total { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 10px 12px; border: 1px solid #111; font-size: 14px; font-weight: 800; }
        .receipt-total-amount { font-size: 20px; }

        .receipt-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 30px; }
        .receipt-signature-block { min-height: 82px; }
        .receipt-footer-label { font-size: 11px; font-weight: 700; }
        .receipt-signature-line { margin-top: 30px; border-top: 1px solid #111; padding-top: 5px; font-size: 11px; }
        .receipt-stamp-box { width: 138px; height: 58px; margin-top: 8px; border: 1px solid #111; display: flex; align-items: center; justify-content: center; font-size: 10px; text-transform: uppercase; }

        .receipt-close-link { display: block; margin: 10px auto 0; color: #ddd; background: transparent; border: 0; cursor: pointer; font-size: 12px; }

        @media (max-width: 640px) {
          .receipt-modal-overlay { padding: 10px 8px; }
          .receipt-paper { padding: 18px 14px; }
          .receipt-heading { align-items: flex-start; flex-direction: column; }
          .receipt-meta { width: 100%; min-width: 0; text-align: left; }
          .receipt-details-grid { grid-template-columns: 1fr; }
          .receipt-footer { gap: 14px; }
        }

        @media print {
          body * { visibility: hidden !important; }
          .receipt-print-scope, .receipt-print-scope .receipt-paper, .receipt-print-scope .receipt-paper * { visibility: visible !important; }
          .receipt-print-scope { position: static !important; display: block !important; width: 100% !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; background: #fff !important; }
          .receipt-screen-wrap { max-width: none !important; }
          .receipt-actions, .receipt-close-link { display: none !important; }
          .receipt-paper { width: 185mm !important; max-width: 185mm !important; margin: 0 auto !important; padding: 16px 20px 18px !important; border: 1px solid #111 !important; box-shadow: none !important; border-radius: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="receipt-screen-wrap">
        <div className="receipt-actions">
          <span>Receipt Voucher / Rasiid Lacag-bixin</span>
          <div className="receipt-action-buttons">
            <button type="button" onClick={() => window.print()}><Printer size={14} /> Print</button>
            <button type="button" onClick={onClose} aria-label="Close receipt"><X size={15} /></button>
          </div>
        </div>

        <div className="receipt-paper">
          <header className="receipt-branding">
            {logoSrc ? (
              <img src={logoSrc} alt="Tafsiir Institute of Sharia, Arabic & Sciences" />
            ) : (
              <div className="quran-branding">
                <div className="quran-branding-ar">مدرسة تحفيظ القرآن الكريم</div>
                <div className="quran-branding-en">QURAN SCHOOL</div>
              </div>
            )}
          </header>

          <section className="receipt-heading">
            <div>
              <h1 className="receipt-title">RECEIPT VOUCHER</h1>
              <div className="receipt-subtitle">إيصال استلام رسوم</div>
            </div>
            <div className="receipt-meta">
              <div className="receipt-meta-row"><span className="receipt-label">Receipt No.</span><strong>{receiptNumber}</strong></div>
              <div className="receipt-meta-row"><span className="receipt-label">Payment Date</span><strong>{paymentDate}</strong></div>
            </div>
          </section>

          <div className="receipt-section-title">Student Information / بيانات الطالب</div>
          <div className="receipt-details-grid">
            <div className="receipt-detail"><span className="receipt-label">Student Name / اسم الطالب</span><span className="receipt-value">{studentName}</span></div>
            <div className="receipt-detail"><span className="receipt-label">Student ID / رقم الطالب</span><span className="receipt-value">{studentCode}</span></div>
            <div className="receipt-detail"><span className="receipt-label">Class or Level / الصف أو المستوى</span><span className="receipt-value">{className}</span></div>
            <div className="receipt-detail"><span className="receipt-label">Department / القسم</span><span className="receipt-value">{isInstitute ? 'Tafsiir Institute' : 'Quran School'}</span></div>
          </div>

          <div className="receipt-section-title">Payment Details / تفاصيل الدفع</div>
          <table className="receipt-fee-table">
            <thead><tr><th>Description / البيان</th><th>{periodLabel}</th><th className="receipt-amount-cell">Amount (USD)</th></tr></thead>
            <tbody><tr><td>{feeType}<br /><span dir="rtl">{feeTypeSomali}</span></td><td>{periodValue}</td><td className="receipt-amount-cell">${amountPaid.toFixed(2)}</td></tr></tbody>
          </table>

          <div className="receipt-total"><span>Total Amount Paid / Wadarta La Bixiyay</span><span className="receipt-total-amount">${amountPaid.toFixed(2)}</span></div>

          <footer className="receipt-footer">
            <div className="receipt-signature-block">
              <div className="receipt-footer-label">Received By / Waxaa qabtay</div>
              <div className="receipt-signature-line">{receivedBy}</div>
            </div>
            <div className="receipt-signature-block">
              <div className="receipt-footer-label">Authorized Signature / Saxiix</div>
              <div className="receipt-signature-line">&nbsp;</div>
              <div className="receipt-stamp-box">Official Stamp</div>
            </div>
          </footer>
        </div>

        <button type="button" className="receipt-close-link" onClick={onClose}>Close Receipt</button>
      </div>
    </div>
  );
}
