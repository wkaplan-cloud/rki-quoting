export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrg, getCurrentOrgId, getCurrentUser } from '@/lib/auth-context'
import { PageHeader } from '@/components/layout/PageHeader'
import { DashboardPipeline } from './DashboardPipeline'
import { WelcomeModal } from '@/components/onboarding/WelcomeModal'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import { GuidedTour } from '@/components/onboarding/GuidedTour'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Already resolved by the surrounding layout — these are free.
  const [user, orgId] = await Promise.all([getCurrentUser(), getCurrentOrgId()])

  if (!orgId) {
    // Check if this is a supplier account and send them to the right place
    const { data: portalAccount } = await supabase
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user?.id ?? '')
      .maybeSingle()
    if (portalAccount) redirect('/supplier-portal/home')
    else redirect('/supplier-portal/register?notice=no-portal-account')
  }
  const currentUserId = user?.id ?? ''
  const [{ data: projects }, { data: settings }, org, { count: clientCount }, { count: supplierCount }] = await Promise.all([
    supabase.from('projects').select('id, project_name, project_number, status, date, quoted_date, assigned_to, user_id, sage_invoice_id, client:clients(client_name), stages:project_stages(*)').is('archived_at', null).order('created_at', { ascending: false }),
    supabase.from('settings').select('sage_company_id, quote_validity_days').maybeSingle(),
    getCurrentOrg(orgId),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('suppliers').select('*', { count: 'exact', head: true }),
  ])
  const plan = org?.plan ?? 'trial'
  const isSolo = plan === 'solo'
  const sageConnected = !isSolo && !!(settings?.sage_company_id)

  const ps = projects ?? []
  const stagesMap = Object.fromEntries(
    ps.map(p => {
      const s = Array.isArray(p.stages) ? p.stages[0] : p.stages
      return [p.id, s ?? null]
    })
  )

  const today = new Date()
  const validityDays: number = (settings as any)?.quote_validity_days ?? 30

  // Single pass over projects — derive all metrics without re-scanning the array.
  type Metrics = {
    activeProjects: typeof ps
    drafts: number
    openQuotes: number
    activeInvoices: number
    paidProjects: number
    awaitingDeposit: number
    staleQuotes: number
    inProduction: number
    readyToInvoice: number
    invoicesOutstanding: number
  }

  const metrics = ps.reduce<Metrics>((acc, p) => {
    const s = stagesMap[p.id]
    const isCancelled = p.status === 'Cancelled'
    const isCompleted = p.status === 'Completed'

    if (!isCancelled && !isCompleted) {
      acc.activeProjects.push(p)
      if (p.status === 'Draft')   acc.drafts++
      if (['Quote', 'Approved', 'Deposit'].includes(p.status)) acc.openQuotes++
      if (p.status === 'Invoice') acc.activeInvoices++
      if (p.status === 'Paid')    acc.paidProjects++
      if (s?.quote_sent && !s?.deposit_received && p.status !== 'Paid') {
        acc.awaitingDeposit++
        // Stale: quote has passed its validity window with no deposit
        if (p.quoted_date) {
          const expiry = new Date(p.quoted_date)
          expiry.setDate(expiry.getDate() + validityDays)
          if (expiry < today) acc.staleQuotes++
        }
      }
      if (s?.deposit_received && !s?.delivered_installed)                          acc.inProduction++
      if (s?.deposit_received && s?.fabrics_received && !s?.final_invoice_sent)    acc.readyToInvoice++
    }
    if (!isCancelled && s?.final_invoice_sent && !s?.final_invoice_paid) acc.invoicesOutstanding++
    return acc
  }, {
    activeProjects: [],
    drafts: 0, openQuotes: 0, activeInvoices: 0, paidProjects: 0,
    awaitingDeposit: 0, staleQuotes: 0, inProduction: 0, readyToInvoice: 0, invoicesOutstanding: 0,
  })

  const {
    activeProjects,
    drafts, openQuotes, activeInvoices, paidProjects,
    awaitingDeposit, staleQuotes, inProduction, readyToInvoice, invoicesOutstanding,
  } = metrics

  const hasClients = (clientCount ?? 0) > 0
  const hasSuppliers = (supplierCount ?? 0) > 0
  const hasProjects = ps.length > 0
  const hasSentQuote = ps.some(p => stagesMap[p.id]?.quote_sent || ['Quote', 'Approved', 'Deposit', 'Invoice', 'Paid', 'Completed'].includes(p.status))

  const allSummaryCards = [
    { label: 'Active Projects',        value: activeProjects.length.toString(), sub: `${drafts} drafts · ${openQuotes} quotes · ${activeInvoices} invoiced${paidProjects > 0 ? ` · ${paidProjects} paid` : ''}`, alert: false, href: '/projects?filter=active' },
    { label: 'Awaiting Deposit',       value: awaitingDeposit.toString(),       sub: 'Quote sent — deposit not yet received',              alert: awaitingDeposit > 0, href: '/projects?filter=awaiting-deposit' },
    { label: 'Stale Quotes',           value: staleQuotes.toString(),           sub: `Past ${validityDays}-day validity — no deposit yet`, alert: staleQuotes > 0, href: `/projects?filter=stale-quotes&days=${validityDays}` },
    { label: 'In Production',          value: inProduction.toString(),          sub: 'Deposit received, not yet delivered',                alert: false, href: '/projects?filter=in-production' },
    { label: 'Ready to Invoice',       value: readyToInvoice.toString(),        sub: 'Fabrics in — balance invoice not yet sent',          alert: readyToInvoice > 0, href: undefined as string | undefined },
    { label: 'Balance Due',            value: invoicesOutstanding.toString(),   sub: 'Final invoice sent — balance not yet paid',          alert: invoicesOutstanding > 0, href: undefined as string | undefined },
  ]
  // Solo: show the 3 most actionable tiles
  const summaryCards = isSolo
    ? [allSummaryCards[0], allSummaryCards[1], allSummaryCards[5]]
    : allSummaryCards

  return (
    <div className="flex flex-col h-full">
      <WelcomeModal />
      <GuidedTour />
      <PageHeader
        title="Dashboard"
        actions={
          <Link data-tour="new-project" href="/projects/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-medium rounded hover:bg-[#9A7B4F] transition-colors">
            <Plus size={15} /> New Project
          </Link>
        }
      />

      <div className="p-4 md:p-8 space-y-8">
        <OnboardingChecklist
          hasClients={hasClients}
          hasSuppliers={hasSuppliers}
          hasProjects={hasProjects}
          hasSentQuote={hasSentQuote}
        />
        {/* Summary cards */}
        <div>
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3">Overview</h2>
          <div data-tour="dashboard-cards" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            {summaryCards.map(({ label, value, sub, alert, href }) => {
              const cardClassName = `bg-white border rounded p-3 md:p-4 ${alert ? 'border-[#9A7B4F]/50 bg-[#9A7B4F]/5' : 'border-[#D8D3C8]'} ${href ? 'block transition-colors hover:border-[#9A7B4F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F]' : ''}`
              const cardContent = (
                <>
                  <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wider leading-tight">{label}</p>
                  <p className={`font-serif text-xl md:text-2xl mt-2 ${alert ? 'text-[#9A7B4F]' : 'text-[#1A1A18]'}`}>{value}</p>
                  {sub && <p className="text-xs text-[#8A877F] mt-1 hidden sm:block">{sub}</p>}
                </>
              )
              return href ? (
                <Link key={label} href={href} className={cardClassName}>{cardContent}</Link>
              ) : (
                <div key={label} className={cardClassName}>{cardContent}</div>
              )
            })}
          </div>
        </div>

        {/* Solo upsell nudge */}
        {isSolo && (
          <p className="text-xs text-[#8A877F]">
            Want the full picture?{' '}
            <a href="/subscribe" className="text-[#9A7B4F] hover:underline">Upgrade to Studio</a>
            {' '}for Kanban pipeline, advanced metrics, and team collaboration.
          </p>
        )}

        {/* Pipeline list — Studio+ only */}
        {!isSolo && (
          <DashboardPipeline
            projects={ps.filter(p => p.status !== 'Cancelled') as any}
            stagesMap={stagesMap}
            sageConnected={sageConnected}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  )
}
