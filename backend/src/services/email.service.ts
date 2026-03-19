import nodemailer from 'nodemailer';
import config from '../config';

// ─── SMTP Transporter (singleton) ─────────────────────────────
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

/**
 * Build the HTML email body for a ticket confirmation.
 * The QR code is embedded as a base64 inline image (CID attachment).
 */
function buildTicketEmailHtml(
  buyerName: string,
  uuid: string,
  orderCode: number,
  ticketIndex: number,
  totalTickets: number
): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background:#f4f4f7; font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6); padding:32px 24px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px;">🎫 INDI Event</h1>
              <p style="margin:8px 0 0; color:rgba(255,255,255,0.85); font-size:14px;">Xác nhận vé thành công</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px;">
              <p style="margin:0 0 16px; font-size:16px; color:#1a1a2e;">
                Xin chào <strong>${buyerName}</strong>,
              </p>
              <p style="margin:0 0 24px; font-size:14px; color:#4a4a68; line-height:1.6;">
                Cảm ơn bạn đã mua vé! Dưới đây là vé điện tử của bạn
                ${totalTickets > 1 ? `(Vé ${ticketIndex}/${totalTickets})` : ''}.
                Vui lòng xuất trình mã QR này khi check-in tại sự kiện.
              </p>
              <!-- QR Code -->
              <div style="text-align:center; margin:0 0 24px;">
                <img src="cid:qrcode" alt="QR Code" style="width:200px; height:200px; border:2px solid #e5e7eb; border-radius:8px;" />
              </div>
              <!-- Ticket Info -->
              <table width="100%" style="background:#f8f9fc; border-radius:8px; padding:16px; margin:0 0 24px;">
                <tr>
                  <td style="padding:8px 16px; font-size:13px; color:#6b7280;">Mã vé (UUID)</td>
                  <td style="padding:8px 16px; font-size:13px; color:#1a1a2e; font-family:monospace; word-break:break-all;">${uuid}</td>
                </tr>
                <tr>
                  <td style="padding:8px 16px; font-size:13px; color:#6b7280;">Mã đơn hàng</td>
                  <td style="padding:8px 16px; font-size:13px; color:#1a1a2e;">${orderCode}</td>
                </tr>
              </table>
              <p style="margin:0; font-size:12px; color:#9ca3af; text-align:center;">
                Vui lòng không chia sẻ mã QR này với người khác.<br/>
                Mỗi vé chỉ được sử dụng một lần duy nhất.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fc; padding:16px 24px; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:12px; color:#9ca3af;">© 2026 INDI Event · All rights reserved</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send a ticket confirmation email with the QR code embedded as an inline attachment.
 *
 * @param to        Buyer's email
 * @param buyerName Buyer's display name
 * @param uuid      Ticket UUID (also the QR payload)
 * @param orderCode Numeric order code
 * @param qrBuffer  QR code image as a PNG Buffer (generated in-memory)
 * @param ticketIndex  Ticket position (e.g. 1 of 3)
 * @param totalTickets Total tickets in this order
 */
export async function sendTicketEmail(
  to: string,
  buyerName: string,
  uuid: string,
  orderCode: number,
  qrBuffer: Buffer,
  ticketIndex: number,
  totalTickets: number
): Promise<void> {
  const html = buildTicketEmailHtml(buyerName, uuid, orderCode, ticketIndex, totalTickets);

  await transporter.sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
    to,
    subject: `🎫 Vé INDI Event — ${totalTickets > 1 ? `Vé ${ticketIndex}/${totalTickets}` : 'Xác nhận vé'}`,
    html,
    attachments: [
      {
        filename: 'qrcode.png',
        content: qrBuffer,
        cid: 'qrcode', // referenced as src="cid:qrcode" in HTML
      },
    ],
  });
}
