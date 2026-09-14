# Workforce Management — Employer App Port (Implementation Plan)

Status: **ALL 6 PHASES COMPLETE** (Foundation, Core Requirement Loop, Deployments Confirm/Reject, Attendance Reporting, Invoices/Payments, Wiring & Polish). Final whole-system verification passed: `shared-mobile` 25/27 suites, 329/330 tests (same 2 pre-existing unrelated failures as every prior phase — `workerApi.test.ts`, `authService.test.ts`); all 11 i18n locales carry 211 byte-identical `wf_*` keys with zero drift; `tsc --noEmit` across both packages shows the workforce/dashboard/profile/navigation surface contributing only the confirmed-benign `TS2322`/`TS2786` IntrinsicAttributes pattern. One real cross-phase bug was caught and fixed during Phase 6 (see Final Verification Summary at the bottom of this doc). No deploy has occurred — this port produces no shippable artifact by itself.

## Corrections discovered during Phase 1 (apply these facts in all later phases)

1. **Deployment reject** accepts an optional `{ reason }` body field (stored server-side as `deployment.notes`) — not just a bare `PUT` with no body.
2. **PaymentSubmission.status enum is `'Submitted' | 'Verified' | 'Rejected'`** — never `'Pending'`. Mobile UI must map `'Submitted'` → the `wf_payment_pending_verification` copy exactly like the CRM does.
3. **`recordSummaryAttendance` has a 3rd response branch**: if the cycle is Locked and an entry already exists, it returns HTTP 201 with `{ correction, message }` (a pending-approval correction, not yet applied) instead of `{ attendance }`. The Report Attendance screen must handle this branch and show the returned `message` to the employer, not assume every 201 means "saved."
4. `workforceRequirementsApi.updateStatus`'s route is confirmed exactly `PUT /api/v1/workforce-requirements/:id/status`.

## 0. Goal

Everything a private-workforce Employer can already do in the CRM web app must become possible from the **employer-app** (React Native/Expo), in a way that matches this codebase's existing quality bar: professional UI, full 11-language i18n coverage, good performance (caching/pagination/skeletons), and full responsiveness across device sizes. Backend requires **zero changes** — every endpoint the mobile app needs already exists, is deployed, and is already role-gated to accept Employer calls (built and hardened over the CRM work). This is a **mobile-only, additive port.**

## 1. Where the code goes (confirmed via research)

`employer-app/` on disk is a thin shell — real screens/API/theme/i18n all live in the sibling package `packages/shared-mobile/src/`, shared with `agent-app/`. All new code goes there:

- New feature folder: `packages/shared-mobile/src/features/workforce/screens/` (+ `components/` if a screen needs sub-components not worth sharing globally).
- New API modules: `packages/shared-mobile/src/core/api/endpoints/` — one file per backend resource family, mirroring the existing `requirementsApi.ts`/`attendanceApi.ts` style (typed payloads, thin async wrapper functions over the shared `apiClient`, `.then(r => r.data)`, defensive normalization of response envelopes).
- Route registration: `employer-app/src/navigation/types.ts` (add param types) + `employer-app/src/navigation/AppNavigator.tsx` (add `<Stack.Screen>` entries) — this is the ONLY employer-app-local file set that needs touching for navigation.
- i18n strings: `packages/shared-mobile/src/core/i18n/locales/employer/{en,hi,mr,gu,ta,te,kn,ml,bn,or,pa}.ts` — every new string added to **all 11 files**, `employer` namespace, new key prefix `wf_*` (Workforce) to avoid collisions.

## 2. Backend endpoints being consumed (all pre-existing, no backend work)

| Resource | Base path | Notes |
|---|---|---|
| Client Company | `/api/v1/client-companies` | `GET /me` — resolves whether this employer has a linked private-workforce company at all (gate for showing the feature) |
| Sites | `/api/v1/sites` | `GET /mine` (list), `POST /mine` (self-service create) |
| Private Requirements | `/api/v1/workforce-requirements` | `GET /mine`, `POST /`, `GET /:id`, `PUT /:id/status` (cancel), attachments sub-routes |
| Deployments | `/api/v1/deployments` | `GET ?requirementId=`, `PUT /:id/confirm`, `PUT /:id/reject` |
| Attendance | `/api/v1/deployment-attendance` | `GET /cycle`, `POST /summary` (Employer-allowed), `GET /` (list) — Daily/lock/correction-approve stay CRM-only, must 403 correctly if ever hit (won't be, since mobile never calls them) |
| Client Invoices | `/api/v1/client-invoices` | `GET ?clientCompanyId=`, `GET /:id` |
| Payments | `/api/v1/payment-submissions` | `POST /` (multipart, proof upload), `GET ?invoiceId=`, `GET /refunds?invoiceId=`, `GET /ledger?clientCompanyId=` |
| Workforce master data | `/api/v1/workforce` | `GET /work-types`, `GET /sub-work-types?workTypeId=`, `GET /skill-tags` — Employer-readable (`canReadWorkforceCatalog`), Active-only filtered server-side |

## 3. Screens to build (mapped 1:1 to CRM employer surfaces, with the existing screen to clone/adapt)

| # | Screen | CRM equivalent | Mobile template to clone | Key notes |
|---|---|---|---|---|
| 1 | **WorkforceHomeScreen** (or fold into #2 if no linked company) | Sidebar "Workforce Requests" section | New, simple | Entry point; shows empty-state ("Not set up yet — contact your account manager") if `GET /client-companies/me` returns null |
| 2 | **MyWorkforceRequirementsScreen** | `MyWorkforceRequirementsPage.jsx` | `PostRequirementScreen`'s list view / `RequirementDetail` list patterns | `useInfiniteQuery` + `FlatList`, status chips, pull-to-refresh, FAB/header "+" → screen 3 |
| 3 | **NewWorkforceRequirementScreen** | `NewWorkforceRequirementPage.jsx` | `PostRequirementScreen` (public) form shape | Work Type/Sub Type/Skill Tags from master-data API (searchable `FormSelect`), Site picker (with inline "+ Add Site" → opens screen 4 as a sheet), all fields from the web form ported 1:1 |
| 4 | **AddSiteSheet** (modal, not a full screen) | `SiteFormDialog.jsx` (mine mode) | `LocationSelector` + `FormInput` combo, `AppSheet` | Self-service create, defaults Active, immediately usable in the requirement form |
| 5 | **WorkforceRequirementDetailScreen** | `WorkforceRequirementDetailPage.jsx` | `RequirementDetailScreen` | Shows requirement fields, Cancel action (Submitted/UnderReview only) — **must surface the exact backend error message verbatim** when cancel is blocked by outstanding balance, not a generic failure toast |
| 6 | **DeploymentsSection** (embedded in screen 5, not standalone) | `DeploymentsSection.jsx` (mode="employer") | `RequirementInvitationsScreen`'s accept/reject card pattern | Worker card + status chip + KYC chip + Police-Verification chip + Confirm/Reject buttons (Proposed only) + "Report Attendance" button (Deployed/Active/Inactive) — **Confirm/Reject must go through a confirmation modal** (`AppAlertModal`), matching the CRM's confirmation-dialog requirement |
| 7 | **ReportAttendanceSheet** (modal) | `AttendanceDialog.jsx` (mode="employer") | `EmployerAttendanceScreen.tsx` — near-identical, reuse wholesale | Summary-only (no Daily tab, no lock/unlock, no correction-approve — Employer scope only), Days Present / OT Hours / Reported By / Remarks, month picker |
| 8 | **MyInvoicesScreen** | `MyInvoicesPage.jsx` → `InvoicesSection.jsx` | `TransactionScreen.tsx` list pattern | List + ledger summary strip (Invoiced/Verified Paid/Outstanding/Credit Balance) from `GET /ledger` |
| 9 | **InvoiceDetailScreen** | `InvoiceDetailDialog.jsx` (mode="employer") | `RequirementDetailScreen` + `DocumentHubScreen`'s upload modal | Line items, totals, "Submit Payment" → screen 10, payment-submissions list with status chips (**"Pending Verification" — never "Paid" — until Finance verifies; this exact wording is a non-negotiable product rule, ported from Requirement #16**) |
| 10 | **SubmitPaymentSheet** (modal) | `PaymentSubmissionDialog.jsx` | `DocumentHubScreen.tsx`'s `UploadModal` cloned closely | Amount/date/mode/UTR fields + `expo-image-picker`/`expo-document-picker` for proof, multipart upload via new `paymentSubmissionsApi.submitPayment()`; copy must say "pending verification," never imply paid |

## 4. New API modules (`packages/shared-mobile/src/core/api/endpoints/`)

- `clientCompaniesApi.ts` — `getMyCompany()`
- `sitesApi.ts` — `getMySites()`, `createMySite(payload)`
- `workforceRequirementsApi.ts` — `listMine(params)`, `create(payload)`, `getById(id)`, `updateStatus(id, status)`, attachments CRUD
- `deploymentsApi.ts` — `listForRequirement(requirementId)`, `confirm(id)`, `reject(id)`
- `deploymentAttendanceApi.ts` — `getCycle(clientCompanyId, month)`, `submitSummary(payload)`, `list(deploymentId, cycleId?)`
- `clientInvoicesApi.ts` — `listMine(clientCompanyId)`, `getById(id)`
- `paymentSubmissionsApi.ts` — `submit(formData)`, `listForInvoice(invoiceId)`, `listRefunds(invoiceId)`, `getLedger(clientCompanyId)`
- `workforceMasterApi.ts` — `getWorkTypes()`, `getSubWorkTypes(workTypeId)`, `getSkillTags()`

Each gets a matching `*Api.test.ts` under `packages/shared-mobile/src/__tests__/api/`, matching the existing axios-mock-adapter convention — this is the established, realistic test bar for this codebase (no screen-level RTL tests exist today; not introducing that norm here either).

## 5. Navigation & entry points (Decision D1 — made autonomously, not blocking on approval)

Add **both**, for discoverability (matches how the CRM surfaces it in the sidebar, which is always-visible):
1. A new `MenuItem` in `ProfileScreen.tsx`, role-gated `user?.role === 'employer'` — "Private Workforce" / `wf_menu_label`.
2. A new `QuickActionCard` on `EmployerDashboardScreen.tsx` (only rendered if `GET /client-companies/me` resolves non-null — avoids advertising a feature the employer can't use yet).

Both navigate to `MyWorkforceRequirementsScreen` (screen #2), which itself shows the "not set up" empty state if needed (so the Profile menu item can stay unconditional — simpler — while the Dashboard tile is conditional for a cleaner default dashboard).

## 6. Decisions made autonomously (no permission sought, per instruction — flagged here for visibility when reviewed later)

- **D1 (above)**: dual entry point (Profile menu + conditional Dashboard tile).
- **D2 — Plan gating**: Workforce Management access is **NOT gated by the employer's marketplace subscription tier** (Individual/Contractor/Agency/Industry). It's a separate, private B2B arrangement — access is purely "does this employer have a linked `ClientCompany`," exactly mirroring the CRM's `hasWorkforceClientCompany` pattern. No `usePlanFeatures()` lock-wall applied here.
- **D3 — No-company state**: shown as a full empty-state screen (copy matches CRM's "Not set up yet — contact your account manager"), not a hidden/disabled menu item — so the employer discovers the feature exists and knows who to ask, consistent with the CRM's own choice here.
- **D4 — Payment proof upload**: reuse `DocumentHubScreen.tsx`'s upload-modal pattern verbatim (picker → preview → multipart POST with a `document` field), not a new pattern.
- **D5 — Testing bar**: one `*Api.test.ts` per new endpoint module (matches 100% of existing API-layer test coverage in this codebase). No new screen-level test convention introduced (none exists today for any feature, including the ones being cloned as templates). "End-to-end" for this codebase means a manual smoke pass on a signed debug/preview build on a real device — there is no Detox/Maestro e2e runner in this repo to hook into.
- **D6 — Confirm/Reject needs a confirmation step**: ports the CRM's confirmation-dialog requirement (added earlier this session per explicit user request) using `AppAlertModal`, not a bare button tap.
- **D7 — Non-negotiable copy rules ported forward** (must not regress on mobile):
  - A payment submission is a CLAIM, never shown as "Paid" — always "Pending Verification" until Finance verifies (Requirement #16, the single hardest rule in the whole PRD).
  - Cancelling a requirement while an outstanding balance exists must be blocked with the backend's exact message surfaced to the user, not swallowed into a generic error toast.
  - Worker's internal pay rate must never be displayed to the Employer (already stripped server-side by `sanitizeDeploymentForEmployer`/`sanitizeForEmployer` — mobile screens simply must not assume or render any such field even if a stray extra field ever leaked through).
  - This module stays visually and structurally separate from the public marketplace requirement flow — never mixed into the same list/screen as public job postings.

## 7. i18n plan

- New key prefix: `wf_*`, in the existing `employer` namespace (`useTranslation('employer')`).
- Every screen's copy (labels, buttons, empty states, status labels, error messages, the "Pending Verification" wording) gets a key added to **all 11** locale files (`en, hi, mr, gu, ta, te, kn, ml, bn, or, pa`) at the same time a string is introduced — never landed English-only "to translate later."
- Status/label maps (requirement status, deployment status, payment status) follow the existing `returnObjects: true` array/object convention already used for weekday/month names elsewhere.

## 8. UI/UX & performance conventions to follow (matching existing app, not inventing new patterns)

- `ScreenHeader` for every screen's top bar (back button + title), `StatusBar barStyle="light-content"`.
- `AppButton`, `AppCard`, `AppInput`, `FormInput`/`FormSelect`/`FormDateTimePicker`, `EmptyState`, `ErrorState`, `Skeleton`/`SkeletonCard`, `Badge`/status chips, `AppSheet` for all modals — no new component primitives invented unless a screen genuinely needs one (e.g. a Worker-card-with-Confirm/Reject variant, built as a local component next to screen #6).
- Lists: `useInfiniteQuery` + `FlatList` (`onEndReached`/`onEndReachedThreshold=0.3`) + `RefreshControl` tied to `query.isFetching`, matching every existing list screen.
- Brand tint: employer app's `BRAND = '#1037A4'` used for primary actions/headers, consistent with every other employer screen (not the CRM's `#1e3a5f`/`#2563eb` gradient — that's a web-only convention; mobile has its own established brand color already).
- `expo-image` for any remote images (worker photos if ever shown), not RN `Image`.
- React Query cache defaults (`staleTime: 60s`, persisted via AsyncStorage) apply automatically — no bespoke caching needed per screen.

## 9. Build order (for when implementation actually starts)

1. **Foundation**: all 8 new API modules + their tests; i18n key scaffolding (empty/placeholder-free — real copy from day one) across all 11 locales.
2. **Core loop**: MyWorkforceRequirementsScreen → NewWorkforceRequirementScreen → AddSiteSheet → WorkforceRequirementDetailScreen (nothing else is reachable without this working first).
3. **Deployment lifecycle**: DeploymentsSection (embedded) with Confirm/Reject + confirmation modal + KYC/Police-Verification display.
4. **Attendance**: ReportAttendanceSheet.
5. **Money**: MyInvoicesScreen → InvoiceDetailScreen → SubmitPaymentSheet (the most sensitive piece — extra care on the "Pending Verification" copy and proof-upload reliability).
6. **Wiring & polish**: navigation entries (Profile menu + Dashboard tile), full-device manual smoke pass across the whole flow end-to-end, verify all 11 languages render without truncation/overflow on a real device, verify offline/slow-network behavior (React Query retry/backoff already handles this, just needs verification, not new code).

## 10. Explicit non-goals for this port

- No backend changes of any kind.
- No changes to the public marketplace requirement flow.
- No Daily attendance entry, no cycle lock/unlock, no correction-approval on mobile — Employer-scope only, exactly matching what the web CRM allows an Employer to do (nothing more).
- No plan-gating tie-in to marketplace subscription tiers (see D2).
- No deploy of any kind until explicitly instructed — this plan produces no shippable artifact by itself.

## 11. Final Verification Summary (Phase 6, 2026-09-14)

**Dashboard tile.** Added a "Private Workforce" entry point to `EmployerDashboardScreen.tsx`, matching the existing full-width "strip" pattern used by the Calendar/Analytics/Agreement entry points (the plan's Section 5 called this a "QuickActionCard grid," but that literal `QuickActionCard` component is dead code never rendered anywhere in this file or the codebase — the actual established convention for this class of dashboard entry point is the `calStrip`-styled `TouchableOpacity` row, which this tile now matches exactly: same icon-wrap/title/subtitle/chevron layout, same `theme.colors.card`/`border` theming). Gated on `clientCompaniesApi.getMyCompany()` via a `useQuery` with the query key `['wf-my-company']` — identical to the key `MyWorkforceRequirementsScreen`/`MyInvoicesScreen` already use, so the cache is shared and no duplicate network call fires when the employer taps through. Renders nothing when the company resolves null, per D1/D3.

**Whole-system test run.** `packages/shared-mobile`: 25/27 suites, 329/330 tests — identical to the baseline maintained through every prior phase (the same 2 pre-existing, unrelated failures: `workerApi.test.ts`, `authService.test.ts`). `employer-app`: 4 of 5 smoke suites pass (49/49 individual tests). `AppNavigator.test.tsx` currently fails to run, but **not because of anything in this port** — `AppNavigator.tsx` imports `PromotionOverlay.tsx` (the separate Promotions/Festival-Wishes feature, unrelated to workforce management), which imports `expo-video`/`expo-audio`; `employer-app`'s jest `moduleNameMapper` has no mock for either package, so the real native module loads under Jest and throws (`Cannot read properties of undefined (reading 'prototype')`). None of the 6 workforce phases touched `AppNavigator.tsx`'s promotion wiring or the jest config, so this pre-existing gap was left as-is (out of scope for this port) and is flagged here for separate follow-up.

**`tsc --noEmit`.** Both packages still carry the large pre-existing "noisy tsc outside the real build pipeline" error volume (13,104 lines in `shared-mobile`, 14,173 in `employer-app`, spanning many codes — `TS2322`, `TS2786`, `TS2304`, `TS2593`, `TS2708`, etc. — none of it new). Narrowing to every file touched across all 6 phases (`features/workforce/**`, `EmployerDashboardScreen.tsx`, `ProfileScreen.tsx`, both `navigation/types.ts` files, `AppNavigator.tsx`): every error on those files' own touched lines is exclusively the confirmed-benign `TS2322`/`TS2786` IntrinsicAttributes pattern. `EmployerDashboardScreen.tsx` and `ProfileScreen.tsx` do carry other error codes (`TS18048`, `TS2749`, `TS2559`, `TS7006`, `TS2339`, `TS2532`, `TS2769`, `TS2551`, `TS2305`) but every instance was traced to unrelated, pre-existing lines far from anything the workforce port touches (verified by line number).

**Real bug found and fixed (cross-phase catch).** `AddSiteSheet.tsx` (built in Phase 2) calls `t('wf_address_line1_label')` and `t('wf_address_line2_label')` for the two site-address fields — neither key was ever added to any of the 11 locale files, in any phase. Since no phase's individual i18n review caught it (each phase checked only its own new keys, not a full accumulated cross-reference), every employer in every one of the 11 languages would have seen the literal strings `wf_address_line1_label` / `wf_address_line2_label` rendered as the field labels in the Add Site sheet. **Fixed**: both keys added to all 11 locale files with real translations (`Address Line 1` / `Address Line 2`, localized).

**i18n completeness audit (all 5+6 phases combined).** Every one of the 11 locale files under `core/i18n/locales/employer/` now carries exactly **211** `wf_*` keys (208 baseline + `wf_dashboard_strip_sub` for the new tile + the 2 fixed address-line keys above), and the key sets are byte-for-byte identical across all 11 — verified by diffing the sorted key list of each locale against `en.ts` (zero output, no diffs). Every `t('wf_...')`/`i18n.t('wf_...')` call found under `features/workforce/`, `ProfileScreen.tsx`, and `EmployerDashboardScreen.tsx` was cross-checked against the defined key set: zero unresolved references remain (the 2 found above are now fixed).

**Cross-phase navigation check.** `MyWorkforceRequirements`, `NewWorkforceRequirement`, `WorkforceRequirementDetail`, `MyWorkforceInvoices`, `WorkforceInvoiceDetail` are registered consistently, with matching param types (`undefined` or `{ id: string }`), across all three files: `packages/shared-mobile/src/app/navigation/types.ts`, `employer-app/src/navigation/types.ts`, and `employer-app/src/navigation/AppNavigator.tsx` (imports + `<Stack.Screen>` entries). No drift found.

**Local bundler sanity check — RAN, PASSED.** `npx expo export --platform android --output-dir <scratchpad dir> --no-minify --no-bytecode` from `employer-app/` (local static export only — no signing, no AAB/APK, no `expo prebuild`, nothing published anywhere). Metro bundled all 1,897 modules in ~11.5s with zero "unable to resolve module" errors, confirming every import path across all new workforce files and every modified dashboard/profile/navigation file resolves correctly at bundle time. Output was written to a throwaway temp directory outside the repo.

**ProfileScreen menu.** Read back the employer menu section: "Private Workforce" (Phase 2) and "Invoices" (Phase 5) sit adjacently, both gated on `user?.role === 'employer'`, positioned consistently alongside the pre-existing employer-only siblings above them (Subscription, Transactions, My Activity, Call History, Viewed Contacts) and immediately before Notification Settings. An inline comment already documents why they're two flat top-level items rather than a nested drill-down menu, matching the file's one existing precedent (Subscription vs. Transactions). No awkward insertion.
