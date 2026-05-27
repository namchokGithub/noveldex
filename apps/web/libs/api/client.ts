type QueryParamValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryParamValue>;

interface RequestOptions extends Omit<RequestInit, "body"> {
  query?: QueryParams;
  body?: unknown;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function buildUrl(path: string, query?: QueryParams) {
  const url = new URL(path, API_BASE_URL);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function parseResponseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

function buildRequestBody(body: RequestOptions["body"]) {
  if (body == null) {
    return undefined;
  }

  if (
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    typeof body === "string" ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }

  return JSON.stringify(body);
}

function buildHeaders(
  body: RequestOptions["body"],
  headers?: HeadersInit,
): HeadersInit | undefined {
  const nextHeaders = new Headers(headers);

  if (
    body != null &&
    !(body instanceof FormData) &&
    !nextHeaders.has("Content-Type")
  ) {
    nextHeaders.set("Content-Type", "application/json");
  }

  return nextHeaders;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await fetch(buildUrl(path, options?.query), {
    ...options,
    headers: buildHeaders(options?.body, options?.headers),
    body: buildRequestBody(options?.body),
  });

  const body = await parseResponseBody<unknown>(response);

  if (!response.ok) {
    const b = body as Record<string, unknown>;
    const message =
      typeof body === "object" && body !== null
        ? String(b.error ?? b.message ?? "Request failed.")
        : "Request failed.";

    throw new Error(message);
  }

  return body as T;
}

async function mock<T>(data: T, delay = 250): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, delay));
  return data;
}

export const apiClient = {
  get: <T>(path: string, query?: QueryParams) =>
    request<T>(path, {
      method: "GET",
      query,
    }),

  post: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "POST",
    }),

  put: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "PUT",
    }),

  patch: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "PATCH",
    }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "DELETE",
    }),

  mock,
};
