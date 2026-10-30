# LabLoop documentation

Start with the [README](../README.md). These documents separate verified
behavior from prepared work.

| Document | Read it for |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Runtime, data model, lifecycle, eligibility, integrity layers, Supabase port plan |
| [Testing](TESTING.md) | Test inventory, coverage mapping, commands, verified results, untested areas |
| [Security](SECURITY.md) | Threat model, authn/authz, controls, known limits, RLS verification matrix |
| [Fairness](FAIRNESS.md) | Allocation rules, waitlist mechanics, reasons, risks, policy gaps |
| [Demo](DEMO.md) | Judge walkthrough, demo accounts, seeded state, reset |
| [Hackathon report](HACKATHON_REPORT.md) | Problem, solution, decisions, evidence, limitations, claim boundaries |
| [Third-party disclosures](THIRD_PARTY_DISCLOSURES.md) | Dependencies, licenses, assets, services not used |
| [Changelog](CHANGELOG.md) | What changed in 1.0.0 |
| [Codex handoff](CODEX_HANDOFF.md) | Continuation plan, verification contract, deployment and Postgres work |

Also see [`../supabase/README.md`](../supabase/README.md) for the prepared,
unapplied PostgreSQL/RLS path.

**Status reminder:** local SQLite build only. No public deployment. Supabase
migrations have never been executed against PostgreSQL.
