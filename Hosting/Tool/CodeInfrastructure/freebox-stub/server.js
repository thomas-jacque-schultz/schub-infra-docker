// Fausse Freebox pour le développement.
//
// Il n'existe qu'une seule vraie box, partagée par le dev et la prod. Sans ce stub, un dev
// qui sort du dry-run écrit sur le routeur réel et ferme les ports de production. Aucune
// séparation de base de données ne protège de ça : c'est le routeur lui-même qui est unique.
//
// Reproduit le strict nécessaire de l'API Freebox OS v16 utilisée par le connecteur :
// négociation de version, ouverture de session, et le CRUD sur /fw/redir/.
//
// Volontairement sans dépendance ni persistance : l'état vit en mémoire et repart du jeu
// d'essai à chaque redémarrage, ce qui rend les tests reproductibles.

const http = require("http");

const PORT = Number(process.env.PORT || 8080);

// Jeu d'essai fictif, calqué sur la FORME de ce qu'on trouve sur la vraie box (règles
// manuelles sans libellé, et une règle déjà marquée) sans en reprendre les valeurs.
let nextId = 100;
let redirections = [
  mk({ enabled: true,  comment: "",                   ip_proto: "tcp", wan: 80,    lan_ip: "192.168.1.200", lan_port: 80 }),
  mk({ enabled: true,  comment: "",                   ip_proto: "tcp", wan: 8123,  lan_ip: "192.168.1.200", lan_port: 8123 }),
  mk({ enabled: true,  comment: "",                   ip_proto: "tcp", wan: 25565, lan_ip: "192.168.1.202", lan_port: 25565 }),
  mk({ enabled: true,  comment: "",                   ip_proto: "udp", wan: 25565, lan_ip: "192.168.1.202", lan_port: 25565 }),
  mk({ enabled: false, comment: "[schub] demo-legacy", ip_proto: "tcp", wan: 27015, lan_ip: "192.168.1.202", lan_port: 27015 }),
];

function mk({ enabled, comment, ip_proto, wan, lan_ip, lan_port }) {
  return {
    id: nextId++,
    enabled,
    comment,
    ip_proto,
    wan_port_start: wan,
    wan_port_end: wan,
    lan_ip,
    lan_port,
    src_ip: "0.0.0.0",
    hostname: "",
  };
}

const ok = (result) => ({ success: true, result });
const ko = (error_code, msg) => ({ success: false, error_code, msg });

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://stub");
  const path = url.pathname;
  console.log(`${req.method} ${path}`);

  // Négociation de version : le connecteur en déduit le préfixe /api/vXX.
  if (path === "/api_version") {
    return send(res, 200, {
      box_model_name: "Freebox v8 (r1) [STUB]",
      api_base_url: "/api/",
      api_version: "16.0",
      device_name: "Freebox Server (stub de développement)",
      device_type: "FreeboxServer8,1",
      https_available: false,
    });
  }

  const api = "/api/v16";
  if (!path.startsWith(api)) {
    return send(res, 404, ko("not_found", "Chemin inconnu du stub"));
  }
  const route = path.slice(api.length);

  // Le connecteur prouve la possession du jeton par un HMAC-SHA1 du challenge. Le stub ne
  // vérifie rien : il n'a pas de jeton à protéger, et exiger le bon secret en dev ne
  // ferait que recréer l'obstacle que ce stub existe pour supprimer.
  if (route === "/login/" && req.method === "GET") {
    return send(res, 200, ok({ logged_in: false, challenge: "stub-challenge", password_set: true }));
  }
  if (route === "/login/session/" && req.method === "POST") {
    await readBody(req);
    return send(res, 200, ok({
      session_token: "stub-session-token",
      // La permission que le connecteur exige pour s'autoriser à écrire.
      permissions: { settings: true, parental: false, explorer: false },
    }));
  }

  // --- redirections de ports ---
  if (route === "/fw/redir/" && req.method === "GET") {
    return send(res, 200, ok(redirections));
  }

  if (route === "/fw/redir/" && req.method === "POST") {
    const body = await readBody(req);
    const start = body.wan_port_start;
    const proto = body.ip_proto;
    if (redirections.some((r) => r.ip_proto === proto && r.wan_port_start === start)) {
      // La vraie box refuse deux règles sur le même couple protocole/port WAN.
      return send(res, 200, ko("conflict", `Une redirection existe déjà sur ${proto}/${start}`));
    }
    const created = {
      id: nextId++,
      enabled: body.enabled ?? true,
      comment: body.comment ?? "",
      ip_proto: proto,
      wan_port_start: start,
      wan_port_end: body.wan_port_end ?? start,
      lan_ip: body.lan_ip,
      lan_port: body.lan_port ?? start,
      src_ip: body.src_ip ?? "0.0.0.0",
      hostname: "",
    };
    redirections.push(created);
    return send(res, 200, ok(created));
  }

  const match = route.match(/^\/fw\/redir\/(\d+)$/);
  if (match) {
    const id = Number(match[1]);
    const index = redirections.findIndex((r) => r.id === id);
    if (index === -1) {
      return send(res, 200, ko("nodev", `Aucune redirection ${id}`));
    }
    if (req.method === "PUT") {
      const patch = await readBody(req);
      // Comme la vraie box : seuls les champs fournis sont écrasés.
      for (const [key, value] of Object.entries(patch)) {
        if (value !== null && value !== undefined && key !== "id") {
          redirections[index][key] = value;
        }
      }
      return send(res, 200, ok(redirections[index]));
    }
    if (req.method === "DELETE") {
      redirections.splice(index, 1);
      return send(res, 200, ok(null));
    }
  }

  return send(res, 404, ko("not_found", `Route non implémentée par le stub: ${req.method} ${route}`));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Stub Freebox à l'écoute sur :${PORT} — ${redirections.length} redirections en mémoire`);
  console.log("Aucune requête ne sort vers la vraie box.");
});
