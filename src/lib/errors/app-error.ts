import type { ErrorCode } from "./error-codes";

export interface AppErrorParams {
  [key: string]: string | number;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly params?: AppErrorParams;
  public readonly statusCode: number;

  constructor(
    code: ErrorCode,
    params?: AppErrorParams,
    statusCode: number = 400
  ) {
    super(code); // Use code as message for logging
    this.name = "AppError";
    this.code = code;
    this.params = params;
    this.statusCode = statusCode;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      code: this.code,
      params: this.params,
    };
  }
}
