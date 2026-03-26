interface Props {
  title: string
  count?: number
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, count, subtitle, actions }: Props) {
  return (
    <div className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-[#D8D3C8] bg-[#F5F2EC]">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-xl md:text-2xl text-[#1A1A18] font-medium">{title}</h1>
          {count !== undefined && (
            <span className="text-sm font-sans font-normal text-[#8A877F] bg-[#EDE9E1] px-2 py-0.5 rounded-full">{count}</span>
          )}
        </div>
        {subtitle && <p className="text-sm text-[#8A877F] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
