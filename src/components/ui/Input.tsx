'use client'
import { InputHTMLAttributes, forwardRef } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">{label}</label>}
      <input
        ref={ref}
        className={`w-full px-3 py-2 bg-white border rounded text-sm text-[#2C2C2A] placeholder-[#8A877F]
          border-[#D8D3C8] focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors
          ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
)
Input.displayName = 'Input'
