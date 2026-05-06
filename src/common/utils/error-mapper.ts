import type { HttpErrorLike } from "../utils/errors";

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Errore interno";
};

export const getErrorStatus = (error: unknown): number => {
  const typedError = error as HttpErrorLike;
  if (typedError?.status && Number.isInteger(typedError.status)) {
    return typedError.status;
  }
  return 500;
};
