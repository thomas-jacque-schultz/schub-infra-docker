// Offre gratuite : au-delà de 100 000 requêtes par jour, une route « fail closed » renvoie l'erreur 1027.
// En « fail open », la requête va à l'origine sans passer par le Worker. wrangler ne règle pas ce drapeau.
const script = process.argv[2];
const zones = ["premadelab.eu", "schultz-thomas.fr"];
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!script || !token) {
  console.error("Usage : CLOUDFLARE_API_TOKEN=… node scripts/fail-open.mjs <nom du Worker>");
  process.exit(1);
}

async function api(chemin, options = {}) {
  const reponse = await fetch(`https://api.cloudflare.com/client/v4${chemin}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const corps = await reponse.json();
  if (!corps.success) {
    throw new Error(`${chemin} : ${JSON.stringify(corps.errors)}`);
  }
  return corps.result;
}

for (const nom of zones) {
  const [zone] = await api(`/zones?name=${nom}`);
  for (const route of await api(`/zones/${zone.id}/workers/routes`)) {
    if (route.script !== script || route.request_limit_fail_open) {
      continue;
    }
    await api(`/zones/${zone.id}/workers/routes/${route.id}`, {
      method: "PUT",
      body: JSON.stringify({ pattern: route.pattern, script, request_limit_fail_open: true }),
    });
    console.log(`${route.pattern} : fail open`);
  }
}
