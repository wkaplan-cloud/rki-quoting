export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#E5DFD5] rounded ${className}`} />
}

export function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}
