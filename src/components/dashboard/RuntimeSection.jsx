import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatFloat, formatPercent } from '@/lib/dashboard-utils'
import { DetailItem, SectionHeading } from '@/components/dashboard/shared'

export default function RuntimeSection({ checkpointMetadata, columnInputWeights, memoryStore, routingIndex, runtimeScope, status, weightDistribution }) {
  const bindingConjunctionEnabled = runtimeScope.supports_binding_conjunction_memory ?? runtimeScope.supports_binding_coincidence
  const brain = status?.terminus_runtime

  return (
    <section id="runtime" className="space-y-4">
      <SectionHeading
        title="Runtime"
        description="The loaded model, checkpoint metadata, routing index, and memory store in simpler operator-friendly language."
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
            <CardDescription>Real-time training loop counters from the Terminus brain tick.</CardDescription>
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
