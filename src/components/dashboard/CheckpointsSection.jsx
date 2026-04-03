import { ArchiveIcon, GaugeIcon, HardDriveIcon } from 'lucide-react'

import { DetailItem, HelpTip, SectionHeading } from '@/components/dashboard/shared'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatWhen } from '@/lib/dashboard-utils'

export default function CheckpointsSection({
  checkpoints,
  pendingAction,
  restoreCheckpoint,
  saveCheckpoint,
  selectedCheckpoint,
  setSelectedCheckpoint,
  status,
}) {
  return (
    <section id="checkpoints" className="space-y-4">
      <SectionHeading
        title="Checkpoints"
        description="Save the current runtime state or restore a stored snapshot without leaving the workspace."
        badge={<Badge variant="outline">{checkpoints.length} files</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Checkpoint manager</CardTitle>
          <CardDescription>Pick a snapshot, save the current state, or restore the selected file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    Active checkpoint
                    <HelpTip>Pick the checkpoint you want to restore. There is no single best file here; it depends on which saved state you want to return to. Saving makes a new file and does not overwrite the selected one.</HelpTip>
                  </div>
                  <Select value={selectedCheckpoint || undefined} onValueChange={setSelectedCheckpoint}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a checkpoint" />
                    </SelectTrigger>
                    <SelectContent>
                      {checkpoints.map((checkpoint) => (
                        <SelectItem key={checkpoint.path} value={checkpoint.path}>{checkpoint.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <Button type="button" variant="outline" onClick={saveCheckpoint} disabled={Boolean(pendingAction)}>
                    <ArchiveIcon className="size-4" />
                    Save current state
                  </Button>
                  <Button type="button" onClick={restoreCheckpoint} disabled={Boolean(pendingAction) || !selectedCheckpoint}>
                    <HardDriveIcon className="size-4" />
                    Restore selected file
                  </Button>
                </div>
              </div>

              <Alert>
                <GaugeIcon className="size-4" />
                <AlertTitle>{status?.dirty_state ? 'Runtime has unsaved changes' : 'Runtime is aligned with the selected checkpoint'}</AlertTitle>
                <AlertDescription>
                  {status?.dirty_state
                    ? 'If you want to preserve the current runtime state, save a checkpoint before restoring an older one.'
                    : 'The in-memory runtime still matches the checkpoint on disk, so restoring should not discard fresh work.'}
                </AlertDescription>
              </Alert>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <DetailItem label="Loaded now" value={status?.checkpoint_path || 'n/a'} mono help="The checkpoint the runtime is using right now. If it is different from the one you selected, restoring will switch the runtime to that other file." />
              <DetailItem label="State revision" value={status?.state_revision ?? 'n/a'} help="How many in-memory changes happened since load. Higher means more changes, not a better state." />
              <DetailItem label="Dirty state" value={<Badge variant={status?.dirty_state ? 'outline' : 'secondary'}>{status?.dirty_state ? 'yes' : 'no'}</Badge>} help="Shows whether the runtime has changed since the last save. If it says yes and you want to keep those changes, save before restoring an older checkpoint." />
              <DetailItem label="Stored traces" value={status?.trace_history_size ?? 'n/a'} help="How many recent trace records are being kept. This helps inspection, but it is not a quality score." />
            </div>
          </div>

          <ScrollArea className="h-[360px] rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkpoints.map((checkpoint) => (
                  <TableRow key={checkpoint.path} data-state={selectedCheckpoint === checkpoint.path ? 'selected' : undefined}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{checkpoint.name}</div>
                        {status?.checkpoint_path === checkpoint.path ? <Badge variant="secondary">loaded now</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatWhen(checkpoint.modified_at)}</TableCell>
                    <TableCell>{Math.round(checkpoint.size_bytes / 1024)} KB</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant={selectedCheckpoint === checkpoint.path ? 'secondary' : 'ghost'} size="sm" onClick={() => setSelectedCheckpoint(checkpoint.path)}>
                        {selectedCheckpoint === checkpoint.path ? 'Selected' : 'Use'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </section>
  )
}