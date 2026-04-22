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
  winner: '#a78bfa',
}

const MAX_HEATMAP_COLUMNS = 160

function clamp01(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

function targetIs(selectedTarget, type, key) {
  if (!selectedTarget) return false
  if (selectedTarget.type !== type) return false
  if (type === 'column') return selectedTarget.index === key
  return selectedTarget.key === key
}

function LayerNode({
  x,
  y,
  width,
  height,
  label,
  sublabel,
  color,
  isActive,
  nodeKey,
  selected,
  onSelect,
  tooltip,
}) {
  return (
    <g transform={`translate(${x}, ${y})`} onClick={() => onSelect?.({ type: 'layer', key: nodeKey })} className="cursor-pointer">
      <title>{tooltip}</title>
      <rect
        width={width}
        height={height}
        rx={14}
        fill={isActive ? color.glow : '#0f172a'}
        stroke={selected ? '#f8fafc' : isActive ? color.stroke : '#334155'}
        strokeWidth={selected ? 2.6 : isActive ? 2 : 1}
      />
      <text x={width / 2} y={height / 2 - 8} textAnchor="middle" fill={selected ? '#f8fafc' : isActive ? color.stroke : '#64748b'} fontSize={11.5} fontWeight={700}>
        {label}
      </text>
      {sublabel ? (
        <text x={width / 2} y={height / 2 + 14} textAnchor="middle" fill="#94a3b8" fontSize={8.5}>
          {sublabel}
        </text>
      ) : null}
    </g>
  )
}

function FlowArrow({ x1, y1, x2, y2, color, isActive }) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={isActive ? color : '#334155'}
      strokeWidth={isActive ? 2.5 : 1}
      strokeOpacity={isActive ? 0.82 : 0.3}
      strokeDasharray={isActive ? 'none' : '4 4'}
      markerEnd={isActive ? 'url(#arrowhead)' : undefined}
    />
  )
}

function FlowCurve({ x1, y1, x2, y2, color, isActive, bendY }) {
  const midY = bendY ?? Math.min(y1, y2) - 28
  const path = `M ${x1} ${y1} Q ${x1} ${midY}, ${(x1 + x2) / 2} ${midY} T ${x2} ${y2}`
  return (
    <path
      d={path}
      fill="none"
      stroke={isActive ? color : '#334155'}
      strokeWidth={isActive ? 2.4 : 1}
      strokeOpacity={isActive ? 0.82 : 0.3}
      strokeDasharray={isActive ? 'none' : '4 4'}
      markerEnd={isActive ? 'url(#arrowhead)' : undefined}
    />
  )
}

function ColumnHeatmap({ x, y, cellSize, cols, totalCols, activations, winnerId, selectedTarget, onSelectTarget }) {
  const perRow = Math.min(cols <= 48 ? 16 : cols <= 96 ? 24 : 32, Math.max(1, cols))
  const rows = Math.ceil(cols / perRow)

  return (
    <g transform={`translate(${x}, ${y})`}>
      <text x="0" y="-18" fill="#e2e8f0" fontSize="12" fontWeight="700">Visible column field</text>
      <text x="0" y="0" fill="#94a3b8" fontSize="9.5">
        {totalCols > cols ? `Showing ${cols} of ${totalCols.toLocaleString()} runtime columns` : `${cols} visible columns`}
      </text>
      <g transform="translate(0, 18)">
        {Array.from({ length: cols }).map((_, index) => {
          const col = index % perRow
          const row = Math.floor(index / perRow)
          const activation = activations[index] ?? 0
          const isWinner = index === winnerId
          const selected = targetIs(selectedTarget, 'column', index)
          const intensity = Math.min(Number(activation || 0) * 3, 1)
          const fill = isWinner ? MODALITY_COLORS.winner : '#3b82f6'

          return (
            <g key={index} onClick={() => onSelectTarget?.({ type: 'column', index })} className="cursor-pointer">
              <title>{`Column #${index} · activation ${Number(activation || 0).toFixed(3)}${isWinner ? ' · winner' : ''}`}</title>
              <rect
                x={col * cellSize + 1}
                y={row * cellSize + 1}
                width={cellSize - 2}
                height={cellSize - 2}
                rx={4}
                fill={fill}
                fillOpacity={0.1 + intensity * 0.76}
                stroke={selected ? '#f8fafc' : isWinner ? '#ddd6fe' : 'none'}
                strokeWidth={selected ? 2 : isWinner ? 1.5 : 0}
              />
              {isWinner && !selected ? (
                <rect
                  x={col * cellSize - 1}
                  y={row * cellSize - 1}
                  width={cellSize + 2}
                  height={cellSize + 2}
                  rx={5}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth={1}
                  strokeOpacity={0.35}
                >
                  <animate attributeName="stroke-opacity" values="0.65;0.12;0.65" dur="1.1s" repeatCount="indefinite" />
                </rect>
              ) : null}
              {cellSize >= 18 ? (
                <text x={col * cellSize + cellSize / 2} y={row * cellSize + cellSize / 2 + 3} textAnchor="middle" fill={intensity > 0.3 ? '#e2e8f0' : '#475569'} fontSize={7} fontWeight={selected || isWinner ? 700 : 400}>
                  {index}
                </text>
              ) : null}
            </g>
          )
        })}
      </g>
      <text x="0" y={rows * cellSize + 42} fill="#64748b" fontSize="8.5">
        Brighter cells are more active. Purple highlights the current winner.
      </text>
    </g>
  )
}

export default memo(function NeuralFlowDiagram({ animationData, selectedTarget, onSelectTarget }) {
  const nCols = animationData?.n_columns || 0
  const winnerId = animationData?.winner_id
  const memoryFill = clamp01(animationData?.memory_fill ?? 0)
  const crossModal = animationData?.cross_modal || {}
  const activations = Array.isArray(animationData?.activations) ? animationData.activations : []
  const visibleCols = Math.min(nCols, MAX_HEATMAP_COLUMNS)
  const visibleActivations = activations.slice(0, visibleCols)
  const hasData = nCols > 0

  if (!hasData) return null

  const visualConfidence = clamp01(crossModal.visual_confidence ?? 0)
  const audioConfidence = clamp01(crossModal.audio_confidence ?? 0)

  const cellSize = visibleCols <= 96 ? 20 : 18
  const perRow = Math.min(visibleCols <= 48 ? 16 : visibleCols <= 96 ? 24 : 32, Math.max(1, visibleCols))
  const heatmapRows = Math.ceil(visibleCols / perRow)
  const heatmapWidth = perRow * cellSize
  const heatmapHeight = heatmapRows * cellSize + 56

  const svgWidth = 1280
  const padding = 48

  const nodeW = 190
  const nodeH = 68
  const pipelineGap = 54
  const pipelineWidth = nodeW * 4 + pipelineGap * 3
  const pipelineX = (svgWidth - pipelineWidth) / 2
  const pipelineY = 64
  const centerY = pipelineY + nodeH / 2

  const inputX = pipelineX
  const columnsX = inputX + nodeW + pipelineGap
  const memoryX = columnsX + nodeW + pipelineGap
  const routingX = memoryX + nodeW + pipelineGap
  const columnsCenterX = columnsX + nodeW / 2

  const sensoryW = 118
  const sensoryH = 42
  const sensoryGap = 28
  const sensoryY = pipelineY + nodeH + 96
  const imageX = columnsCenterX - sensoryGap / 2 - sensoryW
  const audioX = columnsCenterX + sensoryGap / 2

  const heatmapX = (svgWidth - heatmapWidth) / 2
  const heatmapY = sensoryY + sensoryH + 104
  const svgHeight = heatmapY + heatmapHeight + 64

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="min-w-0 overflow-hidden rounded-xl border border-border/40 bg-[#050816]"
    >
      <defs>
        <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#050816" />
          <stop offset="55%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.45" />
        </linearGradient>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
        </marker>
      </defs>

      <rect width={svgWidth} height={svgHeight} rx={18} fill="url(#bg-grad)" />

      <rect
        x={padding - 14}
        y={pipelineY - 24}
        width={svgWidth - (padding - 14) * 2}
        height={sensoryY + sensoryH - pipelineY + 40}
        rx={18}
        fill="#0f172a55"
        stroke="#1f293733"
      />

      <FlowArrow x1={inputX + nodeW} y1={centerY} x2={columnsX} y2={centerY} color={MODALITY_COLORS.text} isActive={hasData} />
      <FlowArrow x1={columnsX + nodeW} y1={centerY} x2={memoryX} y2={centerY} color={LAYER_COLORS.columns.stroke} isActive={winnerId != null} />
      <FlowArrow x1={memoryX + nodeW} y1={centerY} x2={routingX} y2={centerY} color={LAYER_COLORS.memory.stroke} isActive={memoryFill > 0} />

      <LayerNode
        x={inputX}
        y={pipelineY}
        width={nodeW}
        height={nodeH}
        label="Token encoder"
        sublabel="text → spikes"
        color={LAYER_COLORS.input}
        isActive={hasData}
        nodeKey="input"
        selected={targetIs(selectedTarget, 'layer', 'input')}
        onSelect={onSelectTarget}
        tooltip="Token encoder · converts live text windows into spike-friendly input patterns"
      />
      <LayerNode
        x={columnsX}
        y={pipelineY}
        width={nodeW}
        height={nodeH}
        label="Competitive columns"
        sublabel={winnerId != null && winnerId >= 0 ? `winner #${winnerId} · ${nCols.toLocaleString()} total` : `${nCols.toLocaleString()} total`}
        color={LAYER_COLORS.columns}
        isActive={winnerId != null}
        nodeKey="columns"
        selected={targetIs(selectedTarget, 'layer', 'columns')}
        onSelect={onSelectTarget}
        tooltip={`Competitive field · winner ${winnerId != null && winnerId >= 0 ? `#${winnerId}` : 'none'}`}
      />
      <LayerNode
        x={memoryX}
        y={pipelineY}
        width={nodeW}
        height={nodeH}
        label="Memory store"
        sublabel={`fill ${(memoryFill * 100).toFixed(0)}%`}
        color={LAYER_COLORS.memory}
        isActive={memoryFill > 0}
        nodeKey="memory"
        selected={targetIs(selectedTarget, 'layer', 'memory')}
        onSelect={onSelectTarget}
        tooltip={`Memory store · fill ${(memoryFill * 100).toFixed(0)}%`}
      />
      <LayerNode
        x={routingX}
        y={pipelineY}
        width={nodeW}
        height={nodeH}
        label="Routing index"
        sublabel="semantic ANN"
        color={LAYER_COLORS.routing}
        isActive={hasData}
        nodeKey="routing"
        selected={targetIs(selectedTarget, 'layer', 'routing')}
        onSelect={onSelectTarget}
        tooltip="Routing index · semantic nearest-neighbour access into memory/evidence space"
      />

      <FlowCurve
        x1={imageX + sensoryW / 2}
        y1={sensoryY}
        x2={columnsCenterX - 30}
        y2={pipelineY + nodeH}
        color={MODALITY_COLORS.visual}
        isActive={visualConfidence > 0}
        bendY={sensoryY - 34}
      />
      <FlowCurve
        x1={audioX + sensoryW / 2}
        y1={sensoryY}
        x2={columnsCenterX + 30}
        y2={pipelineY + nodeH}
        color={MODALITY_COLORS.audio}
        isActive={audioConfidence > 0}
        bendY={sensoryY - 34}
      />

      <LayerNode
        x={imageX}
        y={sensoryY}
        width={sensoryW}
        height={sensoryH}
        label="Image"
        sublabel={`confidence ${visualConfidence.toFixed(2)}`}
        color={LAYER_COLORS.crossModal}
        isActive={visualConfidence > 0.01}
        nodeKey="visual"
        selected={targetIs(selectedTarget, 'layer', 'visual')}
        onSelect={onSelectTarget}
        tooltip={`Image grounding beam · confidence ${visualConfidence.toFixed(3)}`}
      />
      <LayerNode
        x={audioX}
        y={sensoryY}
        width={sensoryW}
        height={sensoryH}
        label="Audio"
        sublabel={`confidence ${audioConfidence.toFixed(2)}`}
        color={LAYER_COLORS.crossModal}
        isActive={audioConfidence > 0.01}
        nodeKey="audio"
        selected={targetIs(selectedTarget, 'layer', 'audio')}
        onSelect={onSelectTarget}
        tooltip={`Audio grounding beam · confidence ${audioConfidence.toFixed(3)}`}
      />

      <ColumnHeatmap
        x={heatmapX}
        y={heatmapY}
        cellSize={cellSize}
        cols={visibleCols}
        totalCols={nCols}
        activations={visibleActivations}
        winnerId={winnerId}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
      />
    </svg>
  )
})
