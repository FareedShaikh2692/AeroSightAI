"use client";
import { useActionState } from "react";
import { registerDroneAction, type ActionState } from "../actions";
import { FormError } from "@/components/ui";

export function RegisterDrone() {
  const [state, action, pending] = useActionState<ActionState, FormData>(registerDroneAction, {});
  const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><FormError error={state.error} />{state.ok && <p className="text-sm text-ok">{state.ok}</p>}</div>
      <div><label className="label" htmlFor="providerKey">Provider</label><select id="providerKey" name="providerKey" className="input"><option value="simulator">Simulator (for live demo)</option><option value="manual">Manual / upload</option></select></div>
      <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" required maxLength={60} /></div>
      <div><label className="label" htmlFor="manufacturer">Manufacturer</label><input id="manufacturer" name="manufacturer" className="input" required defaultValue="DJI" /></div>
      <div><label className="label" htmlFor="model">Model</label><input id="model" name="model" className="input" required defaultValue="Mavic 3 Enterprise" /></div>
      <div><label className="label" htmlFor="serialNumber">Serial number</label><input id="serialNumber" name="serialNumber" className="input font-mono" required maxLength={40} /></div>
      <div><label className="label" htmlFor="registrationNumber">Registration no.</label><input id="registrationNumber" name="registrationNumber" className="input font-mono" maxLength={40} /></div>
      <div><label className="label" htmlFor="registrationExpiresAt">Registration expiry</label><input id="registrationExpiresAt" name="registrationExpiresAt" type="date" className="input" required defaultValue={nextYear} /></div>
      <div className="flex items-end"><button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Saving…" : "Register"}</button></div>
    </form>
  );
}
