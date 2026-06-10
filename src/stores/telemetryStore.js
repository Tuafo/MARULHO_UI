import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

const MAX_HISTORY = 120

export const useTelemetryStore = create(
  subscribeWithSelector((set, get) => ({
    // Connection
    apiBase: import.meta.env.VITE_MARULHO_API_BASE
      || (window.location.port === '8000' ? window.location.origin : 'http://127.0.0.1:8000'),
    streamConnected: false,
    error: '',

    // Core status
    status: null,
    telemetryHistory: [],

    // Derived slices (updated on push for selector stability)
    tokenCount: 0,
    memoryFill: 0,
    memoryBufferSize: 0,
    driftFloor: 0,
    stateRevision: null,
    dirtyState: false,
    checkpointPath: '',
    lastWinner: null,
    lastTraceId: '',
    lastTraceCreatedAt: null,
    contextSupported: false,

    // Animation / live neural data
    animation: null,
    crossModal: null,
    contextTau: null,

    // Neuromodulators (fast path for 3D scene)
    dopamine: 0,
    serotonin: 0,
    acetylcholine: 0,
    norepinephrine: 0,

    // Training
    groundingConfidence: {},
    nVisualSignatures: 0,
    nAudioSignatures: 0,
    deepSleepEvents: 0,

    // Runtime scope
    runtimeScope: {},
    brainRuntime: null,
    memoryStore: {},
    checkpointMetadata: {},

    // Traces & checkpoints
    traces: [],
    checkpoints: [],

    // Actions
    setApiBase: (apiBase) => set({ apiBase }),
    setStreamConnected: (v) => set({ streamConnected: v }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: '' }),

    pushTelemetry: (payload) => {
      const prev = get()
      const history = [...prev.telemetryHistory, payload].slice(-MAX_HISTORY)
      const animation = payload.animation || prev.animation
      const crossModal = animation?.cross_modal || prev.crossModal
      const contextTau = animation?.context_tau || prev.contextTau
      const runtimeScope = payload.runtime_scope || prev.runtimeScope
      const memoryStore = payload.memory_store || prev.memoryStore

      set({
        status: { ...(prev.status || {}), ...payload },
        telemetryHistory: history,
        tokenCount: payload.token_count ?? prev.tokenCount,
        memoryFill: animation?.memory_fill ?? memoryStore?.fill_fraction ?? payload.memory_fill_fraction ?? prev.memoryFill,
        memoryBufferSize: memoryStore?.slow_buffer_size ?? payload.memory_buffer_size ?? prev.memoryBufferSize,
        driftFloor: payload.drift_floor ?? payload.drift ?? prev.driftFloor,
        stateRevision: payload.state_revision ?? prev.stateRevision,
        dirtyState: payload.dirty_state ?? prev.dirtyState,
        checkpointPath: payload.checkpoint_path ?? prev.checkpointPath,
        lastWinner: payload.last_winner ?? prev.lastWinner,
        lastTraceId: payload.last_trace_id ?? prev.lastTraceId,
        lastTraceCreatedAt: payload.last_trace_created_at ?? prev.lastTraceCreatedAt,
        contextSupported: payload.context_supported ?? prev.contextSupported,
        animation,
        crossModal,
        contextTau,
        dopamine: payload.dopamine ?? prev.dopamine,
        serotonin: payload.serotonin ?? prev.serotonin,
        acetylcholine: payload.acetylcholine ?? prev.acetylcholine,
        norepinephrine: payload.norepinephrine ?? prev.norepinephrine,
        groundingConfidence: payload.grounding_confidence ?? prev.groundingConfidence,
        nVisualSignatures: payload.n_visual_signatures ?? prev.nVisualSignatures,
        nAudioSignatures: payload.n_audio_signatures ?? prev.nAudioSignatures,
        deepSleepEvents: payload.deep_sleep_events ?? prev.deepSleepEvents,
        runtimeScope,
        brainRuntime: payload.terminus_runtime ?? prev.brainRuntime,
        memoryStore,
        checkpointMetadata: payload.checkpoint_metadata ?? prev.checkpointMetadata,
      })
    },

    setStatus: (payload) => {
      const prev = get()
      set({
        status: { ...(prev.status || {}), ...payload },
        tokenCount: payload.token_count ?? prev.tokenCount,
        stateRevision: payload.state_revision ?? prev.stateRevision,
        dirtyState: payload.dirty_state ?? prev.dirtyState,
        checkpointPath: payload.checkpoint_path ?? prev.checkpointPath,
        lastTraceId: payload.last_trace_id ?? prev.lastTraceId,
        lastTraceCreatedAt: payload.last_trace_created_at ?? prev.lastTraceCreatedAt,
        brainRuntime: payload.terminus_runtime ?? prev.brainRuntime,
        runtimeScope: payload.runtime_scope ?? prev.runtimeScope,
        memoryStore: payload.memory_store ?? prev.memoryStore,
        checkpointMetadata: payload.checkpoint_metadata ?? prev.checkpointMetadata,
      })
    },

    setTraces: (traces) => set({ traces }),
    setCheckpoints: (checkpoints) => set({ checkpoints }),
  }))
)

export const selectNeuromodulators = (s) => ({
  dopamine: s.dopamine,
  serotonin: s.serotonin,
  acetylcholine: s.acetylcholine,
  norepinephrine: s.norepinephrine,
})

export const selectAnimation = (s) => s.animation
export const selectGrounding = (s) => s.groundingConfidence
export const selectConnection = (s) => ({
  streamConnected: s.streamConnected,
  error: s.error,
  apiBase: s.apiBase,
})
