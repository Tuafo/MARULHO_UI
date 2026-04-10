import { RefreshCwIcon } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { DetailItem, EmptyState, HelpTip, SectionFallback, SectionHeading } from '@/components/dashboard/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  bufferedDomain,
  fixedUnitDomain,
  formatCompactNumber,
  formatFloat,
  nicePositiveDomain,
} from '@/lib/dashboard-utils'

const CHART_CLASS = 'h-[240px] w-full aspect-auto'

const REPRESENTATION_SILHOUETTE_CONFIG = {
  hecsnSilhouette: { label: 'HECSN competitive-only', color: 'var(--chart-1)' },
  baselineSilhouette: { label: 'OnlineKMeans baseline', color: 'var(--chart-4)' },
}

const REPRESENTATION_DBI_CONFIG = {
  hecsnDaviesBouldin: { label: 'HECSN competitive-only', color: 'var(--chart-2)' },
  baselineDaviesBouldin: { label: 'OnlineKMeans baseline', color: 'var(--chart-5)' },
}

const MECHANISM_SIGNAL_CONFIG = {
  drift: { label: 'Drift', color: 'var(--chart-1)' },
  surprise: { label: 'Surprise', color: 'var(--chart-3)' },
  drift_floor: { label: 'Drift floor', color: 'var(--chart-5)' },
}

const MECHANISM_ERROR_CONFIG = {
  recon_error: { label: 'Reconstruction error', color: 'var(--chart-2)' },
  pred_error: { label: 'Prediction error', color: 'var(--chart-4)' },
}

const MEMORY_CONSOLIDATION_RECON_CONFIG = {
  taskA: { label: 'Task A', color: 'var(--chart-1)' },
  taskB: { label: 'Task B', color: 'var(--chart-2)' },
}

const MEMORY_CONSOLIDATION_OVERLAP_CONFIG = {
  taskAOverlap: { label: 'Task A overlap', color: 'var(--chart-3)' },
  taskBOverlap: { label: 'Task B overlap', color: 'var(--chart-5)' },
}

const CONTEXTUAL_ROUTING_METRIC_CONFIG = {
  value: { label: 'Value', color: 'var(--chart-1)' },
}

const CONTEXTUAL_ROUTING_REGULATOR_CONFIG = {
  value: { label: 'Mean level', color: 'var(--chart-3)' },
}

const HIERARCHICAL_SCALE_ROUTING_CONFIG = {
  value: { label: 'Value', color: 'var(--chart-1)' },
}

const HIERARCHICAL_SCALE_LATENCY_CONFIG = {
  value: { label: 'Milliseconds', color: 'var(--chart-4)' },
}

const HIERARCHICAL_SCALE_SHARD_CONFIG = {
  size: { label: 'Shard size', color: 'var(--chart-1)' },
  primaryQueries: { label: 'Primary queries', color: 'var(--chart-2)' },
  winnerCount: { label: 'Winner count', color: 'var(--chart-5)' },
}

const AUTONOMY_GAP_CONFIG = {
  activeGap: { label: 'Active policy gap', color: 'var(--chart-1)' },
  roundRobinGap: { label: 'Round-robin gap', color: 'var(--chart-4)' },
}

const AUTONOMY_HISTORY_CONFIG = {
  gapReduction: { label: 'Gap reduction', color: 'var(--chart-2)' },
  gapScoreReduction: { label: 'Diagnostic gap reduction', color: 'var(--chart-5)' },
}

const ACQUISITION_GAP_CONFIG = {
  activeGap: { label: 'Active candidate gap', color: 'var(--chart-1)' },
  scoutGap: { label: 'Scout candidate gap', color: 'var(--chart-2)' },
  roundRobinGap: { label: 'Round-robin candidate gap', color: 'var(--chart-4)' },
}

const ACQUISITION_HISTORY_CONFIG = {
  gapReduction: { label: 'Gap reduction', color: 'var(--chart-2)' },
  diagnosticGapReduction: { label: 'Diagnostic reduction', color: 'var(--chart-5)' },
}

const ACQUISITION_LOOKAHEAD_CONFIG = {
  projectedMeanCandidateGap: { label: 'Projected final mean gap', color: 'var(--chart-2)' },
  projectedMaxCandidateGap: { label: 'Projected final max gap', color: 'var(--chart-5)' },
}

function collectValues(series, keys) {
  return (series || []).flatMap((item) => keys
    .map((key) => Number(item?.[key]))
    .filter((value) => Number.isFinite(value)))
}

function SummaryGrid({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <DetailItem key={item.label} label={item.label} value={item.value} help={item.help} mono={item.mono} />
      ))}
    </div>
  )
}

function BenchmarkCard({ children, description, help, title }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {help ? (
          <CardAction>
            <HelpTip>{help}</HelpTip>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function RepresentationPanel({ benchmark }) {
  const series = benchmark.comparison_series || []
  const summary = benchmark.summary || {}
  const windowSummary = `${formatCompactNumber(summary.train_windows)} / ${formatCompactNumber(summary.eval_windows)}`

  return (
    <div className="space-y-4">
      <SummaryGrid
        items={[
          { label: 'Maintained default', value: summary.maintained_default_label || summary.maintained_default || 'n/a', help: 'The runtime, service, and maintained benchmark suite still use order-weighted ASCII even though the smoke benchmark also evaluates alternative ablations.' },
          { label: 'Maintained silhouette', value: formatFloat(summary.maintained_hecsn_silhouette, 4), help: 'Silhouette for the maintained order-weighted ASCII path under the HECSN competitive-only runner. Higher is better.' },
          { label: 'Maintained baseline silhouette', value: formatFloat(summary.maintained_baseline_silhouette, 4), help: 'Silhouette for the simple OnlineKMeans baseline on the same maintained representation. Higher is better.' },
          { label: 'Best smoke slice', value: summary.best_representation_label || summary.best_representation || 'n/a', help: 'Highest HECSN competitive-only silhouette on this one smoke benchmark. This does not automatically replace the maintained runtime default.' },
          { label: 'Best HECSN silhouette', value: formatFloat(summary.best_hecsn_silhouette, 4), help: 'Best HECSN competitive-only silhouette observed among the tested representations. Higher is better.' },
          { label: 'Train / eval windows', value: windowSummary, help: 'Number of raw character windows used for training and evaluation in the benchmark summary.' },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {summary.source ? <Badge variant="outline">{summary.source}</Badge> : null}
        {summary.source_type ? <Badge variant="secondary">{summary.source_type}</Badge> : null}
        {summary.probe_samples ? <Badge variant="outline">{`${formatCompactNumber(summary.probe_samples)} probe samples`}</Badge> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BenchmarkCard title="Silhouette by representation" description="HECSN competitive-only clustering versus the simple OnlineKMeans baseline." help="Higher bars are better. When the HECSN bar stays above the baseline bar, the competitive layer is extracting more separable structure from the same input representation.">
          <ChartContainer config={REPRESENTATION_SILHOUETTE_CONFIG} className={CHART_CLASS}>
            <BarChart data={series} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(series, ['hecsnSilhouette', 'baselineSilhouette']), 0.1)} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="hecsnSilhouette" fill="var(--color-hecsnSilhouette)" radius={6} />
              <Bar dataKey="baselineSilhouette" fill="var(--color-baselineSilhouette)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>

        <BenchmarkCard title="Davies-Bouldin by representation" description="Cluster compactness and separation for the same runs." help="Lower bars are better. This complements silhouette: a lower Davies-Bouldin index means tighter clusters that stay farther apart.">
          <ChartContainer config={REPRESENTATION_DBI_CONFIG} className={CHART_CLASS}>
            <BarChart data={series} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(series, ['hecsnDaviesBouldin', 'baselineDaviesBouldin']), 1)} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="hecsnDaviesBouldin" fill="var(--color-hecsnDaviesBouldin)" radius={6} />
              <Bar dataKey="baselineDaviesBouldin" fill="var(--color-baselineDaviesBouldin)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>
      </div>
    </div>
  )
}

function MechanismValidationPanel({ benchmark }) {
  const series = benchmark.series || []
  const signalDomain = bufferedDomain(collectValues(series, ['drift', 'surprise', 'drift_floor']), [0, 1])
  const errorDomain = bufferedDomain(collectValues(series, ['recon_error', 'pred_error']), [0, 1])

  return (
    <div className="space-y-4">
      <SummaryGrid
        items={[
          { label: 'Mean drift', value: formatFloat(benchmark.summary?.drift_mean, 4), help: 'Average change in the internal representation during the mechanism-validation run. Lower is better for stability. If this stays high, the system may be overwriting what it learned.' },
          { label: 'Mean surprise', value: formatFloat(benchmark.summary?.surprise_mean, 4), help: 'Average amount of unexpected input. Some spikes are normal, but constantly high surprise means the run is unstable.' },
          { label: 'Mean sparsity', value: formatFloat(benchmark.summary?.sparsity_mean, 4), help: 'How many units were active at once on average. Middle values are usually healthier. Too low can waste capacity; too high can blur patterns.' },
          { label: 'Mean reconstruction error', value: formatFloat(benchmark.summary?.recon_error_mean, 4), help: 'How well the system rebuilt what it saw. Lower is better.' },
          { label: 'Winner entropy', value: formatFloat(benchmark.summary?.winner_entropy_bits, 4), help: 'How widely routing winners were spread across the map. Higher usually means the system used more of the map instead of relying on a small area.' },
          { label: 'Winner max share', value: formatFloat(benchmark.summary?.winner_max_share, 4), help: 'How much one winner column dominated the run. Lower is better.' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <BenchmarkCard
          title="Signal stability"
          description="Drift, surprise, and the drift floor across the token stream."
          help="Drift shows how much the internal state is changing. Surprise shows how unexpected the input was. Drift floor is the baseline drift the system cannot get below. Best case: drift floor stays low and does not keep climbing."
        >
          <ChartContainer config={MECHANISM_SIGNAL_CONFIG} className={CHART_CLASS}>
            <LineChart data={series} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="token" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatCompactNumber} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={signalDomain} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Token ${formatCompactNumber(value)}`} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="drift" stroke="var(--color-drift)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="surprise" stroke="var(--color-surprise)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="drift_floor" stroke="var(--color-drift_floor)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </BenchmarkCard>

        <BenchmarkCard
          title="Reconstruction vs prediction"
          description="How the two error curves behaved across the same run."
          help="Both lines are errors, so lower is better. If they keep spiking, the model is having trouble settling down."
        >
          <ChartContainer config={MECHANISM_ERROR_CONFIG} className={CHART_CLASS}>
            <LineChart data={series} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="token" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatCompactNumber} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={errorDomain} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Token ${formatCompactNumber(value)}`} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="recon_error" stroke="var(--color-recon_error)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pred_error" stroke="var(--color-pred_error)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </BenchmarkCard>
      </div>
    </div>
  )
}

function MemoryConsolidationPanel({ benchmark }) {
  const reconSeries = benchmark.reconstruction_series || []

  return (
    <div className="space-y-4">
      <SummaryGrid
        items={[
          { label: 'Task A recovery delta', value: formatFloat(benchmark.summary?.task_a_recovery_delta, 4), help: 'How much task A recovered after consolidation. Positive is good. Negative means consolidation made forgetting worse.' },
          { label: 'Task A overlap after consolidation', value: formatFloat(benchmark.summary?.task_a_overlap_after_consolidation, 4), help: 'How much of task A is still there after task B and consolidation. Higher is better.' },
          { label: 'Task B overlap after consolidation', value: formatFloat(benchmark.summary?.task_b_overlap_after_consolidation, 4), help: 'How much of task B is still there after consolidation. Higher is better.' },
          { label: 'Relative degradation', value: formatFloat(benchmark.summary?.task_a_relative_degradation_after_consolidation, 4), help: 'How much task A was lost after consolidation. Lower is better. Near zero means little forgetting.' },
          { label: 'Gate', value: <Badge variant={benchmark.summary?.gate_pass ? 'secondary' : 'destructive'}>{benchmark.summary?.gate_pass ? 'pass' : 'fail'}</Badge>, help: 'Whether this memory benchmark passed its retention check. Pass means forgetting stayed within the allowed limit.' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <BenchmarkCard title="Task reconstruction path" description="Task-A and task-B reconstruction errors across the memory-consolidation milestones." help="Lower lines are better. If task A jumps up after task B starts, that is forgetting. If both lines come back down after consolidation, replay is helping.">
          <ChartContainer config={MEMORY_CONSOLIDATION_RECON_CONFIG} className={CHART_CLASS}>
            <LineChart data={reconSeries} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="step" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={bufferedDomain(collectValues(reconSeries, ['taskA', 'taskB']), [0, 1])} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="taskA" stroke="var(--color-taskA)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="taskB" stroke="var(--color-taskB)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </BenchmarkCard>

        <BenchmarkCard title="Overlap after task B and consolidation" description="Task overlap after task B and after the consolidation pass." help="Higher bars are better. After consolidation, you want both tasks to stay present instead of dropping away.">
          <ChartContainer config={MEMORY_CONSOLIDATION_OVERLAP_CONFIG} className={CHART_CLASS}>
            <BarChart data={benchmark.overlap_series || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="step" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={fixedUnitDomain()} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="taskAOverlap" fill="var(--color-taskAOverlap)" radius={6} />
              <Bar dataKey="taskBOverlap" fill="var(--color-taskBOverlap)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>
      </div>
    </div>
  )
}

function ContextualRoutingPanel({ benchmark }) {
  return (
    <div className="space-y-4">
      <SummaryGrid
        items={[
          { label: 'Task A recon error', value: formatFloat(benchmark.summary?.task_a_recon_error, 4), help: 'How well task A could still be rebuilt at the end of contextual routing. Lower is better.' },
          { label: 'Task B recon error', value: formatFloat(benchmark.summary?.task_b_recon_error, 4), help: 'How well task B could still be rebuilt at the end of contextual routing. Lower is better.' },
          { label: 'Context separation', value: formatFloat(benchmark.summary?.context_state_separation, 4), help: 'How different the context states are from each other. Higher is better. Values near zero mean the contexts are blending together.' },
          { label: 'Winner switch rate', value: formatFloat(benchmark.summary?.probe_winner_switch_rate, 4), help: 'How often the winning route changed when context changed. Higher means context is actually affecting routing. If it is near zero, context is not doing much.' },
          { label: 'Assembly distance', value: formatFloat(benchmark.summary?.probe_mean_assembly_distance, 4), help: 'How far apart the assemblies are under different contexts. Bigger usually means clearer separation.' },
          { label: 'B3 bank accuracy', value: formatFloat(benchmark.summary?.bank_polysemy_accuracy, 4), help: 'Leave-one-out accuracy for the fixed bank-after-river versus bank-after-money probe family. Above 0.60 means the same word is separating by context often enough to clear the paper threshold.' },
          { label: 'B3 signature margin', value: formatFloat(benchmark.summary?.bank_polysemy_signature_margin, 4), help: 'How much farther apart the bank probe signatures are across river-versus-money contexts than they are within the same family. Positive is better.' },
          { label: 'B3 winner diff rate', value: formatFloat(benchmark.summary?.bank_polysemy_winner_sequence_difference_rate, 4), help: 'How often the bank probe winner sequence changes across river-versus-money contexts. Higher means stronger contextual branching.' },
          { label: 'Gate', value: <Badge variant={benchmark.summary?.gate_pass ? 'secondary' : 'destructive'}>{benchmark.summary?.gate_pass ? 'pass' : 'fail'}</Badge>, help: 'Whether this contextual-routing benchmark passed.' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <BenchmarkCard title="Contextual-routing probe metrics" description="Key probe metrics reported after the contextual-routing work." help="The key things here are context separation, winner switch rate, and the explicit bank-after-river versus bank-after-money probe. You want the B3 bank accuracy above 0.60 so the same word separates by context often enough to support the polysemy claim.">
          <ChartContainer config={CONTEXTUAL_ROUTING_METRIC_CONFIG} className={CHART_CLASS}>
            <BarChart data={benchmark.metric_series || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(benchmark.metric_series, ['value']), 1)} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>

        <BenchmarkCard title="Mean regulator levels" description="Average surprise-style regulators observed during the same contextual-routing benchmark." help="These are average change signals. Dopamine tracks better-than-expected learning pressure, serotonin tracks inhibitory pressure when prediction worsens, acetylcholine tracks expected uncertainty and novelty, and norepinephrine tracks reset pressure under unexpected uncertainty. Healthy runs move, but do not stay pinned at extremes.">
          <ChartContainer config={CONTEXTUAL_ROUTING_REGULATOR_CONFIG} className={CHART_CLASS}>
            <BarChart data={benchmark.regulator_series || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(benchmark.regulator_series, ['value']), 1)} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>
      </div>
    </div>
  )
}

function HierarchicalScalePanel({ benchmark }) {
  return (
    <div className="space-y-4">
      <SummaryGrid
        items={[
          { label: 'Eval recon error', value: formatFloat(benchmark.summary?.eval_recon_error, 4), help: 'How well held-out inputs were rebuilt after the hierarchical-scale benchmark. Lower is better.' },
          { label: 'Recall@k', value: formatFloat(benchmark.summary?.recall_at_k, 4), help: 'How often the correct route was somewhere in the top candidate list. Higher is better.' },
          { label: 'Top-1 recall', value: formatFloat(benchmark.summary?.top1_recall, 4), help: 'How often the very first route choice was correct. Higher is better.' },
          { label: 'Mean latency', value: `${formatFloat(benchmark.summary?.mean_latency_ms, 2)} ms`, help: 'Average routing time. Lower is better if quality stays high.' },
          { label: 'P95 latency', value: `${formatFloat(benchmark.summary?.p95_latency_ms, 2)} ms`, help: 'Routing time for the slowest 5% of requests. Lower is better. If this is much higher than the mean, the system has occasional slow spikes.' },
          { label: 'Throughput', value: `${formatFloat(benchmark.summary?.throughput_chars_per_sec, 1)} chars/s`, help: 'How fast text was processed during evaluation. Higher is better for speed, as long as recall stays good.' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <BenchmarkCard title="Routing quality" description="Core routing metrics from the sharded-index benchmark." help="Higher recall is better. You also want shard use to stay fairly even so the index does not depend too much on one small area.">
          <ChartContainer config={HIERARCHICAL_SCALE_ROUTING_CONFIG} className={CHART_CLASS}>
            <BarChart data={benchmark.routing_series || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(benchmark.routing_series, ['value']), 1)} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>

        <BenchmarkCard title="Latency profile" description="Mean and P95 latency from the sharded routing run." help="Lower bars are better. A small gap between mean and P95 means speed is steady. A large gap means some requests are much slower than the rest.">
          <ChartContainer config={HIERARCHICAL_SCALE_LATENCY_CONFIG} className={CHART_CLASS}>
            <BarChart data={benchmark.latency_series || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(benchmark.latency_series, ['value']), 10)} tickFormatter={(value) => `${Math.round(value)} ms`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>
      </div>

      <BenchmarkCard title="Shard distribution" description="Shard size, primary-query traffic, and winning-column distribution side by side." help="More even bars are better. If one shard dominates size, traffic, or winners, routing becomes more fragile.">
        <ChartContainer config={HIERARCHICAL_SCALE_SHARD_CONFIG} className={CHART_CLASS}>
          <BarChart data={benchmark.shard_series || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="shard" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
            <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(benchmark.shard_series, ['size', 'primaryQueries', 'winnerCount']), 1)} tickFormatter={formatCompactNumber} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="size" fill="var(--color-size)" radius={6} />
            <Bar dataKey="primaryQueries" fill="var(--color-primaryQueries)" radius={6} />
            <Bar dataKey="winnerCount" fill="var(--color-winnerCount)" radius={6} />
          </BarChart>
        </ChartContainer>
      </BenchmarkCard>
    </div>
  )
}

function AutonomyPanel({ benchmark }) {
  return (
    <div className="space-y-4">
      <SummaryGrid
        items={[
          { label: 'Active mean gap', value: formatFloat(benchmark.summary?.active_mean_gap, 4), help: 'Average remaining gap under the active policy. Lower is better.' },
          { label: 'Round-robin mean gap', value: formatFloat(benchmark.summary?.round_robin_mean_gap, 4), help: 'Average remaining gap under the round-robin baseline. This is mostly here so you can compare it with the active policy.' },
          { label: 'Active mean gap score', value: formatFloat(benchmark.summary?.active_mean_gap_score, 4), help: 'Diagnostic version of the remaining gap for the active policy. Lower is better.' },
          { label: 'Round-robin mean gap score', value: formatFloat(benchmark.summary?.round_robin_mean_gap_score, 4), help: 'Diagnostic gap score for the round-robin baseline. Mainly useful for comparison.' },
          { label: 'Mean selected gap reduction', value: formatFloat(benchmark.summary?.active_mean_selected_gap_reduction, 4), help: 'Average improvement from each chosen action. Positive is good. Negative means the policy often made things worse.' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <BenchmarkCard title="Gap by source" description="Source-level gaps comparing the active policy with a round-robin baseline." help="Lower active bars are better. The active policy is helping when it leaves smaller gaps than round-robin on the same sources.">
          <ChartContainer config={AUTONOMY_GAP_CONFIG} className={CHART_CLASS}>
            <BarChart data={benchmark.gap_by_source || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="source" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(benchmark.gap_by_source, ['activeGap', 'roundRobinGap']), 1)} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="activeGap" fill="var(--color-activeGap)" radius={6} />
              <Bar dataKey="roundRobinGap" fill="var(--color-roundRobinGap)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>

        <BenchmarkCard title="Episode reduction history" description="How much each seek episode reduced the target gap over time." help="Positive values are good because each episode is closing the gap. Negative values mean the chosen action increased the gap.">
          <ChartContainer config={AUTONOMY_HISTORY_CONFIG} className={CHART_CLASS}>
            <LineChart data={benchmark.episode_history || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="episode" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={bufferedDomain(collectValues(benchmark.episode_history, ['gapReduction', 'gapScoreReduction']), [0, 1])} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Episode ${value}`} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="gapReduction" stroke="var(--color-gapReduction)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gapScoreReduction" stroke="var(--color-gapScoreReduction)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </BenchmarkCard>
      </div>
    </div>
  )
}

function AcquisitionPanel({ benchmark }) {
  const hasScout = benchmark.summary?.scout_mean_candidate_gap !== undefined
  const hasLookahead = Boolean(benchmark.scout_lookahead_history?.length)
  const historyPolicyLabel = benchmark.history_policy === 'scout_commit' ? 'scout-and-commit' : 'active'
  const gapKeys = hasScout ? ['activeGap', 'scoutGap', 'roundRobinGap'] : ['activeGap', 'roundRobinGap']
  const lookaheadKeys = ['projectedMeanCandidateGap', 'projectedMaxCandidateGap']
  const benchmarkLabel = benchmark.artifact_label || 'current frontier'
  const bindingEnabled = benchmark.runtime_scope?.supports_binding_conjunction_memory

  const summaryItems = [
    { label: 'Active mean candidate gap', value: formatFloat(benchmark.summary?.active_mean_candidate_gap, 4), help: 'Average remaining candidate gap under the active policy. Lower is better.' },
    { label: 'Round-robin mean candidate gap', value: formatFloat(benchmark.summary?.round_robin_mean_candidate_gap, 4), help: 'Average remaining candidate gap under round-robin. Use it as the baseline to beat.' },
    { label: 'Active diagnostic candidate gap', value: formatFloat(benchmark.summary?.active_mean_candidate_diagnostic_gap, 4), help: 'Diagnostic version of the candidate gap for the active policy. Lower is better.' },
    { label: 'Round-robin diagnostic candidate gap', value: formatFloat(benchmark.summary?.round_robin_mean_candidate_diagnostic_gap, 4), help: 'Diagnostic candidate gap for round-robin. Mainly used for comparison.' },
  ]

  if (hasScout) {
    summaryItems.push(
      { label: 'Scout mean candidate gap', value: formatFloat(benchmark.summary?.scout_mean_candidate_gap, 4), help: 'Average remaining candidate gap under the scout-and-commit policy. Lower is better.' },
      { label: 'Scout diagnostic candidate gap', value: formatFloat(benchmark.summary?.scout_mean_candidate_diagnostic_gap, 4), help: 'Diagnostic candidate gap for scout-and-commit. Lower is better.' },
    )
  }

  if (hasLookahead) {
    summaryItems.push(
      { label: 'Scout projected mean gap', value: formatFloat(benchmark.summary?.scout_projected_mean_candidate_gap, 4), help: 'Average projected end-of-run candidate gap for the scout previews that were actually committed. Lower is better.' },
      { label: 'Lookahead advantage', value: formatFloat(benchmark.summary?.scout_mean_lookahead_advantage, 4), help: 'Average projected gap advantage of the committed scout choice over the best rejected preview in the same slot. Positive means the isolated-lookahead scout had a measurable reason to choose differently.' },
    )
  }

  return (
    <div className="space-y-4">
      <SummaryGrid items={summaryItems} />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{benchmarkLabel}</Badge>
        {benchmark.scout_policy === 'isolated_lookahead' ? <Badge variant="secondary">isolated lookahead scout</Badge> : null}
        {benchmark.runtime_scope?.input_representation ? <Badge variant="outline">{benchmark.runtime_scope.input_representation}</Badge> : null}
        {benchmark.runtime_scope?.supports_contextual_routing ? <Badge variant="secondary">context routing on</Badge> : null}
        {bindingEnabled ? <Badge variant="secondary">binding memory on</Badge> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(benchmark.active_acquired_sources || []).map((source) => (
          <Badge key={`active-${source}`} variant="secondary">active acquired {source}</Badge>
        ))}
        {(benchmark.scout_acquired_sources || []).map((source) => (
          <Badge key={`scout-${source}`} variant="default">scout acquired {source}</Badge>
        ))}
        {(benchmark.round_robin_acquired_sources || []).map((source) => (
          <Badge key={`rr-${source}`} variant="outline">round-robin acquired {source}</Badge>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BenchmarkCard title="Candidate gap by source" description={hasScout ? `Compare active, scout-and-commit, and round-robin acquisition on the ${benchmarkLabel}.` : 'Which sources the active acquisition policy closed more effectively than the baseline.'} help={hasScout ? 'Lower bars are better. This panel reflects the latest acquisition artifact selected by the backend, so scout should be treated as exploratory unless it actually beats the baseline in that report.' : 'Lower active bars are better. The active policy is helping when it leaves smaller gaps than the baseline on most sources.'}>
          <ChartContainer config={ACQUISITION_GAP_CONFIG} className={CHART_CLASS}>
            <BarChart data={benchmark.gap_by_source || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="source" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(benchmark.gap_by_source, gapKeys), 1)} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="activeGap" fill="var(--color-activeGap)" radius={6} />
              {hasScout ? <Bar dataKey="scoutGap" fill="var(--color-scoutGap)" radius={6} /> : null}
              <Bar dataKey="roundRobinGap" fill="var(--color-roundRobinGap)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>

        <BenchmarkCard title="Acquisition slot history" description={`Gap reductions over the acquisition slots selected by the ${historyPolicyLabel} policy on the ${benchmarkLabel}.`} help="Positive values are good because each selected slot improved the catalog. Negative values mean the choice made the gap worse.">
          <ChartContainer config={ACQUISITION_HISTORY_CONFIG} className={CHART_CLASS}>
            <LineChart data={benchmark.selection_history || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="slot" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={bufferedDomain(collectValues(benchmark.selection_history, ['gapReduction', 'diagnosticGapReduction']), [0, 1])} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Slot ${value}`} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="gapReduction" stroke="var(--color-gapReduction)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="diagnosticGapReduction" stroke="var(--color-diagnosticGapReduction)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </BenchmarkCard>
      </div>

      {hasLookahead ? (
        <BenchmarkCard title="Scout lookahead projections" description="Projected end-of-run frontier for each scout preview before the real commit is replayed." help="Lower projected gaps are better. Labels ending with * are the candidates that were actually committed. The separation between the selected preview and the best rejected preview is the lookahead advantage restored by the isolated-clone scout fix.">
          <ChartContainer config={ACQUISITION_LOOKAHEAD_CONFIG} className={CHART_CLASS}>
            <BarChart data={benchmark.scout_lookahead_history || []} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="slotCandidate" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} width={72} domain={nicePositiveDomain(collectValues(benchmark.scout_lookahead_history, lookaheadKeys), 1)} tickFormatter={(value) => formatFloat(value, 2)} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => `Preview ${value}`} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="projectedMeanCandidateGap" fill="var(--color-projectedMeanCandidateGap)" radius={6} />
              <Bar dataKey="projectedMaxCandidateGap" fill="var(--color-projectedMaxCandidateGap)" radius={6} />
            </BarChart>
          </ChartContainer>
        </BenchmarkCard>
      ) : null}
    </div>
  )
}

function renderBenchmark(benchmark) {
  switch (benchmark.benchmark_id) {
    case 'representation_benchmark':
      return <RepresentationPanel benchmark={benchmark} />
    case 'mechanism_validation':
      return <MechanismValidationPanel benchmark={benchmark} />
    case 'memory_consolidation':
      return <MemoryConsolidationPanel benchmark={benchmark} />
    case 'contextual_routing':
      return <ContextualRoutingPanel benchmark={benchmark} />
    case 'hierarchical_scale':
      return <HierarchicalScalePanel benchmark={benchmark} />
    case 'knowledge_gap_seeking':
      return <AutonomyPanel benchmark={benchmark} />
    case 'source_acquisition':
      return <AcquisitionPanel benchmark={benchmark} />
    default:
      return <EmptyState title="Unsupported benchmark payload" description="This benchmark is present, but no renderer is attached to it yet." />
  }
}

export default function BenchmarkReportsSection({ error, loading, onRefresh, reports }) {
  const benchmarkEntries = reports?.benchmarks || []
  const defaultBenchmarkId = benchmarkEntries[0]?.benchmark_id || 'mechanism_validation'

  if (loading && !reports) {
    return <SectionFallback title="Loading benchmark reports" />
  }

  return (
    <section id="benchmarks" className="space-y-4">
      <SectionHeading
        title="Benchmark reports"
        description="Archived mechanism, memory, routing, and autonomy benchmarks collected behind one interface."
        badge={<Badge variant="outline">{benchmarkEntries.length} loaded</Badge>}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Source</span>
        <Badge variant="secondary">{reports?.reports_root || 'reports not loaded yet'}</Badge>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCwIcon className={loading ? 'size-4 animate-spin' : 'size-4'} />
          Refresh reports
        </Button>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Report load error</CardTitle>
            <CardDescription>The report endpoint responded with an error.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/10 p-4 text-sm leading-6 text-muted-foreground">{error}</div>
            {!benchmarkEntries.length ? <EmptyState title="No benchmark reports available" description="Fix the report path or refresh after the backend can see the report files." /> : null}
          </CardContent>
        </Card>
      ) : null}

      {!benchmarkEntries.length && !error ? (
        <EmptyState title="No benchmark reports found" description="The backend did not find report summaries under the configured reports directory." />
      ) : null}

      {benchmarkEntries.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Available benchmarks</CardTitle>
            <CardDescription>Use the benchmark tabs to compare functional slices of the system instead of numbered roadmap phases.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs key={defaultBenchmarkId} defaultValue={defaultBenchmarkId} className="space-y-4">
              <TabsList className="flex h-auto w-full flex-wrap justify-start">
                {benchmarkEntries.map((benchmark) => (
                  <TabsTrigger key={benchmark.benchmark_id} value={benchmark.benchmark_id}>{benchmark.label || benchmark.benchmark_id}</TabsTrigger>
                ))}
              </TabsList>

              {benchmarkEntries.map((benchmark) => (
                <TabsContent key={benchmark.benchmark_id} value={benchmark.benchmark_id} className="space-y-4">
                  {renderBenchmark(benchmark)}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
