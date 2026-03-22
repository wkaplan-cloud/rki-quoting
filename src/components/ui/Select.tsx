'use client'
import { SelectHTMLAttributes, forwardRef } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ label, className = '', children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">{label}</label>}
      <select
        ref={ref}
        className={`w-full px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A]
          focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  )
)
Select.displayName = 'Select'
