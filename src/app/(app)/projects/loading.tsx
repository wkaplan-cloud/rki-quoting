export default function ProjectsLoading() {
  return (
    <div className="p-6 md:p-8 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-28 bg-[#D8D3C8] rounded mb-1" />
          <div className="h-4 w-48 bg-[#EDE9E1] rounded" />
        </div>
        <div className="h-9 w-32 bg-[#D8D3C8] rounded-lg" />
      </div>
      <div className="bg-white border border-[#D8D3C8] rounded-xl overflow-hidden">
        <div className="flex gap-3 px-5 py-3 border-b border-[#EDE9E1]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 w-20 bg-[#EDE9E1] rounded" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#EDE9E1] last:border-0">
            <div className="h-4 w-44 bg-[#EDE9E1] rounded" />
            <div className="h-4 w-20 bg-[#EDE9E1] rounded" />
            <div className="h-4 w-28 bg-[#EDE9E1] rounded" />
            <div className="ml-auto h-5 w-16 bg-[#EDE9E1] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
