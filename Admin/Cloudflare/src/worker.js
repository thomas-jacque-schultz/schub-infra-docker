import { page } from "./pages.js";

// 502-504 : cloudflared ou nginx sans amont. 520-527, 530 : Cloudflare sans réponse de l'origine (530 = tunnel coupé).
const PANNES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);
const RETRY_AFTER = 60;
export const BYPASS_PATH = "/.maintenance/bypass";
export const BYPASS_COOKIE = "schub_bypass";

const produit = (hote) => (hote.endsWith("premadelab.eu") ? "PremadeLab" : "Schub");
const langue = (url) => (url.pathname === "/en" || url.pathname.startsWith("/en/") ? "en" : "fr");
const estApi = (url) => url.pathname === "/api" || url.pathname.startsWith("/api/");

function egal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

function cookie(request, nom) {
  const entete = request.headers.get("Cookie") ?? "";
  for (const morceau of entete.split(";")) {
    const [cle, ...valeur] = morceau.trim().split("=");
    if (cle === nom) {
      return valeur.join("=");
    }
  }
  return null;
}

const autorise = (request, env) => Boolean(env.BYPASS_TOKEN) && egal(cookie(request, BYPASS_COOKIE), env.BYPASS_TOKEN);

function indisponible(kind, url) {
  const entetes = { "Retry-After": String(RETRY_AFTER), "Cache-Control": "no-store" };
  if (estApi(url)) {
    return new Response(JSON.stringify({ error: "unavailable", reason: kind }), {
      status: 503,
      headers: { ...entetes, "Content-Type": "application/json" },
    });
  }
  const html = page({ kind, lang: langue(url), product: produit(url.hostname), retryAfter: RETRY_AFTER });
  return new Response(html, { status: 503, headers: { ...entetes, "Content-Type": "text/html; charset=utf-8" } });
}

// Le jeton ne sert qu'à poser le cookie : l'URL ne doit pas rester dans l'historique.
function contournement(url, env) {
  if (!env.BYPASS_TOKEN || !egal(url.searchParams.get("token"), env.BYPASS_TOKEN)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Set-Cookie": `${BYPASS_COOKIE}=${env.BYPASS_TOKEN}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400`,
      "Cache-Control": "no-store",
    },
  });
}

const estJson = (reponse) => (reponse.headers.get("Content-Type") ?? "").includes("json");

export default {
  async fetch(request, env, ctx) {
    ctx?.passThroughOnException?.();
    const url = new URL(request.url);
    if (url.pathname === BYPASS_PATH) {
      return contournement(url, env);
    }
    if (env.MAINTENANCE === "on" && !autorise(request, env)) {
      return indisponible("maintenance", url);
    }
    let reponse;
    try {
      reponse = await fetch(request);
    } catch {
      return indisponible("outage", url);
    }
    // Une erreur JSON vient du BFF : le front sait la lire, on la laisse passer.
    if (PANNES.has(reponse.status) && !estJson(reponse)) {
      return indisponible("outage", url);
    }
    return reponse;
  },
};
