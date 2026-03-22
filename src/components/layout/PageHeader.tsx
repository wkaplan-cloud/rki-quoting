interface Props {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex items-center justify-between px-8 py-6 border-b border-[#D8D3C8] bg-[#F5F2EC]">
      <div>
        <h1 className="font-serif text-2xl text-[#1A1A18] font-medium">{title}</h1>
        {subtitle && <p className="text-sm text-[#8A877F] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
