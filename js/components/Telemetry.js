import { state } from '../state.js';

export function updateTelemetryUI() {
  const timestamps = state.telemetry.timestamps;
  const count = timestamps.length;
  const available = 100 - count;

  const countEl = document.getElementById('tel-count');
  const statusEl = document.getElementById('tel-status');
  const timeEl = document.getElementById('tel-time');

  if(countEl) countEl.innerText = `${count} / 100`;

  if(statusEl) {
    statusEl.innerText = available;
    statusEl.className = available > 25 ? 'text-green-400' : (available > 10 ? 'text-amber-400' : 'text-red-500 animate-pulse font-black');
  }

  if(timeEl) {
    if(count === 0) {
      timeEl.innerText = 'Status: Liberado';
      timeEl.className = 'mt-2 rounded bg-slate-950/50 py-1 text-center text-xs font-medium text-slate-400';
    } else {
      const oldest = timestamps[0];
      const msLeft = 120000 - (Date.now() - oldest);
      const secsLeft = Math.max(0, Math.ceil(msLeft / 1000));
      const m = Math.floor(secsLeft / 60);
      const s = secsLeft % 60;
      timeEl.innerText = `Próximo reset: ${m}:${String(s).padStart(2, '0')}`;
      timeEl.className = 'mt-2 rounded bg-blue-950/40 py-1 text-center text-xs font-medium text-blue-300 border border-blue-800/50';
    }
  }
}

export function initTelemetryInterval() {
  setInterval(() => {
    const now = Date.now();
    const twoMinsAgo = now - 120000;
    const timestamps = state.telemetry.timestamps;
    
    while(timestamps.length > 0 && timestamps[0] < twoMinsAgo) {
      timestamps.shift();
    }
    updateTelemetryUI();
  }, 1000);
}
