import { memo, useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useTelemetryStore } from '@/stores/telemetryStore'

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */
const LAYER_SPACING = 3.5
const BASE_COLOR = new THREE.Color('#1e40af')
const WINNER_COLOR = new THREE.Color('#a855f7')
const VISUAL_COLOR = new THREE.Color('#10b981')
const AUDIO_COLOR = new THREE.Color('#f59e0b')
const CONTEXT_COLOR = new THREE.Color('#06b6d4')
const BINDING_COLOR = new THREE.Color('#8b5cf6')
const STDP_COLOR = new THREE.Color('#f43f5e')
const MEMORY_COLOR = new THREE.Color('#22d3ee')
const LERP_TARGET = new THREE.Color()

const tempObj = new THREE.Object3D()
const tempColor = new THREE.Color()

// Max columns to render individually — beyond this we sample
const MAX_VIS_COLUMNS = 512

// Y positions for each layer (top to bottom)
const LAYER_Y = {
  input: LAYER_SPACING * 2,
  columns: LAYER_SPACING,
  context: 0,
  stdp: -LAYER_SPACING * 0.5,
  binding: -LAYER_SPACING,
  memory: -LAYER_SPACING * 2,
}

/* -------------------------------------------------------------------------- */
/*  Layout helper — adapts spread to column count                              */
/* -------------------------------------------------------------------------- */
function columnLayout(nCols) {
  const visCols = Math.min(nCols, MAX_VIS_COLUMNS)
  const perRow = Math.ceil(Math.sqrt(visCols))
  // Scale spread so the grid never exceeds ~12 units across
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
/*  Column Nodes (instanced) — auto-adapts to column count                     */
/* -------------------------------------------------------------------------- */
function ColumnNodes({ visible, layout }) {
  const meshRef = useRef()
  const prevWinner = useRef(-1)
  const pulsePhase = useRef(0)

  const animation = useTelemetryStore((s) => s.animation)
  const nCols = animation?.n_columns || 0
  const activations = animation?.activations || []
  const winnerId = animation?.winner_id ?? -1

  const { positions, visCols, spread } = layout
  const colorArray = useMemo(() => new Float32Array(Math.max(visCols, 1) * 3), [visCols])

  // Lower geometry detail for large counts
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
      const intensity = Math.min(act * 2.5, 1)
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
        LERP_TARGET.set(0.376, 0.647, 0.98) // #60a5fa
        tempColor.lerp(LERP_TARGET, intensity)
      }
      colorArray[i * 3] = tempColor.r
      colorArray[i * 3 + 1] = tempColor.g
      colorArray[i * 3 + 2] = tempColor.b
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.geometry.setAttribute(
      'color',
      new THREE.InstancedBufferAttribute(colorArray, 3)
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

/* -------------------------------------------------------------------------- */
/*  Layer slabs — size adapts to column grid extent                            */
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
  return <LayerSlab position={[0, LAYER_Y.input, 0]} label="RTF Encoder" color="#3b82f6" visible={visible} extent={extent} />
}

function ContextLayer({ visible, extent }) {
  const animation = useTelemetryStore((s) => s.animation)
  const contextTau = animation?.context_tau
  const avgTau = contextTau && contextTau.length > 0
    ? contextTau.reduce((a, b) => a + b, 0) / contextTau.length
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
  const animation = useTelemetryStore((s) => s.animation)
  const stdp = animation?.stdp

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
  const animation = useTelemetryStore((s) => s.animation)
  const binding = animation?.binding
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
  const memoryFill = useTelemetryStore((s) => s.memoryFill)
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
  const crossModal = useTelemetryStore((s) => s.crossModal)
  if (!crossModal || !visible) return null

  const vConf = crossModal.visual_confidence || 0
  const aConf = crossModal.audio_confidence || 0
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
              {`Visual ${(vConf * 100).toFixed(0)}%`}
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
  const dopamine = useTelemetryStore((s) => s.dopamine)
  const norepinephrine = useTelemetryStore((s) => s.norepinephrine)
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

/* -------------------------------------------------------------------------- */
/*  Auto-fit camera to column extent                                           */
/* -------------------------------------------------------------------------- */
function CameraFit({ extent }) {
  const { camera } = useThree()
  const prevExtent = useRef(0)

  useEffect(() => {
    if (extent === prevExtent.current) return
    prevExtent.current = extent
    const dist = Math.max(extent * 1.3, 16)
    // Center between input (Y=7) and memory (Y=-7) layers, shifted up slightly
    camera.position.set(0, extent * 0.4 + 2, dist)
    camera.lookAt(0, 0.5, 0)
    camera.updateProjectionMatrix()
  }, [extent, camera])

  return null
}

/* -------------------------------------------------------------------------- */
/*  Scene                                                                      */
/* -------------------------------------------------------------------------- */
function Scene({ layers }) {
  const animation = useTelemetryStore((s) => s.animation)
  const nCols = animation?.n_columns || 0
  const winnerId = animation?.winner_id ?? -1
  const hasData = nCols > 0

  const layout = useMemo(() => columnLayout(Math.max(nCols, 1)), [nCols])
  const { extent } = layout

  return (
    <>
      <AmbientGlow />
      <CameraFit extent={extent} />

      <InputLayer visible={layers.input} extent={extent} />
      <ColumnNodes visible={layers.columns} layout={layout} />
      <ContextLayer visible={layers.context} extent={extent} />
      <STDPLayer visible={layers.stdp} extent={extent} />
      <BindingLayer visible={layers.binding} extent={extent} />
      <MemoryLayer visible={layers.memory} extent={extent} />
      <CrossModalBeams visible={layers.crossModal} extent={extent} />

      {/* Data flow particles between layers */}
      {hasData && layers.input && layers.columns && (
        <DataFlowParticles fromY={LAYER_Y.input} toY={LAYER_Y.columns} color="#3b82f6" count={8} extent={extent} />
      )}
      {winnerId >= 0 && layers.columns && layers.context && (
        <DataFlowParticles fromY={LAYER_Y.columns} toY={LAYER_Y.context} color="#a78bfa" count={6} extent={extent} />
      )}
      {winnerId >= 0 && layers.binding && layers.memory && (
        <DataFlowParticles fromY={LAYER_Y.binding} toY={LAYER_Y.memory} color="#22d3ee" count={6} extent={extent} />
      )}

      {/* Winner label */}
      {winnerId >= 0 && (
        <Billboard position={[0, LAYER_Y.input + 1.2, 0]}>
          <Text fontSize={0.2} color="#a78bfa">
            {`Winner: #${winnerId}`}
          </Text>
        </Billboard>
      )}

      {/* Column count badge when sampling */}
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
        autoRotate
        autoRotateSpeed={0.2}
        maxPolarAngle={Math.PI * 0.85}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Overlay HUD                                                                */
/* -------------------------------------------------------------------------- */
function NeuralOverlay({ layers, toggleLayer }) {
  const tokenCount = useTelemetryStore((s) => s.tokenCount)
  const winnerId = useTelemetryStore((s) => s.animation?.winner_id)
  const nCols = useTelemetryStore((s) => s.animation?.n_columns || 0)
  const dopamine = useTelemetryStore((s) => s.dopamine)
  const serotonin = useTelemetryStore((s) => s.serotonin)
  const acetylcholine = useTelemetryStore((s) => s.acetylcholine)
  const norepinephrine = useTelemetryStore((s) => s.norepinephrine)

  const layerNames = [
    ['input', 'Input', '#3b82f6'],
    ['columns', 'Columns', '#a855f7'],
    ['context', 'Context', '#06b6d4'],
    ['stdp', 'STDP', '#f43f5e'],
    ['binding', 'Binding', '#8b5cf6'],
    ['memory', 'Memory', '#22d3ee'],
    ['crossModal', 'Cross-Modal', '#10b981'],
  ]

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40">Neural Space</div>
          <div className="text-sm font-semibold text-white/90">{nCols} columns</div>
        </div>
        <div className="rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40">Tokens</div>
          <div className="text-sm font-semibold text-white/90">{tokenCount.toLocaleString()}</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-end justify-between gap-2">
        {/* Neuromods */}
        <div className="flex gap-1.5 flex-wrap">
          <NeuromodPill label="DA" value={dopamine} color="#f59e0b" />
          <NeuromodPill label="5-HT" value={serotonin} color="#3b82f6" />
          <NeuromodPill label="ACh" value={acetylcholine} color="#10b981" />
          <NeuromodPill label="NE" value={norepinephrine} color="#ef4444" />
        </div>

        {/* Layer toggles */}
        <div className="pointer-events-auto flex flex-col gap-0.5 rounded-lg bg-black/70 px-2 py-1.5 backdrop-blur-sm">
          {layerNames.map(([key, name, color]) => (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className="flex items-center gap-1.5 text-[10px] hover:text-white/90 transition-colors"
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

function NeuromodPill({ label, value, color }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 backdrop-blur-sm">
      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color, opacity: 0.3 + value * 0.7 }} />
      <span className="text-[9px] font-medium text-white/50">{label}</span>
      <span className="text-[9px] font-semibold text-white/80">{pct}%</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                             */
/* -------------------------------------------------------------------------- */
function NeuralSpace3D() {
  const [layers, setLayers] = useState({
    input: true,
    columns: true,
    context: true,
    stdp: true,
    binding: true,
    memory: true,
    crossModal: true,
  })

  const toggleLayer = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <div className="relative h-[720px] w-full overflow-hidden rounded-xl border border-border/40 bg-[#030712]">
      <Canvas
        camera={{ position: [0, 5, 20], fov: 50 }}
        dpr={[1, 1.5]}
        frameloop="always"
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#030712')
        }}
      >
        <Scene layers={layers} />
      </Canvas>

      <NeuralOverlay layers={layers} toggleLayer={toggleLayer} />
    </div>
  )
}

export default memo(NeuralSpace3D)
