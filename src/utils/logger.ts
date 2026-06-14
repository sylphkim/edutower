type LogMeta = Record<string, unknown> | unknown;

function redactSensitive(value: string): string {
  // 通用兜底：脱敏形如 sk-… 的密钥串。Express 不接触 LLM key，
  // 这里只作为日志的最后防线，与具体 provider 无关。
  return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***REDACTED***");
}

function sanitize(value: LogMeta): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitive(value.message),
      stack: value.stack ? redactSensitive(value.stack) : undefined
    };
  }

  if (typeof value === "string") {
    return redactSensitive(value);
  }

  try {
    return JSON.parse(redactSensitive(JSON.stringify(value)));
  } catch {
    return value;
  }
}

export const logger = {
  info(message: string, meta?: LogMeta): void {
    if (meta === undefined) {
      console.info(redactSensitive(message));
      return;
    }

    console.info(redactSensitive(message), sanitize(meta));
  },

  warn(message: string, meta?: LogMeta): void {
    if (meta === undefined) {
      console.warn(redactSensitive(message));
      return;
    }

    console.warn(redactSensitive(message), sanitize(meta));
  },

  error(message: string, meta?: LogMeta): void {
    if (meta === undefined) {
      console.error(redactSensitive(message));
      return;
    }

    console.error(redactSensitive(message), sanitize(meta));
  }
};
