import { memo, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useTelemetryStore } from '@/stores/telemetryStore'

const COLUMN_SPREAD = 1.6
const LAYER_SPACING_Y = 4
const BASE_COLOR = new THREE.Color('#1e40af')
const WINNER_COLOR = new THREE.Color('#a855f7')
const VISUAL_COLOR = new THREE.Color('#10b981')
const AUDIO_COLOR = new THREE.Color('#f59e0b')
const TEXT_COLOR = new THREE.Color('#3b82f6')

const tempObj = new THREE.Object3D()
const tempColor = new THREE.Color()

function columnLayout(nCols) {
  const perRow = Math.ceil(Math.sqrt(nCols))
  const positions = []
  for (let i = 0; i < nCols; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const x = (col - (perRow - 1) / 2) * COLUMN_SPREAD
    const z = (row - (Math.ceil(nCols / perRow) - 1) / 2) * COLUMN_SPREAD
    positions.push([x, 0, z])
  }
  return positions
}

function ColumnNodes() {
  const meshRef = useRef()
  const glowRef = useRef()
  const prevWinner = useRef(-1)
  const pulsePhase = useRef(0)

  const animation = useTelemetryStore((s) => s.animation)
  const nCols = animation?.n_columns || 0
  const activations = animation?.activations || []
  const winnerId = animation?.winner_id ?? -1

  const positions = useMemo(() => columnLayout(Math.max(nCols, 1)), [nCols])

  const colorArray = useMemo(() => new Float32Array(Math.max(nCols, 1) * 3), [nCols])

  useEffect(() => {
    if (!meshRef.current || nCols === 0) return
    for (let i = 0; i < nCols; i++) {
      const [x, , z] = positions[i]
      tempObj.position.set(x, 0, z)
      tempObj.scale.set(1, 1, 1)
      tempObj.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObj.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [nCols, positions])

  useFrame((_, delta) => {
    if (!meshRef.current || nCols === 0) return

    if (winnerId !== prevWinner.current) {
      pulsePhase.current = 0
      prevWinner.current = winnerId
    }
    pulsePhase.current += delta * 4

    for (let i = 0; i < nCols; i++) {
      const act = activations[i] ?? 0
      const intensity = Math.min(act * 2.5, 1)
      const isWinner = i === winnerId

      // Scale: winner pulses, others scale with activation
      const baseScale = 0.3 + intensity * 0.5
      const scale = isWinner
        ? baseScale * (1 + 0.2 * Math.sin(pulsePhase.current))
        : baseScale

      const [x, , z] = positions[i]
      tempObj.position.set(x, 0, z)
      tempObj.scale.setScalar(scale)
      tempObj.updateMatrix()
      meshRef.current.setMatrixAt(i, tempObj.matrix)

      // Color: winner is purple, others blue→white by activation
      if (isWinner) {
        tempColor.copy(WINNER_COLOR)
      } else {
        tempColor.copy(BASE_COLOR).lerp(new THREE.Color('#60a5fa'), intensity)
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

  if (nCols === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[null, null, nCols]} frustumCulled={false}>
      <icosahedronGeometry args={[0.4, 3]} />
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

function InputLayer() {
  return (
    <group position={[0, LAYER_SPACING_Y, 0]}>
      <mesh>
        <boxGeometry args={[3, 0.3, 3]} />
        <meshStandardMaterial
          color="#1e3a5f"
          emissive={TEXT_COLOR}
          emissiveIntensity={0.15}
          transparent
          opacity={0.5}
        />
      </mesh>
      <Billboard position={[0, 0.6, 0]}>
        <Text fontSize={0.25} color="#60a5fa" anchorY="bottom">
          RTF Encoder
        </Text>
      </Billboard>
    </group>
  )
}

function MemoryLayer() {
  const memoryFill = useTelemetryStore((s) => s.memoryFill)
  const fillScale = 0.1 + memoryFill * 0.9

  return (
    <group position={[0, -LAYER_SPACING_Y, 0]}>
      <mesh>
        <boxGeometry args={[3, 0.3, 3]} />
        <meshStandardMaterial
          color="#164e63"
          emissive="#22d3ee"
          emissiveIntensity={0.1 + memoryFill * 0.3}
          transparent
          opacity={0.4}
        />
      </mesh>
      {/* Memory fill indicator */}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[3 * fillScale, 0.15, 3 * fillScale]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.4}
          transparent
          opacity={0.6}
        />
      </mesh>
      <Billboard position={[0, 0.6, 0]}>
        <Text fontSize={0.25} color="#22d3ee" anchorY="bottom">
          {`Memory Store (${(memoryFill * 100).toFixed(0)}%)`}
        </Text>
      </Billboard>
    </group>
  )
}

function CrossModalBeams() {
  const crossModal = useTelemetryStore((s) => s.crossModal)
  if (!crossModal) return null

  const vConf = crossModal.visual_confidence || 0
  const aConf = crossModal.audio_confidence || 0

  return (
    <group>
      {/* Visual beam (left) */}
      {vConf > 0.01 && (
        <group position={[-3.5, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.05 + vConf * 0.15, 0.05, 2, 8]} />
            <meshStandardMaterial
              color={VISUAL_COLOR}
              emissive={VISUAL_COLOR}
              emissiveIntensity={0.3 + vConf * 0.5}
              transparent
              opacity={0.4 + vConf * 0.4}
            />
          </mesh>
          <Billboard position={[0, 1.5, 0]}>
            <Text fontSize={0.2} color="#10b981">
              {`Visual ${(vConf * 100).toFixed(0)}%`}
            </Text>
          </Billboard>
        </group>
      )}
      {/* Audio beam (right) */}
      {aConf > 0.01 && (
        <group position={[3.5, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.05 + aConf * 0.15, 0.05, 2, 8]} />
            <meshStandardMaterial
              color={AUDIO_COLOR}
              emissive={AUDIO_COLOR}
              emissiveIntensity={0.3 + aConf * 0.5}
              transparent
              opacity={0.4 + aConf * 0.4}
            />
          </mesh>
          <Billboard position={[0, 1.5, 0]}>
            <Text fontSize={0.2} color="#f59e0b">
              {`Audio ${(aConf * 100).toFixed(0)}%`}
            </Text>
          </Billboard>
        </group>
      )}
    </group>
  )
}

function FlowBeams() {
  const animation = useTelemetryStore((s) => s.animation)
  const winnerId = animation?.winner_id ?? -1
  const hasData = (animation?.n_columns || 0) > 0
  const beamRef = useRef()
  const phaseRef = useRef(0)

  useFrame((_, delta) => {
    if (!beamRef.current) return
    phaseRef.current += delta * 2
    beamRef.current.material.opacity = 0.15 + 0.1 * Math.sin(phaseRef.current)
  })

  if (!hasData) return null

  return (
    <group>
      {/* Input → Columns beam */}
      <mesh ref={beamRef} position={[0, LAYER_SPACING_Y / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, LAYER_SPACING_Y - 1, 4]} />
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.5}
          transparent
          opacity={0.25}
        />
      </mesh>
      {/* Columns → Memory beam */}
      {winnerId >= 0 && (
        <mesh position={[0, -LAYER_SPACING_Y / 2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, LAYER_SPACING_Y - 1, 4]} />
          <meshStandardMaterial
            color="#a78bfa"
            emissive="#a78bfa"
            emissiveIntensity={0.5}
            transparent
            opacity={0.2}
          />
        </mesh>
      )}
    </group>
  )
}

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
      <ambientLight intensity={0.15} />
      <pointLight ref={lightRef} position={[0, 6, 0]} intensity={0.5} distance={20} />
      <pointLight position={[-5, -3, 5]} intensity={0.1} color="#1e3a5f" />
      <pointLight position={[5, -3, -5]} intensity={0.1} color="#312e81" />
    </>
  )
}

function WinnerLabel() {
  const winnerId = useTelemetryStore((s) => s.animation?.winner_id)
  const lastWinner = useTelemetryStore((s) => s.lastWinner)

  if (winnerId == null && !lastWinner) return null

  return (
    <Billboard position={[0, LAYER_SPACING_Y + 1.5, 0]}>
      <Text fontSize={0.18} color="#a78bfa">
        {`Winner: #${winnerId ?? '—'}  (${lastWinner ?? '—'})`}
      </Text>
    </Billboard>
  )
}

function Scene() {
  return (
    <>
      <AmbientGlow />
      <Stars radius={30} depth={60} count={1500} factor={3} saturation={0.1} fade speed={0.5} />
      <InputLayer />
      <ColumnNodes />
      <MemoryLayer />
      <FlowBeams />
      <CrossModalBeams />
      <WinnerLabel />
      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={25}
        autoRotate
        autoRotateSpeed={0.3}
        maxPolarAngle={Math.PI * 0.85}
      />
    </>
  )
}

function NeuralSpace3D() {
  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-xl border border-border/40 bg-black">
      <Canvas
        camera={{ position: [0, 5, 12], fov: 50 }}
        dpr={[1, 1.5]}
        frameloop="always"
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#030712')
        }}
      >
        <Scene />
      </Canvas>

      {/* Overlay stats */}
      <NeuralOverlay />
    </div>
  )
}

function NeuralOverlay() {
  const tokenCount = useTelemetryStore((s) => s.tokenCount)
  const winnerId = useTelemetryStore((s) => s.animation?.winner_id)
  const nCols = useTelemetryStore((s) => s.animation?.n_columns || 0)
  const dopamine = useTelemetryStore((s) => s.dopamine)
  const serotonin = useTelemetryStore((s) => s.serotonin)
  const acetylcholine = useTelemetryStore((s) => s.acetylcholine)
  const norepinephrine = useTelemetryStore((s) => s.norepinephrine)

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40">Neural Space</div>
          <div className="text-sm font-semibold text-white/90">{nCols} columns</div>
        </div>
        <div className="rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/40">Tokens</div>
          <div className="text-sm font-semibold text-white/90">{tokenCount.toLocaleString()}</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-end justify-between">
        <div className="flex gap-2">
          <NeuromodPill label="DA" value={dopamine} color="#f59e0b" />
          <NeuromodPill label="5-HT" value={serotonin} color="#3b82f6" />
          <NeuromodPill label="ACh" value={acetylcholine} color="#10b981" />
          <NeuromodPill label="NE" value={norepinephrine} color="#ef4444" />
        </div>
        {winnerId != null && (
          <div className="rounded-lg bg-purple-500/20 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-xs font-semibold text-purple-300">Winner #{winnerId}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function NeuromodPill({ label, value, color }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color, opacity: 0.3 + value * 0.7 }} />
      <span className="text-[10px] font-medium text-white/60">{label}</span>
      <span className="text-[10px] font-semibold text-white/90">{pct}%</span>
    </div>
  )
}

export default memo(NeuralSpace3D)
