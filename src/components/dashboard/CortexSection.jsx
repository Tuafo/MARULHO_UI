import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BrainIcon,
  CloudIcon,
  CloudOffIcon,
  MoonIcon,
  SendIcon,
  SparklesIcon,
  ZapIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DetailItem, EmptyState, HelpTip, SectionHeading, Sparkline } from './shared'

// Drive bar colors
const DRIVE_COLORS = {
  curiosity: 'bg-blue-500',
  anxiety: 'bg-red-500',
  satisfaction: 'bg-green-500',
  boredom: 'bg-yellow-500',
  fatigue: 'bg-purple-500',
  social: 'bg-cyan-500',
  arousal: 'bg-orange-500',
}

function ModeIndicator({ mode, isSleeping }) {
  if (isSleeping) {
    return (
      <div className="flex items-center gap-2">
        <MoonIcon className="size-5 text-indigo-400 animate-pulse" />
        <span className="text-lg font-semibold text-indigo-400">Dreaming</span>
      </div>
    )
  }
  if (mode === 'thinking') {
    return (
      <div className="flex items-center gap-2">
        <SparklesIcon className="size-5 text-amber-400 animate-pulse" />
        <span className="text-lg font-semibold text-amber-400">Thinking</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <div className="size-3 rounded-full bg-emerald-500/60 animate-pulse" />
      <span className="text-lg font-semibold text-muted-foreground">Idle</span>
    </div>
  )
}

function DriveBar({ name, value }) {
  const pct = Math.min(Math.max(value * 100, 0), 100)
  const colorClass = DRIVE_COLORS[name] || 'bg-blue-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="capitalize text-muted-foreground">{name}</span>
        <span className="font-mono tabular-nums">{value.toFixed(3)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ThoughtBubble({ thought }) {
  const time = thought.time
    ? new Date(thought.time * 1000).toLocaleTimeString()
    : null
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-relaxed">{thought.thought}</p>
        {time && (
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {time}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {thought.topics?.map((topic) => (
          <Badge key={topic} variant="outline" className="text-[10px] px-1.5 py-0">
            {topic}
          </Badge>
        ))}
        {thought.confidence != null && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            conf {(thought.confidence * 100).toFixed(0)}%
          </Badge>
        )}
        {thought.emotional_valence != null && thought.emotional_valence !== 0 && (
          <Badge
            variant={thought.emotional_valence > 0 ? 'secondary' : 'destructive'}
            className="text-[10px] px-1.5 py-0"
          >
            {thought.emotional_valence > 0 ? '+' : ''}{thought.emotional_valence.toFixed(2)}
          </Badge>
        )}
        {thought.latency_ms != null && (
          <span className="text-[10px] text-muted-foreground">
            {thought.latency_ms.toFixed(0)}ms
          </span>
        )}
      </div>
    </div>
  )
}

export default function CortexSection({ apiBase, status }) {
  const cortex = status?.terminus_runtime?.cortex
  const enabled = cortex?.enabled ?? false
  const running = cortex?.running ?? false
  const drives = cortex?.drives ?? {}
  const recentThoughts = cortex?.recent_thoughts ?? []
  const [askText, setAskText] = useState('')
  const [askStatus, setAskStatus] = useState(null)
  const thoughtsEndRef = useRef(null)

  // Auto-scroll thoughts
  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [recentThoughts.length])

  const handleAsk = useCallback(async () => {
    if (!askText.trim() || !apiBase) return
    setAskStatus('sending')
    try {
      const resp = await fetch(
        `${apiBase}/terminus/ask?query=${encodeURIComponent(askText.trim())}`,
        { method: 'POST' },
      )
      const data = await resp.json()
      setAskStatus(data.accepted ? 'accepted' : 'rejected')
      if (data.accepted) setAskText('')
    } catch {
      setAskStatus('error')
    }
    setTimeout(() => setAskStatus(null), 3000)
  }, [askText, apiBase])

  if (!enabled) {
    return (
      <section className="space-y-4">
        <SectionHeading
          title="Cortex"
          description="Hybrid SNN-LLM living brain — thought generation, drives, and consciousness state."
          badge={
            <Badge variant="outline" className="gap-1">
              <CloudOffIcon className="size-3" /> Unavailable
            </Badge>
          }
        />
        <EmptyState
          title="Cortex not available"
          description="NVIDIA NIM API key required. Set NVIDIA_API_KEY in .env and restart the service to enable the cortex."
        />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Cortex"
        description="Hybrid SNN-LLM living brain — thought generation, drives, and consciousness state."
        badge={
          <Badge variant={running ? 'default' : 'secondary'} className="gap-1">
            {running ? (
              <>
                <CloudIcon className="size-3" /> Active
              </>
            ) : (
              <>
                <CloudOffIcon className="size-3" /> Stopped
              </>
            )}
          </Badge>
        }
      />

      {/* Top stats row */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Brain Mode */}
        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <BrainIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>Brain Mode</CardTitle>
                <CardDescription>Current consciousness state</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ModeIndicator mode={cortex.current_mode} isSleeping={cortex.is_sleeping} />
          </CardContent>
        </Card>

        {/* Thoughts Count */}
        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <SparklesIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>Thoughts</CardTitle>
                <CardDescription>Generated thoughts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {cortex.thoughts_generated ?? 0}
            </div>
          </CardContent>
        </Card>

        {/* Dreams Count */}
        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <MoonIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>Dreams</CardTitle>
                <CardDescription>Sleep cycle outputs</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2">
              <div className="text-2xl font-semibold tracking-tight">
                {cortex.dreams_generated ?? 0}
              </div>
              <span className="text-xs text-muted-foreground">
                {cortex.sleep_cycles ?? 0} cycles
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Inference Speed */}
        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ZapIcon className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle>Avg Inference</CardTitle>
                <CardDescription>LLM latency</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {(cortex.avg_inference_ms ?? 0).toFixed(0)}
              <span className="text-sm font-normal text-muted-foreground ml-1">ms</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content: Drives + Thoughts */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Drives */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Drives
              <HelpTip>
                <p>SNN neuromodulators control the LLM's attention through biological drives.
                  Curiosity triggers exploration, anxiety signals unresolved surprise,
                  fatigue leads to sleep/dream cycles.</p>
              </HelpTip>
            </CardTitle>
            <CardDescription>SNN → LLM control signals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(drives).length > 0 ? (
              Object.entries(drives).map(([name, value]) => (
                <DriveBar key={name} name={name} value={value} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No drive data available</p>
            )}
            <div className="pt-2 border-t space-y-2">
              <DetailItem
                label="Episodic Memory"
                value={`${cortex.memory_count ?? 0} episodes (${((cortex.memory_fill_ratio ?? 0) * 100).toFixed(1)}% full)`}
              />
              <DetailItem
                label="Ticks"
                value={`${cortex.ticks ?? 0} fast loops`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Thought Stream */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Thought Stream
              <HelpTip>
                <p>Live stream of the cortex's autonomous thoughts. Each thought is generated
                  by Gemma 4 E4B, driven by SNN curiosity/anxiety signals.
                  Topics, confidence, and emotional valence are extracted from structured output.</p>
              </HelpTip>
            </CardTitle>
            <CardDescription>
              {recentThoughts.length > 0
                ? `${recentThoughts.length} recent thought${recentThoughts.length !== 1 ? 's' : ''}`
                : 'Waiting for first thought…'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-2">
              {recentThoughts.length > 0 ? (
                <div className="space-y-2">
                  {recentThoughts.map((thought, i) => (
                    <ThoughtBubble key={`${thought.time}-${i}`} thought={thought} />
                  ))}
                  <div ref={thoughtsEndRef} />
                </div>
              ) : (
                <EmptyState
                  title="No thoughts yet"
                  description={
                    running
                      ? 'The cortex is warming up. First thought appears when drives cross threshold.'
                      : 'Start Terminus to activate the cortex thought loop.'
                  }
                />
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Ask the brain */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Ask the Brain
            <HelpTip>
              <p>Submit a question for the cortex to answer in its next deliberation cycle.
                The question is queued (up to 8 pending) and answered asynchronously —
                the response appears in the thought stream.</p>
            </HelpTip>
          </CardTitle>
          <CardDescription>Submit a question — the brain will answer in its next thought cycle</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              handleAsk()
            }}
          >
            <Input
              placeholder="What are you curious about?"
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              disabled={!running}
              className="flex-1"
            />
            <Button type="submit" disabled={!running || !askText.trim()} size="sm" className="gap-1.5">
              <SendIcon className="size-3.5" />
              Ask
            </Button>
          </form>
          {askStatus === 'accepted' && (
            <p className="mt-2 text-xs text-emerald-500">✓ Question queued — watch the thought stream</p>
          )}
          {askStatus === 'error' && (
            <p className="mt-2 text-xs text-destructive">Failed to send question</p>
          )}
          {askStatus === 'rejected' && (
            <p className="mt-2 text-xs text-yellow-500">Cortex unavailable</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
