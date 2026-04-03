const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const DEFAULT_API_BASE = import.meta.env.VITE_HECSN_API_BASE
  || (window.location.port === '8000' ? window.location.origin : 'http://127.0.0.1:8000')

export function normalizeApiBase(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_API_BASE
}

export function formatFloat(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'n/a'
  }

  return Number(value).toFixed(digits)
}

export function formatPercent(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'n/a'
  }

  return `${(Number(value) * 100).toFixed(digits)}%`
}

export function formatWhen(value) {
  if (!value) {
    return 'n/a'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'n/a'
  }

  return date.toLocaleString()
}

export function fileName(value) {
  if (!value) {
    return 'n/a'
  }

  return String(value).split(/[/\\]/).pop() || String(value)
}

export function formatMode(value) {
  if (!value) {
    return 'n/a'
  }

  return String(value).replace(/_/g, ' ')
}

export function responseModeVariant(value) {
  if (value === 'insufficient_evidence') {
    return 'destructive'
  }

  if (value === 'quote') {
    return 'secondary'
  }

  if (value === 'stitch') {
    return 'default'
  }

  if (value === 'native_decode') {
    return 'default'
  }

  return 'outline'
}

export function formatCompactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'n/a'
  }

  return COMPACT_NUMBER_FORMATTER.format(Number(value))
}

export function toNumber(value, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

export function nicePositiveDomain(values, minimumMax = 1) {
  const numericValues = values.map((value) => toNumber(value, 0))
  const maxValue = Math.max(minimumMax, ...numericValues)
  return [0, roundUpNice(maxValue)]
}

export function fixedUnitDomain() {
  return [0, 1]
}

export function bufferedDomain(values, fallback = [-1, 1], paddingRatio = 0.08) {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

  if (!numericValues.length) {
    return fallback
  }

  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  if (minValue === maxValue) {
    const delta = Math.max(Math.abs(minValue) * paddingRatio, 0.1)
    return [minValue - delta, maxValue + delta]
  }

  const padding = (maxValue - minValue) * paddingRatio
  return [minValue - padding, maxValue + padding]
}

function roundUpNice(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1
  }

  const exponent = Math.floor(Math.log10(value))
  const scale = 10 ** exponent
  const normalized = value / scale

  if (normalized <= 1) {
    return scale
  }
  if (normalized <= 2) {
    return 2 * scale
  }
  if (normalized <= 5) {
    return 5 * scale
  }

  return 10 * scale
}