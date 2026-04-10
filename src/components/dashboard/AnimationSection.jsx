import { useEffect, useRef, memo } from 'react'
import { ActivityIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const COLUMN_RADIUS = 14
const COLUMN_GAP = 8
const ROW_HEIGHT = 240
const PADDING = 20

const NEURO_COLORS = {
  dopamine: '#f59e0b',
  serotonin: '#3b82f6',
  acetylcholine: '#10b981',
  norepinephrine: '#ef4444',
}

function ColumnCircle({ cx, cy, radius, isWinner, activation, spikeCount }) {
  const intensity = Math.min(activation * 2, 1)
  const baseColor = isWinner ? '#8b5cf6' : '#3b82f6'
  const fillOpacity = 0.15 + intensity * 0.6
  const strokeWidth = isWinner ? 2.5 : 1
  const scale = isWinner ? 1.2 : 1

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`} style={{ transition: 'transform 0.2s ease' }}>
      <circle
        r={radius}
        fill={baseColor}
        fillOpacity={fillOpacity}
        stroke={baseColor}
        strokeWidth={strokeWidth}
        strokeOpacity={0.8}
      />
      {isWinner && (
        <circle r={radius + 4} fill="none" stroke="#8b5cf6" strokeWidth={1} strokeOpacity={0.4}>
          <animate attributeName="r" values={`${radius + 2};${radius + 8};${radius + 2}`} dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
      <text y={1} textAnchor="middle" fill="white" fontSize={8} fontWeight={600}>
        {spikeCount > 0 ? spikeCount : ''}
      </text>
    </g>
  )
}

function NeuromodulatorBar({ x, y, width, label, value, color }) {
  const barWidth = Math.max(0, Math.min(value, 1)) * width

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect width={width} height={8} rx={4} fill="#1e293b" />
      <rect width={barWidth} height={8} rx={4} fill={color} fillOpacity={0.8}>
        <animate
          attributeName="width"
          to={barWidth}
          dur="0.3s"
          fill="freeze"
        />
      </rect>
      <text x={width + 6} y={8} fill="#94a3b8" fontSize={9}>{label}</text>
      <text x={width + 60} y={8} fill={color} fontSize={9} fontWeight={600}>
        {value.toFixed(3)}
      </text>
    </g>
  )
}

function MemoryArc({ cx, cy, radius, fillFraction }) {
  const angle = fillFraction * 2 * Math.PI
  const endX = cx + radius * Math.sin(angle)
  const endY = cy - radius * Math.cos(angle)
  const largeArc = angle > Math.PI ? 1 : 0
  const path = fillFraction >= 1
    ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.001} ${cy - radius}`
    : `M ${cx} ${cy - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`

  return (
    <g>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1e293b" strokeWidth={3} />
      <path d={path} fill="none" stroke="#6366f1" strokeWidth={3} strokeLinecap="round" />
      <text x={cx} y={cy + 3} textAnchor="middle" fill="#94a3b8" fontSize={9}>
        {(fillFraction * 100).toFixed(0)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#475569" fontSize={7}>memory</text>
    </g>
  )
}

const AnimationCanvas = memo(function AnimationCanvas({ animationData, telemetry }) {
  if (!animationData) return null

  const nCols = animationData.n_columns || 4
  const activations = animationData.activations || []
  const spikeCounts = animationData.spike_counts || []
  const winnerId = animationData.winner_id

  const columnsPerRow = Math.min(nCols, 16)
  const rows = Math.ceil(nCols / columnsPerRow)
  const columnAreaWidth = columnsPerRow * (COLUMN_RADIUS * 2 + COLUMN_GAP)
  const svgWidth = Math.max(columnAreaWidth + 200, 400)
  const svgHeight = Math.max(rows * (COLUMN_RADIUS * 2 + COLUMN_GAP) + 120, ROW_HEIGHT)

  const dopamine = telemetry?.dopamine ?? 0
  const serotonin = telemetry?.serotonin ?? 0
  const acetylcholine = telemetry?.acetylcholine ?? 0
  const norepinephrine = telemetry?.norepinephrine ?? 0
  const memoryFill = animationData.memory_fill ?? 0

  return (
    <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
      {/* Column grid */}
      <text x={PADDING} y={16} fill="#94a3b8" fontSize={10} fontWeight={600}>
        Competitive Columns {winnerId != null ? `· Winner: #${winnerId}` : ''}
      </text>
      {Array.from({ length: nCols }).map((_, i) => {
        const col = i % columnsPerRow
        const row = Math.floor(i / columnsPerRow)
        const cx = PADDING + col * (COLUMN_RADIUS * 2 + COLUMN_GAP) + COLUMN_RADIUS
        const cy = 36 + row * (COLUMN_RADIUS * 2 + COLUMN_GAP) + COLUMN_RADIUS

        return (
          <ColumnCircle
            key={i}
            cx={cx}
            cy={cy}
            radius={COLUMN_RADIUS}
            isWinner={i === winnerId}
            activation={activations[i] ?? 0}
            spikeCount={spikeCounts[i] ?? 0}
          />
        )
      })}

      {/* Neuromodulator bars */}
      <g transform={`translate(${columnAreaWidth + 40}, 28)`}>
        <text x={0} y={0} fill="#94a3b8" fontSize={10} fontWeight={600}>Neuromodulators</text>
        <NeuromodulatorBar x={0} y={12} width={80} label="DA" value={dopamine} color={NEURO_COLORS.dopamine} />
        <NeuromodulatorBar x={0} y={28} width={80} label="5-HT" value={serotonin} color={NEURO_COLORS.serotonin} />
        <NeuromodulatorBar x={0} y={44} width={80} label="ACh" value={acetylcholine} color={NEURO_COLORS.acetylcholine} />
        <NeuromodulatorBar x={0} y={60} width={80} label="NE" value={norepinephrine} color={NEURO_COLORS.norepinephrine} />
      </g>

      {/* Memory fill arc */}
      <MemoryArc
        cx={columnAreaWidth + 80}
        cy={svgHeight - 40}
        radius={24}
        fillFraction={memoryFill}
      />

      {/* Cross-modal confidence */}
      {animationData.cross_modal && (
        <g transform={`translate(${PADDING}, ${svgHeight - 30})`}>
          <text x={0} y={0} fill="#94a3b8" fontSize={9}>
            Cross-Modal: V={animationData.cross_modal.visual_confidence.toFixed(3)}
            {' '}A={animationData.cross_modal.audio_confidence.toFixed(3)}
          </text>
        </g>
      )}
    </svg>
  )
})

export default function AnimationSection({ animationData, telemetry }) {
  const hasData = animationData && animationData.n_columns > 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <ActivityIcon className="h-5 w-5" />
          Network Activity
          {hasData && (
            <Badge variant="outline" className="text-xs">
              {animationData.n_columns} columns
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Live competitive column activations, neuromodulator levels, and memory state from the SSE stream.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <AnimationCanvas animationData={animationData} telemetry={telemetry} />
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Waiting for live telemetry data…
          </div>
        )}
      </CardContent>
    </Card>
  )
}
