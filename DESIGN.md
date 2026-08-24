# Qai interface language

Qai is a calm operating workspace for independent creative businesses. Product
screens should feel precise and welcoming, with the business data—not chrome—as
the visual focus.

## Foundations

- **Colour:** deep navy text, warm-white elevated surfaces, a quiet cool canvas,
  and muted plum for primary actions. Semantic colours are reserved for state.
- **Spacing:** use the shared 4/8/12/16/24/32/48px spacing tokens. Prefer clear
  section rhythm over stacking many containers.
- **Shape:** controls use 8px radii, surfaces 10–12px, and mobile sheets may use a
  larger top radius. Pills are reserved for status, filters, and short choices.
- **Elevation:** a border is the default separator. Use the low surface shadow
  for floating panels and the higher shadow only for dialogs/sheets.
- **Type:** page titles are compact and decisive; section titles stay close to
  their content. Use tabular numerals for money and operational counts.

## Components

- One primary action per region. Use outline for a strong alternative, ghost for
  low-emphasis utility actions, and destructive only for confirmed removal.
- Toolbars collapse to a vertical control stack below tablet width.
- Operational collections use interactive tables on desktop and purpose-built
  cards on phones. Never squeeze a desktop table into a 390px viewport.
- Dialogs keep their title and final actions visible, allow the body to scroll,
  and preserve drafts while inline records are created.
- Empty states explain what is absent and offer one useful next action.

## Tables

- Owner record collections share one table language: a quiet header surface,
  compact readable rows, subtle row hover, aligned numeric columns, and a stable
  final **Actions** column.
- Sortable headers use the shared sort control. The neutral state is visible but
  subdued; active ascending or descending direction is explicit and announced
  with `aria-sort`.
- At widths where the complete record cannot remain readable, switch to a
  purpose-built card and expose the same ordering through the compact Sort
  control. Never rely on horizontal scrolling as the primary phone experience.

## Record actions

- A record row or card opens its normal detail view. Secondary operations live
  in the shared three-dot menu, with an icon and a clear text label.
- Keep edit, download, workflow, and destructive actions inside that menu unless
  the action is the page's primary task. Destructive actions are separated and
  placed last, and still require confirmation.
- Inline form items may use a labelled icon button for direct removal or
  duplication; this is not a record-row action and should not open a menu.

## Buttons

- Default buttons are 44px high; compact toolbar and row controls remain at
  least 40px. Icon-only buttons always have an accessible label and tooltip.
- Use primary for the single forward action, outline for a meaningful
  alternative, ghost for utilities, and destructive styling only at the point
  where removal is being confirmed.
- Keep button labels short and specific: **Add service**, **Publish changes**,
  **Download PDF**. Avoid generic **View** or **Edit** when the record context is
  not obvious.

## Service Choices

- A **choice name** is the question a client answers, such as *Instructor* or
  *Package*. **Values** are its selectable answers, such as *Owner* and *Mentor*.
- A combination chooses exactly one value from every choice type. Its automatic
  label is built from those selected values; an optional display label may
  replace that client-facing text without changing the underlying selection.
- Adding or duplicating a combination must choose the next unused valid
  combination. Validation points to the exact choice, value, or combination
  that needs attention and never silently creates duplicates.

## Responsive behaviour

- Minimum touch target: 40px; prefer 44px for primary mobile controls.
- Account for top and bottom safe-area insets in standalone mode.
- No fixed content width may create horizontal overflow at 390px.
- Desktop navigation is grouped by intent. Mobile keeps the four most frequent
  destinations in five symmetrical slots: Home, Bookings, Create, Calendar, and
  Clients. Create owns the exact centre slot; secondary destinations live in the
  app menu in the mobile header.

## Mobile owner application

- **Header:** keep Qai branding compact and give the right side daily utility:
  real operational attention plus the app menu. Marketing taglines do not belong
  in the signed-in mobile header. Low-frequency utilities live in the menu.
- **Dashboard customization:** preserve visibility, ordering, and saved
  preferences. On mobile, open customization from the Dashboard app menu; on
  desktop, use a small tertiary Dashboard-level control.
- **Dashboard:** lead with Today, then Needs attention, then a compact Money
  snapshot with its own period selector. Prefer rows, dividers, and typography
  over nested cards; do not repeat the global Create sheet as large mobile quick
  actions.
- **Public Qai Page:** the public canvas, navigation background, and template
  backgrounds fill the available viewport. Template-specific readable content
  may remain centred and width-constrained; editor preview frames own their own
  simulation width and must not constrain the live route.

## Language

Use owner-friendly terms. Say **Choices** instead of variants, **Schedules**
instead of session records, and **Paid** instead of income when the value is the
sum of recorded payments. Keep financial and invoice lifecycle terminology exact.
