# Project Nexus – OAuth Flow Bug Bounty Program

## Overview
Project Nexus integrates with Google Workspace via an OAuth 2.0 flow.  The flow involves a local callback server that listens on a configurable port and exchanges an authorization code for access/refresh tokens.  Vulnerabilities in this flow could allow an attacker to:
- Intercept or tamper with the OAuth redirect.
- Perform credential leakage or token replay attacks.
- Bypass user consent and gain unauthorized access to Gmail, Calendar, Drive, etc.

## Scope
| In‑Scope | Description |
|----------|-------------|
| **OAuth redirect handling** | Any flaw in the callback server, redirect URI validation, or token exchange logic. |
| **Client secret exposure** | Leakage of `GOOGLE_OAUTH_CLIENT_SECRET` via logs, environment, or UI. |
| **State parameter misuse** | Predictable or missing `state` values that enable CSRF attacks. |
| **Port conflict / hijacking** | Scenarios where the callback server runs on a port that can be hijacked by another process. |
| **User‑interface link parsing** | Incorrect URL parsing that injects extra characters (e.g., trailing `)`), leading to malformed consent URLs. |

### Out‑of‑Scope
- Issues unrelated to the OAuth flow (e.g., UI styling, unrelated API endpoints).
- Vulnerabilities in third‑party Google services themselves.

## Rewards
| Severity | Reward (USD) |
|----------|--------------|
| Critical (remote code execution, full account takeover) | $2,500 |
| High (token theft, CSRF, credential leakage) | $1,000 |
| Medium (information disclosure, improper validation) | $500 |
| Low (documentation errors, minor UI bugs) | $100 |

## Disclosure Guidelines
1. **Report privately** to `security@project-nexus.io` with a clear proof‑of‑concept.
2. Include details: affected version, steps to reproduce, and suggested remediation.
3. Do **not** publish any sensitive data (client secrets, tokens) publicly.
4. Allow a 30‑day window for remediation before public disclosure.

## Testing Recommendations
- Verify that the `state` parameter is cryptographically random and validated on callback.
- Ensure the redirect URI registered in Google Cloud matches exactly the one the server uses (including port).
- Test the link parsing regex in `app/workflows/page.tsx` to confirm it does not capture trailing punctuation.
- Simulate port‑conflict scenarios and confirm the server fails gracefully without exposing credentials.
- Review logs to confirm client secrets are never printed in clear text.

## Contact
- **Security Team**: security@project-nexus.io
- **PGP Key**: 0xABCD1234EF567890 (available in the repo’s `SECURITY.md`).

---
*This bug bounty program is intended to improve the security of Project Nexus. All responsible disclosures are appreciated.*
