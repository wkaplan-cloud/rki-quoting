'use client'
import { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const variants = {
  primary:   'bg-[#2C2C2A] text-[#F5F2EC] hover:bg-[#9A7B4F] border border-transparent',
  secondary: 'bg-[#F5F2EC] text-[#2C2C2A] hover:bg-[#EDE9E1] border border-[#D8D3C8]',
  ghost:     'bg-transparent text-[#2C2C2A] hover:bg-[#EDE9E1] border border-transparent',
  danger:    'bg-red-600 text-white hover:bg-red-700 border border-transparent',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: Props) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 font-medium rounded transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
