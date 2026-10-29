const wholeOrTwoDecimals = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const threeSignificant = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })

/** Readable number: thousands separators, at most 2 decimals, but never rounds a small value to 0. */
export function formatNumber(n: number): string {
  return Math.abs(n) < 1 && n !== 0 ? threeSignificant.format(n) : wholeOrTwoDecimals.format(n)
}

export function formatPercent(ratio: number): string {
  if (ratio === 0) return '0%'
  if (ratio < 0.001) return '<0.1%'
  return `${Number((ratio * 100).toFixed(1))}%`
}

export function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`
}
