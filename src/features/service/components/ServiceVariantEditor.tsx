"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import type { ServiceOptionGroup, ServiceVariant } from "@/features/service/types";

type Props = {
  optionGroups: ServiceOptionGroup[];
  variants: ServiceVariant[];
  basePrice: number;
  baseDuration: number;
  baseSessionCount: number;
  onOptionGroupsChange: (groups: ServiceOptionGroup[]) => void;
  onVariantsChange: (variants: ServiceVariant[]) => void;
};

function newGroup(position: number): ServiceOptionGroup {
  return {
    id: crypto.randomUUID(),
    name: "",
    position,
    values: [
      { id: crypto.randomUUID(), label: "", active: true, position: 0 },
      { id: crypto.randomUUID(), label: "", active: true, position: 1 },
    ],
  };
}

export default function ServiceVariantEditor({
  optionGroups,
  variants,
  basePrice,
  baseDuration,
  baseSessionCount,
  onOptionGroupsChange,
  onVariantsChange,
}: Props) {
  function changeGroup(groupId: string, changes: Partial<ServiceOptionGroup>) {
    onOptionGroupsChange(optionGroups.map((group) => group.id === groupId ? { ...group, ...changes } : group));
  }

  function removeGroup(group: ServiceOptionGroup) {
    const removedIds = new Set(group.values.map((value) => value.id));
    onOptionGroupsChange(optionGroups.filter((item) => item.id !== group.id).map((item, position) => ({ ...item, position })));
    onVariantsChange(variants.filter((variant) => !variant.optionValueIds.some((id) => removedIds.has(id))));
  }

  function changeValue(group: ServiceOptionGroup, valueId: string, label: string) {
    changeGroup(group.id, { values: group.values.map((value) => value.id === valueId ? { ...value, label } : value) });
  }

  function removeValue(group: ServiceOptionGroup, valueId: string) {
    changeGroup(group.id, { values: group.values.filter((value) => value.id !== valueId).map((value, position) => ({ ...value, position })) });
    onVariantsChange(variants.filter((variant) => !variant.optionValueIds.includes(valueId)));
  }

  function addVariant() {
    if (optionGroups.some((group) => group.values.length === 0)) return;
    onVariantsChange([...variants, {
      id: crypto.randomUUID(),
      optionValueIds: optionGroups.map((group) => group.values[0].id),
      displayLabel: "",
      price: basePrice,
      duration: baseDuration,
      defaultSessionCount: baseSessionCount,
      active: true,
    }]);
  }

  function changeVariant(variantId: string, changes: Partial<ServiceVariant>) {
    onVariantsChange(variants.map((variant) => variant.id === variantId ? { ...variant, ...changes } : variant));
  }

  if (optionGroups.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border p-4">
        <h3 className="font-semibold">Service options <span className="font-normal text-muted-foreground">(optional)</span></h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Use options only when clients choose a valid combination with its own price, duration, or schedule count.</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onOptionGroupsChange([newGroup(0)])}>
          <Plus className="size-4" /> Add options
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <div>
        <h3 className="font-semibold">Service options</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Define the choices first, then add only combinations you actually offer.</p>
      </div>

      {optionGroups.map((group, groupIndex) => (
        <article key={group.id} className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Label className="mb-2">Option group {groupIndex + 1}</Label>
              <Input value={group.name} maxLength={80} placeholder="e.g. Artist" onChange={(event) => changeGroup(group.id, { name: event.target.value })} />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove option group ${groupIndex + 1}`} onClick={() => removeGroup(group)}><Trash2 className="size-4" /></Button>
          </div>
          <div className="space-y-2">
            {group.values.map((value, valueIndex) => (
              <div key={value.id} className="flex items-center gap-2">
                <Input value={value.label} maxLength={80} aria-label={`${group.name || `Option group ${groupIndex + 1}`} value ${valueIndex + 1}`} placeholder={valueIndex === 0 ? "e.g. Owner" : "e.g. Senior artist"} onChange={(event) => changeValue(group, value.id, event.target.value)} />
                <Button type="button" variant="ghost" size="icon" disabled={group.values.length <= 1} aria-label={`Remove value ${valueIndex + 1}`} onClick={() => removeValue(group, value.id)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" disabled={group.values.length >= 12} onClick={() => changeGroup(group.id, { values: [...group.values, { id: crypto.randomUUID(), label: "", active: true, position: group.values.length }] })}><Plus className="size-4" /> Add value</Button>
          </div>
        </article>
      ))}

      <Button type="button" variant="outline" size="sm" disabled={optionGroups.length >= 4} onClick={() => onOptionGroupsChange([...optionGroups, newGroup(optionGroups.length)])}><Plus className="size-4" /> Add option group</Button>

      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h4 className="font-semibold">Valid combinations</h4><p className="mt-1 text-xs text-muted-foreground">Invalid combinations will never be offered publicly.</p></div>
          <Button type="button" variant="outline" size="sm" onClick={addVariant}><Plus className="size-4" /> Add combination</Button>
        </div>
        {variants.length === 0 ? <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">Add at least one valid combination before saving options.</p> : (
          <div className="mt-3 space-y-3">
            {variants.map((variant, variantIndex) => (
              <article key={variant.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Combination {variantIndex + 1}</p><Button type="button" variant="ghost" size="icon" aria-label={`Remove combination ${variantIndex + 1}`} onClick={() => onVariantsChange(variants.filter((item) => item.id !== variant.id))}><Trash2 className="size-4" /></Button></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {optionGroups.map((group) => (
                    <div key={group.id}><Label className="mb-2">{group.name || "Option"}</Label><select className="native-control" value={group.values.find((value) => variant.optionValueIds.includes(value.id))?.id ?? ""} onChange={(event) => changeVariant(variant.id, { optionValueIds: [...variant.optionValueIds.filter((id) => !group.values.some((value) => value.id === id)), event.target.value] })}>{group.values.map((value) => <option key={value.id} value={value.id}>{value.label || "Untitled value"}</option>)}</select></div>
                  ))}
                  <div className="sm:col-span-2"><Label className="mb-2">Display label <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={variant.displayLabel} maxLength={120} placeholder="Built from the selected values if blank" onChange={(event) => changeVariant(variant.id, { displayLabel: event.target.value })} /></div>
                  <div><Label className="mb-2">Price</Label><MoneyInput value={variant.price} onChange={(price) => changeVariant(variant.id, { price })} /></div>
                  <div><Label className="mb-2">Duration (minutes)</Label><Input type="number" min={1} value={variant.duration} onChange={(event) => changeVariant(variant.id, { duration: Number(event.target.value) || 0 })} /></div>
                  <div><Label className="mb-2">Schedules</Label><Input type="number" min={1} max={50} value={variant.defaultSessionCount} onChange={(event) => changeVariant(variant.id, { defaultSessionCount: Number(event.target.value) || 0 })} /></div>
                  <label className="flex min-h-11 items-center gap-2 self-end rounded-lg border border-border px-3 text-sm font-medium"><input type="checkbox" checked={variant.active} onChange={(event) => changeVariant(variant.id, { active: event.target.checked })} /> Available</label>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
