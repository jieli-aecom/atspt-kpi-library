import type { KpiPoolConfig } from './types';

export const LIBRARY_SECRET_SESSION_KEY = 'atspt-kpi-library-secret';
const READ_REQUEST_TIMEOUT_MS = 20_000;
const WRITE_REQUEST_TIMEOUT_MS = 90_000;

export type RemoteConfigResult = {
  config: KpiPoolConfig;
  etag: string | null;
  warnings: string[];
  exists?: boolean;
  mergedAfterRemoteChange?: boolean;
  forced?: boolean;
};

type ErrorPayload = {
  error?: string;
  conflict?: boolean;
  diagnosticCode?: string;
  unsupportedSchemaVersion?: number;
};

export class RemoteConfigError extends Error {
  readonly status: number;
  readonly conflict: boolean;
  readonly diagnosticCode?: string;
  readonly unsupportedSchemaVersion?: number;

  constructor(status: number, payload: ErrorPayload) {
    super(payload.error || `The hosted library request failed (${status}).`);
    this.name = 'RemoteConfigError';
    this.status = status;
    this.conflict = payload.conflict === true || status === 409;
    this.diagnosticCode = payload.diagnosticCode;
    this.unsupportedSchemaVersion = payload.unsupportedSchemaVersion;
  }
}

const request = async (secret: string, init?: RequestInit): Promise<RemoteConfigResult> => {
  const controller = new AbortController();
  const requestTimeoutMs = init?.method === 'POST' || init?.method === 'PUT'
    ? WRITE_REQUEST_TIMEOUT_MS
    : READ_REQUEST_TIMEOUT_MS;
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  let response: Response;
  try {
    response = await fetch('/api/config', {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers
      }
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new RemoteConfigError(504, {
        error: 'The hosted library request timed out. Check the Vercel service or local Vercel server and try again.'
      });
    }
    throw new RemoteConfigError(0, {
      error: 'The hosted library could not be reached. Check the local Vercel server and try again.'
    });
  } finally {
    window.clearTimeout(timeout);
  }

  const payload = (await response.json().catch(() => ({}))) as RemoteConfigResult & ErrorPayload;
  if (!response.ok) {
    throw new RemoteConfigError(response.status, payload);
  }
  return payload;
};

export const loadRemoteConfig = (secret: string) => request(secret);

export const syncRemoteConfig = (
  secret: string,
  config: KpiPoolConfig,
  baseConfig: KpiPoolConfig | undefined,
  baseEtag: string | null,
  deletedKpiIds: string[],
  deletedDataSourceIds: string[],
  deletedRelationIds: string[],
  deletedLookupIds: string[]
) =>
  request(secret, {
    method: 'POST',
    body: JSON.stringify({
      config,
      baseConfig,
      baseEtag,
      deletedKpiIds,
      deletedDataSourceIds,
      deletedRelationIds,
      deletedLookupIds
    })
  });

export const forceRemoteConfig = (
  secret: string,
  config: KpiPoolConfig,
  baseEtag: string | null,
  override = false
) =>
  request(secret, {
    method: 'PUT',
    body: JSON.stringify({ config, baseEtag, override })
  });
