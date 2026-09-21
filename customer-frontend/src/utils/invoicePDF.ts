/**
 * Generates a professional CargoX invoice as a printable HTML page.
 * Opens in a new window, auto-prints, and the browser "Save as PDF"
 * will name the file {bookingId}.pdf.
 * 
 * @param inv     - Invoice object from backend
 * @param booking - Matching DeliveryRequest/booking object (optional, enriches invoice)
 */
export function generateInvoicePDF(inv: any, booking?: any, autoPrint: boolean = true) {
  // Determine request identifier for filename and display
  const requestNumber = booking?.request_number || inv.request_number || (inv.request_id ? `REQ-${String(inv.request_id).slice(0, 8).toUpperCase()}` : `INV-${inv.id}`);
  
  // Format dates
  const issuedDateObj = inv.issued_at ? new Date(inv.issued_at) : new Date();
  const issueDate = issuedDateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dueDate = inv.due_at 
    ? new Date(inv.due_at).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

  // Build sanitized filename: CargoX_<RequestNumber>_<YYYY-MM-DD>_<HH-mm>.pdf
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${issuedDateObj.getFullYear()}-${pad(issuedDateObj.getMonth() + 1)}-${pad(issuedDateObj.getDate())}`;
  const timeStr = `${pad(issuedDateObj.getHours())}-${pad(issuedDateObj.getMinutes())}`;
  const rawFileName = `CargoX_${requestNumber}_${dateStr}_${timeStr}`;
  // Sanitize Windows invalid characters: \ / : * ? " < > |
  const sanitizedFileName = rawFileName.replace(/[/\\?%*:|"<>]/g, "-") + ".pdf";

  const fmt = (n: any) =>
    parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Customer & Bill-to details (only actual fields, never fabricated)
  const customerName = booking?.customer_company_name || inv.customer_company_name || "Valued Customer";
  const billingAddr = booking?.billing_address || booking?.pickup_address || "—";
  const contactPerson = booking?.pickup_contact_person || "—";
  const contactPhone = booking?.pickup_phone || "—";
  const gstin = booking?.gstin || inv.gstin || null;

  // Trip / Transport details
  const pickupCo   = booking?.pickup_company_name    || "—";
  const pickupAddr = booking?.pickup_address          || "—";
  const dropCo     = booking?.destination_company_name || "—";
  const dropAddr   = booking?.destination_address      || "—";
  const weight     = booking?.weight_tons !== undefined ? `${booking.weight_tons} Tons` : "—";
  const goodsType  = booking?.goods_type || "General Cargo";
  const goodsDesc  = booking?.goods_description || "—";
  const distanceKm = inv.distance_km ?? booking?.distance_km ?? null;
  const vehicleReg = booking?.vehicle_number || booking?.vehicle_registration || "—";
  const driverName = booking?.driver_name || "—";

  // Financial figures (Backend is authoritative — strictly customer-safe)
  const subtotal   = parseFloat(inv.subtotal || inv.customer_total_charge || inv.total_amount || 0);
  const tax        = parseFloat(inv.tax || 0);
  const discount   = parseFloat(inv.discount || 0);
  const total      = parseFloat(inv.total_amount || subtotal + tax - discount);
  const amountPaid = parseFloat(inv.amount_paid || 0);
  const amountDue  = parseFloat(inv.amount_due !== undefined ? inv.amount_due : total - amountPaid);
  const status     = inv.status || "UNPAID";

  const paymentMethod = inv.payments?.[0]?.method || "—";
  const paymentRef    = inv.payments?.[0]?.reference_number || "—";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${sanitizedFileName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    @page {
      size: A4;
      margin: 15mm;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: #0f172a;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
    }

    @media print {
      body { padding: 0; background: #fff !important; }
      .no-print { display: none !important; }
      .page-container { border: none !important; box-shadow: none !important; }
    }

    .page-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .brand-subtitle {
      font-size: 12px;
      font-weight: 600;
      color: #2563eb;
      margin-top: 2px;
    }
    .brand-contact {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
      line-height: 1.4;
    }

    .invoice-title-block {
      text-align: right;
    }
    .doc-type {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.5px;
    }
    .meta-table {
      margin-top: 6px;
      font-size: 12px;
      text-align: right;
    }
    .meta-table td {
      padding: 2px 0 2px 12px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 500;
    }
    .meta-val {
      font-weight: 700;
      color: #0f172a;
      font-family: monospace;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .badge-paid { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-partial { background: #fef9c3; color: #a16207; border: 1px solid #fde047; }
    .badge-unpaid { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }

    .section-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 20px;
    }
    .section-header {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .field-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .field-label {
      color: #64748b;
    }
    .field-value {
      font-weight: 600;
      color: #1e293b;
      text-align: right;
    }

    table.charges-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    table.charges-table th {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #cbd5e1;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
      text-align: left;
    }
    table.charges-table th.num { text-align: right; }
    table.charges-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12px;
    }
    table.charges-table td.num { text-align: right; font-family: monospace; font-size: 13px; }

    .summary-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      gap: 20px;
    }
    .payment-info {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
      font-size: 12px;
    }
    .summary-table {
      width: 280px;
      border-collapse: collapse;
    }
    .summary-table td {
      padding: 5px 8px;
      font-size: 12px;
    }
    .summary-table td.val {
      text-align: right;
      font-weight: 600;
      font-family: monospace;
      font-size: 13px;
    }
    .total-row {
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      font-size: 14px !important;
      font-weight: 800 !important;
      color: #0f172a;
    }
    .total-row td {
      padding: 8px !important;
    }

    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      line-height: 1.6;
    }

    .action-bar {
      margin-bottom: 18px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      border: none;
    }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-secondary { background: #e2e8f0; color: #1e293b; }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <button class="btn btn-secondary" onclick="window.close()">Close</button>
    <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="page-container">
    <div class="header">
      <div>
        <div class="brand-title">CargoX</div>
        <div class="brand-subtitle">Transport Services</div>
        <div class="brand-contact">
          Reliable Interstate Freight & Fleet Solutions<br>
          Email: billing@cargox.in | Support: +91 (800) 227-469
        </div>
      </div>
      <div class="invoice-title-block">
        <div class="doc-type">TAX INVOICE</div>
        <table class="meta-table">
          <tr>
            <td class="meta-label">Invoice No:</td>
            <td class="meta-val">${inv.invoice_number}</td>
          </tr>
          <tr>
            <td class="meta-label">Invoice Date:</td>
            <td class="meta-val">${issueDate}</td>
          </tr>
          <tr>
            <td class="meta-label">Due Date:</td>
            <td class="meta-val">${dueDate}</td>
          </tr>
          <tr>
            <td class="meta-label">Status:</td>
            <td>
              <span class="badge ${status === 'PAID' ? 'badge-paid' : status === 'PARTIALLY_PAID' ? 'badge-partial' : 'badge-unpaid'}">
                ${status}
              </span>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <div class="section-box">
      <div class="section-header">Bill To (Customer Information)</div>
      <div class="grid-2">
        <div>
          <p style="font-weight:700; font-size:14px; color:#0f172a;">${customerName}</p>
          <p style="color:#475569; font-size:12px; margin-top:3px;">${billingAddr}</p>
          ${gstin ? `<p style="font-size:11px; color:#64748b; margin-top:4px;">GSTIN: <span style="font-family:monospace; font-weight:600;">${gstin}</span></p>` : ''}
        </div>
        <div>
          <div class="field-row">
            <span class="field-label">Contact Person:</span>
            <span class="field-value">${contactPerson}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Phone:</span>
            <span class="field-value">${contactPhone}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Request Ref:</span>
            <span class="field-value">${requestNumber}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="section-box">
      <div class="section-header">Trip & Transport Details</div>
      <div class="grid-2">
        <div>
          <div class="field-row">
            <span class="field-label">Origin (Pickup):</span>
            <span class="field-value">${pickupCo} — ${pickupAddr}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Destination:</span>
            <span class="field-value">${dropCo} — ${dropAddr}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Commodity:</span>
            <span class="field-value">${goodsType} ${goodsDesc !== '—' ? '(' + goodsDesc + ')' : ''}</span>
          </div>
        </div>
        <div>
          <div class="field-row">
            <span class="field-label">Cargo Weight:</span>
            <span class="field-value">${weight}</span>
          </div>
          ${distanceKm ? `
          <div class="field-row">
            <span class="field-label">Distance:</span>
            <span class="field-value">${parseFloat(distanceKm).toFixed(1)} km</span>
          </div>` : ''}
          <div class="field-row">
            <span class="field-label">Vehicle Assigned:</span>
            <span class="field-value">${vehicleReg}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Driver:</span>
            <span class="field-value">${driverName}</span>
          </div>
        </div>
      </div>
    </div>

    <table class="charges-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Transportation Charges</strong><br>
            <span style="color:#64748b; font-size:11px;">Freight haulage for ${goodsType} (${weight}) from ${pickupCo} to ${dropCo}</span>
          </td>
          <td class="num">${distanceKm ? parseFloat(distanceKm).toFixed(1) + ' km' : '1 Trip'}</td>
          <td class="num">₹${fmt(subtotal)}</td>
        </tr>
        ${tax > 0 ? `
        <tr>
          <td>Goods & Services Tax (GST)</td>
          <td class="num">—</td>
          <td class="num">₹${fmt(tax)}</td>
        </tr>` : ''}
        ${discount > 0 ? `
        <tr>
          <td>Promotional Discount</td>
          <td class="num">—</td>
          <td class="num">- ₹${fmt(discount)}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <div class="summary-container">
      <div class="payment-info">
        <div class="section-header" style="margin-bottom:6px;">Payment Information</div>
        <div class="field-row">
          <span class="field-label">Payment Method:</span>
          <span class="field-value">${paymentMethod}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Reference:</span>
          <span class="field-value">${paymentRef}</span>
        </div>
        <div class="field-row" style="margin-top:6px;">
          <span class="field-label">Payment Status:</span>
          <span class="field-value" style="color:${status === 'PAID' ? '#15803d' : '#b91c1c'}">${status}</span>
        </div>
      </div>

      <table class="summary-table">
        <tr>
          <td style="color:#64748b;">Subtotal:</td>
          <td class="val">₹${fmt(subtotal)}</td>
        </tr>
        <tr>
          <td style="color:#64748b;">Tax:</td>
          <td class="val">₹${fmt(tax)}</td>
        </tr>
        ${discount > 0 ? `
        <tr>
          <td style="color:#64748b;">Discount:</td>
          <td class="val">- ₹${fmt(discount)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td>TOTAL:</td>
          <td class="val">₹${fmt(total)}</td>
        </tr>
        <tr>
          <td style="color:#15803d; font-weight:600;">Amount Paid:</td>
          <td class="val" style="color:#15803d;">₹${fmt(amountPaid)}</td>
        </tr>
        <tr>
          <td style="color:#b91c1c; font-weight:700;">Amount Due:</td>
          <td class="val" style="color:#b91c1c;">₹${fmt(amountDue)}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <p><strong>Terms & Conditions:</strong> Payment is due according to agreed credit terms. All freight operations are conducted subject to standard carriage contracts.</p>
      <p style="margin-top:4px;">Thank you for choosing <strong>CargoX Transport Services</strong>.</p>
      <p style="margin-top:2px; font-size:10px; color:#94a3b8;">This is a computer-generated tax invoice and requires no physical signature.</p>
    </div>
  </div>

  <script>
    document.title = "${sanitizedFileName}";
    ${autoPrint ? `
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };` : ''}
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

