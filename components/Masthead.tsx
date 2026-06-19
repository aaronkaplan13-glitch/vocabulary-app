import Link from "next/link";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/words", label: "Deck" },
  { href: "/graph", label: "Roots" },
];

export function Masthead() {
  return (
    <header className="relative z-10 border-b border-line-strong">
      <div className="mx-auto flex max-w-3xl items-baseline justify-between px-5 py-4">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-xl text-ink">Lexicon</span>
          <span className="eyebrow hidden sm:inline">a study of words</span>
        </Link>
        <nav className="flex items-center gap-5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="label-mono text-ink-soft transition-colors hover:text-accent"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
