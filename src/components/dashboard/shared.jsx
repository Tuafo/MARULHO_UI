import { CircleHelpIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function HelpTip({ children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-5 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Explain this field"
        >
          <CircleHelpIcon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[24rem] text-left text-sm leading-5">
        <div className="space-y-2 text-pretty">{children}</div>
      </TooltipContent>
    </Tooltip>
  )
}

function SectionHeading({ title, description, badge }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-medium tracking-tight">{title}</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  )
}

function Sparkline({ data, color = '#3b82f6', width = 80, height = 24 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 0.001)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ')

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function clampChartValue(value, min, max) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function buildSeriesPath(data, key, { min = 0, max = 1, width = 320, height = 150, pad = 18 } = {}) {
  const points = data.map((item, index) => {
    const x = pad + (index / Math.max(data.length - 1, 1)) * (width - pad * 2)
    const value = clampChartValue(item?.[key], min, max)
    const y = height - pad - ((value - min) / Math.max(max - min, 0.000001)) * (height - pad * 2)
    return [x, y]
  })
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
}

function LightweightTimelineChart({
  areaKey,
  className = 'h-[200px] w-full aspect-auto',
  data,
  domain = [0, 1],
  formatter,
  series,
  valueLabel,
}) {
  const width = 320
  const height = 150
  const pad = 18
  const [min, max] = domain
  const gridY = [0.25, 0.5, 0.75].map((ratio) => pad + ratio * (height - pad * 2))
  const last = data[data.length - 1] || {}
  const areaPath = areaKey ? buildSeriesPath(data, areaKey, { min, max, width, height, pad }) : ''
  const areaFill = areaPath ? `${areaPath} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z` : ''
  const primary = series[0]

  return (
    <div className={`${className} rounded-md border bg-muted/15 p-3`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label={valueLabel || 'Recent telemetry chart'}>
        <rect x="0" y="0" width={width} height={height} rx="8" className="fill-background/20" />
        {gridY.map((y) => (
          <line key={y} x1={pad} x2={width - pad} y1={y} y2={y} className="stroke-border/50" strokeDasharray="3 5" />
        ))}
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="stroke-border/70" />
        {areaFill ? <path d={areaFill} fill={series.find((item) => item.key === areaKey)?.color || 'var(--chart-1)'} opacity="0.16" /> : null}
        {series.map((item) => (
          <path
            key={item.key}
            d={buildSeriesPath(data, item.key, { min, max, width, height, pad })}
            fill="none"
            stroke={item.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
        {primary ? <span>{primary.label}: {formatter ? formatter(last?.[primary.key] ?? 0) : last?.[primary.key] ?? 0}</span> : null}
      </div>
    </div>
  )
}

function LightweightBarChart({
  className = 'h-[180px] w-full aspect-auto',
  data,
  formatter,
  labelKey = 'label',
  valueKey,
}) {
  const max = Math.max(1, ...data.map((item) => Number(item?.[valueKey]) || 0))

  return (
    <div className={`${className} rounded-md border bg-muted/15 p-3`}>
      <div className="grid h-full items-end gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }}>
        {data.map((item) => {
          const value = Number(item?.[valueKey]) || 0
          const height = `${Math.max(3, (value / max) * 100)}%`
          return (
            <div key={item[labelKey]} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
              <div className="flex h-full w-full items-end">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height, backgroundColor: item.fill }}
                  title={`${item[labelKey]} ${formatter ? formatter(value) : value}`}
                />
              </div>
              <span className="max-w-full truncate text-[10px] text-muted-foreground">{item[labelKey]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MetricCard({ badge, description, help, icon: Icon, title, value, sparkline, sparklineColor }) {
  return (
    <Card size="sm" className="bg-card/90">
      <CardHeader className="border-b">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <CardAction>
          <div className="flex items-center gap-2">
            {badge}
            {help ? <HelpTip>{help}</HelpTip> : null}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          {sparkline && <Sparkline data={sparkline} color={sparklineColor} />}
        </div>
      </CardContent>
    </Card>
  )
}

function DetailItem({ help, label, mono = false, value }) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{label}</span>
        {help ? <HelpTip>{help}</HelpTip> : null}
      </div>
      <div className={cn('text-sm font-medium leading-5 break-words', mono && 'font-mono text-xs')}>{value}</div>
    </div>
  )
}

function EmptyState({ description, title }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed bg-muted/10 p-6 text-center">
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function SectionFallback({ title }) {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Loading section data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    </section>
  )
}

export {
  DetailItem,
  EmptyState,
  HelpTip,
  LightweightBarChart,
  LightweightTimelineChart,
  MetricCard,
  SectionFallback,
  SectionHeading,
  Sparkline,
}
