import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  FileJsonIcon,
  FileTextIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
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

  const phaseCards = useMemo(() => ([
    { id: 'phase14', label: 'Phase 14', description: 'Multi-hour live validation' },
    { id: 'phase15', label: 'Phase 15', description: 'Bounded self-improvement readiness' },
  ].map((phase) => ({
    ...phase,
    report: summary?.phase_status?.[phase.id] || null,
  }))), [summary])

  const selectedContent = selectedReport?.content
  const safetyFlags = collectSafetyFlags(selectedContent)

  return (
    <section id="validation" className="space-y-4">
      <SectionHeading
        title="Validation Evidence"
        description="Saved operator evidence for liveness, learning gates, autonomy readiness, replay safety, and production-switch boundaries."
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
        {phaseCards.map((phase) => (
          <Card key={phase.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {phase.report?.passed === false ? <ShieldAlertIcon className="size-4 text-destructive" /> : <ShieldCheckIcon className="size-4 text-primary" />}
                {phase.label}
              </CardTitle>
              <CardDescription>{phase.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {phase.report ? (
                <>
                  <Badge variant={reportVariant(phase.report)}>{formatMode(phase.report.status || 'status pending')}</Badge>
                  <DetailItem label="Artifact" value={reportTitle(phase.report)} />
                  <DetailItem label="Report" value={phase.report.readme_path || reportPath(phase.report)} mono />
                </>
              ) : (
                <EmptyState title="No report indexed" description="The backend has not found this phase artifact under the reports directory." />
              )}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-primary" />
              Safety boundary
            </CardTitle>
            <CardDescription>Roadmap 2 keeps production switching and unbounded autonomy blocked.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">no production model switch</Badge>
            <Badge variant="secondary">approval-gated actions</Badge>
            <Badge variant="secondary">replay is evidence</Badge>
            <Badge variant="outline">level 5 bounded only</Badge>
          </CardContent>
        </Card>
      </div>

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
                <EmptyState title="No validation reports" description="Run a validation phase or point the service at a reports directory with saved JSON artifacts." />
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
