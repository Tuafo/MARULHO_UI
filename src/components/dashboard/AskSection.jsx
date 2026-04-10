import { useState, useEffect, useCallback } from 'react'
import {
  AlertCircleIcon,
  MessageSquareTextIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  SquareIcon,
  Trash2Icon,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { fixedUnitDomain, formatFloat, formatPercent, formatMode, responseModeVariant } from '@/lib/dashboard-utils'
import { cn } from '@/lib/utils'
import { DetailItem, EmptyState, HelpTip, SectionHeading } from '@/components/dashboard/shared'

const CHART_CLASS = 'h-[220px] w-full aspect-auto'

const CANDIDATE_CHART_CONFIG = {
  similarity: {
    label: 'Similarity',
    color: 'var(--chart-1)',
  },
}

const EVIDENCE_CHART_CONFIG = {
  similarity: {
    label: 'Evidence similarity',
    color: 'var(--chart-3)',
  },
}

function QuickStartCard({ apiBase, brainRuntime, pendingAction, quickStarting, quickStartError, setQuickStarting, setQuickStartError, stopBrain, refreshStatus }) {
  const [presets, setPresets] = useState([])
  const [selectedPreset, setSelectedPreset] = useState('wikipedia')

  useEffect(() => {
    if (!apiBase) return
    fetch(`${apiBase}/terminus/presets`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPresets(data) })
      .catch(() => {})
  }, [apiBase])

  const handleQuickStart = useCallback(async () => {
    setQuickStarting(true)
    setQuickStartError('')
    try {
      const resp = await fetch(`${apiBase}/terminus/quick-start?preset=${encodeURIComponent(selectedPreset)}`, { method: 'POST' })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.detail || `HTTP ${resp.status}`)
      }
      if (refreshStatus) refreshStatus()
    } catch (err) {
      setQuickStartError(err.message || 'Quick start failed')
    } finally {
      setQuickStarting(false)
    }
  }, [apiBase, selectedPreset, setQuickStarting, setQuickStartError, refreshStatus])

  const isRunning = brainRuntime?.running
  const selectedInfo = presets.find((p) => p.id === selectedPreset)

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide">
        <PlayIcon className="size-3.5" /> Quick Start
      </div>
      <div className="flex items-center gap-2">
        <Select value={selectedPreset} onValueChange={setSelectedPreset} disabled={isRunning || quickStarting}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <SelectValue placeholder="Choose preset…" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label} ({p.source_count} src{p.source_count > 1 ? 's' : ''})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isRunning ? (
          <Button variant="destructive" size="sm" onClick={stopBrain} disabled={Boolean(pendingAction)}>
            <SquareIcon className="mr-1 size-3.5" /> Stop
          </Button>
        ) : (
          <Button size="sm" onClick={handleQuickStart} disabled={quickStarting || Boolean(pendingAction)}>
            <PlayIcon className="mr-1 size-3.5" /> {quickStarting ? 'Starting…' : 'Start Training'}
          </Button>
        )}
      </div>
      {selectedInfo && !isRunning ? (
        <p className="text-xs text-muted-foreground">{selectedInfo.description}</p>
      ) : null}
      {isRunning ? (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-green-500 animate-pulse" /> Live</span>
          <span>Ticks: {brainRuntime?.tick_count ?? 0}</span>
          <span>Tokens: {brainRuntime?.tokens_trained ?? 0}</span>
          {brainRuntime?.last_tick_duration_ms != null ? <span>Last tick: {formatFloat(brainRuntime.last_tick_duration_ms, 1)}ms</span> : null}
        </div>
      ) : null}
      {quickStartError ? (
        <Alert variant="destructive" className="py-2">
          <AlertCircleIcon className="size-3.5" />
          <AlertDescription className="text-xs">{quickStartError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

export default function AskSection({
  activeQuery,
  activeResponse,
  apiBase,
  autoLearn,
  brainConfig,
  brainRuntime,
  configureBrain,
  conversationEntries,
  draft,
  pendingAction,
  refreshStatus,
  runQuery,
  selectedTrace,
  selectedTraceId,
  sendMessage,
  setAutoLearn,
  setBrainConfig,
  setDraft,
  startBrain,
  stopBrain,
  tickBrain,
}) {
  const [quickStarting, setQuickStarting] = useState(false)
  const [quickStartError, setQuickStartError] = useState('')
  const candidateData = (activeQuery?.query_summary?.top_candidates || []).map((candidate) => ({
    label: `C${candidate.column_id}`,
    shard: `Shard ${candidate.shard_id}`,
    similarity: Number(candidate.similarity || 0),
  }))
  const nativeDecode = activeQuery?.query_summary?.native_decode || null
  const conceptSummary = activeQuery?.concept_summary || null
  const conceptEntries = conceptSummary?.concepts || []
  const responseConceptGrounding = activeResponse?.concept_grounding || null
  const responseConceptEntries = responseConceptGrounding?.selected_concepts || []
  const sourceProgress = brainRuntime?.source_progress || []
  const primarySourceProgress = sourceProgress[0] || null
  const lastAutonomy = brainRuntime?.autonomy?.last_acquisition_summary || null
  const sourceBankDraft = brainConfig?.sourceBank || []
  const candidateBankDraft = brainConfig?.candidateBank || []
  const canConfigureTerminus = sourceBankDraft.some((entry) => String(entry?.source || '').trim())

  const evidenceData = (activeResponse?.selected_evidence || []).map((item) => ({
    label: `#${item.memory_index}`,
    similarity: Number(item.similarity || 0),
    text: item.text,
  }))

  function createEmptySourceEntry() {
    return {
      name: '',
      source: '',
      sourceType: 'auto',
      textField: 'text',
      hfConfig: '',
    }
  }

  function updateBrainConfig(field, value) {
    setBrainConfig((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateSourceEntry(section, index, field, value) {
    setBrainConfig((current) => {
      const nextEntries = [...(current?.[section] || [createEmptySourceEntry()])]
      nextEntries[index] = {
        ...(nextEntries[index] || createEmptySourceEntry()),
        [field]: value,
      }
      return {
        ...current,
        [section]: nextEntries,
      }
    })
  }

  function addSourceEntry(section) {
    setBrainConfig((current) => ({
      ...current,
      [section]: [...(current?.[section] || []), createEmptySourceEntry()],
    }))
  }

  function removeSourceEntry(section, index) {
    setBrainConfig((current) => {
      const nextEntries = [...(current?.[section] || [])]
      nextEntries.splice(index, 1)
      return {
        ...current,
        [section]: nextEntries.length ? nextEntries : [createEmptySourceEntry()],
      }
    })
  }

  function renderSourceBank(section, entries, title, description, addLabel) {
    return (
      <div className="space-y-3 rounded-lg border bg-background/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">{title}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => addSourceEntry(section)} disabled={Boolean(pendingAction)}>
            <PlusIcon className="size-4" />
            {addLabel}
          </Button>
        </div>

        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div key={entry?.draftId || `${section}-${index}`} className="space-y-3 rounded-lg border bg-background/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-muted-foreground">{title} #{index + 1}</div>
                {entries.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSourceEntry(section, index)} disabled={Boolean(pendingAction)}>
                    <Trash2Icon className="size-4" />
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Name</div>
                  <Input
                    value={entry?.name || ''}
                    onChange={(event) => updateSourceEntry(section, index, 'name', event.target.value)}
                    placeholder={section === 'sourceBank' ? `terminus_source_${index + 1}` : `candidate_source_${index + 1}`}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <div className="text-xs font-medium text-muted-foreground">Source</div>
                  <Input
                    value={entry?.source || ''}
                    onChange={(event) => updateSourceEntry(section, index, 'source', event.target.value)}
                    placeholder="Path, URL, or dataset id"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Source type</div>
                  <Select value={entry?.sourceType || 'auto'} onValueChange={(value) => updateSourceEntry(section, index, 'sourceType', value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">auto</SelectItem>
                      <SelectItem value="file">file</SelectItem>
                      <SelectItem value="web">web</SelectItem>
                      <SelectItem value="hf">hf</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Text field</div>
                  <Input
                    value={entry?.textField || 'text'}
                    onChange={(event) => updateSourceEntry(section, index, 'textField', event.target.value)}
                    placeholder="text"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">HF config</div>
                  <Input
                    value={entry?.hfConfig || ''}
                    onChange={(event) => updateSourceEntry(section, index, 'hfConfig', event.target.value)}
                    placeholder="optional"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section id="ask" className="space-y-4">
      <SectionHeading
        title="Ask and inspect"
        description="Write a prompt, inspect the selected route, and see why the current answer was accepted or rejected."
        badge={<Badge variant="outline">trace {selectedTraceId ? selectedTraceId.slice(0, 8) : 'none'}</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Ask the checkpoint</CardTitle>
            <CardDescription>Send a message or inspect the route before asking for a full response.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <ShieldCheckIcon className="size-4" />
              <AlertTitle>Evidence-first replies</AlertTitle>
              <AlertDescription>
                The answer path only tries to speak when retrieved evidence overlaps enough with the prompt. Thin support should end in a refusal.
              </AlertDescription>
            </Alert>

            <form className="space-y-4" onSubmit={sendMessage}>
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-sm font-medium">
                  Message
                  <HelpTip>This is the text the system will use to search memory and, if you respond, build an answer. Clear, specific questions usually work better than broad ones.</HelpTip>
                </div>
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask the loaded checkpoint something grounded in its memory."
                  className="min-h-40"
                />
              </div>

              <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={autoLearn} onCheckedChange={(checked) => setAutoLearn(Boolean(checked))} />
                  <span className="space-y-1">
                    <span className="font-medium">Learn from the user text and selected evidence</span>
                    <span className="block text-muted-foreground">
                      Keeps the latest grounded exchange in memory for later retrieval.
                    </span>
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={runQuery} disabled={Boolean(pendingAction) || !draft.trim()}>
                    <SearchIcon className="size-4" />
                    Inspect route
                  </Button>
                  <Button type="submit" disabled={Boolean(pendingAction) || !draft.trim()}>
                    <MessageSquareTextIcon className="size-4" />
                    Respond
                  </Button>
                </div>
              </div>
            </form>

            <Separator />

            <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 text-sm font-medium">
                  Terminus runtime
                  <HelpTip>Configure a source stream, then start, stop, or tick the background Terminus loop. The same controls are exposed by the service under /terminus/*.</HelpTip>
                </div>
                <Badge variant={brainRuntime?.running ? 'secondary' : 'outline'}>
                  {brainRuntime?.running ? 'running' : brainRuntime?.configured ? 'configured' : 'unconfigured'}
                </Badge>
              </div>

              <QuickStartCard
                apiBase={apiBase}
                brainRuntime={brainRuntime}
                pendingAction={pendingAction}
                quickStarting={quickStarting}
                quickStartError={quickStartError}
                setQuickStarting={setQuickStarting}
                setQuickStartError={setQuickStartError}
                stopBrain={stopBrain}
                refreshStatus={refreshStatus}
              />

              {brainRuntime?.last_error ? (
                <Alert variant="destructive">
                  <AlertCircleIcon className="size-4" />
                  <AlertTitle>Terminus runtime error</AlertTitle>
                  <AlertDescription>{brainRuntime.last_error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Tick tokens</div>
                  <Input type="number" min="1" max="20000" value={brainConfig.tickTokens} onChange={(event) => updateBrainConfig('tickTokens', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Sleep seconds</div>
                  <Input type="number" min="0.01" step="0.01" max="60" value={brainConfig.sleepIntervalSeconds} onChange={(event) => updateBrainConfig('sleepIntervalSeconds', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Tick steps</div>
                  <Input type="number" min="1" max="128" value={brainConfig.tickSteps} onChange={(event) => updateBrainConfig('tickSteps', event.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Autonomy trigger</div>
                  <Input
                    type="number"
                    min="1"
                    max="200000"
                    value={brainConfig.autonomyTriggerIntervalTokens}
                    onChange={(event) => updateBrainConfig('autonomyTriggerIntervalTokens', event.target.value)}
                    disabled={!brainConfig.autonomyEnabled}
                  />
                </div>
                <label className="flex items-start gap-3 rounded-lg border bg-background/60 p-3 text-sm md:col-span-2 xl:col-span-2">
                  <Checkbox checked={Boolean(brainConfig.repeatSources)} onCheckedChange={(checked) => updateBrainConfig('repeatSources', Boolean(checked))} />
                  <span className="space-y-1">
                    <span className="font-medium">Repeat sources when they exhaust</span>
                    <span className="block text-muted-foreground">
                      Leave this on for a continuous loop over finite local sources. Turn it off to let the current bank run dry.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border bg-background/60 p-3 text-sm md:col-span-2 xl:col-span-2">
                  <Checkbox checked={Boolean(brainConfig.autonomyEnabled)} onCheckedChange={(checked) => updateBrainConfig('autonomyEnabled', Boolean(checked))} />
                  <span className="space-y-1">
                    <span className="font-medium">Enable internal active acquisition</span>
                    <span className="block text-muted-foreground">
                      Terminus will probe its candidate bank when the trigger interval is reached and acquire from the source it expects to reduce the current gap.
                    </span>
                  </span>
                </label>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Autonomy policy</div>
                  <Select value={brainConfig.autonomyPolicy || 'active'} onValueChange={(value) => updateBrainConfig('autonomyPolicy', value)} disabled={!brainConfig.autonomyEnabled}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="round_robin">round_robin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {renderSourceBank(
                'sourceBank',
                sourceBankDraft,
                'Source bank',
                'Each configured source feeds the background Terminus loop. Keep several sources here to maintain a broader unlabeled stream.',
                'Add source'
              )}

              {brainConfig.autonomyEnabled ? renderSourceBank(
                'candidateBank',
                candidateBankDraft,
                'Candidate bank',
                'These sources are only used for internal information seeking when Terminus decides it needs more evidence.',
                'Add candidate'
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-3">
                <div className="text-sm text-muted-foreground">
                  The configured source bank feeds unlabeled character streams into the current checkpoint. If autonomy is configured, the runtime can also trigger active acquisition from its candidate bank.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={configureBrain} disabled={Boolean(pendingAction) || !canConfigureTerminus}>
                    Save runtime
                  </Button>
                  <Button type="button" variant="outline" onClick={tickBrain} disabled={Boolean(pendingAction) || !brainRuntime?.configured}>
                    Tick Terminus
                  </Button>
                  {brainRuntime?.running ? (
                    <Button type="button" variant="outline" onClick={stopBrain} disabled={Boolean(pendingAction)}>
                      Stop loop
                    </Button>
                  ) : (
                    <Button type="button" onClick={startBrain} disabled={Boolean(pendingAction) || !brainRuntime?.configured}>
                      Start loop
                    </Button>
                  )}
                </div>
              </div>

              {brainRuntime?.configured ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailItem label="Configured sources" value={brainRuntime?.source_bank?.length ?? 0} help="How many sources are currently wired into the background loop." />
                  <DetailItem label="Background tokens" value={brainRuntime?.background_tokens_processed ?? 'n/a'} help="How many tokens the background loop has fed into the checkpoint since the current source bank was configured." />
                  <DetailItem label="Tick count" value={brainRuntime?.tick_count ?? 'n/a'} help="How many background ticks the Terminus loop has completed on the current configuration." />
                  <DetailItem label="Primary source" value={primarySourceProgress?.name || brainRuntime?.source_bank?.[0]?.name || 'n/a'} help="Which source is currently first in the configured source bank." />
                  <DetailItem label="Primary progress" value={primarySourceProgress?.tokens_processed ?? 'n/a'} help="How many tokens the first configured source has contributed so far." />
                  <DetailItem label="Next source" value={brainRuntime?.next_source_name || 'n/a'} help="Which source the round-robin loop will try next." />
                  <DetailItem label="Last event" value={brainRuntime?.last_event?.type || 'n/a'} help="The most recent Terminus-runtime state transition or tick result." />
                  <DetailItem label="Last tick tokens" value={brainRuntime?.last_tick_token_delta ?? 'n/a'} help="How many training tokens the last completed tick contributed across source streaming and any triggered autonomy work." />
                  <DetailItem label="Last tick ms" value={brainRuntime?.last_tick_duration_ms != null ? formatFloat(brainRuntime.last_tick_duration_ms, 2) : 'n/a'} help="Wall-clock duration of the most recent completed Terminus tick." />
                  <DetailItem label="Autonomy policy" value={brainRuntime?.autonomy?.policy || 'disabled'} help="The active information-seeking policy currently attached to Terminus, if any." />
                  <DetailItem label="Autonomy trigger" value={brainRuntime?.autonomy?.enabled ? (brainRuntime?.autonomy?.trigger_ready ? 'ready' : `${brainRuntime?.autonomy?.tokens_until_trigger ?? 'n/a'} tokens`) : 'disabled'} help="How close Terminus is to the next internal active-acquisition cycle." />
                  <DetailItem label="Last acquisition" value={lastAutonomy?.acquired_sources?.join(', ') || 'n/a'} help="Sources selected by the most recent autonomous acquisition cycle." />
                  <DetailItem label="Recent events" value={brainRuntime?.recent_events?.length ?? 0} help="Rolling history of the latest runtime transitions and tick summaries exposed by the service." />
                </div>
              ) : (
                <EmptyState title="Terminus runtime not configured" description="Save a source above to turn this checkpoint into a continuously learning Terminus runtime." />
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 text-sm font-medium">
                  Conversation
                  <HelpTip>Shows the current browser conversation, or the selected stored trace if the current session is empty. Use it to compare your prompt with the system answer.</HelpTip>
                </div>
                {selectedTrace?.response?.response_mode ? (
                  <Badge variant={responseModeVariant(selectedTrace.response.response_mode)}>
                    {formatMode(selectedTrace.response.response_mode)}
                  </Badge>
                ) : null}
              </div>

              <ScrollArea className="h-[340px] rounded-lg border bg-muted/10">
                <div className="space-y-3 p-4">
                  {!conversationEntries.length ? (
                    <EmptyState
                      title="No conversation yet"
                      description="Run an inspect or respond action to populate this area."
                    />
                  ) : conversationEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className={cn(
                        'rounded-lg border p-3',
                        entry.role === 'assistant' ? 'bg-muted/25' : 'bg-background'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.role === 'assistant' ? 'secondary' : 'outline'}>
                          {entry.role === 'assistant' ? 'HECSN' : 'User'}
                        </Badge>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{entry.text}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Why the current result looks this way</CardTitle>
            <CardDescription>Read the route choice, evidence support, and token-level hints behind the latest result.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="routing">Routing</TabsTrigger>
                <TabsTrigger value="chars">Chars</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                {!activeQuery ? (
                  <EmptyState title="No query loaded" description="Run Inspect route or Respond to see the current route summary." />
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailItem
                        label="Winner column"
                        value={activeQuery.query_summary?.winner_column ?? 'n/a'}
                        help="The routing column that matched your prompt best. The number itself does not matter much; similar prompts should usually hit similar winners."
                      />
                      <DetailItem
                        label="Winner shard"
                        value={activeQuery.query_summary?.winner_shard ?? 'n/a'}
                        help="The shard that held the winning route. The shard number is not important by itself."
                      />
                      <DetailItem
                        label="Query window"
                        value={activeQuery.query_summary?.query_window || 'n/a'}
                        mono
                        help="The exact slice of your prompt that was encoded for retrieval. If the important part is missing here, results will usually be worse."
                      />
                      <DetailItem
                        label="Reconstruction error"
                        value={formatFloat(activeQuery.query_summary?.reconstruction_error, 3)}
                        help="How well the system could rebuild the encoded query. Lower is better."
                      />
                      <DetailItem
                        label="Response mode"
                        value={activeResponse?.response_mode ? <Badge variant={responseModeVariant(activeResponse.response_mode)}>{formatMode(activeResponse.response_mode)}</Badge> : 'n/a'}
                        help="How the answer was formed. Quote stays closest to the evidence, stitch combines evidence pieces, and insufficient evidence means the system chose not to guess."
                      />
                      <DetailItem
                        label="Support score"
                        value={activeResponse ? formatPercent(activeResponse.support_score, 0) : 'n/a'}
                        help="How much of the answer is backed by retrieved evidence. Higher is better. Over 70% is strong, 40% to 70% is mixed, and under 40% usually means the answer is stretching."
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        Unsupported terms
                        <HelpTip>Words from your prompt that were not well supported by the chosen evidence. A long list here usually means weaker grounding.</HelpTip>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeResponse?.unsupported_terms?.length
                          ? activeResponse.unsupported_terms.map((term) => (
                            <Badge key={term} variant="destructive">{term}</Badge>
                          ))
                          : <Badge variant="secondary">none</Badge>}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        Concept snapshot
                        <HelpTip>Learned concept clusters built from retrieved memory traces. They expose current support, observation count, uncertainty, and drift instead of only token grouping.</HelpTip>
                      </div>
                      {!conceptEntries.length ? (
                        <Badge variant="outline">No concept summary for the current query.</Badge>
                      ) : (
                        <div className="space-y-3">
                          {conceptEntries.map((concept) => (
                            <div key={concept.label} className="rounded-lg border bg-background/60 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{concept.label}</Badge>
                                <span className="text-xs text-muted-foreground">score {formatFloat(concept.score, 3)}</span>
                                <span className="text-xs text-muted-foreground">{concept.match_count} windows</span>
                                <span className="text-xs text-muted-foreground">obs {concept.observations ?? 0}</span>
                                <span className="text-xs text-muted-foreground">uncertainty {formatFloat(concept.uncertainty, 2)}</span>
                                <span className="text-xs text-muted-foreground">drift {formatFloat(concept.drift, 2)}</span>
                              </div>
                              {concept.top_terms?.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {concept.top_terms.map((term) => (
                                    <Badge key={`${concept.label}-${term}`} variant="outline">{term}</Badge>
                                  ))}
                                </div>
                              ) : null}
                              {concept.example_windows?.[0] ? (
                                <p className="mt-3 text-sm leading-6 text-muted-foreground">{concept.example_windows[0]}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        Current answer text
                        <HelpTip>The answer linked to the current trace or preview. Read it together with Response mode and Support score.</HelpTip>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {activeResponse?.response_text || 'No response text is attached to the current selection.'}
                      </p>
                    </div>

                    <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        Response concept grounding
                        <HelpTip>Concepts actually touched by the selected evidence. This is narrower than the query snapshot because it only tracks what the responder used.</HelpTip>
                      </div>
                      {!responseConceptEntries.length ? (
                        <Badge variant="outline">No concept-grounding metadata is attached to the current response.</Badge>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <DetailItem label="Focus concept" value={responseConceptGrounding?.focus_label || 'n/a'} help="The dominant concept cluster among the evidence snippets that were actually selected for the answer." />
                            <DetailItem label="Query concept coverage" value={formatPercent(responseConceptGrounding?.query_concept_coverage, 0)} help="How much of the current query concept snapshot was covered by the selected evidence concepts." />
                          </div>
                          <div className="space-y-3">
                            {responseConceptEntries.map((concept) => (
                              <div key={concept.label} className="rounded-lg border bg-background/60 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">{concept.label}</Badge>
                                  <span className="text-xs text-muted-foreground">evidence {concept.evidence_count}</span>
                                  <span className="text-xs text-muted-foreground">score {formatFloat(concept.score, 3)}</span>
                                  <span className="text-xs text-muted-foreground">obs {concept.observations ?? 0}</span>
                                  <span className="text-xs text-muted-foreground">uncertainty {formatFloat(concept.uncertainty, 2)}</span>
                                </div>
                                {concept.top_terms?.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {concept.top_terms.map((term) => (
                                      <Badge key={`${concept.label}-${term}`} variant="outline">{term}</Badge>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {nativeDecode?.available ? (
                      <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          Native assembly decode
                          <HelpTip>
                            A short reconstruction built by stitching overlapping raw windows from the nearest assembly memories. It stays grounded in stored character traces rather than using a separate text generator.
                          </HelpTip>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <DetailItem
                            label="Decode confidence"
                            value={formatPercent(nativeDecode.confidence, 0)}
                            help="Higher means the reconstruction came from strong overlap between nearby remembered windows."
                          />
                          <DetailItem
                            label="Query overlap"
                            value={formatPercent(nativeDecode.query_overlap_ratio, 0)}
                            help="How much of the decoded text still overlaps with the current query window."
                          />
                          <DetailItem
                            label="Source memories"
                            value={nativeDecode.source_memory_indices?.length || 0}
                            help="How many stored memory windows were used in the stitched decode."
                          />
                        </div>

                        <p className="whitespace-pre-wrap text-sm leading-6">{nativeDecode.decoded_text}</p>

                        {nativeDecode.continuation_text ? (
                          <p className="text-sm text-muted-foreground">
                            Continuation beyond the query window: {nativeDecode.continuation_text}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </TabsContent>

              <TabsContent value="evidence" className="space-y-4">
                {!evidenceData.length ? (
                  <EmptyState title="No selected evidence" description="The evidence chart appears after a response chooses support items." />
                ) : (
                  <>
                    <Card size="sm" className="bg-muted/10">
                      <CardHeader>
                        <CardTitle>Evidence support chart</CardTitle>
                        <CardDescription>Similarity of the evidence snippets used in the current answer.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={EVIDENCE_CHART_CONFIG} className={CHART_CLASS}>
                          <BarChart data={evidenceData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickLine={false} axisLine={false} width={64} domain={fixedUnitDomain()} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="similarity" fill="var(--color-similarity)" radius={6} />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>

                    <ScrollArea className="h-[250px] rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Memory</TableHead>
                            <TableHead>Similarity</TableHead>
                            <TableHead>Concepts</TableHead>
                            <TableHead className="whitespace-normal">Text</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeResponse.selected_evidence.map((item, index) => (
                            <TableRow key={`${item.memory_index}-${index}`}>
                              <TableCell>#{item.memory_index}</TableCell>
                              <TableCell>{formatFloat(item.similarity, 3)}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {item.concept_labels?.length
                                    ? item.concept_labels.map((label) => (
                                      <Badge key={`${item.memory_index}-${label}`} variant="outline">{label}</Badge>
                                    ))
                                    : <Badge variant="secondary">none</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-normal break-words leading-6">{item.text}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="routing" className="space-y-4">
                {!candidateData.length ? (
                  <EmptyState title="No routing candidates" description="Inspect the route or run a response to see the current candidate stack." />
                ) : (
                  <>
                    <Card size="sm" className="bg-muted/10">
                      <CardHeader>
                        <CardTitle>Routing chart</CardTitle>
                        <CardDescription>The best matching columns and how similar they were to the active query window.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={CANDIDATE_CHART_CONFIG} className={CHART_CLASS}>
                          <BarChart data={candidateData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickLine={false} axisLine={false} width={64} domain={fixedUnitDomain()} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="similarity" fill="var(--color-similarity)" radius={6} />
                          </BarChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>

                    <ScrollArea className="h-[250px] rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Column</TableHead>
                            <TableHead>Shard</TableHead>
                            <TableHead>Similarity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeQuery.query_summary.top_candidates.map((candidate) => (
                            <TableRow key={`${candidate.column_id}-${candidate.shard_id}`}>
                              <TableCell>{candidate.column_id}</TableCell>
                              <TableCell>{candidate.shard_id}</TableCell>
                              <TableCell>{formatFloat(candidate.similarity, 3)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="chars" className="space-y-4">
                {!activeQuery ? (
                  <EmptyState title="No character hints yet" description="Run an inspect or respond action to see the top weighted characters." />
                ) : (
                  <>
                    <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        Top query characters
                        <HelpTip>The characters that carried the most weight when the prompt was encoded. This is mostly for debugging odd prompts or tokenization problems.</HelpTip>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(activeQuery.query_summary?.top_query_chars || []).map((item) => (
                          <Badge key={`${item.ord}-${item.char}`} variant="secondary">
                            {item.char.replace('<space>', 'space').replace('<newline>', 'newline')} {formatFloat(item.weight, 2)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <ScrollArea className="h-[260px] rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Memory</TableHead>
                            <TableHead>Similarity</TableHead>
                            <TableHead>Age</TableHead>
                            <TableHead className="whitespace-normal">Raw window</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(activeQuery.query_summary?.memory_matches || []).map((item) => (
                            <TableRow key={`${item.memory_index}-${item.bucket_id}`}>
                              <TableCell>#{item.memory_index}</TableCell>
                              <TableCell>{formatFloat(item.similarity, 3)}</TableCell>
                              <TableCell>{item.age_tokens}</TableCell>
                              <TableCell className="whitespace-normal break-words font-mono text-xs leading-6">{item.raw_window}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
