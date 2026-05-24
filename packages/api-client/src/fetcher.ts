export async function salonaiFetch<TResponse>(
  url: string,
  options?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(buildUrl(url), options);

  const body = [204, 205, 304].includes(response.status) ? null : await response.text();
  const data = body ? JSON.parse(body) : undefined;

  if (!response.ok) {
    throw new Error(readErrorMessage(data, response.status));
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as TResponse;
}

function buildUrl(path: string): string {
  const url = new URL(`/api${path}`, globalThis.location?.origin ?? 'http://localhost');

  return url.pathname + url.search;
}

function readErrorMessage(data: unknown, status: number): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return data.message;
  }

  return `SalonAI API request failed with ${status}`;
}
