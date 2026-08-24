/* eslint-disable @next/next/no-img-element -- Owner media may use protected validation URLs. */
"use client";

import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { groupPortfolioWorks, type PublicService, type QaiPageConfig } from "@/features/qai-page/validation";

type Props = {
  page: QaiPageConfig;
  services: PublicService[];
  onChange: (page: QaiPageConfig) => void;
  onUpload: (file: File, workId?: string) => Promise<string | null>;
  onRemoveImage: (id: string, imageUrl: string) => Promise<void>;
};

export default function PortfolioEditor({ page, services, onChange, onUpload, onRemoveImage }: Props) {
  const works = groupPortfolioWorks(page.portfolio);

  function updateWork(workId: string, changes: { title?: string; description?: string; category?: string; serviceId?: string | null }) {
    onChange({
      ...page,
      portfolio: page.portfolio.map((item) => (item.workId ?? item.id) === workId ? {
        ...item,
        workId,
        ...(changes.title !== undefined ? { workTitle: changes.title } : {}),
        ...(changes.description !== undefined ? { workDescription: changes.description } : {}),
        ...(changes.category !== undefined ? { workCategory: changes.category } : {}),
        ...(changes.serviceId !== undefined ? { serviceId: changes.serviceId } : {}),
      } : item),
    });
  }

  function updateImage(id: string, changes: Partial<QaiPageConfig["portfolio"][number]>) {
    onChange({ ...page, portfolio: page.portfolio.map((item) => item.id === id ? { ...item, ...changes } : item) });
  }

  function setCover(workId: string, imageId: string) {
    onChange({ ...page, portfolio: page.portfolio.map((item) => (item.workId ?? item.id) === workId ? { ...item, workId, isCover: item.id === imageId } : item) });
  }

  function moveImage(workId: string, imageId: string, direction: -1 | 1) {
    const workImages = page.portfolio.filter((item) => (item.workId ?? item.id) === workId).sort((left, right) => left.position - right.position);
    const index = workImages.findIndex((item) => item.id === imageId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= workImages.length) return;
    const target = workImages[targetIndex];
    const source = workImages[index];
    onChange({ ...page, portfolio: page.portfolio.map((item) => item.id === source.id ? { ...item, position: target.position } : item.id === target.id ? { ...item, position: source.position } : item) });
  }

  async function addImage(file: File | undefined, workId?: string) {
    if (!file || page.portfolio.length >= 40) return;
    const imageUrl = await onUpload(file, workId);
    if (!imageUrl) return;
    const id = crypto.randomUUID();
    const group = workId ? works.find((work) => work.id === workId) : null;
    onChange({
      ...page,
      portfolio: [...page.portfolio, {
        id,
        imageUrl,
        caption: "",
        serviceId: group?.serviceId ?? null,
        visible: true,
        position: page.portfolio.length,
        workId: workId ?? id,
        workTitle: group?.title ?? "Untitled work",
        workDescription: group?.description ?? "",
        workCategory: group?.category ?? "",
        isCover: !group,
      }],
    });
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="section-title">Selected work</h2><p className="mt-1 text-sm text-muted-foreground">Organize up to 40 images into projects. Each project opens as its own gallery.</p></div>
        <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold ${page.portfolio.length >= 40 ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}><ImagePlus className="size-4" />New work<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={page.portfolio.length >= 40} onChange={(event) => void addImage(event.target.files?.[0])} /></label>
      </header>

      {works.length === 0 ? <div className="empty-state"><p className="empty-title">No selected work yet</p><p className="mt-2 text-sm text-muted-foreground">Add a cover image to start your first project.</p></div> : works.map((work) => (
        <article key={work.id} className="surface-card overflow-hidden">
          <header className="grid gap-4 border-b border-border p-4 sm:grid-cols-2 sm:p-5">
            <div><Label className="mb-2 block">Work title</Label><Input value={work.title} maxLength={160} onChange={(event) => updateWork(work.id, { title: event.target.value })} /></div>
            <div><Label className="mb-2 block">Category</Label><Input value={work.category} maxLength={100} placeholder="e.g. Bridal" onChange={(event) => updateWork(work.id, { category: event.target.value })} /></div>
            <div className="sm:col-span-2"><Label className="mb-2 block">Description</Label><Textarea rows={2} value={work.description} maxLength={1000} onChange={(event) => updateWork(work.id, { description: event.target.value })} /></div>
            <div><Label className="mb-2 block">Related service</Label><select className="native-control" value={work.serviceId ?? ""} onChange={(event) => updateWork(work.id, { serviceId: event.target.value || null })}><option value="">No related service</option>{services.map((service) => <option key={service.serviceId} value={service.serviceId}>{service.title}</option>)}</select></div>
            <label className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 self-end rounded-lg border border-border px-4 text-sm font-semibold ${page.portfolio.length >= 40 ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}><ImagePlus className="size-4" />Add image<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={page.portfolio.length >= 40} onChange={(event) => void addImage(event.target.files?.[0], work.id)} /></label>
          </header>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">{work.images.map((image, index) => (
            <figure key={image.id} className="overflow-hidden rounded-lg border border-border bg-muted/25"><img src={image.imageUrl} alt={image.caption || `${work.title} image ${index + 1}`} className="aspect-[4/3] w-full object-cover" /><figcaption className="space-y-3 p-3"><Input value={image.caption} maxLength={240} aria-label={`Caption for ${work.title} image ${index + 1}`} placeholder="Image caption" onChange={(event) => updateImage(image.id, { caption: event.target.value })} /><div className="flex flex-wrap items-center gap-1"><button type="button" className={`mr-auto inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold ${image.isCover || (index === 0 && !work.images.some((item) => item.isCover)) ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setCover(work.id, image.id)}><Star className="size-4" />Cover</button><label className="inline-flex min-h-10 items-center gap-2 px-1 text-xs font-semibold"><input type="checkbox" checked={image.visible} onChange={(event) => updateImage(image.id, { visible: event.target.checked })} />Show</label><Button type="button" size="icon-sm" variant="ghost" disabled={index === 0} aria-label={`Move ${work.title} image ${index + 1} earlier`} onClick={() => moveImage(work.id, image.id, -1)}><ArrowUp className="size-4" /></Button><Button type="button" size="icon-sm" variant="ghost" disabled={index === work.images.length - 1} aria-label={`Move ${work.title} image ${index + 1} later`} onClick={() => moveImage(work.id, image.id, 1)}><ArrowDown className="size-4" /></Button><Button type="button" size="icon-sm" variant="destructive" aria-label={`Remove ${work.title} image ${index + 1}`} onClick={() => void onRemoveImage(image.id, image.imageUrl)}><Trash2 className="size-4" /></Button></div></figcaption></figure>
          ))}</div>
        </article>
      ))}
    </section>
  );
}
