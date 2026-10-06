"use client";
import { useActionState } from "react";
import { saveTemplateAction, type ActionState } from "../../actions";
import { FormError } from "@/components/ui";

export function TemplateForm({ groupId, name, description, items }: { groupId?: string; name?: string; description?: string; items?: string }) {
  const [s, a, p] = useActionState<ActionState, FormData>(saveTemplateAction, {});
  return (
    <form action={a} className="space-y-3">
      <FormError error={s.error} />{s.ok && <p className="text-sm text-ok">{s.ok}</p>}
      <input type="hidden" name="groupId" value={groupId ?? ""} />
      <div><label className="label" htmlFor="tname">Name</label><input id="tname" name="name" className="input" defaultValue={name} required maxLength={120} /></div>
      <div><label className="label" htmlFor="tdesc">Description</label><input id="tdesc" name="description" className="input" defaultValue={description} maxLength={300} /></div>
      <div><label className="label" htmlFor="titems">Checklist items — one per line; start with * for required</label>
        <textarea id="titems" name="items" rows={10} className="input font-mono text-xs" defaultValue={items ?? "* Item one\n* Item two\nOptional item"} required /></div>
      <button className="btn btn-primary" disabled={p}>{groupId ? "Publish new version" : "Publish template"}</button>
    </form>
  );
}
