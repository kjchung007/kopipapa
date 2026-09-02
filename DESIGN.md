---
name: Kopi Papa
description: A Home-first navy-and-gold coffee counter for fast, confident pickup ordering.
colors:
  counter-navy: "#202978"
  counter-navy-deep: "#111c53"
  signal-gold: "#e7b827"
  price-gold: "#b28a35"
  admin-gold-ink: "#a57d20"
  warm-cream: "#f7f2e6"
  canvas-cream: "#f3f0e8"
  counter-white: "#ffffff"
  ink-navy: "#101a49"
  quiet-ink: "#666b80"
  warm-line: "#e1dacb"
typography:
  display:
    fontFamily: "Bree Serif, Georgia, serif"
    fontSize: "31px"
    fontWeight: 400
    lineHeight: 1.13
  admin-hero:
    fontFamily: "Bree Serif, Georgia, serif"
    fontSize: "clamp(48px, 6vw, 82px)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Bree Serif, Georgia, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.13
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.08em"
rounded:
  pill: "999px"
  control: "12px"
  card: "15px"
  sheet: "18px"
  modal: "20px"
spacing:
  xs: "7px"
  sm: "9px"
  md: "13px"
  lg: "18px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.counter-navy}"
    textColor: "{colors.counter-white}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "54px"
  button-primary-hover:
    backgroundColor: "{colors.counter-navy-deep}"
    textColor: "{colors.counter-white}"
    rounded: "{rounded.control}"
  chip-selected:
    backgroundColor: "{colors.counter-navy}"
    textColor: "{colors.counter-white}"
    rounded: "{rounded.control}"
    height: "44px"
  card-campaign:
    backgroundColor: "{colors.counter-navy}"
    textColor: "{colors.counter-white}"
    rounded: "{rounded.card}"
    padding: "22px"
  navigation-dock:
    backgroundColor: "{colors.counter-white}"
    textColor: "{colors.quiet-ink}"
    height: "calc(70px + max(14px, env(safe-area-inset-bottom)))"
  fulfillment-active:
    backgroundColor: "{colors.counter-navy}"
    textColor: "{colors.counter-white}"
    rounded: "{rounded.control}"
    padding: "14px"
    height: "80px"
  admin-rail:
    backgroundColor: "{colors.counter-navy-deep}"
    textColor: "{colors.counter-white}"
    width: "250px"
  status-new:
    backgroundColor: "#f6e8ae"
    textColor: "#775a11"
    rounded: "{rounded.pill}"
    padding: "5px 8px"
---

# Design System: Kopi Papa

## Overview

**Creative North Star: "The Papa Counter"**

Kopi Papa turns the familiar physical coffee counter into a Home-first mobile ordering surface. Deep navy provides the counter-like structure, gold behaves as a scarce service signal, and warm cream keeps browsing hospitable without drifting into generic beige coffee-commerce styling. The serif voice belongs to the brand and page headings; the sans serif voice handles every operational decision.

The Home surface welcomes first, then immediately resolves fulfillment before offering a photographic campaign carousel and four quick routes. Menu access is gated until pickup is selected; browsing stays open while ordering and account areas require a verified account. The system stays compact and precise through cart, orders, profile, and bottom-sheet flows, favoring persistent context and large reachable actions over ornamental discovery.

The admin workspace is the same counter seen from behind it. A private split-screen entry gives way to a fixed navy rail and cream operational canvas. Its metrics, tables, availability controls, campaign tools, settings, and editor are deliberately flatter and denser than the customer app, while the shared palette and typography make ownership unmistakable.

**Key Characteristics:**

- Deep navy structural anchors with controlled gold signals.
- Warm cream context surfaces against crisp white menu rows.
- Bree Serif brand moments paired with dense, legible DM Sans utility copy.
- Persistent vertical categories and photographic product rows.
- A four-tab, safe-area-aware dock connecting Home, Menu, Orders, and Profile.
- Cream bottom sheets that handle fulfillment, auth, customization, and cart decisions.
- A fixed navy admin rail beside a calm cream workspace of flat operational rows.
- Supabase-controlled admin access, never a decorative client-only lock.
- Rounded controls and containers, with circles reserved for icons and compact actions.

## Colors

The palette reads as a navy counter lit by small gold service cues, softened by warm paper-like neutrals.

### Primary

- **Counter Navy:** The dominant brand and action color for the top bar, primary controls, selected states, and cart surfaces.
- **Deep Counter Navy:** A deeper structural tone for live-status strips, hover states, overlays, and stronger depth.

### Secondary

- **Signal Gold:** A high-attention accent for live indicators, active markers, focus outlines, prices inside navy controls, and the wordmark.
- **Price Gold:** A quieter gold for prices and secondary emphasis on light surfaces.
- **Admin Gold Ink:** The darker accessible gold used for admin counts and numeric emphasis on white or cream.

### Neutral

- **Warm Cream:** Context panels and summary surfaces that separate operational information from the white menu.
- **Canvas Cream:** The page surround and neutral control fill.
- **Counter White:** Menu rows, navigation, sheets, and reversed text.
- **Ink Navy:** Primary text on light surfaces.
- **Quiet Ink:** Descriptions, metadata, inactive navigation, and supporting copy.
- **Warm Line:** Dividers and structural boundaries.

### Named Rules

**The Gold Is a Signal Rule.** Gold marks brand, price, live status, focus, or active state; it is never a broad background wash.

**The Navy Owns Structure Rule.** Major anchors and decisive actions use navy so the interface continues to feel like Kopi Papa, not a neutral marketplace.

## Typography

**Display Font:** Bree Serif (with Georgia and serif fallbacks)  
**Body Font:** DM Sans (with Arial and sans-serif fallbacks)

**Character:** Bree Serif brings a friendly, established counter voice without becoming nostalgic decoration. DM Sans keeps prices, choices, descriptions, and status information compact and highly scannable.

### Hierarchy

- **Display** (400, 31px, 1.05–1.13): Home welcome, campaign, and supporting-page headings.
- **Headline** (400, 22px, 1.13): Menu section headings and campaign statements.
- **Body** (400, 13px, 1.5): Descriptions and explanatory copy.
- **Label** (700, 11px, 0.08em): Compact metadata and operational labels; uppercase only for short status-like phrases.
- **Admin Hero** (400, clamp(48px, 6vw, 82px), 0.98): The split-screen login thesis only; never use this scale inside the workspace.

### Named Rules

**The Two Voices Rule.** Use Bree Serif for brand and menu hierarchy; use DM Sans for actions, prices, status, and supporting information.

## Layout

The application is a centered shell capped at 1080px and fills `100dvh` with a `100svh` minimum. Home is the first surface: a 122px deep-navy welcome block, two overlapping 80px fulfillment choices, a 280px campaign carousel, then a four-column quick-action grid. A persistent four-tab bottom dock uses `env(safe-area-inset-bottom)` so Safari home-indicator space is never treated as content space.

The Menu surface uses a 74px sticky top bar, order context, then a two-column menu with a sticky 112px category rail and flexible product content. At very narrow widths the rail contracts to 92px; from 700px it expands to 142px, product imagery grows, and menu gutters widen. At 1000px the menu becomes a three-column counter with a 278px sticky order summary. Orders and Profile use a simple cream page with a deep-navy heading block and white, 16px-rounded content groups.

Admin login is a full-height split screen: a slightly wider Deep Counter Navy brand world beside a Warm Cream form plane capped at 430px. Below 700px the brand half disappears and the seal moves into the form. The authenticated admin shell uses a fixed 250px navy rail and scrollable cream workspace; below 1000px the rail collapses to 80px icons, and below 700px it becomes a 70px six-destination bottom dock. Workspace headers are sticky at 100px desktop and 84px mobile. Content uses 32px desktop gutters and 18px mobile gutters; wide operational tables retain their column logic through horizontal scrolling rather than destructive stacking.

**The Desktop Is the Counter Rule.** Admin density assumes a desktop working surface first, then collapses the rail and preserves tables for smaller screens without changing operational meaning.

The spacing rhythm is tight and repeatable: 7–9px for micro-gaps, 13px inside rows, 18px for mobile page gutters, and 22–28px for feature panels and larger viewports. Product rows prioritize a fixed photographic thumbnail beside flexible copy; truncation and two-line clamping protect the scan rhythm.

**The Context Stays Put Rule.** The four primary destinations, pickup status, category navigation, and cart access remain visible or immediately reachable while content scrolls.

**The Fulfillment Before Menu Rule.** Entering Menu without a fulfillment choice opens the decision sheet; unavailable delivery is labeled as coming soon rather than behaving like a selectable path.

## Elevation & Depth

Depth is a restrained hybrid of tonal layering and soft navy-tinted shadows. Most menu and settings structure is flat and separated by warm lines; shadows are reserved for floating or bounded surfaces such as fulfillment choices, the campaign carousel, quick-action tiles, cart bar, desktop summary, and bottom sheets.

### Shadow Vocabulary

- **Shell:** `0 16px 48px rgba(15,24,67,.14)` frames the centered application on wide screens.
- **Raised Panel:** `0 15px 30px rgba(17,28,83,.17)` separates the photographic campaign carousel from Home.
- **Choice Lift:** `0 8px 22px rgba(17,28,83,.1)` lifts fulfillment choices across the welcome/context boundary.
- **Floating Cart:** `0 14px 30px rgba(17,28,83,.25)` makes the actionable cart bar unmistakably transient and reachable.
- **Sheet:** `0 -20px 50px rgba(7,12,42,.28)` anchors the bottom sheet above its navy veil.
- **Admin Editor:** `0 22px 60px rgba(7,12,42,.3)` isolates the centered menu editor above its navy veil.

**The Flat Menu Rule.** Product browsing stays flat; elevation belongs to overlays, summaries, and floating actions.

## Shapes

The form language is gently rounded and practical. Standard controls use 10–14px corners, grouped page content uses 16px, the campaign uses 18px, and decision/auth/cart sheets use 20px only on their exposed top edge. Pills indicate compact modes, availability, badges, and counts. Circles are reserved for marks, category symbols, carousel arrows, icon actions, and add controls. Product photographs use a 14px crop that softens the dense row without making every surface a card.

## Components

### Buttons

- **Shape:** Confident rounded rectangles (12–14px), pills for compact mode choices, and circles for icon-only actions.
- **Primary:** Counter Navy with Counter White copy, bold DM Sans, and Signal Gold reserved for price or active detail.
- **Hover / Focus:** Hover deepens navy and may lift compact add actions by 2px; keyboard focus uses a 3px Signal Gold outline with a 3px offset.
- **Choice:** Unselected options use Canvas Cream; selected options turn navy with white text and a gold inset underline.

### Chips

- **Style:** Compact pills use navy fills with white copy; promotional tags remain small and subordinate to the product name.
- **State:** Gold or a gold edge detail communicates active state without filling the entire chip in gold.

### Cards / Containers

- **Corner Style:** Feature surfaces use 15px corners; product rows remain unboxed.
- **Background:** Navy for campaigns, Warm Cream for context and summaries, Counter White for menu and sheets.
- **Shadow Strategy:** Only raised or floating surfaces use the documented navy-tinted shadows.
- **Border:** Warm Line creates structure where a shadow would add noise.
- **Internal Padding:** 18–22px for feature surfaces; 13px vertically for product rows.

### Inputs / Fields

- **Style:** Choice fields are 44px-tall paired controls with 12px corners and a neutral cream fill.
- **Focus:** All button-like fields inherit the gold focus outline.
- **Selected:** Navy fill, white text, and a thin gold inset baseline.

### Navigation

The top bar is solid navy and brand-led. The primary dock exposes Home, Menu, Orders, and Profile in four equal columns. It stays white with quiet inactive labels; active items turn navy and receive a short gold underline. A small gold dot on Menu means pickup must be chosen first. Its 70px base height adds at least 14px or the device safe-area inset below the controls. The category rail is a sticky warm-neutral column with centered symbols, compact labels, and a 3px gold active bar. On desktop, navigation remains stable while the order summary occupies the third column.

Admin navigation is a fixed Deep Counter Navy rail with six destinations, a top brand seal, and the operator identity anchored below a divider. Active and hovered destinations use Counter Navy; the active destination gets a small gold dot, while order volume uses a filled gold count. At 80px only icons and badges remain; at mobile width the same six destinations become a bottom dock.

### Home Welcome & Fulfillment

Home opens with a Deep Counter Navy welcome panel, oversized ghosted KP letters, and a circular gold stamp. Two white/blue fulfillment cards overlap its lower edge: Pickup is the available navy path; Delivery remains white, carries a pale-gold Soon pill, and opens explanatory feedback. Selecting Pickup unlocks and routes to Menu.

### Campaign Carousel

The carousel uses full-bleed photography under a strong navy left-to-right gradient, a 31px Bree Serif story title, restrained gold eyebrow and CTA, circular arrow controls, and dot/pill pagination. Campaign copy remains subordinate to ordering and the Browse Menu action obeys fulfillment gating.

### Quick Actions

Four equal actions use 48px white icon tiles with 14px corners and short labels. They mirror the core routes—menu, orders, profile, and delivery news—without creating a competing navigation system.

### Product Row

Product rows pair a fixed 14px-rounded photograph with concise name, two-line description, gold price, and a circular navy add action. Rows are divided, not carded, so twenty-item menus remain fast to scan.

### Live Wait Strip

The live strip is Deep Counter Navy with white copy, a tabular gold time, and a small pulsing gold dot. Motion is quiet, status-specific, and disabled under reduced-motion preferences.

### Decision, Auth & Cart Sheets

Fulfillment, sign-in, and cart share a cream bottom sheet capped at 560px, with 20px top corners, safe-area-aware bottom padding, a white circular close control, Bree Serif title, and navy primary action. Auth pairs email/password fields with Google and Apple actions, explicit email verification, and password recovery states. Cart uses compact white line items, thumbnail crops, gold-toned prices, and a separated total. These are transactional surfaces: one decision per group and explicit recovery guidance.

### Orders & Profile

Orders and Profile share the simple-page frame. Empty orders use a centered navy/gold icon and one menu CTA; active orders use a vertical status timeline where gold marks completed progress. Profile uses a circular navy identity mark, white grouped settings rows separated by warm lines, and an outlined session-ending action.

### Admin Login & Auth Boundary

Admin entry splits brand and task: an editorial Deep Counter Navy statement occupies the left while a restrained cream sign-in form occupies the right. White 49px fields, a 52px navy submit action, explicit progress/error states, and a lock note communicate controlled access. Supabase Auth verifies credentials, then the `admin_users` allowlist verifies authorization; rejected roles are signed out. Development preview is an explicit local exception and must never be mistaken for production authorization.

### Admin Metrics & Tables

The dashboard begins with a navy open-shop strip, followed by four flat metrics inside one white 14px-rounded container. Dividers, not individual card shadows, establish rhythm. Operational panels use 58–64px rows, small uppercase headers, tabular money/status values, and warm hairlines. Order and product tables preserve columns and actions; responsive layouts hide only secondary fields and allow horizontal table scrolling on mobile.

### Status Chips & Availability

Status is semantic and compact: New uses pale gold with brown-gold text, Preparing uses pale navy with Counter Navy text, and Ready uses pale green with dark green text. Availability is a labeled 34×20px switch: gray when unavailable, navy when available, with a white 14px thumb. Never rely on color alone; keep the status or availability label visible.

### Admin Campaigns, Settings & Editor

Campaign management pairs a photographic navy-gradient feature with a flat white story list. A green Live pill is reserved for publication state. Settings use paired white panels, 49px fields, a separated operational checkbox row, and explicit Supabase security explanations. Menu editing opens a centered cream modal capped at 500px with 16px corners, compact paired fields, a circular close control, and right-aligned Cancel/Save actions; on mobile paired fields stack.

## Do's and Don'ts

### Do:

- **Do** keep navy present in structural anchors and every decisive ordering action.
- **Do** reserve gold for meaningful signals: brand, live state, active state, focus, and price emphasis.
- **Do** use photographic rows, persistent category access, and compact metadata to support fast scanning.
- **Do** preserve large touch targets, visible keyboard focus, clear contrast, and reduced-motion behavior.
- **Do** keep operational facts such as shop, wait, price, and cart status unmistakable.
- **Do** gate Menu behind an explicit fulfillment choice and require a verified account before cart or ordering actions.
- **Do** include bottom safe-area padding in the persistent dock and transactional sheets.
- **Do** keep admin tables flat, divider-led, and information-dense; reserve shadows for the shell boundary and editor modal.
- **Do** pair every admin status color or switch state with a readable label.
- **Do** enforce admin access with both Supabase authentication and the server-backed admin allowlist.

### Don't:

- **Don't** replace the identity with beige, brown, or lifestyle-led coffee-shop chrome.
- **Don't** turn every product into a floating card; the menu's precision depends on flat divided rows.
- **Don't** use Bree Serif for dense instructions, metadata, or controls.
- **Don't** flood surfaces with gold or use it as a decorative background.
- **Don't** copy CHAGEE or ZUS branding, campaign art, or visual identity; their references inform interaction structure only.
- **Don't** present Delivery as available until zones, addresses, and fees exist.
- **Don't** let campaign content or quick actions obscure the four primary destinations.
- **Don't** turn admin metrics or table rows into a mosaic of floating cards.
- **Don't** use customer-style promotional warmth where an admin task needs compact operational clarity.
- **Don't** treat a client-side route, hidden link, or development preview as an admin authorization boundary.
