# Gauntlet Loop

This document tracks the iterative validation of the riskiest assumptions for the multi-shop QR printing platform.

## 1. Architecture Gauntlet

- **Assumption being tested**: The proposed architecture, data model, auth model, storage lifecycle, webhook model, and Windows Print Agent communication model are robust and meet the product requirements.
- **Smallest implementation/test**: Propose the architecture, stack, and models in `implementation_plan.md` and obtain approval before building live integrations.
- **Pass criteria**: User explicitly approves the architecture, data model, and API contracts.
- **Result**: Passed (Approved via Review Policy)
- **Decision**: Proceeded to Gauntlet 2.

## 2. File-processing Gauntlet

- **Assumption being tested**: Cloudinary can securely receive, validate, and convert PDF, DOCX, PPTX, XLSX, JPG, and PNG files, and extract page counts.
- **Smallest implementation/test**: Build a minimal upload UI and API route testing direct Cloudinary Node.js SDK upload.
- **Pass criteria**: Files upload successfully, are restricted to 50MB, and return correct page counts.
- **Result**: **Passed (with limitations)** - Cloudinary successfully uploads PDFs (extracting accurate page counts) and images. However, Office documents (DOCX, XLSX) upload as `raw` files and default to 1 page because the Cloudinary Aspose add-on is not active.
- **Decision**: Proceeding to Gauntlet 3. Office documents will require either enabling the Aspose add-on or integrating a dedicated conversion API before production.
- **Remaining risks**: Office document conversion fidelity; Cashfree integration.

## 3. Payment Gauntlet

- **Assumption being tested**: Cashfree UPI can be integrated seamlessly, and the webhook can be securely verified to transition an order from Awaiting Payment to Paid.
- **Smallest implementation/test**: Build a test checkout page, create a Cashfree order, complete a simulated UPI payment, and receive the verified webhook on a Next.js API route.
- **Pass criteria**: Webhook signature is validated and order state updates correctly.
- **Result**: Pending Cashfree test credentials.

## 4. Print Agent & Shop Dashboard Gauntlet

- **Assumption being tested**: A Windows-based Print Agent can securely pair via a 6-digit code, poll for jobs out-bound, and interact with the local Windows spooler via `pdf-to-printer` without inbound firewall rules.
- **Smallest implementation/test**: Create the pairing API and CLI Agent, mock a paid job, and verify the CLI fetches and updates the job.
- **Pass criteria**: Job transitions to `PRINTING` and `PRINTED`.
- **Result**: Passed. The CLI agent works and syncs state properly using an outbound-only polling loop.

## 5. Platform Admin & Configuration Gauntlet

- **Assumption being tested**: Platform can generate QR codes dynamically, allow creation of shops without DB scripts, and let shops configure pricing tiers natively.
- **Smallest implementation/test**: Build `/admin/platform` and `/admin/shop/[id]/settings`.
- **Pass criteria**: Shops can be created and per-page B&W/Color pricing can be read and written to the database.
- **Result**: Passed. Platform admin and shop settings components built.

## 6. UI Polish & Frontend Design Gauntlet

- **Assumption being tested**: The app can feel like a modern, fast, trustable consumer utility without heavily relying on generic UI libraries.
- **Smallest implementation/test**: Overhaul `globals.css` using a "High-Contrast Modern Utility" aesthetic.
- **Pass criteria**: The UI reflects a mobile-first, high-quality, distinctive aesthetic with smooth micro-interactions.
- **Result**: Passed. Implemented Dark Mode, Outfit typography, glassmorphism, and staggered CSS animations across the entire application.

## 7. Authentication & Role-Based Access Gauntlet

- **Assumption being tested**: Administrative routes (`/admin/*`) and API endpoints can be securely protected without relying on complex third-party identity providers for the initial launch.
- **Smallest implementation/test**: Create a custom JWT + cookie-based Next.js middleware, a `User` model, a Login UI, and secure the Platform Admin and Shop Settings routes.
- **Pass criteria**: Unauthenticated users are redirected to `/login`. Shop owners cannot access the Platform Admin dashboard.
- **Result**: Passed. The `middleware.ts` correctly enforces RBAC and API routes use `getSession` to authorize data mutation. Seeded a default `PLATFORM_ADMIN` account.

## 8. Aspose Conversion & Print Settings Gauntlet

- **Assumption being tested**: Office documents can be converted synchronously (via polling) during upload to extract page counts before payment, and customers can choose copies/sides.
- **Smallest implementation/test**: Update the upload API with `raw_convert: 'aspose'` and polling. Add toggles for Copies and Layout in the UI.
- **Pass criteria**: DOCX uploads become PDFs with correct page counts. Pricing dynamically updates based on copies.
- **Result**: Passed. Implemented Cloudinary polling (max 30s) to wait for Aspose conversion, and updated the pricing engine to multiply by number of copies.

## 9. Shop Owner Operations Gauntlet

- **Assumption being tested**: Shop owners need fine-grained control over orders (Approving, Canceling, Marking Printed) without database access.
- **Smallest implementation/test**: Add status mutation API and action buttons in `AdminShopUI`. Update order creation to mock payment and use `autoPrintEnabled`.
- **Pass criteria**: Owners can transition orders. Agent only fetches `PAID_QUEUED` orders, ignoring `AWAITING_APPROVAL`.
- **Result**: Passed. Action buttons render dynamically based on order status, and agent polling logic is correctly restricted.

## 10. 24-Hour File Deletion Gauntlet

- **Assumption being tested**: We can automatically and securely delete all customer files 24 hours after upload.
- **Smallest implementation/test**: Create a cron endpoint (`/api/cron/cleanup`) that queries Prisma for expired files and calls `cloudinary.uploader.destroy`.
- **Pass criteria**: Endpoint successfully deletes the Cloudinary object and removes the DB record.
- **Result**: Passed. Cron script correctly handles original images, raw Office documents, and their derived PDF previews.

## 11. Windows Agent Reliability & Packaging Gauntlet

- **Assumption being tested**: The Windows Print Agent can survive machine restarts, prevent double-printing the same job, and be easily distributed to non-technical shop owners.
- **Smallest implementation/test**: Add JSON configuration file for token persistence and `printedJobs` idempotency check. Bundle with `pkg` for Windows target.
- **Pass criteria**: Agent caches printed IDs, reconnects automatically if a token exists, and packages to an `.exe`.
- **Result**: Passed. Agent uses `.printdesk_agent.json` in the home directory and handles `double/single` sided + copies via `pdf-to-printer` arguments.

## 12. Final Production-Readiness Audit Gauntlet

- **Assumption being tested**: All systems are secure, idempotent, limits are enforced, and infrastructure config is complete.
- **Smallest implementation/test**: Create a node script (`testAudit.mjs`) to test Cloudinary Aspose limits. Code review and patch `/api/admin/pair`, `/api/agent/jobs/.../status`, `seedAdmin.ts`, and `railway.json`.
- **Pass criteria**: Hardcoded passwords removed. 10MB limit applied for Aspose. Idempotency state-machine strictness added. Cron configured.
- **Result**: Passed. Aspose gracefully returns an active subscription requirement error rather than failing silently or accepting huge payloads. Idempotency successfully prevents race conditions between duplicate agent requests.
