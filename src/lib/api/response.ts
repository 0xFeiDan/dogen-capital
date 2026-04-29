import { NextResponse } from "next/server";

export function badRequest(error = "Invalid request") {
  return NextResponse.json({ error }, { status: 400 });
}

export function forbidden(error = "Invalid request origin") {
  return NextResponse.json({ error }, { status: 403 });
}

export function serverError(error: unknown, publicMessage = "Request failed") {
  console.error(publicMessage, error);
  return NextResponse.json({ error: publicMessage }, { status: 500 });
}

export function upstreamError(error: unknown, publicMessage = "Upstream request failed") {
  console.error(publicMessage, error);
  return NextResponse.json({ error: publicMessage }, { status: 502 });
}
