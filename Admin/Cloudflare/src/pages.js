// Pages autonomes : aucune requête vers l'origine ni vers un tiers (polices système, styles en ligne).
// Couleurs : identité de schub-front-servers (tokens.ts) ; comme dans l'app, l'action est or sur sombre, prune sur clair.

const TEXTES = {
  fr: {
    outage: {
      title: "{product} ne répond pas",
      body: "Le serveur est injoignable pour l'instant. Vos données ne sont pas touchées. Réessayez dans quelques minutes.",
    },
    maintenance: {
      title: "{product} est en cours de mise à jour",
      body: "Une nouvelle version est en train d'être installée. Le site revient dans quelques minutes ; cette page se recharge toute seule.",
    },
    retry: "Réessayer",
    code: "Erreur 503 — service indisponible",
  },
  en: {
    outage: {
      title: "{product} is not responding",
      body: "The server cannot be reached right now. Your data is not affected. Please try again in a few minutes.",
    },
    maintenance: {
      title: "{product} is being updated",
      body: "A new version is being installed. The site will be back in a few minutes; this page reloads by itself.",
    },
    retry: "Try again",
    code: "Error 503 — service unavailable",
  },
};

const echappe = (texte) =>
  texte.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function page({ kind, lang, product, retryAfter }) {
  const t = TEXTES[lang];
  const titre = echappe(t[kind].title.replace("{product}", product));
  const rafraichir = kind === "maintenance" ? `<meta http-equiv="refresh" content="${retryAfter}">` : "";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
${rafraichir}
<title>${titre}</title>
<style>
  :root { color-scheme: dark light; --fond: #0A060C; --carte: #150D18; --texte: #F2E9EE; --doux: #B6A3B4; --marque: #C9A227; --action: #C9A227; --action-texte: #0A060C; --focus: #A4477E; --arete: rgba(201, 162, 39, 0.25); }
  @media (prefers-color-scheme: light) {
    :root { --fond: #F7F1F5; --carte: #FFFFFF; --texte: #1C0A18; --doux: #5C4A5A; --marque: #6B2853; --action: #6B2853; --action-texte: #FFFFFF; --focus: #8A6B12; --arete: rgba(107, 40, 83, 0.25); }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
         background: var(--fond); color: var(--texte);
         font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 34rem; width: 100%; background: var(--carte); border: 1px solid var(--arete);
         border-radius: 8px; padding: 32px; }
  .marque { font: 600 13px/1 ui-monospace, "JetBrains Mono", monospace; letter-spacing: .12em;
            text-transform: uppercase; color: var(--marque); margin: 0 0 16px; }
  h1 { font-size: 1.5rem; line-height: 1.3; margin: 0 0 12px; }
  p { margin: 0 0 24px; color: var(--doux); }
  a { display: inline-block; padding: 10px 20px; border-radius: 4px; background: var(--action); color: var(--action-texte);
      font-weight: 600; text-decoration: none; }
  a:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .code { margin: 24px 0 0; font: 12px/1.4 ui-monospace, monospace; color: var(--doux); }
</style>
</head>
<body>
<main>
  <p class="marque">${echappe(product)}</p>
  <h1>${titre}</h1>
  <p>${echappe(t[kind].body)}</p>
  <a href="">${t.retry}</a>
  <p class="code">${t.code}</p>
</main>
</body>
</html>`;
}
