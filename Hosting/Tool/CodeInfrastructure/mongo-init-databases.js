// Crée un utilisateur par service sur sa propre base logique.
//
// Idempotent : rejouable, met à jour le mot de passe si l'utilisateur existe déjà.
// Les mots de passe viennent de l'environnement — rien n'est écrit en dur ici.
//
//   mongosh "mongodb://<root>:<pass>@<hôte>:27017/admin" scripts/mongo-init-databases.js
//
// Les variables attendues : MONGO_BOT_PASSWORD, MONGO_SERVERS_PASSWORD, MONGO_RIOT_PASSWORD.
// Une variable absente fait sauter le service correspondant, sans échouer.

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
    print(`  ${service.database} : ignorée (${service.passwordEnv} absent)`);
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
