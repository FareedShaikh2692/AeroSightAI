import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";
export const metadata: Metadata = { title: "Contact" };

export default function Contact() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Contact sales</h1>
      <p className="mt-3 text-ink-2">Tell us about your sites. We usually respond within one business day.</p>
      <ContactForm />
    </div>
  );
}
