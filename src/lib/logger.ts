import * as Sentry from "@sentry/nextjs";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SERVICE = "iris";

function serialize(level: Level, message: string, fields?: Fields, err?: unknown) {
  const base: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    msg: message,
    ...(fields ?? {}),
  };
  if (err) {
    base.error = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err);
  }
  return JSON.stringify(base);
}

function emit(level: Level, message: string, fields?: Fields, err?: unknown) {
  const line = serialize(level, message, fields, err);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug(message: string, fields?: Fields) {
    if (process.env.NODE_ENV === "production") return;
    emit("debug", message, fields);
  },
  info(message: string, fields?: Fields) {
    emit("info", message, fields);
    Sentry.addBreadcrumb({ category: "log", level: "info", message, data: fields });
  },
  warn(message: string, fields?: Fields) {
    emit("warn", message, fields);
    Sentry.addBreadcrumb({ category: "log", level: "warning", message, data: fields });
  },
  error(message: string, err?: unknown, fields?: Fields) {
    emit("error", message, fields, err);
    Sentry.withScope((scope) => {
      if (fields) scope.setContext("fields", fields);
      if (err instanceof Error) Sentry.captureException(err);
      else Sentry.captureMessage(`${message}${err ? `: ${String(err)}` : ""}`, "error");
    });
  },
};
