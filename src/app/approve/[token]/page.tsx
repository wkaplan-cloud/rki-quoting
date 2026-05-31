import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ApprovalForm } from './ApprovalForm'
import { CheckCircle2, XCircle } from 'lucide-react'

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

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('project_name, project_number, user_id, org_id, client:clients(client_name)')
    .eq('id', approval.project_id)
    .single()

  if (!project) notFound()

  const { data: settings } = project.org_id
    ? await supabaseAdmin.from('settings').select('business_name, logo_url').eq('org_id', project.org_id).maybeSingle()
    : { data: null }

  const client = Array.isArray(project.client) ? project.client[0] : project.client
  const clientName = (client as { client_name?: string } | null)?.client_name ?? null
  const businessName = settings?.business_name ?? 'Your Studio'
  const logoUrl = settings?.logo_url ?? null

  const initialDecision = (qDecision === 'approve' ? 'approved' : qDecision === 'decline' ? 'declined' : null) as 'approved' | 'declined' | null

  // Handle already-submitted server-side — no card needed, just a clean message
  if (approval.submitted_at) {
    const isApproved = approval.decision === 'approved'
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F2EC' }}>
        <Header businessName={businessName} logoUrl={logoUrl} />
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="text-center max-w-sm">
            {isApproved
              ? <CheckCircle2 size={48} className="mx-auto mb-5" style={{ color: '#16A34A' }} />
              : <XCircle size={48} className="mx-auto mb-5" style={{ color: '#8A877F' }} />
            }
            <p className="text-lg font-semibold mb-2" style={{ color: '#2C2C2A' }}>Response already submitted</p>
            <p className="text-sm" style={{ color: '#8A877F' }}>
              You {isApproved ? 'approved' : 'declined'} the quote for <strong>{project.project_name}</strong>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F2EC' }}>
      <Header businessName={businessName} logoUrl={logoUrl} />

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)' }}>
            {/* Project ref */}
            <div className="px-6 py-4 border-b" style={{ borderColor: '#EDE9E1', backgroundColor: '#FAFAF8' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#8A877F', letterSpacing: '0.08em' }}>Quote Reference</p>
              <p className="text-lg font-bold" style={{ color: '#2C2C2A' }}>{project.project_number}</p>
              <p className="text-sm" style={{ color: '#8A877F' }}>{project.project_name}</p>
            </div>
            {/* Form */}
            <div className="px-6 py-6">
              <ApprovalForm
                token={token}
                projectName={project.project_name}
                projectNumber={project.project_number}
                clientName={clientName}
                initialDecision={initialDecision}
              />
            </div>
          </div>

          <p className="text-center text-xs mt-5" style={{ color: '#C4BFB5' }}>
            Powered by <span style={{ color: '#8A877F' }}>QuotingHub</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function Header({ businessName, logoUrl }: { businessName: string; logoUrl: string | null }) {
  return (
    <div style={{ backgroundColor: '#4A4A47' }}>
      <div className="max-w-md mx-auto px-6 py-4 flex items-center gap-3">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={businessName} className="h-8 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
        )}
        <div>
          <p className="font-semibold text-sm leading-tight" style={{ color: '#F5F2EC' }}>{businessName}</p>
          <p className="text-xs mt-0.5" style={{ color: '#C4A46B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Quotation</p>
        </div>
      </div>
    </div>
  )
}
