# ASAP Rebates — design brief

Use this brief to redesign the look and feel of ASAP Rebates. The features and flows already work, so the redesign should keep every screen and action listed here and change only how they look. The live site is at https://buckmickshot.github.io/installation-reporting-portal/.

## The product

ASAP Rebates runs the paperwork for rebates under Victoria's **Victorian Energy Upgrades (VEU)** program. Right now it covers only Activity 6: replacing an old heater or air conditioner with a high-efficiency air conditioner. Installer companies use it to create jobs, collect evidence on site, check compliance and export the official ESC assignment form as a PDF or Word file.

There are two front ends, and both use the same accounts:

| | **Portal** (desktop first) | **ASAP Field** (phone first, installable) |
|---|---|---|
| Who | Office staff and admins | Installers on site |
| Used for | Jobs dashboard, job form, review and submission, team admin, settings | Allocated jobs, photos, serial numbers, install details, signatures, sending to the office |
| Where | `/` | `/app` |

### Roles
- **Global admin** (ASAP Rebates staff): can see and manage every company.
- **Admin** (one per installer company): has the same powers, but only for their own company.
- **Staff**: can create, edit and view jobs. In settings they can change only their own password and two-factor.

Sign-up is closed. Admins create every account, and email is used only for "forgot password".

## Design principles
1. **Calm and trustworthy.** It handles government rebates and customer data, so it should feel like a bank or a tax app rather than a marketing site.
2. **Action first, few words.** Each screen should make the next step obvious. Cut explanatory paragraphs; use short labels and helper text only where a mistake is likely.
3. **Status at a glance.** Job status, compliance progress and missing items should be readable in under a second, using colour and an icon, never colour alone.
4. **Big targets on the phone.** Installers wear gloves and stand outdoors in sunlight. Tap targets should be at least 48 px, the main action should sit in a sticky bottom bar, and contrast should be high.
5. **Consistent.** Both apps share one set of tokens and components.

## Brand
- **Name:** ASAP Rebates. The installer app is "ASAP Field".
- **Logo:** placeholder for now, an "AR" monogram on a rounded square. A real logo can come later.
- **Voice:** plain Australian English. Use "Sign in" rather than "Log in", "Send for review" rather than "Submit", and sentence case everywhere.

## Current tokens
These are the tokens in use today. Improve them freely, but keep them as tokens.

| Token | Hex | Use |
|---|---|---|
| navy | `#1E2F40` | Header, primary dark surfaces |
| navy-2 | `#2C3E50` | Hover / secondary dark |
| accent | `#2F8FD8` | Primary buttons, links, focus ring |
| accent-ink | `#1F6FA8` | Link text on white |
| ink | `#17212C` | Body text |
| ink-2 | `#5B6878` | Secondary text |
| line | `#DFE5EB` | Borders |
| bg | `#F2F5F8` | Page background |
| good / good-bg | `#1E8A5A` / `#E3F5EC` | Approved, done, active |
| warn / warn-bg | `#A8640B` / `#FDF1DC` | Info requested |
| info / info-bg | `#1F6FA8` / `#E3F0FA` | Ready for review |
| danger / danger-bg | `#B4322B` / `#FBE7E5` | Errors, destructive actions |
| muted / muted-bg | `#7A8694` / `#EEF1F4` | Draft, inactive, cancelled |

- **Type:** system UI stack (SF / Segoe / Roboto). Job references use a monospace font.
- **Radius:** 8 px on inputs and buttons, 12–14 px on cards and dialogs.
- **Spacing:** 4 px base; pages use 16 px gutters on mobile and 20 px on desktop.

### Job statuses
Each status needs a pill style:

| Status | Meaning |
|---|---|
| Draft | Being filled in |
| Info requested | The office needs more from the installer |
| Ready for review | Sent to the office |
| Submitted | Lodged with VEU |
| Approved | VEECs created |
| Paid | Rebate settled |
| Cancelled | Will not proceed |

## Screens to design

### Sign-in and account (shared)
1. **Sign in:** email and password, a show/hide eye toggle, and a "Forgot password?" link. It currently uses a split layout with a brand panel on the left; on mobile it is a single column.
2. **Two-factor step:** enter the 6-digit code from an authenticator app.
3. **Forgot password:** an email field, then a separate **"Check your email"** confirmation with a resend button and a 60-second countdown.
4. **Set a new password:** new and confirm fields, with a live checklist of the rules (10+ characters, upper, lower, number, symbol). It asks for the 2FA code if the account has 2FA on, and shows a "Link expired" state.

### Portal (desktop)
5. **Header:** the logo and name link back to the dashboard. Nav items are Jobs · Team & companies (admins only) · Settings · Field app ↗. The user's name and role sit on the right, with Log out.
6. **Jobs dashboard:**
   - Status tiles: Open, Drafts, Info requested, Ready for review, Submitted, Approved, Paid.
   - Search and filters: status, assignee, and company (global admins only).
   - A jobs table: ref, customer and address, status, assigned to, evidence count, updated date.
   - Actions: **+ New job**, Export CSV, and Reset demo data (global admins only).
7. **New job:** choice cards in three steps — company (global admins only), activity (only Activity 6 for now), and premises type (Residential / Non-residential) — then "Create job and add customer →".
8. **Job form (wizard), the biggest area to improve:**
   - Seven tabs: Customer info, Decommission, Benefit & install, Workers, Review install, Post install, Declaration.
   - The top bar has "← VEU-000123" (saves and returns to the job) plus Save and Delete.
   - Forms are long. The redesign should look at progress indication per tab, inline validation, and sticky Back/Next buttons.
9. **Job page:**
   - Header: job ref and status pill. Actions are **Rebate application form ▾** (Download PDF / Download Word) and **Edit job form**.
   - Left column: job details, a photos and signatures grid (each with time and GPS), and an activity timeline with notes.
   - Right column:
     - **Next step** card with status actions (e.g. Send for review, Mark as submitted, Request information).
     - **Compliance checklist** with progress.
     - **Allocated installer** dropdown.
10. **Team & companies:**
    - Company list on the left (global admins only), with search and "+ New company".
    - The right panel shows the company name, address and status, and a Company ▾ menu (Edit details / Deactivate).
    - The **Users** table lists each user's name, email, phone, role pill, two-factor on/off, last sign-in and status. Each row has a **Manage ▾** menu: Edit details & role, Reset password, Remove two-factor, Deactivate.
    - Dialogs:
      - Add user: name, mobile, email, role cards, and a temporary password with a Generate button.
      - Edit user.
      - Reset password: set one, or email a reset link.
11. **Settings:** Profile (name, mobile, email read-only), Password (current / new / confirm with rules), and Two-factor (set up with QR code → verify → On / Turn off). A collapsed "How your data is protected" section closes the page.

### ASAP Field (phone, 390 px wide)
12. **My jobs:**
    - Greeting and a count of jobs to do.
    - A To do / Sent toggle.
    - Job cards showing status, ref, customer, address, any office request, install date and evidence count.
13. **Job capture:**
    - **Summary card:** address, Directions and Call buttons, and a progress bar ("9 of 13 done").
    - **Accordion of steps**, each with a done count:
      - Old unit: photo in place, nameplate photo.
      - Removal: decommissioned unit photo.
      - New unit: indoor, outdoor and nameplate photos, plus serial numbers.
      - Install details: install date with a "Today" button, refrigerant licence number, Certificate of Electrical Safety number when needed, and a "customer shown how to use it" tick.
      - Sign-off: customer and installer signatures, each with the name of the signer, the official declaration (collapsed) and a finger-drawn signature pad.
    - Photo items show thumbnails with time and 📍.
    - A sticky bottom bar holds **Send to office for review**, or "✓ Sent to the office".

## Components needed
Button (primary, secondary, ghost, danger; small, regular and large), dropdown button, text input, password input with eye toggle, date input, choice card, role card, checkbox row, status pill, tile, table, card, accordion step, photo tile, signature pad, dialog, toast, banner (info, warn, error, success), breadcrumb, avatar and monogram, progress bar, empty state.

## What I'd like back
- A refreshed palette and type scale, both light mode and dark mode, delivered as tokens.
- High-fidelity designs for screens 1, 6, 7, 8, 9, 10 and 13 first, then the rest.
- A component sheet with all states (hover, focus, disabled, error, loading).
- Mobile versions of the portal screens. They should work at phone width, but the portal is mainly used on desktop.

## Constraints
- Must meet WCAG 2.1 AA contrast, with visible keyboard focus everywhere.
- No stock photos of people. Simple line icons are fine.
- Keep the official ESC form itself untouched: it is a government form, so only the app around it gets redesigned.
