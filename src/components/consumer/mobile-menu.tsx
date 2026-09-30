"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useState } from "react";

/** The mobile menu: the few places a customer goes (no website-style link bar). */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const item = "flex items-center justify-between rounded-2xl bg-surface px-5 py-4 text-[16px] text-ink shadow-[var(--shadow-soft)]";
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="Menu" className="tap-area -ml-1 grid h-9 w-9 place-items-center">
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
        <Dialog.Content className="fixed inset-x-0 top-0 z-50 rounded-b-[28px] bg-canvas px-5 pb-6 pt-4 shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[17px] font-medium">RENUABL</Dialog.Title>
            <Dialog.Close className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Close menu">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Where would you like to go?</Dialog.Description>
          <nav className="mt-4 space-y-2.5">
            <Link href="/" className={item} onClick={() => setOpen(false)}>
              Start with your address <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
            <Link href="/my" className={item} onClick={() => setOpen(false)}>
              My RENUABL <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
            <Link href="/learn" className={item} onClick={() => setOpen(false)}>
              Energy guides <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
            <Link href="/login" className={item} onClick={() => setOpen(false)}>
              Log in <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
          </nav>
          <Link
            href="/partners"
            onClick={() => setOpen(false)}
            className="mt-4 flex items-center justify-between px-1 text-[14px] text-ink-2"
          >
            <span>
              <span className="block text-ink">Become a partner</span>
              <span className="block text-[12.5px] text-muted">For solar installers and retailers</span>
            </span>
            <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
          </Link>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
