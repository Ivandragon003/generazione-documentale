export const parsePort = (value: string, varName = "DB_PORT"): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(
      `Invalid ${varName}: must be an integer between 1 and 65535`,
    );
  }
  return parsed;
};
