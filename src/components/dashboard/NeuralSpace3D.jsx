import { memo, useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import {
  AudioLinesIcon,
  BoxIcon,
  BrainIcon,
  EyeIcon,
  GaugeIcon,
  LayersIcon,
  LinkIcon,
  RefreshCwIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, HelpTip, SectionHeading } from '@/components/dashboard/shared'
import { formatCompactNumber, formatFloat, formatPercent } from '@/lib/dashboard-utils'
import { useTelemetryStore } from '@/stores/telemetryStore'

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */
const LAYER_SPACING = 3.5
const BASE_COLOR = new THREE.Color('#1e40af')
const WINNER_COLOR = new THREE.Color('#a855f7')
const VISUAL_COLOR = new THREE.Color('#10b981')
const AUDIO_COLOR = new THREE.Color('#f59e0b')
const LERP_TARGET = new THREE.Color()

const tempObj = new THREE.Object3D()
const tempColor = new THREE.Color()

const MAX_VIS_COLUMNS = 512

const LAYER_Y = {
  input: LAYER_SPACING * 2,
  columns: LAYER_SPACING,
  context: 0,
  stdp: -LAYER_SPACING * 0.5,
  binding: -LAYER_SPACING,
  memory: -LAYER_SPACING * 2,
}

function clamp01(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

/* -------------------------------------------------------------------------- */
/*  Layout helper — adapts spread to column count                              */
/* -------------------------------------------------------------------------- */
function columnLayout(nCols) {
  const visCols = Math.min(nCols, MAX_VIS_COLUMNS)
  const perRow = Math.ceil(Math.sqrt(visCols))
  const maxExtent = 12
  const spread = Math.min(1.4, maxExtent / Math.max(perRow - 1, 1))
  const positions = []
  for (let i = 0; i < visCols; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const x = (col - (perRow - 1) / 2) * spread
    const z = (row - (Math.ceil(visCols / perRow) - 1) / 2) * spread
    positions.push([x, 0, z])
  }
  const extent = Math.max(perRow * spread, 4)
  return { positions, extent, visCols, spread }
}

/* -------------------------------------------------------------------------- */
/*  Data Flow Particles                                                        */
/* -------------------------------------------------------------------------- */
function DataFlowParticles({ fromY, toY, color, count = 12, active = true, extent = 4 }) {
  const meshRef = useRef()
  const phases = useMemo(() => Array.from({ length: count }, () => Math.random()), [count])
  const radius = extent * 0.15

  useFrame((_, delta) => {
    if (!meshRef.current || !active) return
    for (let i = 0; i < count; i++) {
      phases[i] = (phases[i] + delta * (0.3 + i * 0.02)) % 1
      const t = phases[i]
      const x = Math.sin(t * Math.PI * 2 + i) * radius
      const z = Math.cos(t * Math.PI * 2 + i * 0.7) * radius
      const y = fromY + (toY - fromY) * t
      tempObj.position.set(x, y, z)
      tempObj.scale.setScalar(0.04 + 0.02 * Math.sin(t * Math.PI))
      tempObj.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObj.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  if (!active) return null

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.8}
        transparent
        opacity={0.7}
      />
    </instancedMesh>
  )
}

/* -------------------------------------------------------------------------- */
/*  Column Nodes                                                               */
/* -------------------------------------------------------------------------- */
function ColumnNodes({ visible, layout }) {
  const meshRef = useRef()
  const prevWinner = useRef(-1)
  const pulsePhase = useRef(0)

  const animation = useTelemetryStore((state) => state.animation)
  const activations = Array.isArray(animation?.activations) ? animation.activations : []
  const winnerId = animation?.winner_id ?? -1

  const { positions, visCols, spread } = layout
  const colorArray = useMemo(() => new Float32Array(Math.max(visCols, 1) * 3), [visCols])

  const geoDetail = visCols > 256 ? 1 : visCols > 64 ? 2 : 3
  const sphereRadius = Math.min(0.35, spread * 0.35)

  useEffect(() => {
    if (!meshRef.current || visCols === 0) return
    for (let i = 0; i < visCols; i++) {
      const [x, , z] = positions[i]
      tempObj.position.set(x, LAYER_Y.columns, z)
      tempObj.scale.set(1, 1, 1)
      tempObj.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObj.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [visCols, positions])

  useFrame((_, delta) => {
    if (!meshRef.current || visCols === 0 || !visible) return

    if (winnerId !== prevWinner.current) {
      pulsePhase.current = 0
      prevWinner.current = winnerId
    }
    pulsePhase.current += delta * 4

    for (let i = 0; i < visCols; i++) {
      const act = activations[i] ?? 0
      const intensity = Math.min(Number(act || 0) * 2.5, 1)
      const isWinner = i === winnerId

      const baseScale = 0.25 + intensity * 0.4
      const scale = isWinner
        ? baseScale * (1 + 0.25 * Math.sin(pulsePhase.current))
        : baseScale

      const [x, , z] = positions[i]
      tempObj.position.set(x, LAYER_Y.columns, z)
      tempObj.scale.setScalar(scale)
      tempObj.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObj.matrix)

      if (isWinner) {
        tempColor.copy(WINNER_COLOR)
      } else {
        tempColor.copy(BASE_COLOR)
        LERP_TARGET.set(0.376, 0.647, 0.98)
        tempColor.lerp(LERP_TARGET, intensity)
      }
      colorArray[i * 3] = tempColor.r
      colorArray[i * 3 + 1] = tempColor.g
      colorArray[i * 3 + 2] = tempColor.b
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.geometry.setAttribute(
      'color',
      new THREE.InstancedBufferAttribute(colorArray, 3),
    )
  })

  if (visCols === 0 || !visible) return null

  return (
    <instancedMesh ref={meshRef} args={[null, null, visCols]} frustumCulled={false}>
      <icosahedronGeometry args={[sphereRadius, geoDetail]} />
      <meshStandardMaterial
        vertexColors
        emissive="#1e40af"
        emissiveIntensity={0.3}
        roughness={0.4}
        metalness={0.6}
        transparent
        opacity={0.9}
      />
    </instancedMesh>
  )
}

function WinnerHalo({ visible, layout }) {
  const haloRef = useRef()
  const winnerId = useTelemetryStore((state) => state.animation?.winner_id ?? -1)

  useFrame(({ clock }) => {
    if (!haloRef.current || !visible) return
    const t = clock.getElapsedTime()
    haloRef.current.rotation.x = Math.PI / 2
    haloRef.current.scale.setScalar(0.95 + 0.15 * Math.sin(t * 3))
    haloRef.current.material.opacity = 0.25 + 0.15 * (0.5 + 0.5 * Math.sin(t * 4))
  })

  if (!visible || winnerId < 0 || winnerId >= layout.visCols) return null

  const [x, , z] = layout.positions[winnerId]
  return (
    <mesh ref={haloRef} position={[x, LAYER_Y.columns - 0.12, z]}>
      <torusGeometry args={[0.34, 0.03, 10, 32]} />
      <meshStandardMaterial color="#c4b5fd" emissive="#a78bfa" emissiveIntensity={0.8} transparent opacity={0.35} />
    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/*  Layer slabs                                                                */
/* -------------------------------------------------------------------------- */
function LayerSlab({ position, label, color, emissiveIntensity = 0.15, opacity = 0.4, extent = 4, visible = true }) {
  if (!visible) return null
  const size = extent + 1
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[size, 0.15, size]} />
        <meshStandardMaterial
          color={new THREE.Color(color).multiplyScalar(0.3)}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
        />
      </mesh>
      <Billboard position={[0, 0.5, size / 2 + 0.3]}>
        <Text fontSize={0.22} color={color} anchorY="bottom">
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

function InputLayer({ visible, extent }) {
  return <LayerSlab position={[0, LAYER_Y.input, 0]} label="Token encoder" color="#3b82f6" visible={visible} extent={extent} />
}

function ContextLayer({ visible, extent }) {
  const contextTau = useTelemetryStore((state) => state.animation?.context_tau)
  const avgTau = contextTau && contextTau.length > 0
    ? contextTau.reduce((sum, value) => sum + value, 0) / contextTau.length
    : 0

  return (
    <LayerSlab
      position={[0, LAYER_Y.context, 0]}
      label={`Context (τ=${avgTau.toFixed(2)})`}
      color="#06b6d4"
      emissiveIntensity={0.1 + Math.min(avgTau, 1) * 0.3}
      visible={visible}
      extent={extent}
    />
  )
}

function STDPLayer({ visible, extent }) {
  const stdp = useTelemetryStore((state) => state.animation?.stdp)

  return (
    <LayerSlab
      position={[0, LAYER_Y.stdp, 0]}
      label={`STDP (w=${stdp?.mean_weight?.toFixed(3) ?? '—'})`}
      color="#f43f5e"
      emissiveIntensity={0.12}
      visible={visible}
      extent={extent * 0.9}
    />
  )
}

function BindingLayer({ visible, extent }) {
  const binding = useTelemetryStore((state) => state.animation?.binding)
  const nBinding = binding?.n_binding_neurons ?? 0

  return (
    <LayerSlab
      position={[0, LAYER_Y.binding, 0]}
      label={`Binding (${nBinding}n)`}
      color="#8b5cf6"
      emissiveIntensity={0.15}
      visible={visible}
      extent={extent}
    />
  )
}

function MemoryLayer({ visible, extent }) {
  const memoryFill = useTelemetryStore((state) => state.memoryFill)
  const fillScale = 0.1 + memoryFill * 0.9
  const size = extent + 1

  if (!visible) return null

  return (
    <group position={[0, LAYER_Y.memory, 0]}>
      <mesh>
        <boxGeometry args={[size, 0.15, size]} />
        <meshStandardMaterial
          color="#164e63"
          emissive="#22d3ee"
          emissiveIntensity={0.1 + memoryFill * 0.3}
          transparent
          opacity={0.4}
        />
      </mesh>
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[size * fillScale, 0.1, size * fillScale]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.4}
          transparent
          opacity={0.5}
        />
      </mesh>
      <Billboard position={[0, 0.5, size / 2 + 0.3]}>
        <Text fontSize={0.22} color="#22d3ee" anchorY="bottom">
          {`Memory (${(memoryFill * 100).toFixed(0)}%)`}
        </Text>
      </Billboard>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Cross-modal beams                                                          */
/* -------------------------------------------------------------------------- */
function CrossModalBeams({ visible, extent }) {
  const crossModal = useTelemetryStore((state) => state.crossModal)
  if (!crossModal || !visible) return null

  const vConf = clamp01(crossModal.visual_confidence || 0)
  const aConf = clamp01(crossModal.audio_confidence || 0)
  const beamX = extent / 2 + 1.5

  return (
    <group>
      {vConf > 0.01 && (
        <group position={[-beamX, LAYER_Y.columns, 0]}>
          <mesh>
            <cylinderGeometry args={[0.04 + vConf * 0.12, 0.04, 1.8, 8]} />
            <meshStandardMaterial
              color={VISUAL_COLOR}
              emissive={VISUAL_COLOR}
              emissiveIntensity={0.3 + vConf * 0.5}
              transparent
              opacity={0.4 + vConf * 0.4}
            />
          </mesh>
          <Billboard position={[0, 1.2, 0]}>
            <Text fontSize={0.18} color="#10b981">
              {`Image ${(vConf * 100).toFixed(0)}%`}
            </Text>
          </Billboard>
        </group>
      )}
      {aConf > 0.01 && (
        <group position={[beamX, LAYER_Y.columns, 0]}>
          <mesh>
            <cylinderGeometry args={[0.04 + aConf * 0.12, 0.04, 1.8, 8]} />
            <meshStandardMaterial
              color={AUDIO_COLOR}
              emissive={AUDIO_COLOR}
              emissiveIntensity={0.3 + aConf * 0.5}
              transparent
              opacity={0.4 + aConf * 0.4}
            />
          </mesh>
          <Billboard position={[0, 1.2, 0]}>
            <Text fontSize={0.18} color="#f59e0b">
              {`Audio ${(aConf * 100).toFixed(0)}%`}
            </Text>
          </Billboard>
        </group>
      )}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/*  Ambient lighting                                                           */
/* -------------------------------------------------------------------------- */
function AmbientGlow() {
  const dopamine = useTelemetryStore((state) => state.dopamine)
  const norepinephrine = useTelemetryStore((state) => state.norepinephrine)
  const lightRef = useRef()

  useFrame(() => {
    if (!lightRef.current) return
    const intensity = 0.3 + dopamine * 0.4 + norepinephrine * 0.3
    lightRef.current.intensity = intensity
    const r = 0.1 + dopamine * 0.5
    const g = 0.05 + (1 - norepinephrine) * 0.2
    const b = 0.3
    lightRef.current.color.setRGB(r, g, b)
  })

  return (
    <>
      <ambientLight intensity={0.12} />
      <pointLight ref={lightRef} position={[0, 8, 0]} intensity={0.5} distance={35} />
      <pointLight position={[-8, -4, 8]} intensity={0.08} color="#1e3a5f" />
      <pointLight position={[8, -4, -8]} intensity={0.08} color="#312e81" />
    </>
  )
}

function GroundGrid({ extent }) {
  return (
    <gridHelper
      args={[Math.max(10, extent * 2.5), Math.max(10, Math.round(extent * 2)), '#1d4ed8', '#0f172a']}
      position={[0, LAYER_Y.memory - 1.2, 0]}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Auto-fit camera                                                            */
/* -------------------------------------------------------------------------- */
function CameraFit({ extent, resetToken, focusMode = 'overview', winnerPosition = null }) {
  const { camera } = useThree()
  const prevSignature = useRef('')

  useEffect(() => {
    const winnerKey = Array.isArray(winnerPosition) ? winnerPosition.join(':') : 'none'
    const signature = `${extent}:${resetToken}:${focusMode}:${winnerKey}`
    if (signature === prevSignature.current) return
    prevSignature.current = signature

    if (focusMode === 'winner' && Array.isArray(winnerPosition)) {
      const [x, , z] = winnerPosition
      const dist = Math.max(extent * 0.38, 4.8)
      camera.position.set(x + dist, LAYER_Y.columns + 2.4, z + dist)
      camera.lookAt(x, LAYER_Y.columns, z)
      camera.updateProjectionMatrix()
      return
    }

    const dist = Math.max(extent * 1.3, 16)
    camera.position.set(0, extent * 0.4 + 2, dist)
    camera.lookAt(0, 0.5, 0)
    camera.updateProjectionMatrix()
  }, [extent, camera, resetToken, focusMode, winnerPosition])

  return null
}

/* -------------------------------------------------------------------------- */
/*  Scene                                                                      */
/* -------------------------------------------------------------------------- */
function Scene({ autoRotate, layers, resetToken, focusMode }) {
  const animation = useTelemetryStore((state) => state.animation)
  const nCols = animation?.n_columns || 0
  const winnerId = animation?.winner_id ?? -1
  const hasData = nCols > 0

  const layout = useMemo(() => columnLayout(Math.max(nCols, 1)), [nCols])
  const { extent } = layout
  const winnerPosition = winnerId >= 0 && winnerId < layout.visCols ? layout.positions[winnerId] : null

  return (
    <>
      <fog attach="fog" args={['#030712', 12, 42]} />
      <AmbientGlow />
      <GroundGrid extent={extent} />
      <CameraFit extent={extent} resetToken={resetToken} focusMode={focusMode} winnerPosition={winnerPosition} />

      <InputLayer visible={layers.input} extent={extent} />
      <ColumnNodes visible={layers.columns} layout={layout} />
      <WinnerHalo visible={layers.columns} layout={layout} />
      <ContextLayer visible={layers.context} extent={extent} />
      <STDPLayer visible={layers.stdp} extent={extent} />
      <BindingLayer visible={layers.binding} extent={extent} />
      <MemoryLayer visible={layers.memory} extent={extent} />
      <CrossModalBeams visible={layers.crossModal} extent={extent} />

      {hasData && layers.input && layers.columns && (
        <DataFlowParticles fromY={LAYER_Y.input} toY={LAYER_Y.columns} color="#3b82f6" count={8} extent={extent} />
      )}
      {winnerId >= 0 && layers.columns && layers.context && (
        <DataFlowParticles fromY={LAYER_Y.columns} toY={LAYER_Y.context} color="#a78bfa" count={6} extent={extent} />
      )}
      {winnerId >= 0 && layers.binding && layers.memory && (
        <DataFlowParticles fromY={LAYER_Y.binding} toY={LAYER_Y.memory} color="#22d3ee" count={6} extent={extent} />
      )}

      {winnerId >= 0 && (
        <Billboard position={[0, LAYER_Y.input + 1.2, 0]}>
          <Text fontSize={0.2} color="#a78bfa">
            {`Winner: #${winnerId}`}
          </Text>
        </Billboard>
      )}

      {nCols > MAX_VIS_COLUMNS && (
        <Billboard position={[0, LAYER_Y.columns + 1.2, 0]}>
          <Text fontSize={0.18} color="#fbbf24">
            {`Showing ${MAX_VIS_COLUMNS} of ${nCols.toLocaleString()} columns`}
          </Text>
        </Billboard>
      )}

      <OrbitControls
        enablePan
        minDistance={5}
        maxDistance={60}
        autoRotate={autoRotate}
        autoRotateSpeed={0.2}
        maxPolarAngle={Math.PI * 0.85}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Overlay HUD                                                                */
/* -------------------------------------------------------------------------- */
function NeuromodPill({ label, value, color }) {
  const pct = Math.round(clamp01(value) * 100)
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 backdrop-blur-sm">
      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color, opacity: 0.3 + clamp01(value) * 0.7 }} />
      <span className="text-[9px] font-medium text-white/50">{label}</span>
      <span className="text-[9px] font-semibold text-white/80">{pct}%</span>
    </div>
  )
}

function NeuralOverlay({ layers, toggleLayer }) {
  const tokenCount = useTelemetryStore((state) => state.tokenCount)
  const winnerId = useTelemetryStore((state) => state.animation?.winner_id)
  const nCols = useTelemetryStore((state) => state.animation?.n_columns || 0)
  const dopamine = useTelemetryStore((state) => state.dopamine)
  const serotonin = useTelemetryStore((state) => state.serotonin)
  const acetylcholine = useTelemetryStore((state) => state.acetylcholine)
  const norepinephrine = useTelemetryStore((state) => state.norepinephrine)

  const layerNames = [
    ['input', 'Input', '#3b82f6'],
    ['columns', 'Columns', '#a855f7'],
    ['context', 'Context', '#06b6d4'],
    ['stdp', 'STDP', '#f43f5e'],
    ['binding', 'Binding', '#8b5cf6'],
    ['memory', 'Memory', '#22d3ee'],
    ['crossModal', 'Cross-modal', '#10b981'],
  ]

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40">Neural Space</div>
          <div className="text-sm font-semibold text-white/90">{nCols.toLocaleString()} columns</div>
        </div>
        <div className="rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm text-center">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40">Winner</div>
          <div className="text-sm font-semibold text-white/90">{winnerId != null && winnerId >= 0 ? `#${winnerId}` : '—'}</div>
        </div>
        <div className="rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40">Tokens</div>
          <div className="text-sm font-semibold text-white/90">{tokenCount.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          <NeuromodPill label="DA" value={dopamine} color="#f59e0b" />
          <NeuromodPill label="5-HT" value={serotonin} color="#3b82f6" />
          <NeuromodPill label="ACh" value={acetylcholine} color="#10b981" />
          <NeuromodPill label="NE" value={norepinephrine} color="#ef4444" />
        </div>

        <div className="pointer-events-auto flex flex-col gap-0.5 rounded-lg bg-black/70 px-2 py-1.5 backdrop-blur-sm">
          {layerNames.map(([key, name, color]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleLayer(key)}
              className="flex items-center gap-1.5 text-[10px] transition-colors hover:text-white/90"
              style={{ color: layers[key] ? color : 'rgba(255,255,255,0.25)' }}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: layers[key] ? color : 'rgba(255,255,255,0.15)' }} />
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ description, icon: Icon, title, value, badge }) {
  return (
    <Card size="sm" className="bg-card/90">
      <CardHeader className="border-b">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {badge ? <CardAction>{badge}</CardAction> : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  )
}

function ModBar({ colorClass, label, value }) {
  return (
    <div className="space-y-1.5 rounded-xl border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{formatPercent(value, 0)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div className={colorClass} style={{ width: `${Math.max(6, Math.round(clamp01(value) * 100))}%`, height: '100%' }} />
      </div>
    </div>
  )
}

function LegendSwatch({ color, label }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/10 px-3 py-2 text-xs">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

function NeuralSpace3D() {
  const animation = useTelemetryStore((state) => state.animation)
  const crossModal = useTelemetryStore((state) => state.crossModal)
  const brainRuntime = useTelemetryStore((state) => state.brainRuntime)
  const tokenCount = useTelemetryStore((state) => state.tokenCount)
  const memoryFill = useTelemetryStore((state) => state.memoryFill)
  const dopamine = useTelemetryStore((state) => state.dopamine)
  const serotonin = useTelemetryStore((state) => state.serotonin)
  const acetylcholine = useTelemetryStore((state) => state.acetylcholine)
  const norepinephrine = useTelemetryStore((state) => state.norepinephrine)

  const nCols = animation?.n_columns || 0
  const winnerId = animation?.winner_id ?? null
  const activations = Array.isArray(animation?.activations) ? animation.activations : []
  const peakActivation = activations.length ? Math.max(...activations) : 0
  const visualConfidence = clamp01(crossModal?.visual_confidence ?? 0)
  const audioConfidence = clamp01(crossModal?.audio_confidence ?? 0)
  const focusTerms = Array.isArray(brainRuntime?.multimodal?.focus_terms)
    ? brainRuntime.multimodal.focus_terms
    : []

  const hasData = nCols > 0
  const layout = useMemo(() => columnLayout(Math.max(nCols, 1)), [nCols])
  const sampled = hasData && nCols > layout.visCols
  const canFocusWinner = winnerId != null && winnerId >= 0 && winnerId < layout.visCols

  const [layers, setLayers] = useState({
    input: true,
    columns: true,
    context: true,
    stdp: true,
    binding: true,
    memory: true,
    crossModal: true,
  })
  const [autoRotate, setAutoRotate] = useState(true)
  const [resetToken, setResetToken] = useState(0)
  const [focusMode, setFocusMode] = useState('overview')

  const toggleLayer = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <section className="space-y-4">
      <SectionHeading
        title="Neural Space"
        description="Interactive 3D view of the live cortical field: token encoding, competitive columns, context, binding, memory, and image/audio beams."
        badge={<Badge variant={hasData ? 'secondary' : 'outline'}>{hasData ? '3D live' : 'waiting for telemetry'}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BoxIcon}
          title="Visible field"
          description="How much of the column space is currently rendered in 3D."
          value={hasData ? formatCompactNumber(nCols) : 'n/a'}
          badge={<Badge variant="outline">{sampled ? `showing ${layout.visCols}` : 'full view'}</Badge>}
        />
        <StatCard
          icon={BrainIcon}
          title="Winner column"
          description="Current dominant column plus the strongest visible activation."
          value={winnerId != null && winnerId >= 0 ? `#${winnerId}` : 'n/a'}
          badge={<Badge variant="outline">peak {formatFloat(peakActivation, 2)}</Badge>}
        />
        <StatCard
          icon={GaugeIcon}
          title="Memory field"
          description="Current memory occupancy in the live 3D scene."
          value={formatPercent(memoryFill, 0)}
          badge={<Badge variant={memoryFill >= 0.85 ? 'destructive' : 'secondary'}>{memoryFill >= 0.85 ? 'high load' : 'stable'}</Badge>}
        />
        <StatCard
          icon={LinkIcon}
          title="Cross-modal beams"
          description="Current image/audio grounding strength in the scene."
          value={`V ${formatFloat(visualConfidence, 2)} · A ${formatFloat(audioConfidence, 2)}`}
          badge={<Badge variant="outline">{brainRuntime?.multimodal?.recent_preview_count ?? 0} previews</Badge>}
        />
      </div>

      <Card className="overflow-hidden border-border/50 bg-card/95">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <EyeIcon className="size-4" /> 3D cortical field
              </CardTitle>
              <CardDescription>
                Orbit around the live field, toggle layers, and inspect how winner columns, memory slabs, and image/audio beams move together.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{sampled ? `showing ${layout.visCols} of ${nCols.toLocaleString()}` : 'full field visible'}</Badge>
              <Button type="button" size="sm" variant={autoRotate ? 'secondary' : 'outline'} onClick={() => setAutoRotate((current) => !current)}>
                {autoRotate ? 'Auto rotate on' : 'Auto rotate off'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={focusMode === 'winner' ? 'secondary' : 'outline'}
                onClick={() => {
                  setFocusMode('winner')
                  setResetToken((current) => current + 1)
                }}
                disabled={!canFocusWinner}
              >
                Focus winner
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setFocusMode('overview')
                  setResetToken((current) => current + 1)
                }}
              >
                <RefreshCwIcon className="mr-1 size-3.5" /> Reset view
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-0">
          {hasData ? (
            <div className="relative h-[760px] w-full overflow-hidden bg-[#030712]">
              <Canvas
                camera={{ position: [0, 5, 20], fov: 50 }}
                dpr={[1, 1.5]}
                frameloop="always"
                gl={{ antialias: true, alpha: false }}
                onCreated={({ gl }) => {
                  gl.setClearColor('#030712')
                }}
              >
                <Scene autoRotate={autoRotate} layers={layers} resetToken={resetToken} focusMode={focusMode} />
              </Canvas>
              <NeuralOverlay layers={layers} toggleLayer={toggleLayer} />
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                title="No live neural space yet"
                description="Start the runtime and wait for telemetry to begin streaming. The 3D view appears once the backend pushes active column data."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <LayersIcon className="size-4" /> Render legend
              <HelpTip>Use this legend to decode the 3D colors. The same semantic colors are reused in Dynamics and Sensory for consistency.</HelpTip>
            </CardTitle>
            <CardDescription>Quick guide to the live 3D colors</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <LegendSwatch color="#3b82f6" label="token encoder / text cue" />
            <LegendSwatch color="#a78bfa" label="winner / competitive columns" />
            <LegendSwatch color="#06b6d4" label="context / memory field" />
            <LegendSwatch color="#8b5cf6" label="binding layer" />
            <LegendSwatch color="#10b981" label="image beam" />
            <LegendSwatch color="#f59e0b" label="audio beam" />
          </CardContent>
        </Card>

        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <GaugeIcon className="size-4" /> Neuromodulator field
            </CardTitle>
            <CardDescription>Control signals that tint the live scene lighting and pacing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ModBar colorClass="bg-gradient-to-r from-amber-400 to-orange-500" label="Dopamine" value={dopamine} />
            <ModBar colorClass="bg-gradient-to-r from-blue-400 to-cyan-500" label="Serotonin" value={serotonin} />
            <ModBar colorClass="bg-gradient-to-r from-emerald-400 to-teal-500" label="Acetylcholine" value={acetylcholine} />
            <ModBar colorClass="bg-gradient-to-r from-rose-400 to-red-500" label="Norepinephrine" value={norepinephrine} />
          </CardContent>
        </Card>

        <Card size="sm" className="bg-card/90">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <AudioLinesIcon className="size-4" /> Current sensory context
            </CardTitle>
            <CardDescription>What the 3D field is currently being grounded against.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Tokens processed</p>
                <p className="mt-1 text-lg font-semibold">{tokenCount.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Next sensory source</p>
                <p className="mt-1 text-lg font-semibold">{brainRuntime?.multimodal?.next_source_name || 'n/a'}</p>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Focus terms</p>
              {focusTerms.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {focusTerms.map((term) => (
                    <Badge key={term} variant="outline" className="text-[10px]">{term}</Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No active focus terms yet.</p>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Terminus is not rendering every column when the field gets large. It samples a stable visual subset for speed while the underlying runtime keeps using the full network.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export default memo(NeuralSpace3D)
