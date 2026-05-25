import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AudioLinesIcon,
  GaugeIcon,
  ImageIcon,
  LayersIcon,
  RadarIcon,
  RefreshCwIcon,
  RouteIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailItem, EmptyState, HelpTip, SectionHeading } from '@/components/dashboard/shared'
import { formatFloat } from '@/lib/dashboard-utils'
import { requestJson } from '@/lib/service-api'
import { cn } from '@/lib/utils'

const PREVIEW_FETCH_LIMIT = 4

function clamp01(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

function formatStamp(value) {
  if (!value) return 'n/a'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'n/a' : date.toLocaleString()
}

function scoreTone(value) {
  const score = clamp01(value)
  if (score >= 0.75) {
    return {
      label: 'strong match',
      badgeClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
      borderClass: 'border-emerald-400/20',
      fillClass: 'bg-gradient-to-r from-emerald-500 to-cyan-400',
    }
  }
  if (score >= 0.45) {
    return {
      label: 'partial match',
      badgeClass: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
      borderClass: 'border-amber-400/20',
      fillClass: 'bg-gradient-to-r from-amber-400 to-orange-400',
    }
  }
  return {
    label: 'weak match',
    badgeClass: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
    borderClass: 'border-border/60',
    fillClass: 'bg-gradient-to-r from-slate-500 to-slate-400',
  }
}

function metricBarWidth(value) {
  return `${Math.max(6, Math.round(clamp01(value) * 100))}%`
}

function MetricMeter({ accentClass, label, value }) {
  const numeric = clamp01(value)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{formatFloat(numeric, 2)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div className={cn('h-full rounded-full transition-all', accentClass)} style={{ width: metricBarWidth(numeric) }} />
      </div>
    </div>
  )
}

function WaveformStrip({ bins = [] }) {
  const safeBins = Array.isArray(bins) ? bins : []
  if (!safeBins.length) return null
  const max = Math.max(...safeBins, 0.0001)
  return (
    <div className="grid h-24 grid-flow-col auto-cols-fr items-end gap-1 overflow-hidden rounded-xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent p-3">
      {safeBins.map((value, index) => {
        const height = Math.max(10, Math.round((Number(value || 0) / max) * 100))
        return (
          <div key={`${index}-${value}`} className="flex h-full items-end justify-center">
            <div
              className="w-full rounded-full bg-gradient-to-t from-emerald-500 via-cyan-400 to-sky-300 opacity-90"
              style={{ height: `${height}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

function PreviewTypeBadge({ preview }) {
  if (preview?.visual?.data_url) {
    return <Badge className="border-blue-400/30 bg-blue-500/10 text-blue-300">image</Badge>
  }
  if (preview?.audio?.data_url) {
    return <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300">audio</Badge>
  }
  return <Badge variant="outline">sensory</Badge>
}

function SourceProgressCard({ source }) {
  const tone = scoreTone(source?.last_selection_score)
  return (
    <div className={cn('space-y-3 rounded-xl border bg-muted/10 p-4', tone.borderClass)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{source.name}</p>
          <p className="text-xs text-muted-foreground">{source.adapter}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{source.episodes_processed ?? 0} ep</Badge>
          <Badge variant="outline">item {formatFloat(source.last_item_semantic_match, 2)}</Badge>
          <Badge className={tone.badgeClass}>{tone.label}</Badge>
        </div>
      </div>
      <div className="space-y-2">
        <MetricMeter label="Source semantic match" value={source.last_semantic_match} accentClass="bg-gradient-to-r from-purple-500 to-blue-400" />
        <MetricMeter label="Best item match" value={source.last_item_semantic_match} accentClass="bg-gradient-to-r from-cyan-500 to-sky-400" />
        <MetricMeter label="Selection score" value={source.last_selection_score} accentClass={tone.fillClass} />
        <MetricMeter label="Modality need" value={source.last_modality_need} accentClass="bg-gradient-to-r from-fuchsia-500 to-pink-400" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <DetailItem label="Window budget" value={source.last_window_budget ?? 'n/a'} />
        <DetailItem label="Lookahead" value={source.last_item_retrieval_lookahead ?? 'n/a'} />
        <DetailItem label="Candidates used" value={source.last_item_candidates_considered ?? 'n/a'} />
        <DetailItem label="Adapter" value={source.adapter || 'n/a'} />
      </div>
      {source.last_text ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{source.last_text}</p>
      ) : (
        <p className="text-xs text-muted-foreground">No episode processed yet.</p>
      )}
    </div>
  )
}

const PreviewCard = memo(function PreviewCard({ preview, featured = false }) {
  const visual = preview?.visual
  const audio = preview?.audio
  const metadata = preview?.metadata || {}
  const topics = Array.isArray(preview?.topics) ? preview.topics : []
  const focusTerms = Array.isArray(preview?.focus_terms) ? preview.focus_terms : []
  const tone = scoreTone(Math.max(clamp01(preview?.selection_score), clamp01(preview?.semantic_match)))
  const hasVisual = Boolean(visual?.data_url)
  const hasAudio = Boolean(audio?.data_url)

  return (
    <Card
      className={cn('border-border/60 bg-card/95', tone.borderClass, featured && 'shadow-lg shadow-purple-500/10')}
      style={{ contentVisibility: 'auto', containIntrinsicSize: featured ? '900px' : '560px' }}
    >
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                {hasVisual ? <ImageIcon className="size-4 text-blue-400" /> : <AudioLinesIcon className="size-4 text-emerald-400" />}
                {preview?.source_name || 'Sensory preview'}
              </CardTitle>
              <PreviewTypeBadge preview={preview} />
              {featured ? <Badge className="border-purple-400/30 bg-purple-500/10 text-purple-300">latest</Badge> : null}
            </div>
            <CardDescription>
              {preview?.adapter || 'unknown'} · {formatStamp(preview?.captured_at)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge className={tone.badgeClass}>{tone.label}</Badge>
            <Badge variant="outline">match {formatFloat(preview?.semantic_match, 2)}</Badge>
            <Badge variant="outline">score {formatFloat(preview?.selection_score, 2)}</Badge>
            <Badge variant="outline">budget {preview?.window_budget ?? 'n/a'}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn('space-y-4 pt-4', featured && 'lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.95fr)] lg:gap-5 lg:space-y-0')}>
        <div className="space-y-4">
          {hasVisual ? (
            <div className="overflow-hidden rounded-xl border border-blue-400/15 bg-black/30">
              <img
                src={visual.data_url}
                alt={metadata?.title || preview?.text || 'Sensory preview'}
                loading={featured ? 'eager' : 'lazy'}
                decoding="async"
                className={cn('w-full object-contain', featured ? 'h-[22rem]' : 'h-72')}
              />
            </div>
          ) : null}

          {hasAudio ? (
            <div className="space-y-3 rounded-xl border border-emerald-400/15 bg-muted/10 p-4">
              <audio controls preload="none" src={audio.data_url} className="w-full" />
              <WaveformStrip bins={audio.waveform} />
              <div className="grid gap-2 sm:grid-cols-2">
                <DetailItem label="Duration" value={`${formatFloat(audio.duration_s, 2)} s`} />
                <DetailItem label="Sample rate" value={`${audio.sample_rate ?? 'n/a'} Hz`} />
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-dashed bg-muted/10 p-4">
            <div className="mb-3 flex items-center gap-2">
              <RouteIcon className="size-4 text-purple-400" />
              <p className="text-sm font-medium">Why this sample was chosen</p>
            </div>
            <div className="space-y-3">
              <MetricMeter label="Source match to current focus" value={preview?.semantic_match} accentClass="bg-gradient-to-r from-purple-500 to-blue-400" />
              <MetricMeter label="Best item match inside source" value={preview?.item_semantic_match} accentClass="bg-gradient-to-r from-cyan-500 to-sky-400" />
              <MetricMeter label="Overall routing score" value={preview?.selection_score} accentClass={tone.fillClass} />
              <MetricMeter label="Current modality need" value={preview?.modality_need} accentClass="bg-gradient-to-r from-fuchsia-500 to-pink-400" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border bg-muted/10 p-4">
            {metadata?.title ? (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Title</p>
                <p className="text-sm font-medium leading-relaxed">{metadata.title}</p>
              </div>
            ) : null}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Caption / observation</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{preview?.text || 'n/a'}</p>
            </div>
            {metadata?.categories ? (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Categories</p>
                <p className="text-xs text-muted-foreground">{metadata.categories}</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <DetailItem label="Adapter" value={preview?.adapter || 'n/a'} />
            <DetailItem label="Captured" value={formatStamp(preview?.captured_at)} />
            <DetailItem label="Window budget" value={preview?.window_budget ?? 'n/a'} />
            <DetailItem label="Candidates used" value={preview?.item_candidates_considered ?? 'n/a'} />
            <DetailItem label="Lookahead" value={preview?.item_retrieval_lookahead ?? 'n/a'} />
            <DetailItem label="Preview id" value={preview?.preview_id || 'n/a'} mono />
          </div>

          {(focusTerms.length > 0 || topics.length > 0) && (
            <div className="space-y-3 rounded-xl border bg-muted/10 p-4">
              {focusTerms.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Focus terms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {focusTerms.map((term) => (
                      <Badge key={term} variant="outline" className="text-[10px]">{term}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {topics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Observed topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {topics.map((topic) => (
                      <Badge key={topic} className="border-purple-400/20 bg-purple-500/10 text-purple-200">{topic}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

const HistoryPreviewCard = memo(function HistoryPreviewCard({ expanded, onToggle, preview }) {
  const visual = preview?.visual
  const audio = preview?.audio
  const metadata = preview?.metadata || {}
  const hasVisual = Boolean(visual?.data_url)
  const hasAudio = Boolean(audio?.data_url)

  return (
    <div className="space-y-3 rounded-xl border bg-card/80 p-4" style={{ contentVisibility: 'auto', containIntrinsicSize: '320px' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{preview?.source_name || 'Sensory preview'}</p>
            <PreviewTypeBadge preview={preview} />
          </div>
          <p className="text-xs text-muted-foreground">{preview?.adapter || 'unknown'} · {formatStamp(preview?.captured_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">match {formatFloat(preview?.semantic_match, 2)}</Badge>
          <Badge variant="outline">item {formatFloat(preview?.item_semantic_match, 2)}</Badge>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onToggle}>
            {expanded ? 'Collapse' : 'Open details'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border bg-muted/10">
          {hasVisual ? (
            <img
              src={visual.data_url}
              alt={metadata?.title || preview?.text || 'Sensory preview'}
              loading="lazy"
              decoding="async"
              className="h-36 w-full object-cover"
            />
          ) : (
            <div className="flex h-36 items-center justify-center bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 text-muted-foreground">
              <div className="text-center">
                <AudioLinesIcon className="mx-auto mb-2 size-6 text-emerald-400" />
                <p className="text-xs">audio preview</p>
                <p className="text-[10px]">{formatFloat(audio?.duration_s, 2)} s</p>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {metadata?.title ? <p className="text-sm font-medium">{metadata.title}</p> : null}
          <p className="line-clamp-4 text-sm text-muted-foreground">{preview?.text || 'n/a'}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <DetailItem label="Score" value={formatFloat(preview?.selection_score, 2)} />
            <DetailItem label="Lookahead" value={preview?.item_retrieval_lookahead ?? 'n/a'} />
            <DetailItem label="Budget" value={preview?.window_budget ?? 'n/a'} />
          </div>
        </div>
      </div>

      {expanded ? <PreviewCard preview={preview} /> : null}
    </div>
  )
})

export default function SensorySection({ apiBase, brainRuntime }) {
  const [payload, setPayload] = useState({ count: 0, latest_preview_id: null, previews: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedHistoryId, setExpandedHistoryId] = useState('')

  const multimodal = brainRuntime?.multimodal || {}
  const sensory = brainRuntime?.sensory || {}
  const previewSignature = `${multimodal?.latest_preview_id || ''}:${multimodal?.recent_preview_count || 0}`

  const fetchPreviews = useCallback(async () => {
    if (!apiBase) return
    setLoading(true)
    try {
      const next = await requestJson(apiBase, `/terminus/sensory/recent?limit=${PREVIEW_FETCH_LIMIT}`)
      setPayload(next)
      setError('')
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect(() => {
    fetchPreviews()
  }, [fetchPreviews, previewSignature])

  const previews = Array.isArray(payload?.previews) ? payload.previews : []

  useEffect(() => {
    if (!expandedHistoryId) return
    if (!previews.some((preview) => preview.preview_id === expandedHistoryId)) {
      setExpandedHistoryId('')
    }
  }, [expandedHistoryId, previews])
  const latestPreview = previews[0] || null
  const otherPreviews = previews.slice(1)
  const sourceProgress = Array.isArray(sensory?.source_progress) ? sensory.source_progress : []
  const focusTerms = useMemo(() => {
    if (Array.isArray(multimodal?.focus_terms) && multimodal.focus_terms.length > 0) return multimodal.focus_terms
    if (Array.isArray(sensory?.focus_terms)) return sensory.focus_terms
    return []
  }, [multimodal?.focus_terms, sensory?.focus_terms])

  const previewMix = useMemo(() => {
    return previews.reduce((acc, item) => {
      if (item?.visual?.data_url) acc.images += 1
      if (item?.audio?.data_url) acc.audio += 1
      return acc
    }, { images: 0, audio: 0 })
  }, [previews])

  if (!multimodal?.enabled) {
    return (
      <section className="space-y-4">
        <SectionHeading
          title="Sensory"
          description="Real image/audio grounding routed from the current exploration target."
          badge={<Badge variant="outline">disabled</Badge>}
        />
        <EmptyState
          title="Sensory routing not active"
          description="Enable the live Terminus sensory pipeline to view real image and audio episodes from Hugging Face."
        />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Sensory"
        description="Real image/audio grounding from Hugging Face, routed by the current exploration focus and grounding need."
        badge={<Badge variant="secondary">{payload?.count ?? multimodal?.recent_preview_count ?? 0} previews</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <RouteIcon className="size-4" /> Sensory routing
              <HelpTip>Terminus first decides which sensory source family should get attention next, then it streams a real sample from that chosen source.</HelpTip>
            </CardTitle>
            <CardDescription>Current live routing state</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Mode" value={multimodal.mode || 'n/a'} />
            <DetailItem label="Next source" value={multimodal?.next_source_name || 'n/a'} />
            <DetailItem label="Real episodes" value={multimodal?.real_episodes_completed ?? 0} />
            <DetailItem label="Previews" value={payload?.count ?? multimodal?.recent_preview_count ?? 0} />
          </CardContent>
        </Card>

        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <GaugeIcon className="size-4" /> Grounding confidence
            </CardTitle>
            <CardDescription>Current cross-modal confidence means</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Visual" value={formatFloat(multimodal?.visual_confidence_mean, 3)} />
            <DetailItem label="Audio" value={formatFloat(multimodal?.audio_confidence_mean, 3)} />
            <DetailItem label="Visual accepted" value={multimodal?.real_cross_modal_visual_accepted ?? 0} />
            <DetailItem label="Audio accepted" value={multimodal?.real_cross_modal_audio_accepted ?? 0} />
          </CardContent>
        </Card>

        <Card size="sm" className="bg-card/90 md:col-span-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <RadarIcon className="size-4" /> Active focus terms
            </CardTitle>
            <CardDescription>Terms currently steering sensory selection and window budgeting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {focusTerms.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {focusTerms.map((term) => (
                  <Badge key={term} variant="outline" className="text-[10px]">{term}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active sensory focus terms yet.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-5">
              <DetailItem label="Real interval" value={`${multimodal?.real_episode_interval ?? 0} tok`} />
              <DetailItem label="Base window" value={multimodal?.base_windows_per_item ?? 0} />
              <DetailItem label="Max window" value={multimodal?.max_windows_per_item ?? 0} />
              <DetailItem label="Lookahead" value={multimodal?.item_retrieval_lookahead ?? sensory?.item_retrieval_lookahead ?? 'n/a'} />
              <DetailItem label="Latest preview" value={formatStamp(latestPreview?.captured_at)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card size="sm" className="border-dashed bg-muted/10">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <LayersIcon className="size-4" /> How the sensory feed works
          </CardTitle>
          <CardDescription>Simple operator view of what Terminus is doing with images and audio.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-xl border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">1. Focus</p>
            <p className="mt-2 text-sm text-muted-foreground">The live mind produces focus terms from its current curiosity, question, or exploration target.</p>
          </div>
          <div className="rounded-xl border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">2. Route</p>
            <p className="mt-2 text-sm text-muted-foreground">Those focus terms are compared against source-level topic families like scientific figures or environmental audio.</p>
          </div>
          <div className="rounded-xl border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">3. Shortlist</p>
            <p className="mt-2 text-sm text-muted-foreground">After the source is chosen, Terminus looks ahead across a small shortlist of real items from that dataset and keeps the best-matching sample.</p>
          </div>
          <div className="rounded-xl border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">4. Bind</p>
            <p className="mt-2 text-sm text-muted-foreground">The chosen caption, image/audio spikes, and accepted cross-modal bindings are fed back into memory and later replay.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Sensory source routing</CardTitle>
              <CardDescription>How each live sensory source is currently being prioritized.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{previewMix.images} image</Badge>
              <Badge variant="outline">{previewMix.audio} audio</Badge>
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={fetchPreviews} disabled={loading}>
                <RefreshCwIcon className={cn('mr-1 size-3', loading && 'animate-spin')} /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {sourceProgress.length > 0 ? sourceProgress.map((source) => (
            <SourceProgressCard key={source.name} source={source} />
          )) : (
            <p className="text-sm text-muted-foreground">No sensory source progress available yet.</p>
          )}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {latestPreview ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-medium tracking-tight">Latest grounded episode</h3>
              <p className="text-sm text-muted-foreground">Most recent real sensory sample that was injected into the live runtime.</p>
            </div>
            <Badge variant="secondary">{latestPreview?.source_name || 'latest'}</Badge>
          </div>
          <PreviewCard preview={latestPreview} featured />

          {otherPreviews.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-medium tracking-tight">Recent history</h3>
                <p className="text-sm text-muted-foreground">Older previews stay available here so you can compare what the router has been grounding recently.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {otherPreviews.map((preview) => (
                  <HistoryPreviewCard
                    key={preview.preview_id}
                    preview={preview}
                    expanded={expandedHistoryId === preview.preview_id}
                    onToggle={() => setExpandedHistoryId((current) => (current === preview.preview_id ? '' : preview.preview_id))}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="No sensory previews yet"
          description="Run the brain long enough for a real sensory episode to be selected. Recent image and audio previews will appear here automatically."
        />
      )}
    </section>
  )
}
