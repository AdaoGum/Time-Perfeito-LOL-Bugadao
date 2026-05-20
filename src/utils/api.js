import { useUgaStore } from '../store/ugaStore'
import { WORKER_URL, normalizeWorkerError } from './helpers'

export async function workerRequest(action, payload) {
  const store = useUgaStore()
  const cost = action === 'profile_overview' ? 24 : action === 'masteries' ? 2 : 1
  store.recordTelemetry(cost)

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })

  if (!response.ok) {
    throw new Error(normalizeWorkerError(response.status))
  }

  return response.json()
}
