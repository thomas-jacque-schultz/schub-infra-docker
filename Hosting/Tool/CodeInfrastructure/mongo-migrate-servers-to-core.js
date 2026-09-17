// Migration phase 3 : la collection `servers` passe du connecteur Discord au cœur.
//
// Deux changements simultanés, d'où la prudence : elle change de BASE (discordbot -> servers)
// ET de SCHÉMA (identifier -> slug, portainerStackId -> deploymentId, gameName -> game).
//
// Rejouable : chaque document est repéré par son _id, et un document déjà migré est mis à jour
// plutôt que dupliqué. La source n'est jamais supprimée — c'est elle, la sauvegarde.
//
//   mongosh "mongodb://<root>:<pass>@localhost:27017/admin" --quiet --eval "$(cat ce-fichier.js)"

const SOURCE_DB = "discordbot";
const TARGET_DB = "servers";

const source = db.getSiblingDB(SOURCE_DB);
const target = db.getSiblingDB(TARGET_DB);

function migrateGameServers() {
    const docs = source.getCollection("servers").find({}).toArray();
    let created = 0;
    let updated = 0;

    docs.forEach(doc => {
        const migrated = {
            _id: doc._id,
            // Renommages du §2. On tolère les documents déjà migrés : si `slug` existe déjà,
            // il fait foi, sinon on reprend l'ancien champ.
            slug: doc.slug !== undefined ? doc.slug : doc.identifier,
            deploymentId: doc.deploymentId !== undefined ? doc.deploymentId : doc.portainerStackId,
            game: doc.game !== undefined ? doc.game : doc.gameName,
            name: doc.name,
            urlConnection: doc.urlConnection,
            playersMax: doc.playersMax,
            installation: doc.installation,
            version: doc.version,
            description: doc.description,
            admins: doc.admins || [],
            ports: doc.ports || [],
            status: doc.status,
            lastStatusCheckAt: doc.lastStatusCheckAt,
            lastStatusChangeAt: doc.lastStatusChangeAt,
            statusHistory: doc.statusHistory || [],
            _class: "schultz.thomas.schub.core.model.GameServer"
        };

        const existing = target.getCollection("servers").findOne({ _id: doc._id });
        target.getCollection("servers").replaceOne({ _id: doc._id }, migrated, { upsert: true });
        if (existing) { updated++; } else { created++; }
        print("  " + migrated.slug + " -> déploiement " + migrated.deploymentId);
    });

    print("servers : " + created + " créé(s), " + updated + " mis à jour.");
}

function migrateStaticPortRules() {
    const docs = source.getCollection("static_port_rules").find({}).toArray();
    let count = 0;
    docs.forEach(doc => {
        doc._class = "schultz.thomas.schub.core.model.StaticPortRuleEntity";
        target.getCollection("static_port_rules").replaceOne({ _id: doc._id }, doc, { upsert: true });
        count++;
    });
    print("static_port_rules : " + count + " document(s) repris.");
}

print("Migration " + SOURCE_DB + " -> " + TARGET_DB);
migrateGameServers();
migrateStaticPortRules();
print("La source n'a pas été touchée : elle sert de sauvegarde.");
