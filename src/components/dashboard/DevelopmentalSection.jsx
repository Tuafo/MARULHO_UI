import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatFloat, formatPercent } from '@/lib/dashboard-utils'
import { DetailItem, EmptyState, HelpTip, SectionHeading } from '@/components/dashboard/shared'

const STAGE_ORDER = [
  { key: 'bootstrap', label: 'Bootstrap', description: 'Initial weight seeding and prototype formation.' },
  { key: 'memory_warm', label: 'Memory warm-up', description: 'Slow memory buffer starts accepting patterns.' },
  { key: 'consolidation', label: 'Consolidation', description: 'Tag/PRP replay-consolidation stack active.' },
  { key: 'contextual', label: 'Contextual routing', description: 'Multi-scale recurrent attractor context layer online.' },
  { key: 'cross_modal', label: 'Cross-modal grounding', description: 'Visual/audio grounding channels active.' },
  { key: 'abstraction', label: 'Abstraction', description: 'Slow-feature feedback layer learning abstract representations.' },
  { key: 'binding', label: 'Binding', description: 'Sparse coincidence binding with PV-inhibition.' },
]

function stageStatus(runtimeScope, status) {
  const tokenCount = status?.token_count ?? 0
  return STAGE_ORDER.map((stage) => {
    switch (stage.key) {
      case 'bootstrap':
        return { ...stage, active: true, complete: tokenCount > 0 }
      case 'memory_warm':
        return { ...stage, active: tokenCount > 0, complete: (status?.memory_fill_fraction ?? 0) > 0 }
      case 'consolidation':
        return { ...stage, active: runtimeScope.supports_stc_like_memory_consolidation ?? false, complete: (status?.sleep_events ?? 0) > 0 }
      case 'contextual':
        return { ...stage, active: runtimeScope.supports_contextual_routing ?? false, complete: runtimeScope.supports_contextual_routing ?? false }
      case 'cross_modal':
        return { ...stage, active: runtimeScope.supports_first_class_abstraction ?? false, complete: false }
      case 'abstraction':
        return { ...stage, active: runtimeScope.supports_first_class_abstraction ?? false, complete: runtimeScope.supports_first_class_abstraction ?? false }
      case 'binding':
        return { ...stage, active: runtimeScope.supports_binding_conjunction_memory ?? false, complete: runtimeScope.supports_binding_conjunction_memory ?? false }
      default:
        return { ...stage, active: false, complete: false }
    }
  })
}

function ProgressBar({ fraction, color = 'bg-primary' }) {
  const pct = Math.min(100, Math.max(0, fraction * 100))
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function DevelopmentalSection({ runtimeScope, status }) {
  if (!runtimeScope || !status) {
    return (
      <section className="space-y-4">
        <SectionHeading title="Developmental" description="Stage progress for the active runtime." />
        <EmptyState title="Waiting for status" description="Connect to a running HECSN service to see developmental stages." />
      </section>
    )
  }

  const stages = stageStatus(runtimeScope, status)
  const completedCount = stages.filter((s) => s.complete).length
  const activeCount = stages.filter((s) => s.active).length

  const plasticityMode = runtimeScope.plasticity_mode || 'n/a'
  const spikeBackend = runtimeScope.plasticity_spike_backend || 'n/a'
  const inputRep = runtimeScope.input_representation || 'n/a'

  return (
    <section id="developmental" className="space-y-4">
      <SectionHeading
        title="Developmental"
        description="Current runtime maturity — which stages are online and how far along they are."
        badge={
          <Badge variant="outline">
            {completedCount}/{stages.length} stages complete
          </Badge>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <CardTitle>Overall progress</CardTitle>
            <CardAction>
              <HelpTip>Fraction of developmental stages that have reached completion at least once.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-semibold">{formatPercent(completedCount / stages.length, 0)}</div>
            <ProgressBar fraction={completedCount / stages.length} />
            <p className="text-xs text-muted-foreground">{activeCount} active, {completedCount} complete</p>
          </CardContent>
        </Card>

        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <CardTitle>Plasticity</CardTitle>
            <CardAction>
              <HelpTip>The synaptic learning rule and spike generation backend in use.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailItem label="Mode" value={plasticityMode} />
            <DetailItem label="Spike backend" value={spikeBackend} />
          </CardContent>
        </Card>

        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <CardTitle>Consolidation</CardTitle>
            <CardAction>
              <HelpTip>Sleep/replay events that consolidate short-term memories into long-term storage.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailItem label="Sleep events" value={status?.sleep_events ?? 0} />
            <DetailItem label="Micro-sleep" value={status?.micro_sleep_events ?? 0} />
            <DetailItem label="Deep sleep" value={status?.deep_sleep_events ?? 0} />
          </CardContent>
        </Card>

        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <CardTitle>Encoding</CardTitle>
            <CardAction>
              <HelpTip>How input text is encoded before entering the competitive layer.</HelpTip>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailItem label="Representation" value={inputRep} />
            <DetailItem label="Input dim" value={runtimeScope.input_dim ?? 'n/a'} />
            <DetailItem label="Routing fraction" value={formatFloat(runtimeScope.routing_candidate_fraction, 3)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stage pipeline</CardTitle>
          <CardDescription>Each stage activates sequentially as the runtime matures. Green = complete, blue = active, gray = waiting.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stages.map((stage) => (
              <div key={stage.key} className="flex items-center gap-4 rounded-lg border bg-muted/10 p-3">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    stage.complete
                      ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                      : stage.active
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stage.complete ? '✓' : stage.active ? '▶' : '·'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{stage.label}</span>
                    {stage.complete && <Badge variant="secondary" className="text-[10px]">complete</Badge>}
                    {stage.active && !stage.complete && <Badge variant="outline" className="text-[10px]">active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{stage.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
