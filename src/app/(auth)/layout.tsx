import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="absolute inset-0 grid-paper opacity-60" aria-hidden />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="LabLoop home" className="rounded-lg">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/resources"
            className="rounded-lg px-3 py-2 text-[0.78rem] font-semibold text-muted-foreground hover:text-foreground"
          >
            Browse resources
          </Link>
        </div>
      </header>
      <main id="main" className="relative z-10 flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        {children}
      </main>
      <footer className="relative z-10 px-5 py-4 text-center text-[0.68rem] text-muted-foreground">
        Fictional demonstration institution · Northstar Institute of Applied Technology
      </footer>
    </div>
  );
}
