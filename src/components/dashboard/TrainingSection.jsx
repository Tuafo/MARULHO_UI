import { memo, useMemo } from 'react'
import {
  BrainIcon,
  EyeIcon,
  TrendingUpIcon,
  ZapIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  formatFloat,
  formatPercent,
} from '@/lib/dashboard-utils'
import {
  LightweightBarChart,
  LightweightTimelineChart,
  MetricCard,
  SectionHeading,
} from '@/components/dashboard/shared'

const CHART_CLASS = 'h-[200px] w-full aspect-auto'
const LIVE_SAMPLE_WINDOW = 80
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

  return (
    <LightweightBarChart
      className={CHART_CLASS}
      data={data}
      formatter={(value) => formatPercent(value, 0)}
      labelKey="word"
      valueKey="confidence"
    />
  )
}

function NeuromodTimeline({ data }) {
  const windowData = buildWindow(data)

  return (
    <LightweightTimelineChart
      className={CHART_CLASS}
      data={windowData}
      domain={[0, 1]}
      formatter={(value) => formatFloat(value, 2)}
      series={[
        { key: 'dopamine', label: 'DA', color: 'hsl(45, 93%, 47%)' },
        { key: 'serotonin', label: '5-HT', color: 'hsl(200, 70%, 50%)' },
        { key: 'acetylcholine', label: 'ACh', color: 'hsl(130, 60%, 45%)' },
        { key: 'norepinephrine', label: 'NE', color: 'hsl(0, 70%, 55%)' },
      ]}
    />
  )
}

function LossTimeline({ data }) {
  const windowData = buildWindow(data)

  return (
    <LightweightTimelineChart
      areaKey="recon_error"
      className={CHART_CLASS}
      data={windowData}
      domain={[0, Math.max(1, ...windowData.flatMap((item) => [Number(item.recon_error) || 0, Number(item.drift) || 0]))]}
      formatter={(value) => formatFloat(value, 3)}
      series={[
        { key: 'recon_error', label: 'Recon error', color: 'var(--chart-3)' },
        { key: 'drift', label: 'Drift', color: 'var(--chart-5)' },
      ]}
    />
  )
}

function GroundingTimeline({ data }) {
  const windowData = buildWindow(data)

  return (
    <LightweightTimelineChart
      areaKey="avgConfidence"
      className={CHART_CLASS}
      data={windowData}
      domain={[0, 1]}
      formatter={(value) => formatPercent(value, 0)}
      series={[
        { key: 'avgConfidence', label: 'Avg confidence', color: 'var(--chart-1)' },
        { key: 'minConfidence', label: 'Min confidence', color: 'var(--chart-4)' },
      ]}
    />
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
