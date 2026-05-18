export function formatAED(value: number) {
  if (!value) return "Not priced"
  if (value >= 1_000_000) {
    return `AED ${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  }
  return `AED ${Math.round(value / 1000)}K`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-AE").format(value)
}

export function cnCommand(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ")
}
