"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";

import IconButton from "@/components/system/IconButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { EditableNumberInput } from "@/components/ui/editable-number-input";
import type { ServiceOptionGroup, ServiceVariant } from "@/features/service/types";
import { variantCombinationKey } from "@/features/service/domain/serviceVariants";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import { formatDuration } from "@/features/service/utils/duration";

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
  const [inlineValue, setInlineValue] = useState<{ variantId: string; groupId: string; label: string } | null>(null);

  function selectedLabels(variant: ServiceVariant) {
    return optionGroups.flatMap((group) => group.values.filter((value) => variant.optionValueIds.includes(value.id)).map((value) => value.label.trim())).filter(Boolean);
  }

  function firstUnusedCombination(): string[] | null {
    if (optionGroups.length === 0 || optionGroups.some((group) => group.values.length === 0)) return null;
    const used = new Set(variants.map((variant) => variantCombinationKey(variant.optionValueIds)));
    let combinations: string[][] = [[]];
    for (const group of optionGroups) combinations = combinations.flatMap((combination) => group.values.filter((value) => value.active).map((value) => [...combination, value.id]));
    return combinations.find((combination) => !used.has(variantCombinationKey(combination))) ?? null;
  }

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

  function addInlineValue(group: ServiceOptionGroup, variant: ServiceVariant) {
    const label = inlineValue?.label.normalize("NFKC").trim() ?? "";
    if (!label || group.values.length >= 12 || group.values.some((value) => value.label.normalize("NFKC").trim().toLowerCase() === label.toLowerCase())) return;
    const id = crypto.randomUUID();
    onOptionGroupsChange(optionGroups.map((candidate) => candidate.id === group.id ? {
      ...candidate,
      values: [...candidate.values, { id, label, active: true, position: candidate.values.length }],
    } : candidate));
    changeVariant(variant.id, {
      optionValueIds: [...variant.optionValueIds.filter((valueId) => !group.values.some((value) => value.id === valueId)), id],
    });
    setInlineValue(null);
  }

  function addVariant() {
    const optionValueIds = firstUnusedCombination();
    if (!optionValueIds) return;
    onVariantsChange([...variants, {
      id: crypto.randomUUID(),
      optionValueIds,
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

  function duplicateVariant(variant: ServiceVariant) {
    const optionValueIds = firstUnusedCombination();
    if (!optionValueIds) return;
    onVariantsChange([...variants, { ...variant, id: crypto.randomUUID(), optionValueIds, displayLabel: "" }]);
  }

  const canAddCombination = firstUnusedCombination() !== null;

  if (optionGroups.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border p-4">
        <h3 className="font-semibold">Client choices <span className="font-normal text-muted-foreground">(optional)</span></h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Use a choice type such as Instructor, Package, or Format when clients can select between named values with their own price or timing.</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onOptionGroupsChange([newGroup(0)])}>
          <Plus className="size-4" /> Add choices
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <div>
        <h3 className="font-semibold">Client choices</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">First name the choice type and its values. Then define only the combinations clients can actually book.</p>
      </div>

      {optionGroups.map((group, groupIndex) => (
        <article key={group.id} className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Label className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Choice name</Label>
              <Input value={group.name} maxLength={80} placeholder="e.g. Instructor" onChange={(event) => changeGroup(group.id, { name: event.target.value })} />
              <p className="mt-1.5 text-xs text-muted-foreground">The question clients answer, such as Instructor or Package.</p>
            </div>
            <IconButton type="button" label={`Remove choice type ${groupIndex + 1}`} onClick={() => removeGroup(group)}><Trash2 className="size-4" /></IconButton>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Values</Label>
            {group.values.map((value, valueIndex) => (
              <div key={value.id} className="flex items-center gap-2">
                <Input value={value.label} maxLength={80} aria-label={`${group.name || `Choice ${groupIndex + 1}`} value ${valueIndex + 1}`} placeholder={valueIndex === 0 ? "e.g. Owner" : "e.g. Mentor"} onChange={(event) => changeValue(group, value.id, event.target.value)} />
                <IconButton type="button" label={`Remove value ${valueIndex + 1}`} disabled={group.values.length <= 1} onClick={() => removeValue(group, value.id)}><Trash2 className="size-4" /></IconButton>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" disabled={group.values.length >= 12} onClick={() => changeGroup(group.id, { values: [...group.values, { id: crypto.randomUUID(), label: "", active: true, position: group.values.length }] })}><Plus className="size-4" /> Add value</Button>
          </div>
        </article>
      ))}

      <Button type="button" variant="outline" size="sm" disabled={optionGroups.length >= 4} onClick={() => onOptionGroupsChange([...optionGroups, newGroup(optionGroups.length)])}><Plus className="size-4" /> Add another choice type</Button>

      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h4 className="font-semibold">Valid combinations</h4><p className="mt-1 text-xs text-muted-foreground">Invalid combinations will never be offered publicly.</p></div>
          <Button type="button" variant="outline" size="sm" disabled={!canAddCombination} title={canAddCombination ? undefined : "Every available combination is already listed"} onClick={addVariant}><Plus className="size-4" /> Add combination</Button>
        </div>
        {variants.length === 0 ? <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">Add at least one valid combination before saving options.</p> : (
          <div className="mt-3 space-y-3">
            {variants.map((variant, variantIndex) => (
              <article key={variant.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{variant.displayLabel.trim() || selectedLabels(variant).join(" · ") || `Combination ${variantIndex + 1}`}</p><p className="mt-0.5 text-xs text-muted-foreground">Combination {variantIndex + 1}</p></div><div className="flex"><IconButton type="button" label={`Duplicate combination ${variantIndex + 1}`} disabled={!canAddCombination} title={canAddCombination ? "Copy pricing into the next unused combination" : "Every combination is already listed"} onClick={() => duplicateVariant(variant)}><Copy className="size-4" /></IconButton><IconButton type="button" label={`Remove combination ${variantIndex + 1}`} onClick={() => onVariantsChange(variants.filter((item) => item.id !== variant.id))}><Trash2 className="size-4" /></IconButton></div></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {optionGroups.map((group) => (
                    <div key={group.id} className="min-w-0"><Label className="mb-2">{group.name.trim() || `Choice ${group.position + 1}`}</Label><select className="native-control" value={group.values.find((value) => variant.optionValueIds.includes(value.id))?.id ?? ""} onChange={(event) => changeVariant(variant.id, { optionValueIds: [...variant.optionValueIds.filter((id) => !group.values.some((value) => value.id === id)), event.target.value] })}>{group.values.map((value) => <option key={value.id} value={value.id}>{value.label || "Untitled value"}</option>)}</select>{inlineValue?.variantId === variant.id && inlineValue.groupId === group.id ? <div className="mt-2 rounded-lg border border-border bg-muted/35 p-2"><Input autoFocus value={inlineValue.label} maxLength={80} placeholder={`New ${group.name || "value"}`} aria-label={`New value for ${group.name || "choice"}`} onChange={(event) => setInlineValue({ ...inlineValue, label: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addInlineValue(group, variant); } if (event.key === "Escape") setInlineValue(null); }} /><div className="mt-2 flex items-center gap-2"><Button type="button" size="xs" onClick={() => addInlineValue(group, variant)} disabled={!inlineValue.label.trim() || group.values.length >= 12 || group.values.some((value) => value.label.trim().toLowerCase() === inlineValue.label.trim().toLowerCase())}>Add and select</Button><Button type="button" size="xs" variant="ghost" onClick={() => setInlineValue(null)}>Cancel</Button></div>{inlineValue.label.trim() && group.values.some((value) => value.label.trim().toLowerCase() === inlineValue.label.trim().toLowerCase()) && <p className="mt-1.5 text-xs text-destructive">This value already exists in {group.name || "this choice"}.</p>}</div> : <Button type="button" variant="link" size="xs" className="mt-1.5 h-auto px-0" disabled={group.values.length >= 12} onClick={() => setInlineValue({ variantId: variant.id, groupId: group.id, label: "" })}><Plus className="size-3" /> Add value</Button>}</div>
                  ))}
                  <div className="sm:col-span-2"><Label className="mb-2">Display label <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={variant.displayLabel} maxLength={120} placeholder={selectedLabels(variant).join(" · ") || "Built from the selected values"} onChange={(event) => changeVariant(variant.id, { displayLabel: event.target.value })} /><p className="mt-1.5 text-xs text-muted-foreground">Leave blank to show {selectedLabels(variant).join(" · ") || "the selected values"}.</p></div>
                  <div><Label className="mb-2">Price</Label><MoneyInput value={variant.price} onChange={(price) => changeVariant(variant.id, { price })} /></div>
                  <div><Label className="mb-2">Duration (minutes)</Label><EditableNumberInput min={1} value={variant.duration} emptyValue={0} onValueChange={(duration) => changeVariant(variant.id, { duration })} /></div>
                  <div><Label className="mb-2">Schedules</Label><EditableNumberInput min={1} max={50} value={variant.defaultSessionCount} emptyValue={0} onValueChange={(defaultSessionCount) => changeVariant(variant.id, { defaultSessionCount })} /></div>
                  <label className="flex min-h-11 items-center gap-2 self-end rounded-lg border border-border px-3 text-sm font-medium"><input type="checkbox" checked={variant.active} onChange={(event) => changeVariant(variant.id, { active: event.target.checked })} /> Available</label>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {variants.some((variant) => variant.active) && <aside className="border-t border-border pt-4" aria-label="Client choice preview"><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Client preview</p><p className="mt-1 text-sm text-muted-foreground">Clients choose a value in each group, then see the matching available combination.</p><div className="mt-4 space-y-3">{optionGroups.map((group) => <div key={group.id}><p className="text-sm font-semibold">{group.name || "Untitled choice"}</p><div className="mt-2 flex flex-wrap gap-2" role="list" aria-label={`${group.name || "Choice"} values`}>{group.values.filter((value) => value.active).map((value, index) => <span role="listitem" key={value.id} className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium ${index === 0 ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}>{value.label || "Untitled value"}</span>)}</div></div>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-2">{variants.filter((variant) => variant.active).slice(0, 6).map((variant) => <div key={variant.id} className="rounded-lg border border-border bg-card p-3"><p className="truncate text-sm font-semibold">{variant.displayLabel.trim() || selectedLabels(variant).join(" · ") || "Untitled combination"}</p><p className="mt-1 text-xs text-muted-foreground">{formatRupiah(variant.price)} · {formatDuration(variant.duration)} · {variant.defaultSessionCount} {variant.defaultSessionCount === 1 ? "schedule" : "schedules"}</p></div>)}</div>{variants.filter((variant) => variant.active).length > 6 && <p className="mt-2 text-xs text-muted-foreground">+ {variants.filter((variant) => variant.active).length - 6} more available combinations</p>}</aside>}
    </section>
  );
}
