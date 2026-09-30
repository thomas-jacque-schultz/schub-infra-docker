// Déploiement : npx wrangler@4 deploy (avec CLOUDFLARE_API_TOKEN)
const PAGE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>Bientôt de retour</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; text-align: center;
         background: #0A060C; color: #F2E9EE; font-family: system-ui, sans-serif; }
  h1 { color: #C9A227; }
</style>
</head>
<body>
<main>
  <h1>Bientôt de retour</h1>
  <p>Le site est en maintenance. Revenez dans quelques minutes.</p>
  <p lang="en">Back soon: the site is under maintenance.</p>
</main>
</body>
</html>`;

export default {
  async fetch(request) {
    try {
      const response = await fetch(request);
      if (response.status < 502 || response.headers.get("Content-Type")?.includes("json")) {
        return response;
      }
    } catch {}
    return new Response(PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
};
