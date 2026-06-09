// South African money formatting: R 2 000.00
export function fmtR(n: number, decimals = 2): string {
  const [int, dec] = Math.abs(n).toFixed(decimals).split('.')
  const spaced = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const sign = n < 0 ? '-' : ''
  return decimals > 0
    ? `${sign}R ${spaced}.${dec}`
    : `${sign}R ${spaced}`
}
