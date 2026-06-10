import { useEffect, useMemo, useState } from 'react'
import {
  DatabaseIcon,
  LayersIcon,
  LinkIcon,
  RefreshCwIcon,
  RouteIcon,
  SparklesIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailItem, EmptyState, HelpTip, SectionHeading } from '@/components/dashboard/shared'
import { formatFloat } from '@/lib/dashboard-utils'
import { useApiCall } from '@/hooks/useApi'

function formatParamValue(value) {
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString()
    return formatFloat(value, 3)
  }
  if (value === null || value === undefined || value === '') return 'n/a'
  return String(value)
}

function SummaryCard({ badge, description, icon: Icon, title, value, help }) {
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
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  )
}

function StageCard({ accentClass, chips = [], subtitle, title }) {
  return (
    <div className={`rounded-2xl border p-5 ${accentClass}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{subtitle}</p>
      <h3 className="mt-2 text-base font-medium tracking-tight">{title}</h3>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <Badge key={chip} variant="outline" className="text-[10px]">{chip}</Badge>
        ))}
      </div>
    </div>
  )
}

function LayerDetailCard({ layer }) {
  const params = Object.entries(layer?.params || {})
  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{layer?.name || 'Layer'}</p>
          <p className="text-xs text-muted-foreground">{layer?.type || 'unknown'}</p>
        </div>
        <Badge variant={layer?.enabled ? 'secondary' : 'outline'}>{layer?.enabled ? 'active' : 'disabled'}</Badge>
      </div>
      {params.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {params.slice(0, 6).map(([key, value]) => (
            <DetailItem key={key} label={key.replace(/_/g, ' ')} value={formatParamValue(value)} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No live parameters reported for this layer.</p>
      )}
    </div>
  )
}

export default function ArchitectureSection({ apiBase }) {
  const { data: architecture, loading, error, execute: fetchArchitecture } = useApiCall(apiBase, '/architecture')
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!fetched && apiBase) {
      setFetched(true)
      fetchArchitecture()
    }
  }, [apiBase, fetched, fetchArchitecture])

  const layers = Array.isArray(architecture?.layers) ? architecture.layers : []
  const layerMap = useMemo(() => Object.fromEntries(layers.map((layer) => [layer.id, layer])), [layers])

  const inputLayer = layerMap.input_encoding || {}
  const coreLayer = layerMap.competitive_routing || {}
  const predictiveLayer = layerMap.predictive_columns || {}
  const contextLayer = layerMap.context_prediction || {}
  const groundingLayer = layerMap.cross_modal_grounding || {}
  const memoryLayer = layerMap.memory_consolidation || {}
  const autonomyLayer = layerMap.autonomy_curriculum || {}

  const enabledLayers = layers.filter((layer) => layer.enabled)

  const stageChips = {
    inputs: [
      `${formatParamValue(inputLayer?.params?.background_sources)} background`,
      `${formatParamValue(inputLayer?.params?.sensory_sources)} sensory`,
      `chunking ${formatParamValue(inputLayer?.params?.learned_chunking)}`,
    ],
    core: [
      `${formatParamValue(coreLayer?.params?.n_columns)} cols`,
      `k=${formatParamValue(coreLayer?.params?.k_routing)}`,
      `predictive ${formatParamValue(predictiveLayer?.enabled)}`,
      `${formatParamValue(contextLayer?.params?.context_mode)} context`,
    ],
    grounding: [
      `visual ${formatParamValue(groundingLayer?.params?.dim_visual)}`,
      `audio ${formatParamValue(groundingLayer?.params?.dim_audio)}`,
      `memory ${formatParamValue(memoryLayer?.params?.memory_capacity)}`,
      `sensory ${formatParamValue(groundingLayer?.params?.sensory_active)}`,
    ],
    autonomy: [
      `curriculum ${formatParamValue(autonomyLayer?.params?.curriculum_enabled)}`,
      `sensory ${formatParamValue(autonomyLayer?.params?.sensory_enabled)}`,
    ],
  }

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Model"
        description="Current MARULHO topology: GPCSN column field, predictive/context dynamics, real cross-modal grounding, dual memory, and active exploration."
        badge={<Badge variant="outline">{architecture?.family || 'hybrid runtime'}</Badge>}
      />

      {loading && !architecture ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading current model topology…</CardContent>
        </Card>
      ) : null}

      {error && !architecture ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {architecture ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              icon={LayersIcon}
              title="GPCSN core"
              description="Sparse competitive representation and predictive structure."
              value={formatParamValue(coreLayer?.params?.n_columns)}
              badge={<Badge variant="secondary">columns</Badge>}
              help="This is the live sparse column field at the center of MARULHO. It is the main representational substrate of the system."
            />
            <SummaryCard
              icon={RouteIcon}
              title="Prediction + context"
              description="Predictive columns, routing sparsity, and attractor context."
              value={`${formatParamValue(coreLayer?.params?.k_routing)} / ${formatParamValue(contextLayer?.params?.context_mode)}`}
              badge={<Badge variant="outline">predictive {formatParamValue(predictiveLayer?.enabled)}</Badge>}
            />
            <SummaryCard
              icon={LinkIcon}
              title="Grounding"
              description="Real cross-modal alignment and sensory runtime dimensions."
              value={`V ${formatParamValue(groundingLayer?.params?.dim_visual)} · A ${formatParamValue(groundingLayer?.params?.dim_audio)}`}
              badge={<Badge variant={groundingLayer?.enabled ? 'secondary' : 'outline'}>{groundingLayer?.enabled ? 'cross-modal on' : 'cross-modal off'}</Badge>}
            />
          </div>

          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <SparklesIcon className="size-4" /> Current runtime topology
                    <Badge variant="outline">{architecture.model_name}</Badge>
                    <Badge variant="outline">{architecture.core_name}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Operator-facing view of the current Subcortex stack.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => fetchArchitecture()} disabled={loading}>
                  <RefreshCwIcon className={`mr-1 size-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
                <StageCard
                  accentClass="bg-blue-500/5"
                  subtitle="Inputs"
                  title="Background text + sensory streams"
                  chips={stageChips.inputs}
                />
                <div className="hidden xl:flex items-center justify-center text-muted-foreground">→</div>
                <StageCard
                  accentClass="bg-purple-500/5"
                  subtitle="Core"
                  title="GPCSN columns + predictive context"
                  chips={stageChips.core}
                />
                <div className="hidden xl:flex items-center justify-center text-muted-foreground">→</div>
                <StageCard
                  accentClass="bg-cyan-500/5"
                  subtitle="Grounding + memory"
                  title="Cross-modal alignment + consolidation"
                  chips={stageChips.grounding}
                />
                <div className="hidden xl:flex items-center justify-center text-muted-foreground">→</div>
                <StageCard
                  accentClass="bg-emerald-500/5"
                  subtitle="Autonomy"
                  title="Active exploration + policy evidence"
                  chips={stageChips.autonomy}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                MARULHO is a live runtime: GPCSN provides grounded sparse structure, while active exploration, replay, and policy evidence carry the cognition path.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <LayersIcon className="size-4" /> Live subsystems
                </CardTitle>
                <CardDescription>
                  Current subsystem cards with live parameters pulled from the backend architecture summary.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 pt-4">
                {layers.map((layer) => (
                  <LayerDetailCard key={layer.id} layer={layer} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <DatabaseIcon className="size-4" /> Runtime summary
                </CardTitle>
                <CardDescription>
                  Operator-friendly readout of what is active in the current MARULHO stack.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
                <DetailItem label="Model" value={architecture.model_name} />
                <DetailItem label="Core" value={architecture.core_name || 'n/a'} />
                <DetailItem label="Version label" value={architecture.version} />
                <DetailItem label="Enabled layers" value={`${enabledLayers.length} / ${layers.length}`} />
                <DetailItem label="Plasticity rule" value={architecture.config?.plasticity_rule || 'n/a'} />
                <DetailItem label="Context mode" value={architecture.config?.context_mode || 'n/a'} />
                <DetailItem label="Cross-modal" value={formatParamValue(architecture.config?.cross_modal)} />
                <DetailItem label="Columns" value={formatParamValue(architecture.config?.n_columns)} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (!loading && !error ? (
        <EmptyState title="No model summary available" description="The runtime did not return an architecture summary yet." />
      ) : null)}
    </section>
  )
}
