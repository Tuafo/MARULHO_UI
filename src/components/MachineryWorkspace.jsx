import { useEffect, useMemo, useRef } from 'react'
import {
  ActivityIcon,
  BrainCircuitIcon,
  CpuIcon,
  DatabaseIcon,
  GitBranchIcon,
  NetworkIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatFloat, formatMode, formatPercent } from '@/lib/dashboard-utils'

const COLORS = {
  background: '#171815',
  panel: '#1f211d',
  border: '#3b3e36',
  text: '#f0f1eb',
  muted: '#a2a69a',
  green: '#67d69a',
  amber: '#e4b866',
  blue: '#70a7e8',
  red: '#e47777',
  line: '#596052',
}

export default function MachineryWorkspace({ columns, runtime, status }) {
  const canvasRef = useRef(null)
  const scope = status?.runtime_scope || {}
  const cuda = scope.cuda_first_runtime || {}
  const devices = cuda.subcortex_tensor_devices || {}
  const memory = status?.memory_store || {}
  const votes = columns.votes || []
  const execution = runtime.execution || {}
  const binding = devices.binding || {}

  const machinery = useMemo(() => {
    const meanPredictionError = average(votes.map((vote) => vote.prediction_error))
    const meanConfidence = average(votes.map((vote) => vote.confidence))
    return {
      source: execution.tick_source_name || runtime.next_source_name || 'no active source',
      sourceCount: runtime.source_count || 0,
      bufferedTokens: runtime.ingestion?.total_buffered_tokens || 0,
      encoder: cuda.encoder_device_report?.encoder || scope.input_representation || 'unobserved',
      encoderDevice: cuda.encoder_device_report?.device || scope.device?.resolved_device || 'unobserved',
      routingDevice: scope.routing_index?.search_device || scope.device?.resolved_device || 'unobserved',
      candidateCount: columns.execution?.candidate_count || 0,
      totalColumns: columns.total_columns || 0,
      awakeCount: columns.awake_count || 0,
      votes,
      meanPredictionError,
      meanConfidence,
      contextNorm: status?.context_state_norm,
      bindingUpdates: binding.hub_evidence_update_count,
      topologyRefreshes: binding.hub_topology_refresh_count,
      memorySize: memory.size || 0,
      memoryCapacity: memory.capacity || 0,
      replayMean: memory.mean_replay_count,
      disagreement: columns.disagreement?.max,
      winner: status?.last_winner,
      phase: execution.tick_phase || 'idle',
      running: Boolean(runtime.running),
      tickActive: Boolean(execution.tick_in_progress),
      tokenCount: status?.token_count || 0,
    }
  }, [
    binding.hub_evidence_update_count,
    binding.hub_topology_refresh_count,
    columns,
    cuda.encoder_device_report,
    execution,
    memory,
    runtime,
    scope,
    status,
    votes,
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    let frame = 0
    let animationFrame = 0

    const draw = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(720, Math.floor(bounds.width))
      const height = Math.max(460, Math.floor(bounds.height))
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio
        canvas.height = height * ratio
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      drawMachinery(context, width, height, machinery, frame)
      if (machinery.running || machinery.tickActive) {
        frame += 1
        animationFrame = window.requestAnimationFrame(draw)
      }
    }

    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    draw()

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(animationFrame)
    }
  }, [machinery])

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-md border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <NetworkIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Live cognitive machinery</h2>
          <div className="ml-auto flex flex-wrap gap-2">
            <Badge variant={machinery.running ? 'default' : 'secondary'}>
              {machinery.running ? 'runtime active' : 'runtime stopped'}
            </Badge>
            <Badge variant="outline">{formatMode(machinery.phase)}</Badge>
            <Badge variant="outline">{machinery.encoderDevice}</Badge>
          </div>
        </div>
        <div className="relative min-h-[560px] overflow-x-auto bg-[#171815]">
          <canvas
            ref={canvasRef}
            className="block h-[min(72vh,760px)] min-h-[560px] w-full min-w-[720px]"
            aria-label="Observed MARULHO machinery flow from source input through sparse columns, memory, and readout"
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <MachineryFacts
          icon={CpuIcon}
          title="Execution"
          items={[
            ['Encoder', `${machinery.encoder} on ${machinery.encoderDevice}`],
            ['Router', `${machinery.candidateCount} / ${machinery.totalColumns} on ${machinery.routingDevice}`],
            ['Tick phase', formatMode(machinery.phase)],
            ['Token count', machinery.tokenCount],
          ]}
        />
        <MachineryFacts
          icon={BrainCircuitIcon}
          title="Column dynamics"
          items={[
            ['Awake', `${machinery.awakeCount} columns`],
            ['Prediction error', formatFloat(machinery.meanPredictionError, 4)],
            ['Confidence', formatFloat(machinery.meanConfidence, 4)],
            ['Disagreement', formatFloat(machinery.disagreement, 4)],
          ]}
        />
        <MachineryFacts
          icon={DatabaseIcon}
          title="State and memory"
          items={[
            ['Context norm', formatFloat(machinery.contextNorm, 4)],
            ['Binding evidence', machinery.bindingUpdates ?? 'unobserved'],
            ['Topology refreshes', machinery.topologyRefreshes ?? 'unobserved'],
            ['Memory fill', formatPercent(safeRatio(machinery.memorySize, machinery.memoryCapacity), 1)],
          ]}
        />
      </div>

      <section className="rounded-md border bg-card p-4">
        <div className="flex items-start gap-3">
          <GitBranchIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">Evidence boundary</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Moving connectors mean the runtime reports active work. Column points are the current server-reported
              vote sample. Sleeping columns remain aggregated because the execution scheduler has not yet promoted
              cached votes or sleep states into the live tick.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function MachineryFacts({ icon: Icon, items, title }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <dl className="divide-y px-4">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="max-w-[65%] break-words text-right font-medium tabular-nums">{value ?? 'n/a'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function drawMachinery(context, width, height, data, frame) {
  context.clearRect(0, 0, width, height)
  context.fillStyle = COLORS.background
  context.fillRect(0, 0, width, height)

  const margin = Math.max(28, width * 0.028)
  const active = data.running || data.tickActive
  const activeKey = phaseStage(data.phase)
  const leftWidth = Math.max(132, width * 0.145)
  const rightWidth = Math.max(148, width * 0.16)
  const field = {
    x: margin + leftWidth + width * 0.075,
    y: height * 0.235,
    width: Math.max(300, width - margin * 2 - leftWidth - rightWidth - width * 0.15),
    height: height * 0.48,
  }
  const input = { x: margin, y: field.y + field.height * 0.16, width: leftWidth, height: 92 }
  const encoder = { x: margin, y: field.y + field.height * 0.59, width: leftWidth, height: 92 }
  const contextNode = {
    x: field.x + field.width * 0.08,
    y: Math.max(58, field.y - 112),
    width: Math.min(184, field.width * 0.42),
    height: 72,
  }
  const bindingNode = {
    x: field.x + field.width * 0.57,
    y: Math.max(58, field.y - 112),
    width: Math.min(184, field.width * 0.38),
    height: 72,
  }
  const memoryNode = {
    x: field.x + field.width * 0.12,
    y: field.y + field.height + 52,
    width: Math.min(220, field.width * 0.46),
    height: 70,
  }
  const replayNode = {
    x: field.x + field.width * 0.64,
    y: field.y + field.height + 52,
    width: Math.min(170, field.width * 0.32),
    height: 70,
  }
  const readout = {
    x: width - margin - rightWidth,
    y: field.y + field.height * 0.26,
    width: rightWidth,
    height: 126,
  }

  drawPlaneGrid(context, width, height)
  drawPlaneHeader(context, margin, data)

  drawFlow(context, input.x + input.width, input.y + input.height / 2, field.x, field.y + field.height * 0.34, {
    active,
    color: COLORS.green,
    frame,
    label: 'grounded drive',
  })
  drawFlow(context, encoder.x + encoder.width, encoder.y + encoder.height / 2, field.x, field.y + field.height * 0.7, {
    active,
    color: COLORS.blue,
    frame: frame + 10,
    label: 'spike code',
  })
  drawFlow(context, contextNode.x + contextNode.width / 2, contextNode.y + contextNode.height, field.x + field.width * 0.34, field.y, {
    active: activeKey === 'bind' || activeKey === 'columns',
    color: COLORS.blue,
    frame,
    label: 'state bias',
  })
  drawFlow(context, bindingNode.x + bindingNode.width / 2, bindingNode.y + bindingNode.height, field.x + field.width * 0.72, field.y, {
    active: activeKey === 'bind',
    color: COLORS.amber,
    frame: frame + 17,
    label: 'association',
  })
  drawFlow(context, field.x + field.width, field.y + field.height * 0.5, readout.x, readout.y + readout.height * 0.48, {
    active,
    color: COLORS.green,
    frame: frame + 6,
    label: 'votes',
  })
  drawFlow(context, field.x + field.width * 0.34, field.y + field.height, memoryNode.x + memoryNode.width * 0.52, memoryNode.y, {
    active: activeKey === 'columns',
    color: COLORS.amber,
    frame,
    label: 'encode',
  })
  drawFlow(context, memoryNode.x + memoryNode.width, memoryNode.y + memoryNode.height * 0.54, replayNode.x, replayNode.y + replayNode.height * 0.54, {
    active: false,
    color: COLORS.amber,
    frame,
    label: 'slow path',
  })
  drawFeedback(context, replayNode, field, data, frame)
  drawFeedback(context, readout, bindingNode, data, frame)

  drawModule(context, input, {
    eyebrow: 'GROUNDING INPUT',
    title: truncate(data.source, 18),
    detail: `${data.bufferedTokens} buffered tokens`,
    footer: `${data.sourceCount} sources`,
    active: activeKey === 'input',
  })
  drawModule(context, encoder, {
    eyebrow: 'SPIKE ENCODER',
    title: truncate(data.encoder, 18),
    detail: `token ${data.tokenCount}`,
    footer: data.encoderDevice,
    active: activeKey === 'encode',
    accent: COLORS.blue,
  })
  drawModule(context, contextNode, {
    eyebrow: 'CONTEXT STATE',
    title: `${formatFloat(data.contextNorm, 4)} norm`,
    detail: 'adaptive control',
    compact: true,
    active: activeKey === 'bind',
    accent: COLORS.blue,
  })
  drawModule(context, bindingNode, {
    eyebrow: 'BINDING HUB',
    title: `${data.bindingUpdates ?? 0} evidence updates`,
    detail: `${data.topologyRefreshes ?? 0} topology refreshes`,
    compact: true,
    active: activeKey === 'bind',
    accent: COLORS.amber,
  })
  drawColumnField(context, field, data, activeKey)
  drawModule(context, memoryNode, {
    eyebrow: 'SPARSE MEMORY',
    title: `${data.memorySize} / ${data.memoryCapacity} patterns`,
    detail: `${formatPercent(safeRatio(data.memorySize, data.memoryCapacity), 1)} occupied`,
    compact: true,
    accent: COLORS.amber,
    progress: safeRatio(data.memorySize, data.memoryCapacity),
  })
  drawModule(context, replayNode, {
    eyebrow: 'REPLAY WINDOW',
    title: data.replayMean == null ? 'not observed' : `${formatFloat(data.replayMean, 2)} mean`,
    detail: 'explicit slow path',
    compact: true,
    accent: COLORS.amber,
  })
  drawReadout(context, readout, data, activeKey)
  drawLegend(context, width - margin - 306, height - 25, active)
}

function drawPlaneGrid(context, width, height) {
  context.save()
  context.strokeStyle = '#252720'
  context.lineWidth = 1
  for (let x = 0; x <= width; x += 32) {
    context.beginPath()
    context.moveTo(x + 0.5, 0)
    context.lineTo(x + 0.5, height)
    context.stroke()
  }
  for (let y = 0; y <= height; y += 32) {
    context.beginPath()
    context.moveTo(0, y + 0.5)
    context.lineTo(width, y + 0.5)
    context.stroke()
  }
  context.restore()
}

function drawPlaneHeader(context, x, data) {
  context.fillStyle = COLORS.muted
  context.font = '600 10px Geist, sans-serif'
  context.fillText('OBSERVED RUNTIME PLANE', x, 25)
  context.fillStyle = COLORS.text
  context.font = '600 13px Geist, sans-serif'
  context.fillText(
    data.running || data.tickActive ? 'Live execution telemetry' : 'Latest coherent stopped-state telemetry',
    x,
    45,
  )
}

function drawModule(context, box, options) {
  const accent = options.accent || COLORS.green
  roundedRect(context, box.x, box.y, box.width, box.height, 6)
  context.fillStyle = options.active ? tint(accent) : COLORS.panel
  context.fill()
  context.strokeStyle = options.active ? accent : COLORS.border
  context.lineWidth = options.active ? 2 : 1
  context.stroke()

  context.fillStyle = options.active ? accent : COLORS.muted
  context.font = '600 10px Geist, sans-serif'
  context.fillText(options.eyebrow, box.x + 12, box.y + 18)
  context.fillStyle = COLORS.text
  context.font = `600 ${options.compact ? 12 : 13}px Geist, sans-serif`
  context.fillText(truncate(options.title, options.compact ? 26 : 20), box.x + 12, box.y + 40)
  context.fillStyle = COLORS.muted
  context.font = '11px Geist, sans-serif'
  context.fillText(truncate(options.detail, 28), box.x + 12, box.y + 58)

  if (options.footer) {
    context.fillStyle = accent
    context.font = '10px Geist, sans-serif'
    context.fillText(truncate(options.footer, 18), box.x + 12, box.y + box.height - 10)
  }
  if (Number.isFinite(options.progress)) {
    const progress = Math.min(1, Math.max(0, options.progress))
    context.fillStyle = '#30332d'
    context.fillRect(box.x + 12, box.y + box.height - 7, box.width - 24, 3)
    context.fillStyle = progress > 0.85 ? COLORS.red : accent
    context.fillRect(box.x + 12, box.y + box.height - 7, (box.width - 24) * progress, 3)
  }
}

function drawColumnField(context, field, data, activeKey) {
  roundedRect(context, field.x, field.y, field.width, field.height, 8)
  context.fillStyle = activeKey === 'columns' ? '#202920' : '#1b1d19'
  context.fill()
  context.strokeStyle = activeKey === 'columns' ? COLORS.green : COLORS.border
  context.lineWidth = activeKey === 'columns' ? 2 : 1
  context.stroke()

  context.fillStyle = COLORS.muted
  context.font = '600 10px Geist, sans-serif'
  context.fillText('SPARSE PREDICTIVE COLUMN FIELD', field.x + 14, field.y + 21)
  context.fillStyle = COLORS.text
  context.font = '600 13px Geist, sans-serif'
  context.fillText(`${data.awakeCount} awake / ${data.totalColumns} registered`, field.x + 14, field.y + 43)
  context.fillStyle = COLORS.muted
  context.font = '11px Geist, sans-serif'
  context.fillText(`${data.candidateCount} routed candidates on ${truncate(data.routingDevice, 18)}`, field.x + 14, field.y + 61)

  const grid = { x: field.x + 15, y: field.y + 79, width: field.width - 30, height: field.height - 95 }
  const cols = Math.max(8, Math.floor(grid.width / 31))
  const rows = Math.max(4, Math.floor(grid.height / 31))
  const totalSlots = cols * rows
  const voteBySlot = new Map()
  data.votes.slice(0, totalSlots).forEach((vote) => {
    const slot = Math.abs(Number(vote.column_id) || 0) % totalSlots
    let candidate = slot
    while (voteBySlot.has(candidate)) candidate = (candidate + 1) % totalSlots
    voteBySlot.set(candidate, vote)
  })

  for (let index = 0; index < totalSlots; index += 1) {
    const column = index % cols
    const row = Math.floor(index / cols)
    const x = grid.x + (column + 0.5) * (grid.width / cols)
    const y = grid.y + (row + 0.5) * (grid.height / rows)
    const vote = voteBySlot.get(index)
    if (!vote) {
      context.beginPath()
      context.arc(x, y, 2, 0, Math.PI * 2)
      context.fillStyle = '#454940'
      context.fill()
      continue
    }

    const winner = vote.role === 'recent_winner' || Number(vote.column_id) === Number(data.winner)
    const radius = winner ? 8 : 5.5
    context.beginPath()
    context.arc(x, y, radius + 4, 0, Math.PI * 2)
    context.fillStyle = winner ? 'rgba(228,184,102,0.12)' : 'rgba(103,214,154,0.09)'
    context.fill()
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fillStyle = winner ? COLORS.amber : COLORS.green
    context.fill()
    context.fillStyle = COLORS.text
    context.font = '600 9px Geist, sans-serif'
    context.textAlign = 'center'
    context.fillText(String(vote.column_id), x, y - radius - 6)
    context.textAlign = 'left'
  }

  context.fillStyle = COLORS.muted
  context.font = '10px Geist, sans-serif'
  context.fillText(
    `${formatFloat(data.meanPredictionError, 3)} prediction error  |  ${formatFloat(data.meanConfidence, 3)} confidence`,
    field.x + 14,
    field.y + field.height - 10,
  )
}

function drawReadout(context, box, data, activeKey) {
  drawModule(context, box, {
    eyebrow: 'COLUMN CONSENSUS',
    title: `winner ${data.winner ?? 'n/a'}`,
    detail: `${formatFloat(data.disagreement, 3)} disagreement`,
    active: activeKey === 'readout',
  })
  context.fillStyle = COLORS.muted
  context.font = '10px Geist, sans-serif'
  context.fillText(`${data.votes.length} observed votes`, box.x + 12, box.y + 81)
  context.fillText(`${formatFloat(data.meanConfidence, 3)} mean confidence`, box.x + 12, box.y + 98)
  context.fillStyle = data.running ? COLORS.green : COLORS.blue
  context.fillText(data.running ? 'live readout' : 'last observed readout', box.x + 12, box.y + 115)
}

function drawFeedback(context, from, to, data, frame) {
  const fromX = from.x + from.width * 0.55
  const fromY = from.y
  const toX = to.x + to.width * 0.75
  const toY = to.y + to.height
  drawFlow(context, fromX, fromY, toX, toY, {
    active: data.running && data.tickActive,
    color: COLORS.amber,
    frame: frame + 22,
    feedback: true,
  })
}

function drawFlow(context, startX, startY, endX, endY, options) {
  const bend = Math.max(28, Math.abs(endX - startX) * 0.34)
  context.save()
  context.beginPath()
  context.moveTo(startX, startY)
  if (options.feedback) {
    context.bezierCurveTo(startX, startY - bend, endX, endY + bend, endX, endY)
  } else {
    context.bezierCurveTo(startX + bend, startY, endX - bend, endY, endX, endY)
  }
  context.setLineDash([5, 7])
  context.lineDashOffset = options.active ? -(options.frame % 24) : 0
  context.strokeStyle = options.active ? options.color : COLORS.line
  context.lineWidth = options.active ? 2 : 1.25
  context.stroke()
  context.restore()
  drawArrowHead(context, endX, endY, options.color, options.active)
  if (options.label) {
    const labelX = (startX + endX) / 2
    const labelY = (startY + endY) / 2 - 7
    context.font = '9px Geist, sans-serif'
    const labelWidth = context.measureText(options.label).width + 10
    context.fillStyle = COLORS.background
    context.fillRect(labelX - labelWidth / 2, labelY - 9, labelWidth, 14)
    context.fillStyle = options.active ? options.color : COLORS.muted
    context.textAlign = 'center'
    context.fillText(options.label, labelX, labelY + 1)
    context.textAlign = 'left'
  }
}

function drawArrowHead(context, x, y, color, active) {
  context.save()
  context.fillStyle = active ? color : COLORS.line
  context.beginPath()
  context.moveTo(x, y)
  context.lineTo(x - 7, y - 4)
  context.lineTo(x - 7, y + 4)
  context.closePath()
  context.fill()
  context.restore()
}

function drawLegend(context, x, y, active) {
  const entries = [
    [COLORS.green, 'awake / active path'],
    [COLORS.amber, 'winner / replay'],
    ['#454940', 'idle registered columns'],
  ]
  context.font = '10px Geist, sans-serif'
  entries.forEach(([color, label], index) => {
    const offset = index * 102
    context.beginPath()
    context.arc(x + offset, y, 3, 0, Math.PI * 2)
    context.fillStyle = color
    context.fill()
    context.fillStyle = COLORS.muted
    context.fillText(label, x + offset + 8, y + 3)
  })
  if (!active) {
    context.fillStyle = COLORS.muted
  }
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function tint(color) {
  if (color === COLORS.amber) return '#322b1e'
  if (color === COLORS.blue) return '#202a35'
  return '#203027'
}

function phaseStage(phase) {
  const value = String(phase || '').toLowerCase()
  if (value.includes('source') || value.includes('collect')) return 'input'
  if (value.includes('encode')) return 'encode'
  if (value.includes('route') || value.includes('select')) return 'route'
  if (value.includes('train') || value.includes('column')) return 'columns'
  if (value.includes('bind') || value.includes('context')) return 'bind'
  if (value.includes('final')) return 'readout'
  return null
}

function average(values) {
  const finite = values.map(Number).filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
}

function safeRatio(value, total) {
  const numerator = Number(value)
  const denominator = Number(total)
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? numerator / denominator
    : 0
}

function truncate(value, limit) {
  const text = String(value || 'unobserved')
  return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1))}...` : text
}
