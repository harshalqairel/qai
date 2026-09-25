import Image from "next/image";
import Link from "next/link";

import LandingMobileNav from "./LandingMobileNav";
import styles from "./LandingExperience.module.css";

const asset = (name: string) => `/landing/${name}.png`;

function Wordmark({ className = "" }: { className?: string }) {
  return <Image src="/landing/qai-wordmark.svg" alt="Qai" width={132} height={47} className={className} />;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export default function LandingExperience() {
  return <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" aria-label="Qai home" className={styles.logoLink}><Wordmark /></Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          <a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#qai-space">Qai Space</a><a href="#pricing">Pricing</a>
        </nav>
        <div className={styles.headerActions}><Link href="/login" className={styles.signIn}>Sign in</Link><Link href="/dashboard" className={styles.headerCta}>Start free</Link></div>
        <LandingMobileNav />
      </div>
    </header>

    <main>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <Eyebrow>Qai for independent businesses</Eyebrow>
          <h1 id="hero-title">From booking to payment, everything stays connected.</h1>
          <p>Bookings, schedules, payments, and invoices stay linked, so you always know what comes next.</p>
          <div className={styles.actions}><Link href="/dashboard" className={styles.buttonPrimary}>Start free</Link><a href="#product" className={styles.buttonSecondary}>See the product</a></div>
        </div>
        <div className={styles.heroVisual}><div className={styles.heroFrame}>
          <Image src={asset("01-dashboard-overview")} alt="Qai dashboard showing today's schedule and client work needing attention" width={1672} height={941} sizes="(max-width: 640px) 700px, (max-width: 1200px) 92vw, 1220px" priority className={styles.heroImage} />
        </div></div>
      </section>

      <section id="product" className={`${styles.storySection} ${styles.bookingSection}`} aria-labelledby="booking-title">
        <div className={`${styles.sectionInner} ${styles.bookingLayout}`}>
          <div id="how-it-works" className={styles.bookingCopy}><Eyebrow>Bookings</Eyebrow><h2 id="booking-title">Keep the whole job connected.</h2><p>Client, service, schedule, payment status, and invoice stay with the same booking.</p></div>
          <div className={`${styles.imageFrame} ${styles.bookingVisual}`}><Image src={asset("02-bookings-payment-overview")} alt="Qai bookings with scheduled jobs and paid, part-paid, and unpaid states" width={1672} height={941} sizes="(max-width: 760px) 700px, (max-width: 1200px) 65vw, 860px" className={styles.screenshot} /></div>
        </div>
      </section>

      <section className={`${styles.storySection} ${styles.calendarSection}`} aria-labelledby="calendar-title">
        <div className={styles.sectionInner}>
          <div className={styles.storyHeading}><Eyebrow>Calendar</Eyebrow><h2 id="calendar-title">Your schedule follows the work.</h2><p>Sessions created from bookings appear in one clear calendar.</p></div>
          <div className={styles.calendarComposition}>
            <div className={`${styles.imageFrame} ${styles.calendarOverview}`}><Image src={asset("03-calendar-month-overview")} alt="Qai monthly calendar showing upcoming booking sessions" width={1672} height={941} sizes="(max-width: 760px) 700px, (max-width: 1200px) 90vw, 1080px" className={styles.screenshot} /></div>
            <div className={`${styles.imageFrame} ${styles.calendarDetail}`}><Image src={asset("04-calendar-month-detail")} alt="Closer view of bookings across the Qai calendar" width={1672} height={941} sizes="(max-width: 760px) 320px, (max-width: 1200px) 38vw, 455px" className={styles.screenshot} /></div>
          </div>
        </div>
      </section>

      <section className={`${styles.storySection} ${styles.invoiceSection}`} aria-labelledby="invoice-title">
        <div className={styles.sectionInner}>
          <div className={styles.storyHeading}><Eyebrow>Payments & invoices</Eyebrow><h2 id="invoice-title">See what&apos;s paid. Follow up on what isn&apos;t.</h2><p>Payments stay linked to the booking. Invoices show the total, paid amount, and balance due.</p></div>
          <div className={styles.invoiceComposition}>
            <div className={`${styles.imageFrame} ${styles.invoiceList}`}><Image src={asset("05-invoices-list")} alt="Qai invoice list showing payment status and remaining balances" width={1672} height={941} sizes="(max-width: 760px) 690px, (max-width: 1200px) 72vw, 860px" className={styles.screenshot} /></div>
            <div className={`${styles.imageFrame} ${styles.invoiceSummary}`}><Image src={asset("07-invoice-preview-payment-summary")} alt="Invoice payment summary with grand total, paid amount, and balance due" width={1448} height={1086} sizes="(max-width: 760px) 340px, (max-width: 1200px) 36vw, 440px" className={styles.screenshot} /></div>
          </div>
        </div>
      </section>

      <section className={`${styles.storySection} ${styles.reportsSection}`} aria-labelledby="reports-title">
        <div className={styles.sectionInner}>
          <div className={styles.storyHeading}><Eyebrow>Reports</Eyebrow><h2 id="reports-title">Know where the money stands.</h2><p>See client total, money received, outstanding payments, expenses, profit, and service performance.</p></div>
          <div className={`${styles.imageFrame} ${styles.reportsVisual}`}><Image src={asset("08-financial-reports-overview")} alt="Qai financial reports with client total, money received, outstanding, expenses, profit, and top services" width={1122} height={1402} sizes="(max-width: 760px) 720px, (max-width: 1200px) 76vw, 820px" className={styles.screenshot} /></div>
        </div>
      </section>

      <section id="qai-space" className={styles.spaceSection} aria-labelledby="space-title">
        <div className={`${styles.sectionInner} ${styles.spaceLayout}`}>
          <div className={styles.spaceCopy}><Eyebrow>Qai Space</Eyebrow><h2 id="space-title">Your services. Your work. Ready to book.</h2><p>Give clients one place to view your services, portfolio, and send a booking request.</p></div>
          <div className={styles.spaceVisual}><Image src={asset("10-qai-space-mobile-luma-studio")} alt="Luma Studio Qai Space showing services, portfolio, and a booking request button" width={863} height={1822} sizes="(max-width: 760px) 72vw, (max-width: 1200px) 35vw, 450px" className={styles.spaceImage} /></div>
        </div>
      </section>

      <section id="pricing" className={styles.closingSection} aria-labelledby="pricing-title">
        <div className={styles.sectionInner}>
          <div className={styles.pricingLine}><div><Eyebrow>Pricing</Eyebrow><h2 id="pricing-title">Start free.</h2></div><p>Create your workspace and set up your services. No plan selection required.</p></div>
          <div className={styles.finalCta}><p>For makeup artists, photographers, studios, tutors, consultants, and other independent service businesses.</p><h2>Ready to run your next booking in Qai?</h2><div className={styles.actions}><Link href="/dashboard" className={styles.buttonPrimary}>Start free</Link><Link href="/login" className={styles.buttonSecondary}>Sign in</Link></div></div>
        </div>
      </section>
    </main>

    <footer className={styles.footer}><div className={styles.sectionInner}><Link href="/" aria-label="Qai home"><Wordmark className={styles.footerLogo} /></Link><span>© {new Date().getFullYear()} Qai</span></div></footer>
  </div>;
}
