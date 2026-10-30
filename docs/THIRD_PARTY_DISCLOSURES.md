# Third-party disclosures

LabLoop application code is original work. It depends on the open-source
packages below. Versions are the ranges declared in `package.json`; the exact
resolved versions are recorded in `package-lock.json`.

No third-party runtime service (Supabase, Vercel, email, analytics, object
storage, payment) is used by the runnable build. No stock photography or
third-party illustration is included. Listing artwork is CSS/SVG generated in
the repository.

## Runtime dependencies

| Package | Declared version | License | Use |
| --- | --- | --- | --- |
| `next` | 16.4.3 | MIT | App Router, rendering, Server Actions |
| `react` | 19.3.0 | MIT | UI runtime |
| `react-dom` | 19.3.0 | MIT | DOM renderer |
| `better-sqlite3` | ^13.0.3 | MIT | Persistent SQLite driver |
| `zod` | ^4.6.7 | MIT | Form and boundary validation |
| `lucide-react` | ^1.65.0 | ISC | Icon set |
| `@radix-ui/react-slot` | ^1.5.0 | MIT | Button `asChild` composition |
| `clsx` | ^2.1.1 | MIT | Conditional class strings |
| `tailwind-merge` | ^3.7.0 | MIT | Class conflict resolution |
| `server-only` | ^0.0.1 | MIT | Guard against client import of server auth/DB |
| `@fontsource-variable/manrope` | ^5.3.0 | OFL-1.1 | Bundled Manrope variable font |
| `@fontsource-variable/newsreader` | ^5.3.0 | OFL-1.1 | Bundled Newsreader variable font + italic |
| `@fontsource-variable/jetbrains-mono` | ^5.3.0 | OFL-1.1 | Bundled JetBrains Mono variable font |

## Development and test dependencies

| Package | Declared version | License | Use |
| --- | --- | --- | --- |
| `typescript` | ^5 | Apache-2.0 | Type checking |
| `@types/node` | ^24.10.1 | MIT | Node type definitions |
| `@types/react` | ^19 | MIT | React type definitions |
| `@types/react-dom` | ^19 | MIT | React DOM type definitions |
| `@types/better-sqlite3` | ^7.6.13 | MIT | SQLite type definitions |
| `eslint` | ^9 | MIT | Linting |
| `eslint-config-next` | 16.4.3 | MIT | Next.js lint rules |
| `tailwindcss` | ^4 | MIT | Styling |
| `@tailwindcss/turbopack` | ^4 | MIT | Tailwind loader for Turbopack |
| `vitest` | ^5.0.5 | MIT | Unit/integration test runner |
| `@playwright/test` | ^1.64.1 | Apache-2.0 | Browser end-to-end tests |
| `tsx` | ^4.20.6 | MIT | TypeScript script runner |

## Fonts

Manrope, Newsreader and JetBrains Mono are distributed through Fontsource under
the **SIL Open Font License 1.1**. The font files are bundled locally; the app
does not call Google Fonts or another font CDN at runtime. OFL permits bundling
and redistribution; retain the license notices included in the Fontsource
packages when redistributing the fonts.

## Icons

Lucide is licensed under **ISC**. Icons are imported as React components from
`lucide-react`. No custom icon font or external sprite service is used.

## Test browser

Playwright downloads a Chromium build for tests. Chromium and its components are
covered by their own BSD-style and third-party licenses. The browser is a test
tool and is not distributed as part of the application. Playwright itself is
Apache-2.0.

## Scaffolding and conventions

The repository follows Next.js `create-next-app` conventions (App Router,
TypeScript, ESLint, Tailwind). The generated starter README was replaced with
project documentation. Next.js is MIT-licensed. No tutorial code, template
theme, UI kit or stock asset was copied into the product.

## Transitive dependencies

`package-lock.json` pins transitive packages. A production distribution should
run its own license scan (for example `npm ls --all` plus an SBOM/license tool)
and retain the license texts shipped in each package. This document lists direct
dependencies and the assets used in the product; it is not a legal opinion.

## Services deliberately not used or claimed

- **Supabase** — schema/RLS SQL is prepared in `supabase/`; no project, SDK
  connection or verification exists.
- **Vercel** — no deployment, CLI login or project exists.
- **Supabase Storage / S3 / Cloudinary** — no upload or bucket exists.
- **Email/SMS/push providers** — notifications are in-app database rows only.
- **Analytics, session replay, advertising** — none.
- **Maps/geolocation** — locations are plain text; no map API.
- **AI/LLM APIs** — none at runtime.

## Trademarks

Next.js and Vercel are trademarks of their respective owners. Supabase is a
trademark of Supabase Inc. LabLoop and Northstar Institute of Applied Technology
are fictional names used for this hackathon project. No affiliation or
endorsement is claimed.
