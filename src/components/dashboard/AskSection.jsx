import { MessageSquareTextIcon, SearchIcon, ShieldCheckIcon } from 'lucide-react'
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

export default function AskSection({
  activeQuery,
  activeResponse,
  acquisitionPolicy,
  acquisitionPreset,
  acquisitionPresets,
  acquisitionOverrides,
  autoLearn,
  conversationEntries,
  draft,
  lastAcquisition,
  pendingAction,
  runQuery,
  runAcquisition,
  selectedTrace,
  selectedTraceId,
  sendMessage,
  setAcquisitionPolicy,
  setAcquisitionPreset,
  setAcquisitionOverrides,
  setDraft,
  setAutoLearn,
}) {
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
  const acquisitionResult = lastAcquisition?.acquisition_result || null
  const activeOverrideEntries = [
    ['slots', acquisitionOverrides?.acquisitionSlots],
    ['tokens', acquisitionOverrides?.acquisitionTokens],
    ['scout commit', acquisitionOverrides?.scoutCommitTokens],
    ['scout top-k', acquisitionOverrides?.scoutTopK],
    ['shortlist', acquisitionOverrides?.semanticShortlistSize],
  ].filter(([, value]) => String(value || '').trim())

  const evidenceData = (activeResponse?.selected_evidence || []).map((item) => ({
    label: `#${item.memory_index}`,
    similarity: Number(item.similarity || 0),
    text: item.text,
  }))

  function updateAcquisitionOverride(field, value) {
    setAcquisitionOverrides((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function clearAcquisitionOverrides() {
    setAcquisitionOverrides({
      acquisitionSlots: '',
      acquisitionTokens: '',
      scoutCommitTokens: '',
      scoutTopK: '',
      semanticShortlistSize: '',
    })
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
                  Acquire from knowledge catalog
                  <HelpTip>Run a maintained acquisition preset against the live trainer without leaving the dashboard. Presets keep the token budget and remote candidate catalog consistent, and semantic catalogs can expand from the current frontier.</HelpTip>
                </div>
                {acquisitionResult?.selected_source ? <Badge variant="secondary">picked {acquisitionResult.selected_source}</Badge> : null}
              </div>

              {!acquisitionPresets.length ? (
                <EmptyState title="No acquisition presets" description="The service did not return any acquisition presets yet." />
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Preset</div>
                      <Select value={acquisitionPreset} onValueChange={setAcquisitionPreset}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a preset" />
                        </SelectTrigger>
                        <SelectContent>
                          {acquisitionPresets.map((preset) => (
                            <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Policy</div>
                      <Select value={acquisitionPolicy} onValueChange={setAcquisitionPolicy}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a policy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scout_commit">scout_commit</SelectItem>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="round_robin">round_robin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border bg-background/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">Manual overrides</div>
                        <div className="text-xs text-muted-foreground">Leave fields blank to keep the preset defaults.</div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={clearAcquisitionOverrides} disabled={!activeOverrideEntries.length}>
                        Clear overrides
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Slots</div>
                        <Input type="number" min="1" max="16" value={acquisitionOverrides?.acquisitionSlots || ''} onChange={(event) => updateAcquisitionOverride('acquisitionSlots', event.target.value)} placeholder="preset" />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Acquire tokens</div>
                        <Input type="number" min="1" max="20000" value={acquisitionOverrides?.acquisitionTokens || ''} onChange={(event) => updateAcquisitionOverride('acquisitionTokens', event.target.value)} placeholder="preset" />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Scout commit tokens</div>
                        <Input type="number" min="0" max="20000" value={acquisitionOverrides?.scoutCommitTokens || ''} onChange={(event) => updateAcquisitionOverride('scoutCommitTokens', event.target.value)} placeholder="preset" />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Scout top-k</div>
                        <Input type="number" min="1" max="16" value={acquisitionOverrides?.scoutTopK || ''} onChange={(event) => updateAcquisitionOverride('scoutTopK', event.target.value)} placeholder="preset" />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Semantic shortlist</div>
                        <Input type="number" min="0" max="32" value={acquisitionOverrides?.semanticShortlistSize || ''} onChange={(event) => updateAcquisitionOverride('semanticShortlistSize', event.target.value)} placeholder="preset" />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {activeOverrideEntries.length
                        ? activeOverrideEntries.map(([label, value]) => (
                          <Badge key={label} variant="outline">{label}: {value}</Badge>
                        ))
                        : <Badge variant="secondary">Using preset defaults</Badge>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-3">
                    <div className="text-sm text-muted-foreground">
                      Runs the selected preset, applies any non-empty overrides, and writes a new acquisition trace without forcing a checkpoint save.
                    </div>
                    <Button type="button" variant="outline" onClick={runAcquisition} disabled={Boolean(pendingAction) || !acquisitionPreset}>
                      Run acquisition
                    </Button>
                  </div>

                  {acquisitionResult ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <DetailItem label="Selected source" value={acquisitionResult.selected_source || 'n/a'} help="Which candidate source the controller chose on the most recent acquisition run." />
                      <DetailItem label="Tokens trained" value={acquisitionResult.tokens_trained_total ?? 'n/a'} help="How many tokens were actually trained during the most recent acquisition run." />
                      <DetailItem label="Gap reduction" value={formatFloat(acquisitionResult.selected_gap_reduction, 3)} help="How much the chosen source's measured gap dropped after acquisition." />
                      <DetailItem label="State revision" value={lastAcquisition?.state_revision ?? 'n/a'} help="The in-memory revision after the acquisition trace completed." />
                    </div>
                  ) : null}
                </>
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
                              <TableCell className="whitespace-normal leading-6">{item.text}</TableCell>
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
                              <TableCell className="whitespace-normal font-mono text-xs leading-6">{item.raw_window}</TableCell>
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
