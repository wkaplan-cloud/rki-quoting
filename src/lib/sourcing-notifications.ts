const SUPPLIER_PORTAL_URL = process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL ?? 'https://suppliers.quotinghub.co.za'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildAcceptanceEmail({
  supplierName,
  studioName,
  itemTitle,
  unitPrice,
  leadTimeWeeks,
  sessionTitle,
  ctaUrl,
  isRegistered,
}: {
  supplierName: string
  studioName: string
  itemTitle: string
  unitPrice: number
  leadTimeWeeks: number | null
  sessionTitle: string
  ctaUrl: string
  isRegistered: boolean
}): string {
  const ctaLabel = isRegistered ? 'View Request in Portal →' : 'View Request →'
  const footer = isRegistered
    ? `<p style="margin:20px 0 0;font-size:12px;color:#C4BFB5;line-height:1.6;border-top:1px solid #EDE9E1;padding-top:16px;">Log in to your <a href="${SUPPLIER_PORTAL_URL}" style="color:#9A7B4F;text-decoration:none;">Supplier Portal</a> to view all your requests.</p>`
    : `<p style="margin:20px 0 0;font-size:12px;color:#C4BFB5;line-height:1.6;border-top:1px solid #EDE9E1;padding-top:16px;">Not registered yet? <a href="${SUPPLIER_PORTAL_URL}/register" style="color:#9A7B4F;text-decoration:none;">Create a free supplier account</a> to manage all your requests in one place.</p>`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#2C2C2A;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:600;color:#F5F2EC;">${esc(studioName)}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Price Accepted</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 6px;font-size:15px;line-height:1.7;color:#2C2C2A;">Dear ${esc(supplierName)},</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#2C2C2A;">
              Great news — <strong>${esc(studioName)}</strong> has accepted your price for the following item from <em>${esc(sessionTitle)}</em>.
            </p>
            <div style="background-color:#ECFDF5;border:1px solid #A7F3D0;border-left:3px solid #10B981;border-radius:4px;padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1A1A18;">${esc(itemTitle)}</p>
              <table cellpadding="0" cellspacing="0">
                <tr><td style="font-size:13px;color:#6B7280;padding:3px 0;width:130px;">Your quoted price</td><td style="font-size:13px;font-weight:700;color:#065F46;padding:3px 0;">R${unitPrice.toLocaleString()}</td></tr>
                ${leadTimeWeeks ? `<tr><td style="font-size:13px;color:#6B7280;padding:3px 0;width:130px;">Lead time</td><td style="font-size:13px;color:#065F46;padding:3px 0;">${leadTimeWeeks} week${leadTimeWeeks !== 1 ? 's' : ''}</td></tr>` : ''}
              </table>
            </div>
            <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#6B6860;">
              If you have any questions or need to confirm details, you can reply to this email or view the original request below.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td align="center">
                  <a href="${ctaUrl}" style="display:inline-block;background-color:#2C2C2A;color:#F5F2EC;font-size:14px;font-weight:600;padding:14px 32px;border-radius:6px;text-decoration:none;">
                    ${ctaLabel}
                  </a>
                </td>
              </tr>
            </table>
            ${footer}
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${esc(studioName)} · Sent via QuotingHub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildNotifEmail(opts: {
  heading: string
  body: string
  ctaLabel: string
  ctaUrl: string
  footerNote?: string
}): string {
  const { heading, body: bodyText, ctaLabel, ctaUrl, footerNote } = opts
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td style="background-color:#2C2C2A;padding:24px 36px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">QuotingHub</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:36px 36px 28px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <h1 style="margin:0 0 14px;font-size:20px;font-weight:600;color:#1A1A18;line-height:1.3;">${heading}</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#2C2C2A;line-height:1.7;">${bodyText}</p>
            <a href="${ctaUrl}" style="display:inline-block;background-color:#2C2C2A;color:#F5F2EC;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">${ctaLabel} &rarr;</a>
            ${footerNote ? `<p style="margin:20px 0 0;font-size:12px;color:#8A877F;line-height:1.6;">${footerNote}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">Sent via QuotingHub &middot; quotinghub.co.za</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
