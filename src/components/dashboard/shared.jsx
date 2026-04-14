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

export { DetailItem, EmptyState, HelpTip, MetricCard, SectionFallback, SectionHeading, Sparkline }