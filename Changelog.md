# Changelog

## 2026-05-17

- Added a repo-local contributor workflow in `CONTRIBUTING.md` requiring changelog updates, standard commits, and pushes after each code change, and linked it from `README.md`.
- Fixed admin task filtering so empty filtered results render as an empty state, while Supabase query errors return an inline admin error without showing stale tasks.
- Normalized task publish and expiry datetime values before admin task create, edit, and import writes so `datetime-local` inputs save as valid ISO timestamps.
- Updated user task loading to use the session Supabase client with RLS, publish/expiry eligibility, activation-aware empty states, and generic task cards across categories.
- Restored user-side styling by switching Tailwind configuration to a plain CommonJS config so Next/Tailwind reliably emits the global CSS bundle.
- Verified the home page loads generated CSS rules instead of an empty stylesheet.
