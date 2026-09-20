/**
 * Generates a professional CargoX invoice as a printable HTML page.
 * Opens in a new window, auto-prints, and the browser "Save as PDF"
 * will name the file {bookingId}.pdf.
 * 
 * @param inv     - Invoice object from backend
 * @param booking - Matching DeliveryRequest/booking object (optional, enriches invoice)
 */
export function generateInvoicePDF(inv: any, booking?: any) {
  const bookingId = booking?.request_number || inv.invoice_number || `INV-${inv.id}`;
  const issueDate = inv.issued_at
    ? new Date(inv.issued_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const fmt = (n: any) =>
    parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Delivery details
  const pickupCo   = booking?.pickup_company_name    || "—";
  const pickupAddr = booking?.pickup_address          || "—";
  const dropCo     = booking?.destination_company_name || "—";
  const dropAddr   = booking?.destination_address      || "—";
  const weight     = booking?.weight_tons !== undefined ? `${booking.weight_tons} Ton` : "—";
  const goodsType  = booking?.goods_type  || "—";

  // Pricing breakdown from invoice/quotation
  const distanceKm   = inv.distance_km        !== undefined ? parseFloat(inv.distance_km)        : null;
  const ratePerKm    = inv.base_rate_per_km   !== undefined ? parseFloat(inv.base_rate_per_km)   : null;
  const baseCost     = inv.internal_base_cost !== undefined ? parseFloat(inv.internal_base_cost) : null;
  const margin       = inv.cargox_margin      !== undefined ? parseFloat(inv.cargox_margin)      : null;
  const subtotal     = parseFloat(inv.subtotal     || 0);
  const tax          = parseFloat(inv.tax          || 0);
  const discount     = parseFloat(inv.discount     || 0);
  const total        = parseFloat(inv.total_amount || 0);
  const amountPaid   = parseFloat(inv.amount_paid  || 0);
  const amountDue    = parseFloat(inv.amount_due   || 0);

  const pricingRows = [
    distanceKm !== null ? `
      <tr>
        <td>Distance</td>
        <td style="text-align:right">${distanceKm.toFixed(1)} km</td>
        <td style="text-align:right">—</td>
      </tr>` : "",
    ratePerKm !== null ? `
      <tr>
        <td>Base Rate</td>
        <td style="text-align:right">₹${fmt(ratePerKm)} / km</td>
        <td style="text-align:right">—</td>
      </tr>` : "",
    baseCost !== null ? `
      <tr>
        <td>Transport Cost (${distanceKm ? distanceKm.toFixed(1) + " km × ₹" + fmt(ratePerKm) + "/km" : "base"})</td>
        <td style="text-align:right"></td>
        <td style="text-align:right">₹${fmt(baseCost)}</td>
      </tr>` : "",
    margin !== null ? `
      <tr>
        <td>Service Charge (Logistics Margin)</td>
        <td style="text-align:right"></td>
        <td style="text-align:right">₹${fmt(margin)}</td>
      </tr>` : "",
    `<tr>
      <td>Subtotal</td>
      <td style="text-align:right"></td>
      <td style="text-align:right"><strong>₹${fmt(subtotal || (baseCost ?? 0) + (margin ?? 0))}</strong></td>
    </tr>`,
    tax > 0 ? `
      <tr>
        <td>GST / Tax</td>
        <td style="text-align:right"></td>
        <td style="text-align:right">₹${fmt(tax)}</td>
      </tr>` : "",
    discount > 0 ? `
      <tr>
        <td>Discount</td>
        <td style="text-align:right"></td>
        <td style="text-align:right">– ₹${fmt(discount)}</td>
      </tr>` : "",
  ].filter(Boolean).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${bookingId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; background: #fff; color: #111827; padding: 48px; font-size: 14px; }

    /* Header */
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo { background: #1d4ed8; color: #fff; border-radius: 8px; padding: 8px 14px; font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }
    .brand-subtitle { color: #6b7280; font-size: 12px; margin-top: 2px; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 28px; margin-bottom: 32px; }
    .invoice-meta { text-align: right; }
    .invoice-title { font-size: 28px; font-weight: 800; color: #111827; margin-bottom: 6px; }
    .invoice-badge { display: inline-block; background: ${inv.status === 'PAID' ? '#d1fae5' : '#fef3c7'}; color: ${inv.status === 'PAID' ? '#065f46' : '#92400e'}; padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin-top: 4px; }

    /* Info grid */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .info-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px 20px; }
    .info-block h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; margin-bottom: 10px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .info-label { color: #6b7280; font-size: 13px; }
    .info-value { font-weight: 600; font-size: 13px; text-align: right; max-width: 55%; }

    /* Route card */
    .route-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 18px 20px; margin-bottom: 32px; }
    .route-card h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #1d4ed8; margin-bottom: 12px; }
    .route-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .route-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
    .route-dot.pickup { background: #2563eb; }
    .route-dot.drop   { background: #16a34a; }
    .route-line { width: 1px; background: #93c5fd; height: 20px; margin-left: 4.5px; margin-bottom: -8px; }
    .route-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .route-company { font-weight: 700; font-size: 14px; }
    .route-address { font-size: 13px; color: #374151; }

    /* Pricing table */
    .section-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    table.pricing { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    table.pricing thead tr { background: #111827; color: #fff; }
    table.pricing thead th { padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 600; }
    table.pricing thead th:last-child { text-align: right; }
    table.pricing tbody tr:nth-child(even) { background: #f9fafb; }
    table.pricing tbody td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
    table.pricing tbody td:last-child { text-align: right; }

    /* Totals */
    .totals { width: 340px; margin-left: auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 32px; }
    .totals-row { display: flex; justify-content: space-between; padding: 10px 18px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
    .totals-row.grand { background: #111827; color: #fff; font-weight: 800; font-size: 16px; }
    .totals-row.due   { background: ${amountDue > 0 ? '#fef2f2' : '#f0fdf4'}; color: ${amountDue > 0 ? '#dc2626' : '#16a34a'}; font-weight: 700; }

    /* Footer */
    .footer { text-align: center; color: #9ca3af; font-size: 11px; margin-top: 48px; padding-top: 20px; border-top: 1px solid #e5e7eb; }

    @media print {
      body { padding: 24px; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header-row">
    <div class="brand">
      <div>
        <div class="brand-logo">CargoX</div>
        <div class="brand-subtitle">Premium Transport Services</div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div style="color:#6b7280; font-size:13px;">${inv.invoice_number}</div>
      <div class="invoice-badge">${inv.status}</div>
    </div>
  </div>

  <!-- Invoice Info + Booking Info -->
  <div class="info-grid">
    <div class="info-block">
      <h3>Invoice Details</h3>
      <div class="info-row">
        <span class="info-label">Invoice #</span>
        <span class="info-value">${inv.invoice_number}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Booking ID</span>
        <span class="info-value">${bookingId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Issue Date</span>
        <span class="info-value">${issueDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Payment Status</span>
        <span class="info-value" style="color:${inv.status === 'PAID' ? '#16a34a' : '#dc2626'}">${inv.status}</span>
      </div>
    </div>
    <div class="info-block">
      <h3>Shipment Details</h3>
      <div class="info-row">
        <span class="info-label">Goods Type</span>
        <span class="info-value">${goodsType}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Weight</span>
        <span class="info-value">${weight}</span>
      </div>
      ${distanceKm !== null ? `
      <div class="info-row">
        <span class="info-label">Distance</span>
        <span class="info-value">${distanceKm.toFixed(1)} km</span>
      </div>` : ""}
      ${ratePerKm !== null ? `
      <div class="info-row">
        <span class="info-label">Rate</span>
        <span class="info-value">₹${fmt(ratePerKm)}/km</span>
      </div>` : ""}
    </div>
  </div>

  <!-- Route -->
  <div class="route-card">
    <h3>Delivery Route</h3>
    <div class="route-row">
      <div>
        <div class="route-dot pickup"></div>
        <div class="route-line"></div>
      </div>
      <div>
        <div class="route-label">📦 Pickup</div>
        <div class="route-company">${pickupCo}</div>
        <div class="route-address">${pickupAddr}</div>
      </div>
    </div>
    <div class="route-row">
      <div>
        <div class="route-dot drop"></div>
      </div>
      <div>
        <div class="route-label">📍 Delivery</div>
        <div class="route-company">${dropCo}</div>
        <div class="route-address">${dropAddr}</div>
      </div>
    </div>
  </div>

  <!-- Pricing Breakdown -->
  <div class="section-title">Amount Breakdown</div>
  <table class="pricing">
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right">Details</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${pricingRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-row grand">
      <span>Total Amount</span>
      <span>₹${fmt(total)}</span>
    </div>
    <div class="totals-row">
      <span>Amount Paid</span>
      <span style="color:#16a34a">₹${fmt(amountPaid)}</span>
    </div>
    <div class="totals-row due">
      <span>${amountDue > 0 ? 'Balance Due' : '✓ Fully Paid'}</span>
      <span>₹${fmt(amountDue)}</span>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p><strong>CargoX Premium Transport Services</strong></p>
    <p style="margin-top:4px">This is a computer-generated invoice and does not require a physical signature.</p>
    <p style="margin-top:4px">For queries, contact: support@cargox.in | www.cargox.in</p>
  </div>

  <script>
    window.onload = function() {
      // Set the document title to bookingId so "Save as PDF" uses the right name
      document.title = "${bookingId}";
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
