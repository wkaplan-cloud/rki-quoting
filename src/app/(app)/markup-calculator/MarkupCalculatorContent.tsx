'use client'
import { useState } from 'react'
import { Calculator } from 'lucide-react'

function fmt(n: number) {
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseNum(s: string) {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

export function MarkupCalculatorContent() {
  // Mode A: cost + sell → markup %
  const [costA, setCostA] = useState('')
  const [sellA, setSellA] = useState('')

  // Mode B: cost + markup % → sell price
  const [costB, setCostB] = useState('')
  const [markupB, setMarkupB] = useState('')

  const costAn = parseNum(costA)
  const sellAn = parseNum(sellA)
  const costBn = parseNum(costB)
  const markupBn = parseNum(markupB)

  // Results A
  const profitA = costAn !== null && sellAn !== null ? sellAn - costAn : null
  const markupPctA = costAn !== null && costAn > 0 && sellAn !== null ? ((sellAn - costAn) / costAn) * 100 : null
  const marginPctA = sellAn !== null && sellAn > 0 && costAn !== null ? ((sellAn - costAn) / sellAn) * 100 : null

  // Results B
  const sellBn = costBn !== null && markupBn !== null ? costBn * (1 + markupBn / 100) : null
  const profitB = costBn !== null && sellBn !== null ? sellBn - costBn : null
  const marginPctB = sellBn !== null && sellBn > 0 && costBn !== null ? ((sellBn - costBn) / sellBn) * 100 : null

  const inputCls = 'w-full px-3 py-2.5 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors'

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-lg bg-[#9A7B4F]/10 flex items-center justify-center">
          <Calculator size={18} className="text-[#9A7B4F]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-[#1A1A18]">Markup Calculator</h1>
          <p className="text-sm text-[#8A877F] mt-0.5">Calculate markup and margin from cost and sell prices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Panel A: Cost + Sell → Markup % */}
        <div className="bg-white border border-[#D8D3C8] rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Cost &amp; sell price → markup %</h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#8A877F] mb-1 block">Cost price (R)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costA}
                onChange={e => setCostA(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-[#8A877F] mb-1 block">Sell price (R)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellA}
                onChange={e => setSellA(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>

          {/* Results */}
          <div className="pt-2 border-t border-[#EDE9E1] space-y-2">
            <ResultRow
              label="Profit"
              value={profitA !== null ? `R ${fmt(profitA)}` : '—'}
              highlight={profitA !== null && profitA > 0}
              negative={profitA !== null && profitA < 0}
            />
            <ResultRow
              label="Markup %"
              value={markupPctA !== null ? `${fmt(markupPctA)}%` : '—'}
              highlight={markupPctA !== null && markupPctA > 0}
              negative={markupPctA !== null && markupPctA < 0}
              large
            />
            <ResultRow
              label="Margin %"
              value={marginPctA !== null ? `${fmt(marginPctA)}%` : '—'}
            />
          </div>
        </div>

        {/* Panel B: Cost + Markup % → Sell price */}
        <div className="bg-white border border-[#D8D3C8] rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Cost &amp; markup % → sell price</h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#8A877F] mb-1 block">Cost price (R)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costB}
                onChange={e => setCostB(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-[#8A877F] mb-1 block">Markup %</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={markupB}
                onChange={e => setMarkupB(e.target.value)}
                placeholder="e.g. 40"
                className={inputCls}
              />
            </div>
          </div>

          {/* Results */}
          <div className="pt-2 border-t border-[#EDE9E1] space-y-2">
            <ResultRow
              label="Sell price"
              value={sellBn !== null ? `R ${fmt(sellBn)}` : '—'}
              highlight={sellBn !== null}
              large
            />
            <ResultRow
              label="Profit"
              value={profitB !== null ? `R ${fmt(profitB)}` : '—'}
              highlight={profitB !== null && profitB > 0}
            />
            <ResultRow
              label="Margin %"
              value={marginPctB !== null ? `${fmt(marginPctB)}%` : '—'}
            />
          </div>
        </div>

      </div>

      {/* Reference table */}
      <div className="mt-8 bg-white border border-[#D8D3C8] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#EDE9E1]">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Common markup reference</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#EDE9E1]">
              <th className="text-left px-5 py-2.5 text-xs text-[#8A877F] font-medium">Markup %</th>
              <th className="text-left px-5 py-2.5 text-xs text-[#8A877F] font-medium">Margin %</th>
              <th className="text-left px-5 py-2.5 text-xs text-[#8A877F] font-medium">Example: R100 cost → sell</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EDE9E1]">
            {[20, 30, 40, 50, 60, 75, 100].map(mu => {
              const sell = 100 * (1 + mu / 100)
              const margin = ((sell - 100) / sell) * 100
              return (
                <tr key={mu} className={mu === 40 ? 'bg-[#9A7B4F]/5' : ''}>
                  <td className="px-5 py-2.5 font-medium text-[#2C2C2A]">{mu}%</td>
                  <td className="px-5 py-2.5 text-[#8A877F]">{fmt(margin)}%</td>
                  <td className="px-5 py-2.5 text-[#8A877F]">R {fmt(sell)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResultRow({ label, value, highlight, negative, large }: {
  label: string
  value: string
  highlight?: boolean
  negative?: boolean
  large?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#8A877F]">{label}</span>
      <span className={`font-semibold tabular-nums ${large ? 'text-base' : 'text-sm'} ${negative ? 'text-red-500' : highlight ? 'text-[#9A7B4F]' : 'text-[#8A877F]'}`}>
        {value}
      </span>
    </div>
  )
}
