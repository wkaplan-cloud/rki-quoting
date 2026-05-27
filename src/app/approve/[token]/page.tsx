import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ApprovalForm } from './ApprovalForm'

export const dynamic = 'force-dynamic'

export default async function ApprovePage({ params, searchParams }: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ decision?: string }>
}) {
  const { token } = await params
  const { decision: qDecision } = await searchParams

  const { data: approval } = await supabaseAdmin
    .from('quote_approvals')
    .select('id, project_id, submitted_at, decision')
    .eq('token', token)
    .maybeSingle()

  if (!approval) notFound()

  const [{ data: project }, settingsResult] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('project_name, project_number, user_id, client:clients(client_name)')
      .eq('id', approval.project_id)
      .single(),
    supabaseAdmin
      .from('projects')
      .select('user_id')
      .eq('id', approval.project_id)
      .single(),
  ])

  if (!project) notFound()

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('business_name, logo_url')
    .eq('user_id', settingsResult.data?.user_id ?? '')
    .maybeSingle()

  const client = Array.isArray(project.client) ? project.client[0] : project.client
  const clientName = (client as { client_name?: string } | null)?.client_name ?? null
  const businessName = settings?.business_name ?? 'Your Studio'
  const logoUrl = settings?.logo_url ?? null

  const initialDecision = (qDecision === 'approve' ? 'approved' : qDecision === 'decline' ? 'declined' : null) as 'approved' | 'declined' | null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F2EC' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#4A4A47' }}>
        <div className="max-w-lg mx-auto px-6 py-5 flex items-center gap-4">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={businessName} className="h-9 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          )}
          <div>
            <p className="font-semibold text-base leading-tight" style={{ color: '#F5F2EC' }}>{businessName}</p>
            <p className="text-xs mt-0.5" style={{ color: '#C4A46B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Quotation</p>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="px-6 py-5 border-b" style={{ borderColor: '#EDE9E1', backgroundColor: '#FAFAF8' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8A877F', letterSpacing: '0.08em' }}>Quote Reference</p>
            <p className="text-xl font-bold" style={{ color: '#2C2C2A' }}>{project.project_number}</p>
            <p className="text-sm mt-0.5" style={{ color: '#8A877F' }}>{project.project_name}</p>
          </div>
          <div className="px-6 py-6">
            <ApprovalForm
              token={token}
              projectName={project.project_name}
              projectNumber={project.project_number}
              clientName={clientName}
              initialDecision={initialDecision}
              alreadySubmitted={!!approval.submitted_at}
              submittedDecision={(approval.decision as 'approved' | 'declined' | null) ?? null}
            />
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#C4BFB5' }}>
          Powered by <span style={{ color: '#8A877F' }}>QuotingHub</span>
        </p>
      </div>
    </div>
  )
}
