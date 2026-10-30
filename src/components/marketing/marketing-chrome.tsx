import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonStyles } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";

const navLinks = [
  { href: "/resources", label: "Discover" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/how-it-works#fairness", label: "Fair access" },
];

export async function MarketingHeader() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="rounded-lg" aria-label="LabLoop home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-[0.82rem] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link href="/dashboard" className={buttonStyles({ size: "sm", className: "hidden sm:inline-flex" })}>
              Open dashboard <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonStyles({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={buttonStyles({ size: "sm", className: "hidden sm:inline-flex" })}
              >
                Get started
              </Link>
            </>
          )}
          <details className="relative md:hidden">
            <summary
              className={buttonStyles({ variant: "outline", size: "icon", className: "size-9 cursor-pointer" })}
              aria-label="Open navigation menu"
            >
              <Menu className="size-4" />
            </summary>
            <div className="absolute right-0 top-11 w-60 rounded-2xl border border-border bg-card p-2 shadow-xl">
              <nav aria-label="Mobile primary">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="my-2 h-px bg-border" />
                {user ? (
                  <Link href="/dashboard" className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted">
                    Open dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-muted">
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      className="block rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Get started
                    </Link>
                  </>
                )}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            A trusted sharing layer for the equipment, workspaces and technical skills that
            institutions already own.
          </p>
          <p className="specimen-code mt-5">Fictional demo · Northstar Institute</p>
        </div>
        <div>
          <p className="eyebrow mb-3">Explore</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/resources" className="text-muted-foreground hover:text-foreground">Resource catalog</Link></li>
            <li><Link href="/how-it-works" className="text-muted-foreground hover:text-foreground">How LabLoop works</Link></li>
            <li><Link href="/how-it-works#fairness" className="text-muted-foreground hover:text-foreground">Fair access policy</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">Trust</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/how-it-works#safeguards" className="text-muted-foreground hover:text-foreground">Safeguards</Link></li>
            <li><Link href="/how-it-works#demo" className="text-muted-foreground hover:text-foreground">Demo accounts</Link></li>
            <li><Link href="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-[0.72rem] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 LabLoop — hackathon prototype. Not affiliated with any real institution.</p>
          <p>Human-reviewed access · append-only audit trails</p>
        </div>
      </div>
    </footer>
  );
}
