import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2Icon,
  GaugeIcon,
  ExternalLinkIcon,
  FileJsonIcon,
  FileTextIcon,
  RefreshCwIcon,
  SaveIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  Undo2Icon,
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatMode, formatWhen } from '@/lib/dashboard-utils'
import { requestJson } from '@/lib/service-api'
import { DetailItem, EmptyState, SectionHeading } from '@/components/dashboard/shared'

function reportVariant(report) {
  if (report?.passed === true || String(report?.status || '').includes('ready')) {
    return 'secondary'
  }

  if (report?.passed === false || String(report?.status || '').includes('failed')) {
    return 'destructive'
  }

  return 'outline'
}

function reportTitle(report) {
  return formatMode(report?.artifact_kind || report?.status || report?.path || 'report')
}

function reportPath(report) {
  return report?.path || report?.json_path || report?.readme_path || ''
}

function numberLabel(value, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a'
  }

  return `${value.toFixed(value >= 100 ? 1 : 2)}${suffix}`
}

function failedCheckCount(report) {
  return Array.isArray(report?.failed_checks) ? report.failed_checks.length : 0
}

function evidenceNeedsRefresh(report) {
  return ['stale', 'unknown_timestamp'].includes(report?.evidence_freshness_status)
}

function actionCommands(report) {
  return Array.isArray(report?.baseline_operator_action_commands)
    ? report.baseline_operator_action_commands.filter(Boolean)
    : []
}

function collectSafetyFlags(reportContent) {
  const flags = reportContent?.safety_flags || reportContent?.replay_safety || reportContent?.safety_status
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return []
  }

  return Object.entries(flags).map(([name, value]) => ({ name, value }))
}

function JsonPreview({ value }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-3 text-xs leading-5">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function ValidationSection({ apiBase }) {
  const [summary, setSummary] = useState(null)
  const [selectedPath, setSelectedPath] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reports = summary?.reports || []
  const selectedSummary = reports.find((item) => reportPath(item) === selectedPath || item.readme_path === selectedPath) || null

  const refreshReports = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await requestJson(apiBase, '/terminus/validation/reports?limit=80')
      setSummary(payload)
      const firstPath = payload.latest?.readme_path || reportPath(payload.latest)
      setSelectedPath((current) => current || firstPath || '')
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect(() => {
    refreshReports()
  }, [refreshReports])

  useEffect(() => {
    if (!selectedPath) {
      setSelectedReport(null)
      return
    }

    let cancelled = false

    async function loadSelectedReport() {
      setError('')
      try {
        const payload = await requestJson(
          apiBase,
          `/terminus/validation/report?path=${encodeURIComponent(selectedPath)}`,
        )
        if (!cancelled) {
          setSelectedReport(payload)
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err.message || err))
        }
      }
    }

    loadSelectedReport()

    return () => {
      cancelled = true
    }
  }, [apiBase, selectedPath])

  const selectedContent = selectedReport?.content
  const safetyFlags = collectSafetyFlags(selectedContent)
  const benchmarkGate = useMemo(
    () => reports.find((report) => report.artifact_kind === 'marulho_service_benchmark_regression_gate') || null,
    [reports],
  )
  const acceptedBenchmarkBaseline = useMemo(
    () => reports.find((report) => report.artifact_kind === 'marulho_service_benchmark_accepted_baseline') || null,
    [reports],
  )
  const benchmarkBundle = useMemo(
    () => reports.find((report) => report.artifact_kind === 'marulho_service_benchmark_baseline_run_bundle') || null,
    [reports],
  )

  return (
    <section id="validation" className="space-y-4">
      <SectionHeading
        title="Validation Evidence"
        description="Saved operator evidence for Runtime Truth, hot-path metabolism, replay safety, benchmark currency, and checkpoint-backed promotion gates."
        badge={<Badge variant={summary?.latest ? 'secondary' : 'outline'}>{summary?.reports?.length ?? 0} reports</Badge>}
      />

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlertIcon className="size-4" />
              Validation API error
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-primary" />
              Runtime Truth boundary
            </CardTitle>
            <CardDescription>Saved reports inform operators; they do not upgrade liveness or run benchmark work.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">report-backed</Badge>
            <Badge variant="secondary">verdict separate</Badge>
            <Badge variant="secondary">no hidden cognition</Badge>
            <Badge variant="outline">hot path protected</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-primary" />
              Mutation boundary
            </CardTitle>
            <CardDescription>Growth, replay, and plasticity stay checkpoint-backed and operator-reviewed.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">checkpoint-backed</Badge>
            <Badge variant="secondary">review-gated</Badge>
            <Badge variant="secondary">replay is evidence</Badge>
            <Badge variant="outline">slow-path promotion</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Undo2Icon className="size-4 text-primary" />
              Rollback boundary
            </CardTitle>
            <CardDescription>Capability changes need a reviewed checkpoint path and a reversible operator trail.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">rollback-aware</Badge>
            <Badge variant="secondary">acceptance hashed</Badge>
            <Badge variant="secondary">baseline anchored</Badge>
            <Badge variant="outline">advisory reports</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {benchmarkGate?.status === 'failed' || evidenceNeedsRefresh(benchmarkGate) || failedCheckCount(benchmarkGate) ? (
              <ShieldAlertIcon className="size-4 text-destructive" />
            ) : (
              <GaugeIcon className="size-4 text-primary" />
            )}
            Benchmark regression gate
          </CardTitle>
          <CardDescription>Report-only evidence for hot-path latency, Runtime Truth, and setup/slow-path boundaries.</CardDescription>
        </CardHeader>
        <CardContent>
          {benchmarkGate ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Status" value={formatMode(benchmarkGate.status || 'unknown')} />
              <DetailItem label="Freshness" value={formatMode(benchmarkGate.evidence_freshness_status || 'unknown')} />
              <DetailItem label="Age" value={numberLabel(benchmarkGate.evidence_age_hours, ' h')} />
              <DetailItem label="Runtime Truth" value={formatMode(benchmarkGate.runtime_truth_verdict || 'unknown')} />
              <DetailItem label="Hot p95" value={numberLabel(benchmarkGate.hot_path_p95_ms, ' ms')} />
              <DetailItem label="Allowed p95" value={numberLabel(benchmarkGate.hot_path_allowed_p95_ms, ' ms')} />
              <DetailItem label="Hot total" value={numberLabel(benchmarkGate.hot_path_total_ms, ' ms')} />
              <DetailItem label="Allowed total" value={numberLabel(benchmarkGate.hot_path_allowed_total_ms, ' ms')} />
              <DetailItem
                label="Endpoint boundary"
                value={benchmarkGate.setup_leaked_into_hot_path || benchmarkGate.slow_path_leaked_into_hot_path ? 'leak detected' : 'no setup/slow leak'}
              />
              <DetailItem label="Configured source" value={benchmarkGate.configured_source || 'n/a'} />
              <DetailItem label="Baseline" value={benchmarkGate.accepted_baseline_id || 'none'} mono />
              <DetailItem label="Baseline label" value={benchmarkGate.accepted_baseline_label || 'n/a'} />
              <DetailItem label="Accepted by" value={benchmarkGate.accepted_baseline_by || 'n/a'} />
              <DetailItem label="Tick tokens" value={String(benchmarkGate.configured_source_tick_tokens ?? 'n/a')} />
              <DetailItem label="Tolerance" value={numberLabel((benchmarkGate.hot_path_regression_tolerance ?? 0) * 100, '%')} />
              <DetailItem label="Failed checks" value={failedCheckCount(benchmarkGate) ? benchmarkGate.failed_checks.join(', ') : 'none'} />
              <DetailItem label="Report" value={benchmarkGate.readme_path || reportPath(benchmarkGate)} mono />
            </div>
          ) : (
            <EmptyState title="No regression gate report" description="Run the service benchmark comparison gate to expose hot-path and Runtime Truth regression evidence here." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {benchmarkBundle?.status === 'failed' || evidenceNeedsRefresh(benchmarkBundle) || failedCheckCount(benchmarkBundle) ? (
              <ShieldAlertIcon className="size-4 text-destructive" />
            ) : (
              <CheckCircle2Icon className="size-4 text-primary" />
            )}
            Fresh benchmark bundle
          </CardTitle>
          <CardDescription>Slow-path fresh run compared with the accepted hot-path baseline.</CardDescription>
        </CardHeader>
        <CardContent>
          {benchmarkBundle ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Status" value={formatMode(benchmarkBundle.status || 'unknown')} />
              <DetailItem label="Freshness" value={formatMode(benchmarkBundle.evidence_freshness_status || 'unknown')} />
              <DetailItem label="Age" value={numberLabel(benchmarkBundle.evidence_age_hours, ' h')} />
              <DetailItem label="Runtime Truth" value={formatMode(benchmarkBundle.runtime_truth_verdict || 'unknown')} />
              <DetailItem label="Hot p95" value={numberLabel(benchmarkBundle.hot_path_p95_ms, ' ms')} />
              <DetailItem label="Allowed p95" value={numberLabel(benchmarkBundle.hot_path_allowed_p95_ms, ' ms')} />
              <DetailItem label="Hot total" value={numberLabel(benchmarkBundle.hot_path_total_ms, ' ms')} />
              <DetailItem label="Allowed total" value={numberLabel(benchmarkBundle.hot_path_allowed_total_ms, ' ms')} />
              <DetailItem label="Configured source" value={benchmarkBundle.configured_source || 'n/a'} />
              <DetailItem label="Tick tokens" value={String(benchmarkBundle.configured_source_tick_tokens ?? 'n/a')} />
              <DetailItem label="Baseline" value={benchmarkBundle.accepted_baseline_id || 'n/a'} mono />
              <DetailItem label="Baseline hash" value={benchmarkBundle.baseline_report_hash || 'n/a'} mono />
              <DetailItem label="Fresh hash" value={benchmarkBundle.after_report_hash || 'n/a'} mono />
              <DetailItem label="Fresh benchmark" value={benchmarkBundle.fresh_benchmark_path || 'n/a'} mono />
              <DetailItem label="Comparison" value={benchmarkBundle.comparison_report_path || 'n/a'} mono />
              <DetailItem label="Failed checks" value={failedCheckCount(benchmarkBundle) ? benchmarkBundle.failed_checks.join(', ') : 'none'} />
              <DetailItem label="Report" value={benchmarkBundle.readme_path || reportPath(benchmarkBundle)} mono />
            </div>
          ) : (
            <EmptyState title="No fresh benchmark bundle" description="Run the accepted-baseline benchmark bundle to compare a fresh configured-source sweep against the reviewed anchor." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {acceptedBenchmarkBaseline?.baseline_integrity_status === 'failed' ||
            acceptedBenchmarkBaseline?.acceptance_integrity_status === 'failed' ||
            evidenceNeedsRefresh(acceptedBenchmarkBaseline) ||
            failedCheckCount(acceptedBenchmarkBaseline) ? (
              <ShieldAlertIcon className="size-4 text-destructive" />
            ) : (
              <SaveIcon className="size-4 text-primary" />
            )}
            Accepted benchmark baseline
          </CardTitle>
          <CardDescription>Operator-reviewed benchmark snapshot used as the comparison anchor for future hot-path gates.</CardDescription>
        </CardHeader>
        <CardContent>
          {acceptedBenchmarkBaseline ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Status" value={formatMode(acceptedBenchmarkBaseline.status || 'unknown')} />
              <DetailItem label="Freshness" value={formatMode(acceptedBenchmarkBaseline.evidence_freshness_status || 'unknown')} />
              <DetailItem label="Age" value={numberLabel(acceptedBenchmarkBaseline.evidence_age_hours, ' h')} />
              <DetailItem label="Snapshot integrity" value={formatMode(acceptedBenchmarkBaseline.baseline_integrity_status || 'unknown')} />
              <DetailItem label="Approval integrity" value={formatMode(acceptedBenchmarkBaseline.acceptance_integrity_status || 'unknown')} />
              <DetailItem label="Baseline" value={acceptedBenchmarkBaseline.accepted_baseline_id || 'n/a'} mono />
              <DetailItem label="Label" value={acceptedBenchmarkBaseline.accepted_baseline_label || 'n/a'} />
              <DetailItem label="Accepted by" value={acceptedBenchmarkBaseline.accepted_baseline_by || 'n/a'} />
              <DetailItem label="Runtime Truth" value={formatMode(acceptedBenchmarkBaseline.runtime_truth_verdict || 'unknown')} />
              <DetailItem label="Baseline p95" value={numberLabel(acceptedBenchmarkBaseline.hot_path_p95_ms, ' ms')} />
              <DetailItem label="Baseline total" value={numberLabel(acceptedBenchmarkBaseline.hot_path_total_ms, ' ms')} />
              <DetailItem label="Report hash" value={acceptedBenchmarkBaseline.baseline_report_hash || 'n/a'} mono />
              <DetailItem label="Snapshot hash" value={acceptedBenchmarkBaseline.baseline_snapshot_hash || 'n/a'} mono />
              <DetailItem label="Acceptance hash" value={acceptedBenchmarkBaseline.acceptance_hash || 'n/a'} mono />
              <DetailItem label="Source report" value={acceptedBenchmarkBaseline.source_report_path || 'n/a'} mono />
              <DetailItem label="Action hint" value={acceptedBenchmarkBaseline.baseline_operator_action_hint || 'n/a'} />
              <DetailItem label="Command templates" value={actionCommands(acceptedBenchmarkBaseline).join(' | ') || 'n/a'} mono />
              <DetailItem label="Failed checks" value={failedCheckCount(acceptedBenchmarkBaseline) ? acceptedBenchmarkBaseline.failed_checks.join(', ') : 'none'} />
              <DetailItem label="Report" value={acceptedBenchmarkBaseline.readme_path || reportPath(acceptedBenchmarkBaseline)} mono />
            </div>
          ) : (
            <EmptyState title="No accepted benchmark baseline" description="Accept a service benchmark baseline before using baseline-anchored hot-path regression gates." />
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="reports" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="artifact">Selected Artifact</TabsTrigger>
            <TabsTrigger value="safety">Safety Flags</TabsTrigger>
          </TabsList>
          <Button type="button" variant="outline" size="sm" onClick={refreshReports} disabled={loading}>
            <RefreshCwIcon className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
            Refresh
          </Button>
        </div>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Report index</CardTitle>
              <CardDescription>Latest JSON reports found by `/terminus/validation/reports`.</CardDescription>
            </CardHeader>
            <CardContent>
              {reports.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artifact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => {
                      const path = report.readme_path || reportPath(report)
                      const Icon = report.readme_path ? FileTextIcon : FileJsonIcon
                      return (
                        <TableRow key={`${path}-${report.status}`} data-state={selectedPath === path ? 'selected' : undefined}>
                          <TableCell className="min-w-48">
                            <div className="flex items-center gap-2">
                              <Icon className="size-4 text-muted-foreground" />
                              <span className="font-medium">{reportTitle(report)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={reportVariant(report)}>{formatMode(report.status || 'n/a')}</Badge>
                          </TableCell>
                          <TableCell>{formatWhen(report.modified_at || report.created_at)}</TableCell>
                          <TableCell className="max-w-[24rem] truncate font-mono text-xs">{path}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPath(path)}
                            >
                              <ExternalLinkIcon className="size-3.5" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="No validation reports" description="Run a validation tool or point the service at a reports directory with saved JSON artifacts." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artifact">
          <Card>
            <CardHeader>
              <CardTitle>{selectedSummary ? reportTitle(selectedSummary) : 'Selected artifact'}</CardTitle>
              <CardDescription className="font-mono text-xs">{selectedReport?.path || selectedPath || 'No artifact selected'}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedReport ? (
                <ScrollArea className="h-[520px] rounded-lg">
                  {selectedReport.media_type === 'text/markdown' ? (
                    <pre className="whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-4 text-sm leading-6">
                      {selectedReport.content}
                    </pre>
                  ) : (
                    <JsonPreview value={selectedReport.content} />
                  )}
                </ScrollArea>
              ) : (
                <EmptyState title="Select a report" description="Choose a report from the index to inspect its operator-readable content." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety">
          <Card>
            <CardHeader>
              <CardTitle>Selected safety fields</CardTitle>
              <CardDescription>Extracted directly from the selected JSON artifact when present.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {safetyFlags.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {safetyFlags.map((flag) => (
                    <DetailItem
                      key={flag.name}
                      label={formatMode(flag.name)}
                      value={typeof flag.value === 'boolean' ? (flag.value ? 'true' : 'false') : String(flag.value)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title="No safety map in selected artifact" description="Open a JSON report with safety_flags, replay_safety, or safety_status fields to see this view." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
