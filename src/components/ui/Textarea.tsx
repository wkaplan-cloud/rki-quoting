'use client'
import { TextareaHTMLAttributes, forwardRef } from 'react'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ label, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">{label}</label>}
      <textarea
        ref={ref}
        className={`w-full px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] placeholder-[#8A877F]
          focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors resize-none ${className}`}
        {...props}
      />
    </div>
  )
)
Textarea.displayName = 'Textarea'
