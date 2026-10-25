import { buildOpenApi } from "@/lib/openapi";

/** OpenAPI document, development only (wiki/finfy/codebase.md → API documentation). */
export function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  return Response.json(buildOpenApi(new URL(request.url).origin));
}
