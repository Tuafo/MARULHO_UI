import { memo } from 'react'
import { ActivityIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import NeuralFlowDiagram from './NeuralFlowDiagram'

export default memo(function AnimationSection({ animationData, telemetry }) {
  const hasData = animationData && animationData.n_columns > 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <ActivityIcon className="h-5 w-5" />
          Neural Architecture Flow
          {hasData && (
            <Badge variant="outline" className="text-xs">
              {animationData.n_columns} columns
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Live data flow from RTF encoding through competitive columns, memory consolidation, and HNSW routing.
          Cross-modal visual and audio channels shown when active.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        {hasData ? (
          <NeuralFlowDiagram animationData={animationData} telemetry={telemetry} />
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Waiting for live telemetry data…
          </div>
        )}
      </CardContent>
    </Card>
  )
}, (prev, next) => {
  if (prev.animationData !== next.animationData) return false
  if (prev.telemetry?.dopamine !== next.telemetry?.dopamine) return false
  if (prev.telemetry?.serotonin !== next.telemetry?.serotonin) return false
  if (prev.telemetry?.acetylcholine !== next.telemetry?.acetylcholine) return false
  if (prev.telemetry?.norepinephrine !== next.telemetry?.norepinephrine) return false
  return true
})
