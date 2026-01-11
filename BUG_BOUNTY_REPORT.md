# Bug Bounty Report: Cloud Run OAuth Session Loop 🔄

## 🛑 Problem Statement
The Google Workspace MCP Server fails to maintain authentication state when deployed to Google Cloud Run. Even after a successful OAuth flow, subsequent tool calls frequently report "Authentication Required," forcing the user into an infinite re-auth loop.

## 🔍 Root Cause (Hypothesis)
Cloud Run is **stateless and ephemeral**.
1.  **Multiple Instances**: Cloud Run can spin up multiple instances. A session created on Instance A is invisible to Instance B. 
2.  **Lack of Shared Disk**: The server currently uses memory (and tried `/tmp` file persistence) for sessions. Since disk is not shared across instances, sessions are lost whenever a request hits a new instance or a container restarts.
3.  **Client-Side Inconsistency**: While a "Stateless Token Relay" was attempted (relaying tokens via `X-Google-*` headers), it appears the relay mechanism is either intermittent or the backend is failing to "hydrate" the session object before the tool logic executes.

---

## 🛠️ Attempted Solutions & Current State

### 1. File-Based Persistence (Failed)
- **Implementation**: Used `json` storage in `/tmp/mcp_sessions.json`.
- **Failure**: `/tmp` is local to the container. In Cloud Run, this is volatile and not shared. 

### 2. Stateless Token Relay (In Progress / Potential Bug)
- **Concept**: Shift the "Source of Truth" to the user's browser (`localStorage`).
- **Flow**:
    1.  `oauth_callback` sends tokens to the frontend via `window.postMessage`.
    2.  Frontend stores tokens in `localStorage`.
    3.  `tools-helper.ts` injects these tokens into `X-Google-Access-Token` and `X-Google-Refresh-Token` headers for every tool call.
    4.  Backend `main.py` extracts these headers and updates the memory-resident session before calling the tool.
- **Current Symptom**: The logic in `main.py` might be completing the session update *after* the tool service has already been initialized with a token-less session.

---

## 🛠️ Implemented Solution: Firestore Persistence ✨

We have successfully replaced the ephemeral storage with **Google Cloud Firestore**.
- **Global State**: All Cloud Run instances now share a single `mcp_sessions` collection.
- **Auto-Hydration**: `main.py` now retrieves the user's session from Firestore on every request.
- **Stateless Fallback**: The server still supports high-speed Stateless Token Relay via headers as a primary path, with Firestore as the robust source of truth.

### How to Verify
1.  Enable Firestore API in GCP.
2.  Assign `roles/datastore.user` to the Cloud Run service account.
3.  Deploy the latest code from the `bug/cloud-run-auth-loop` branch.

---

## 📦 Reference Files
- [main.py](file:///c:/Users/senti/OneDrive/Desktop/project-nexus-v2/project-nexus-v2-main/google-workspace-mcp-server/backend/main.py) (See `mcp_post` and `oauth_callback`)
- [tools-helper.ts](file:///c:/Users/senti/OneDrive/Desktop/project-nexus-v2/project-nexus-v2-main/lib/tools-helper.ts) (See `applyServerConfig` and header injection)
- [monitoring/page.tsx](file:///c:/Users/senti/OneDrive/Desktop/project-nexus-v2/project-nexus-v2-main/app/monitoring/page.tsx) (OAuth success listener)
