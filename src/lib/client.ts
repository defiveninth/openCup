export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  }).catch(() => {
    throw new Error("Network error. Check your connection and try again.");
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Request failed. Please try again.");
  return data;
}
