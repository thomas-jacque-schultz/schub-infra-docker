// Crée un utilisateur par service sur sa propre base logique.
//
// Idempotent : rejouable, met à jour le mot de passe si l'utilisateur existe déjà.
// Rien n'est écrit en dur ici.
//
//   mongosh "mongodb://<root>:<pass>@<hôte>:27017/admin" mongo-init-databases.js
//
// Les mots de passe viennent de l'environnement : MONGO_BOT_PASSWORD, MONGO_SERVERS_PASSWORD,
// MONGO_RIOT_PASSWORD. Une variable absente fait sauter le service correspondant, sans échouer.
//
// D'OÙ CET ENVIRONNEMENT DOIT VENIR, et pourquoi c'est important :
//
//   - en prod, `task db:init:prod` exporte les valeurs depuis /run/secrets/ DANS le conteneur
//     Mongo, qui monte ces secrets Swarm ;
//   - en dev, elles viennent de .env.dev.example.
//
// Dans les deux cas c'est la MÊME source que celle dont le service tire son mot de passe. Les
// saisir à la main rouvrirait une seconde source de vérité : on créerait alors des utilisateurs
// Mongo que les services ne peuvent pas utiliser, et l'erreur ne se verrait qu'au démarrage
// suivant, en « AuthenticationFailed ». C'est exactement ce qui a fait échouer le premier
// déploiement du 17-09, où les valeurs du dev avaient été passées à la prod.
//
// (Le fichier n'est pas lu ici : `cat()` du shell mongo historique n'existe pas dans mongosh.)

const services = [
  // La base du connecteur Discord garde son nom historique `discordbot` : c'est là que vivent
  // réellement ses salons et ses utilisateurs. La renommer serait une migration de données,
  // pas un renommage — reporté en phase 6. L'utilisateur, lui, n'a de droits que sur elle.
  { database: "discordbot", user: "bot",     passwordEnv: "MONGO_BOT_PASSWORD" },
  { database: "servers",    user: "servers", passwordEnv: "MONGO_SERVERS_PASSWORD" },
  { database: "riot",       user: "riot",    passwordEnv: "MONGO_RIOT_PASSWORD" },
];

let created = 0, updated = 0, skipped = 0;

for (const service of services) {
  const password = process.env[service.passwordEnv];

  if (!password) {
    print(`  ${service.database} : ignorée (${service.passwordEnv} introuvable)`);
    skipped++;
    continue;
  }

  const target = db.getSiblingDB(service.database);
  const roles = [{ role: "readWrite", db: service.database }];

  if (target.getUser(service.user)) {
    target.updateUser(service.user, { pwd: password, roles: roles });
    print(`  ${service.database} : utilisateur '${service.user}' mis à jour`);
    updated++;
  } else {
    target.createUser({ user: service.user, pwd: password, roles: roles });
    print(`  ${service.database} : utilisateur '${service.user}' créé`);
    created++;
  }
}

print(`${created} créé(s), ${updated} mis à jour, ${skipped} ignoré(s).`);
