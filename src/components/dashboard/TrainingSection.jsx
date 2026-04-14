import { memo, useMemo } from 'react'
import {
  BrainIcon,
  EyeIcon,
  HeadphonesIcon,
  TrendingUpIcon,
  ZapIcon,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import {
  Card,
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
  formatFloat,
  formatPercent,
} from '@/lib/dashboard-utils'
import { MetricCard, SectionHeading } from '@/components/dashboard/shared'

const CHART_CLASS = 'h-[200px] w-full aspect-auto'
const LIVE_SAMPLE_WINDOW = 80
const LIVE_WINDOW_TICKS = [1, 20, 40, 60, 80]

const GROUNDING_CHART_CONFIG = {
  avgConfidence: {
    label: 'Avg confidence',
    color: 'var(--chart-1)',
  },
  minConfidence: {
    label: 'Min confidence',
    color: 'var(--chart-4)',
  },
}

const NEUROMOD_CHART_CONFIG = {
  dopamine: { label: 'DA', color: 'hsl(45, 93%, 47%)' },
  serotonin: { label: '5-HT', color: 'hsl(200, 70%, 50%)' },
  acetylcholine: { label: 'ACh', color: 'hsl(130, 60%, 45%)' },
  norepinephrine: { label: 'NE', color: 'hsl(0, 70%, 55%)' },
}

const LOSS_CHART_CONFIG = {
  recon_error: {
    label: 'Recon Error',
    color: 'var(--chart-3)',
  },
  drift: {
    label: 'Drift',
    color: 'var(--chart-5)',
  },
}

const DIGIT_COLORS = [
  'hsl(0, 70%, 55%)',    // zero
  'hsl(36, 80%, 50%)',   // one
  'hsl(60, 70%, 45%)',   // two
  'hsl(120, 50%, 45%)',  // three
  'hsl(170, 60%, 40%)',  // four
  'hsl(200, 70%, 50%)',  // five
  'hsl(240, 60%, 55%)',  // six
  'hsl(270, 55%, 55%)',  // seven
  'hsl(300, 50%, 50%)',  // eight
  'hsl(330, 60%, 50%)',  // nine
]

function buildWindow(data) {
  return Array.from({ length: LIVE_SAMPLE_WINDOW }, (_, i) => ({
    slot: i + 1,
    ...(data[i] || {}),
  }))
}

function GroundingBar({ grounding }) {
  if (!grounding || Object.keys(grounding).length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        No grounding data yet
      </div>
    )
  }

  const words = Object.keys(grounding).sort()
  const data = words.map((w, i) => ({
    word: w,
    confidence: grounding[w],
    fill: DIGIT_COLORS[i % DIGIT_COLORS.length],
  }))

  const barConfig = Object.fromEntries(
    words.map((w, i) => [w, { label: w, color: DIGIT_COLORS[i % DIGIT_COLORS.length] }])
  )

  return (
    <ChartContainer config={barConfig} className={CHART_CLASS}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="word" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tickFormatter={formatPercent} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <rect key={entry.word} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function NeuromodTimeline({ data }) {
  const windowData = buildWindow(data)

  return (
    <ChartContainer config={NEUROMOD_CHART_CONFIG} className={CHART_CLASS}>
      <LineChart data={windowData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="slot" ticks={LIVE_WINDOW_TICKS} tick={{ fontSize: 10 }} />
        <YAxis domain={fixedUnitDomain} tickFormatter={formatFloat} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="dopamine"
          stroke="hsl(45, 93%, 47%)"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        <Line
          dataKey="serotonin"
          stroke="hsl(200, 70%, 50%)"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        <Line
          dataKey="acetylcholine"
          stroke="hsl(130, 60%, 45%)"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        <Line
          dataKey="norepinephrine"
          stroke="hsl(0, 70%, 55%)"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

function LossTimeline({ data }) {
  const windowData = buildWindow(data)

  return (
    <ChartContainer config={LOSS_CHART_CONFIG} className={CHART_CLASS}>
      <AreaChart data={windowData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="slot" ticks={LIVE_WINDOW_TICKS} tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={formatFloat} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="recon_error"
          stroke="var(--chart-3)"
          fill="var(--chart-3)"
          fillOpacity={0.15}
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        <Area
          dataKey="drift"
          stroke="var(--chart-5)"
          fill="var(--chart-5)"
          fillOpacity={0.1}
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function GroundingTimeline({ data }) {
  const windowData = buildWindow(data)

  return (
    <ChartContainer config={GROUNDING_CHART_CONFIG} className={CHART_CLASS}>
      <AreaChart data={windowData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="slot" ticks={LIVE_WINDOW_TICKS} tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 1]} tickFormatter={formatPercent} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="avgConfidence"
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.2}
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Area
          dataKey="minConfidence"
          stroke="var(--chart-4)"
          fill="var(--chart-4)"
          fillOpacity={0.1}
          dot={false}
          strokeWidth={1}
          strokeDasharray="4 2"
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function TrainingSection({ status, telemetryData }) {
  const grounding = status?.grounding_confidence || {}
  const nVisual = status?.n_visual_signatures ?? 0
  const nAudio = status?.n_audio_signatures ?? 0
  const tokenCount = status?.token_count ?? 0
  const sleepEvents = status?.deep_sleep_events ?? 0

  const groundingValues = Object.values(grounding)
  const avgConf = groundingValues.length > 0
    ? groundingValues.reduce((a, b) => a + b, 0) / groundingValues.length
    : 0
  const minConf = groundingValues.length > 0
    ? Math.min(...groundingValues)
    : 0
  const nGrounded = groundingValues.filter((c) => c > 0.5).length

  // Build timeline data from telemetry
  const groundingTimeline = useMemo(
    () =>
      telemetryData.map((d) => {
        const gc = d.grounding_confidence || {}
        const vals = Object.values(gc)
        return {
          avgConfidence: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
          minConfidence: vals.length > 0 ? Math.min(...vals) : null,
        }
      }),
    [telemetryData],
  )

  const lossTimeline = useMemo(
    () =>
      telemetryData.map((d) => ({
        recon_error: d.animation?.last_recon_error ?? null,
        drift: d.drift ?? null,
      })),
    [telemetryData],
  )

  const neuromodTimeline = useMemo(
    () =>
      telemetryData.map((d) => ({
        dopamine: d.dopamine ?? null,
        serotonin: d.serotonin ?? null,
        acetylcholine: d.acetylcholine ?? null,
        norepinephrine: d.norepinephrine ?? null,
      })),
    [telemetryData],
  )

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Training Monitor"
        description="Live training metrics, grounding confidence, and neuromodulator dynamics"
      />

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={BrainIcon}
          label="Words Grounded"
          value={`${nGrounded} / ${groundingValues.length || '—'}`}
          sub={groundingValues.length > 0 ? `avg ${formatPercent(avgConf)}` : 'no data'}
        />
        <MetricCard
          icon={TrendingUpIcon}
          label="Avg Confidence"
          value={groundingValues.length > 0 ? formatPercent(avgConf) : '—'}
          sub={groundingValues.length > 0 ? `min ${formatPercent(minConf)}` : 'waiting'}
        />
        <MetricCard
          icon={EyeIcon}
          label="Visual Signatures"
          value={nVisual}
          sub={`${nAudio} audio`}
        />
        <MetricCard
          icon={ZapIcon}
          label="Consolidations"
          value={sleepEvents}
          sub={`${tokenCount.toLocaleString()} tokens`}
        />
      </div>

      {/* Grounding bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainIcon className="h-4 w-4" />
            Per-Word Grounding Confidence
          </CardTitle>
          <CardDescription>
            Cross-modal binding quality per word (0 = no grounding, 1 = perfect)
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <GroundingBar grounding={grounding} />
        </CardContent>
      </Card>

      {/* Timelines row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Grounding timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grounding Over Time</CardTitle>
            <CardDescription>Average and minimum confidence across all words</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <GroundingTimeline data={groundingTimeline} />
          </CardContent>
        </Card>

        {/* Loss / drift timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reconstruction Error &amp; Drift</CardTitle>
            <CardDescription>Column reconstruction quality and representation drift</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <LossTimeline data={lossTimeline} />
          </CardContent>
        </Card>
      </div>

      {/* Neuromodulator timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ZapIcon className="h-4 w-4" />
            Neuromodulator Dynamics
          </CardTitle>
          <CardDescription>
            DA (surprise), 5-HT (stability), ACh (attention), NE (arousal)
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <NeuromodTimeline data={neuromodTimeline} />
        </CardContent>
      </Card>
    </div>
  )
}

export default memo(TrainingSection)
