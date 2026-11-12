// Display wording per executor. What an executor can do comes from the
// scheduler (/api/targets executor.capabilities); this is only for labels, and
// also covers past runs, whose target_type may differ from the current executor.
import type { ExecutorCapabilities, ExecutorName, Targets } from '@/api/types'

/** What one shard attempt runs as. */
const UNITS: Record<ExecutorName, { singular: string; plural: string }> = {
  podman: { singular: 'container', plural: 'containers' },
  kubernetes: { singular: 'pod', plural: 'pods' },
}

export function executorUnit(name: string | undefined): { singular: string; plural: string } {
  return UNITS[name as ExecutorName] ?? UNITS.podman
}

/** A scheduler that predates capabilities only ran Podman. */
const LEGACY_CAPABILITIES: ExecutorCapabilities = {
  host_gateway: 'host.containers.internal',
  local_source: true,
  local_images: true,
}

export function executorCapabilities(targets: Targets): ExecutorCapabilities {
  return targets.executor.capabilities ?? LEGACY_CAPABILITIES
}
