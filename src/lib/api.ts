import { NextResponse } from "next/server";

export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function internalErrorResponse(message = "Something went wrong") {
  return errorResponse(500, "INTERNAL_ERROR", message);
}

export function validationErrorResponse(message = "Invalid input") {
  return errorResponse(422, "VALIDATION_ERROR", message);
}

export function unauthorizedResponse(message = "Authentication required") {
  return errorResponse(401, "UNAUTHORIZED", message);
}

export function forbiddenResponse(message = "Forbidden") {
  return errorResponse(403, "FORBIDDEN", message);
}

export function rateLimitedResponse(message = "Too many requests") {
  return errorResponse(429, "RATE_LIMITED", message);
}

export function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}
