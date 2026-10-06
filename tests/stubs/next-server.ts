export function after(fn: () => unknown) { Promise.resolve().then(fn).catch(() => {}); }
export const NextResponse = { json: (b: unknown, i?: ResponseInit) => new Response(JSON.stringify(b), i), next: () => new Response(null) };
