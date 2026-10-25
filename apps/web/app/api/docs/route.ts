/**
 * Swagger UI over /api/openapi.json, development only. "Try it out" calls the
 * API from this same origin, so the Origin check and the session cookie work.
 */
const SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>finfy API</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
  <style>body { margin: 0; background: #fff; }</style>
</head>
<body>
  <div id="swagger"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger", withCredentials: true });
  </script>
</body>
</html>`;

export function GET() {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
}
