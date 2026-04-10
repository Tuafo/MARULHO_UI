import {
  ActivityIcon,
  DatabaseIcon,
  HardDriveIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  fixedUnitDomain,
  formatCompactNumber,
  formatPercent,
  nicePositiveDomain,
} from '@/lib/dashboard-utils'
import { EmptyState, HelpTip, MetricCard, SectionHeading } from '@/components/dashboard/shared'

const CHART_CLASS = 'h-[240px] w-full aspect-auto'
const LIVE_SAMPLE_WINDOW = 80
const LIVE_WINDOW_TICKS = [1, 20, 40, 60, 80]

const TOKEN_CHART_CONFIG = {
  tokens: {
    label: 'Tokens',
    color: 'var(--chart-1)',
  },
}

const STATE_CHART_CONFIG = {
  memoryFill: {
    label: 'Memory fill',
    color: 'var(--chart-2)',
  },
  driftFloor: {
    label: 'Drift floor',
    color: 'var(--chart-4)',
  },
}

const REGULATOR_CHART_CONFIG = {
  dopamine: {
    label: 'Dopamine',
    color: 'var(--chart-1)',
  },
  serotonin: {
    label: 'Serotonin',
    color: 'var(--chart-2)',
  },
  acetylcholine: {
    label: 'Acetylcholine',
    color: 'var(--chart-3)',
  },
  norepinephrine: {
    label: 'Norepinephrine',
    color: 'var(--chart-5)',
  },
}

function buildTelemetryWindow(telemetryData) {
  return Array.from({ length: LIVE_SAMPLE_WINDOW }, (_, index) => ({
    slot: index + 1,
    ...(telemetryData[index] || {}),
  }))
}

export default function OverviewSection({ activeResponse, checkpointName, memoryStore, status, telemetryData }) {
  const tokenDomain = nicePositiveDomain(telemetryData.map((item) => item.tokens), 1000)
  const windowedTelemetryData = buildTelemetryWindow(telemetryData)

  return (
    <section id="overview" className="space-y-4">
      <SectionHeading
        title="Overview"
        description="A quick read of session activity, memory pressure, answer support, and the currently loaded checkpoint."
        badge={<Badge variant="outline">rev {status?.state_revision ?? 'n/a'}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ActivityIcon}
          title="Tokens seen"
          value={status?.token_count?.toLocaleString() || 'n/a'}
          description="How much text the runtime has processed so far."
          badge={<Badge variant="outline">winner {status?.last_winner ?? 'n/a'}</Badge>}
          help="How much text this run has handled. More can mean more learning, but only if answer support stays good and drift stays low. Read it together with Memory fill and Answer support."
        />
        <MetricCard
          icon={DatabaseIcon}
          title="Memory fill"
          value={formatPercent(memoryStore.slow_buffer_fill_fraction ?? status?.memory_fill_fraction, 0)}
          description="How full the slow memory buffer is right now."
          badge={<Badge variant="secondary">{memoryStore.slow_buffer_size ?? status?.memory_buffer_size ?? 0} stored</Badge>}
          help="How full the long-term memory buffer is. Around 50% to 85% is usually comfortable. If it stays near 90% or higher, memory may be getting crowded."
        />
        <MetricCard
          icon={ShieldCheckIcon}
          title="Answer support"
          value={activeResponse ? formatPercent(activeResponse.support_score, 0) : 'n/a'}
          description="How much of the current answer is backed by retrieved evidence."
          badge={
            activeResponse?.response_mode
              ? <Badge variant={activeResponse.response_mode === 'insufficient_evidence' ? 'destructive' : 'secondary'}>{activeResponse.response_mode.replace(/_/g, ' ')}</Badge>
              : null
          }
          help="How much of the answer matches retrieved evidence. Higher is better. Over 70% is strong, 40% to 70% is mixed, and under 40% usually means the answer is guessing too much."
        />
        <MetricCard
          icon={HardDriveIcon}
          title="Loaded checkpoint"
          value={checkpointName}
          description="The snapshot the runtime is currently attached to."
          badge={<Badge variant={status?.dirty_state ? 'outline' : 'secondary'}>{status?.dirty_state ? 'dirty' : 'aligned'}</Badge>}
          help="This is the snapshot the runtime started from. The name is not a score. What matters is whether the runtime still matches it or has unsaved changes."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Token trend</CardTitle>
            <CardDescription>The pace of incoming tokens across recent telemetry snapshots.</CardDescription>
            <CardAction>
              <HelpTip>Shows how fast text is coming in. Rising means the system is busy. Flat means little is happening. This measures activity, not answer quality.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent>
            {telemetryData.length ? (
              <ChartContainer config={TOKEN_CHART_CONFIG} className={CHART_CLASS}>
                <AreaChart data={windowedTelemetryData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    type="number"
                    dataKey="slot"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    domain={[1, LIVE_SAMPLE_WINDOW]}
                    ticks={LIVE_WINDOW_TICKS}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    domain={tokenDomain}
                    tickFormatter={formatCompactNumber}
                  />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Sample ${value}`} />} />
                  <Area
                    type="linear"
                    dataKey="tokens"
                    stroke="var(--color-tokens)"
                    fill="var(--color-tokens)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyState title="Waiting for telemetry" description="The token chart will appear after the service pushes a status sample." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>State drift</CardTitle>
            <CardDescription>Memory pressure and drift baseline side by side.</CardDescription>
            <CardAction>
              <HelpTip>Shows memory load and drift floor together. Memory fill can rise over time. Drift floor should stay low and preferably flat. If drift floor keeps rising, the system may be starting to forget older patterns.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent>
            {telemetryData.length ? (
              <ChartContainer config={STATE_CHART_CONFIG} className={CHART_CLASS}>
                <LineChart data={windowedTelemetryData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    type="number"
                    dataKey="slot"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    domain={[1, LIVE_SAMPLE_WINDOW]}
                    ticks={LIVE_WINDOW_TICKS}
                  />
                  <YAxis tickLine={false} axisLine={false} width={64} domain={fixedUnitDomain()} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Sample ${value}`} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="linear" dataKey="memoryFill" stroke="var(--color-memoryFill)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="driftFloor" stroke="var(--color-driftFloor)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyState title="Waiting for telemetry" description="Memory fill and drift appear once the live status stream starts updating." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Novelty signals</CardTitle>
            <CardDescription>Fast read of the surprise regulators driving the current session.</CardDescription>
            <CardAction>
              <HelpTip>These are the system's change signals. Dopamine reacts to better-than-expected learning pressure, serotonin to worse-than-expected inhibitory pressure, acetylcholine to expected uncertainty and novelty, and norepinephrine to strong unexpected surprise. Healthy runs usually move around instead of staying stuck. If norepinephrine stays very high, the system is under stress.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent>
            {telemetryData.length ? (
              <ChartContainer config={REGULATOR_CHART_CONFIG} className={CHART_CLASS}>
                <LineChart data={windowedTelemetryData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    type="number"
                    dataKey="slot"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    domain={[1, LIVE_SAMPLE_WINDOW]}
                    ticks={LIVE_WINDOW_TICKS}
                  />
                  <YAxis tickLine={false} axisLine={false} width={64} domain={fixedUnitDomain()} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Sample ${value}`} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="linear" dataKey="dopamine" stroke="var(--color-dopamine)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="serotonin" stroke="var(--color-serotonin)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="acetylcholine" stroke="var(--color-acetylcholine)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="norepinephrine" stroke="var(--color-norepinephrine)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyState title="Waiting for telemetry" description="These regulator traces show up once the backend starts streaming live snapshots." />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
