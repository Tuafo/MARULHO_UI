import { memo } from 'react'

const LAYER_COLORS = {
  input: { stroke: '#60a5fa', glow: '#3b82f620' },
  columns: { stroke: '#a78bfa', glow: '#8b5cf620' },
  memory: { stroke: '#22d3ee', glow: '#06b6d420' },
  routing: { stroke: '#fbbf24', glow: '#f59e0b20' },
  crossModal: { stroke: '#34d399', glow: '#10b98120' },
}

const MODALITY_COLORS = {
  text: '#3b82f6',
  visual: '#10b981',
  audio: '#f59e0b',
}

function LayerNode({ x, y, width, height, label, sublabel, color, isActive }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={width}
        height={height}
        rx={8}
        fill={isActive ? color.glow : '#0f172a'}
        stroke={isActive ? color.stroke : '#334155'}
        strokeWidth={isActive ? 2 : 1}
        style={{ transition: 'all 0.3s ease' }}
      />
      <text
        x={width / 2}
        y={height / 2 - 4}
        textAnchor="middle"
        fill={isActive ? color.stroke : '#64748b'}
        fontSize={11}
        fontWeight={600}
        style={{ transition: 'fill 0.3s ease' }}
      >
        {label}
      </text>
      {sublabel && (
        <text x={width / 2} y={height / 2 + 10} textAnchor="middle" fill="#64748b" fontSize={8}>
          {sublabel}
        </text>
      )}
    </g>
  )
}

function FlowArrow({ x1, y1, x2, y2, color, isActive }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={isActive ? color : '#334155'}
      strokeWidth={isActive ? 2 : 1}
      strokeOpacity={isActive ? 0.6 : 0.3}
      strokeDasharray={isActive ? 'none' : '4 4'}
      markerEnd={isActive ? 'url(#arrowhead)' : undefined}
      style={{ transition: 'all 0.3s ease' }}
    />
  )
}

function ColumnHeatmap({ x, y, cellSize, cols, activations, winnerId }) {
  const perRow = Math.min(cols, 8)
  const rows = Math.ceil(cols / perRow)

  return (
    <g transform={`translate(${x}, ${y})`}>
      <text x={(perRow * cellSize) / 2} y={-6} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight={500}>
        Column Activity
      </text>
      {Array.from({ length: cols }).map((_, i) => {
        const col = i % perRow
        const row = Math.floor(i / perRow)
        const activation = activations[i] ?? 0
        const isWinner = i === winnerId
        const intensity = Math.min(activation * 3, 1)
        const color = isWinner ? '#8b5cf6' : '#3b82f6'

        return (
          <g key={i}>
            <rect
              x={col * cellSize + 1}
              y={row * cellSize + 1}
              width={cellSize - 2}
              height={cellSize - 2}
              rx={3}
              fill={color}
              fillOpacity={0.08 + intensity * 0.7}
              stroke={isWinner ? '#a78bfa' : 'none'}
              strokeWidth={isWinner ? 1.5 : 0}
              style={{ transition: 'fill-opacity 0.2s ease' }}
            />
            {isWinner && (
              <rect
                x={col * cellSize + 1}
                y={row * cellSize + 1}
                width={cellSize - 2}
                height={cellSize - 2}
                rx={3}
                fill="none"
                stroke="#a78bfa"
                strokeWidth={1}
                strokeOpacity={0.3}
              >
                <animate
                  attributeName="stroke-opacity"
                  values="0.6;0.1;0.6"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </rect>
            )}
            <text
              x={col * cellSize + cellSize / 2}
              y={row * cellSize + cellSize / 2 + 3}
              textAnchor="middle"
              fill={intensity > 0.3 ? '#e2e8f0' : '#475569'}
              fontSize={7}
              fontWeight={isWinner ? 700 : 400}
            >
              {i}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function NeuroGauge({ x, y, radius, value, label, color }) {
  const startAngle = -140
  const endAngle = 140
  const range = endAngle - startAngle
  const valAngle = startAngle + value * range
  const toRad = (deg) => (deg * Math.PI) / 180

  const arcPath = (start, end) => {
    const x1 = Math.cos(toRad(start)) * radius
    const y1 = Math.sin(toRad(start)) * radius
    const x2 = Math.cos(toRad(end)) * radius
    const y2 = Math.sin(toRad(end)) * radius
    const largeArc = end - start > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d={arcPath(startAngle, endAngle)} fill="none" stroke="#1e293b" strokeWidth={4} strokeLinecap="round" />
      <path d={arcPath(startAngle, valAngle)} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round">
        <animate attributeName="d" to={arcPath(startAngle, valAngle)} dur="0.4s" fill="freeze" />
      </path>
      <text y={4} textAnchor="middle" fill="#e2e8f0" fontSize={12} fontWeight={600}>
        {(value * 100).toFixed(0)}%
      </text>
      <text y={radius + 12} textAnchor="middle" fill="#64748b" fontSize={8}>
        {label}
      </text>
    </g>
  )
}

const NEURO_KEYS = ['dopamine', 'serotonin', 'acetylcholine', 'norepinephrine']
const NEURO_LABELS = { dopamine: 'DA', serotonin: '5-HT', acetylcholine: 'ACh', norepinephrine: 'NE' }
const NEURO_COLORS = {
  dopamine: '#f59e0b',
  serotonin: '#3b82f6',
  acetylcholine: '#10b981',
  norepinephrine: '#ef4444',
}

export default memo(function NeuralFlowDiagram({ animationData, telemetry }) {
  const nCols = animationData?.n_columns || 0
  const activations = animationData?.activations || []
  const winnerId = animationData?.winner_id
  const memoryFill = animationData?.memory_fill ?? 0
  const crossModal = animationData?.cross_modal
  const hasData = nCols > 0

  const cellSize = nCols <= 16 ? 28 : nCols <= 32 ? 22 : nCols <= 64 ? 18 : 14
  const heatmapCols = Math.min(nCols, 8)
  const heatmapRows = Math.ceil(nCols / heatmapCols)
  const heatmapHeight = heatmapRows * cellSize

  const svgWidth = 780
  const svgHeight = Math.max(340, heatmapHeight + 180)

  if (!hasData) return null

  const layerW = 120
  const layerH = 44
  const flowY = 24
  const centerY = flowY + layerH / 2

  const inputX = 20
  const colsX = 180
  const memX = 340
  const routeX = 500

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="min-w-0"
    >
      <defs>
        <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.3" />
        </linearGradient>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
        </marker>
      </defs>

      <rect width={svgWidth} height={svgHeight} rx={12} fill="url(#bg-grad)" />

      {/* Flow arrows */}
      <FlowArrow x1={inputX + layerW} y1={centerY} x2={colsX} y2={centerY} color={MODALITY_COLORS.text} isActive={hasData} />
      <FlowArrow x1={colsX + layerW} y1={centerY} x2={memX} y2={centerY} color={LAYER_COLORS.columns.stroke} isActive={winnerId != null} />
      <FlowArrow x1={memX + layerW} y1={centerY} x2={routeX} y2={centerY} color={LAYER_COLORS.memory.stroke} isActive={memoryFill > 0} />

      {/* Cross-modal inputs */}
      {crossModal && (
        <>
          <FlowArrow x1={colsX + layerW / 2 - 20} y1={flowY + layerH + 46} x2={colsX + layerW / 2 - 20} y2={flowY + layerH} color={MODALITY_COLORS.visual} isActive={crossModal.visual_confidence > 0} />
          <FlowArrow x1={colsX + layerW / 2 + 20} y1={flowY + layerH + 46} x2={colsX + layerW / 2 + 20} y2={flowY + layerH} color={MODALITY_COLORS.audio} isActive={crossModal.audio_confidence > 0} />
          <LayerNode x={colsX - 10} y={flowY + layerH + 46} width={60} height={28} label="Visual" sublabel="DVS" color={LAYER_COLORS.crossModal} isActive={crossModal.visual_confidence > 0.01} />
          <LayerNode x={colsX + layerW - 50} y={flowY + layerH + 46} width={60} height={28} label="Audio" sublabel="Mel" color={LAYER_COLORS.crossModal} isActive={crossModal.audio_confidence > 0.01} />
        </>
      )}

      {/* Layer nodes */}
      <LayerNode x={inputX} y={flowY} width={layerW} height={layerH} label="RTF Encoder" sublabel="text → spikes" color={LAYER_COLORS.input} isActive={hasData} />
      <LayerNode x={colsX} y={flowY} width={layerW} height={layerH} label="Competitive Cols" sublabel={`${nCols} columns`} color={LAYER_COLORS.columns} isActive={winnerId != null} />
      <LayerNode x={memX} y={flowY} width={layerW} height={layerH} label="Memory Store" sublabel={`${(memoryFill * 100).toFixed(0)}% full`} color={LAYER_COLORS.memory} isActive={memoryFill > 0} />
      <LayerNode x={routeX} y={flowY} width={layerW} height={layerH} label="HNSW Routing" sublabel="ANN search" color={LAYER_COLORS.routing} isActive={hasData} />

      {/* Column heatmap */}
      <ColumnHeatmap
        x={20}
        y={flowY + layerH + (crossModal ? 100 : 50)}
        cellSize={cellSize}
        cols={nCols}
        activations={activations}
        winnerId={winnerId}
      />

      {/* Neuromodulator gauges */}
      <g transform={`translate(${svgWidth - 200}, ${flowY + layerH + (crossModal ? 100 : 50)})`}>
        <text x={80} y={-6} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight={500}>
          Neuromodulators
        </text>
        {NEURO_KEYS.map((key, i) => (
          <NeuroGauge
            key={key}
            x={40 + (i % 2) * 80}
            y={30 + Math.floor(i / 2) * 70}
            radius={22}
            value={telemetry?.[key] ?? 0}
            label={NEURO_LABELS[key]}
            color={NEURO_COLORS[key]}
          />
        ))}
      </g>

      {/* Winner badge */}
      {winnerId != null && (
        <g transform={`translate(${routeX + layerW + 16}, ${centerY})`}>
          <rect x={-4} y={-12} width={48} height={24} rx={6} fill="#8b5cf620" stroke="#8b5cf6" strokeWidth={1} />
          <text textAnchor="start" fill="#a78bfa" fontSize={10} fontWeight={600} y={3}>
            W: #{winnerId}
          </text>
        </g>
      )}

      {/* Cross-modal confidence badges */}
      {crossModal && (
        <g transform={`translate(${svgWidth - 200}, ${svgHeight - 44})`}>
          <text x={0} y={0} fill="#64748b" fontSize={9}>Cross-Modal Confidence</text>
          <rect x={0} y={6} width={76} height={20} rx={4} fill={MODALITY_COLORS.visual} fillOpacity={0.15} stroke={MODALITY_COLORS.visual} strokeWidth={0.5} />
          <text x={38} y={20} textAnchor="middle" fill={MODALITY_COLORS.visual} fontSize={9} fontWeight={600}>
            V: {crossModal.visual_confidence.toFixed(3)}
          </text>
          <rect x={82} y={6} width={76} height={20} rx={4} fill={MODALITY_COLORS.audio} fillOpacity={0.15} stroke={MODALITY_COLORS.audio} strokeWidth={0.5} />
          <text x={120} y={20} textAnchor="middle" fill={MODALITY_COLORS.audio} fontSize={9} fontWeight={600}>
            A: {crossModal.audio_confidence.toFixed(3)}
          </text>
        </g>
      )}
    </svg>
  )
})
