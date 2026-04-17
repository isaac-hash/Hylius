# Implementation Plan - Hylius Dashboard UI Enhancement

Refactor the Hylius platform UI to elevate the design to a premium, "Obsidian" aesthetic. This involves moving to a sidebar-based navigation for all dashboard pages, enhancing the servers and billing views, and ensuring UI consistency between user and admin panels.

## User Review Required

> [!IMPORTANT]
> **Navigation Change**: Dashboard-related pages will move from a top-bar navigation to a persistent left-hand sidebar. The homepage will retain its top-bar for a clean landing experience.
> **Admin Panel Consistency**: The Admin dashboard will be updated to use the same glassmorphism and typography as the user dashboard for a cohesive brand identity.

## Proposed Changes

### Core UI Framework

#### [NEW] [Sidebar.tsx](file:///c:/Users/HP/documents/Anvil/apps/dashboard/components/Sidebar.tsx)
Create a premium Sidebar component using glassmorphism (`.glass`), `Instrument Sans` for headers, and subtle hover animations.
- Links: Dashboard, Servers, Deployments, Billing, and Admin (conditional).
- Integrated user profile and logout.

#### [NEW] [DashboardLayout.tsx](file:///c:/Users/HP/documents/Anvil/apps/dashboard/components/layouts/DashboardLayout.tsx)
A shared layout wrapper that provides the Sidebar on the left and a scrollable main content area on the right.

### Navigation Refactoring

#### [MODIFY] [layout.tsx](file:///c:/Users/HP/documents/Anvil/apps/dashboard/app/layout.tsx)
Update the root layout to use specific fonts and global styles consistently.

#### [MODIFY] [page.tsx](file:///c:/Users/HP/documents/Anvil/apps/dashboard/app/page.tsx) (Homepage)
Refine the landing page top-bar and ensure it feels distinct from the inner dashboard.

#### [MODIFY] [dashboard/page.tsx](file:///c:/Users/HP/documents/Anvil/apps/dashboard/app/dashboard/page.tsx)
- Wrap content in `DashboardLayout`.
- Remove the local `nav` component.
- Refine the header typography and spacing.

### Specific Page Enhancements

#### [MODIFY] [ServerList.tsx](file:///c:/Users/HP/documents/Anvil/apps/dashboard/components/ServerList.tsx)
- Enhance server cards with sharper borders, better glow effects (`.glow-blue`), and staggered animation delays.
- Use `Instrument Sans` for server names.

#### [NEW] [History.tsx](file:///c:/Users/HP/documents/Anvil/apps/dashboard/app/billing/history/page.tsx)
Create a new Subscription History page with a list of past transactions and active plan status, following the dashboard aesthetic.

#### [MODIFY] [admin/layout.tsx](file:///c:/Users/HP/documents/Anvil/apps/dashboard/app/admin/layout.tsx)
Refactor to use a consistent sidebar style and typography, aligning it with the main platform theme.

## Open Questions

- Should the sidebar be collapsible to save horizontal space on smaller screens?
- Do we want to keep the red accents for the Admin panel, or move to a more unified blue/obsidian theme across the entire application?

## Verification Plan

### Automated Tests
- Build verification: `npm run build` to ensure all type changes and routing are correct.
- Manual inspection of responsive layouts.

### Manual Verification
- Verify Sidebar navigation across all routes.
- Verify consistent typography and glassmorphism in Servers and Billing pages.
- Confirm Admin dashboard parity with the main user dashboard.
