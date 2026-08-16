/* eslint-disable @next/next/no-img-element -- Business-owned validation images can be data URLs or protected media URLs. */

import type { CSSProperties } from "react";
import { ArrowUpRight, AtSign, Clock3, Mail, MapPin, MessageCircle } from "lucide-react";

import { QaiMark } from "@/components/brand/QaiLogo";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/features/service/utils/duration";
import {
  normalizeContactPhone,
  publicActionLabel,
  publicPriceLabel,
  QAI_ATTRIBUTION_HREF,
  type PublicService,
  type QaiPageConfig,
} from "@/features/qai-page/validation";

type RendererProps = {
  page: QaiPageConfig;
  services: PublicService[];
  portfolio: QaiPageConfig["portfolio"];
  onChoose?: (service: PublicService) => void;
  preview?: boolean;
};

type PageVariables = CSSProperties & {
  "--page-accent": string;
  "--page-bg": string;
};

function socialHref(value: string): string | null {
  const contact = value.trim();
  if (!contact) return null;
  if (/^https?:\/\//i.test(contact)) {
    try {
      const url = new URL(contact);
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  const handle = contact.replace(/^@/, "");
  if (/^[a-zA-Z0-9._]+$/.test(handle)) return `https://instagram.com/${handle}`;
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/.*)?$/.test(contact)) return `https://${contact}`;
  return null;
}

function ContactLinks({ page, inverse = false }: { page: QaiPageConfig; inverse?: boolean }) {
  const instagramHref = socialHref(page.instagram);
  if (!page.style.showContact || (!page.whatsapp && !page.email && !instagramHref)) return null;
  const linkClass = inverse
    ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-black/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    : "inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white/85 px-4 py-2 text-sm font-semibold text-[var(--page-accent)] shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]";
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {page.whatsapp && <a href={`https://wa.me/${normalizeContactPhone(page.whatsapp)}`} target="_blank" rel="noreferrer" className={linkClass}><MessageCircle className="size-4" aria-hidden="true" /> WhatsApp</a>}
      {page.email && <a href={`mailto:${page.email}`} className={linkClass}><Mail className="size-4" aria-hidden="true" /> Email</a>}
      {instagramHref && <a href={instagramHref} target="_blank" rel="noreferrer" className={linkClass}><AtSign className="size-4" aria-hidden="true" /> Instagram</a>}
    </div>
  );
}

function Identity({ page, inverse = false, centered = false }: { page: QaiPageConfig; inverse?: boolean; centered?: boolean }) {
  return (
    <div className={`min-w-0 ${centered ? "text-center" : ""}`}>
      {page.logo && <img src={page.logo} alt={`${page.businessName} logo`} className={`mb-6 size-20 border object-cover p-1 shadow-sm sm:size-24 ${inverse ? "border-white/30 bg-white/90" : "border-black/10 bg-white"} ${centered ? "mx-auto rounded-full" : "rounded-2xl"}`} />}
      <h1 className="break-words text-4xl font-bold tracking-[-0.04em] sm:text-5xl lg:text-6xl">{page.businessName}</h1>
      {page.shortDescription && <p className={`mt-5 max-w-3xl whitespace-pre-wrap text-base leading-7 sm:text-lg ${inverse ? "text-white/80" : "opacity-70"} ${centered ? "mx-auto" : ""}`}>{page.shortDescription}</p>}
      {page.location && <p className={`mt-5 flex items-center gap-2 text-sm ${inverse ? "text-white/70" : "opacity-60"} ${centered ? "justify-center" : ""}`}><MapPin className="size-4 shrink-0" aria-hidden="true" /> {page.location}</p>}
      <ContactLinks page={page} inverse={inverse} />
    </div>
  );
}

function Hero({ page }: { page: QaiPageConfig }) {
  if (page.template === "Muse") {
    return (
      <header className="relative isolate flex min-h-[30rem] items-end overflow-hidden bg-slate-950 sm:min-h-[36rem] lg:min-h-[43rem]">
        {page.coverImage ? <img src={page.coverImage} alt="" className="absolute inset-0 -z-20 size-full object-cover" /> : <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_78%_20%,#b0839b_0,transparent_36%),linear-gradient(135deg,#171421,#56364d_58%,#536b9e)]" />}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,12,22,.12)_10%,rgba(8,12,22,.9)_100%)]" />
        <div className="mx-auto w-full max-w-[90rem] px-5 pb-10 text-white sm:px-8 sm:pb-14 lg:px-12 lg:pb-18"><div className="max-w-3xl"><Identity page={page} inverse /></div></div>
      </header>
    );
  }
  if (page.template === "Studio") {
    return (
      <header className="mx-auto grid min-h-[35rem] max-w-[90rem] overflow-hidden bg-white lg:grid-cols-[.82fr_1.18fr]">
        <div className="flex items-center px-6 py-12 sm:px-10 lg:px-14"><Identity page={page} /></div>
        {page.coverImage ? <img src={page.coverImage} alt="" className="min-h-80 size-full object-cover" /> : <div className="min-h-80 bg-[linear-gradient(145deg,#e9dbe3_0%,var(--page-accent)_52%,#536b9e_100%)]" />}
      </header>
    );
  }
  if (page.template === "Signature") {
    return (
      <header className="mx-auto max-w-6xl px-5 pb-10 pt-16 sm:px-8 sm:pb-14 sm:pt-24">
        <Identity page={page} centered />
        {page.coverImage && <img src={page.coverImage} alt="" className="mt-14 aspect-[16/7] w-full object-cover shadow-[0_25px_80px_-38px_rgba(15,23,42,.55)]" />}
      </header>
    );
  }
  if (page.template === "Professional") {
    return (
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_18rem] lg:items-end lg:py-14"><Identity page={page} />{page.coverImage && <img src={page.coverImage} alt="" className="hidden aspect-[4/3] w-full rounded-lg object-cover lg:block" />}</div>
        <div className="h-1.5 bg-[var(--page-accent)]" />
      </header>
    );
  }
  if (page.template === "Editorial") {
    return (
      <header className="mx-auto max-w-[90rem] bg-white px-4 py-6 sm:px-7 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-black/15 py-4">
          <div className="flex min-w-0 items-center gap-3">{page.logo && <img src={page.logo} alt={`${page.businessName} logo`} className="size-12 shrink-0 rounded-full border border-black/10 object-cover" />}<p className="truncate text-sm font-bold uppercase tracking-[0.2em]">{page.businessName}</p></div>
          <p className="text-xs uppercase tracking-[0.16em] opacity-55">Service journal / Selected work</p>
        </div>
        <div className="grid border-b border-black/15 lg:grid-cols-[1.35fr_.65fr]">
          {page.coverImage ? <img src={page.coverImage} alt="" className="min-h-72 size-full object-cover lg:min-h-[39rem]" /> : <div className="min-h-72 bg-[linear-gradient(145deg,#251e27,var(--page-accent),#7182aa)] lg:min-h-[39rem]" />}
          <div className="flex items-end px-5 py-9 sm:px-9 sm:py-12 lg:px-12 lg:py-14"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-accent)]">Profile / Services</p><h1 className="mt-5 break-words font-serif text-4xl font-bold leading-[.95] tracking-[-0.05em] sm:text-5xl lg:text-6xl">{page.businessName}</h1>{page.shortDescription && <p className="mt-6 whitespace-pre-wrap text-base leading-7 opacity-70">{page.shortDescription}</p>}{page.location && <p className="mt-5 flex items-center gap-2 text-sm opacity-60"><MapPin className="size-4 shrink-0" aria-hidden="true" /> {page.location}</p>}<ContactLinks page={page} /></div></div>
        </div>
      </header>
    );
  }
  return (
    <header className="mx-auto max-w-[90rem] px-4 py-5 sm:px-7 sm:py-8">
      <div className="relative isolate min-h-[32rem] overflow-hidden rounded-[2rem] bg-slate-900 sm:min-h-[38rem]">
        {page.coverImage ? <img src={page.coverImage} alt="" className="absolute inset-0 -z-20 size-full object-cover" /> : <div className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,#f0d9cf,var(--page-accent),#394767)]" />}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(12,17,29,.86)_0%,rgba(12,17,29,.38)_60%,rgba(12,17,29,.12)_100%)]" />
        <div className="flex min-h-[32rem] items-end p-6 text-white sm:min-h-[38rem] sm:p-10 lg:p-14"><div className="max-w-2xl rounded-[1.5rem] border border-white/15 bg-black/20 p-6 backdrop-blur-sm sm:p-8"><Identity page={page} inverse /></div></div>
      </div>
    </header>
  );
}

function portfolioLayout(template: QaiPageConfig["template"], index: number): { figure: string; image: string } {
  if (template === "Muse") {
    if (index === 0) return { figure: "col-span-2 row-span-2 md:col-span-8", image: "aspect-[4/3] md:h-full md:aspect-auto" };
    return { figure: "md:col-span-4", image: "aspect-square" };
  }
  if (template === "Studio") return { figure: "md:col-span-4", image: index % 3 === 1 ? "aspect-[4/5]" : "aspect-[5/4]" };
  if (template === "Signature") return { figure: "md:col-span-6", image: index % 2 === 0 ? "aspect-[4/5]" : "aspect-[4/3]" };
  if (template === "Professional") return { figure: "md:col-span-3", image: "aspect-[4/3]" };
  if (template === "Editorial") {
    const wide = index % 4 === 0 || index % 4 === 3;
    return { figure: wide ? "col-span-2 md:col-span-7" : "md:col-span-5", image: wide ? "aspect-[16/10]" : "aspect-[4/5]" };
  }
  if (index === 0) return { figure: "col-span-2 md:col-span-7 md:row-span-2", image: "aspect-[4/3] md:h-full md:aspect-auto" };
  return { figure: "md:col-span-5", image: "aspect-[5/4]" };
}

function PortfolioSection({ page, services, portfolio, onChoose }: RendererProps) {
  if (!page.style.showPortfolio || portfolio.length === 0) return null;
  return (
    <section aria-labelledby="public-portfolio-heading">
      <div className={page.template === "Signature" ? "text-center" : page.template === "Editorial" ? "grid gap-2 border-b border-black/15 pb-5 sm:grid-cols-[1fr_auto] sm:items-end" : ""}><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-accent)]">Portfolio</p><h2 id="public-portfolio-heading" className={`mt-2 text-3xl font-bold tracking-tight ${page.template === "Editorial" ? "font-serif sm:text-5xl" : ""}`}>Selected work</h2></div>{page.template === "Editorial" && <p className="max-w-xs text-sm leading-6 opacity-60">A magazine-style edit of recent projects and creative services.</p>}</div>
      <div className={`mt-7 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-12 ${page.template === "Muse" || page.template === "Warm" ? "md:auto-rows-[15rem] lg:auto-rows-[18rem]" : "md:items-start"}`}>
        {portfolio.map((item, index) => {
          const related = services.find((service) => service.serviceId === item.serviceId);
          const layout = portfolioLayout(page.template, index);
          return (
            <figure key={item.id} className={`group relative overflow-hidden border border-black/10 bg-white ${page.template === "Signature" || page.template === "Editorial" ? "rounded-none" : page.template === "Professional" ? "rounded-lg" : "rounded-2xl"} ${layout.figure}`}>
              <img src={item.imageUrl} alt={item.caption || `${page.businessName} selected work ${index + 1}`} className={`w-full object-cover transition duration-500 group-hover:scale-[1.015] ${layout.image}`} loading={index < 3 ? "eager" : "lazy"} />
              {(item.caption || related) && <figcaption className={`${page.template === "Muse" || page.template === "Warm" ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-14 text-white sm:p-6" : "p-4"}`}>{item.caption && <p className="text-sm leading-5">{item.caption}</p>}{related && onChoose && <button type="button" onClick={() => onChoose(related)} className={`mt-2 inline-flex min-h-10 items-center gap-1 text-left text-xs font-semibold hover:underline ${page.template === "Muse" || page.template === "Warm" ? "text-white" : "text-[var(--page-accent)]"}`}>View {related.title} <ArrowUpRight className="size-3.5" aria-hidden="true" /></button>}</figcaption>}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

function ServicesSection({ page, services, onChoose }: RendererProps) {
  if (!page.style.showServices) return null;
  const gridClass = page.template === "Studio" ? "lg:grid-cols-3" : page.template === "Professional" ? "grid-cols-1" : "md:grid-cols-2";
  return (
    <section aria-labelledby="public-services-heading">
      <div className={page.template === "Signature" ? "text-center" : ""}><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-accent)]">Work with {page.businessName}</p><h2 id="public-services-heading" className={`mt-2 text-3xl font-bold tracking-tight ${page.template === "Editorial" ? "font-serif sm:text-5xl" : ""}`}>Services</h2></div>
      {services.length === 0 ? <div className="mt-6 max-w-xl rounded-xl border border-dashed border-black/15 bg-white/70 p-6 text-sm opacity-70">Public services are coming soon. Contact {page.businessName} directly for current availability.</div> : (
        <div className={`mt-7 grid gap-4 ${gridClass}`}>
          {services.map((service, index) => (
            <article key={service.serviceId} className={`flex flex-col border border-black/10 bg-white p-5 sm:p-6 ${page.template === "Professional" ? "rounded-lg border-l-4 border-l-[var(--page-accent)] md:grid md:grid-cols-[3rem_1fr_auto_auto] md:items-center md:gap-6" : page.template === "Editorial" ? "rounded-none border-x-0 px-0 md:grid md:grid-cols-[3rem_1fr] md:gap-x-5" : page.template === "Signature" ? "rounded-none border-x-0 px-0" : page.template === "Warm" ? "rounded-[1.75rem]" : "rounded-xl"}`}>
              {(page.template === "Professional" || page.template === "Editorial") && <p className={`hidden text-2xl font-light text-[var(--page-accent)] md:block ${page.template === "Editorial" ? "row-span-3 font-serif text-3xl" : ""}`}>{String(index + 1).padStart(2, "0")}</p>}
              <div><h3 className="break-words text-xl font-bold">{service.title}</h3>{service.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 opacity-65">{service.description}</p>}</div>
              <div className={`${page.template === "Professional" ? "mt-4 md:mt-0 md:min-w-36 md:text-right" : `mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-5 ${page.template === "Editorial" ? "md:col-start-2" : ""}`}`}><p className="font-bold text-[var(--page-accent)]">{publicPriceLabel(service)}</p><p className="mt-1 inline-flex items-center gap-1.5 text-sm opacity-60"><Clock3 className="size-4" aria-hidden="true" />{formatDuration(service.durationMinutes)}</p></div>
              {onChoose && <Button type="button" className={`${page.template === "Professional" ? "mt-4 md:mt-0" : `mt-5 w-full sm:w-auto sm:self-start ${page.template === "Editorial" ? "md:col-start-2" : ""}`}`} style={{ backgroundColor: "var(--page-accent)" }} onClick={() => onChoose(service)}>{publicActionLabel(service.actionMode)}</Button>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function QaiPageRenderer({ page, services, portfolio, onChoose, preview = false }: RendererProps) {
  const variables: PageVariables = { "--page-accent": page.style.accentColor, "--page-bg": page.style.backgroundColor };
  const typography = page.style.typography === "Editorial" ? "font-serif" : page.style.typography === "Classic" ? "font-[Georgia,serif]" : "font-sans";
  const spacing = page.style.density === "Compact" ? "space-y-12 py-12" : "space-y-18 py-16 sm:space-y-24 sm:py-24";
  const sectionMap = {
    portfolio: <PortfolioSection key="portfolio" page={page} services={services} portfolio={portfolio} onChoose={onChoose} />,
    services: <ServicesSection key="services" page={page} services={services} portfolio={portfolio} onChoose={onChoose} />,
  };

  return (
    <div className={`min-h-full overflow-x-hidden bg-[var(--page-bg)] text-[#151924] ${typography}`} style={variables} data-template={page.template}>
      <Hero page={page} />
      <div className={`mx-auto w-full max-w-[90rem] px-4 sm:px-7 lg:px-10 ${spacing}`}>
        {page.style.sectionOrder.map((section) => sectionMap[section])}
        <footer className="border-t border-black/10 pt-8 text-center text-xs text-slate-500">
          <a href={QAI_ATTRIBUTION_HREF} aria-label="Powered by Qai" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 font-medium hover:bg-black/5 hover:text-[var(--page-accent)]"><QaiMark size="sm" tone="monochrome" decorative /> Powered by Qai</a>
          {preview && <p className="mt-1">Preview</p>}
        </footer>
      </div>
    </div>
  );
}
