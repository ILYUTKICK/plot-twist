type GuestAuthResponse = { token?: string };

const API_ORIGIN = process.env.TXLINE_API_ORIGIN ?? "https://txline-dev.txodds.com";

let guestJwt: string | null = null;

function getApiToken(): string {
  const token = process.env.TXLINE_API_TOKEN;
  if (!token) throw new Error("TXLINE_API_TOKEN is not configured");
  return token;
}

async function renewGuestJwt(signal?: AbortSignal | null): Promise<string> {
  const response = await fetch(`${API_ORIGIN}/auth/guest/start`, {
    method: "POST",
    cache: "no-store",
    signal: signal ?? undefined,
  });

  if (!response.ok) throw new Error(`TxLINE guest auth failed (${response.status})`);
  const data = (await response.json()) as GuestAuthResponse;
  if (!data.token) throw new Error("TxLINE guest auth returned no token");
  guestJwt = data.token;
  return data.token;
}

async function authenticatedFetch(path: string, init: RequestInit, retry: boolean): Promise<Response> {
  const jwt = guestJwt ?? await renewGuestJwt(init.signal);
  const response = await fetch(`${API_ORIGIN}/api${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...init.headers,
      Authorization: `Bearer ${jwt}`,
      "X-Api-Token": getApiToken(),
    },
  });

  if (retry && (response.status === 401 || response.status === 403)) {
    guestJwt = null;
    await renewGuestJwt(init.signal);
    return authenticatedFetch(path, init, false);
  }

  return response;
}

export function txlineFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return authenticatedFetch(path, init, true);
}
