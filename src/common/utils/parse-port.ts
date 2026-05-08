/**
 * Parses a port value from an environment variable.
 * Accepts a number or a string representing a valid TCP port (1-65535).
 * Throws if the value is missing or invalid.
 */
export function parsePort(value: string | number | undefined, name = "PORT"): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port for ${name}: "${value}". Must be an integer between 1 and 65535.`);
  }
  return port;
}
