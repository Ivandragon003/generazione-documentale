import type { Request } from "express";
import { validate as isUuid } from "uuid";
import { makeError } from "./errors";

interface PaginationInput {
  limit?: string | number;
  offset?: string | number;
}

interface PaginationOptions {
  limit: number;
  offset: number;
}

export const assertUuid = (value: string, field = "id"): void => {
  if (!isUuid(value)) {
    throw makeError(`${field} non valido: deve essere un UUID`, 400);
  }
};

export const getActor = (req: Request): string => {
  const actorHeader = req.headers?.["x-user"];
  if (typeof actorHeader === "string" && actorHeader.trim().length > 0) {
    return actorHeader;
  }
  return "system";
};

export const parsePagination = (
  query: PaginationInput,
  defaults: PaginationOptions = { limit: 20, offset: 0 },
): PaginationOptions => {
  const limit =
    query.limit === undefined
      ? defaults.limit
      : Number.parseInt(String(query.limit), 10);
  const offset =
    query.offset === undefined
      ? defaults.offset
      : Number.parseInt(String(query.offset), 10);

  if (!Number.isInteger(limit) || limit <= 0) {
    throw makeError("limit non valido", 400);
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw makeError("offset non valido", 400);
  }

  return { limit, offset };
};
