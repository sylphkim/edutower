import { logger } from "../utils/logger";
import { dailySummariesService } from "./dailySummaries.service";

const SWEEP_INTERVAL_MS = 60 * 1000;

let sweeping = false;

/**
 * Settles every daily sheet whose closesAt (local midnight) has passed:
 * generates the summary, lets the system decide pending suggestions and marks
 * the sheet forced_closed. Also invoked lazily from the daily task service, so
 * the sweeper is a safety net rather than the only trigger.
 */
export async function sweepExpiredDailySheets(now: Date = new Date()): Promise<number> {
  if (sweeping) {
    return 0;
  }

  sweeping = true;

  try {
    return await dailySummariesService.forceCloseExpiredSheets(now);
  } finally {
    sweeping = false;
  }
}

export function startDailySheetSweeper(): NodeJS.Timeout {
  const timer = setInterval(() => {
    sweepExpiredDailySheets().catch((error) => {
      logger.error("Daily sheet sweeper run failed.", error);
    });
  }, SWEEP_INTERVAL_MS);

  // Never keep the process alive just for the sweeper.
  timer.unref();
  logger.info("Daily sheet sweeper started (interval: 60s).");

  return timer;
}
