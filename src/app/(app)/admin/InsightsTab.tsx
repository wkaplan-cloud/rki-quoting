'use client'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatZAR } from '@/lib/quoting'
import { MIN_PAID_PROJECTS, type Insights } from '@/lib/insights'

const LINK = 'text-[#9A7B4F] hover:underline focus-visible:underline outline-none'
const fmtPct = (n: number) => `${Math.round(n)}%`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[#D8D3C8] rounded-xl px-6 py-5">
      <h3 className="text-sm font-semibold text-[#2C2C2A]">{title}</h3>
      {subtitle && <p className="text-xs text-[#8A877F] mt-0.5">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function SupplierTable({ rows, empty }: { rows: Insights['suppliers']; empty: string }) {
  if (rows.length === 0) return <p className="text-xs text-[#8A877F]">{empty}</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-[#8A877F] text-left">
          <th className="font-medium pb-2">Supplier</th>
          <th className="font-medium pb-2 text-right">Lines</th>
          <th className="font-medium pb-2 text-right">Sales</th>
          <th className="font-medium pb-2 text-right">Profit</th>
          <th className="font-medium pb-2 text-right">Margin</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(s => (
          <tr key={s.name} className="border-t border-[#F0EDE6]">
            <td className="py-1.5 text-[#2C2C2A]">{s.name}</td>
            <td className="py-1.5 text-right tabular-nums text-[#8A877F]">{s.lines}</td>
            <td className="py-1.5 text-right tabular-nums text-[#8A877F]">{formatZAR(s.sales)}</td>
            <td className="py-1.5 text-right tabular-nums text-[#2C2C2A]">{formatZAR(s.profit)}</td>
            <td className="py-1.5 text-right tabular-nums text-[#2C2C2A]">{fmtPct(s.margin)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ProjectLinks({ projects, max = 8 }: { projects: { id: string; name: string }[]; max?: number }) {
  return (
    <>
      {projects.slice(0, max).map((p, i) => (
        <span key={p.id}>
          {i > 0 && ', '}
          <Link href={`/projects/${p.id}`} className={LINK}>{p.name.trim()}</Link>
        </span>
      ))}
      {projects.length > max && <span> and {projects.length - max} more</span>}
    </>
  )
}

function Cleanup({ c }: { c: Insights['cleanup'] }) {
  const count = c.completedUnpaid.length + c.zeroCost.length + c.belowCost.length + c.duplicateClients.length
  if (count === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 flex items-center gap-3">
        <CheckCircle2 size={18} className="text-green-700 flex-shrink-0" />
        <p className="text-sm text-green-800">Data check: nothing to fix. The figures below can be trusted.</p>
      </div>
    )
  }

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">Check these before trusting the numbers</h3>
      </div>
      <p className="text-xs text-amber-800 mt-1">
        Nothing here is changed automatically. Open each item and fix it on the project or client if needed — the report updates by itself.
      </p>

      <div className="mt-4 space-y-5">
        {c.completedUnpaid.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[#2C2C2A]">Completed but not Paid in Full ({c.completedUnpaid.length})</p>
            <p className="text-xs text-[#8A877F] mb-2">Either the client still owes you, or Paid in Full wasn&apos;t ticked. Affects: paid profit and the pipeline on the Profit tab.</p>
            <ul className="space-y-1">
              {c.completedUnpaid.map(r => (
                <li key={r.project.id} className="text-sm flex flex-wrap gap-x-2">
                  <Link href={`/projects/${r.project.id}`} className={LINK}>{r.project.name.trim()}</Link>
                  <span className="text-[#8A877F]">
                    {r.client ? `${r.client} · ` : ''}{formatZAR(r.totalInclVat)} incl. VAT ·{' '}
                    {r.invoiceSent
                      ? `final invoice sent${r.invoiceSentAt ? ` ${new Date(r.invoiceSentAt).toLocaleDateString('en-ZA')}` : ''}`
                      : 'final invoice not marked as sent'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.duplicateClients.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[#2C2C2A]">Possibly the same client ({c.duplicateClients.length})</p>
            <p className="text-xs text-[#8A877F] mb-2">Similar names on separate client records. If they are one client, their share of profit is bigger than shown. Affects: top clients.</p>
            <ul className="space-y-1">
              {c.duplicateClients.map(group => (
                <li key={group.map(g => g.id).join('-')} className="text-sm">
                  {group.map((g, i) => (
                    <span key={g.id}>
                      {i > 0 && <span className="text-[#8A877F]"> · </span>}
                      <Link href={`/clients/${g.id}`} className={LINK}>{g.name}</Link>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.zeroCost.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[#2C2C2A]">Lines with no cost price ({c.zeroCost.reduce((s, z) => s + z.lines, 0)})</p>
            <p className="text-xs text-[#8A877F] mb-2">A R0 cost counts the whole sale as profit. Fine if it really cost nothing, otherwise enter the cost. Affects: profit, margins, suppliers and items.</p>
            <ul className="space-y-1">
              {c.zeroCost.map(z => (
                <li key={z.project.id} className="text-sm">
                  <Link href={`/projects/${z.project.id}`} className={LINK}>{z.project.name.trim()}</Link>
                  <span className="text-[#8A877F]"> · {plural(z.lines, 'line')} · {formatZAR(z.sales)} sales</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.belowCost.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[#2C2C2A]">Sold below cost ({c.belowCost.length})</p>
            <p className="text-xs text-[#8A877F] mb-2">The sale price is lower than the cost. Affects: profit and margins.</p>
            <ul className="space-y-1">
              {c.belowCost.map((b, i) => (
                <li key={`${b.project.id}-${i}`} className="text-sm">
                  <Link href={`/projects/${b.project.id}`} className={LINK}>{b.project.name.trim()}</Link>
                  <span className="text-[#8A877F]"> · {b.item} · loss of {formatZAR(b.loss)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export function InsightsTab({ insights }: { insights: Insights }) {
  const { totals, thinMargin } = insights

  return (
    <div className="space-y-6">
      <p className="text-xs text-[#8A877F]">
        Based on {plural(insights.acceptedProjectCount, 'accepted project')} ({insights.paidProjectCount} Paid in Full, the rest Approved, Deposit, Invoice or Completed).
        All amounts excl. VAT. Drafts, quotes, cancelled and archived projects are not included.
      </p>

      <Cleanup c={insights.cleanup} />

      {insights.paidProjectCount < MIN_PAID_PROJECTS ? (
        <p className="text-sm text-[#8A877F] py-10 text-center">
          The report appears once you have {MIN_PAID_PROJECTS} projects Paid in Full — you have {insights.paidProjectCount}. With fewer, the percentages aren&apos;t meaningful.
        </p>
      ) : (
        <>
          <Section title="Where your profit comes from">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-[#8A877F]">Profit on items</p>
                <p className="text-xl font-semibold text-[#2C2C2A] tabular-nums">{formatZAR(totals.itemProfit)}</p>
                <p className="text-xs text-[#8A877F]">{fmtPct(totals.itemMargin)} of {formatZAR(totals.sales)} sales</p>
              </div>
              <div>
                <p className="text-xs text-[#8A877F]">Design fees</p>
                <p className="text-xl font-semibold text-[#2C2C2A] tabular-nums">{formatZAR(totals.designFees)}</p>
                <p className="text-xs text-[#8A877F]">{fmtPct(totals.feeShare)} of your total profit</p>
              </div>
              <div>
                <p className="text-xs text-[#8A877F]">Total profit</p>
                <p className="text-xl font-semibold text-[#2C2C2A] tabular-nums">{formatZAR(totals.profit)}</p>
                <p className="text-xs text-[#8A877F]">items + design fees</p>
              </div>
            </div>
            {insights.noFeeProjects.length > 0 && (
              <p className="text-sm text-[#2C2C2A] mt-4 pt-4 border-t border-[#F0EDE6]">
                <span className="font-medium">{plural(insights.noFeeProjects.length, 'project')} charged no design fee:</span>{' '}
                <ProjectLinks projects={insights.noFeeProjects} />
              </p>
            )}
          </Section>

          <Section
            title="Top clients"
            subtitle={`Your top 3 clients bring in ${fmtPct(insights.top3ClientShare)} of total profit (items + design fees).`}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#8A877F] text-left">
                  <th className="font-medium pb-2">Client</th>
                  <th className="font-medium pb-2 text-right">Projects</th>
                  <th className="font-medium pb-2 text-right">Sales</th>
                  <th className="font-medium pb-2 text-right">Profit</th>
                  <th className="font-medium pb-2 text-right">Share of profit</th>
                </tr>
              </thead>
              <tbody>
                {insights.clients.map(c => (
                  <tr key={c.id ?? 'none'} className="border-t border-[#F0EDE6]">
                    <td className="py-1.5">
                      {c.id ? <Link href={`/clients/${c.id}`} className={LINK}>{c.name}</Link> : <span className="text-[#8A877F]">{c.name}</span>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[#8A877F]">{c.projects}</td>
                    <td className="py-1.5 text-right tabular-nums text-[#8A877F]">{formatZAR(c.sales)}</td>
                    <td className="py-1.5 text-right tabular-nums text-[#2C2C2A]">{formatZAR(c.profit)}</td>
                    <td className="py-1.5 text-right tabular-nums text-[#2C2C2A]">{fmtPct(c.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section
            title="Thin margins"
            subtitle={`${fmtPct(thinMargin.shareOfSales)} of your sales earned less than 10% profit on the item.`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-[#8A877F]">Sold at cost (no markup)</p>
                <p className="text-[#2C2C2A]"><span className="font-semibold tabular-nums">{formatZAR(thinMargin.atCostSales)}</span> across {plural(thinMargin.atCostLines, 'line')}</p>
              </div>
              <div>
                <p className="text-xs text-[#8A877F]">Profit under 10% of the sale price</p>
                <p className="text-[#2C2C2A]"><span className="font-semibold tabular-nums">{formatZAR(thinMargin.under10Sales)}</span> across {plural(thinMargin.under10Lines, 'line')}</p>
              </div>
            </div>
            <p className="text-xs text-[#8A877F] mt-3">Some of this may be deliberate, with the design fee covering it. Lines with no cost price are left out here.</p>
          </Section>

          <Section title="Suppliers that make you the most profit">
            <SupplierTable rows={insights.suppliers} empty="No supplier names on your lines yet." />
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Best margins" subtitle="Suppliers with at least R 20 000 in sales, highest margin first.">
              <SupplierTable rows={insights.bestMarginSuppliers} empty="No supplier has R 20 000 in sales yet." />
            </Section>
            <Section title="Busy but low margin" subtitle="10 or more lines and under 15% margin — a lot of work for little return.">
              <SupplierTable rows={insights.busyLowMarginSuppliers} empty="None — no busy supplier is under 15%." />
            </Section>
          </div>

          <Section title="Most profitable single items">
            <ul className="space-y-1.5">
              {insights.topItems.map((t, i) => (
                <li key={`${t.project.id}-${i}`} className="text-sm flex flex-wrap justify-between gap-x-4">
                  <span className="text-[#2C2C2A] min-w-0 truncate max-w-full sm:max-w-[60%]" title={t.item}>
                    {t.item}
                    <span className="text-[#8A877F]"> · {t.supplier ? `${t.supplier} · ` : ''}</span>
                    <Link href={`/projects/${t.project.id}`} className={LINK}>{t.project.name.trim()}</Link>
                  </span>
                  <span className="tabular-nums text-[#2C2C2A]">{formatZAR(t.profit)} <span className="text-[#8A877F]">({fmtPct(t.margin)})</span></span>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  )
}
