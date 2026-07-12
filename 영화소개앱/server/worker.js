// REELVAULT TMDB 프록시 (Cloudflare Workers)
// 브라우저의 /api/... 요청을 TMDB /3/... 으로 중계하면서
// 서버에만 저장된 TMDB_API_KEY(시크릿)를 붙입니다. 키는 브라우저에 노출되지 않습니다.
const TMDB_ORIGIN = "https://api.themoviedb.org";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    }

    // /api/movie/popular → https://api.themoviedb.org/3/movie/popular
    const target = new URL(TMDB_ORIGIN + "/3/" + url.pathname.slice("/api/".length));
    url.searchParams.forEach((v, k) => {
      if (k !== "api_key") target.searchParams.set(k, v); // 클라이언트가 넣은 키는 무시
    });
    target.searchParams.set("api_key", env.TMDB_API_KEY);

    const upstream = await fetch(target.toString(), {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 300, cacheEverything: true }, // 같은 요청 5분 캐시로 TMDB 호출 절약
    });

    const headers = new Headers(CORS_HEADERS);
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
    headers.set("Cache-Control", "public, max-age=300");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
