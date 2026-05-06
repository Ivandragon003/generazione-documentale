export interface HttpErrorLike extends Error {
  status?: number;
}

export class AppError extends Error implements HttpErrorLike {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const makeError = (message: string, status = 400): AppError => {
  return new AppError(message, status);
};
