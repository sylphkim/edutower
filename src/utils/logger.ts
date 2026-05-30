type LogMeta = Record<string, unknown> | unknown;

function redactSensitive(value: string): string {
  let redacted = value.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***REDACTED***");

  const apiKeys = [process.env.LLM_API_KEY, process.env.OPENAI_API_KEY].filter(
    (key): key is string => Boolean(key)
  );

  for (const apiKey of apiKeys) {
    redacted = redacted.split(apiKey).join("***REDACTED_API_KEY***");
  }

  return redacted;
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
