import { DetailItem, EmptyState, SectionHeading } from '@/components/dashboard/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatFloat, formatMode, formatPercent, formatWhen } from '@/lib/dashboard-utils'

export default function TracesSection({
  handleTraceSelection,
  selectedTrace,
  selectedTraceId,
  status,
  traces,
}) {
  return (
    <section id="traces" className="space-y-4">
      <SectionHeading
        title="Traces"
        description="Open historical traces to review the request, answer, selected evidence, and routing context for past events."
        badge={<Badge variant="outline">{status?.trace_history_size ?? traces.length} stored</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Recent traces</CardTitle>
            <CardDescription>The newest trace is at the top. Select one to inspect the stored details.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[460px] rounded-lg border">
              <div className="space-y-2 p-2">
                {!traces.length ? (
                  <EmptyState title="No traces stored" description="New trace entries appear here after respond actions and checkpoint events." />
                ) : traces.map((trace) => (
                  <Button
                    key={trace.trace_id}
                    type="button"
                    variant={selectedTraceId === trace.trace_id ? 'secondary' : 'ghost'}
                    className="h-auto w-full justify-start rounded-lg border px-3 py-3 text-left"
                    onClick={() => handleTraceSelection(trace.trace_id)}
                  >
                    <div className="w-full space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="outline">{formatMode(trace.operation)}</Badge>
                        <span className="text-xs text-muted-foreground">{formatWhen(trace.created_at)}</span>
                      </div>
                      <div className="line-clamp-2 whitespace-normal font-medium leading-5">
                        {trace.request?.query_text || trace.request?.preset || formatMode(trace.operation)}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {trace.response?.response_mode ? <Badge variant={trace.response.response_mode === 'insufficient_evidence' ? 'destructive' : 'secondary'}>{formatMode(trace.response.response_mode)}</Badge> : null}
                        {trace.response?.support_score !== undefined ? <span>support {formatPercent(trace.response.support_score, 0)}</span> : null}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selected trace</CardTitle>
            <CardDescription>Stored request, response, evidence, and route details for the active trace.</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedTrace ? (
              <EmptyState title="No trace selected" description="Choose a trace from the list to open its stored details." />
            ) : (
              <Tabs defaultValue="response">
                <TabsList>
                  <TabsTrigger value="response">Response</TabsTrigger>
                  <TabsTrigger value="evidence">Evidence</TabsTrigger>
                  <TabsTrigger value="concepts">Concepts</TabsTrigger>
                  <TabsTrigger value="route">Route</TabsTrigger>
                </TabsList>

                <TabsContent value="response" className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="Trace id" value={selectedTrace.trace_id} mono help="The unique id for this stored trace." />
                    <DetailItem label="Created" value={formatWhen(selectedTrace.created_at)} help="When this trace record was written." />
                    <DetailItem label="Stored at" value={selectedTrace.trace_path || 'memory only'} mono help="The disk path for the stored trace file, when one exists." />
                  </div>

                  <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatMode(selectedTrace.operation)}</Badge>
                      {selectedTrace.response?.response_mode ? (
                        <Badge variant={selectedTrace.response.response_mode === 'insufficient_evidence' ? 'destructive' : 'secondary'}>
                          {formatMode(selectedTrace.response.response_mode)}
                        </Badge>
                      ) : null}
                      {selectedTrace.response?.support_score !== undefined ? <Badge variant="secondary">support {formatPercent(selectedTrace.response.support_score, 0)}</Badge> : null}
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Request</div>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {selectedTrace.request?.query_text || selectedTrace.request?.preset || 'No query text was stored on this trace.'}
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Response</div>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {selectedTrace.response?.response_text || 'No response text was stored on this trace.'}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="evidence" className="space-y-4">
                  {selectedTrace.response?.selected_evidence?.length ? (
                    <ScrollArea className="h-[360px] rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Memory</TableHead>
                            <TableHead>Similarity</TableHead>
                            <TableHead className="whitespace-normal">Text</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedTrace.response.selected_evidence.map((item, index) => (
                            <TableRow key={`${item.memory_index}-${index}`}>
                              <TableCell>#{item.memory_index}</TableCell>
                              <TableCell>{formatFloat(item.similarity, 3)}</TableCell>
                              <TableCell className="whitespace-normal break-words leading-6">{item.text}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <EmptyState title="No stored evidence" description="This trace did not record selected evidence items." />
                  )}
                </TabsContent>

                <TabsContent value="concepts" className="space-y-4">
                  {selectedTrace.query_result?.concept_summary?.concepts?.length ? (
                    <ScrollArea className="h-[360px] rounded-lg border">
                      <div className="space-y-3 p-3">
                        {selectedTrace.query_result.concept_summary.concepts.map((concept) => (
                          <div key={concept.label} className="rounded-lg border bg-muted/10 p-4">
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
                            {concept.example_windows?.length ? (
                              <div className="mt-3 space-y-2">
                                {concept.example_windows.map((windowText, index) => (
                                  <p key={`${concept.label}-${index}`} className="break-words text-sm leading-6 text-muted-foreground">{windowText}</p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <EmptyState title="No concept summary" description="This trace does not include a derived concept layer yet." />
                  )}
                </TabsContent>

                <TabsContent value="route" className="space-y-4">
                  {selectedTrace.query_result?.query_summary?.top_candidates?.length ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DetailItem label="Query window" value={selectedTrace.query_result.query_summary.query_window || 'n/a'} mono help="The character window used for the stored query lookup." />
                        <DetailItem label="Winner column" value={selectedTrace.query_result.query_summary.winner_column ?? 'n/a'} help="The best matching column saved with this trace." />
                      </div>
                      <ScrollArea className="h-[320px] rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Column</TableHead>
                              <TableHead>Shard</TableHead>
                              <TableHead>Similarity</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedTrace.query_result.query_summary.top_candidates.map((candidate) => (
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
                  ) : (
                    <EmptyState title="No stored route data" description="This trace did not keep a routing candidate list." />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
