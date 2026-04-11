import { lazy, Suspense, startTransition, useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIcon,
  AlertCircleIcon,
  ArchiveIcon,
  BarChart3Icon,
  BrainIcon,
  CpuIcon,
  FlaskConicalIcon,
  GraduationCapIcon,
  HistoryIcon,
  LayersIcon,
  LoaderCircleIcon,
  MessageSquareTextIcon,
  ShieldCheckIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react'

import { HelpTip, SectionFallback } from '@/components/dashboard/shared'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  DEFAULT_API_BASE,
  fileName,
  formatWhen,
  normalizeApiBase,
} from '@/lib/dashboard-utils'
import { requestJson } from '@/lib/service-api'

const OverviewSection = lazy(() => import('@/components/dashboard/OverviewSection'))
const AskSection = lazy(() => import('@/components/dashboard/AskSection'))
const RuntimeSection = lazy(() => import('@/components/dashboard/RuntimeSection'))
const CheckpointsSection = lazy(() => import('@/components/dashboard/CheckpointsSection'))
const TracesSection = lazy(() => import('@/components/dashboard/TracesSection'))
const ArchitectureSection = lazy(() => import('@/components/dashboard/ArchitectureSection'))
const AnimationSection = lazy(() => import('@/components/dashboard/AnimationSection'))
const GroundingProbeSection = lazy(() => import('@/components/dashboard/GroundingProbeSection'))
const DevelopmentalSection = lazy(() => import('@/components/dashboard/DevelopmentalSection'))

const SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: BarChart3Icon,
    help: 'Live summary cards and stable telemetry charts.',
  },
  {
    id: 'architecture',
    label: 'Architecture',
    icon: LayersIcon,
    help: 'SVG diagram of the active model layers and their configuration.',
  },
  {
    id: 'animation',
    label: 'Activity',
    icon: ActivityIcon,
    help: 'Live spike flow, column activations, neuromodulators, and memory state.',
  },
  {
    id: 'ask',
    label: 'Ask',
    icon: MessageSquareTextIcon,
    help: 'Inspect routing, evidence, and grounded answers.',
  },
  {
    id: 'grounding',
    label: 'Grounding',
    icon: FlaskConicalIcon,
    help: 'Run the 50-triple grounding probe and view concrete vs abstract accuracy.',
  },
  {
    id: 'runtime',
    label: 'Runtime',
    icon: CpuIcon,
    help: 'Model, memory, and routing internals for the active checkpoint.',
  },
  {
    id: 'developmental',
    label: 'Developmental',
    icon: GraduationCapIcon,
    help: 'Stage progress, plasticity mode, and maturity indicators.',
  },
  {
    id: 'checkpoints',
    label: 'Checkpoints',
    icon: ArchiveIcon,
    help: 'Save the current runtime or restore a stored snapshot.',
  },
  {
    id: 'traces',
    label: 'Traces',
    icon: HistoryIcon,
    help: 'Open stored traces and review prior requests, evidence, and routes.',
  },
]

const SECTION_TITLES = {
  overview: 'Loading overview',
  architecture: 'Loading architecture',
  animation: 'Loading activity monitor',
  ask: 'Loading ask workspace',
  grounding: 'Loading grounding probe',
  runtime: 'Loading runtime details',
  developmental: 'Loading developmental stages',
  checkpoints: 'Loading checkpoints',
  traces: 'Loading traces',
}

let sourceDraftCounter = 0

function nextSourceDraftId() {
  sourceDraftCounter += 1
  return `source-draft-${sourceDraftCounter}`
}

function createEmptySourceDraft() {
  return {
    draftId: nextSourceDraftId(),
    name: '',
    source: '',
    sourceType: 'auto',
    textField: 'text',
    hfConfig: '',
  }
}

function createEmptyBrainConfigDraft() {
  return {
    sourceBank: [createEmptySourceDraft()],
    candidateBank: [createEmptySourceDraft()],
    autonomyEnabled: false,
    autonomyPolicy: 'active',
    autonomyTriggerIntervalTokens: '4096',
    tickTokens: '128',
    sleepIntervalSeconds: '0.25',
    tickSteps: '1',
    repeatSources: true,
  }
}

function createSourceDraftFromRuntime(spec) {
  return {
    draftId: nextSourceDraftId(),
    name: spec?.name || '',
    source: spec?.source || '',
    sourceType: spec?.source_type || 'auto',
    textField: spec?.text_field || 'text',
    hfConfig: spec?.hf_config || '',
  }
}

function createBrainConfigDraftFromRuntime(runtime) {
  const configuredSourceBank = Array.isArray(runtime?.source_bank) ? runtime.source_bank : []
  const configuredCandidateBank = Array.isArray(runtime?.autonomy?.candidate_bank)
    ? runtime.autonomy.candidate_bank
    : []

  return {
    sourceBank: configuredSourceBank.length
      ? configuredSourceBank.map((item) => createSourceDraftFromRuntime(item))
      : [createEmptySourceDraft()],
    candidateBank: configuredCandidateBank.length
      ? configuredCandidateBank.map((item) => createSourceDraftFromRuntime(item))
      : [createEmptySourceDraft()],
    autonomyEnabled: Boolean(runtime?.autonomy?.enabled && configuredCandidateBank.length),
    autonomyPolicy: runtime?.autonomy?.policy || 'active',
    autonomyTriggerIntervalTokens: String(runtime?.autonomy?.trigger_interval_tokens ?? 4096),
    tickTokens: String(runtime?.tick_tokens ?? 128),
    sleepIntervalSeconds: String(runtime?.sleep_interval_seconds ?? 0.25),
    tickSteps: '1',
    repeatSources: Boolean(runtime?.repeat_sources ?? true),
  }
}

function createBrainConfigRuntimeSignature(runtime) {
  const configuredSourceBank = Array.isArray(runtime?.source_bank) ? runtime.source_bank : []
  const configuredCandidateBank = Array.isArray(runtime?.autonomy?.candidate_bank)
    ? runtime.autonomy.candidate_bank
    : []

  return JSON.stringify({
    sourceBank: configuredSourceBank.map((item) => ({
      name: item?.name || '',
      source: item?.source || '',
      sourceType: item?.source_type || 'auto',
      textField: item?.text_field || 'text',
      hfConfig: item?.hf_config || '',
    })),
    candidateBank: configuredCandidateBank.map((item) => ({
      name: item?.name || '',
      source: item?.source || '',
      sourceType: item?.source_type || 'auto',
      textField: item?.text_field || 'text',
      hfConfig: item?.hf_config || '',
    })),
    autonomyEnabled: Boolean(runtime?.autonomy?.enabled && configuredCandidateBank.length),
    autonomyPolicy: runtime?.autonomy?.policy || 'active',
    autonomyTriggerIntervalTokens: String(runtime?.autonomy?.trigger_interval_tokens ?? 4096),
    tickTokens: String(runtime?.tick_tokens ?? 128),
    sleepIntervalSeconds: String(runtime?.sleep_interval_seconds ?? 0.25),
    tickSteps: '1',
    repeatSources: Boolean(runtime?.repeat_sources ?? true),
  })
}

function normalizeDraftSource(entry, fallbackName) {
  const source = String(entry?.source || '').trim()
  if (!source) {
    return null
  }

  return {
    name: String(entry?.name || '').trim() || fallbackName,
    source,
    source_type: entry?.sourceType || 'auto',
    text_field: String(entry?.textField || '').trim() || 'text',
    hf_config: String(entry?.hfConfig || '').trim() || null,
  }
}

function parsePositiveInteger(value, fallback) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return fallback
  }

  const numericValue = Number.parseInt(trimmed, 10)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback
}

function parsePositiveFloat(value, fallback) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return fallback
  }

  const numericValue = Number.parseFloat(trimmed)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback
}

function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE)
  const [apiBaseInput, setApiBaseInput] = useState(DEFAULT_API_BASE)
  const [status, setStatus] = useState(null)
  const [checkpoints, setCheckpoints] = useState([])
  const [traces, setTraces] = useState([])
  const [selectedTraceId, setSelectedTraceId] = useState('')
  const [conversation, setConversation] = useState([])
  const [draft, setDraft] = useState('')
  const [contextText, setContextText] = useState('')
  const [autoLearn, setAutoLearn] = useState(true)
  const [brainConfig, setBrainConfigState] = useState(createEmptyBrainConfigDraft)
  const [brainConfigDirty, setBrainConfigDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [error, setError] = useState('')
  const [previewQuery, setPreviewQuery] = useState(null)
  const [previewResponse, setPreviewResponse] = useState(null)
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('')
  const [telemetryHistory, setTelemetryHistory] = useState([])
  const [streamConnected, setStreamConnected] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')
  const lastTraceIdRef = useRef('')
  const brainConfigSignatureRef = useRef('')
  const retryDelayRef = useRef(1000)
  const retryTimeoutRef = useRef(null)

  useEffect(() => {
    document.documentElement.classList.add('dark')

    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  useEffect(() => {
    setBrainConfigState(createEmptyBrainConfigDraft())
    setBrainConfigDirty(false)
    brainConfigSignatureRef.current = ''
  }, [apiBase])

  const setBrainConfig = useCallback((nextValue) => {
    setBrainConfigDirty(true)
    setBrainConfigState((current) => (
      typeof nextValue === 'function' ? nextValue(current) : nextValue
    ))
  }, [])

  const selectedTrace = traces.find((trace) => trace.trace_id === selectedTraceId) || null
  const activeQuery = previewQuery || selectedTrace?.query_result || null
  const activeResponse = previewResponse || selectedTrace?.response || null
  const brainRuntime = status?.terminus_runtime || null
  const checkpointMetadata = status?.checkpoint_metadata || {}
  const runtimeScope = status?.runtime_scope || {}
  const routingIndex = runtimeScope.routing_index || {}
  const weightDistribution = runtimeScope.weight_distribution || {}
  const columnInputWeights = weightDistribution.column_input_weights || {}
  const memoryStore = status?.memory_store || {}
  const checkpointName = fileName(selectedCheckpoint || status?.checkpoint_path)

  const telemetryData = telemetryHistory.map((item, index) => ({
    sample: index + 1,
    tokens: Number(item.token_count || 0),
    memoryFill: Number(item.memory_store?.slow_buffer_fill_fraction ?? item.memory_fill_fraction ?? 0),
    driftFloor: Number(item.drift_floor ?? item.drift ?? 0),
    dopamine: Number(item.dopamine ?? 0),
    serotonin: Number(item.serotonin ?? 0),
    acetylcholine: Number(item.acetylcholine ?? 0),
    norepinephrine: Number(item.norepinephrine ?? 0),
  }))

  useEffect(() => {
    if (!brainRuntime) {
      return
    }

    if (brainConfigDirty) {
      return
    }

    const nextSignature = createBrainConfigRuntimeSignature(brainRuntime)
    if (nextSignature === brainConfigSignatureRef.current) {
      return
    }

    brainConfigSignatureRef.current = nextSignature
    setBrainConfigState((current) => ({
      ...current,
      ...createBrainConfigDraftFromRuntime(brainRuntime),
    }))
  }, [brainConfigDirty, brainRuntime])

  const conversationEntries = conversation.length
    ? conversation
    : selectedTrace?.request?.query_text
      ? [
        {
          key: `${selectedTrace.trace_id}-user`,
          role: 'user',
          text: selectedTrace.request.query_text,
        },
        ...(selectedTrace.response?.response_text
          ? [{
            key: `${selectedTrace.trace_id}-assistant`,
            role: 'assistant',
            text: selectedTrace.response.response_text,
          }]
          : []),
      ]
      : []

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const [nextStatus, nextCheckpoints, nextTraces] = await Promise.all([
          requestJson(apiBase, '/status'),
          requestJson(apiBase, '/checkpoints'),
          requestJson(apiBase, '/traces?limit=20'),
        ])

        if (cancelled) {
          return
        }

        const nextTraceId = nextStatus.last_trace_id || nextTraces.traces?.[0]?.trace_id || ''

        startTransition(() => {
          setStatus(nextStatus)
          setCheckpoints(nextCheckpoints.checkpoints || [])
          setTraces(nextTraces.traces || [])
          setSelectedCheckpoint(nextStatus.checkpoint_path || nextCheckpoints.checkpoints?.[0]?.path || '')
          setSelectedTraceId(nextTraceId)
          setTelemetryHistory((history) => [...history, nextStatus].slice(-80))
        })

        lastTraceIdRef.current = nextTraceId
        setError('')
      } catch (err) {
        if (!cancelled) {
          setError(String(err.message || err))
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [apiBase])

  useEffect(() => {
    let source = null

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    const connect = () => {
      source = new EventSource(`${apiBase}/stream/status?interval=0.5`)

      source.addEventListener('status', (event) => {
        const payload = JSON.parse(event.data)
        retryDelayRef.current = 1000
        setStreamConnected(true)
        setError('')

        startTransition(() => {
          setStatus((current) => ({ ...(current || {}), ...payload }))
          setTelemetryHistory((history) => [...history, payload].slice(-80))
        })

        if (payload.last_trace_id && payload.last_trace_id !== lastTraceIdRef.current) {
          lastTraceIdRef.current = payload.last_trace_id
          refreshTraces(payload.last_trace_id)
        }
      })

      source.onerror = () => {
        setStreamConnected(false)
        setError((current) => current || 'The live status stream dropped. The page will keep trying to reconnect.')

        source.close()

        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }

        const delay = retryDelayRef.current
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null
          connect()
        }, delay)
        retryDelayRef.current = Math.min(delay * 2, 30000)
      }
    }

    connect()

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }

      source?.close()
    }
  }, [apiBase])

  async function refreshStatus() {
    try {
      const payload = await requestJson(apiBase, '/status')
      startTransition(() => {
        setStatus(payload)
        setSelectedCheckpoint((current) => current || payload.checkpoint_path || '')
      })
      return payload
    } catch (err) {
      setError(String(err.message || err))
      return null
    }
  }

  async function refreshTraces(nextTraceId = '') {
    try {
      const payload = await requestJson(apiBase, '/traces?limit=20')
      const nextTraces = payload.traces || []

      startTransition(() => {
        setTraces(nextTraces)
        setSelectedTraceId((current) => {
          if (nextTraceId) {
            return nextTraceId
          }

          if (current && nextTraces.some((trace) => trace.trace_id === current)) {
            return current
          }

          return nextTraces[0]?.trace_id || ''
        })
      })
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function refreshCheckpoints() {
    try {
      const payload = await requestJson(apiBase, '/checkpoints')
      startTransition(() => {
        setCheckpoints(payload.checkpoints || [])
      })
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  async function configureBrain() {
    const sourceBank = brainConfig.sourceBank
      .map((entry, index) => normalizeDraftSource(entry, `terminus_source_${index + 1}`))
      .filter(Boolean)
    if (!sourceBank.length) {
      return
    }

    const candidateBank = brainConfig.candidateBank
      .map((entry, index) => normalizeDraftSource(entry, `candidate_source_${index + 1}`))
      .filter(Boolean)

    setPendingAction('Configuring the Terminus runtime')
    setError('')

    try {
      await requestJson(apiBase, '/terminus/configure', {
        method: 'POST',
        body: JSON.stringify({
          source_bank: sourceBank,
          tick_tokens: parsePositiveInteger(brainConfig.tickTokens, 128),
          sleep_interval_seconds: parsePositiveFloat(brainConfig.sleepIntervalSeconds, 0.25),
          repeat_sources: Boolean(brainConfig.repeatSources),
          autonomy: brainConfig.autonomyEnabled && candidateBank.length
            ? {
              enabled: true,
              policy: brainConfig.autonomyPolicy || 'active',
              trigger_interval_tokens: parsePositiveInteger(brainConfig.autonomyTriggerIntervalTokens, 4096),
              candidate_bank: candidateBank,
            }
            : null,
        }),
      })

      setBrainConfigDirty(false)
      await refreshStatus()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAction('')
    }
  }

  async function startBrain() {
    setPendingAction('Starting the Terminus runtime')
    setError('')

    try {
      await requestJson(apiBase, '/terminus/start', { method: 'POST' })
      await refreshStatus()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAction('')
    }
  }

  async function stopBrain() {
    setPendingAction('Stopping the Terminus runtime')
    setError('')

    try {
      await requestJson(apiBase, '/terminus/stop', { method: 'POST' })
      await refreshStatus()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAction('')
    }
  }

  async function tickBrain() {
    setPendingAction('Advancing the Terminus runtime')
    setError('')

    try {
      await requestJson(apiBase, '/terminus/tick', {
        method: 'POST',
        body: JSON.stringify({
          steps: parsePositiveInteger(brainConfig.tickSteps, 1),
        }),
      })
      await refreshStatus()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAction('')
    }
  }

  function applyApiBase() {
    const nextValue = normalizeApiBase(apiBaseInput)
    setApiBaseInput(nextValue)
    setApiBase(nextValue)
  }

  async function runQuery() {
    if (!draft.trim()) {
      return
    }

    setPendingAction('Inspecting the route and memory matches')
    setError('')

    try {
      const payload = await requestJson(apiBase, '/query', {
        method: 'POST',
        body: JSON.stringify({
          query_text: draft.trim(),
          context_text: contextText || null,
          top_k_candidates: 6,
          top_k_memories: 6,
          top_chars: 6,
        }),
      })

      setPreviewQuery(payload)
      setPreviewResponse(null)
      setActiveSection('ask')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAction('')
    }
  }

  async function sendMessage(event) {
    event.preventDefault()

    if (!draft.trim()) {
      return
    }

    const text = draft.trim()
    setPendingAction('Producing an evidence-grounded answer')
    setError('')

    try {
      const bundle = await requestJson(apiBase, '/respond', {
        method: 'POST',
        body: JSON.stringify({
          query_text: text,
          context_text: contextText || null,
          learn_mode: autoLearn ? 'user_and_selected_evidence' : 'none',
          max_evidence_items: 3,
          top_k_candidates: 6,
          top_k_memories: 6,
          top_chars: 6,
        }),
      })

      setDraft('')
      setPreviewQuery(bundle.query_result)
      setPreviewResponse(bundle.response)
      setSelectedTraceId(bundle.trace_id)
      setActiveSection('ask')
      lastTraceIdRef.current = bundle.trace_id

      startTransition(() => {
        setConversation((items) => [
          ...items,
          { key: `${bundle.trace_id}-user`, role: 'user', text },
          {
            key: `${bundle.trace_id}-assistant`,
            role: 'assistant',
            text: bundle.response.response_text,
          },
        ])
      })

      await Promise.all([
        refreshTraces(bundle.trace_id),
        refreshCheckpoints(),
        refreshStatus(),
      ])
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAction('')
    }
  }

  async function saveCheckpoint() {
    setPendingAction('Saving a new checkpoint')
    setError('')

    try {
      const payload = await requestJson(apiBase, '/checkpoint/save', {
        method: 'POST',
        body: JSON.stringify({ path: null }),
      })

      setSelectedCheckpoint(payload.path)

      await Promise.all([
        refreshCheckpoints(),
        refreshStatus(),
      ])
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAction('')
    }
  }

  async function restoreCheckpoint() {
    if (!selectedCheckpoint) {
      return
    }

    setPendingAction('Restoring the selected checkpoint')
    setError('')

    try {
      await requestJson(apiBase, '/checkpoint/restore', {
        method: 'POST',
        body: JSON.stringify({ path: selectedCheckpoint }),
      })

      setBrainConfigDirty(false)
      brainConfigSignatureRef.current = ''
      setBrainConfigState(createEmptyBrainConfigDraft())
      setConversation([])
      setPreviewQuery(null)
      setPreviewResponse(null)

      await Promise.all([
        refreshStatus(),
        refreshCheckpoints(),
        refreshTraces(),
      ])
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAction('')
    }
  }

  function handleTraceSelection(traceId) {
    setSelectedTraceId(traceId)
    setPreviewQuery(null)
    setPreviewResponse(null)
    setActiveSection('traces')
    lastTraceIdRef.current = traceId
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function selectSection(id) {
    setActiveSection(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function renderActiveSection() {
    switch (activeSection) {
      case 'architecture':
        return (
          <ArchitectureSection
            apiBase={apiBase}
            animationData={status?.animation || null}
          />
        )
      case 'animation':
        return (
          <AnimationSection
            animationData={status?.animation || null}
            telemetry={status}
          />
        )
      case 'ask':
        return (
          <AskSection
            activeQuery={activeQuery}
            activeResponse={activeResponse}
            apiBase={apiBase}
            autoLearn={autoLearn}
            brainConfig={brainConfig}
            brainRuntime={brainRuntime}
            configureBrain={configureBrain}
            conversationEntries={conversationEntries}
            draft={draft}
            pendingAction={pendingAction}
            refreshStatus={refreshStatus}
            runQuery={runQuery}
            selectedTrace={selectedTrace}
            selectedTraceId={selectedTraceId}
            sendMessage={sendMessage}
            setAutoLearn={setAutoLearn}
            setBrainConfig={setBrainConfig}
            setDraft={setDraft}
            startBrain={startBrain}
            stopBrain={stopBrain}
            tickBrain={tickBrain}
          />
        )
      case 'grounding':
        return (
          <GroundingProbeSection apiBase={apiBase} />
        )
      case 'runtime':
        return (
          <RuntimeSection
            checkpointMetadata={checkpointMetadata}
            columnInputWeights={columnInputWeights}
            memoryStore={memoryStore}
            routingIndex={routingIndex}
            runtimeScope={runtimeScope}
            status={status}
            weightDistribution={weightDistribution}
          />
        )
      case 'developmental':
        return (
          <DevelopmentalSection
            runtimeScope={runtimeScope}
            status={status}
          />
        )
      case 'checkpoints':
        return (
          <CheckpointsSection
            checkpoints={checkpoints}
            pendingAction={pendingAction}
            restoreCheckpoint={restoreCheckpoint}
            saveCheckpoint={saveCheckpoint}
            selectedCheckpoint={selectedCheckpoint}
            setSelectedCheckpoint={setSelectedCheckpoint}
            status={status}
          />
        )
      case 'traces':
        return (
          <TracesSection
            handleTraceSelection={handleTraceSelection}
            selectedTrace={selectedTrace}
            selectedTraceId={selectedTraceId}
            status={status}
            traces={traces}
          />
        )
      case 'overview':
      default:
        return (
          <OverviewSection
            activeResponse={activeResponse}
            checkpointName={checkpointName}
            memoryStore={memoryStore}
            status={status}
            telemetryData={telemetryData}
          />
        )
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader className="gap-3 border-b border-sidebar-border/70">
            <button
              type="button"
              onClick={() => selectSection('overview')}
              className="flex w-full items-start gap-3 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/35 p-3 text-left transition-colors hover:bg-sidebar-accent/55"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <BrainIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <div className="font-medium">HECSN console</div>
                <div className="text-xs leading-5 text-sidebar-foreground/70">
                  Evidence-first chat, Terminus control, and checkpoint state.
                </div>
              </div>
            </button>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {SECTIONS.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        type="button"
                        isActive={activeSection === item.id}
                        onClick={() => selectSection(item.id)}
                        tooltip={item.help}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.id === 'checkpoints' ? <SidebarMenuBadge>{checkpoints.length}</SidebarMenuBadge> : null}
                      {item.id === 'traces' ? <SidebarMenuBadge>{status?.trace_history_size ?? traces.length}</SidebarMenuBadge> : null}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Quick read</SidebarGroupLabel>
              <SidebarGroupContent className="px-2 pb-2">
                <div className="space-y-3 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/25 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sidebar-foreground/70">Connection</span>
                    <Badge variant={streamConnected ? 'secondary' : 'destructive'}>
                      {streamConnected ? 'live' : 'reconnecting'}
                    </Badge>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="shrink-0 text-sidebar-foreground/70">Checkpoint</span>
                    <span className="truncate font-medium">{checkpointName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sidebar-foreground/70">Tokens</span>
                    <span className="font-medium">{status?.token_count?.toLocaleString() || 'n/a'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sidebar-foreground/70">Terminus loop</span>
                    <span className="font-medium">
                      {brainRuntime?.running ? 'running' : brainRuntime?.configured ? 'idle' : 'unconfigured'}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="shrink-0 text-sidebar-foreground/70">Last trace</span>
                    <span className="truncate font-medium">{formatWhen(status?.last_trace_created_at)}</span>
                  </div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarSeparator />

          <SidebarFooter>
            <div className="space-y-2 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/15 p-3 text-xs text-sidebar-foreground/75">
              <div className="flex items-center gap-2 font-medium text-sidebar-foreground">
                <ShieldCheckIcon className="size-3.5" />
                Strict evidence mode
              </div>
              <p className="leading-5">
                Replies should only go out when the retrieved memory gives enough support.
              </p>
            </div>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-20 border-b bg-background/92 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 md:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <SidebarTrigger className="mt-0.5" />
                    <div className="space-y-1">
                      <h1 className="text-xl font-medium tracking-tight">HECSN service workspace</h1>
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        Ask questions, inspect the selected route, manage the Terminus runtime, and save checkpoints without losing the evidence trail.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={streamConnected ? 'secondary' : 'destructive'}>
                      {streamConnected ? <WifiIcon className="size-3.5" /> : <WifiOffIcon className="size-3.5" />}
                      {streamConnected ? 'Status stream live' : 'Status stream reconnecting'}
                    </Badge>
                    <Badge variant={status?.dirty_state ? 'outline' : 'secondary'}>
                      {status?.dirty_state ? 'Unsaved runtime changes' : 'Runtime matches the checkpoint'}
                    </Badge>
                    <Badge variant={status?.context_supported ? 'secondary' : 'outline'}>
                      {status?.context_supported ? 'Context routing available' : 'No context routing in this checkpoint'}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-3 lg:min-w-[40rem] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      API base
                      <HelpTip>Where the frontend sends requests. Leave the default local address unless the backend moved.</HelpTip>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={apiBaseInput}
                        onChange={(event) => setApiBaseInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            applyApiBase()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={applyApiBase}
                        disabled={normalizeApiBase(apiBaseInput) === apiBase}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      Context text
                      <HelpTip>Optional extra hints that ride along with the next query. Use this to narrow the search space.</HelpTip>
                    </div>
                    <Input
                      value={contextText}
                      onChange={(event) => setContextText(event.target.value)}
                      placeholder="Optional context for the next request"
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
            {error ? (
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertTitle>Service error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {pendingAction ? (
              <Alert>
                <LoaderCircleIcon className="size-4 animate-spin" />
                <AlertTitle>Working</AlertTitle>
                <AlertDescription>{pendingAction}</AlertDescription>
              </Alert>
            ) : null}

            <Suspense fallback={<SectionFallback title={SECTION_TITLES[activeSection]} />}>
              {renderActiveSection()}
            </Suspense>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export default App
