import { requireContext } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { can } from "@/lib/policy";
import { db } from "@/lib/store";
import { PageHeader, Card, Badge, Forbidden } from "@/components/ui";
import { TRIGGERS, ACTIONS } from "@/lib/automation";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";
import { relTime } from "@/lib/format";
import { RuleBuilder, TestRuleButton } from "./RuleBuilder";
import { toggleRuleAction, deleteRuleAction } from "./actions";

export default async function Automations() {
  const ctx = await requireContext();
  if (!can(ctx, "integration:manage")) return <Forbidden perm="integration:manage" />;
  const rules = db().automationRules.filter((r) => r.organizationId === ctx.orgId);
  const runs = db().automationRuns.filter((r) => r.organizationId === ctx.orgId).slice(-30).reverse();
  const describe = (c: { field: string; op: string; value: string }) => `${c.field} ${{ eq: "=", neq: "≠", in: "in", gte: "≥", lte: "≤", contains: "contains" }[c.op]} ${c.value}`;
  return (
    <>
      <PageHeader eyebrow="Organization" title={<span className="flex items-center gap-3">Automations <Badge tone="info">Beta</Badge></span>}
        subtitle="Workflow rules: when an event happens and conditions match, run actions — notify, post to Slack/Teams, call webhooks, assign or reschedule findings, schedule inspections, run AI analysis." />
      <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
        <div className="space-y-6">
          <Card title={`Rules (${rules.length})`} pad={false}>
            {rules.length === 0 ? <p className="p-5 text-sm text-ink-2">No rules yet.</p> : (
              <ul className="divide-y divide-line">{rules.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><div className="font-medium">{r.name} {r.enabled ? <Badge tone="ok">on</Badge> : <Badge>off</Badge>}</div>
                      <div className="mt-1 text-xs text-ink-2"><strong>When</strong> {TRIGGERS[r.trigger]?.label ?? r.trigger}{r.conditions.length ? <> <strong>if</strong> {r.conditions.map(describe).join(" and ")}</> : null}</div>
                      <div className="text-xs text-ink-2"><strong>Then</strong> {r.actions.map((a) => ACTIONS[a.type]?.label ?? a.type).join(" → ")}</div>
                      <div className="mt-1 text-[11px] text-ink-3">Runs as {repo.userName(r.createdBy)} · {r.runCount} run(s){r.lastRunAt ? ` · last ${relTime(r.lastRunAt)}` : ""}</div></div>
                    <div className="flex items-start gap-1">
                      <TestRuleButton id={r.id} />
                      <form action={toggleRuleAction}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost h-7 text-xs">{r.enabled ? "Disable" : "Enable"}</button></form>
                      <form action={deleteRuleAction}><input type="hidden" name="id" value={r.id} /><button className="btn btn-ghost h-7 text-xs text-bad">Delete</button></form>
                    </div>
                  </div>
                </li>
              ))}</ul>
            )}
          </Card>
          <Card title="Run log (last 30)" pad={false}>
            {runs.length === 0 ? <p className="p-5 text-sm text-ink-2">No runs yet. Rules run when their trigger event happens — or use “Run now (test)”.</p> : (
              <table className="table text-sm"><thead><tr><th>When</th><th>Rule</th><th>Trigger</th><th>Result</th></tr></thead><tbody>
                {runs.map((x) => <tr key={x.id}><td className="whitespace-nowrap text-xs">{relTime(x.at)}</td><td>{rules.find((r) => r.id === x.ruleId)?.name ?? "deleted rule"}</td><td className="font-mono text-[11px]">{x.trigger}</td>
                  <td><Badge tone={x.status === "succeeded" ? "ok" : x.status === "partial" || x.status === "throttled" ? "warn" : "bad"}>{x.status}</Badge>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-ink-2">{x.steps.map((s, i) => <li key={i}>{s.ok ? "✓" : "✗"} {s.detail}</li>)}</ul></td></tr>)}
              </tbody></table>
            )}
          </Card>
        </div>
        <Card title="New rule">
          <RuleBuilder meta={{
            triggers: Object.entries(TRIGGERS).map(([key, v]) => ({ key, ...v })),
            actions: Object.entries(ACTIONS).map(([type, v]) => ({ type, ...v })),
            roles: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
            channels: db().notificationRules.filter((r) => r.organizationId === ctx.orgId).map((r) => ({ value: r.id, label: `${r.name} (${r.channel})` })),
            webhooks: db().webhooks.filter((w) => w.organizationId === ctx.orgId).map((w) => ({ value: w.id, label: new URL(w.url).hostname })),
            templates: db().inspectionTemplates.filter((t) => t.organizationId === ctx.orgId && t.status === "published").map((t) => ({ value: t.id, label: t.name })),
          }} />
        </Card>
      </div>
    </>
  );
}
