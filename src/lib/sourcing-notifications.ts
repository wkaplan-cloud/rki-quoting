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
