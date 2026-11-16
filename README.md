# docling-ui

Web UI for [docling-scheduler](https://github.com/mcaimi/docling-scheduler): design [docling-agent](https://github.com/mcaimi/docling-agent) runs, validate them, launch them, and follow their progress.

- **New run**: a step-by-step wizard generated from the scheduler's `/api/settings/schema` (the agent's settings contract), one step per settings group, with defaults from the scheduler's `.env`. Every step but Source can be skipped (keeping the defaults), and a final summary reviews the job before launch. Secrets are only shown as set/unset and can be left empty to keep the `.env` value. Pre-flight shows errors on the fields, warnings, the shard plan and a redacted launch preview. Launch is enabled once validation passes.
- **Run monitor**: progress, KPIs, documents completed over time, per-shard status, a per-document table with stage timings (from MLflow traces), live logs per shard (level and file filters), containers (or Kubernetes pods) with resource usage and events, and merged error reports. Cancel, retry failed shards, re-run, delete.
- **Runs**: history with a status filter and re-run.

The UI follows the scheduler's executor (`SCHEDULER_EXECUTOR`). Under **Podman**, documents come from a host folder or S3. Under **Kubernetes**, each shard runs as a Job in the scheduler's namespace, documents must come from S3, and the image must be pullable from a registry by the cluster. Pod resource usage needs metrics-server on the cluster.

## Usage

```bash
npm ci
npm run build          # outputs dist/
# serve it from the scheduler:
SCHEDULER_WEB_DIR=$PWD/dist uv run --project ../docling-scheduler python -m docling_scheduler
```

## Development

```bash
# terminal 1: a scheduler that accepts the dev server's origin
SCHEDULER_ALLOWED_ORIGINS=http://localhost:5173 uv run --project ../docling-scheduler python -m docling_scheduler
# terminal 2: Vite on :5173, proxies /api to 127.0.0.1:8765
npm run dev            # then open http://localhost:5173/#token=<scheduler token>
```

`npm test` (vitest), `npm run typecheck`, `npm run build`.
