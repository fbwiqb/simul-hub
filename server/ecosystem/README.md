# Hosted ecosystem assessment

This module uses the existing simul-hub Vercel project and existing grading-system Supabase project. It does not create a provider project. The public entry is /ecosystem-equilibrium/; all authenticated requests use the single /api/ecosystem function.

The server verifies the Google user before calling the service-role-only public.eco_gateway. All assessment data lives in the unexposed eco2026 schema. Cases, solutions, enrollment and account keys must never be placed in the static frontend or committed as seed data. Server credentials use the ECO_ provider environment variables. OAuth uses app-specific HTTP-only cookies and preserves other apps' sessions and shared Auth settings.

Student access depends on the database clock, the student's section window, and terminal submission state on every read/write. The first chain and each of six direction/reason answers are immutable. Responses disclose only confirmed frames. Drafts use revision checks; retries of the same confirmed answer are idempotent. Cohort opening cannot reopen submitted attempts. A teacher can extend an incomplete student's time with an audited reason.

Approved teachers see assigned sections; the initial administrator can approve Google accounts and assign sections. The teacher demo stays in browser memory and never writes student attempts. Original JSON export contains enrollment snapshots, windows, cases/model versions, answers, essays and audit records. CSV is intended for grading; it is not a full backup.

Before retiring this temporary assessment, download and independently verify the original export outside Supabase and retain the program/schema and illustrations with it. Remove only this module's resources. Shared Auth identities, other applications, and their records must remain.

Checks: npm test; server/ecosystem/regression.sql executes synthetic cases and rolls back. Browser fixture harnesses live outside this deployable repository. The static frontend contains no model bank. .vercelignore excludes server SQL, tests and local session notes.
