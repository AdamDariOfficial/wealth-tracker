# Settings, fixed search, and composer close

## Scope
- Rebuild Settings as one clean, unframed page with clear section dividers instead of cards.
- Keep every existing profile, import, backup, restore, sign-out, and reset action.
- Make the import action a prominent, always-visible link to `/import` directly beneath “Import data”.
- Keep the global search bar fixed while scrolling, with improved top spacing and an opaque high-contrast surface.
- Keep the “Add record” close control fixed in the popup header while only the form content scrolls.

## Technical details
- Restructure `src/routes/settings.tsx` without changing repositories or financial behavior.
- Adjust the authenticated shell in `src/routes/__root.tsx` so the search area is sticky and clears device safe areas.
- Move overflow responsibility from the entire composer dialog to its form region in `src/features/wealth-v2/CoreComposer.tsx`; preserve the shared dialog close button.
- Validate type safety, focused tests/build signals, and the visible layouts at mobile and desktop sizes where authentication permits.
