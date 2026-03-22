'use client'
import Link from 'next/link'
import { ShieldCheck, BarChart2, Settings, ArrowLeft } from 'lucide-react'

interface Props {
  currentUserEmail: string
  stats: { totalProjects: number; openQuotes: number; completed: number; lineItems: number }
}

export function AdminPanel({ currentUserEmail, stats }: Props) {
  return (
    <div className="min-h-screen bg-[#1A1A18] text-[#F5F2EC] p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck size={20} className="text-[#C4A46B]" />
          <h1 className="font-serif text-xl text-white">Admin Panel</h1>
          <Link href="/" className="ml-auto flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft size={14} /> Back to app
          </Link>
        </div>

        <p className="text-white/40 text-sm mb-8">Signed in as <span className="text-white/60">{currentUserEmail}</span></p>

        {/* Stats */}
        <div className="mb-8">
          <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart2 size={13} /> System Analytics
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Projects', value: stats.totalProjects },
              { label: 'Open Quotes', value: stats.openQuotes },
              { label: 'Completed', value: stats.completed },
              { label: 'Line Items', value: stats.lineItems },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded p-4">
                <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-serif text-white mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Settings size={13} /> Configuration
          </h2>
          <div className="space-y-2">
            <Link href="/settings" className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors">
              <span className="text-sm text-white/70">Business Settings</span>
              <span className="text-white/30 text-xs">VAT rate, deposit %, email, footer text →</span>
            </Link>
            <Link href="/suppliers" className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors">
              <span className="text-sm text-white/70">Manage Suppliers</span>
              <span className="text-white/30 text-xs">Default markup percentages →</span>
            </Link>
            <Link href="/items" className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors">
              <span className="text-sm text-white/70">Item Library</span>
              <span className="text-white/30 text-xs">Manage dropdown suggestions →</span>
            </Link>
          </div>
        </div>

        {/* Supabase schema reminder */}
        <div className="mt-8 p-4 bg-[#9A7B4F]/10 border border-[#9A7B4F]/30 rounded">
          <p className="text-xs text-[#C4A46B] font-medium mb-1">Database</p>
          <p className="text-xs text-white/50">Run <code className="bg-white/10 px-1 rounded">supabase/schema.sql</code> in your Supabase SQL editor to initialise the database tables and RLS policies.</p>
        </div>
      </div>
    </div>
  )
}
