# ADMAKI Menu staging readiness

27 November 2026. **Not ready for a public launch or a customer-manager pilot yet.** The latest tests found a real runtime-budget blocker despite the earlier passing public-menu tests and local regression suites.

| Area | Current result | Next requirement |
| --- | --- | --- |
| Shared dashboard/editor, roles, policy enforcement and publication | Existing implementation and regression suites pass | Complete release reconciliation after operational blockers are resolved |
| Public delivery | 1,660-request bounded profile passed, including 10/25/50 requests/s | Agree real production traffic/duration expectations; complete phone/browser geographic checks |
| Login | Nine sequential logins passed; the three-concurrent profile encountered HTTP 503 and resource-limit events | Resolve the Free-plan CPU budget and rerun the complete bounded profile |
| Uploads | Three sequential and nine concurrent uploads passed; extended uploads failed with HTTP 503 before quota verification completed | Resolve the budget and rerun the complete profile and quota checks |
| Actual CPU | Public mean about 4.85 ms; sequential login about 155.52 ms; upload phases about 19.09 ms, including reported startup for modeling | Current Workers Free allows 10 ms/request; verify a compatible runtime budget |
| Cost | Paid-plan scenarios are calibrated with measured CPU; about $5/month for 20 restaurants under the documented assumptions | Owner decision on $5/month account-wide base plus metered usage; subscription remains Free |
| Test cleanup | Three managers disabled, all sessions revoked, three restaurants suspended, no live test media; 21 media tombstones include an interrupted upload | Verified original data and Worker version unchanged |
| Restaurant content | No new approved customer menu was launched by these tests | Verify each café's prices, images, tax notes and contact links |
| Real phones | Not certified by the HTTP probes | Test QR scanning, sharing, images and manager editing on actual phones/networks |
| Production cutover | PR #3 remains draft; production unchanged | Reviewed release, rollback/recovery checks and owner's production decision |

The **concrete next decision** is in [Runtime budget remediation](RUNTIME_BUDGET_REMEDIATION.md). It proposes Workers Paid and a 500 ms staging CPU ceiling followed by retesting; neither billing nor runtime settings have been changed. Password hashing and security controls remain intact.

The extended login and upload runs are retained as **failed**, not described as completed capacity checks. Upload-only setup used temporary operator-issued sessions and cannot stand in for a passing login test. The driver now stops queueing new work after a failure and drains active requests before cleanup.

Evidence: [CPU/account usage](../cloudflare/inventory/capacity/usage-2026-11-27.json), [failed login run](../cloudflare/inventory/capacity/login-failed-2026-11-27.json), [failed extended upload run](../cloudflare/inventory/capacity/upload-failed-2026-11-27.json), [cleanup](../cloudflare/inventory/capacity/auth-upload-cleanup-2026-11-27.json), [conditional Paid forecast](../cloudflare/inventory/capacity/calibrated-cost-2026-11-27.json).
