const allowedHosts = new Set(["export.arxiv.org", "api.biorxiv.org", "eutils.ncbi.nlm.nih.gov"]);
const defaultAllowedOrigins = ["https://paprfeed.pages.dev", "http://127.0.0.1:5174", "http://localhost:5174"];

const cacheDurations = {
  "export.arxiv.org": 60 * 60 * 2,
  "api.biorxiv.org": 60 * 60,
  "eutils.ncbi.nlm.nih.gov": 60 * 15,
};

export async function onRequest({ request, env, waitUntil }) {
  const requestUrl = new URL(request.url);
  const corsOrigin = allowedCorsOrigin(request, requestUrl, env);

  if (corsOrigin === false) {
    return json({ error: "Origin is not allowed" }, 403);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(corsOrigin) });
  }

  if (request.method !== "GET") {
    return json({ error: "Only GET requests are supported" }, 405, corsOrigin);
  }

  const target = requestUrl.searchParams.get("url");

  if (!target) {
    return json({ error: "Missing url parameter" }, 400, corsOrigin);
  }

  if (target.length > 2000) {
    return json({ error: "URL is too long" }, 414, corsOrigin);
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return json({ error: "Invalid url parameter" }, 400, corsOrigin);
  }

  if (targetUrl.protocol !== "https:") {
    return json({ error: "Only HTTPS URLs are allowed" }, 403, corsOrigin);
  }

  if (!allowedHosts.has(targetUrl.hostname)) {
    return json({ error: "Host is not allowed" }, 403, corsOrigin);
  }

  if (!isAllowedPath(targetUrl)) {
    return json({ error: "Path is not allowed" }, 403, corsOrigin);
  }

  addNcbiParams(targetUrl, env);

  const ttl = cacheDurations[targetUrl.hostname] ?? 300;
  const cache = caches.default;
  const cacheKey = new Request(requestUrl.toString(), request);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    const headers = new Headers(cachedResponse.headers);
    headers.set("X-PaprFeed-Cache", "HIT");
    addCors(headers, corsOrigin);
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  }

  const response = await fetch(targetUrl.toString(), {
    headers: {
      "User-Agent": "PaprFeed/0.1 (research feed PWA)",
      Accept: request.headers.get("Accept") ?? "*/*",
    },
  });

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=86400`);
  headers.set("X-PaprFeed-Cache", "MISS");
  addCors(headers, corsOrigin);

  const proxiedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  if (response.ok) {
    const cacheHeaders = new Headers(headers);
    removeCors(cacheHeaders);
    waitUntil?.(
      cache.put(
        cacheKey,
        new Response(proxiedResponse.clone().body, {
          status: proxiedResponse.status,
          statusText: proxiedResponse.statusText,
          headers: cacheHeaders,
        }),
      ),
    );
  }

  return proxiedResponse;
}

function allowedCorsOrigin(request, requestUrl, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const configured = String(env?.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([requestUrl.origin, ...defaultAllowedOrigins, ...configured]);

  return allowedOrigins.has(origin) ? origin : false;
}

function isAllowedPath(targetUrl) {
  if (targetUrl.hostname === "export.arxiv.org") return targetUrl.pathname === "/api/query";
  if (targetUrl.hostname === "api.biorxiv.org") return targetUrl.pathname.startsWith("/details/");
  if (targetUrl.hostname === "eutils.ncbi.nlm.nih.gov") {
    return ["/entrez/eutils/esearch.fcgi", "/entrez/eutils/efetch.fcgi"].includes(targetUrl.pathname);
  }
  return false;
}

function addNcbiParams(targetUrl, env) {
  if (targetUrl.hostname !== "eutils.ncbi.nlm.nih.gov") return;
  if (env?.NCBI_TOOL) targetUrl.searchParams.set("tool", env.NCBI_TOOL);
  if (env?.NCBI_EMAIL) targetUrl.searchParams.set("email", env.NCBI_EMAIL);
  if (env?.NCBI_API_KEY) targetUrl.searchParams.set("api_key", env.NCBI_API_KEY);
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    Vary: "Origin",
  };

  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function addCors(headers, origin) {
  Object.entries(corsHeaders(origin)).forEach(([key, value]) => headers.set(key, value));
}

function removeCors(headers) {
  headers.delete("Access-Control-Allow-Origin");
  headers.delete("Access-Control-Allow-Methods");
  headers.delete("Access-Control-Allow-Headers");
}

function json(body, status, origin = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}
