"use client";
import { useActionState, useMemo, useState } from "react";
import { FormError } from "@/components/ui";
import { saveRuleAction, testRuleAction, type AutoState } from "./actions";

type Opt = { value: string; label: string };
export interface BuilderMeta {
  triggers: { key: string; label: string; fields: string[] }[];
  actions: { type: string; label: string; params: string[]; appliesTo?: string[] }[];
  roles: Opt[]; channels: Opt[]; webhooks: Opt[]; templates: Opt[];
}
const OPS: Opt[] = [{ value: "eq", label: "is" }, { value: "neq", label: "is not" }, { value: "in", label: "is one of" }, { value: "gte", label: "≥" }, { value: "lte", label: "≤" }, { value: "contains", label: "contains" }];
const VALUE_HINTS: Record<string, string[]> = {
  "finding.severity": ["critical", "high", "medium", "low"], severity: ["critical", "warning", "info"], "finding.category": ["structural", "safety", "quality"],
  "mission.type": ["survey", "inspection", "progress", "video", "custom"], "mission.scheduled": ["true", "false"], "risk.band": ["high", "critical"],
};

export function RuleBuilder({ meta }: { meta: BuilderMeta }) {
  const [s, action, pending] = useActionState<AutoState, FormData>(saveRuleAction, {});
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState(meta.triggers[0].key);
  const [conds, setConds] = useState<{ field: string; op: string; value: string }[]>([]);
  const [acts, setActs] = useState<{ type: string; params: Record<string, string> }[]>([{ type: "notify_roles", params: { roles: "project_manager", message: "{title}: {body}" } }]);
  const t = meta.triggers.find((x) => x.key === trigger)!;
  const entity = trigger.split(".")[0];
  const allowed = meta.actions.filter((a) => !a.appliesTo || a.appliesTo.includes(entity));
  const json = useMemo(() => JSON.stringify({ name, trigger, enabled: true, conditions: conds, actions: acts }), [name, trigger, conds, acts]);
  const paramInput = (ai: number, p: string) => {
    const v = acts[ai].params[p] ?? "";
    const set = (val: string) => setActs(acts.map((a, i) => (i === ai ? { ...a, params: { ...a.params, [p]: val } } : a)));
    const sel = (opts: Opt[], multi = false) => multi
      ? <div className="flex flex-wrap gap-2">{opts.map((o) => { const on = v.split(",").includes(o.value); return <label key={o.value} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={on} onChange={() => set((on ? v.split(",").filter((x) => x !== o.value) : [...v.split(",").filter(Boolean), o.value]).join(","))} />{o.label}</label>; })}</div>
      : <select className="input" value={v} onChange={(e) => set(e.target.value)} aria-label={p}><option value="">Choose…</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    if (p === "roles") return sel(meta.roles, true);
    if (p === "role") return sel(meta.roles);
    if (p === "channelId") return meta.channels.length ? sel(meta.channels) : <p className="text-xs text-warn">Connect a Slack/Teams channel under Integrations first.</p>;
    if (p === "webhookId") return meta.webhooks.length ? sel(meta.webhooks) : <p className="text-xs text-warn">Add a webhook under Integrations first.</p>;
    if (p === "templateId") return sel([{ value: "", label: "Default template" }, ...meta.templates]);
    return <input className="input" value={v} onChange={(e) => set(e.target.value)} placeholder={p === "message" ? "{title}: {body}" : p === "days" || p === "dueDays" ? "days" : p} aria-label={p} />;
  };
  return (
    <form action={action} className="space-y-4">
      <FormError error={s.error} />{s.ok && <p className="text-sm text-ok">{s.ok}</p>}
      <input type="hidden" name="rule" value={json} />
      <div><label className="label" htmlFor="rule-name">Rule name</label><input id="rule-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="e.g. Escalate safety findings" /></div>
      <div><label className="label" htmlFor="rule-trigger">When</label>
        <select id="rule-trigger" className="input" value={trigger} onChange={(e) => { setTrigger(e.target.value); setConds([]); setActs(acts.filter((a) => { const m = meta.actions.find((x) => x.type === a.type); return !m?.appliesTo || m.appliesTo.includes(e.target.value.split(".")[0]); })); }}>
          {meta.triggers.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></div>
      <div>
        <div className="label">Only if (all match)</div>
        <div className="space-y-2">{conds.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_1fr_auto] gap-2">
            <select className="input" value={c.field} onChange={(e) => setConds(conds.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} aria-label="Field">{t.fields.map((f) => <option key={f} value={f}>{f}</option>)}</select>
            <select className="input" value={c.op} onChange={(e) => setConds(conds.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))} aria-label="Operator">{OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <input className="input" list={`hints-${i}`} value={c.value} onChange={(e) => setConds(conds.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} aria-label="Value" />
            <datalist id={`hints-${i}`}>{(VALUE_HINTS[c.field] ?? []).map((h) => <option key={h} value={h} />)}</datalist>
            <button type="button" className="btn btn-ghost" onClick={() => setConds(conds.filter((_, j) => j !== i))} aria-label="Remove condition">✕</button>
          </div>
        ))}</div>
        {conds.length < 5 && <button type="button" className="btn btn-ghost mt-2 h-8 text-xs" onClick={() => setConds([...conds, { field: t.fields[0], op: "eq", value: "" }])}>+ Add condition</button>}
      </div>
      <div>
        <div className="label">Then</div>
        <div className="space-y-3">{acts.map((a, i) => {
          const m = meta.actions.find((x) => x.type === a.type)!;
          return (
            <div key={i} className="rounded-lg border border-line p-3">
              <div className="flex gap-2">
                <select className="input" value={a.type} onChange={(e) => setActs(acts.map((x, j) => (j === i ? { type: e.target.value, params: {} } : x)))} aria-label="Action">{allowed.map((x) => <option key={x.type} value={x.type}>{x.label}</option>)}</select>
                <button type="button" className="btn btn-ghost" onClick={() => setActs(acts.filter((_, j) => j !== i))} aria-label="Remove action">✕</button>
              </div>
              {m.params.map((p) => <div key={p} className="mt-2"><div className="mb-1 text-[11px] text-ink-3">{p}</div>{paramInput(i, p)}</div>)}
            </div>
          );
        })}</div>
        {acts.length < 5 && <button type="button" className="btn btn-ghost mt-2 h-8 text-xs" onClick={() => setActs([...acts, { type: allowed[0].type, params: {} }])}>+ Add action</button>}
      </div>
      <p className="text-[11px] text-ink-3">Message placeholders: <code>{"{title}"}</code>, <code>{"{body}"}</code>. Actions run with <em>your</em> permissions at the time they execute; events created by automations never trigger other automations; each rule runs at most 30 times per hour.</p>
      <button className="btn btn-primary" disabled={pending}>Save rule</button>
    </form>
  );
}

export function TestRuleButton({ id }: { id: string }) {
  const [s, action, pending] = useActionState<AutoState, FormData>(testRuleAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost h-7 text-xs" disabled={pending}>{pending ? "Running…" : "Run now (test)"}</button>
      {(s.ok || s.error) && <p className={`mt-1 max-w-md text-[11px] ${s.error ? "text-bad" : "text-ink-2"}`}>{s.error ?? s.ok}</p>}
    </form>
  );
}
