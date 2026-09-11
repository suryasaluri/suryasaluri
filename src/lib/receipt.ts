import { jsPDF } from "jspdf";
import { formatCurrencyFull, formatDate, titleCase } from "@/lib/format";

export function downloadReceipt(payment: {
  receipt_reference?: string | null;
  amount: number | string;
  paid_date?: string | null;
  payment_mode?: string | null;
  property_code?: string;
  customer_name?: string;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const marginX = 40;
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SAN Connect", marginX, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y += 18;
  doc.text("Payment Receipt", marginX, y);

  y += 30;
  doc.setDrawColor(200);
  doc.line(marginX, y, 380, y);
  y += 30;

  const rows: [string, string][] = [
    ["Receipt No.", payment.receipt_reference ?? "—"],
    ["Date", formatDate(payment.paid_date)],
    ["Customer", payment.customer_name ?? "—"],
    ["Property", payment.property_code ?? "—"],
    ["Payment mode", titleCase(payment.payment_mode)],
    ["Amount paid", formatCurrencyFull(payment.amount)],
  ];

  doc.setFontSize(11);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), marginX + 140, y);
    y += 22;
  }

  y += 20;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("This is a system-generated receipt from SAN Connect.", marginX, y);

  doc.save(`SANConnect-Receipt-${payment.receipt_reference ?? "receipt"}.pdf`);
}
