# Changelog

All notable changes to this project will be documented in this file.

## [fix] Mock Activation Flow & Account State Read

### Fixed
- STK push route now returns proper idempotent response with `alreadyActivated: true` instead of error
- Added comprehensive logging to activation flow for debugging
- Fixed activation payments flow - checks for existing pending payment first before inserting
- Fixed /api/me endpoint to create account_status row if it doesn't exist (bootstrap on read)
- Fixed frontend activation client to use hard navigation (window.location.href) instead of soft router.refresh() to ensure fresh server read
- Account status now uses `status: 'active'` instead of `'activated'` for consistency