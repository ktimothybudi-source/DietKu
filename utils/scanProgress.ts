const TICK_MS = 350;
/** Cap simulated progress below 100% until the API finishes. */
const PROGRESS_CAP = 92;

export function createScanProgressTicker(onTick: (progress: number) => void): { stop: () => void } {
  let progress = 0;
  let stopped = false;

  onTick(0);

  const intervalId = setInterval(() => {
    if (stopped) return;
    const delta = Math.max(1, Math.round((PROGRESS_CAP - progress) * 0.12));
    progress = Math.min(PROGRESS_CAP, progress + delta);
    onTick(progress);
  }, TICK_MS);

  return {
    stop: () => {
      stopped = true;
      clearInterval(intervalId);
    },
  };
}
