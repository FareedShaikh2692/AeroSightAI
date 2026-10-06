"use server";
import { z } from "zod";

const Schema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().email(), company: z.string().trim().min(1).max(120), message: z.string().max(2000).optional(), website: z.string().max(0).optional() });

export async function contactAction(_: { error?: string; ok?: boolean }, form: FormData) {
  const parsed = Schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please check the form fields." };
  return { ok: true };
}
