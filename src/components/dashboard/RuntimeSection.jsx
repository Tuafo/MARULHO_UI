import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatFloat, formatMode, formatPercent, formatWhen } from '@/lib/dashboard-utils'
import { DetailItem, SectionHeading } from '@/components/dashboard/shared'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function firstPresent(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== '')
}

function formatCount(value) {
  if (value === null || value === undefined || value === '') {
    return 'n/a'
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : String(value)
}

function formatLatency(bucket) {
  if (!bucket) {
    return 'n/a'
  }

  if (bucket.avg_ms !== null && bucket.avg_ms !== undefined) {
    return `${formatFloat(bucket.avg_ms, 1)} ms avg`
  }

  if (bucket.count !== null && bucket.count !== undefined) {
    return `${formatCount(bucket.count)} samples`
  }

  return 'n/a'
}

function formatFeedbackSummary(feedback) {
  const summary = feedback?.summary || feedback?.message || feedback?.target_id || feedback?.feedback_id
  return summary ? String(summary) : 'No evaluator summary provided.'
}

function healthVariant(status) {
  const normalized = String(status || '').toLowerCase()
  if (['available', 'grounded', 'operator_verified', 'verified', 'succeeded'].includes(normalized)) {
    return 'secondary'
  }

  if (['capacity_pressure', 'contradicted', 'contradictions_present', 'failed', 'error'].includes(normalized)) {
    return 'destructive'
  }

  return 'outline'
}

function renderStatusBadge(value, trueLabel, falseLabel, trueVariant = 'secondary') {
  if (value === true) {
    return <Badge variant={trueVariant}>{trueLabel}</Badge>
  }

  if (value === false) {
    return <Badge variant="outline">{falseLabel}</Badge>
  }

  return <Badge variant="outline">unknown</Badge>
}

function formatPolicyReason(reason) {
  if (reason && typeof reason === 'object' && !Array.isArray(reason)) {
    return String(reason.detail || reason.message || reason.summary || reason.code || 'No reason detail provided.')
  }

  return reason ? formatMode(reason) : 'No reason detail provided.'
}

function policyReasonCode(reason, index) {
  if (reason && typeof reason === 'object' && !Array.isArray(reason)) {
    return reason.code || reason.reason || `reason_${index + 1}`
  }

  return reason || `reason_${index + 1}`
}

function normalizePolicyReasons(policyDecision) {
  const reasons = asArray(policyDecision.reasons)
  if (reasons.length) {
    return reasons
  }

  return asArray(policyDecision.reason_codes).map((code) => ({
    code,
    detail: formatMode(code),
  }))
}

function formatReplaySummary(candidate) {
  const summary = candidate?.summary || candidate?.target_id || candidate?.candidate_id
  return summary ? String(summary) : 'No replay candidate summary reported.'
}

function renderBadgeList(items, emptyLabel, limit = 8) {
  const values = asArray(items).filter(Boolean)
  if (!values.length) {
    return <Badge variant="outline">{emptyLabel}</Badge>
  }

  const visible = values.slice(0, limit)
  return (
    <>
      {visible.map((item) => (
        <Badge key={String(item)} variant="secondary">{formatMode(item)}</Badge>
      ))}
      {values.length > visible.length && <Badge variant="outline">+{values.length - visible.length}</Badge>}
    </>
  )
}

function normalizeFlagList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([flag]) => flag)
  }

  return value ? [value] : []
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value)).filter(Boolean))]
}

function renderCountBadges(counts, emptyLabel, limit = 8) {
  const entries = Object.entries(asObject(counts)).filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (!entries.length) {
    return <Badge variant="outline">{emptyLabel}</Badge>
  }

  const visible = entries.slice(0, limit)
  return (
    <>
      {visible.map(([key, value]) => (
        <Badge key={key} variant="secondary">
          {formatMode(key)}: {formatCount(value)}
        </Badge>
      ))}
      {entries.length > visible.length && <Badge variant="outline">+{entries.length - visible.length}</Badge>}
    </>
  )
}

function latestByCreatedAt(...items) {
  const values = items.filter((item) => Object.keys(asObject(item)).length)
  if (!values.length) {
    return {}
  }

  return values.reduce((latest, item) => {
    const itemTime = Date.parse(item.created_at || '') || 0
    const latestTime = Date.parse(latest.created_at || '') || 0
    return itemTime > latestTime ? item : latest
  }, values[0])
}

export default function RuntimeSection({ checkpointMetadata, columnInputWeights, memoryStore, routingIndex, runtimeScope, status, weightDistribution }) {
  const bindingConjunctionEnabled = runtimeScope.supports_binding_conjunction_memory ?? runtimeScope.supports_binding_coincidence
  const brain = status?.terminus_runtime
  const statusLivingLoop = asObject(status?.living_loop)
  const brainLivingLoop = asObject(brain?.living_loop)
  const benchmarkTelemetry = {
    ...asObject(statusLivingLoop.benchmark_telemetry),
    ...asObject(brainLivingLoop.benchmark_telemetry),
  }
  const livingLoop = {
    ...statusLivingLoop,
    ...brainLivingLoop,
    benchmark_telemetry: benchmarkTelemetry,
  }
  const livingWorld = livingLoop.world_model_lite || {}
  const runtimeActionLatency = benchmarkTelemetry.endpoint_latency_ms?.runtime_action
  const actionSuccess = benchmarkTelemetry.action_success || {}
  const verificationSuccess = benchmarkTelemetry.verification_success || {}
  const memoryHealth = livingLoop.memory_health || {}
  const groundingHealth = livingLoop.grounding_health || {}
  const feedbackSummary = asObject(livingLoop.feedback_summary)
  const benchmarkFeedback = asObject(benchmarkTelemetry.feedback)
  const policyDecision = [
    asObject(livingLoop.policy_decision),
    asObject(livingLoop.policy_actuator),
    asObject(benchmarkTelemetry.policy_actuator_summary),
  ].find((item) => Object.keys(item).length) || {}
  const hasPolicyDecision = Object.keys(policyDecision).length > 0
  const policySuggestedInput = asObject(policyDecision.suggested_input)
  const policyInput = asObject(policyDecision.input)
  const policyReasons = normalizePolicyReasons(policyDecision)
  const policyRecommendation = firstPresent(policyDecision.recommendation, livingWorld.recommended_next_action, benchmarkTelemetry.policy_recommendations?.latest)
  const policyAction = firstPresent(policyDecision.action, policyDecision.recommended_action)
  const policyRisk = firstPresent(policyDecision.risk, livingWorld.risk, livingWorld.policy_score?.risk)
  const policyUncertainty = firstPresent(policyDecision.uncertainty, livingWorld.uncertainty, livingWorld.policy_score?.uncertainty)
  const policyInformationGain = firstPresent(policyDecision.expected_information_gain, livingWorld.information_gain, livingWorld.policy_score?.information_gain)
  const policyCost = firstPresent(policyDecision.expected_cost, livingWorld.cost, livingWorld.policy_score?.cost)
  const policyTargetId = firstPresent(
    policyDecision.target_action_id,
    policyDecision.action_id,
    policyDecision.target_episode_id,
    policyDecision.target_id,
    policySuggestedInput.target_id,
    policyInput.target_id,
  )
  const feedbackStatusCounts = asObject(feedbackSummary.status_counts ?? benchmarkFeedback.status_counts)
  const replayPlan = asObject(livingLoop.replay_plan)
  const benchmarkReplay = asObject(benchmarkTelemetry.replay_plan_summary)
  const replayCandidates = asArray(replayPlan.candidates)
  const topReplayCandidate = asObject(replayCandidates[0] || benchmarkReplay.top_candidate)
  const hasReplayPlan = Object.keys(replayPlan).length > 0 || Object.keys(benchmarkReplay).length > 0
  const replayReasonCodes = asArray(replayPlan.plan_reason_codes).length
    ? asArray(replayPlan.plan_reason_codes)
    : asArray(benchmarkReplay.plan_reason_codes)
  const replayCount = firstPresent(replayPlan.count, benchmarkReplay.count)
  const replayRulesVersion = firstPresent(replayPlan.priority_rules_version, benchmarkReplay.priority_rules_version)
  const replayTopAction = firstPresent(topReplayCandidate.suggested_consolidation_action, topReplayCandidate.action)
  const replayTopEndpoint = firstPresent(topReplayCandidate.suggested_endpoint, benchmarkReplay.endpoint)
  const replayTopScore = firstPresent(topReplayCandidate.priority_score)
  const replaySampleSummary = [
    asObject(livingLoop.replay_sample_summary),
    asObject(benchmarkTelemetry.replay_sample_summary),
  ].find((item) => Object.keys(item).length) || {}
  const replayExecutorSummary = [
    asObject(livingLoop.replay_executor_summary),
    asObject(benchmarkTelemetry.replay_executor_summary),
  ].find((item) => Object.keys(item).length) || {}
  const replaySampleLatestItem = asObject(replaySampleSummary.latest_history_item)
  const replayExecutorLatestItem = asObject(replayExecutorSummary.latest_history_item)
  const latestReplayHistoryItem = latestByCreatedAt(replayExecutorLatestItem, replaySampleLatestItem)
  const hasReplayHistorySummary = Object.keys(replaySampleSummary).length > 0 || Object.keys(replayExecutorSummary).length > 0
  const replayHistoryCount = firstPresent(replaySampleSummary.history_count, replaySampleSummary.count)
  const replayExecutionCount = firstPresent(replayExecutorSummary.history_count, replayExecutorSummary.count)
  const replaySelectedCount = firstPresent(replayExecutorSummary.selected_count, replaySampleSummary.selected_count, latestReplayHistoryItem.selected_count)
  const replayLatestSelectedCount = firstPresent(replayExecutorSummary.latest_selected_count, replaySampleSummary.latest_selected_count, latestReplayHistoryItem.selected_count)
  const replaySampleEndpoint = firstPresent(replaySampleSummary.endpoint, latestReplayHistoryItem.endpoint)
  const replayExecutionEndpoint = firstPresent(replayExecutorSummary.execution_endpoint, replaySampleSummary.execution_endpoint)
  const replayHistoryEndpoint = firstPresent(replaySampleSummary.history_endpoint, replayExecutorSummary.history_endpoint)
  const replayAuditOnly = firstPresent(replayExecutorSummary.audit_only, replaySampleSummary.audit_only)
  const replayAdvisory = firstPresent(replayExecutorSummary.advisory, replaySampleSummary.advisory)
  const replayExecutable = firstPresent(replayExecutorSummary.executable, replaySampleSummary.executable)
  const replaySafetyFlags = uniqueValues([
    ...normalizeFlagList(replaySampleSummary.safety_flags),
    ...normalizeFlagList(replayExecutorSummary.safety_flags),
    ...normalizeFlagList(latestReplayHistoryItem.safety_flags),
  ])
  const replaySelectedCandidateIds = normalizeFlagList(latestReplayHistoryItem.selected_candidate_ids)
  const replayDatasetSummary = [
    asObject(livingLoop.replay_dataset_summary),
    asObject(benchmarkTelemetry.replay_dataset_summary),
    asObject(status?.replay_dataset_summary),
    asObject(brain?.replay_dataset_summary),
  ].find((item) => Object.keys(item).length) || {}
  const hasReplayDatasetSummary = Object.keys(replayDatasetSummary).length > 0
  const replayDatasetSafetyFlags = asObject(replayDatasetSummary.safety_flags)
  const replayDatasetVisibleSafetyFlags = normalizeFlagList(replayDatasetSafetyFlags)
  const replayDatasetCount = firstPresent(replayDatasetSummary.count)
  const replayDatasetPositiveCount = firstPresent(replayDatasetSummary.positive_count)
  const replayDatasetNegativeCount = firstPresent(replayDatasetSummary.negative_count)
  const replayDatasetLatestTimestamp = firstPresent(
    replayDatasetSummary.latest_export_timestamp,
    replayDatasetSummary.latest_history_timestamp,
    replayDatasetSummary.created_at,
  )
  const feedbackVerdictCounts = asObject(feedbackSummary.verdict_counts ?? benchmarkFeedback.verdict_counts)
  const feedbackTargetCounts = asObject(feedbackSummary.target_counts ?? benchmarkFeedback.target_counts)
  const recentFeedbackCandidates = [
    asArray(feedbackSummary.recent_feedback),
    asArray(benchmarkFeedback.recent_feedback),
    asArray(livingLoop.recent_feedback),
  ]
  const recentFeedback = recentFeedbackCandidates.find((items) => items.length) || []
  const feedbackCount = firstPresent(feedbackSummary.feedback_count, benchmarkFeedback.feedback_count, livingLoop.feedback_count, groundingHealth.feedback_count)
  const verifiedFeedbackCount = firstPresent(feedbackSummary.verified_count, benchmarkFeedback.verified_count, livingLoop.verified_feedback_count, groundingHealth.feedback_verified_count, feedbackStatusCounts.verified)
  const contradictedFeedbackCount = firstPresent(feedbackSummary.contradicted_count, benchmarkFeedback.contradicted_count, livingLoop.contradicted_feedback_count, groundingHealth.feedback_contradicted_count, feedbackStatusCounts.contradicted)
  const unverifiedFeedbackCount = firstPresent(feedbackSummary.unverified_count, benchmarkFeedback.unverified_count, livingLoop.unverified_feedback_count, groundingHealth.feedback_unverified_count, feedbackStatusCounts.unverified)
  const verifiedVerdictCount = firstPresent(feedbackVerdictCounts.verified, verifiedFeedbackCount)
  const contradictedVerdictCount = firstPresent(feedbackVerdictCounts.contradicted, contradictedFeedbackCount)
  const runtimeEpisodeFeedbackCount = firstPresent(feedbackTargetCounts.runtime_episode)
  const actionFeedbackCount = firstPresent(feedbackTargetCounts.action)
  const groundingImpact = firstPresent(feedbackSummary.grounding_impact, benchmarkFeedback.grounding_impact, groundingHealth.feedback_impact, 'none')
  const groundingVerificationCount = firstPresent(groundingHealth.verification_count, verificationSuccess.evaluated_count, livingWorld.verification_count)
  const groundedVerifiedCount = firstPresent(groundingHealth.verified_action_count, verificationSuccess.success_count, livingWorld.verified_action_count)
  const groundedContradictionCount = firstPresent(groundingHealth.contradicted_action_count, verificationSuccess.contradicted_count, livingWorld.contradicted_action_count, livingWorld.contradicted_count)
  const livingCapabilities = asArray(livingLoop.capabilities)
  const livingTools = asArray(livingLoop.tools)
  const skillMemories = asArray(livingLoop.skill_memories)

  return (
    <section id="runtime" className="space-y-4">
      <SectionHeading
        title="Systems"
        description="The loaded model, checkpoint metadata, routing index, memory store, and live sensory runtime in operator-friendly language."
        badge={<Badge variant="outline">{runtimeScope.stage || 'stage n/a'}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Live loop metrics — updates on every SSE event */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Live loop
              {brain?.running && <Badge variant="secondary" className="text-[10px] animate-pulse">running</Badge>}
            </CardTitle>
            <CardDescription>Real-time training loop counters from the live Terminus brain tick.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Token count" value={status?.token_count?.toLocaleString?.() ?? 'n/a'} help="Total tokens processed since checkpoint load. This is the global training counter." />
            <DetailItem label="Tick count" value={brain?.tick_count?.toLocaleString?.() ?? 'n/a'} help="Number of brain ticks executed since the loop started. Each tick processes a batch of tokens." />
            <DetailItem label="Last tick" value={brain?.last_tick_duration_ms != null ? `${brain.last_tick_duration_ms.toFixed(1)} ms` : 'n/a'} help="How long the most recent tick took to complete. Lower is faster." />
            <DetailItem label="Tokens / tick" value={brain?.last_tick_token_delta ?? brain?.tick_tokens ?? 'n/a'} help="How many tokens were processed in the last tick." />
            <DetailItem label="Background tokens" value={brain?.background_tokens_processed?.toLocaleString?.() ?? 'n/a'} help="Total tokens trained by the background Terminus loop since it started." />
            <DetailItem label="Sleep events" value={`${status?.micro_sleep_events ?? 0} micro · ${status?.deep_sleep_events ?? 0} deep`} help="Micro-sleep is quick maintenance. Deep sleep is full consolidation with memory replay." />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Living loop
              <Badge variant={livingLoop.generated_at ? 'secondary' : 'outline'} className="text-[10px]">
                {livingLoop.generated_at ? 'status snapshot' : 'no snapshot'}
              </Badge>
            </CardTitle>
            <CardDescription>Predictions, actions, world-model policy, and grounding health from terminus_runtime.living_loop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Predictions" value={formatCount(livingLoop.prediction_count ?? livingWorld.prediction_count)} help="Number of current living-loop prediction records in the status snapshot." />
              <DetailItem label="Actions" value={formatCount(livingLoop.action_count)} help="Digital actions captured by the living loop and available for verification/skill memory." />
              <DetailItem label="Runtime episodes" value={formatCount(livingLoop.runtime_episode_count ?? benchmarkTelemetry.sample?.runtime_episode_count)} help="Runtime endpoint episodes traced by the living loop." />
              <DetailItem label="Recommendation" value={formatMode(livingWorld.recommended_next_action ?? benchmarkTelemetry.policy_recommendations?.latest)} help="World-model-lite recommendation for the next low-risk policy step." />
              <DetailItem label="Prediction accuracy" value={formatPercent(livingWorld.prediction_accuracy, 0)} help="Fulfilled predictions divided by evaluated predictions." />
              <DetailItem label="Action success" value={formatPercent(actionSuccess.success_rate, 0)} help="Verified successful runtime actions divided by living-loop actions." />
              <DetailItem label="Verification success" value={formatPercent(verificationSuccess.success_rate ?? livingWorld.verification_success_rate, 0)} help="Verified actions divided by evaluated action verifications." />
              <DetailItem label="Action latency" value={formatLatency(runtimeActionLatency)} help="Average latency for runtime-action endpoint traces when latency samples are available." />
              <DetailItem label="Memory health" value={<Badge variant={healthVariant(memoryHealth.status)}>{formatMode(memoryHealth.status)}</Badge>} help="Living-loop memory pressure based on memory capacity/fill snapshot." />
              <DetailItem label="Grounding health" value={<Badge variant={healthVariant(groundingHealth.status)}>{formatMode(groundingHealth.status)}</Badge>} help="Whether evidence and action verification suggest grounded, pending, or contradictory outcomes." />
              <DetailItem label="Policy risk" value={formatPercent(livingWorld.risk ?? livingWorld.policy_score?.risk, 0)} help="World-model-lite risk estimate from contradictions, pending items, and penalties." />
              <DetailItem label="Policy uncertainty" value={formatPercent(livingWorld.uncertainty ?? livingWorld.policy_score?.uncertainty, 0)} help="World-model-lite uncertainty from pending, unknown, and low-confidence signals." />
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Replay / consolidation plan</p>
                  <p className="text-xs text-muted-foreground">Read-only prioritized replay candidates from feedback, uncertainty, memory pressure, and policy signals.</p>
                </div>
                <Badge variant={hasReplayPlan ? 'secondary' : 'outline'}>
                  {hasReplayPlan ? 'advisory plan' : 'no plan'}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Candidates" value={formatCount(replayCount)} help="Number of replay/consolidation candidates returned in this living-loop snapshot." />
                <DetailItem label="Top action" value={formatMode(replayTopAction)} help="Advisory consolidation action for the highest-priority candidate." />
                <DetailItem label="Top score" value={replayTopScore !== null && replayTopScore !== undefined ? formatFloat(replayTopScore, 1) : 'n/a'} help="Deterministic priority score for the highest-ranked replay candidate." />
                <DetailItem label="Rules" value={replayRulesVersion || 'n/a'} help="Replay priority rules version used to rank candidates." mono />
                <DetailItem
                  label="Status"
                  value={(
                    <div className="flex flex-wrap gap-1">
                      {renderStatusBadge(firstPresent(replayPlan.advisory, benchmarkReplay.advisory), 'advisory', 'not advisory')}
                      {renderStatusBadge(firstPresent(replayPlan.executable, benchmarkReplay.executable), 'executable', 'not executable', 'destructive')}
                    </div>
                  )}
                  help="Replay planning is advisory-only; executable false means this card should not trigger sleep, replay, or training."
                />
                <DetailItem label="Top target" value={topReplayCandidate.target_id || 'n/a'} help="Runtime episode, action, prediction, memory state, or policy target ranked highest for replay." mono />
                <DetailItem label="Target type" value={formatMode(topReplayCandidate.target_type)} help="Kind of runtime fact selected as the top replay target." />
                <DetailItem label="Suggested endpoint" value={replayTopEndpoint || 'n/a'} help="Endpoint an operator could inspect next; this UI does not call it." mono />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Top replay candidate</p>
                {Object.keys(topReplayCandidate).length ? (
                  <div className="space-y-2 rounded-md border bg-background/60 p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{formatMode(replayTopAction || 'replay')}</Badge>
                      {asArray(topReplayCandidate.reason_codes).slice(0, 4).map((code) => (
                        <Badge key={String(code)} variant="secondary" className="text-[10px]">{formatMode(code)}</Badge>
                      ))}
                    </div>
                    <p className="line-clamp-3 text-sm leading-5 text-muted-foreground">{formatReplaySummary(topReplayCandidate)}</p>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed bg-background/50 p-3 text-sm text-muted-foreground">No replay candidates reported in this snapshot.</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {renderBadgeList(replayReasonCodes, 'no replay reasons', 6)}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Replay executor / sample history</p>
                  <p className="text-xs text-muted-foreground">Read-only audit trail for replay sampling and executor summaries. This card never calls replay, sleep, training, feedback, action, or external endpoints.</p>
                </div>
                <Badge variant={hasReplayHistorySummary ? 'secondary' : 'outline'}>
                  {hasReplayHistorySummary ? 'history snapshot' : 'no history'}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Sample history" value={formatCount(replayHistoryCount)} help="Replay sample records reported by the backend summary." />
                <DetailItem label="Executor history" value={formatCount(replayExecutionCount)} help="Replay execution records reported by the backend summary." />
                <DetailItem label="Selected candidates" value={formatCount(replaySelectedCount)} help="Total selected replay candidates in the sample or executor summary." />
                <DetailItem label="Latest selected" value={formatCount(replayLatestSelectedCount)} help="Candidate count selected by the latest history item or summary." />
                <DetailItem label="Schema" value={firstPresent(replayExecutorSummary.schema_version, replaySampleSummary.schema_version, 'n/a')} help="Replay sample/executor summary schema version." mono />
                <DetailItem
                  label="Safety posture"
                  value={(
                    <div className="flex flex-wrap gap-1">
                      {renderStatusBadge(replayAuditOnly, 'audit-only', 'not audit-only')}
                      {renderStatusBadge(replayAdvisory, 'advisory', 'not advisory')}
                      {renderStatusBadge(replayExecutable, 'executable', 'not executable', 'destructive')}
                    </div>
                  )}
                  help="Backend safety markers for the read-only replay history surfaces."
                />
                <DetailItem label="Sample endpoint" value={replaySampleEndpoint || 'n/a'} help="Backend endpoint used to produce replay samples; this UI only displays the value." mono />
                <DetailItem label="Execute endpoint" value={replayExecutionEndpoint || 'n/a'} help="Backend endpoint for replay execution telemetry; this UI does not call it." mono />
                <DetailItem label="History endpoint" value={replayHistoryEndpoint || 'n/a'} help="Backend endpoint for replay sample history; this UI does not call it." mono />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2 rounded-lg border bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Mode counts</p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">sample</Badge>
                      {renderCountBadges(replaySampleSummary.mode_counts, 'no sample modes', 6)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">executor</Badge>
                      {renderCountBadges(replayExecutorSummary.mode_counts, 'no executor modes', 6)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Status counts</p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">sample</Badge>
                      {renderCountBadges(replaySampleSummary.status_counts, 'no sample statuses', 6)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">executor</Badge>
                      {renderCountBadges(replayExecutorSummary.status_counts, 'no executor statuses', 6)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Latest replay history item</p>
                {Object.keys(latestReplayHistoryItem).length ? (
                  <div className="space-y-3 rounded-md border bg-background/60 p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={healthVariant(latestReplayHistoryItem.status)}>{formatMode(latestReplayHistoryItem.status || 'history item')}</Badge>
                      {latestReplayHistoryItem.mode ? <Badge variant="outline" className="text-[10px]">{formatMode(latestReplayHistoryItem.mode)}</Badge> : null}
                      {latestReplayHistoryItem.created_at ? <span className="text-muted-foreground">{formatWhen(latestReplayHistoryItem.created_at)}</span> : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <DetailItem label="Replay sample id" value={latestReplayHistoryItem.replay_sample_id || 'n/a'} help="Identifier for the replay sample history item." mono />
                      <DetailItem label="Execution id" value={latestReplayHistoryItem.execution_id || 'n/a'} help="Identifier for the corresponding replay executor record, when present." mono />
                      <DetailItem label="Endpoint" value={latestReplayHistoryItem.endpoint || 'n/a'} help="Endpoint recorded on the latest history item; this UI does not call it." mono />
                      <DetailItem label="Target" value={latestReplayHistoryItem.target_id || 'n/a'} help="Target selected by the latest replay sample item." mono />
                      <DetailItem label="Target type" value={formatMode(latestReplayHistoryItem.target_type)} help="Kind of replay target selected in the latest item." />
                      <DetailItem label="Selected count" value={formatCount(latestReplayHistoryItem.selected_count)} help="Number of candidate IDs selected by this history item." />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Selected candidate ids</p>
                      <div className="flex flex-wrap gap-1">
                        {renderBadgeList(replaySelectedCandidateIds, 'no selected candidate ids', 8)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed bg-background/50 p-3 text-sm text-muted-foreground">No replay sample or executor history item reported in this snapshot.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Safety flags</p>
                <div className="flex flex-wrap gap-1">
                  {renderBadgeList(replaySafetyFlags, 'no safety flags', 10)}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Curated replay dataset</p>
                  <p className="text-xs text-muted-foreground">Read-only preview for future adapter/distillation traces. This card never trains, mutates memory, posts feedback, executes actions, or calls external tools.</p>
                </div>
                <Badge variant={hasReplayDatasetSummary ? 'secondary' : 'outline'}>
                  {hasReplayDatasetSummary ? 'preview summary' : 'no dataset'}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Examples" value={formatCount(replayDatasetCount)} help="Eligible sanitized runtime examples in the current replay dataset preview." />
                <DetailItem label="Positive examples" value={formatCount(replayDatasetPositiveCount)} help="Verified or corrected examples eligible only as preview SFT-style positives." />
                <DetailItem label="Negative lessons" value={formatCount(replayDatasetNegativeCount)} help="Contradicted, failed, or rejected examples kept as negative lessons or DPO rejected-side candidates." />
                <DetailItem label="Training role" value={formatMode(replayDatasetSummary.training_role)} help="Dataset preview role. It must remain preview-only until a separate gated training job exists." />
                <DetailItem label="Endpoint" value={replayDatasetSummary.endpoint || 'n/a'} help="Dataset preview endpoint surfaced by the backend; this UI only reads telemetry." mono />
                <DetailItem label="Latest export" value={formatWhen(replayDatasetLatestTimestamp)} help="Most recent dataset preview/export or replay-history timestamp included in telemetry." />
                <DetailItem label="Empty reason" value={formatMode(replayDatasetSummary.empty_reason)} help="Why the dataset preview has no eligible examples, when empty." />
                <DetailItem
                  label="Mutation boundary"
                  value={(
                    <div className="flex flex-wrap gap-1">
                      {renderStatusBadge(replayDatasetSafetyFlags.training_started, 'training started', 'no training', 'destructive')}
                      {renderStatusBadge(replayDatasetSafetyFlags.memory_mutated, 'memory mutated', 'no memory mutation', 'destructive')}
                      {renderStatusBadge(replayDatasetSafetyFlags.feedback_posted, 'feedback posted', 'no feedback post', 'destructive')}
                      {renderStatusBadge(replayDatasetSafetyFlags.external_calls_made, 'external calls', 'no external calls', 'destructive')}
                    </div>
                  )}
                  help="Safety proof fields from the backend dataset preview. False values are the expected safe state."
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2 rounded-lg border bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Provenance counts</p>
                  <div className="flex flex-wrap gap-1">
                    {renderCountBadges(replayDatasetSummary.provenance_counts, 'no provenance counts', 8)}
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Example type counts</p>
                  <div className="flex flex-wrap gap-1">
                    {renderCountBadges(replayDatasetSummary.example_type_counts, 'no example types', 8)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Enabled safety flags</p>
                <div className="flex flex-wrap gap-1">
                  {renderBadgeList(replayDatasetVisibleSafetyFlags, 'no enabled safety flags', 10)}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Policy actuator</p>
                  <p className="text-xs text-muted-foreground">Read-only advisory decision from this living-loop status snapshot.</p>
                </div>
                <Badge variant={hasPolicyDecision ? 'secondary' : 'outline'}>
                  {hasPolicyDecision ? 'status snapshot' : 'no decision'}
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Recommendation" value={formatMode(policyRecommendation)} help="Policy actuator recommendation for the next safe operator-visible step." />
                <DetailItem label="Action" value={formatMode(policyAction)} help="Normalized action name selected by the advisory policy actuator." />
                <DetailItem
                  label="Status"
                  value={(
                    <div className="flex flex-wrap gap-1">
                      {renderStatusBadge(policyDecision.advisory, 'advisory', 'not advisory')}
                      {renderStatusBadge(policyDecision.executable, 'executable', 'not executable', 'destructive')}
                    </div>
                  )}
                  help="The actuator is intended to be advisory/read-only; executable false means the UI should not run this action."
                />
                <DetailItem label="Risk" value={formatPercent(policyRisk, 0)} help="Estimated risk of the suggested policy step." />
                <DetailItem label="Uncertainty" value={formatPercent(policyUncertainty, 0)} help="Estimated uncertainty used to choose or defer the policy step." />
                <DetailItem label="Expected info gain" value={formatPercent(policyInformationGain, 0)} help="Expected information gain if an operator follows the suggested endpoint/input." />
                <DetailItem label="Expected cost" value={formatPercent(policyCost, 0)} help="Expected policy cost or budget pressure for the suggested step." />
                <DetailItem label="Suggested endpoint" value={policyDecision.suggested_endpoint || 'n/a'} help="Endpoint the backend suggests inspecting next; this card does not call it." mono />
                <DetailItem label="Target id" value={policyTargetId || 'n/a'} help="Action or runtime episode id the advisory decision is focused on, when available." mono />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Top reasons</p>
                {policyReasons.length ? (
                  <div className="grid gap-2 lg:grid-cols-3">
                    {policyReasons.slice(0, 3).map((reason, index) => (
                      <div key={`${policyReasonCode(reason, index)}-${index}`} className="space-y-2 rounded-md border bg-background/60 p-3 text-xs">
                        <Badge variant="outline" className="text-[10px]">{formatMode(policyReasonCode(reason, index))}</Badge>
                        <p className="line-clamp-3 text-sm leading-5 text-muted-foreground">{formatPolicyReason(reason)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed bg-background/50 p-3 text-sm text-muted-foreground">No policy actuator reasons reported in this snapshot.</p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Evaluator feedback</p>
                  <p className="text-xs text-muted-foreground">Read-only runtime feedback folded into the living-loop status snapshot.</p>
                </div>
                <Badge variant={healthVariant(groundingImpact)}>{formatMode(groundingImpact)}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Feedback" value={formatCount(feedbackCount)} help="Total evaluator feedback records attached to runtime episodes or actions." />
                <DetailItem label="Verified / unverified" value={`${formatCount(verifiedFeedbackCount)} / ${formatCount(unverifiedFeedbackCount)}`} help="Applied feedback statuses after corrected outputs and verdicts are normalized." />
                <DetailItem label="Contradicted" value={formatCount(contradictedFeedbackCount)} help="Feedback records that currently contradict the runtime target." />
                <DetailItem label="Grounding checks" value={`${formatCount(groundedVerifiedCount)} / ${formatCount(groundingVerificationCount)}`} help="Verified action checks over total action verification checks from grounding health." />
                <DetailItem label="Verdict counts" value={`${formatCount(verifiedVerdictCount)} verified · ${formatCount(contradictedVerdictCount)} contradicted`} help="Raw evaluator verdict counts before applied-status correction." />
                <DetailItem label="Target mix" value={`${formatCount(runtimeEpisodeFeedbackCount)} episodes · ${formatCount(actionFeedbackCount)} actions`} help="Where feedback was attached in the runtime snapshot." />
                <DetailItem label="Grounding impact" value={<Badge variant={healthVariant(groundingImpact)}>{formatMode(groundingImpact)}</Badge>} help="How evaluator feedback affects the grounding-health status." />
                <DetailItem label="Action contradictions" value={formatCount(groundedContradictionCount)} help="Contradicted action-verification count from grounding health or benchmark telemetry." />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Recent feedback</p>
                {recentFeedback.length ? (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {recentFeedback.slice(0, 4).map((feedback, index) => (
                      <div key={feedback.feedback_id || `${feedback.created_at || 'feedback'}-${feedback.target_id || index}`} className="space-y-2 rounded-md border bg-background/60 p-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={healthVariant(feedback.applied_status || feedback.verdict)}>{formatMode(feedback.applied_status || feedback.verdict || 'feedback')}</Badge>
                          {feedback.target_type ? <span className="text-muted-foreground">{formatMode(feedback.target_type)}</span> : null}
                          {feedback.confidence !== null && feedback.confidence !== undefined ? <span className="font-medium">{formatPercent(feedback.confidence, 0)}</span> : null}
                          {feedback.created_at ? <span className="text-muted-foreground">{formatWhen(feedback.created_at)}</span> : null}
                        </div>
                        <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{formatFeedbackSummary(feedback)}</p>
                        {asArray(feedback.tags).length ? (
                          <div className="flex flex-wrap gap-1">
                            {asArray(feedback.tags).slice(0, 3).map((tag) => (
                              <Badge key={String(tag)} variant="outline" className="text-[10px]">{formatMode(tag)}</Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed bg-background/50 p-3 text-sm text-muted-foreground">No evaluator feedback recorded yet.</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Capabilities</p>
                <div className="flex flex-wrap gap-2">
                  {renderBadgeList(livingCapabilities, 'no capabilities')}
                </div>
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Tools</p>
                <div className="space-y-2">
                  {livingTools.length ? livingTools.slice(0, 4).map((tool) => (
                    <div key={tool.name || tool.tool || JSON.stringify(tool)} className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={healthVariant(tool.status)}>{formatMode(tool.name || tool.tool || 'tool')}</Badge>
                      <span className="text-muted-foreground">{formatCount(tool.observed_action_count)} actions</span>
                      <span className="font-medium">{formatPercent(tool.success_rate, 0)}</span>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No tools observed yet.</p>}
                </div>
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">Skill memories</p>
                <div className="space-y-2">
                  {skillMemories.length ? skillMemories.slice(0, 4).map((memory) => (
                    <div key={memory.skill_id || `${memory.tool}-${memory.action_type}`} className="space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={healthVariant(memory.status)}>{formatMode(memory.tool || memory.action_type || 'skill')}</Badge>
                        <span className="text-muted-foreground">{formatCount(memory.action_count)} runs</span>
                        <span className="font-medium">{formatPercent(memory.success_rate, 0)}</span>
                      </div>
                      {asArray(memory.topics).length ? (
                        <p className="truncate text-muted-foreground">{asArray(memory.topics).slice(0, 3).join(', ')}</p>
                      ) : null}
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No skill memories recorded yet.</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Runtime basics</CardTitle>
            <CardDescription>The main state fields the live service updates on each snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Model" value={runtimeScope.model_type || 'n/a'} help="Which model family this checkpoint belongs to. Use it mainly as identity info, not as a quality score." />
            <DetailItem label="Revision" value={status?.state_revision ?? 'n/a'} help="How many times the in-memory state has changed since loading. Higher just means more changes, not better quality." />
            <DetailItem label="Last winner" value={status?.last_winner ?? 'n/a'} help="The last routing column that won. The number itself means little; similar prompts should usually hit similar winners." />
            <DetailItem label="Context norm" value={formatFloat(status?.context_state_norm, 2)} help="How strong the current context signal is. Near zero means context is barely affecting routing. Very high values can mean it is taking over too much." />
            <DetailItem label="Trace directory" value={status?.trace_storage_dir || 'n/a'} mono help="Folder where trace files are written. This is storage info only." />
            <DetailItem label="Estimated neurons" value={runtimeScope.estimated_neurons?.toLocaleString?.() || runtimeScope.estimated_neurons || 'n/a'} help="Rough size of the loaded runtime. Bigger can help coverage, but only if support, routing, and drift stay healthy." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Checkpoint metadata</CardTitle>
            <CardDescription>Training source and token counts baked into the loaded checkpoint.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Protocol" value={checkpointMetadata.protocol || 'n/a'} help="Which training recipe produced this checkpoint. Useful for tracking origin, not for judging quality by itself." />
            <DetailItem label="Source" value={checkpointMetadata.source || 'n/a'} help="Where the training text came from. This strongly affects what the checkpoint is likely to know." />
            <DetailItem label="HF config" value={checkpointMetadata.hf_config || 'n/a'} help="The dataset setup used during training. Useful when you need to trace the checkpoint back to the exact data variant." />
            <DetailItem label="Text field" value={checkpointMetadata.text_field || 'n/a'} help="Which text field from the dataset was used for training." />
            <DetailItem label="Train tokens" value={checkpointMetadata.train_tokens?.toLocaleString?.() || checkpointMetadata.train_tokens || 'n/a'} help="How much training text was used. More can help, but only if forgetting stayed under control." />
            <DetailItem label="Eval tokens" value={checkpointMetadata.eval_tokens?.toLocaleString?.() || checkpointMetadata.eval_tokens || 'n/a'} help="How much held-out text was used to test the checkpoint. More usually makes the evaluation more trustworthy." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Memory store</CardTitle>
            <CardDescription>How much material is stored and how often it has been replayed.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Capacity" value={memoryStore.capacity ?? 'n/a'} help="Maximum number of long-term memory items the store can hold. Too little fills up fast; too much costs more to keep and replay." />
            <DetailItem label="Slow buffer size" value={memoryStore.slow_buffer_size ?? 'n/a'} help="How many long-term memory items are stored right now." />
            <DetailItem label="Fill fraction" value={formatPercent(memoryStore.slow_buffer_fill_fraction, 0)} help="How full the long-term memory is. Around 50% to 85% is usually fine. Near 90% or more means memory is crowded." />
            <DetailItem label="Seen tokens" value={memoryStore.n_seen?.toLocaleString?.() || memoryStore.n_seen || 'n/a'} help="How much text the memory store has seen in total. More exposure helps only if the stored memories are still easy to retrieve." />
            <DetailItem label="Mean importance" value={formatFloat(memoryStore.mean_importance, 4)} help="Average priority of stored memories. If everything is too similar, the system may not be ranking memories well. If a few memories dominate too much, replay can become biased." />
            <DetailItem label="Max replay count" value={memoryStore.max_replay_count ?? 'n/a'} help="How many times the most-replayed memory has been reused. Very high values can mean one memory is taking too much attention." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Routing index</CardTitle>
            <CardDescription>The structure that makes fast nearest-neighbor routing possible.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Backend mode" value={runtimeScope.routing_backend_mode || 'n/a'} help="The requested routing backend family. Auto picks a backend based on the current device, while explicit modes pin the runtime to a specific path." />
            <DetailItem label="Index type" value={routingIndex.index_type || 'n/a'} help="The kind of lookup structure used for routing. It affects speed and memory use more than quality by itself." />
            <DetailItem label="Search device" value={routingIndex.search_device || 'n/a'} help="Which device executes the routing lookup itself. CPU here means the current environment is not yet proving device-side GPU routing." />
            <DetailItem label="Shards" value={routingIndex.n_shards ?? 'n/a'} help="How many pieces the routing index is split into. More shards can help scale, but too many can make balancing harder."
            />
            <DetailItem label="Raw entries" value={routingIndex.raw_entries ?? 'n/a'} help="Total routing entries added to the index, including duplicates or entries that may later be compacted." />
            <DetailItem label="Unique vectors" value={routingIndex.unique_vectors ?? 'n/a'} help="How many distinct routing vectors are in the index. Very low diversity can mean too many duplicates or collapse." />
            <DetailItem label="Rebuild count" value={routingIndex.rebuild_count ?? 'n/a'} help="How many times the routing index has been rebuilt. This is maintenance info, not a quality score." />
            <DetailItem label="Balance ratio" value={formatFloat(routingIndex.shard_balance_ratio, 2)} help="How evenly entries are spread across shards. Closer to 1 is better. Above about 2 usually means one shard is overloaded." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weight snapshot</CardTitle>
            <CardDescription>The active input-weight distribution reported by the runtime.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Mean" value={formatFloat(columnInputWeights.mean, 4)} help="Average input weight. The exact value matters less than whether the weights still have a healthy spread." />
            <DetailItem label="Std" value={formatFloat(columnInputWeights.std, 4)} help="How spread out the input weights are. Very low spread can mean collapse. Very high spread can mean a few weights dominate." />
            <DetailItem label="Min" value={formatFloat(columnInputWeights.min, 4)} help="Smallest input weight in the current snapshot." />
            <DetailItem label="Max" value={formatFloat(columnInputWeights.max, 4)} help="Largest input weight in the current snapshot. A much larger max can mean a few inputs dominate routing."
            />
            <DetailItem label="Skewness" value={formatFloat(columnInputWeights.skewness, 3)} help="Shows whether the weight distribution leans heavily to one side. Near zero is more balanced." />
            <DetailItem label="Kurtosis" value={formatFloat(columnInputWeights.excess_kurtosis, 3)} help="Shows whether a few extreme weights stand out too much. Very high values mean the tails are heavy." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Sensory grounding
              {brain?.multimodal?.enabled && <Badge variant="secondary" className="text-[10px]">active</Badge>}
            </CardTitle>
            <CardDescription>Real Hugging Face image/audio grounding plus auxiliary curriculum hints.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Enabled" value={brain?.multimodal?.enabled ? 'Yes' : 'No'} help="Whether real sensory grounding is active. When enabled, image/audio episodes run alongside the text curriculum." />
            <DetailItem label="Mode" value={brain?.multimodal?.mode ?? 'n/a'} help="Which sensory paths are currently enabled. This can include real HF streams, curriculum hints, or both." />
            <DetailItem label="Real episodes" value={brain?.multimodal?.real_episodes_completed ?? 'n/a'} help="How many real Hugging Face sensory episodes have been injected so far." />
            <DetailItem label="Hints" value={brain?.multimodal?.hint_episodes_completed ?? 'n/a'} help="How many curriculum-derived auxiliary hint episodes have been injected." />
            <DetailItem label="Visual accepted" value={brain?.multimodal?.cross_modal_visual_accepted ?? 'n/a'} help="Total visual bindings accepted by the cross-modal gate across real and hint episodes." />
            <DetailItem label="Audio accepted" value={brain?.multimodal?.cross_modal_audio_accepted ?? 'n/a'} help="Total audio bindings accepted by the cross-modal gate across real and hint episodes." />
            <DetailItem label="Visual confidence" value={formatFloat(brain?.multimodal?.visual_confidence_mean, 3)} help="Mean visual grounding confidence from the cross-modal layer." />
            <DetailItem label="Audio confidence" value={formatFloat(brain?.multimodal?.audio_confidence_mean, 3)} help="Mean audio grounding confidence from the cross-modal layer." />
            <DetailItem label="Recent previews" value={brain?.multimodal?.recent_preview_count ?? 'n/a'} help="How many recent real image/audio previews are available for the Sensory tab." />
            <DetailItem label="Focus terms" value={Array.isArray(brain?.multimodal?.focus_terms) && brain.multimodal.focus_terms.length ? brain.multimodal.focus_terms.slice(0, 3).join(', ') : 'n/a'} help="Terms currently steering semantic sensory routing." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Mind
              {brain?.cortex?.running && <Badge variant="secondary" className="text-[10px] animate-pulse">thinking</Badge>}
            </CardTitle>
            <CardDescription>LLM-powered thought generation via NVIDIA NIM — the mind layer of the living brain.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Enabled" value={brain?.cortex?.enabled ? 'Yes' : 'No'} help="Whether the mind layer (LLM thought loop) is active. Requires NVIDIA_API_KEY set in .env." />
            <DetailItem label="Thoughts" value={brain?.cortex?.thoughts_generated ?? 'n/a'} help="Total autonomous thoughts generated by the mind layer since startup." />
            <DetailItem label="Avg inference" value={brain?.cortex?.avg_inference_ms != null ? `${brain.cortex.avg_inference_ms.toFixed(0)} ms` : 'n/a'} help="Average time per LLM inference call. Lower is better; depends on model size and hardware." />
            <DetailItem label="Memory" value={brain?.cortex?.memory_count != null ? `${brain.cortex.memory_count} / 2048` : 'n/a'} help="Episodic memory entries stored by the Cortex. Includes observations from SNN, inferences, and dreams." />
            <DetailItem label="Mode" value={brain?.cortex?.current_mode ?? 'n/a'} help="Current thinking mode: idle (waiting), thinking (generating), reflecting (self-critique), dreaming (sleep consolidation)." />
            <DetailItem label="Sleep cycles" value={brain?.cortex?.sleep_cycles ?? 'n/a'} help="Number of sleep/consolidation cycles completed. Sleep replays important memories and generates dream hypotheses." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capability flags</CardTitle>
            <CardDescription>A quick human-readable readout of what this runtime claims to support.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={runtimeScope.supports_contextual_routing ? 'secondary' : 'outline'}>
                contextual routing {runtimeScope.supports_contextual_routing ? 'on' : 'off'}
              </Badge>
              <Badge variant={bindingConjunctionEnabled ? 'secondary' : 'outline'}>
                binding conjunction memory {bindingConjunctionEnabled ? 'on' : 'off'}
              </Badge>
              <Badge variant={runtimeScope.supports_column_sharding_proxy ? 'secondary' : 'outline'}>
                column sharding proxy {runtimeScope.supports_column_sharding_proxy ? 'on' : 'off'}
              </Badge>
              <Badge variant={runtimeScope.validates_full_log_stdp_weight_target ? 'secondary' : 'outline'}>
                full synaptic validation {runtimeScope.validates_full_log_stdp_weight_target ? 'on' : 'off'}
              </Badge>
              <Badge variant={runtimeScope.supports_local_log_stdp ? 'secondary' : 'outline'}>
                local log-STDP {runtimeScope.supports_local_log_stdp ? 'on' : 'off'}
              </Badge>
              <Badge variant={runtimeScope.supports_inhibitory_balance ? 'secondary' : 'outline'}>
                iSTDP balance {runtimeScope.supports_inhibitory_balance ? 'on' : 'off'}
              </Badge>
              <Badge variant={runtimeScope.uses_adex_post_spikes ? 'secondary' : 'outline'}>
                AdEx spikes {runtimeScope.uses_adex_post_spikes ? 'on' : 'off'}
              </Badge>
              <Badge variant={runtimeScope.supports_stc_like_memory_consolidation ? 'secondary' : 'outline'}>
                STC consolidation {runtimeScope.supports_stc_like_memory_consolidation ? 'on' : 'off'}
              </Badge>
              <Badge variant={runtimeScope.supports_first_class_abstraction ? 'secondary' : 'outline'}>
                abstraction layer {runtimeScope.supports_first_class_abstraction ? 'on' : 'off'}
              </Badge>
              <Badge variant={runtimeScope.supports_approximate_attractor_context ? 'secondary' : 'outline'}>
                attractor context {runtimeScope.supports_approximate_attractor_context ? 'on' : 'off'}
              </Badge>
            </div>

            {(runtimeScope.context_architecture || runtimeScope.abstraction_architecture || runtimeScope.binding_architecture) && (
              <div className="grid gap-2 sm:grid-cols-3 rounded-lg border bg-muted/10 p-3">
                {runtimeScope.context_architecture && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Context</p>
                    <p className="text-xs font-medium truncate">{runtimeScope.context_architecture.replaceAll('_', ' ')}</p>
                  </div>
                )}
                {runtimeScope.abstraction_architecture && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Abstraction</p>
                    <p className="text-xs font-medium truncate">{runtimeScope.abstraction_architecture.replaceAll('_', ' ')}</p>
                  </div>
                )}
                {runtimeScope.binding_architecture && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Binding</p>
                    <p className="text-xs font-medium truncate">{runtimeScope.binding_architecture.replaceAll('_', ' ')}</p>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border bg-muted/10 p-4 text-sm leading-6 text-muted-foreground break-words">
              {runtimeScope.reason || weightDistribution.reason || 'No additional runtime note was reported.'}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
