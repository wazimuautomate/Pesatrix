# Changelog

All notable changes to this project will be documented in this file.

## [fix] Onboarding Modal Shows Once and Persists Completion

### Fixed
- Onboarding modal now reads visibility state from server (is_setup_complete in account_status table) instead of localStorage
- Removed localStorage dependency that caused modal to reappear when browser data was cleared
- Modal now properly removed from DOM when setup is complete (conditional render with !setupComplete)
- On completion, router.refresh() is called to re-fetch fresh server state
- User closing modal without completing will see it again on next login (correct behavior since is_setup_complete is still false in database)

## [fix] Mock Activation Flow & Account State Read

### Fixed
- STK push route now returns proper idempotent response with `alreadyActivated: true` instead of error
- Added comprehensive logging to activation flow for debugging
- Fixed activation payments flow - checks for existing pending payment first before inserting
- Fixed /api/me endpoint to create account_status row if it doesn't exist (bootstrap on read)
- Fixed frontend activation client to use hard navigation (window.location.href) instead of soft router.refresh() to ensure fresh server read
- Account status now uses `status: 'active'` instead of `'activated'` for consistency