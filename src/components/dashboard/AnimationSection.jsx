import { memo, useEffect, useMemo, useState } from 'react'
import {
  ActivityIcon,
  AudioLinesIcon,
  BrainIcon,
  DatabaseIcon,
  GaugeIcon,
  RadarIcon,
  RouteIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import NeuralFlowDiagram from './NeuralFlowDiagram'
import { DetailItem, EmptyState, HelpTip, SectionHeading } from '@/components/dashboard/shared'
import { formatFloat, formatPercent } from '@/lib/dashboard-utils'
import { useTelemetryStore } from '@/stores/telemetryStore'

const SIGNAL_META = {
  dopamine: { label: 'Dopamine', short: 'DA', accent: 'from-amber-400 to-orange-500' },
  serotonin: { label: 'Serotonin', short: '5-HT', accent: 'from-blue-400 to-cyan-500' },
  acetylcholine: { label: 'Acetylcholine', short: 'ACh', accent: 'from-emerald-400 to-teal-500' },
  norepinephrine: { label: 'Norepinephrine', short: 'NE', accent: 'from-rose-400 to-red-500' },
}

function clamp01(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
}

function metricBarWidth(value) {
  return `${Math.max(6, Math.round(clamp01(value) * 100))}%`
}

function selectionIs(target, type, key) {
  if (!target) return false
  if (target.type !== type) return false
  if (type === 'column') return target.index === key
  return target.key === key
}

function SignalBar({ accent, label, shortLabel, value }) {
  const numeric = clamp01(value)
  return (
    <div className="space-y-1.5 rounded-xl border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{shortLabel}</Badge>
          <span className="text-muted-foreground">{label}</span>
        </div>
        <span className="font-medium text-foreground">{formatPercent(numeric, 0)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div className={`h-full rounded-full bg-gradient-to-r ${accent}`} style={{ width: metricBarWidth(numeric) }} />
      </div>
    </div>
  )
}

function MiniMetricCard({ active = false, description, icon: Icon, onClick, title, value, badge }) {
  return (
    <Card
      size="sm"
      className={`bg-card/90 transition-colors ${onClick ? 'cursor-pointer hover:bg-muted/20' : ''} ${active ? 'ring-2 ring-purple-400/40' : ''}`}
      onClick={onClick}
    >
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
        {badge ? <CardAction>{badge}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  )
}

function DiagramLegendPill({ color, label }) {
  return (
    <div className="flex items-center gap-2 rounded-full border bg-muted/10 px-3 py-1 text-xs">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

function FlowInspectorPanel({ selectedTarget, animationData, brainRuntime, topSource }) {
  const activations = Array.isArray(animationData?.activations) ? animationData.activations : []
  const winnerId = animationData?.winner_id ?? null
  const memoryFill = clamp01(animationData?.memory_fill ?? 0)
  const visualConfidence = clamp01(animationData?.cross_modal?.visual_confidence ?? 0)
  const audioConfidence = clamp01(animationData?.cross_modal?.audio_confidence ?? 0)
  const visibleCols = Math.min(animationData?.n_columns || 0, 160)

  let title = 'Competitive columns'
  let description = 'This is the main sparse competitive field where one column wins the current step.'
  let details = [
    { label: 'Visible columns', value: visibleCols || 'n/a' },
    { label: 'Winner', value: winnerId != null && winnerId >= 0 ? `#${winnerId}` : 'n/a' },
    { label: 'Peak activation', value: formatFloat(Math.max(...(activations.length ? activations : [0])), 3) },
  ]
  let badges = [winnerId != null && winnerId >= 0 ? `winner #${winnerId}` : 'waiting']
  let note = 'Click a node or heatmap cell to inspect what it means in the live flow.'

  if (selectedTarget?.type === 'column') {
    const activation = Number(activations[selectedTarget.index] || 0)
    title = `Column #${selectedTarget.index}`
    description = 'A visible column from the competitive field. Higher activation means it is more strongly responding right now.'
    details = [
      { label: 'Activation', value: formatFloat(activation, 4) },
      { label: 'Winner', value: selectedTarget.index === winnerId ? 'Yes' : 'No' },
      { label: 'Visible subset', value: selectedTarget.index < visibleCols ? 'Yes' : 'No' },
    ]
    badges = [selectedTarget.index === winnerId ? 'winner' : 'candidate', `column ${selectedTarget.index}`]
    note = 'The flow map shows a performance-friendly visible subset. The live runtime may contain many more columns underneath.'
  } else if (selectedTarget?.type === 'layer') {
    switch (selectedTarget.key) {
      case 'input':
        title = 'Token encoder'
        description = 'Incoming text windows are transformed into spike-friendly input patterns here.'
        details = [
          { label: 'Role', value: 'text → spikes' },
          { label: 'Tokens processed', value: brainRuntime?.background_tokens_processed ?? 'n/a' },
          { label: 'Tick count', value: brainRuntime?.tick_count ?? 'n/a' },
        ]
        badges = ['input']
        note = 'This is the front door of the live loop: text and sensory-aligned captions enter here before competition begins.'
        break
      case 'columns':
        title = 'Competitive columns'
        description = 'Columns compete to represent the current pattern. One winner becomes the dominant active concept for the step.'
        details = [
          { label: 'Total columns', value: animationData?.n_columns?.toLocaleString?.() ?? 'n/a' },
          { label: 'Winner', value: winnerId != null && winnerId >= 0 ? `#${winnerId}` : 'n/a' },
          { label: 'Visible subset', value: visibleCols || 'n/a' },
        ]
        badges = ['competition']
        note = 'This is where sparse coding happens. The UI only draws a capped subset for readability and performance.'
        break
      case 'memory':
        title = 'Memory store'
        description = 'Accepted patterns and longer-lived traces accumulate here.'
        details = [
          { label: 'Memory fill', value: formatPercent(memoryFill, 0) },
          { label: 'Recent previews', value: brainRuntime?.multimodal?.recent_preview_count ?? 0 },
          { label: 'Real sensory episodes', value: brainRuntime?.multimodal?.real_episodes_completed ?? 0 },
        ]
        badges = [memoryFill >= 0.85 ? 'high load' : 'stable']
        note = 'If memory fill rises too high for too long, the runtime can become crowded and older traces may get less distinct.'
        break
      case 'routing':
        title = 'Routing index'
        description = 'The live system uses this semantic routing layer to access useful evidence and memory neighborhoods quickly.'
        details = [
          { label: 'Next sensory source', value: brainRuntime?.multimodal?.next_source_name || 'n/a' },
          { label: 'Top routed source', value: topSource?.name || 'n/a' },
          { label: 'Top source score', value: formatFloat(topSource?.last_selection_score, 2) },
        ]
        badges = ['semantic routing']
        note = 'This routing layer helps the system decide which memory region or sensory source deserves attention next.'
        break
      case 'visual':
        title = 'Image grounding beam'
        description = 'When visual grounding is active, image-derived spikes are injected alongside text.'
        details = [
          { label: 'Image confidence', value: formatFloat(visualConfidence, 3) },
          { label: 'Visual accepted', value: brainRuntime?.multimodal?.real_cross_modal_visual_accepted ?? 0 },
          { label: 'Recent previews', value: brainRuntime?.multimodal?.recent_preview_count ?? 0 },
        ]
        badges = ['visual grounding']
        note = 'This lights up when Terminus selects a real image sample and binds it into the current state.'
        break
      case 'audio':
        title = 'Audio grounding beam'
        description = 'When audio grounding is active, environmental audio spikes are injected alongside text.'
        details = [
          { label: 'Audio confidence', value: formatFloat(audioConfidence, 3) },
          { label: 'Audio accepted', value: brainRuntime?.multimodal?.real_cross_modal_audio_accepted ?? 0 },
          { label: 'Recent previews', value: brainRuntime?.multimodal?.recent_preview_count ?? 0 },
        ]
        badges = ['audio grounding']
        note = 'This lights up when Terminus selects a real audio sample and binds it into the current state.'
        break
      default:
        break
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Inspector: {title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <Badge key={badge} variant="outline">{badge}</Badge>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {details.map((item) => (
          <DetailItem key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  )
}

export default memo(function AnimationSection({ animationData, telemetry }) {
  const brainRuntime = useTelemetryStore((state) => state.brainRuntime)

  const hasData = Boolean(animationData && animationData.n_columns > 0)
  const activations = Array.isArray(animationData?.activations) ? animationData.activations : []
  const peakActivation = activations.length ? Math.max(...activations) : 0
  const meanActivation = average(activations)
  const winnerId = animationData?.winner_id
  const memoryFill = clamp01(animationData?.memory_fill ?? 0)
  const crossModal = animationData?.cross_modal || {}
  const visualConfidence = clamp01(crossModal.visual_confidence ?? 0)
  const audioConfidence = clamp01(crossModal.audio_confidence ?? 0)

  const [selectedTarget, setSelectedTarget] = useState({ type: 'layer', key: 'columns' })

  useEffect(() => {
    const visibleCols = Math.min(animationData?.n_columns || 0, 160)
    if (selectedTarget?.type === 'column' && selectedTarget.index >= visibleCols) {
      setSelectedTarget({ type: 'layer', key: 'columns' })
    }
  }, [animationData?.n_columns, selectedTarget])

  const focusTerms = Array.isArray(brainRuntime?.multimodal?.focus_terms)
    ? brainRuntime.multimodal.focus_terms
    : []

  const dominantSignal = useMemo(() => {
    return Object.entries(SIGNAL_META)
      .map(([key, meta]) => ({ key, ...meta, value: clamp01(telemetry?.[key]) }))
      .sort((left, right) => right.value - left.value)[0]
  }, [telemetry])

  const sourceProgress = Array.isArray(brainRuntime?.sensory?.source_progress)
    ? brainRuntime.sensory.source_progress
    : []

  const topSource = useMemo(() => {
    return [...sourceProgress].sort((left, right) => (right.last_selection_score ?? 0) - (left.last_selection_score ?? 0))[0] || null
  }, [sourceProgress])

  const visibleSubset = Math.min(animationData?.n_columns || 0, 160)

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Dynamics"
        description="Live flow through the active runtime: token encoding, winner columns, memory pressure, routing, neuromodulators, and sensory grounding."
        badge={<Badge variant={hasData ? 'secondary' : 'outline'}>{hasData ? 'live flow' : 'waiting for telemetry'}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetricCard
          active={selectionIs(selectedTarget, 'layer', 'columns')}
          icon={BrainIcon}
          title="Winner column"
          description="Current dominant column in the competitive field."
          value={winnerId ?? 'n/a'}
          badge={winnerId != null ? <Badge variant="secondary">active</Badge> : <Badge variant="outline">idle</Badge>}
          onClick={() => setSelectedTarget({ type: 'layer', key: 'columns' })}
        />
        <MiniMetricCard
          active={selectionIs(selectedTarget, 'layer', 'input')}
          icon={ActivityIcon}
          title="Activation field"
          description="Fast read of the visible column activation distribution."
          value={hasData ? formatFloat(peakActivation, 2) : 'n/a'}
          badge={<Badge variant="outline">mean {formatFloat(meanActivation, 2)}</Badge>}
          onClick={() => setSelectedTarget({ type: 'layer', key: 'input' })}
        />
        <MiniMetricCard
          active={selectionIs(selectedTarget, 'layer', 'memory')}
          icon={DatabaseIcon}
          title="Memory load"
          description="How full the current memory store is in the live diagram."
          value={formatPercent(memoryFill, 0)}
          badge={<Badge variant={memoryFill >= 0.85 ? 'destructive' : 'secondary'}>{memoryFill >= 0.85 ? 'crowded' : 'comfortable'}</Badge>}
          onClick={() => setSelectedTarget({ type: 'layer', key: 'memory' })}
        />
        <MiniMetricCard
          active={selectionIs(selectedTarget, 'layer', 'visual') || selectionIs(selectedTarget, 'layer', 'audio')}
          icon={GaugeIcon}
          title="Cross-modal confidence"
          description="Current visual/audio grounding strength in the active step."
          value={`V ${formatFloat(visualConfidence, 2)} · A ${formatFloat(audioConfidence, 2)}`}
          badge={<Badge variant="outline">{brainRuntime?.multimodal?.recent_preview_count ?? 0} previews</Badge>}
          onClick={() => setSelectedTarget({ type: 'layer', key: visualConfidence >= audioConfidence ? 'visual' : 'audio' })}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="h-5 w-5" />
              Neural flow map
              {hasData && (
                <Badge variant="outline" className="text-xs">
                  {animationData.n_columns} columns
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Cleaner live flow view with a centered processing path and a larger visible column subset. Click nodes or cells to pin them in the inspector.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 pt-4">
            {hasData ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <DiagramLegendPill color="#3b82f6" label="text cue" />
                  <DiagramLegendPill color="#a78bfa" label="winner / competitive field" />
                  <DiagramLegendPill color="#10b981" label="image grounding" />
                  <DiagramLegendPill color="#f59e0b" label="audio grounding" />
                  <Badge variant="outline">showing {visibleSubset} / {animationData.n_columns} columns</Badge>
                  <Badge variant="outline">winner {winnerId != null && winnerId >= 0 ? `#${winnerId}` : 'n/a'}</Badge>
                </div>
                <NeuralFlowDiagram
                  animationData={animationData}
                  selectedTarget={selectedTarget}
                  onSelectTarget={setSelectedTarget}
                />
                <FlowInspectorPanel
                  selectedTarget={selectedTarget}
                  animationData={animationData}
                  brainRuntime={brainRuntime}
                  topSource={topSource}
                />
              </>
            ) : (
              <EmptyState
                title="Waiting for live telemetry"
                description="The dynamics map will appear as soon as the backend pushes animation data."
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <RadarIcon className="size-4" /> Neuromodulator mix
                <HelpTip>These values summarize how surprised, exploratory, or stressed the system currently is. They are control signals, not language outputs.</HelpTip>
              </CardTitle>
              <CardDescription>
                Dominant signal: {dominantSignal?.label || 'n/a'} {dominantSignal ? `(${formatPercent(dominantSignal.value, 0)})` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {Object.entries(SIGNAL_META).map(([key, meta]) => (
                <SignalBar
                  key={key}
                  accent={meta.accent}
                  label={meta.label}
                  shortLabel={meta.short}
                  value={telemetry?.[key] ?? 0}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <RouteIcon className="size-4" /> Sensory routing in context
              </CardTitle>
              <CardDescription>
                What the live dynamics view is currently coupled to on the sensory side.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="Next source" value={brainRuntime?.multimodal?.next_source_name || 'n/a'} />
                <DetailItem label="Real episodes" value={brainRuntime?.multimodal?.real_episodes_completed ?? 0} />
                <DetailItem label="Visual accepted" value={brainRuntime?.multimodal?.real_cross_modal_visual_accepted ?? 0} />
                <DetailItem label="Audio accepted" value={brainRuntime?.multimodal?.real_cross_modal_audio_accepted ?? 0} />
              </div>

              <div className="space-y-2 rounded-xl border bg-muted/10 p-4">
                <div className="flex items-center gap-2">
                  <AudioLinesIcon className="size-4 text-emerald-400" />
                  <p className="text-sm font-medium">Active focus terms</p>
                </div>
                {focusTerms.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {focusTerms.map((term) => (
                      <Badge key={term} variant="outline" className="text-[10px]">{term}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No live focus terms yet.</p>
                )}
              </div>

              <div className="space-y-2 rounded-xl border bg-muted/10 p-4">
                <div className="flex items-center gap-2">
                  <GaugeIcon className="size-4 text-purple-400" />
                  <p className="text-sm font-medium">Top routed sensory source</p>
                </div>
                {topSource ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{topSource.name}</Badge>
                      <Badge variant="outline">score {formatFloat(topSource.last_selection_score, 2)}</Badge>
                      <Badge variant="outline">match {formatFloat(topSource.last_semantic_match, 2)}</Badge>
                      {topSource.last_item_semantic_match != null ? (
                        <Badge variant="outline">item {formatFloat(topSource.last_item_semantic_match, 2)}</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {topSource.last_text || 'This source has not produced a recent routed text preview yet.'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No sensory source has been routed yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}, (prev, next) => {
  if (prev.animationData !== next.animationData) return false
  if (prev.telemetry?.dopamine !== next.telemetry?.dopamine) return false
  if (prev.telemetry?.serotonin !== next.telemetry?.serotonin) return false
  if (prev.telemetry?.acetylcholine !== next.telemetry?.acetylcholine) return false
  if (prev.telemetry?.norepinephrine !== next.telemetry?.norepinephrine) return false
  return true
})
