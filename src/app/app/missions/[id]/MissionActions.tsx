"use client";
import { useActionState, useState } from "react";
import { missionTransitionAction, type ActionState } from "../../actions";
import { FormError } from "@/components/ui";

const LABELS: Record<string, { label: string; cls: string; needsReason?: boolean; confirm?: boolean }> = {
  plan: { label: "Mark planned", cls: "btn-secondary" }, submit: { label: "Submit for approval", cls: "btn-primary" },
  approve: { label: "Approve", cls: "btn-primary" }, reject: { label: "Reject", cls: "btn-danger", needsReason: true },
  markReady: { label: "Mark ready", cls: "btn-primary" }, start: { label: "Start mission", cls: "btn-primary", confirm: true },
  pause: { label: "Pause (hover)", cls: "btn-secondary" }, resume: { label: "Resume", cls: "btn-primary" },
  rth: { label: "Return to home", cls: "btn-danger" },
  stop: { label: "Complete", cls: "btn-primary" }, abort: { label: "Abort", cls: "btn-danger", needsReason: true },
  cancel: { label: "Cancel mission", cls: "btn-ghost" }, revise: { label: "Revise", cls: "btn-secondary" },
};

const FLIGHT_COMMANDS = ["pause", "resume", "rth", "abort"];

export function MissionActions({ id, actions, checklistDone, channel }: { id: string; actions: { action: string; allowed: boolean; why?: string }[]; checklistDone: boolean; channel?: { mode: "provider" | "logical"; reason: string } }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(missionTransitionAction, {});
  const [open, setOpen] = useState<string | null>(null);
  if (!actions.length) return <p className="text-sm text-ink-2">No further actions for this mission.</p>;
  const cfg = open ? LABELS[open] : null;
  const isCommand = !!open && FLIGHT_COMMANDS.includes(open) && channel?.mode === "provider";
  return (
    <div className="space-y-3">
      <FormError error={state.error} />
      {channel && (
        <p className={`rounded-md px-3 py-2 text-xs ${channel.mode === "provider" ? "bg-ok/10 text-ok" : "bg-white/5 text-ink-2"}`}>
          <strong>{channel.mode === "provider" ? "Drone commands: live" : "Drone commands: record only"}</strong> — {channel.reason}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map(({ action, allowed, why }) => (
          <button key={action} type="button" className={`btn ${LABELS[action]?.cls ?? "btn-secondary"}`} disabled={!allowed || pending}
            title={allowed ? undefined : why} aria-disabled={!allowed}
            onClick={() => setOpen(action)}>{LABELS[action]?.label ?? action}</button>
        ))}
      </div>
      {open && cfg && (
        <form action={(f) => { formAction(f); setOpen(null); }} className="rounded-lg border border-line bg-raised p-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value={open} />
          <div className="mb-3 text-sm font-semibold">{cfg.label}?</div>
          {cfg.needsReason && <div className="mb-3"><label className="label" htmlFor="reason">Reason (required)</label><textarea id="reason" name="reason" required rows={2} className="input" /></div>}
          {cfg.confirm && (
            <>
              {!checklistDone && <p className="mb-2 text-sm text-warn">Complete the pre-flight checklist first.</p>}
              <label className="mb-2 flex gap-2 text-sm"><input type="checkbox" name="confirm" required /> I confirm I am the licensed pilot in command and will fly this mission in the drone&apos;s own flight app.</label>
              <p className="mb-3 text-xs text-ink-3">AeroSight records the flight and tracks telemetry. It does not send flight commands to the aircraft.</p>
            </>
          )}
          {isCommand && (
            <>
              <label className="mb-2 flex gap-2 text-sm"><input type="checkbox" name="confirm" required /> I am the pilot in command and the airspace is clear for this command.</label>
              <p className="mb-3 text-xs text-ink-3">This sends a {open === "abort" ? "RETURN_TO_HOME" : open.toUpperCase()} command to the aircraft. It is logged in the mission events and audit trail.</p>
            </>
          )}
          <div className="flex gap-2"><button className={`btn ${cfg.cls}`} disabled={pending}>Confirm</button><button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
