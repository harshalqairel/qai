/* eslint-disable @next/next/no-img-element -- Business-owned validation images can be data URLs or protected media URLs. */

import type { CSSProperties } from "react";
import { AtSign, Clock3, Mail, MapPin, MessageCircle } from "lucide-react";

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

function ContactLinks({ page }: { page: QaiPageConfig }) {
  const instagramHref = socialHref(page.instagram);
  if (!page.style.showContact || (!page.whatsapp && !page.email && !instagramHref)) return null;
  const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-full border border-black/8 bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--page-accent)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]";
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {page.whatsapp && <a href={`https://wa.me/${normalizeContactPhone(page.whatsapp)}`} target="_blank" rel="noreferrer" className={linkClass}><MessageCircle className="size-4" aria-hidden="true" /> WhatsApp</a>}
      {page.email && <a href={`mailto:${page.email}`} className={linkClass}><Mail className="size-4" aria-hidden="true" /> Email</a>}
      {instagramHref && <a href={instagramHref} target="_blank" rel="noreferrer" className={linkClass}><AtSign className="size-4" aria-hidden="true" /> Instagram</a>}
    </div>
  );
}

function Hero({ page }: { page: QaiPageConfig }) {
  const identity = (
    <div className="min-w-0">
      {page.logo && <img src={page.logo} alt={`${page.businessName} logo`} className={`mb-5 size-20 border border-black/8 bg-white object-cover p-1 shadow-sm ${page.template === "Signature" ? "mx-auto rounded-full" : "rounded-2xl"}`} />}
      <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{page.businessName}</h1>
      {page.shortDescription && <p className="mt-4 max-w-3xl whitespace-pre-wrap text-base leading-7 opacity-70 sm:text-lg">{page.shortDescription}</p>}
      {page.location && <p className={`mt-4 flex items-center gap-2 text-sm opacity-65 ${page.template === "Signature" ? "justify-center" : ""}`}><MapPin className="size-4 shrink-0" aria-hidden="true" /> {page.location}</p>}
      <ContactLinks page={page} />
    </div>
  );

  if (page.template === "Studio") {
    return <header className="grid overflow-hidden rounded-none border-y border-black/10 bg-white md:grid-cols-2"><div className="flex items-center p-7 sm:p-10 lg:p-14">{identity}</div>{page.coverImage ? <img src={page.coverImage} alt="" className="min-h-72 h-full w-full object-cover" /> : <div className="min-h-72 bg-[linear-gradient(135deg,var(--page-accent),#a8b4ff)]" />}</header>;
  }
  if (page.template === "Signature") {
    return <header className="mx-auto max-w-4xl px-5 py-12 text-center sm:py-18">{identity}{page.coverImage && <img src={page.coverImage} alt="" className="mt-10 aspect-[16/7] w-full rounded-[2rem] object-cover shadow-lg" />}</header>;
  }
  if (page.template === "Professional") {
    return <header className="border-b-4 border-[var(--page-accent)] bg-white px-5 py-8 sm:px-8"><div className="mx-auto max-w-6xl">{identity}</div></header>;
  }
  if (page.template === "Warm") {
    return <header className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[1.05fr_.95fr] md:items-center md:py-10"><div className="rounded-[2rem] bg-white/75 p-6 shadow-sm sm:p-9">{identity}</div>{page.coverImage ? <img src={page.coverImage} alt="" className="aspect-[4/3] w-full rounded-[2.5rem_1rem_2.5rem_1rem] object-cover" /> : <div className="aspect-[4/3] rounded-[2.5rem_1rem_2.5rem_1rem] bg-[linear-gradient(145deg,var(--page-accent),#ffd9c7)]" />}</header>;
  }
  return <><div className="h-48 bg-[linear-gradient(135deg,var(--page-accent),#a8b4ff)] sm:h-64">{page.coverImage && <img src={page.coverImage} alt="" className="h-full w-full object-cover" />}</div><header className="relative z-10 mx-auto -mt-10 max-w-5xl px-4 sm:-mt-14 sm:px-6"><div className="rounded-2xl border border-black/10 bg-white p-6 shadow-lg sm:p-8">{identity}</div></header></>;
}

function PortfolioSection({ page, services, portfolio, onChoose }: RendererProps) {
  if (!page.style.showPortfolio || portfolio.length === 0) return null;
  const grid = page.template === "Professional" ? "md:grid-cols-4" : page.template === "Studio" ? "md:grid-cols-3" : "md:grid-cols-3";
  return (
    <section aria-labelledby="public-portfolio-heading">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--page-accent)]">Portfolio</p>
      <h2 id="public-portfolio-heading" className="mt-1 text-2xl font-bold">Selected work</h2>
      <div className={`mt-5 grid grid-cols-2 gap-3 sm:gap-4 ${grid}`}>
        {portfolio.map((item, index) => {
          const related = services.find((service) => service.serviceId === item.serviceId);
          const featured = (page.template === "Muse" || page.template === "Warm") && index === 0;
          return <figure key={item.id} className={`overflow-hidden border border-black/10 bg-white ${page.template === "Signature" ? "rounded-none" : "rounded-2xl"} ${featured ? "col-span-2 row-span-2" : ""}`}><img src={item.imageUrl} alt={item.caption || `${page.businessName} selected work ${index + 1}`} className={`w-full object-cover ${featured ? "aspect-[4/3]" : "aspect-square"}`} loading={index < 3 ? "eager" : "lazy"} />{(item.caption || related) && <figcaption className="p-3 sm:p-4">{item.caption && <p className="text-sm leading-5">{item.caption}</p>}{related && onChoose && <button type="button" onClick={() => onChoose(related)} className="mt-2 min-h-10 text-left text-xs font-semibold text-[var(--page-accent)] hover:underline">View {related.title} →</button>}</figcaption>}</figure>;
        })}
      </div>
    </section>
  );
}

function ServicesSection({ page, services, onChoose }: RendererProps) {
  if (!page.style.showServices) return null;
  return (
    <section aria-labelledby="public-services-heading">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--page-accent)]">Work with {page.businessName}</p>
      <h2 id="public-services-heading" className="mt-1 text-2xl font-bold">Services</h2>
      {services.length === 0 ? <div className="mt-5 max-w-xl rounded-xl border border-dashed border-black/15 bg-white/70 p-5 text-sm opacity-70">Public services are coming soon. Contact {page.businessName} directly for current availability.</div> : (
        <div className={`mt-5 grid gap-4 ${page.template === "Studio" ? "lg:grid-cols-3" : page.template === "Professional" ? "grid-cols-1" : "md:grid-cols-2"}`}>
          {services.map((service) => <article key={service.serviceId} className={`flex flex-col border border-black/10 bg-white p-5 ${page.template === "Professional" ? "rounded-lg sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6" : page.template === "Signature" ? "rounded-none" : "rounded-2xl"}`}><div><h3 className="break-words text-xl font-bold">{service.title}</h3>{service.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 opacity-65">{service.description}</p>}</div><div className={`${page.template === "Professional" ? "mt-4 sm:mt-0 sm:text-right" : "mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-5"}`}><p className="font-bold text-[var(--page-accent)]">{publicPriceLabel(service)}</p><p className="mt-1 inline-flex items-center gap-1.5 text-sm opacity-60"><Clock3 className="size-4" aria-hidden="true" />{formatDuration(service.durationMinutes)}</p></div>{onChoose && <Button type="button" className={`${page.template === "Professional" ? "mt-4 sm:mt-0" : "mt-5 w-full sm:w-auto sm:self-start"}`} style={{ backgroundColor: "var(--page-accent)" }} onClick={() => onChoose(service)}>{publicActionLabel(service.actionMode)}</Button>}</article>)}
        </div>
      )}
    </section>
  );
}

export default function QaiPageRenderer({ page, services, portfolio, onChoose, preview = false }: RendererProps) {
  const variables: PageVariables = { "--page-accent": page.style.accentColor, "--page-bg": page.style.backgroundColor };
  const typography = page.style.typography === "Editorial" ? "font-serif" : page.style.typography === "Classic" ? "font-[Georgia,serif]" : "font-sans";
  const spacing = page.style.density === "Compact" ? "space-y-10 py-10" : "space-y-14 py-14 sm:space-y-18 sm:py-18";
  const sectionMap = {
    portfolio: <PortfolioSection key="portfolio" page={page} services={services} portfolio={portfolio} onChoose={onChoose} />,
    services: <ServicesSection key="services" page={page} services={services} portfolio={portfolio} onChoose={onChoose} />,
  };

  return (
    <div className={`min-h-full overflow-x-hidden bg-[var(--page-bg)] text-[#172033] ${typography}`} style={variables} data-template={page.template}>
      <Hero page={page} />
      <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${spacing}`}>
        {page.style.sectionOrder.map((section) => sectionMap[section])}
        <footer className="text-center text-xs text-slate-500">
          <a href={QAI_ATTRIBUTION_HREF} className="inline-flex min-h-10 items-center rounded-full px-3 hover:bg-black/5 hover:text-[var(--page-accent)]">Powered by Qai</a>
          {preview && <p className="mt-1">Preview</p>}
        </footer>
      </div>
    </div>
  );
}
