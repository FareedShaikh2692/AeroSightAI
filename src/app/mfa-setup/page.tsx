import { redirect } from "next/navigation";
import { getContext } from "@/lib/auth";
import { db } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { MfaSetup } from "../app/settings/SettingsForms";

export const dynamic = "force-dynamic";

// AUTH-011: members of organizations that enforce 2FA must enroll before using the app.
export default async function MfaSetupPage() {
  const ctx = await getContext();
  if (!ctx || ctx.isPlatformStaff) redirect("/login");
  const user = db().users.find((u) => u.id === ctx.userId)!;
  if (user.mfaSecret) redirect("/app/dashboard");
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold">Set up two-factor authentication</h1>
      <p className="mt-2 text-sm text-ink-2">Your organization requires two-factor authentication. Set it up to continue. When you&apos;re done, <a className="text-accent" href="/app/dashboard">go to your dashboard</a>.</p>
      <div className="card mt-6 p-6"><MfaSetup enabled={false} enforced remainingCodes={0} /></div>
    </div>
  );
}
