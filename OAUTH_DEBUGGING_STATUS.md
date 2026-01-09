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

| **State parameter misuse** | Predictable or missing `state` values that enable CSRF attacks. |
| **Port conflict / hijacking** | Scenarios where the callback server runs on a port that can be hijacked by another process. |
| **User‑interface link parsing** | Incorrect URL parsing that injects extra characters (e.g., trailing `)`), leading to malformed consent URLs. |
| **Environment Mismatch** | Risk of server starting on an unintended port if environment variables are not strictly validated. |

### 2. Startup Failures in `npm run dev`
- **Issue**: Even with the fixes above, the process sometimes closes with `code 1` when launched by Next.js.
- **Action**: Added a `crash_log.txt` logger to `main.py` to capture startup exceptions. If the process dies again, check `crash_log.txt` in the root.

### 6. Persistence of Hang ⚠️ Ongoing
- **Status**: Despite all configuration and port fixes, the browser still hangs after authorization.
- **Next Step**: Adding request-level logging to `auth/oauth_callback_server.py` to determine if the packet ever reaches the Python server.

## Next Steps for User
1. Ensure no other application is using port `54321` (e.g., an old project or another dev server).
2. Check if your browser has any "Ad-Blockers" or "Privacy Extensions" that might block `localhost` redirects.
3. If it still hangs, look for `callback_access.log` (I will be adding this next).
