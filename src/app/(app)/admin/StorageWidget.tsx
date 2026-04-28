'use client'
import { useState, useEffect } from 'react'
import { HardDrive } from 'lucide-react'

export function StorageWidget() {
  const [bytes, setBytes] = useState<number | null>(null)
  const [fileCount, setFileCount] = useState(0)

  useEffect(() => {
    fetch('/api/admin/storage')
      .then(r => r.json())
      .then(d => { setBytes(d.totalBytes ?? 0); setFileCount(d.fileCount ?? 0) })
      .catch(() => {})
  }, [])

  const warn = bytes !== null && bytes >= 100 * 1024 * 1024

  return (
    <div className={`rounded-xl p-4 flex flex-col items-center justify-center w-36 h-28 shadow-sm border ${
      warn ? 'bg-amber-50 border-amber-300' : 'bg-white border-[#D8D3C8]'
    }`}>
      <HardDrive size={18} className={`mb-2 ${warn ? 'text-amber-500' : 'text-[#9A7B4F]'}`} />
      {bytes === null ? (
        <p className="text-xs text-[#8A877F]">Loading…</p>
      ) : (
        <>
          <p className={`text-base font-semibold tabular-nums leading-tight ${warn ? 'text-amber-600' : 'text-[#2C2C2A]'}`}>
            {bytes < 1024 * 1024
              ? `${(bytes / 1024).toFixed(1)} KB`
              : `${(bytes / (1024 * 1024)).toFixed(1)} MB`}
          </p>
          <p className={`text-[10px] mt-0.5 text-center ${warn ? 'text-amber-500' : 'text-[#8A877F]'}`}>
            {fileCount} image{fileCount !== 1 ? 's' : ''}
          </p>
          <p className={`text-[9px] mt-1 text-center leading-tight ${warn ? 'text-amber-400 font-medium' : 'text-[#C4BFB5]'}`}>
            {warn ? 'Storage high — contact us' : 'Upload storage used'}
          </p>
        </>
      )}
    </div>
  )
}
