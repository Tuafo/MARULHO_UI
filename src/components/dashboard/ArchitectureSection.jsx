import { useCallback, useEffect, useState } from 'react'
import { LayersIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useApiCall } from '@/hooks/useApi'

const LAYER_COLORS = {
  encoder: '#3b82f6',
  core: '#8b5cf6',
  context: '#06b6d4',
  binding: '#f59e0b',
  abstraction: '#10b981',
  grounding: '#ec4899',
  memory: '#6366f1',
}

const LAYER_HEIGHT = 60
const LAYER_WIDTH = 220
const LAYER_GAP = 24
const SVG_PADDING = 24

function LayerNode({ layer, x, y, animationData }) {
  const color = LAYER_COLORS[layer.type] || '#64748b'
  const opacity = layer.enabled ? 1 : 0.3
  const spikeCount = animationData?.spike_counts?.[0] ?? 0
  const pulseScale = layer.id === 'competitive_routing' && animationData?.winner_id != null
    ? 1 + Math.min(spikeCount / 100, 0.15)
    : 1

  return (
    <g transform={`translate(${x}, ${y})`} opacity={opacity}>
      <rect
        width={LAYER_WIDTH}
        height={LAYER_HEIGHT}
        rx={10}
        ry={10}
        fill={`${color}18`}
        stroke={color}
        strokeWidth={layer.enabled ? 2 : 1}
        strokeDasharray={layer.enabled ? 'none' : '6 3'}
        transform={`scale(${pulseScale})`}
        style={{ transformOrigin: `${LAYER_WIDTH / 2}px ${LAYER_HEIGHT / 2}px`, transition: 'transform 0.3s ease' }}
      />
      <text
        x={LAYER_WIDTH / 2}
        y={22}
        textAnchor="middle"
        fill={color}
        fontSize={12}
        fontWeight={600}
      >
        {layer.name.length > 28 ? `${layer.name.slice(0, 26)}…` : layer.name}
      </text>
      <text
        x={LAYER_WIDTH / 2}
        y={40}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={10}
      >
        {layer.enabled ? Object.entries(layer.params).slice(0, 2).map(([k, v]) => `${k}=${v}`).join(' · ') : 'disabled'}
      </text>
      {layer.enabled && (
        <circle cx={LAYER_WIDTH - 12} cy={12} r={5} fill={color} opacity={0.8}>
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  )
}

function ConnectionArrow({ fromY, toY, x, enabled }) {
  const startY = fromY + LAYER_HEIGHT
  const endY = toY
  const midX = x + LAYER_WIDTH / 2
  const color = enabled ? '#475569' : '#1e293b'

  return (
    <line
      x1={midX} y1={startY + 2}
      x2={midX} y2={endY - 2}
      stroke={color}
      strokeWidth={enabled ? 1.5 : 0.8}
      strokeDasharray={enabled ? 'none' : '4 4'}
      markerEnd="url(#arrowhead)"
    />
  )
}

export default function ArchitectureSection({ apiBase, animationData }) {
  const { data: architecture, loading, error, execute: fetchArchitecture } = useApiCall(apiBase, '/architecture')
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!fetched && apiBase) {
      setFetched(true)
      fetchArchitecture()
    }
  }, [apiBase, fetched, fetchArchitecture])

  if (loading && !architecture) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading architecture…</span>
        </CardContent>
      </Card>
    )
  }

  if (error && !architecture) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">{error}</CardContent>
      </Card>
    )
  }

  if (!architecture) return null

  const layers = architecture.layers || []
  const enabledLayers = layers.filter((l) => l.enabled)
  const svgHeight = layers.length * (LAYER_HEIGHT + LAYER_GAP) + SVG_PADDING * 2
  const svgWidth = LAYER_WIDTH + SVG_PADDING * 2

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayersIcon className="h-5 w-5" />
              {architecture.model_name}
              <Badge variant="outline" className="text-xs">{architecture.version}</Badge>
            </CardTitle>
            <CardDescription>
              {enabledLayers.length} of {layers.length} layers active
              {' · '}{architecture.config?.plasticity_rule} STDP
              {' · '}{architecture.config?.context_mode} context
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => fetchArchitecture()} disabled={loading}>
            <RefreshCwIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center overflow-x-auto">
            <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#475569" />
                </marker>
              </defs>
              {layers.map((layer, i) => {
                const y = SVG_PADDING + i * (LAYER_HEIGHT + LAYER_GAP)
                return (
                  <g key={layer.id}>
                    {i > 0 && (
                      <ConnectionArrow
                        fromY={SVG_PADDING + (i - 1) * (LAYER_HEIGHT + LAYER_GAP)}
                        toY={y}
                        x={SVG_PADDING}
                        enabled={layer.enabled && layers[i - 1].enabled}
                      />
                    )}
                    <LayerNode
                      layer={layer}
                      x={SVG_PADDING}
                      y={y}
                      animationData={animationData}
                    />
                  </g>
                )
              })}
            </svg>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
