import { Text, View } from '@react-pdf/renderer'
import { formatZAR } from '@/lib/quoting'
import { cleanExclusions, cleanPlan, planAmounts } from '@/lib/payment-plan'
import type { Project } from '@/lib/types'
import type { PdfTheme } from '../themes'

type Style = Record<string, string | number>

/** The quote's payment plan, or null to print the usual single deposit line. */
export function quotePlan(project: Project) {
  return cleanPlan(project.payment_plan)
}

/**
 * Payment plan rows under TOTAL, in place of the single deposit line.
 * `rowStyle` lets each template keep its own spacing.
 */
export function PaymentPlanRows({ project, grandTotal, theme, rowStyle, bold = true }: {
  project: Project
  grandTotal: number
  theme: PdfTheme
  rowStyle?: Style
  bold?: boolean
}) {
  const stages = quotePlan(project)
  if (!stages) return null
  const amounts = planAmounts(stages, grandTotal)
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 1, marginBottom: 3, ...rowStyle }}>PAYMENT PLAN</Text>
      {stages.map((s, i) => (
        <View key={i} wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3, ...rowStyle }}>
          <Text style={{ fontSize: 8, color: theme.accent, flex: 1, paddingRight: 8 }}>{s.label} ({s.pct}%)</Text>
          <Text style={{ fontSize: 8, color: theme.accent, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' }}>{formatZAR(amounts[i])}</Text>
        </View>
      ))}
    </View>
  )
}

/** "Not included in this quote" — priced extras printed under the totals, never added to them. */
export function NotIncludedBlock({ project, theme, container, headingStyle }: {
  project: Project
  theme: PdfTheme
  container: Style
  headingStyle: Style
}) {
  const lines = cleanExclusions(project.exclusions)
  if (!lines) return null
  return (
    <View wrap={false} style={container}>
      <Text style={headingStyle}>NOT INCLUDED IN THIS QUOTE</Text>
      {lines.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: i ? 3 : 0 }}>
          <Text style={{ fontSize: 7.5, color: theme.text, flex: 1, paddingRight: 12 }}>{l.item}</Text>
          {l.price ? <Text style={{ fontSize: 7.5, color: theme.text }}>{l.price}</Text> : null}
        </View>
      ))}
      <Text style={{ fontSize: 6.5, color: theme.muted, marginTop: 6 }}>Not part of the total above. Quoted separately if needed.</Text>
    </View>
  )
}
