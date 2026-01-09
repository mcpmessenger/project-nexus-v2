# Google OAuth Debugging Status

This document tracks the issues found and resolved during the troubleshooting of the Google OAuth flow hang.

## Current Findings

### 1. Configuration Mismatches ✅ Fixed
- **Issue**: The database configuration expected a file named `main.py` but the project had `temp_main.py`.
- **Issue**: The backend code expected a package named `auth` but the directory was named `temp_auth`.
- **Fix**: Renamed `temp_main.py` -> `main.py` and `temp_auth` -> `auth`.

### 2. Environment Variable Naming ✅ Fixed
- **Issue**: `.env.local` defined `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, but the Python code was strictly looking for `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.
- **Fix**: Updated `main.py` and `auth/oauth_config.py` to support both naming conventions.

### 3. Zombie Processes ✅ Fixed
- **Issue**: Port `54321` was being held by a "ghost" Python process from a previous crash/run.
- **Fix**: Manually killed all `python.exe` processes.

### 4. Port Inconsistency ✅ Fixed
- **Issue**: The server defaulted to port `8000` unless `PORT` env var was set, but the OAuth redirect URI expects `54321`.
- **Fix**: Added `--port` argument to `main.py` and updated the database seed configuration to explicitly pass `--port 54321`.

### 5. Import & Path Issues ✅ Fixed
- **Issue**: Absolute imports were failing in the user's environment because the project root wasn't in `sys.path` when running as a module.
- **Fix**: Added project root to `sys.path` dynamically in `main.py` and added support for `.env.local` loading.

## Remaining Challenges

### 1. Missing Tool Folders
- **Observation**: Folders like `core`, `gmail`, `gdrive`, etc. are missing from the project root.
- **Status**: The user confirmed these are "MCP tools". They appear to be satisfied by the global Python `site-packages` environment on the user's machine, as `main.py` is able to import them when run manually.

### 2. Startup Failures in `npm run dev`
- **Issue**: Even with the fixes above, the process sometimes closes with `code 1` when launched by Next.js.
- **Action**: Added a `crash_log.txt` logger to `main.py` to capture startup exceptions. If the process dies again, check `crash_log.txt` in the root.

## Next Steps for User
1. Stop any currently running `npm run dev`.
2. Run `npm run dev` again.
3. Click the Google Authorization link provided in the chat.
4. If it still hangs, check for a file named `crash_log.txt` in the root and share its content.
