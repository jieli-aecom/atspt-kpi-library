import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { BlobPreconditionFailedError, get, put } from '@vercel/blob';
import {
  createBlankConfig,
  prepareForExport,
  repairConfig,
  UnsupportedSchemaVersionError
} from '../src/configSchema.js';
import { applyConfigDeletions, mergeCurrentAdditiveConfig, mergeImportedConfig } from '../src/configMerge.js';
import type { KpiPoolConfig } from '../src/types.js';

const CONFIG_PATH = 'kpi-library.json';
const MAX_CONFIG_BYTES = 5 * 1024 * 1024;
const MAX_WRITE_ATTEMPTS = 3;

type StoredConfig = {
  config: KpiPoolConfig;
  etag: string | null;
  exists: boolean;
  warnings: string[];
};

type WriteRequest = {
  config?: unknown;
  baseEtag?: unknown;
  override?: unknown;
  deletedKpiIds?: unknown;
  deletedDataSourceIds?: unknown;
};

// Private Blob downloads expose the object ETag as a weak HTTP validator
// (W/"..."). Blob conditional writes require the corresponding strong value.
// Keeping this normalization at the read boundary also ensures the browser's
// baseEtag can be passed back unchanged on a later save.
const normalizeBlobEtag = (etag: string) => etag.startsWith('W/') ? etag.slice(2) : etag;

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });

const suppliedSecret = (request: Request) => {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const secretsMatch = (left: string, right: string) => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

const authorize = (request: Request) => {
  const expected = process.env.KPI_LIBRARY_SECRET;
  if (!expected) {
    return jsonResponse({ error: 'KPI_LIBRARY_SECRET is not configured for this environment.' }, 503);
  }

  if (!secretsMatch(suppliedSecret(request), expected)) {
    return jsonResponse({ error: 'Library access is required.' }, 401, { 'WWW-Authenticate': 'Bearer' });
  }

  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    return jsonResponse({ error: 'No Vercel Blob store is connected to this environment.' }, 503);
  }

  return null;
};

const readStoredConfig = async (): Promise<StoredConfig> => {
  const result = await get(CONFIG_PATH, {
    access: 'private',
    useCache: false
  });
  if (!result) {
    return {
      config: createBlankConfig(),
      etag: null,
      exists: false,
      warnings: []
    };
  }

  if (result.statusCode !== 200 || !result.stream) {
    throw new Error('The KPI library Blob could not be read.');
  }

  const rawText = await new Response(result.stream).text();
  if (Buffer.byteLength(rawText, 'utf8') > MAX_CONFIG_BYTES) {
    throw new Error('The stored KPI library exceeds the supported 5 MB limit.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('The stored KPI library is not valid JSON.');
  }

  const repaired = repairConfig(parsed);
  return {
    config: repaired.config,
    etag: normalizeBlobEtag(result.blob.etag),
    exists: true,
    warnings: repaired.warnings
  };
};

const readWriteRequest = async (request: Request) => {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONFIG_BYTES) {
    throw new Response(JSON.stringify({ error: 'The KPI library request exceeds the supported 5 MB limit.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: WriteRequest;
  try {
    body = (await request.json()) as WriteRequest;
  } catch {
    throw new Response(JSON.stringify({ error: 'The request body must be valid JSON.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!body || typeof body !== 'object' || !body.config || typeof body.config !== 'object') {
    throw new Response(JSON.stringify({ error: 'A KPI library configuration is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (
    body.deletedKpiIds !== undefined &&
    (!Array.isArray(body.deletedKpiIds) || body.deletedKpiIds.some((id) => typeof id !== 'string' || !id.trim()))
  ) {
    throw new Response(JSON.stringify({ error: 'Deleted KPI IDs must be non-empty strings.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (
    body.deletedDataSourceIds !== undefined &&
    (!Array.isArray(body.deletedDataSourceIds) || body.deletedDataSourceIds.some((id) => typeof id !== 'string' || !id.trim()))
  ) {
    throw new Response(JSON.stringify({ error: 'Deleted data-source IDs must be non-empty strings.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const repaired = repairConfig(body.config);
  const serialized = JSON.stringify(repaired.config);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_BYTES) {
    throw new Response(JSON.stringify({ error: 'The KPI library exceeds the supported 5 MB limit.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return {
    config: repaired.config,
    warnings: repaired.warnings,
    baseEtag: typeof body.baseEtag === 'string' ? body.baseEtag : null,
    override: body.override === true,
    deletedKpiIds: [...new Set((body.deletedKpiIds as string[] | undefined) ?? [])],
    deletedDataSourceIds: [...new Set((body.deletedDataSourceIds as string[] | undefined) ?? [])]
  };
};

const writeConfig = async (config: KpiPoolConfig, etag: string | null) => {
  const output = prepareForExport(config);
  const blob = await put(CONFIG_PATH, JSON.stringify(output, null, 2), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 60,
    allowOverwrite: etag !== null,
    ...(etag ? { ifMatch: etag } : {})
  });
  return { config: output, etag: blob.etag };
};

const normalSync = async (request: Request) => {
  const incoming = await readWriteRequest(request);

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const stored = await readStoredConfig();
    const basedOnCurrent = incoming.baseEtag === stored.etag;
    const mergeResult = basedOnCurrent ? null : mergeImportedConfig(stored.config, incoming.config);
    const additiveConfig = basedOnCurrent
      ? mergeCurrentAdditiveConfig(stored.config, incoming.config)
      : mergeResult!.config;
    // Explicit tombstones make this editor's own deletions win without treating
    // every hosted record that is absent locally as a deletion.
    const mergedConfig = applyConfigDeletions(additiveConfig, {
      kpiIds: incoming.deletedKpiIds,
      dataSourceIds: incoming.deletedDataSourceIds
    });

    try {
      const written = await writeConfig(mergedConfig, stored.etag);
      const conflictWarnings = mergeResult
        ? [
            ...(mergeResult.enumConflicts
              ? [`${mergeResult.enumConflicts} enum definition conflict${mergeResult.enumConflicts === 1 ? '' : 's'} kept the hosted value.`]
              : []),
            ...(mergeResult.dataSourceConflicts
              ? [`${mergeResult.dataSourceConflicts} data-source conflict${mergeResult.dataSourceConflicts === 1 ? '' : 's'} kept the hosted value.`]
              : []),
            ...(mergeResult.lookupConflicts
              ? [`${mergeResult.lookupConflicts} lookup conflict${mergeResult.lookupConflicts === 1 ? '' : 's'} kept the hosted value.`]
              : []),
            ...(mergeResult.variableConflicts
              ? [`${mergeResult.variableConflicts} variable conflict${mergeResult.variableConflicts === 1 ? '' : 's'} kept the hosted value.`]
              : [])
          ]
        : [];

      return jsonResponse({
        ...written,
        warnings: [...stored.warnings, ...incoming.warnings, ...conflictWarnings],
        mergedAfterRemoteChange: !basedOnCurrent
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) {
        continue;
      }

      // A first writer can create the Blob between our read and create attempt.
      if (!stored.exists && (await readStoredConfig()).exists) {
        continue;
      }
      throw error;
    }
  }

  return jsonResponse({ error: 'The library changed repeatedly while saving. Refresh and try again.' }, 409);
};

const forceReplace = async (request: Request) => {
  const incoming = await readWriteRequest(request);

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const stored = await readStoredConfig();
    if (stored.exists && !incoming.override && incoming.baseEtag !== stored.etag) {
      return jsonResponse(
        {
          error: 'The hosted library changed after this page loaded.',
          conflict: true,
          etag: stored.etag,
          updatedAt: stored.config.updatedAt
        },
        409
      );
    }

    try {
      const written = await writeConfig(incoming.config, stored.etag);
      return jsonResponse({
        ...written,
        warnings: [...stored.warnings, ...incoming.warnings],
        forced: true
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError || (!stored.exists && (await readStoredConfig()).exists)) {
        if (incoming.override) {
          continue;
        }
        return jsonResponse({ error: 'The hosted library changed while it was being replaced.', conflict: true }, 409);
      }
      throw error;
    }
  }

  return jsonResponse({ error: 'The library changed repeatedly while being replaced. Try again.' }, 409);
};

const handleWebRequest = async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { Allow: 'GET, POST, PUT, OPTIONS' } });
  }

  const authorizationFailure = authorize(request);
  if (authorizationFailure) {
    return authorizationFailure;
  }

  try {
    if (request.method === 'GET') {
      const stored = await readStoredConfig();
      return jsonResponse(stored);
    }
    if (request.method === 'POST') {
      return await normalSync(request);
    }
    if (request.method === 'PUT') {
      return await forceReplace(request);
    }

    return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PUT, OPTIONS' });
  } catch (error) {
    if (error instanceof Response) {
      return new Response(error.body, {
        status: error.status,
        headers: {
          'Content-Type': error.headers.get('Content-Type') ?? 'application/json',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }

    if (error instanceof UnsupportedSchemaVersionError) {
      return jsonResponse({ error: error.message, unsupportedSchemaVersion: error.schemaVersion }, 422);
    }

    console.error('KPI library request failed.', error);
    return jsonResponse(
      {
        error: 'The hosted Blob could not be accessed. Verify the Blob connection for this deployment.',
        diagnosticCode: 'BLOB_ACCESS_FAILED'
      },
      500
    );
  }
};

type VercelNodeRequest = IncomingMessage & { body?: unknown };

const webRequestFromNodeRequest = (request: VercelNodeRequest) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(name, entry));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const method = request.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' || request.body === undefined
    ? undefined
    : typeof request.body === 'string'
      ? request.body
      : request.body instanceof Uint8Array
        ? Buffer.from(request.body).toString('utf8')
      : JSON.stringify(request.body);
  const origin = `https://${headers.get('host') ?? 'localhost'}`;

  return new Request(new URL(request.url ?? '/api/config', origin), {
    method,
    headers,
    body
  });
};

const sendWebResponse = async (webResponse: Response, response: ServerResponse) => {
  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(Buffer.from(await webResponse.arrayBuffer()));
};

// Vite projects use Vercel's Node request/response function signature. The
// adapter keeps the application logic on standard Web Request/Response APIs.
export default async function handler(request: VercelNodeRequest, response: ServerResponse) {
  await sendWebResponse(await handleWebRequest(webRequestFromNodeRequest(request)), response);
}
