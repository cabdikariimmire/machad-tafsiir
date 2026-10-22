import { Printer, X } from 'lucide-react';

/**
 * Examination fee voucher. It deliberately contains only the examination
 * transaction; tuition and registration balances are never rendered here.
 */
export default function CenteredArabicExamReceipt({ receipt, onClose }) {
  if (!receipt) return null;

  const formatAmount = (value) => Number(value || 0).toFixed(2);
  const paymentDate = receipt.payment_date
    ? new Date(receipt.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="exam-receipt-overlay exam-receipt-print-scope" role="dialog" aria-modal="true" aria-label="Examination fee receipt" dir="ltr">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }

        .exam-receipt-overlay {
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

        .exam-receipt-screen-wrap { width: 100%; max-width: 780px; }

        .exam-receipt-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          padding: 8px 12px;
          color: #fff;
          background: #111;
          border-radius: 4px;
          font-size: 13px;
        }

        .exam-receipt-actions-buttons { display: flex; gap: 8px; }

        .exam-receipt-actions button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 30px;
          padding: 5px 10px;
          color: #fff;
          background: #111;
          border: 1px solid #fff;
          border-radius: 3px;
          font: inherit;
          cursor: pointer;
        }

        .exam-receipt-paper {
          width: 100%;
          box-sizing: border-box;
          padding: 24px 30px 22px;
          color: #111;
          background: #fff;
          border: 1px solid #111;
          font-family: Arial, "Noto Naskh Arabic", Tahoma, sans-serif;
        }

        .exam-receipt-branding {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 66px;
          padding-bottom: 12px;
          border-bottom: 1px solid #111;
        }

        .exam-receipt-branding img {
          display: block;
          width: min(100%, 360px);
          max-height: 76px;
          height: auto;
          object-fit: contain;
        }

        .exam-receipt-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 18px;
          padding: 14px 0 12px;
          border-bottom: 1px solid #111;
        }

        .exam-receipt-title { margin: 0; font-size: 22px; line-height: 1.15; font-weight: 800; letter-spacing: 0.4px; }
        .exam-receipt-title-ar { margin-top: 4px; font-size: 15px; direction: rtl; font-weight: 700; }
        .exam-receipt-meta { min-width: 210px; font-size: 12px; line-height: 1.7; text-align: right; }
        .exam-receipt-meta-row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px dotted #555; }
        .exam-receipt-label { font-size: 10px; letter-spacing: 0.4px; font-weight: 700; text-transform: uppercase; }

        .exam-receipt-section-title { margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #111; font-size: 12px; letter-spacing: 0.5px; font-weight: 800; text-transform: uppercase; }
        .exam-receipt-grid { display: grid; grid-template-columns: 1.25fr 0.75fr; border-top: 1px solid #111; border-left: 1px solid #111; }
        .exam-receipt-detail { min-height: 52px; padding: 8px 10px; border-right: 1px solid #111; border-bottom: 1px solid #111; }
        .exam-receipt-value { display: block; margin-top: 4px; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }

        .exam-receipt-exam-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .exam-receipt-exam-table th, .exam-receipt-exam-table td { padding: 9px 10px; border: 1px solid #111; text-align: left; }
        .exam-receipt-exam-table th { font-size: 10px; letter-spacing: 0.4px; text-transform: uppercase; }
        .exam-receipt-amount { text-align: right !important; font-size: 17px; font-weight: 800; white-space: nowrap; }

        .exam-receipt-total { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 10px 12px; border: 1px solid #111; font-size: 14px; font-weight: 800; }
        .exam-receipt-total-amount { font-size: 20px; }

        .exam-receipt-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 30px; }
        .exam-receipt-signature-block { min-height: 82px; }
        .exam-receipt-footer-label { font-size: 11px; font-weight: 700; }
        .exam-receipt-signature-line { margin-top: 30px; border-top: 1px solid #111; padding-top: 5px; font-size: 11px; }
        .exam-receipt-stamp-box { width: 138px; height: 58px; margin-top: 8px; border: 1px solid #111; display: flex; align-items: center; justify-content: center; font-size: 10px; text-transform: uppercase; }
        .exam-receipt-close { display: block; margin: 10px auto 0; color: #ddd; background: transparent; border: 0; cursor: pointer; font-size: 12px; }

        @media (max-width: 640px) {
          .exam-receipt-overlay { padding: 10px 8px; }
          .exam-receipt-paper { padding: 18px 14px; }
          .exam-receipt-heading { align-items: flex-start; flex-direction: column; }
          .exam-receipt-meta { width: 100%; min-width: 0; text-align: left; }
          .exam-receipt-grid { grid-template-columns: 1fr; }
          .exam-receipt-footer { gap: 14px; }
        }

        @media print {
          body * { visibility: hidden !important; }
          .exam-receipt-print-scope, .exam-receipt-print-scope .exam-receipt-paper, .exam-receipt-print-scope .exam-receipt-paper * { visibility: visible !important; }
          .exam-receipt-print-scope { position: static !important; display: block !important; width: 100% !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; background: #fff !important; }
          .exam-receipt-screen-wrap { max-width: none !important; }
          .exam-receipt-actions, .exam-receipt-close { display: none !important; }
          .exam-receipt-paper { width: 185mm !important; max-width: 185mm !important; margin: 0 auto !important; padding: 16px 20px 18px !important; border: 1px solid #111 !important; box-shadow: none !important; border-radius: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="exam-receipt-screen-wrap">
        <div className="exam-receipt-actions">
          <span>Examination Fee Receipt / إيصال رسوم الامتحان</span>
          <div className="exam-receipt-actions-buttons">
            <button type="button" onClick={() => window.print()}><Printer size={14} /> Print</button>
            {onClose && <button type="button" onClick={onClose} aria-label="Close receipt"><X size={15} /></button>}
          </div>
        </div>

        <div className="exam-receipt-paper">
          <header className="exam-receipt-branding">
            <img src="/branding/tafsiir-institute-logo.jpeg" alt="Tafsiir Institute of Sharia, Arabic & Sciences" />
          </header>

          <section className="exam-receipt-heading">
            <div>
              <h1 className="exam-receipt-title">EXAMINATION FEE RECEIPT</h1>
              <div className="exam-receipt-title-ar">إيصال رسوم الامتحان</div>
            </div>
            <div className="exam-receipt-meta">
              <div className="exam-receipt-meta-row"><span className="exam-receipt-label">Receipt No.</span><strong>{receipt.receipt_number || '-'}</strong></div>
              <div className="exam-receipt-meta-row"><span className="exam-receipt-label">Payment Date</span><strong>{paymentDate}</strong></div>
            </div>
          </section>

          <div className="exam-receipt-section-title">Student Information / بيانات الطالب</div>
          <div className="exam-receipt-grid">
            <div className="exam-receipt-detail"><span className="exam-receipt-label">Student Name / اسم الطالب</span><span className="exam-receipt-value">{receipt.student_name || '-'}</span></div>
            <div className="exam-receipt-detail"><span className="exam-receipt-label">Student ID / رقم الطالب</span><span className="exam-receipt-value">{receipt.student_code || receipt.student_id || '-'}</span></div>
            <div className="exam-receipt-detail"><span className="exam-receipt-label">Class or Level / الصف أو المستوى</span><span className="exam-receipt-value">{receipt.class_name || '-'}</span></div>
            <div className="exam-receipt-detail"><span className="exam-receipt-label">Academic Year / العام الدراسي</span><span className="exam-receipt-value">{receipt.academic_year || '-'}</span></div>
          </div>

          <div className="exam-receipt-section-title">Examination Payment / تفاصيل رسوم الامتحان</div>
          <table className="exam-receipt-exam-table">
            <thead><tr><th>Examination Period / فترة الامتحان</th><th className="exam-receipt-amount">Amount Paid (USD)</th></tr></thead>
            <tbody><tr><td>{receipt.exam_period || '-'}</td><td className="exam-receipt-amount">${formatAmount(receipt.amount_paid)}</td></tr></tbody>
          </table>

          <div className="exam-receipt-total"><span>Total Examination Fee Paid / إجمالي رسوم الامتحان</span><span className="exam-receipt-total-amount">${formatAmount(receipt.amount_paid)}</span></div>

          <footer className="exam-receipt-footer">
            <div className="exam-receipt-signature-block">
              <div className="exam-receipt-footer-label">Received By / استلمها</div>
              <div className="exam-receipt-signature-line">{receipt.received_by_name || '-'}</div>
            </div>
            <div className="exam-receipt-signature-block">
              <div className="exam-receipt-footer-label">Authorized Signature / التوقيع</div>
              <div className="exam-receipt-signature-line">&nbsp;</div>
              <div className="exam-receipt-stamp-box">Official Stamp</div>
            </div>
          </footer>
        </div>

        {onClose && <button type="button" className="exam-receipt-close" onClick={onClose}>Close Receipt</button>}
      </div>
    </div>
  );
}
