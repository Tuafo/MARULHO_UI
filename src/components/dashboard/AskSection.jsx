import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AlertCircleIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlayIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  SquareIcon,
  UserIcon,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { fixedUnitDomain, formatFloat, formatPercent, formatMode, responseModeVariant } from '@/lib/dashboard-utils'
import { cn } from '@/lib/utils'
import { DetailItem } from '@/components/dashboard/shared'

/* -------------------------------------------------------------------------- */
/*  Chart configs                                                              */
/* -------------------------------------------------------------------------- */
const CANDIDATE_CHART_CONFIG = {
  similarity: { label: 'Similarity', color: 'var(--chart-1)' },
}
const EVIDENCE_CHART_CONFIG = {
  similarity: { label: 'Evidence similarity', color: 'var(--chart-3)' },
}
const CHART_CLASS = 'h-[180px] w-full aspect-auto'

/* -------------------------------------------------------------------------- */
/*  QuickStart strip                                                          */
/* -------------------------------------------------------------------------- */
function QuickStartStrip({ apiBase, brainRuntime, pendingAction, stopBrain, refreshStatus }) {
  const [presets, setPresets] = useState([])
  const [selectedPreset, setSelectedPreset] = useState('curriculum')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiBase) return
    fetch(`${apiBase}/terminus/presets`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return
        setPresets(data)
        const recommended = data.find((preset) => preset?.default)?.id || data[0]?.id
        if (recommended) setSelectedPreset(recommended)
      })
      .catch(() => {})
  }, [apiBase])

  const handleStart = useCallback(async () => {
    setStarting(true)
    setError('')
    try {
      const resp = await fetch(`${apiBase}/terminus/quick-start?preset=${encodeURIComponent(selectedPreset)}`, { method: 'POST' })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.detail || `HTTP ${resp.status}`)
      }
      // Poll until the running flag propagates (up to 3s)
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 500))
        if (refreshStatus) {
          const st = await refreshStatus()
          if (st?.terminus_runtime?.running) break
        }
      }
    } catch (err) {
      setError(err.message || 'Quick start failed')
    } finally {
      setStarting(false)
    }
  }, [apiBase, selectedPreset, refreshStatus])

  const isRunning = brainRuntime?.running

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={selectedPreset} onValueChange={setSelectedPreset} disabled={isRunning || starting}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue placeholder="Preset…" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isRunning ? (
        <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={stopBrain} disabled={Boolean(pendingAction)}>
          <SquareIcon className="mr-1 size-3" /> Stop
        </Button>
      ) : (
        <Button size="sm" className="h-8 text-xs" onClick={handleStart} disabled={starting || Boolean(pendingAction)}>
          <PlayIcon className="mr-1 size-3" /> {starting ? 'Starting…' : 'Start'}
        </Button>
      )}
      {isRunning && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-green-500 animate-pulse" /> Live</span>
          <span>{brainRuntime?.tick_count ?? 0} ticks</span>
          <span>{brainRuntime?.background_tokens_processed ?? 0} tok</span>
          {brainRuntime?.tokens_per_second > 0 && <span>{formatFloat(brainRuntime.tokens_per_second, 1)} tok/s</span>}
        </div>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Response analysis expandable card                                         */
/* -------------------------------------------------------------------------- */
function ResponseAnalysis({ query, response }) {
  const [open, setOpen] = useState(false)
  if (!query && !response) return null

  const candidateData = (query?.query_summary?.top_candidates || []).map((c) => ({
    label: `C${c.column_id}`,
    similarity: Number(c.similarity || 0),
  }))
  const evidenceData = (response?.selected_evidence || []).map((item) => ({
    label: `#${item.memory_index}`,
    similarity: Number(item.similarity || 0),
    text: item.text,
  }))
  const nativeDecode = query?.query_summary?.native_decode || null
  const conceptEntries = query?.concept_summary?.concepts || []

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
          {open ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
          Analysis
          {response?.support_score != null && (
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0">{formatPercent(response.support_score, 0)} support</Badge>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="h-7">
            <TabsTrigger value="summary" className="text-xs h-6 px-2">Summary</TabsTrigger>
            <TabsTrigger value="evidence" className="text-xs h-6 px-2">Evidence</TabsTrigger>
            <TabsTrigger value="routing" className="text-xs h-6 px-2">Routing</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-2 mt-2">
            {query && (
              <div className="grid gap-2 grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Winner" value={query.query_summary?.winner_column ?? 'n/a'} />
                <DetailItem label="Mode" value={response?.response_mode ? <Badge variant={responseModeVariant(response.response_mode)} className="text-[10px]">{formatMode(response.response_mode)}</Badge> : 'n/a'} />
                <DetailItem label="Recon error" value={formatFloat(query.query_summary?.reconstruction_error, 3)} />
              </div>
            )}
            {response?.unsupported_terms?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground mr-1">Unsupported:</span>
                {response.unsupported_terms.map((t) => <Badge key={t} variant="destructive" className="text-[10px]">{t}</Badge>)}
              </div>
            )}
            {conceptEntries.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-medium">Concepts</span>
                <div className="flex flex-wrap gap-1">
                  {conceptEntries.slice(0, 8).map((c) => (
                    <Badge key={c.label} variant="secondary" className="text-[10px]">{c.label} ({formatFloat(c.score, 2)})</Badge>
                  ))}
                </div>
              </div>
            )}
            {nativeDecode?.available && (
              <div className="rounded border bg-muted/10 p-2 text-xs">
                <span className="font-medium">Native decode</span> ({formatPercent(nativeDecode.confidence, 0)} conf)
                <p className="mt-1 text-muted-foreground leading-5">{nativeDecode.decoded_text}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="evidence" className="space-y-2 mt-2">
            {!evidenceData.length ? (
              <p className="text-xs text-muted-foreground">No evidence selected.</p>
            ) : (
              <>
                <ChartContainer config={EVIDENCE_CHART_CONFIG} className={CHART_CLASS}>
                  <BarChart data={evidenceData} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 10 }} />
                    <YAxis tickLine={false} axisLine={false} width={40} domain={fixedUnitDomain()} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="similarity" fill="var(--color-similarity)" radius={4} />
                  </BarChart>
                </ChartContainer>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {response.selected_evidence.map((item, i) => (
                    <div key={i} className="flex gap-2 text-xs border-b border-border/50 pb-1">
                      <span className="font-mono text-muted-foreground shrink-0">#{item.memory_index}</span>
                      <span className="text-muted-foreground shrink-0">{formatFloat(item.similarity, 3)}</span>
                      <span className="truncate">{item.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="routing" className="space-y-2 mt-2">
            {!candidateData.length ? (
              <p className="text-xs text-muted-foreground">No routing data.</p>
            ) : (
              <ChartContainer config={CANDIDATE_CHART_CONFIG} className={CHART_CLASS}>
                <BarChart data={candidateData} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} width={40} domain={fixedUnitDomain()} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="similarity" fill="var(--color-similarity)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </TabsContent>
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  )
}

/* -------------------------------------------------------------------------- */
/*  Chat bubble                                                               */
/* -------------------------------------------------------------------------- */
function ChatBubble({ entry, query, response }) {
  const isUser = entry.role === 'user'
  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BotIcon className="size-3.5" />
        </div>
      )}
      <div className={cn(
        'max-w-[85%] rounded-2xl px-3.5 py-2.5',
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-md'
          : 'bg-muted/50 border border-border/50 rounded-bl-md'
      )}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.text}</p>
        {!isUser && <ResponseAnalysis query={query} response={response} />}
      </div>
      {isUser && (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserIcon className="size-3.5" />
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main AskSection                                                           */
/* -------------------------------------------------------------------------- */
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
  const [controlsOpen, setControlsOpen] = useState(false)
  const scrollRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [conversationEntries.length])

  const multimodal = brainRuntime?.multimodal
  const isRunning = brainRuntime?.running
  const realEpisodeInterval = Number(multimodal?.real_episode_interval || 0)
  const tokensSinceReal = Number(multimodal?.tokens_since_real_episode || 0)
  const tokensUntilReal = realEpisodeInterval > 0 ? Math.max(0, realEpisodeInterval - tokensSinceReal) : null

  return (
    <section id="ask" className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 px-1 pb-3 shrink-0">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight">Workspace</h2>
          <p className="text-xs text-muted-foreground">
            Ask grounded questions, inspect evidence, and steer the live Terminus brain.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              {brainRuntime?.tokens_per_second > 0 ? `${formatFloat(brainRuntime.tokens_per_second, 0)} tok/s` : 'Running'}
            </Badge>
          )}
          {multimodal?.enabled && (
            <Badge variant="outline" className="text-xs">
              Sensory: {multimodal.real_episodes_completed ?? multimodal.episodes_completed ?? 0} ep
            </Badge>
          )}
        </div>
      </div>

      {/* Collapsible brain controls */}
      <Collapsible open={controlsOpen} onOpenChange={setControlsOpen} className="shrink-0">
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-card mb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-2">
              <SettingsIcon className="size-3" />
              Controls
              {controlsOpen ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
            </Button>
          </CollapsibleTrigger>
          <div className="h-4 w-px bg-border" />
          <QuickStartStrip
            apiBase={apiBase}
            brainRuntime={brainRuntime}
            pendingAction={pendingAction}
            stopBrain={stopBrain}
            refreshStatus={refreshStatus}
          />
        </div>

        <CollapsibleContent>
          <div className="space-y-3 border rounded-lg p-4 bg-card mb-3">
            {brainRuntime?.last_error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircleIcon className="size-3.5" />
                <AlertDescription className="text-xs">{brainRuntime.last_error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Background tokens" value={brainRuntime?.background_tokens_processed ?? 0} />
              <DetailItem label="Tick count" value={brainRuntime?.tick_count ?? 0} />
              <DetailItem label="Last tick" value={brainRuntime?.last_tick_duration_ms != null ? `${formatFloat(brainRuntime.last_tick_duration_ms, 1)}ms` : 'n/a'} />
              <DetailItem label="Sources" value={`${brainRuntime?.source_count ?? 0} configured`} />
            </div>

            {multimodal?.enabled && (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Real sensory episodes" value={multimodal.real_episodes_completed ?? multimodal.episodes_completed} />
                <DetailItem label="Next real episode in" value={tokensUntilReal != null ? `${tokensUntilReal} tok` : 'n/a'} />
                <DetailItem label="Visual accepted" value={multimodal.cross_modal_visual_accepted} />
                <DetailItem label="Audio accepted" value={multimodal.cross_modal_audio_accepted} />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={tickBrain} disabled={Boolean(pendingAction) || !brainRuntime?.configured}>
                Tick
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={configureBrain} disabled={Boolean(pendingAction)}>
                Save Config
              </Button>
              {isRunning ? (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={stopBrain} disabled={Boolean(pendingAction)}>
                  Stop Loop
                </Button>
              ) : (
                <Button size="sm" className="h-7 text-xs" onClick={startBrain} disabled={Boolean(pendingAction) || !brainRuntime?.configured}>
                  Start Loop
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 rounded-lg border bg-background/50 px-4 py-4">
        {!conversationEntries.length ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
              <BotIcon className="size-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">No conversation yet</p>
              <p className="text-xs text-muted-foreground/70 max-w-sm">
                Type a message below to ask the network something grounded in its memory, or start the training loop above.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {conversationEntries.map((entry) => (
              <ChatBubble
                key={entry.key}
                entry={entry}
                query={entry.role === 'assistant' ? activeQuery : null}
                response={entry.role === 'assistant' ? activeResponse : null}
              />
            ))}
            {pendingAction && (
              <div className="flex gap-2 justify-start">
                <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BotIcon className="size-3.5" />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-muted/50 border border-border/50 px-3.5 py-3">
                  <div className="flex gap-1.5">
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 pt-3">
        <form onSubmit={sendMessage} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (draft.trim() && !pendingAction) sendMessage(e)
                }
              }}
              placeholder="Ask something grounded in memory…"
              className="min-h-[44px] max-h-32 resize-none pr-24 text-sm"
              rows={1}
            />
            <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={runQuery}
                disabled={Boolean(pendingAction) || !draft.trim()}
                title="Inspect route only"
              >
                <SearchIcon className="size-3.5" />
              </Button>
              <Button
                type="submit"
                size="icon"
                className="size-7"
                disabled={Boolean(pendingAction) || !draft.trim()}
                title="Send message"
              >
                <SendIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        </form>
        <div className="flex items-center justify-between mt-2 px-1">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox checked={autoLearn} onCheckedChange={(c) => setAutoLearn(Boolean(c))} className="size-3.5" />
            Learn from exchange
          </label>
          {conversationEntries.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60">
              {conversationEntries.length} message{conversationEntries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
