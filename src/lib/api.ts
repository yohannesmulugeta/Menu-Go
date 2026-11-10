export async function api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "X-Menu-Request": "1", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not complete your request.");
  return data as T;
}

export const adminPath = (restaurantId: string, resource?: string, id?: string) =>
  `/api/admin/restaurants/${encodeURIComponent(restaurantId)}${resource ? `/${resource}` : ""}${id ? `/${encodeURIComponent(id)}` : ""}`;
