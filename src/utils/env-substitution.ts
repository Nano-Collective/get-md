// src/utils/env-substitution.ts

// Ported from nanotune (src/lib/env-substitution.ts) so config files across
// the Nano Collective use the same `${VAR}` / `${VAR:-default}` / `$VAR`
// syntax. Lets users keep API keys out of committed JSON.

const ENV_VAR_RE = /\$\{([A-Z_][A-Z0-9_]*)(?::-(.*?))?\}|\$([A-Z_][A-Z0-9_]*)/g;

/**
 * Expand environment variable references in a string. Stays silent on missing
 * vars so callers downstream surface a clear error when the empty value
 * eventually fails the real operation (e.g. an unauthenticated API call).
 */
function expandEnvVar(str: string): string {
  if (typeof str !== "string") return str;

  return str.replace(
    ENV_VAR_RE,
    (
      _match: string,
      bracedVarName: string | undefined,
      defaultValue: string | undefined,
      unbracedVarName: string | undefined,
    ) => {
      const varName = bracedVarName || unbracedVarName;
      if (!varName) return "";

      const envValue = process.env[varName];
      if (envValue !== undefined) return envValue;
      if (defaultValue !== undefined) return defaultValue;
      return "";
    },
  );
}

/**
 * Recursively substitute environment variable references in any
 * string-bearing value. Walks plain objects and arrays; leaves anything else
 * untouched. Returns a fresh object — does not mutate the input.
 */
export function substituteEnvVars<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return expandEnvVar(value) as T;
  if (Array.isArray(value)) {
    return value.map((item: unknown) => substituteEnvVars(item)) as T;
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = substituteEnvVars(val);
    }
    return result as T;
  }
  return value;
}
