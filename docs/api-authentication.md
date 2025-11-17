# API authentication helper

`lib/server/authenticate-request.ts` centralizes the logic for reading the `Authorization` header, verifying the Firebase token, and exposing the decoded claims in a typed way. It also memoizes verification work per `NextRequest` instance via `WeakMap`, so multiple helpers in the same handler do not re-verify the token.

## Basic usage

```ts
import { authenticateRequest, handleAuthError } from "@/lib/server/authenticate-request"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    // auth.uid, auth.email, and auth.claims are available here.
    return NextResponse.json({ message: `Hello ${auth.uid}` })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    return NextResponse.json({ error: "Unexpected failure" }, { status: 500 })
  }
}
```

`handleAuthError` converts the structured `AuthError` thrown by the helper into consistent `401`/`403` responses. Any other errors keep flowing to the route's own error handling.

## Claim requirements

You can require specific custom claims (truthy) or check for explicit values without re-verifying the token downstream:

```ts
await authenticateRequest(request, {
  requireClaims: [
    "admin", // claim must exist and be truthy
    { key: "tenant", value: "demo" }, // claim must equal a specific value
  ],
})
```

If the claim check fails, the helper throws a `403` `AuthError`, which the caller can convert into a HTTP response the same way as in the basic example above.

## Try/catch versus direct helper errors

When you already have a `try/catch` block inside your route, call `handleAuthError` inside the `catch` to turn authentication failures into HTTP responses before handling other errors:

```ts
export async function POST(request: NextRequest) {
  try {
    const { uid } = await authenticateRequest(request)
    // ... route logic ...
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) {
      return authResponse
    }
    // fall back to your existing error handling
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
```

If you are not wrapping code in `try/catch`, you can return early when the helper throws:

```ts
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request).catch((error) => {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    throw error
  })
  if (auth instanceof NextResponse) {
    return auth
  }

  return NextResponse.json({ data: auth.uid })
}
```

This pattern demonstrates how to let the helper drive the HTTP response without forcing a larger `try/catch`, while still keeping the structured `AuthError` behavior.
