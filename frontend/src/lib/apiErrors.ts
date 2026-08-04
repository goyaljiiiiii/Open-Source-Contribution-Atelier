export interface ApiErrorOptions {
  status?: number;
  endpoint?: string;
  requestId?: string;
  retryable?: boolean;
  authExpired?: boolean;
  details?: string | null;
}

const DEFAULT_API_ERROR_MESSAGE =
  "We couldn't complete your request. Please try again in a moment.";

export class ApiError extends Error {
  status?: number;
  endpoint?: string;
  requestId?: string;
  retryable: boolean;
  authExpired: boolean;
  details?: string | null;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.endpoint = options.endpoint;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    this.authExpired = options.authExpired ?? false;
    this.details = options.details ?? null;
  }
}

function isAuthEndpoint(endpoint?: string): boolean {
  return Boolean(endpoint && endpoint.includes("/auth/"));
}

function summarizeStatusMessage(
  status: number | undefined,
  endpoint?: string,
): string {
  switch (status) {
    case 401:
      return isAuthEndpoint(endpoint)
        ? "Sign-in failed. Please check your credentials and try again."
        : "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to access this resource.";
    case 404:
      return "We couldn't find the requested resource.";
    case 408:
      return "The request timed out. Please try again.";
    case 409:
      return "That action could not be completed because of a conflict.";
    case 413:
      return "The payload is too large for this request.";
    case 422:
      return "Please review the submitted information and try again.";
    case 429:
      return "You're making requests too quickly. Please wait a moment and try again.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "The server is having trouble right now. Please try again in a moment.";
    default:
      return DEFAULT_API_ERROR_MESSAGE;
  }
}

export function createApiError(params: {
  status?: number;
  endpoint?: string;
  requestId?: string;
  body?: unknown;
  retryable?: boolean;
  authExpired?: boolean;
}): ApiError {
  const message = summarizeStatusMessage(params.status, params.endpoint);
  return new ApiError(message, {
    status: params.status,
    endpoint: params.endpoint,
    requestId: params.requestId,
    retryable: params.retryable,
    authExpired: params.authExpired,
    details: null,
  });
}

export function getApiErrorMessage(
  error: unknown,
  fallback = DEFAULT_API_ERROR_MESSAGE,
): string {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

export function getApiErrorDetails(error: unknown): string | null {
  if (error instanceof ApiError) {
    const details: string[] = [];

    if (error.status) {
      details.push(`Status: ${error.status}`);
    }
    if (error.endpoint) {
      details.push(`Endpoint: ${error.endpoint}`);
    }
    if (error.requestId) {
      details.push(`Request ID: ${error.requestId}`);
    }
    if (error.authExpired) {
      details.push("Auth session expired: yes");
    }
    if (error.retryable) {
      details.push("Retryable: yes");
    }

    if (error.details) {
      details.push(error.details);
    }

    return details.length > 0 ? details.join("\n") : null;
  }

  if (error instanceof Error) {
    return error.stack || error.message || null;
  }

  if (typeof error === "string") {
    return error;
  }

  return null;
}

export function isRetryableApiError(error: unknown): boolean {
  return error instanceof ApiError && error.retryable;
}

export function isAuthExpiredApiError(error: unknown): boolean {
  return error instanceof ApiError && error.authExpired;
}