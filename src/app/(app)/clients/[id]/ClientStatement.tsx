'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Download, Mail, ReceiptText } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatZAR } from '@/lib/quoting'
import type { Statement } from '@/lib/statement'

interface Props {
  clientId: string
  /** Built with includeSettled, so the "paid-up projects" tickbox can filter locally. */
  statement: Statement
  businessName: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const signedZAR = (n: number) => (n < 0 ? `-${formatZAR(-n)}` : formatZAR(n))

const BUTTON = 'inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#9A7B4F]'

export function ClientStatement({ clientId, statement, businessName }: Props) {
  const [includeSettled, setIncludeSettled] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState(statement.client.email ?? '')
  const [emailBody, setEmailBody] = useState('')
  const [sending, setSending] = useState(false)

  const projects = includeSettled ? statement.projects : statement.projects.filter(p => p.balance > 0)
  const total = projects.reduce((s, p) => s + p.total, 0)
  const paid = projects.reduce((s, p) => s + p.paid, 0)
  const balance = projects.reduce((s, p) => s + p.balance, 0)

  async function download() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/pdf/statement?clientId=${clientId}${includeSettled ? '&includeSettled=1' : ''}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Could not build the statement')
        return
      }
      const filename = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'Statement.pdf'
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  function openEmail() {
    setEmailBody(`Dear ${statement.client.client_name},\n\nPlease find attached your statement. The balance due is ${formatZAR(balance)}.\n\nKind regards,\n${businessName}`)
    setEmailOpen(true)
  }

  async function send() {
    setSending(true)
    try {
      const res = await fetch('/api/email/statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, to: emailTo.trim(), body: emailBody, includeSettled }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Failed to send the statement'); return }
      toast.success(`Statement sent to ${emailTo.trim()}`)
      setEmailOpen(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-t border-[#EDE9E1] pt-6">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h2 className="flex items-center gap-2 text-xs font-medium text-[#8A877F] uppercase tracking-wider">
          <ReceiptText size={13} /> Statement
        </h2>
        <label className="ml-auto flex items-center gap-2 text-xs text-[#8A877F] cursor-pointer">
          <input
            type="checkbox"
            checked={includeSettled}
            onChange={e => setIncludeSettled(e.target.checked)}
            className="w-3.5 h-3.5 accent-[#9A7B4F] cursor-pointer"
          />
          Include paid-up projects
        </label>
      </div>

      <div className="bg-white border border-[#D8D3C8] rounded overflow-x-auto">
        {projects.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[#8A877F]">Nothing outstanding for this client.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[#8A877F] border-b border-[#D8D3C8]">
                <th className="text-left font-medium px-4 py-2">Project</th>
                <th className="text-left font-medium px-4 py-2">Invoiced</th>
                <th className="text-right font-medium px-4 py-2">Total</th>
                <th className="text-right font-medium px-4 py-2">Paid</th>
                <th className="text-right font-medium px-4 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-b border-[#F2EFE9] last:border-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/${p.id}`} className="text-[#2C2C2A] hover:text-[#7E6036] focus-visible:text-[#7E6036] hover:underline">
                      <span className="font-medium">{p.project_number}</span> · {p.project_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[#8A877F] whitespace-nowrap">{p.invoiced_date ? formatDate(p.invoiced_date) : 'Not yet'}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatZAR(p.total)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-green-700">{formatZAR(p.paid)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">{signedZAR(p.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#D8D3C8] bg-[#FAF8F4] font-semibold">
                <td className="px-4 py-2.5" colSpan={2}>Balance due</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatZAR(total)}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap text-green-700">{formatZAR(paid)}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">{signedZAR(balance)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={download} disabled={downloading} className={`${BUTTON} bg-white border border-[#D8D3C8] text-[#2C2C2A] hover:bg-[#F5F2EC] active:bg-[#EDE9E1]`}>
          <Download size={14} /> {downloading ? 'Building…' : 'Download PDF'}
        </button>
        <button onClick={openEmail} className={`${BUTTON} bg-[#1A1A18] text-white hover:bg-[#2C2C2A] active:bg-black`}>
          <Mail size={14} /> Email statement
        </button>
      </div>

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setEmailOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[480px] p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-[#1A1A18] mb-4">Email statement</h2>
            <label htmlFor="statement-email-to" className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1.5">To</label>
            <input
              id="statement-email-to"
              type="email"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              autoFocus
              className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors"
            />
            {!statement.client.email && (
              <p className="text-xs text-[#9A7B4F] mt-1.5">This email will be saved to the client record.</p>
            )}
            <label htmlFor="statement-email-body" className="block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mt-4 mb-1.5">Message</label>
            <textarea
              id="statement-email-body"
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              rows={8}
              className="w-full px-3.5 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors resize-none leading-relaxed"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEmailOpen(false)} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] focus-visible:text-[#2C2C2A] cursor-pointer">
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || !emailTo.trim()}
                className="px-5 py-2 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#2C2C2A] active:bg-black focus-visible:ring-2 focus-visible:ring-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer font-medium"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
