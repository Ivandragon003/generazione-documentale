import { readFileSync, unlinkSync } from "node:fs";
import type { Request } from "express";
import { validate as isUuid } from "uuid";
import { makeError } from "./errors";

export interface PaginationInput {
  limit?: string | number;
  offset?: string | number;
}

export interface UploadedFileInput {
  path: string;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export const assertUuid = (value: string, field = "id"): void => {
  if (!isUuid(value)) {
    throw makeError(`${field} non valido: deve essere un UUID`, 400);
  }
};

export const getActor = (req: Request): string => {
  const actorHeader = req.headers["x-user"];
  if (typeof actorHeader === "string" && actorHeader.trim().length > 0) {
    return actorHeader;
  }
  return "system";
};

export const readAndCleanupUpload = (file: UploadedFileInput): string => {
  let content = "";
  try {
    content = readFileSync(file.path, "utf8");
  } finally {
    try {
      unlinkSync(file.path);
    } catch {
      // Best-effort cleanup.
    }
  }
  return content;
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

export const parseVersionOrThrow = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!/^\d+$/.test(value) || parsed <= 0) {
    throw makeError("version non valida", 400);
  }
  return parsed;
};
