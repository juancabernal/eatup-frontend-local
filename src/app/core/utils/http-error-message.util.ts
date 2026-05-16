import { HttpErrorResponse } from '@angular/common/http';

type BackendErrorBody = {
  message?: unknown;
  error?: unknown;
  errors?: unknown;
  detail?: unknown;
  title?: unknown;
};

export function extractHttpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.error instanceof ErrorEvent && error.error.message) {
    return error.error.message;
  }

  if (typeof error.error === 'string' && error.error.trim()) {
    return error.error.trim();
  }

  if (error.error && typeof error.error === 'object') {
    const body = error.error as BackendErrorBody;
    const messages = [
      collectMessages(body.errors),
      collectMessages(body.message),
      collectMessages(body.detail),
      collectMessages(body.error),
      collectMessages(body.title),
    ]
      .flat()
      .filter(Boolean);

    if (messages.length > 0) {
      return Array.from(new Set(messages)).join('\n');
    }
  }

  if (error.message) {
    return error.message;
  }

  return fallback;
}

function collectMessages(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    return value.trim() ? [value.trim()] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMessages(item));
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
      const nestedMessages = collectMessages(entry);
      return nestedMessages.length > 0 ? nestedMessages.map((message) => `${key}: ${message}`) : [];
    });
  }

  return [String(value)];
}
