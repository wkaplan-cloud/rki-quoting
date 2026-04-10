export default function ItemsLoading() {
  return (
    <div className="p-6 md:p-8 animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-20 bg-[#D8D3C8] rounded mb-1" />
        <div className="h-4 w-44 bg-[#EDE9E1] rounded" />
      </div>
      <div className="bg-white border border-[#D8D3C8] rounded-xl overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-[#EDE9E1] last:border-0">
            <div className="h-4 w-40 bg-[#EDE9E1] rounded" />
            <div className="ml-auto h-7 w-7 bg-[#EDE9E1] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
