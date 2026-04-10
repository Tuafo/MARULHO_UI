import { useState } from 'react'
import { FlaskConicalIcon, Loader2Icon, PlayIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApiCall } from '@/hooks/useApi'

function AccuracyBar({ label, value, color }) {
  const pct = Math.max(0, Math.min(value * 100, 100))

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function GapChart({ concrete, abstract, gap }) {
  const barW = 100
  const barH = 20
  const svgW = 260
  const svgH = 80

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      <text x={0} y={14} fill="#94a3b8" fontSize={10}>Concrete</text>
      <rect x={60} y={4} width={barW} height={barH} rx={4} fill="#1e293b" />
      <rect x={60} y={4} width={Math.max(0, concrete * barW)} height={barH} rx={4} fill="#10b981" />
      <text x={165} y={18} fill="#10b981" fontSize={10} fontWeight={600}>{(concrete * 100).toFixed(1)}%</text>

      <text x={0} y={44} fill="#94a3b8" fontSize={10}>Abstract</text>
      <rect x={60} y={34} width={barW} height={barH} rx={4} fill="#1e293b" />
      <rect x={60} y={34} width={Math.max(0, abstract * barW)} height={barH} rx={4} fill="#8b5cf6" />
      <text x={165} y={48} fill="#8b5cf6" fontSize={10} fontWeight={600}>{(abstract * 100).toFixed(1)}%</text>

      <text x={0} y={72} fill="#94a3b8" fontSize={10}>Gap</text>
      <text x={60} y={72} fill={gap > 0 ? '#f59e0b' : '#ef4444'} fontSize={12} fontWeight={700}>
        {gap > 0 ? '+' : ''}{(gap * 100).toFixed(1)}%
      </text>
      <text x={120} y={72} fill="#64748b" fontSize={9}>
        {gap > 0 ? '(concrete > abstract — expected)' : '(inverted — unusual)'}
      </text>
    </svg>
  )
}

export default function GroundingProbeSection({ apiBase }) {
  const { data: probeResult, loading, error, execute: runProbe } = useApiCall(apiBase, '/grounding-probe/run', { method: 'POST' })
  const [runCount, setRunCount] = useState(0)

  function handleRun() {
    setRunCount((c) => c + 1)
    runProbe()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FlaskConicalIcon className="h-5 w-5" />
            Grounding Probe
            {runCount > 0 && <Badge variant="outline" className="text-xs">run #{runCount}</Badge>}
          </CardTitle>
          <CardDescription>
            50-triple semantic similarity test — measures concrete vs abstract word discrimination.
          </CardDescription>
        </div>
        <Button onClick={handleRun} disabled={loading} size="sm">
          {loading ? (
            <>
              <Loader2Icon className="mr-1 h-4 w-4 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <PlayIcon className="mr-1 h-4 w-4" />
              Run Probe
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
        {probeResult ? (
          <div className="space-y-4">
            <AccuracyBar label="Total Accuracy" value={probeResult.total_accuracy} color="#3b82f6" />
            <AccuracyBar label="Concrete Accuracy" value={probeResult.concrete_accuracy} color="#10b981" />
            <AccuracyBar label="Abstract Accuracy" value={probeResult.abstract_accuracy} color="#8b5cf6" />
            <div className="pt-2">
              <GapChart
                concrete={probeResult.concrete_accuracy}
                abstract={probeResult.abstract_accuracy}
                gap={probeResult.concreteness_gap}
              />
            </div>
          </div>
        ) : !loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Click "Run Probe" to evaluate grounding quality.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
