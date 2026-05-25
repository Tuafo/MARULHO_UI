import {
  ActivityIcon,
  BrainIcon,
  DatabaseIcon,
  FileTextIcon,
  HardDriveIcon,
  LinkIcon,
  MessageSquareTextIcon,
  PlayIcon,
  RotateCwIcon,
  RouteIcon,
  ServerIcon,
  ShieldCheckIcon,
  SquareIcon,
  ZapIcon,
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
import { Button } from '@/components/ui/button'
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
  formatFloat,
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

export default function OverviewSection({
  activeResponse,
  apiBase,
  brainRuntime,
  checkpointName,
  memoryStore,
  pendingAction,
  selectSection,
  startBrain,
  status,
  stopBrain,
  streamConnected,
  telemetryData,
  tickBrain,
}) {
  const tokenDomain = nicePositiveDomain(telemetryData.map((item) => item.tokens), 1000)
  const windowedTelemetryData = buildTelemetryWindow(telemetryData)
  const animation = status?.animation || {}
  const crossModal = animation.cross_modal
  const contextTau = animation.context_tau
  const runtimeScope = status?.runtime_scope || {}
  const brain = brainRuntime || status?.terminus_runtime

  const tokenSparkline = telemetryData.slice(-20).map((d) => d.tokens ?? 0)
  const memorySparkline = telemetryData.slice(-20).map((d) => d.memoryFill ?? 0)
  const startDisabled = Boolean(pendingAction || brain?.running)
  const tickDisabled = Boolean(pendingAction || !brain?.configured)
  const stopDisabled = Boolean(pendingAction || !brain?.running)

  return (
    <section id="overview" className="space-y-4">
      <SectionHeading
        title="Startup Dashboard"
        description="Live service state, runtime controls, validation evidence, and the main operator paths in one place."
        badge={<Badge variant="outline">rev {status?.state_revision ?? 'n/a'}</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ServerIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>Service & Runtime</CardTitle>
                <CardDescription>Backend stream, checkpoint attachment, and Terminus loop state.</CardDescription>
              </div>
            </div>
            <CardAction>
              <Badge variant={streamConnected ? 'secondary' : 'destructive'}>
                {streamConnected ? 'stream live' : 'stream offline'}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">API base</p>
                <p className="truncate font-mono text-xs font-medium">{apiBase}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Runtime</p>
                <p className="text-sm font-medium">{brain?.running ? 'Running' : brain?.configured ? 'Ready' : 'Unconfigured'}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Ticks</p>
                <p className="text-sm font-medium">{brain?.tick_count?.toLocaleString?.() ?? brain?.tick_count ?? 0}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Background tokens</p>
                <p className="text-sm font-medium">{brain?.background_tokens_processed?.toLocaleString?.() ?? brain?.background_tokens_processed ?? 0}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={startBrain} disabled={startDisabled}>
                <PlayIcon className="size-3.5" />
                Start loop
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={tickBrain} disabled={tickDisabled}>
                <RotateCwIcon className="size-3.5" />
                Tick
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={stopBrain} disabled={stopDisabled}>
                <SquareIcon className="size-3.5" />
                Stop
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => selectSection('runtime')}>
                <RouteIcon className="size-3.5" />
                Systems
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <BrainIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>Operator Paths</CardTitle>
                <CardDescription>Primary workflows backed by service endpoints.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className="h-auto justify-start gap-3 p-3" onClick={() => selectSection('ask')}>
              <MessageSquareTextIcon className="size-4 text-primary" />
              <span className="text-left">
                <span className="block text-sm font-medium">Workspace</span>
                <span className="block text-xs text-muted-foreground">Ask, inspect, learn</span>
              </span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start gap-3 p-3" onClick={() => selectSection('validation')}>
              <ShieldCheckIcon className="size-4 text-primary" />
              <span className="text-left">
                <span className="block text-sm font-medium">Validation</span>
                <span className="block text-xs text-muted-foreground">Reports, gates, evidence</span>
              </span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start gap-3 p-3" onClick={() => selectSection('animation')}>
              <BrainIcon className="size-4 text-primary" />
              <span className="text-left">
                <span className="block text-sm font-medium">Subcortex</span>
                <span className="block text-xs text-muted-foreground">Spike dynamics</span>
              </span>
            </Button>
            <Button type="button" variant="outline" className="h-auto justify-start gap-3 p-3" onClick={() => selectSection('traces')}>
              <FileTextIcon className="size-4 text-primary" />
              <span className="text-left">
                <span className="block text-sm font-medium">Traces</span>
                <span className="block text-xs text-muted-foreground">Execution history</span>
              </span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={ActivityIcon}
          title="Tokens seen"
          value={status?.token_count?.toLocaleString() || 'n/a'}
          description="How much text the runtime has processed so far."
          badge={<Badge variant="outline">winner {status?.last_winner ?? 'n/a'}</Badge>}
          help="How much text this run has handled. More can mean more learning, but only if answer support stays good and drift stays low. Read it together with Memory fill and Answer support."
          sparkline={tokenSparkline}
          sparklineColor="var(--chart-1)"
        />
        <MetricCard
          icon={DatabaseIcon}
          title="Memory fill"
          value={formatPercent(memoryStore.slow_buffer_fill_fraction ?? status?.memory_fill_fraction, 0)}
          description="How full the slow memory buffer is right now."
          badge={<Badge variant="secondary">{memoryStore.slow_buffer_size ?? status?.memory_buffer_size ?? 0} stored</Badge>}
          help="How full the long-term memory buffer is. Around 50% to 85% is usually comfortable. If it stays near 90% or higher, memory may be getting crowded."
          sparkline={memorySparkline}
          sparklineColor="var(--chart-2)"
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
        <MetricCard
          icon={BrainIcon}
          title="Living brain"
          value={brain?.running ? 'Active' : 'Idle'}
          description={`${brain?.multimodal?.cross_modal_visual_accepted ?? 0}V/${brain?.multimodal?.cross_modal_audio_accepted ?? 0}A bound · ${brain?.multimodal?.recent_preview_count ?? 0} previews`}
          badge={brain?.multimodal?.enabled
            ? <Badge variant="secondary">sensory active</Badge>
            : <Badge variant="outline">text only</Badge>
          }
          help="The active Terminus brain: SNN training, real sensory grounding, replay, policy pressure, and runtime-truth evidence."
        />
      </div>

      {/* V4 feature indicators */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <LinkIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>Cross-modal grounding</CardTitle>
                <CardDescription>Visual and audio confidence from the grounding layer.</CardDescription>
              </div>
            </div>
            <CardAction>
              <HelpTip>Shows how confident the cross-modal grounding channels are. Higher means the model has stronger multi-sensory binding.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent>
            {crossModal ? (
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Visual</p>
                  <p className="text-2xl font-semibold">{formatFloat(crossModal.visual_confidence, 3)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Audio</p>
                  <p className="text-2xl font-semibold">{formatFloat(crossModal.audio_confidence, 3)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Cross-modal layer not active</p>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ZapIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>Adaptive context τ</CardTitle>
                <CardDescription>Learned time constants for the recurrent attractor context.</CardDescription>
              </div>
            </div>
            <CardAction>
              <HelpTip>Each context unit has its own learned time constant (tau). Smaller tau means faster context decay, larger tau means longer memory. Healthy systems show a spread of values.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent>
            {contextTau && contextTau.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-end gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground">Mean τ</p>
                    <p className="text-2xl font-semibold">{formatFloat(contextTau.reduce((a, b) => a + b, 0) / contextTau.length, 3)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Range</p>
                    <p className="text-sm font-medium">{formatFloat(Math.min(...contextTau), 2)} – {formatFloat(Math.max(...contextTau), 2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Units</p>
                    <p className="text-sm font-medium">{contextTau.length}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Context layer not active</p>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ActivityIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>Plasticity circuit</CardTitle>
                <CardDescription>Active synaptic learning rule and consolidation mode.</CardDescription>
              </div>
            </div>
            <CardAction>
              <HelpTip>Shows which plasticity pathway is active. local_stdp with triplet traces and tag/PRP consolidation is the v4 target.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant={runtimeScope.supports_local_log_stdp ? 'secondary' : 'outline'}>
                {runtimeScope.plasticity_mode || 'n/a'}
              </Badge>
              {runtimeScope.uses_adex_post_spikes && (
                <Badge variant="secondary">AdEx spikes</Badge>
              )}
              <Badge variant={runtimeScope.supports_stc_like_memory_consolidation ? 'secondary' : 'outline'}>
                {runtimeScope.memory_consolidation_mode || 'no consolidation'}
              </Badge>
              {runtimeScope.supports_inhibitory_balance && (
                <Badge variant="secondary">iSTDP balance</Badge>
              )}
            </div>
          </CardContent>
        </Card>
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
