// Orval-generated clients call this adapter so auth and correlation behavior stay centralized.
export async function orvalRequest<T>(config: RequestInit & { url: string }): Promise<T> {
  const response = await fetch(config.url, config);
  if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
  return response.json() as Promise<T>;
}
