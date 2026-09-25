"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import styles from "./LandingExperience.module.css";

export default function LandingMobileNav() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  function close() { setOpen(false); }

  return (
    <div className={styles.mobileNav} onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        close();
        toggleRef.current?.focus();
      }
    }}>
      <button ref={toggleRef} type="button" className={styles.menuToggle} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="landing-mobile-menu" onClick={() => setOpen(!open)}>
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      {open && <nav id="landing-mobile-menu" className={styles.mobileMenu} aria-label="Mobile navigation">
        <a href="#product" onClick={close}>Product</a>
        <a href="#how-it-works" onClick={close}>How it works</a>
        <a href="#qai-space" onClick={close}>Qai Space</a>
        <a href="#pricing" onClick={close}>Pricing</a>
        <Link href="/login" onClick={close}>Sign in</Link>
        <Link href="/dashboard" onClick={close}>Start free</Link>
      </nav>}
    </div>
  );
}
