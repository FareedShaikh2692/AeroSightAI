export function redirect(u: string): never { throw new Error(`redirect:${u}`); }
export function notFound(): never { throw new Error("notFound"); }
