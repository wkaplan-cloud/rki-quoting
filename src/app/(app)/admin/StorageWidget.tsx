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

  return (
    <div className="bg-white border border-[#D8D3C8] rounded-xl p-4 flex flex-col items-center justify-center w-36 h-28 shadow-sm">
      <HardDrive size={18} className="text-[#9A7B4F] mb-2" />
      {bytes === null ? (
        <p className="text-xs text-[#8A877F]">Loading…</p>
      ) : (
        <>
          <p className="text-base font-semibold text-[#2C2C2A] tabular-nums leading-tight">
            {bytes < 1024 * 1024
              ? `${(bytes / 1024).toFixed(1)} KB`
              : `${(bytes / (1024 * 1024)).toFixed(1)} MB`}
          </p>
          <p className="text-[10px] text-[#8A877F] mt-0.5 text-center">{fileCount} image{fileCount !== 1 ? 's' : ''}</p>
          <p className="text-[9px] text-[#C4BFB5] mt-1 text-center leading-tight">Upload storage used</p>
        </>
      )}
    </div>
  )
}
