const allowedHosts = new Set(["export.arxiv.org", "api.biorxiv.org", "eutils.ncbi.nlm.nih.gov"]);

const cacheDurations = {
  "export.arxiv.org": 60 * 60 * 2,
  "api.biorxiv.org": 60 * 60,
  "eutils.ncbi.nlm.nih.gov": 60 * 15,
};

export async function onRequest({ request, env, waitUntil }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "GET") {
    return json({ error: "Only GET requests are supported" }, 405);
  }

  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url");

  if (!target) {
    return json({ error: "Missing url parameter" }, 400);
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return json({ error: "Invalid url parameter" }, 400);
  }

  if (!allowedHosts.has(targetUrl.hostname)) {
    return json({ error: "Host is not allowed" }, 403);
  }

  addNcbiParams(targetUrl, env);

  const ttl = cacheDurations[targetUrl.hostname] ?? 300;
  const cache = caches.default;
  const cacheKey = new Request(requestUrl.toString(), request);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    const headers = new Headers(cachedResponse.headers);
    headers.set("X-PaprFeed-Cache", "HIT");
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
  addCors(headers);

  const proxiedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  if (response.ok) {
    waitUntil?.(cache.put(cacheKey, proxiedResponse.clone()));
  }

  return proxiedResponse;
}

function addNcbiParams(targetUrl, env) {
  if (targetUrl.hostname !== "eutils.ncbi.nlm.nih.gov") return;
  if (env?.NCBI_TOOL) targetUrl.searchParams.set("tool", env.NCBI_TOOL);
  if (env?.NCBI_EMAIL) targetUrl.searchParams.set("email", env.NCBI_EMAIL);
  if (env?.NCBI_API_KEY) targetUrl.searchParams.set("api_key", env.NCBI_API_KEY);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
  };
}

function addCors(headers) {
  Object.entries(corsHeaders()).forEach(([key, value]) => headers.set(key, value));
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}
