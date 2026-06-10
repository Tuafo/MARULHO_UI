import { lazy, memo, Suspense, useState } from 'react'
import {
  BoxIcon,
  BrainIcon,
  EyeIcon,
  GaugeIcon,
  LinkIcon,
  LoaderCircleIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, HelpTip, SectionHeading } from '@/components/dashboard/shared'
import { formatCompactNumber, formatFloat, formatPercent } from '@/lib/dashboard-utils'
import { useTelemetryStore } from '@/stores/telemetryStore'

const NeuralSpaceCanvas = lazy(() => import('@/components/dashboard/NeuralSpaceCanvas'))

function clamp01(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

function StatCard({ description, icon: Icon, title, value, badge }) {
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
        {badge ? <CardAction>{badge}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  )
}

function CanvasFallback() {
  return (
    <Card className="overflow-hidden border-border/50 bg-card/95">
      <CardContent className="flex min-h-[360px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Loading WebGL scene
        </div>
      </CardContent>
    </Card>
  )
}

function NeuralSpace3D() {
  const animation = useTelemetryStore((state) => state.animation)
  const crossModal = useTelemetryStore((state) => state.crossModal)
  const brainRuntime = useTelemetryStore((state) => state.brainRuntime)
  const memoryFill = useTelemetryStore((state) => state.memoryFill)

  const nCols = animation?.n_columns || 0
  const winnerId = animation?.winner_id ?? null
  const activations = Array.isArray(animation?.activations) ? animation.activations : []
  const peakActivation = activations.length ? Math.max(...activations) : 0
  const visualConfidence = clamp01(crossModal?.visual_confidence ?? 0)
  const audioConfidence = clamp01(crossModal?.audio_confidence ?? 0)
  const hasData = nCols > 0
  const [canvasLoaded, setCanvasLoaded] = useState(false)

  if (canvasLoaded) {
    return (
      <Suspense fallback={<CanvasFallback />}>
        <NeuralSpaceCanvas />
      </Suspense>
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Neural Space"
        description="3D WebGL visualization is available as an explicit visual slow path. Runtime evidence stays visible before loading the heavy scene."
        badge={<Badge variant={hasData ? 'secondary' : 'outline'}>{hasData ? 'telemetry ready' : 'waiting for telemetry'}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BoxIcon}
          title="Column field"
          description="Current runtime column count reported by telemetry."
          value={hasData ? formatCompactNumber(nCols) : 'n/a'}
          badge={<Badge variant="outline">WebGL not loaded</Badge>}
        />
        <StatCard
          icon={BrainIcon}
          title="Winner column"
          description="Dominant column plus strongest visible activation."
          value={winnerId != null && winnerId >= 0 ? `#${winnerId}` : 'n/a'}
          badge={<Badge variant="outline">peak {formatFloat(peakActivation, 2)}</Badge>}
        />
        <StatCard
          icon={GaugeIcon}
          title="Memory field"
          description="Current memory occupancy without rendering the 3D scene."
          value={formatPercent(memoryFill, 0)}
          badge={<Badge variant={memoryFill >= 0.85 ? 'destructive' : 'secondary'}>{memoryFill >= 0.85 ? 'high load' : 'stable'}</Badge>}
        />
        <StatCard
          icon={LinkIcon}
          title="Cross-modal beams"
          description="Image/audio grounding strength from runtime telemetry."
          value={`V ${formatFloat(visualConfidence, 2)} · A ${formatFloat(audioConfidence, 2)}`}
          badge={<Badge variant="outline">{brainRuntime?.multimodal?.recent_preview_count ?? 0} previews</Badge>}
        />
      </div>

      <Card className="overflow-hidden border-border/50 bg-card/95">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <EyeIcon className="size-4" /> 3D cortical field
                <HelpTip>Loading the 3D field downloads Three/R3F and starts a WebGL render loop. Keep it off during routine monitoring; load it when visual inspection is useful.</HelpTip>
              </CardTitle>
              <CardDescription>
                The lightweight summary above stays on the normal UI path; the interactive scene is an explicit operator-triggered visual path.
              </CardDescription>
            </div>
            <Button type="button" onClick={() => setCanvasLoaded(true)}>
              <EyeIcon className="size-3.5" />
              Load 3D view
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <EmptyState
            title="3D view is parked"
            description="Load the WebGL scene when you need to inspect spatial dynamics. This keeps routine monitoring lighter."
          />
        </CardContent>
      </Card>
    </section>
  )
}

export default memo(NeuralSpace3D)
