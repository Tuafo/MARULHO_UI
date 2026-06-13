import { useEffect, useRef, useState } from 'react'
import {
  ActivityIcon,
  ArchiveIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  CircleGaugeIcon,
  CpuIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  GaugeIcon,
  Layers3Icon,
  LoaderCircleIcon,
  MessageSquareTextIcon,
  NetworkIcon,
  PlayIcon,
  RefreshCwIcon,
  SaveIcon,
  ServerIcon,
  ShieldCheckIcon,
  SquareIcon,
  TriangleAlertIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { TooltipProvider } from '@/components/ui/tooltip'
import MachineryWorkspace from '@/components/MachineryWorkspace'
import {
  DEFAULT_API_BASE,
  fileName,
  formatCompactNumber,
  formatFloat,
  formatMode,
  formatPercent,
  formatWhen,
  normalizeApiBase,
} from '@/lib/dashboard-utils'
import { requestJson } from '@/lib/service-api'

const WORKSPACES = [
  { id: 'runtime', label: 'Runtime', icon: ActivityIcon },
  { id: 'machinery', label: 'Machinery', icon: NetworkIcon },
  { id: 'columns', label: 'Columns', icon: Layers3Icon },
  { id: 'sources', label: 'Sources', icon: DatabaseIcon },
  { id: 'interaction', label: 'Interaction', icon: MessageSquareTextIcon },
  { id: 'evidence', label: 'Evidence', icon: ShieldCheckIcon },
]

function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE)
  const [apiDraft, setApiDraft] = useState(DEFAULT_API_BASE)
  const [workspace, setWorkspace] = useState('runtime')
  const [status, setStatus] = useState(null)
  const [terminus, setTerminus] = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [traces, setTraces] = useState([])
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('')
  const [growthTrial, setGrowthTrial] = useState(null)
  const [queryText, setQueryText] = useState('')
  const [contextText, setContextText] = useState('')
  const [response, setResponse] = useState(null)
  const [connected, setConnected] = useState(false)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const reconnectRef = useRef(null)

  const runtime = terminus?.terminus_runtime || status?.terminus_runtime || {}
  const truth = status?.runtime_truth || terminus?.runtime_truth || {}
  const evidence = truth?.evidence || {}
  const device = evidence.runtime_device || status?.runtime_scope?.device || {}
  const columns = status?.runtime_scope?.column_runtime || evidence.column_runtime || {}
  const spikeHealth = status?.runtime_scope?.spike_health || evidence.subcortex_spike_health || {}
  const memory = status?.memory_store || {}
  const benchmark = evidence.benchmark_evidence_currency || {}

  async function refreshCore() {
    const [nextStatus, nextTerminus, nextCheckpoints, nextTraces, nextGrowth] = await Promise.allSettled([
      requestJson(apiBase, '/status', { timeoutMs: 10000 }),
      requestJson(apiBase, '/terminus', { timeoutMs: 10000 }),
      requestJson(apiBase, '/checkpoints', { timeoutMs: 5000 }),
      requestJson(apiBase, '/traces?limit=12', { timeoutMs: 5000 }),
      requestJson(
        apiBase,
        '/terminus/subcortical-structural-plasticity/binding-growth-trial?max_candidates=8&max_total_edge_delta=16',
        { timeoutMs: 10000 },
      ),
    ])

    if (nextStatus.status === 'fulfilled') setStatus(nextStatus.value)
    if (nextTerminus.status === 'fulfilled') setTerminus(nextTerminus.value)
    if (nextCheckpoints.status === 'fulfilled') {
      const items = nextCheckpoints.value.checkpoints || []
      setCheckpoints(items)
      setSelectedCheckpoint((current) => current || nextStatus.value?.checkpoint_path || items[0]?.path || '')
    }
    if (nextTraces.status === 'fulfilled') setTraces(nextTraces.value.traces || [])
    if (nextGrowth.status === 'fulfilled') setGrowthTrial(nextGrowth.value)

    const firstFailure = [nextStatus, nextTerminus].find((result) => result.status === 'rejected')
    if (firstFailure) throw firstFailure.reason
  }

  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => {
    let cancelled = false
    setError('')
    setConnected(false)

    refreshCore()
      .then(() => {
        if (!cancelled) setConnected(true)
      })
      .catch((err) => {
        if (!cancelled) setError(String(err.message || err))
      })

    let source
    const connect = () => {
      source = new EventSource(`${apiBase}/stream/status?interval=1`)
      source.addEventListener('status', (event) => {
        if (cancelled) return
        setStatus((current) => ({ ...(current || {}), ...JSON.parse(event.data) }))
        setConnected(true)
        setError('')
      })
      source.onerror = () => {
        setConnected(false)
        source.close()
        reconnectRef.current = window.setTimeout(connect, 2000)
      }
    }
    connect()

    const terminusPoll = window.setInterval(async () => {
      try {
        const next = await requestJson(apiBase, '/terminus', { timeoutMs: 5000 })
        if (!cancelled) setTerminus(next)
      } catch {
        // The status stream remains the fallback.
      }
    }, 2500)

    return () => {
      cancelled = true
      source?.close()
      window.clearInterval(terminusPoll)
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
    }
  }, [apiBase])

  async function runAction(label, action) {
    setPending(label)
    setError('')
    try {
      await action()
      await refreshCore()
      setConnected(true)
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPending('')
    }
  }

  const quickStart = () => runAction(
    'Starting the maintained curriculum',
    () => requestJson(apiBase, '/terminus/quick-start?preset=curriculum', { method: 'POST' }),
  )
  const startRuntime = () => runAction(
    'Starting Terminus',
    () => requestJson(apiBase, '/terminus/start', { method: 'POST' }),
  )
  const stopRuntime = () => runAction(
    'Stopping Terminus at the current token boundary',
    () => requestJson(apiBase, '/terminus/stop', { method: 'POST', timeoutMs: 25000 }),
  )
  const tickRuntime = () => runAction(
    'Running one explicit tick',
    () => requestJson(apiBase, '/terminus/tick', {
      method: 'POST',
      body: JSON.stringify({ steps: 1 }),
      timeoutMs: 120000,
    }),
  )
  const saveCheckpoint = () => runAction(
    'Saving a quiescent checkpoint',
    () => requestJson(apiBase, '/checkpoint/save', {
      method: 'POST',
      body: JSON.stringify({ path: null }),
      timeoutMs: 120000,
    }),
  )
  const restoreCheckpoint = () => runAction(
    'Restoring the selected checkpoint',
    () => requestJson(apiBase, '/checkpoint/restore', {
      method: 'POST',
      body: JSON.stringify({ path: selectedCheckpoint }),
      timeoutMs: 120000,
    }),
  )

  async function submitInteraction(event) {
    event.preventDefault()
    const query = queryText.trim()
    if (!query) return
    setPending('Producing a grounded Subcortex readout')
    setError('')
    try {
      const result = await requestJson(apiBase, '/respond', {
        method: 'POST',
        body: JSON.stringify({
          query_text: query,
          context_text: contextText.trim() || null,
          learn_mode: 'none',
          max_evidence_items: 4,
          top_k_candidates: 6,
          top_k_memories: 6,
          top_chars: 6,
        }),
        timeoutMs: 120000,
      })
      setResponse(result)
      await refreshCore()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPending('')
    }
  }

  function applyApiBase() {
    const normalized = normalizeApiBase(apiDraft)
    setApiDraft(normalized)
    setApiBase(normalized)
  }

  const workspaceContent = {
    runtime: (
      <RuntimeWorkspace
        columns={columns}
        device={device}
        memory={memory}
        runtime={runtime}
        spikeHealth={spikeHealth}
        status={status}
        truth={truth}
      />
    ),
    machinery: (
      <MachineryWorkspace
        columns={columns}
        runtime={runtime}
        status={status}
      />
    ),
    columns: (
      <ColumnsWorkspace
        columns={columns}
        growthTrial={growthTrial}
        spikeHealth={spikeHealth}
      />
    ),
    sources: <SourcesWorkspace runtime={runtime} />,
    interaction: (
      <InteractionWorkspace
        contextText={contextText}
        pending={pending}
        queryText={queryText}
        response={response}
        setContextText={setContextText}
        setQueryText={setQueryText}
        submitInteraction={submitInteraction}
      />
    ),
    evidence: (
      <EvidenceWorkspace
        benchmark={benchmark}
        checkpoints={checkpoints}
        growthTrial={growthTrial}
        pending={pending}
        restoreCheckpoint={restoreCheckpoint}
        runtime={runtime}
        saveCheckpoint={saveCheckpoint}
        selectedCheckpoint={selectedCheckpoint}
        setSelectedCheckpoint={setSelectedCheckpoint}
        traces={traces}
        truth={truth}
      />
    ),
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarHeader className="border-b border-sidebar-border p-3">
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left"
              onClick={() => setWorkspace('runtime')}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <BrainCircuitIcon className="size-5" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <div className="font-semibold">MARULHO</div>
                <div className="truncate text-xs text-muted-foreground">Local cognitive runtime</div>
              </div>
            </button>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {WORKSPACES.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={workspace === item.id}
                        onClick={() => setWorkspace(item.id)}
                        tooltip={item.label}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.id === 'columns' ? (
                        <SidebarMenuBadge>{columns.awake_count ?? 0}</SidebarMenuBadge>
                      ) : null}
                      {item.id === 'evidence' ? (
                        <SidebarMenuBadge>{checkpoints.length}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-3">
            <div className="space-y-2 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Runtime Truth</span>
                <StatusBadge value={truth.verdict || 'pending'} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Device</span>
                <span className="font-mono">{device.resolved_device || 'unknown'}</span>
              </div>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
            <div className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-2 md:px-6">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-semibold">
                  {WORKSPACES.find((item) => item.id === workspace)?.label}
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  {formatMode(truth.recommended_action || 'runtime evidence pending')}
                </p>
              </div>
              <HeaderSignal connected={connected} icon={connected ? WifiIcon : WifiOffIcon}>
                {connected ? 'Live' : 'Offline'}
              </HeaderSignal>
              <HeaderSignal active={runtime.running} icon={ActivityIcon}>
                {runtime.running ? 'Running' : runtime.configured ? 'Stopped' : 'Not configured'}
              </HeaderSignal>
              <HeaderSignal active={device.observed_cuda_execution} icon={CpuIcon}>
                {device.observed_cuda_execution ? 'CUDA observed' : 'CUDA unproven'}
              </HeaderSignal>
              <Button
                size="sm"
                onClick={runtime.configured ? startRuntime : quickStart}
                disabled={Boolean(pending) || runtime.running}
              >
                <PlayIcon />
                {runtime.configured ? 'Start' : 'Quick start'}
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={tickRuntime}
                disabled={Boolean(pending) || !runtime.configured || runtime.running}
                title="Run one tick"
              >
                <RefreshCwIcon />
              </Button>
              <Button
                size="icon-sm"
                variant="destructive"
                onClick={stopRuntime}
                disabled={Boolean(pending) || !runtime.running}
                title="Stop runtime"
              >
                <SquareIcon />
              </Button>
            </div>
          </header>

          <main className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-end gap-2 border-b pb-4">
              <div className="min-w-[240px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">API endpoint</label>
                <Input
                  value={apiDraft}
                  onChange={(event) => setApiDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyApiBase()
                  }}
                />
              </div>
              <Button variant="outline" onClick={applyApiBase} disabled={normalizeApiBase(apiDraft) === apiBase}>
                Apply
              </Button>
              <Button variant="ghost" onClick={() => runAction('Refreshing runtime evidence', refreshCore)} disabled={Boolean(pending)}>
                <RefreshCwIcon />
                Refresh
              </Button>
            </div>

            {error ? (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>Service operation failed</AlertTitle>
                <AlertDescription className="break-words">{error}</AlertDescription>
              </Alert>
            ) : null}
            {pending ? (
              <Alert>
                <LoaderCircleIcon className="animate-spin" />
                <AlertTitle>Operation in progress</AlertTitle>
                <AlertDescription>{pending}</AlertDescription>
              </Alert>
            ) : null}

            {workspaceContent[workspace]}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function RuntimeWorkspace({ columns, device, memory, runtime, spikeHealth, status, truth }) {
  const execution = runtime.execution || {}
  const stageTimings = Object.entries(
    truth?.latency_ms?.stages || runtime.last_tick_stage_timings_ms || {},
  ).sort(([, left], [, right]) => Number(right || 0) - Number(left || 0))
  return (
    <div className="space-y-5">
      <MetricStrip>
        <Metric label="Runtime Truth" value={formatMode(truth.verdict || 'pending')} detail={formatMode(truth.recommended_action)} />
        <Metric label="Tokens" value={formatCompactNumber(status?.token_count || 0)} detail={`${runtime.tick_count || 0} completed ticks`} />
        <Metric label="Throughput" value={`${formatFloat(runtime.tokens_per_second, 2)} tok/s`} detail={`${formatFloat(runtime.last_tick_duration_ms, 1)} ms last tick`} />
        <Metric label="Memory" value={formatPercent(memory.fill_fraction, 1)} detail={`${memory.size || 0} / ${memory.capacity || 0} records`} />
        <Metric label="Awake columns" value={`${columns.awake_count || 0} / ${columns.total_columns || 0}`} detail={formatMode(columns.execution?.mode)} />
      </MetricStrip>

      <Panel title="Current execution" icon={GaugeIcon}>
        <DataGrid>
          <Data label="State" value={runtime.running ? 'running' : runtime.configured ? 'stopped' : 'not configured'} />
          <Data label="Tick phase" value={execution.tick_phase || 'idle'} />
          <Data label="Source" value={execution.tick_source_name || runtime.next_source_name || 'n/a'} />
          <Data label="Tick elapsed" value={execution.tick_elapsed_ms == null ? 'n/a' : `${formatFloat(execution.tick_elapsed_ms, 1)} ms`} />
          <Data label="Background tokens" value={runtime.background_tokens_processed || 0} />
          <Data label="State revision" value={status?.state_revision ?? 'n/a'} />
        </DataGrid>
      </Panel>

      {stageTimings.length ? (
        <Panel title="Last tick stage profile" icon={CircleGaugeIcon}>
          <DataGrid>
            {stageTimings.map(([stage, duration]) => (
              <Data key={stage} label={formatMode(stage)} value={`${formatFloat(duration, 2)} ms`} />
            ))}
          </DataGrid>
        </Panel>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Device evidence" icon={CpuIcon}>
          <DataGrid>
            <Data label="Requested" value={device.requested_device || 'n/a'} />
            <Data label="Resolved" value={device.resolved_device || 'n/a'} />
            <Data label="Tensor device" value={device.tensor_device || status?.runtime_scope?.cuda_first_runtime?.tensor_device || 'n/a'} />
            <Data label="Routing search" value={device.routing_search_device || 'n/a'} />
            <Data label="CUDA available" value={yesNo(device.cuda_available)} />
            <Data label="CUDA execution observed" value={yesNo(device.observed_cuda_execution)} />
          </DataGrid>
        </Panel>

        <Panel title="Spike health" icon={CircleGaugeIcon}>
          <DataGrid>
            <Data label="Activity" value={formatMode(spikeHealth.activity_state)} />
            <Data label="Silent columns" value={formatPercent(spikeHealth.silent_fraction, 2)} />
            <Data label="Saturated columns" value={formatPercent(spikeHealth.saturated_fraction, 2)} />
            <Data label="Stale columns" value={formatPercent(spikeHealth.stale_fraction, 2)} />
            <Data label="Correlation" value={formatMode(spikeHealth.correlation?.status)} />
            <Data label="Correlation max" value={formatFloat(spikeHealth.correlation?.max_abs_offdiag_correlation, 3)} />
          </DataGrid>
        </Panel>
      </div>
    </div>
  )
}

function ColumnsWorkspace({ columns, growthTrial, spikeHealth }) {
  const registry = columns.registry?.columns_sample || []
  const votes = columns.votes || []
  const gate = columns.growth_gate || {}
  const trialGate = growthTrial?.promotion_gate || {}
  return (
    <div className="space-y-5">
      <MetricStrip>
        <Metric label="Total" value={columns.total_columns || 0} detail="registered columns" />
        <Metric label="Awake budget" value={columns.awake_budget || 0} detail={formatPercent(columns.awake_fraction, 2)} />
        <Metric label="Cached votes" value={columns.cached_vote_count || 0} detail="sleeping state reuse" />
        <Metric label="Disagreement" value={formatFloat(columns.disagreement?.max, 4)} detail="maximum active vote delta" />
        <Metric label="Report cost" value={`${formatFloat(columns.metabolism?.report_latency_ms, 2)} ms`} detail={`${columns.metabolism?.snapshot_bytes || 0} snapshot bytes`} />
      </MetricStrip>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Scheduler boundary" icon={Layers3Icon}>
          <DataGrid>
            <Data label="Scheduler" value={formatMode(columns.scheduler?.mode)} />
            <Data label="Execution mode" value={formatMode(columns.execution?.mode)} />
            <Data label="Scored columns" value={`${columns.execution?.scored_column_count || 0} / ${columns.execution?.total_columns || 0}`} />
            <Data label="Runs all columns" value={yesNo(columns.runs_all_columns)} />
            <Data label="Promoted scheduler" value={yesNo(columns.scheduler?.promoted_to_execution)} />
            <Data label="Fallback" value={columns.scheduler?.fallback_reason || 'none'} />
          </DataGrid>
        </Panel>
        <Panel title="Growth and pruning gates" icon={FlaskConicalIcon}>
          <DataGrid>
            <Data label="Repeated surprise" value={gate.repeated_surprise_count ?? 0} />
            <Data label="Growth candidates" value={gate.candidate_column_count ?? 0} />
            <Data label="Growth gate" value={gate.ready ? 'ready for trial' : formatMode(gate.evidence)} />
            <Data label="Trial design" value={formatMode(trialGate.status || 'unavailable')} />
            <Data label="Pruning candidates" value={columns.pruning_homeostasis?.weak_or_redundant_column_count ?? 0} />
            <Data label="Spike correlation" value={formatMode(spikeHealth.correlation?.status)} />
          </DataGrid>
        </Panel>
      </div>

      <Panel title="Active column registry" icon={ServerIcon} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Prediction error</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Usefulness</TableHead>
              <TableHead>Failure streak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registry.map((column) => (
              <TableRow key={column.column_id}>
                <TableCell className="font-mono">{column.column_id}</TableCell>
                <TableCell>{formatMode(column.role)}</TableCell>
                <TableCell>{formatFloat(column.local_state?.prediction_error, 4)}</TableCell>
                <TableCell>{formatFloat(column.local_state?.confidence, 4)}</TableCell>
                <TableCell>{formatFloat(column.local_state?.usefulness, 4)}</TableCell>
                <TableCell>{column.local_state?.prediction_failure_streak ?? 0}</TableCell>
              </TableRow>
            ))}
            {!registry.length ? <EmptyTable colSpan={6} label="No column registry evidence yet." /> : null}
          </TableBody>
        </Table>
      </Panel>

      <Panel title="Column votes" icon={ActivityIcon} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Disagreement</TableHead>
              <TableHead>Wake reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {votes.map((vote) => (
              <TableRow key={vote.column_id}>
                <TableCell className="font-mono">{vote.column_id}</TableCell>
                <TableCell><StatusBadge value={vote.state} /></TableCell>
                <TableCell>{formatFloat(vote.confidence, 4)}</TableCell>
                <TableCell>{formatFloat(vote.disagreement, 4)}</TableCell>
                <TableCell>{formatMode(vote.wake_reason || vote.sleep_reason)}</TableCell>
              </TableRow>
            ))}
            {!votes.length ? <EmptyTable colSpan={5} label="No column votes observed yet." /> : null}
          </TableBody>
        </Table>
      </Panel>
    </div>
  )
}

function SourcesWorkspace({ runtime }) {
  const sources = runtime.source_progress || []
  const ingestion = runtime.ingestion || {}
  return (
    <div className="space-y-5">
      <MetricStrip>
        <Metric label="Text sources" value={runtime.source_count || 0} detail={`${runtime.exhausted_source_count || 0} exhausted`} />
        <Metric label="Buffered tokens" value={ingestion.total_buffered_tokens || 0} detail={`${ingestion.ready_source_count || 0} ready sources`} />
        <Metric label="Warm latency" value={`${formatFloat(ingestion.startup_warm_latency_ms, 1)} ms`} detail={formatMode(ingestion.startup_state)} />
        <Metric label="HF sources" value={runtime.huggingface?.source_count || 0} detail={runtime.huggingface?.token_configured ? 'token configured' : 'unauthenticated'} />
      </MetricStrip>

      <Panel title="Source metabolism" icon={DatabaseIcon} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Buffered</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Utility</TableHead>
              <TableHead>Grounding</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.name}>
                <TableCell>
                  <div className="font-medium">{source.name}</div>
                  <div className="text-xs text-muted-foreground">{source.source_type}</div>
                </TableCell>
                <TableCell>{source.buffered_tokens || 0} ({formatPercent(source.buffer_fill_fraction, 0)})</TableCell>
                <TableCell>{source.tokens_processed || 0}</TableCell>
                <TableCell>{formatFloat(source.utility_ema, 3)}</TableCell>
                <TableCell>{formatFloat(source.grounding_signal_ema, 3)}</TableCell>
                <TableCell>{formatWhen(source.last_activity_at)}</TableCell>
              </TableRow>
            ))}
            {!sources.length ? <EmptyTable colSpan={6} label="No configured source progress." /> : null}
          </TableBody>
        </Table>
      </Panel>

      <Panel title="Sensory grounding" icon={GaugeIcon}>
        <DataGrid>
          <Data label="Enabled" value={yesNo(runtime.sensory?.enabled)} />
          <Data label="Sources" value={(runtime.sensory?.source_bank || []).length} />
          <Data label="Buffered items" value={runtime.sensory?.total_buffered_items ?? 0} />
          <Data label="Warm ready" value={yesNo(runtime.sensory?.warm_ready)} />
          <Data label="Episodes completed" value={runtime.multimodal?.real_episodes_completed ?? 0} />
          <Data label="Next source" value={runtime.multimodal?.next_source_name || 'n/a'} />
        </DataGrid>
      </Panel>
    </div>
  )
}

function InteractionWorkspace({
  contextText,
  pending,
  queryText,
  response,
  setContextText,
  setQueryText,
  submitInteraction,
}) {
  const result = response?.response || null
  const query = response?.query_result || null
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
      <Panel title="Grounded interaction" icon={MessageSquareTextIcon}>
        <form className="space-y-4" onSubmit={submitInteraction}>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Question</label>
            <Textarea
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Ask the current Subcortex state and grounded memory."
              className="min-h-28"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Optional context</label>
            <Input value={contextText} onChange={(event) => setContextText(event.target.value)} />
          </div>
          <Button type="submit" disabled={Boolean(pending) || !queryText.trim()}>
            <MessageSquareTextIcon />
            Run grounded readout
          </Button>
        </form>
      </Panel>

      <Panel title="Readout result" icon={BrainCircuitIcon}>
        {result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={result.mode || result.response_mode || 'readout'} />
              <Badge variant="outline">{formatFloat(result.confidence, 3)} confidence</Badge>
              <Badge variant="outline">{response?.trace_id ? `trace ${response.trace_id.slice(0, 8)}` : 'untraced'}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6">{result.response_text}</p>
            <Separator />
            <DataGrid>
              <Data label="Winner" value={query?.winner_id ?? query?.winner ?? 'n/a'} />
              <Data label="Memory matches" value={query?.memory_matches?.length ?? 0} />
              <Data label="Route candidates" value={query?.candidate_ids?.length ?? query?.candidates?.length ?? 0} />
              <Data label="Grounded" value={yesNo(result.grounded ?? result.grounding_supported)} />
            </DataGrid>
          </div>
        ) : (
          <EmptyState label="No grounded readout in this session." />
        )}
      </Panel>
    </div>
  )
}

function EvidenceWorkspace({
  benchmark,
  checkpoints,
  growthTrial,
  pending,
  restoreCheckpoint,
  runtime,
  saveCheckpoint,
  selectedCheckpoint,
  setSelectedCheckpoint,
  traces,
  truth,
}) {
  const gates = [
    ['Binding growth trial', growthTrial?.promotion_gate?.status],
    ['Structural plasticity', truth.evidence?.structural_plasticity_gate?.promotion_status],
    ['Self repair', truth.evidence?.self_repair_gate?.promotion_status],
    ['SNN language', truth.evidence?.snn_language_readiness_gate?.promotion_status],
  ]
  return (
    <div className="space-y-5">
      <MetricStrip>
        <Metric label="Benchmark evidence" value={formatMode(benchmark.status || 'missing')} detail={benchmark.current ? 'current' : 'review required'} />
        <Metric label="Checkpoints" value={checkpoints.length} detail={runtime.running ? 'stop required before save' : 'quiescent save available'} />
        <Metric label="Traces" value={traces.length} detail="recent operator interactions" />
        <Metric label="State" value={truth.verdict || 'pending'} detail={truth.generated_at ? formatWhen(truth.generated_at) : 'not sampled'} />
      </MetricStrip>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Checkpoint control" icon={ArchiveIcon}>
          <div className="space-y-4">
            <Select value={selectedCheckpoint} onValueChange={setSelectedCheckpoint}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select checkpoint" />
              </SelectTrigger>
              <SelectContent>
                {checkpoints.map((checkpoint) => (
                  <SelectItem key={checkpoint.path} value={checkpoint.path}>
                    {checkpoint.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveCheckpoint} disabled={Boolean(pending) || runtime.running}>
                <SaveIcon />
                Save stopped runtime
              </Button>
              <Button
                variant="outline"
                onClick={restoreCheckpoint}
                disabled={Boolean(pending) || runtime.running || !selectedCheckpoint}
              >
                <RefreshCwIcon />
                Restore selected
              </Button>
            </div>
            {runtime.running ? (
              <p className="text-xs text-amber-300">Stop Terminus before saving or restoring. Live mutation is not serialized.</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Promotion gates" icon={ShieldCheckIcon}>
          <div className="divide-y">
            {gates.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-sm">{label}</span>
                <StatusBadge value={value || 'unavailable'} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Recent checkpoints" icon={ArchiveIcon} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Modified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checkpoints.slice(0, 12).map((checkpoint) => (
              <TableRow key={checkpoint.path}>
                <TableCell className="font-mono text-xs">{fileName(checkpoint.path)}</TableCell>
                <TableCell>{formatCompactNumber(checkpoint.size_bytes)} B</TableCell>
                <TableCell>{formatWhen(checkpoint.modified_at)}</TableCell>
              </TableRow>
            ))}
            {!checkpoints.length ? <EmptyTable colSpan={3} label="No checkpoints found." /> : null}
          </TableBody>
        </Table>
      </Panel>

      <Panel title="Recent traces" icon={MessageSquareTextIcon} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trace</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Query</TableHead>
              <TableHead>Mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traces.map((trace) => (
              <TableRow key={trace.trace_id}>
                <TableCell className="font-mono text-xs">{trace.trace_id?.slice(0, 12)}</TableCell>
                <TableCell>{formatWhen(trace.created_at)}</TableCell>
                <TableCell className="max-w-md truncate">{trace.request?.query_text || 'n/a'}</TableCell>
                <TableCell>{formatMode(trace.response?.mode || trace.response?.response_mode)}</TableCell>
              </TableRow>
            ))}
            {!traces.length ? <EmptyTable colSpan={4} label="No traces recorded." /> : null}
          </TableBody>
        </Table>
      </Panel>
    </div>
  )
}

function Panel({ children, flush = false, icon: Icon, title }) {
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  )
}

function MetricStrip({ children }) {
  return <div className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 xl:grid-cols-5">{children}</div>
}

function Metric({ detail, label, value }) {
  return (
    <div className="min-w-0 border-b p-4 last:border-b-0 sm:border-r xl:border-b-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{detail || 'n/a'}</div>
    </div>
  )
}

function DataGrid({ children }) {
  return <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
}

function Data({ label, value }) {
  return (
    <div className="min-w-0 border-b pb-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium tabular-nums">{value ?? 'n/a'}</dd>
    </div>
  )
}

function HeaderSignal({ active = true, children, connected, icon: Icon }) {
  const enabled = connected ?? active
  return (
    <div className={`hidden items-center gap-1.5 text-xs lg:flex ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
      <Icon className={`size-3.5 ${enabled ? 'text-emerald-400' : ''}`} />
      {children}
    </div>
  )
}

function StatusBadge({ value }) {
  const normalized = String(value || 'unknown').toLowerCase()
  const positive = ['alive', 'awake', 'ready', 'passed', 'current', 'running', 'sparse_responsive'].some((item) => normalized.includes(item))
  const negative = ['failed', 'dead', 'error', 'blocked', 'missing', 'unavailable'].some((item) => normalized.includes(item))
  return (
    <Badge variant={negative ? 'destructive' : positive ? 'default' : 'secondary'} className="max-w-64 truncate">
      {formatMode(value)}
    </Badge>
  )
}

function EmptyTable({ colSpan, label }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">{label}</TableCell>
    </TableRow>
  )
}

function EmptyState({ label }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <CheckCircle2Icon className="size-5" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

function yesNo(value) {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return 'n/a'
}

export default App
