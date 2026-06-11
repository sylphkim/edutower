// Daily task sheets pin every study day to a single product timezone.
// Asia/Shanghai has no daylight saving time, so the +08:00 offset is constant
// and date math can rely on the fixed offset instead of a timezone library.
export const STUDY_TIMEZONE = "Asia/Shanghai";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T00:00:00+08:00`).getTime());
}

/** Returns the current calendar date in the study timezone as "YYYY-MM-DD". */
export function getLocalDate(now: Date = new Date()): string {
  return localDateFormatter.format(now);
}

/** Returns the UTC instant when the given local date starts (00:00 +08:00). */
export function getLocalDayStart(localDate: string): Date {
  return new Date(`${localDate}T00:00:00+08:00`);
}

/** Returns the UTC instant when the given local date ends (next day 00:00 +08:00). */
export function getLocalDayEnd(localDate: string): Date {
  const start = getLocalDayStart(localDate);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
