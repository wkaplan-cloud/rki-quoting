'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'

interface Props {
  account: {
    email: string
    company_name: string
    phone: string
    address: string
    categories: string[]
    description: string
    website: string
  }
  categoryOptions: string[]
}

const INPUT_STYLE = {
  background: '#F4F4F5',
  border: '1px solid #E4E4E7',
  color: '#18181B',
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>{label}</label>
      {hint && <p className="text-xs mb-1.5" style={{ color: '#52525B' }}>{hint}</p>}
      {children}
    </div>
  )
}

export function SupplierProfileClient({ account, categoryOptions }: Props) {
  const router = useRouter()
  const [companyName, setCompanyName] = useState(account.company_name)
  const [phone, setPhone] = useState(account.phone)
  const [address, setAddress] = useState(account.address)
  const [categories, setCategories] = useState<string[]>(account.categories)
  const [description, setDescription] = useState(account.description)
  const [website, setWebsite] = useState(account.website)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function toggleCategory(cat: string) {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/supplier-portal/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName, phone, address, categories, description, website }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3.5 py-2.5 text-sm rounded-lg outline-none transition-colors'

  return (
    <div className="max-w-2xl space-y-7">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#18181B' }}>Profile</h1>
        <p className="text-sm mt-0.5" style={{ color: '#71717A' }}>Your supplier account details</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Read-only email */}
        <div className="p-4 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#71717A' }}>Email</p>
          <p className="text-sm font-medium" style={{ color: '#52525B' }}>{account.email}</p>
          <p className="text-xs mt-1" style={{ color: '#A1A1AA' }}>Email cannot be changed. Contact support if needed.</p>
        </div>

        <div className="p-5 rounded-xl space-y-5" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#71717A' }}>Business Details</p>

          <Field label="Company / Trading Name">
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className={inputCls}
              style={INPUT_STYLE}
              onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+27 11 000 0000"
                className={inputCls}
                style={INPUT_STYLE}
                onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
              />
            </Field>
            <Field label="Website">
              <input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://yoursite.co.za"
                className={inputCls}
                style={INPUT_STYLE}
                onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
              />
            </Field>
          </div>

          <Field label="Address">
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main Rd, Johannesburg"
              className={inputCls}
              style={INPUT_STYLE}
              onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
            />
          </Field>

          <Field label="About" hint="Describe what you supply — designers will see this.">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="e.g. Premium upholstery fabrics and trimmings…"
              className={`${inputCls} resize-none`}
              style={INPUT_STYLE}
              onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
            />
          </Field>
        </div>

        <div className="p-5 rounded-xl space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#71717A' }}>What do you supply?</p>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map(cat => {
              const active = categories.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background: active ? '#1B4F8A' : '#F4F4F5',
                    color: active ? '#FFFFFF' : '#71717A',
                    border: active ? '1px solid #1B4F8A' : '1px solid #E4E4E7',
                  }}
                >
                  {active && <span className="mr-1">✓</span>}
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#1A1020', color: '#F87171', border: '1px solid #3B1F1F' }}>{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: '#1B4F8A', color: '#FFFFFF' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#34D399' }}>
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
