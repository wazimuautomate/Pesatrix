# Changelog

## [fix] Task Import & Validation — 2026-05-17

### JSON Validation — Exact Errors Per Row
- Replaced generic Zod error messages with per-row validation that checks each field individually
- Each invalid row now returns a structured error object: `{ row, title, errors[] }`
- Specific error messages for every field: "title is missing or empty", "payout_ksh must be a number greater than 0", "task_data must be a valid JSON object", etc.
- All validation errors across ALL rows are collected and returned before any database operation
- Errors displayed in the modal UI grouped by row number with clear indicators

### Unrestricted Payout and Slots
- Removed all minimum/maximum constraints on `payout_ksh` and `total_slots` from:
  - Import API route (`/api/admin/tasks/import`) — removed `.min(20).max(50)` and `.min(100).max(400)`
  - TaskImportPanel client validation — removed `payout < 20 || payout > 50` and `slots < 100 || slots > 400` checks
- Only constraint remaining: `payout_ksh > 0` and `total_slots > 0` (integer)
- No upper limits — admins can set any positive value

### Partial Save with Duplicate Prevention
- Import is no longer all-or-nothing; valid rows are saved, invalid rows are returned
- Server-side duplicate detection: single Supabase query fetches all existing tasks matching any title in the batch, then filters in memory for title+category matches
- Duplicates are moved to the failed rows list with error: "Duplicate: a task with this title and category already exists"
- Import always saves as `status: 'draft'` — never publishes on import
- `slots_remaining` is set to `total_slots` on insert
- `ai_grading_enabled` defaults to `true` if not specified in JSON
- Datetime fields normalized to ISO 8601; invalid dates produce row-level errors
- Modal stays open if any rows failed; auto-closes only when all rows are saved
- "Save Fixed" button retries only the currently-failed rows, not already-saved ones
- Inline editing of failed rows in the modal with re-validation on each change

### Duplicate Prevention on Manual Task Creation
- Both `/api/admin/tasks` and `/api/admin/tasks-new` POST endpoints now check for existing title+category before insert
- Returns HTTP 409 with `{ error: "A task with this title and category already exists" }` on duplicate
- Frontend displays the duplicate error near the title field (not as a generic toast)
- Applied to both the task-creation-form and the wazim TaskForm

### Edge Cases Handled
- Invalid JSON file → "Invalid JSON file. Please check the file format."
- JSON not an array → treated as single task object
- Empty JSON array → "JSON file contains no tasks"
- `task_data` as JSON string → attempts `JSON.parse()`, uses parsed object or marks invalid
- Empty string dates (`publish_at`, `expires_at`) → treated as null, not an error
- All rows are duplicates → returns `saved: 0` with duplicate errors, no generic error shown
- Network error during save → "Save failed due to a network error. Please try again." — modal stays open
