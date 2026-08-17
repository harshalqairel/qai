/* eslint-disable @next/next/no-img-element -- Business-owned validation images can be data URLs or protected media URLs. */
"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, AtSign, Clock3, Mail, MapPin, Menu, MessageCircle } from "lucide-react";

import { QaiMark } from "@/components/brand/QaiLogo";
import {
  availableOptionValueIds,
  orderedOptionGroups,
  resolveVariantAfterOptionChange,
  selectionForVariant,
} from "@/features/service/domain/serviceVariants";
import { formatDuration } from "@/features/service/utils/duration";
import {
  normalizedPageSectionOrder,
  normalizeContactPhone,
  publicActionLabel,
  publicPriceLabel,
  publicVariantForId,
  QAI_ATTRIBUTION_HREF,
  type PublicService,
  type QaiPageConfig,
} from "@/features/qai-page/validation";

type RendererProps = {
  page: QaiPageConfig;
  services: PublicService[];
  portfolio: QaiPageConfig["portfolio"];
  onChoose?: (service: PublicService, variantId: string | null) => void;
  preview?: boolean;
};

type PageVariables = CSSProperties & Record<`--page-${string}`, string>;

const NAV_LINKS = ["about", "portfolio", "services"] as const;

function socialHref(value: string): string | null {
  const contact = value.trim();
  if (!contact) return null;
  if (/^https?:\/\//i.test(contact)) {
    try {
      const url = new URL(contact);
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
    } catch {
      return null;
    }
  }
  const handle = contact.replace(/^@/, "");
  return /^[a-zA-Z0-9._]+$/.test(handle) ? `https://instagram.com/${handle}` : null;
}

function PageButton({ children, onClick, secondary = false, className = "" }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; className?: string }) {
  return <button type="button" onClick={onClick} className={`inline-flex min-h-11 items-center justify-center gap-2 border px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] ${secondary ? "border-[var(--page-border)] bg-transparent text-[var(--page-text)] hover:bg-[var(--page-surface)]" : "border-[var(--page-button-bg)] bg-[var(--page-button-bg)] text-[var(--page-button-text)] hover:brightness-95"} ${className}`} style={{ borderRadius: "var(--page-button-radius)" }}>{children}</button>;
}

function Brand({ page, inverse = false }: { page: QaiPageConfig; inverse?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3">{page.logo ? <img src={page.logo} alt={`${page.businessName} logo`} className="size-10 shrink-0 rounded-xl border border-white/20 bg-white object-cover" /> : <QaiMark size="md" tone={inverse ? "light" : "default"} decorative />}<span className={`truncate text-base font-bold ${inverse ? "text-white" : "text-[var(--page-text)]"}`}>{page.businessName}</span></div>;
}

function PageNav({ page, inverse = false }: { page: QaiPageConfig; inverse?: boolean }) {
  const visibleLinks = NAV_LINKS.filter((section) => section === "about" ? page.style.showAbout : section === "portfolio" ? page.style.showPortfolio : page.style.showServices);
  return <nav className={`relative z-20 border-b px-5 sm:px-8 ${inverse ? "border-white/15 bg-[#0b1119]/80" : "border-[var(--page-border)] bg-[var(--page-surface)]/95"}`} aria-label="Public page navigation"><div className="mx-auto flex min-h-18 max-w-[86rem] items-center justify-between gap-5"><Brand page={page} inverse={inverse} /><div className={`hidden items-center gap-7 text-xs font-semibold uppercase tracking-[0.14em] md:flex ${inverse ? "text-white/75" : "text-[var(--page-muted)]"}`}>{visibleLinks.map((section) => <a key={section} href={`#${section}`} className="hover:text-[var(--page-accent)]">{section}</a>)}{page.style.showServices && <a href="#services" className="border px-4 py-2.5 normal-case tracking-normal" style={{ color: "var(--page-button-text)", background: "var(--page-button-bg)", borderColor: "var(--page-button-bg)", borderRadius: "var(--page-button-radius)" }}>Book now</a>}</div><Menu className={`size-5 md:hidden ${inverse ? "text-white" : "text-[var(--page-text)]"}`} aria-hidden="true" /></div></nav>;
}

function ContactLinks({ page, inverse = false }: { page: QaiPageConfig; inverse?: boolean }) {
  if (!page.style.showContact) return null;
  const instagram = socialHref(page.instagram);
  const links = [
    page.whatsapp ? { label: "WhatsApp", href: `https://wa.me/${normalizeContactPhone(page.whatsapp)}`, icon: MessageCircle } : null,
    page.email ? { label: "Email", href: `mailto:${page.email}`, icon: Mail } : null,
    instagram ? { label: "Instagram", href: instagram, icon: AtSign } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Mail }>;
  if (!links.length) return null;
  return <div className="mt-6 flex flex-wrap gap-2">{links.map(({ label, href, icon: Icon }) => <a key={label} href={href} target={label === "Email" ? undefined : "_blank"} rel={label === "Email" ? undefined : "noreferrer"} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${inverse ? "border-white/25 bg-black/20 text-white hover:bg-white hover:text-slate-950" : "border-[var(--page-border)] bg-[var(--page-surface)] text-[var(--page-text)] hover:border-[var(--page-accent)]"}`}><Icon className="size-4" />{label}</a>)}</div>;
}

function HeroText({ page, inverse = false, centered = false, onPrimary }: { page: QaiPageConfig; inverse?: boolean; centered?: boolean; onPrimary?: () => void }) {
  return <div className={`${centered ? "mx-auto text-center" : ""} max-w-3xl`}><p className={`text-xs font-semibold uppercase tracking-[0.2em] ${inverse ? "text-white/65" : "text-[var(--page-accent)]"}`}>Creative services · {page.location || "Available by appointment"}</p><h1 className="mt-5 break-words font-[var(--page-heading-font)] text-4xl font-semibold leading-[.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">{page.businessName}</h1>{page.shortDescription && <p className={`mt-6 max-w-2xl whitespace-pre-wrap text-base leading-7 sm:text-lg ${centered ? "mx-auto" : ""} ${inverse ? "text-white/75" : "text-[var(--page-muted)]"}`}>{page.shortDescription}</p>}<div className={`mt-8 flex flex-wrap gap-3 ${centered ? "justify-center" : ""}`}>{onPrimary && <PageButton onClick={onPrimary}>Book an appointment <ArrowRight className="size-4" /></PageButton>}{page.style.showPortfolio && <PageButton secondary onClick={() => document.getElementById("portfolio")?.scrollIntoView({ behavior: "smooth" })}>View portfolio</PageButton>}</div></div>;
}

function Hero({ page, onPrimary }: { page: QaiPageConfig; onPrimary?: () => void }) {
  const image = page.coverImage;
  if (page.template === "Signature") return <><PageNav page={page} /><header className="mx-auto grid max-w-[86rem] gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:py-20"><HeroText page={page} onPrimary={onPrimary} />{image ? <img src={image} alt="" className="max-h-[35rem] w-full object-contain" /> : <div className="aspect-[7/4] bg-[linear-gradient(135deg,var(--page-surface),var(--page-accent))] opacity-65" />}</header></>;
  if (page.template === "Studio") return <div className="bg-[#090d12] text-white"><PageNav page={page} inverse /><header className="relative isolate mx-auto min-h-[34rem] max-w-[86rem] overflow-hidden lg:min-h-[42rem]">{image ? <img src={image} alt="" className="absolute inset-0 -z-20 size-full object-cover" /> : <div className="absolute inset-0 -z-20 bg-[linear-gradient(115deg,#0a0d11,var(--page-accent),#101826)]" />}<div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/15" /><div className="flex min-h-[34rem] items-end px-5 py-12 sm:px-10 lg:min-h-[42rem] lg:px-14 lg:py-16"><HeroText page={page} inverse onPrimary={onPrimary} /></div></header></div>;
  if (page.template === "Professional") return <div className="bg-[#0b1119] text-white"><PageNav page={page} inverse /><header className="relative isolate min-h-[33rem] overflow-hidden lg:min-h-[41rem]">{image ? <img src={image} alt="" className="absolute inset-0 -z-20 size-full object-cover object-center" /> : <div className="absolute inset-0 -z-20 bg-[linear-gradient(130deg,#071017,var(--page-accent),#1c2736)]" />}<div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-black/10" /><div className="mx-auto flex min-h-[33rem] max-w-[86rem] items-center px-5 py-12 sm:px-8 lg:min-h-[41rem]"><HeroText page={page} inverse onPrimary={onPrimary} /></div></header></div>;
  if (page.template === "Warm") return <div className="bg-[#0b1119] text-white"><PageNav page={page} inverse /><header className="relative isolate min-h-[34rem] overflow-hidden lg:min-h-[44rem]">{image ? <img src={image} alt="" className="absolute inset-0 -z-20 size-full object-cover" /> : <div className="absolute inset-0 -z-20 bg-[linear-gradient(120deg,#111622,var(--page-accent),#3f253c)]" />}<div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/45 to-transparent" /><div className="mx-auto flex min-h-[34rem] max-w-[86rem] items-center px-5 py-12 sm:px-8 lg:min-h-[44rem]"><HeroText page={page} inverse onPrimary={onPrimary} /></div></header></div>;
  if (page.template === "Editorial") return <><PageNav page={page} /><header className="mx-auto max-w-[86rem] px-5 py-10 sm:px-8"><div className="border-y border-[var(--page-border)] py-6 text-center"><HeroText page={page} centered onPrimary={onPrimary} /></div>{image && <img src={image} alt="" className="mt-8 max-h-[42rem] w-full object-contain" />}</header></>;
  return <div className="bg-[#0b1119] text-white"><PageNav page={page} inverse /><header className="relative isolate min-h-[34rem] overflow-hidden lg:min-h-[43rem]">{image ? <img src={image} alt="" className="absolute inset-0 -z-20 size-full object-cover" /> : <div className="absolute inset-0 -z-20 bg-[linear-gradient(120deg,#0a0e16,var(--page-accent),#293b64)]" />}<div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/50 to-black/10" /><div className="mx-auto flex min-h-[34rem] max-w-[86rem] items-center px-5 py-12 sm:px-8 lg:min-h-[43rem]"><HeroText page={page} inverse onPrimary={onPrimary} /></div></header></div>;
}

function Facts({ page }: { page: QaiPageConfig }) {
  if (!page.location && !page.whatsapp && !page.email) return null;
  return <div className="border-y border-[var(--page-border)] bg-[var(--page-surface)]"><div className="mx-auto flex max-w-[86rem] flex-wrap gap-x-10 gap-y-3 px-5 py-5 text-sm text-[var(--page-muted)] sm:px-8">{page.location && <span className="inline-flex items-center gap-2"><MapPin className="size-4 text-[var(--page-accent)]" />Based in {page.location}</span>}{page.whatsapp && <span>Available for enquiries</span>}{page.email && <span>Replies by email</span>}</div></div>;
}

function AboutSection({ page }: { page: QaiPageConfig }) {
  if (!page.style.showAbout || (!page.shortDescription && !page.location)) return null;
  const split = page.template === "Signature" || page.template === "Professional";
  return <section id="about" aria-labelledby="about-heading" className={`${split ? "grid gap-8 lg:grid-cols-[.65fr_1.35fr]" : "max-w-4xl"}`}><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-accent)]">About</p><h2 id="about-heading" className="mt-2 font-[var(--page-heading-font)] text-3xl font-semibold tracking-tight sm:text-4xl">About {page.businessName}</h2></div><div>{page.shortDescription && <p className="whitespace-pre-wrap text-base leading-8 text-[var(--page-muted)] sm:text-lg">{page.shortDescription}</p>}{page.location && <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-[var(--page-accent)]" />{page.location}</p>}<ContactLinks page={page} /></div></section>;
}

function PortfolioSection({ page, services, portfolio, onChoose }: RendererProps) {
  if (!page.style.showPortfolio || portfolio.length === 0) return null;
  const columns = portfolio.length === 1 ? "columns-1 max-w-4xl" : portfolio.length <= 3 ? "columns-1 sm:columns-2" : "columns-2 lg:columns-3";
  return (
    <section id="portfolio" aria-labelledby="portfolio-heading">
      <div className={page.template === "Editorial" ? "border-b border-[var(--page-border)] pb-5" : ""}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-accent)]">Portfolio</p>
        <h2 id="portfolio-heading" className="mt-2 font-[var(--page-heading-font)] text-3xl font-semibold tracking-tight sm:text-4xl">Selected work</h2>
      </div>
      <div className={`mt-7 ${columns} gap-3 sm:gap-5`}>
        {portfolio.map((item, index) => {
          const related = services.find((service) => service.serviceId === item.serviceId);
          return (
            <figure key={item.id} className="mb-3 break-inside-avoid overflow-hidden border border-[var(--page-border)] bg-[var(--page-surface)] sm:mb-5" style={{ borderRadius: page.template === "Editorial" || page.template === "Signature" ? 0 : "1rem" }}>
              <img src={item.imageUrl} alt={item.caption || `${page.businessName} selected work ${index + 1}`} className="h-auto w-full object-contain" loading={index < 2 ? "eager" : "lazy"} />
              {(item.caption || related) && (
                <figcaption className="p-4 sm:p-5">
                  {item.caption && <p className="text-sm leading-6">{item.caption}</p>}
                  {related && onChoose && <button type="button" onClick={() => onChoose(related, related.variants.find((variant) => variant.active)?.id ?? null)} className="mt-2 inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-[var(--page-accent)] hover:underline">View {related.title}<ArrowUpRight className="size-3.5" /></button>}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

function variantLabel(service: PublicService, variantId: string | null): string {
  const variant = publicVariantForId(service, variantId);
  if (!variant) return "";
  return variant.displayLabel || service.optionGroups.flatMap((group) => group.values.filter((value) => variant.optionValueIds.includes(value.id)).map((value) => value.label)).join(" · ");
}

function ServiceCard({ service, compact, onChoose }: { service: PublicService; compact: boolean; onChoose?: RendererProps["onChoose"] }) {
  const activeVariants = service.variants.filter((variant) => variant.active);
  const groups = orderedOptionGroups(service);
  const [variantId, setVariantId] = useState<string | null>(activeVariants[0]?.id ?? null);
  const variant = publicVariantForId(service, variantId);
  const selectedByGroup = selectionForVariant(service, variant);

  function chooseOption(groupId: string, valueId: string) {
    const resolved = resolveVariantAfterOptionChange(service, groupId, valueId, selectedByGroup);
    if (resolved) setVariantId(resolved.id);
  }

  return (
    <article className={`border border-[var(--page-border)] bg-[var(--page-surface)] ${compact ? "p-4 sm:p-5" : "p-5 sm:p-7"}`} style={{ borderRadius: "var(--page-card-radius)" }}>
      <div className={compact ? "grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start" : ""}>
        <div>
          <h3 className={`${compact ? "text-lg" : "text-xl"} break-words font-semibold`}>{service.title}</h3>
          {service.description && <p className={`${compact ? "mt-1 line-clamp-2" : "mt-3"} whitespace-pre-wrap text-sm leading-6 text-[var(--page-muted)]`}>{service.description}</p>}
        </div>
        <div className={compact ? "sm:text-right" : "mt-6"} aria-live="polite">
          <p className="font-bold text-[var(--page-accent)]">{variant ? `Rp ${Math.round(variant.price).toLocaleString("id-ID")}` : publicPriceLabel(service)}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--page-muted)]"><Clock3 className="size-4" />{formatDuration(variant?.duration ?? service.durationMinutes)}</p>
          {variant && <p className="mt-1 text-xs text-[var(--page-muted)]">Selected: {variantLabel(service, variant.id)}</p>}
        </div>
      </div>
      {groups.length > 0 && activeVariants.length > 0 && (
        <div className="mt-5 grid gap-4">
          {groups.map((group) => {
            const activeValues = group.values.filter((value) => value.active);
            const available = availableOptionValueIds(service, group.id, {});
            return (
              <fieldset key={group.id} className="min-w-0">
                <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--page-muted)]">{group.name}</legend>
                {activeValues.length <= 4 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activeValues.map((value) => (
                      <button
                        key={value.id}
                        type="button"
                        aria-pressed={selectedByGroup[group.id] === value.id}
                        disabled={!available.has(value.id)}
                        onClick={() => chooseOption(group.id, value.id)}
                        className="min-h-10 rounded-full border border-[var(--page-border)] px-3 py-1.5 text-sm transition hover:border-[var(--page-accent)] disabled:cursor-not-allowed disabled:opacity-35 aria-pressed:border-[var(--page-accent)] aria-pressed:bg-[var(--page-accent)] aria-pressed:text-white"
                      >{value.label}</button>
                    ))}
                  </div>
                ) : (
                  <select
                    aria-label={group.name}
                    className="mt-2 min-h-11 w-full border border-[var(--page-border)] bg-[var(--page-bg)] px-3 text-sm"
                    style={{ borderRadius: "var(--page-button-radius)" }}
                    value={selectedByGroup[group.id] ?? ""}
                    onChange={(event) => chooseOption(group.id, event.target.value)}
                  >
                    {activeValues.map((value) => <option key={value.id} value={value.id} disabled={!available.has(value.id)}>{value.label}</option>)}
                  </select>
                )}
              </fieldset>
            );
          })}
        </div>
      )}
      {onChoose && <PageButton className="mt-5 w-full sm:w-auto" onClick={() => onChoose(service, variantId)}>{publicActionLabel(service.actionMode)}<ArrowRight className="size-4" /></PageButton>}
    </article>
  );
}

function ServicesSection({ page, services, onChoose }: RendererProps) {
  if (!page.style.showServices) return null;
  const ordered = [...services].sort((left, right) => Number(right.featured) - Number(left.featured) || left.position - right.position);
  const compact = ordered.length > 8;
  return <section id="services" aria-labelledby="services-heading"><div className={page.template === "Signature" ? "text-center" : ""}><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--page-accent)]">Services</p><h2 id="services-heading" className="mt-2 font-[var(--page-heading-font)] text-3xl font-semibold tracking-tight sm:text-4xl">Work with {page.businessName}</h2></div>{ordered.length === 0 ? <div className="mt-6 max-w-xl border border-dashed border-[var(--page-border)] bg-[var(--page-surface)] p-6 text-sm text-[var(--page-muted)]">Services are coming soon. Contact {page.businessName} for current availability.</div> : <div className={`mt-7 grid gap-4 ${compact ? "lg:grid-cols-2" : ordered.length <= 3 ? "lg:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>{ordered.map((service) => <ServiceCard key={service.serviceId} service={service} compact={compact} onChoose={onChoose} />)}</div>}</section>;
}

function ClosingCta({ page, services, onChoose }: RendererProps) {
  const service = services.find((item) => item.featured) ?? services[0];
  if (!service || !onChoose) return null;
  return <section className="grid gap-5 bg-[var(--page-button-bg)] p-6 text-[var(--page-button-text)] sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center" style={{ borderRadius: "var(--page-card-radius)" }}><div><p className="text-xs font-semibold uppercase tracking-[0.15em] opacity-70">Let’s create something thoughtful</p><h2 className="mt-2 font-[var(--page-heading-font)] text-2xl font-semibold sm:text-3xl">Ready to work with {page.businessName}?</h2></div><button type="button" onClick={() => onChoose(service, service.variants.find((variant) => variant.active)?.id ?? null)} className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/40 bg-white px-5 font-semibold text-slate-950" style={{ borderRadius: "var(--page-button-radius)" }}>Book an appointment<ArrowRight className="size-4" /></button></section>;
}

export default function QaiPageRenderer({ page, services, portfolio, onChoose, preview = false }: RendererProps) {
  const ordered = useMemo(() => normalizedPageSectionOrder(page.style), [page.style]);
  const first = services.find((service) => service.featured) ?? services[0];
  const variables: PageVariables = {
    "--page-accent": page.style.accentColor,
    "--page-bg": page.style.backgroundColor,
    "--page-surface": page.style.surfaceColor,
    "--page-text": page.style.textColor,
    "--page-muted": page.style.mutedTextColor,
    "--page-button-bg": page.style.buttonBackgroundColor,
    "--page-button-text": page.style.buttonTextColor,
    "--page-border": page.style.borderColor,
    "--page-button-radius": page.style.buttonStyle === "Editorial" ? "0" : page.style.buttonStyle === "Rounded" ? "0.7rem" : "999px",
    "--page-card-radius": page.style.buttonStyle === "Editorial" ? "0" : page.style.buttonStyle === "Rounded" ? "0.85rem" : "1.2rem",
    "--page-heading-font": page.style.typography.includes("Serif") || page.style.typography === "Editorial" || page.style.typography === "Classic" ? "Georgia, 'Times New Roman', serif" : "inherit",
  };
  const sectionClass = page.style.density === "Compact" ? "space-y-12 py-12 sm:space-y-16 sm:py-16" : "space-y-16 py-16 sm:space-y-24 sm:py-24";
  const sectionMap = {
    about: <AboutSection key="about" page={page} />,
    portfolio: <PortfolioSection key="portfolio" page={page} services={services} portfolio={portfolio} onChoose={onChoose} />,
    services: <ServicesSection key="services" page={page} services={services} portfolio={portfolio} onChoose={onChoose} />,
  };
  return <div className="min-h-full overflow-x-hidden bg-[var(--page-bg)] text-[var(--page-text)]" style={variables} data-template={page.template}><Hero page={page} onPrimary={first && onChoose ? () => onChoose(first, first.variants.find((variant) => variant.active)?.id ?? null) : undefined} /><Facts page={page} /><div className={`mx-auto w-full max-w-[86rem] px-4 sm:px-7 lg:px-10 ${sectionClass}`}>{ordered.map((section) => sectionMap[section])}<ClosingCta page={page} services={services} portfolio={portfolio} onChoose={onChoose} /><footer className="border-t border-[var(--page-border)] pt-8 text-center text-xs text-[var(--page-muted)]"><a href={QAI_ATTRIBUTION_HREF} aria-label="Powered by Qai" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 font-medium hover:bg-black/5 hover:text-[var(--page-accent)]"><QaiMark size="sm" tone="monochrome" decorative />Powered by Qai</a>{preview && <p className="mt-1">Preview</p>}</footer></div></div>;
}
