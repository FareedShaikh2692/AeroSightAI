export async function cookies() { return { get: (_: string) => undefined as { value: string } | undefined, set: () => {}, delete: () => {} }; }
export async function headers() { return new Map<string, string>(); }
