# Private RPC response lifecycle

27 November 2026. Staging-only correction; remain on the existing Free plan.

## Reproduced behavior

Six wrong-origin login requests each returned the expected HTTP 403 and a complete 90-byte JSON body. The front Worker recorded six successful invocations and zero errors. The private Durable Object recorded six `clientDisconnected` RPC outcomes for the same window, despite each HTTP body being read to completion. These requests fail before credential lookup or throttling; no customer account or rate-limit state was changed. The baseline version was `e252deb5-21e2-4357-bdc9-7b8b9648ea27`.

## Correction under validation

The caller now fully consumes the small private mutation response, capped at 128 KiB, disposes the RPC response scope in a `finally` block, and returns an independent Response preserving bytes, status and headers, including session cookies. Oversized or broken streams are canceled/disposed and fail with the existing generic 503. No mutation is retried.

Request bodies still stream to the private object. Secure hashing parameters, account/IP throttling, roles, tenant boundaries, image validation and quotas are unchanged. Public menu/image delivery bypasses this helper and remains streamed. The response cap applies only to controlled private JSON mutation responses, not uploaded image bytes or public downloads.

[Cloudflare's RPC lifecycle documentation](https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/) describes object disposal and caller execution-context cancellation. [Its cancellation guidance](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/#handle-canceled-requests) requires checking full response bodies and both sides' outcomes. The code's unclosed response scope is a testable explanation, not proof that every historic disconnect was harmless.

Local checks cover response completion before disposal, exact bytes/cookies/headers, empty responses, oversize cancellation, broken-stream disposal and redacted failures. The existing actual Workers-runtime suite passed concurrent secure login, password creation/change/reset/revocation, denial cases, R2 upload/read and quota behavior. Deployed provider outcomes and a fresh bounded login/upload profile must pass before declaring the correction validated. Production remains unchanged and PR #3 stays draft.
