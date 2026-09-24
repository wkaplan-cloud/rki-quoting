'use client'
import { createContext, useContext } from 'react'
import { themeVars, type TradeType } from '@/lib/portal-theme'

const StaffTradeContext = createContext<TradeType>('electrician')

/** The staff member's company trade, for every screen of the staff app. */
export function useStaffTrade(): TradeType {
  return useContext(StaffTradeContext)
}

export function StaffTradeProvider({ tradeType, children }: { tradeType: TradeType; children: React.ReactNode }) {
  return (
    <StaffTradeContext.Provider value={tradeType}>
      <div style={themeVars(tradeType)}>{children}</div>
    </StaffTradeContext.Provider>
  )
}
