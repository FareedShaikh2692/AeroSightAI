import Link from "next/link";
export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div><div className="font-mono text-sm text-accent">404</div><h1 className="mt-2 text-2xl font-semibold">Not found or you don&apos;t have access</h1>
        <p className="mt-2 text-sm text-ink-2">The item may not exist, or it may belong to a project you&apos;re not part of.</p>
        <Link href="/app/dashboard" className="btn btn-secondary mt-6">Back to dashboard</Link></div>
    </div>
  );
}
