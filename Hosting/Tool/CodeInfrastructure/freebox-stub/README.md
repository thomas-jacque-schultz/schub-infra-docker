# Fausse Freebox pour le développement

## Pourquoi

Il n'existe **qu'une seule vraie Freebox**, partagée par le dev et la prod. Séparer les bases
de données ne protège de rien ici : c'est le routeur lui-même qui est unique. Un environnement
de dev sorti du dry-run écrirait sur le routeur réel et fermerait les ports de production.

Ce stub est la seule frontière possible entre les deux.

## Ce qu'il implémente

Le strict nécessaire de l'API Freebox OS v16 utilisée par `schub-connector-freebox` :

| Route | Rôle |
|---|---|
| `GET /api_version` | négociation de version, d'où le connecteur déduit `/api/v16` |
| `GET /api/v16/login/` | challenge |
| `POST /api/v16/login/session/` | jeton de session, avec la permission `settings` accordée |
| `GET /api/v16/fw/redir/` | liste des redirections |
| `POST /api/v16/fw/redir/` | création (refuse un doublon protocole + port WAN, comme la vraie box) |
| `PUT /api/v16/fw/redir/{id}` | mise à jour partielle |
| `DELETE /api/v16/fw/redir/{id}` | suppression |

## Ce qu'il ne fait pas, volontairement

- **Aucune vérification du jeton.** Le connecteur calcule bien son HMAC-SHA1, le stub l'ignore.
  Exiger le vrai secret en dev recréerait l'obstacle que ce stub existe pour supprimer.
- **Aucune persistance.** L'état vit en mémoire et repart du jeu d'essai à chaque redémarrage,
  ce qui rend les tests reproductibles. `docker restart` suffit à repartir propre.
- **Aucune dépendance npm.** Un seul fichier, lancé par `node server.js`.

Le jeu d'essai est **fictif** : il reprend la *forme* de ce qu'on trouve sur la vraie box
(des règles manuelles sans libellé, et une règle déjà marquée `[schub]`) sans en reprendre les
valeurs, pour ne pas publier la liste des ports réellement ouverts dans un dépôt public.

## Utilisation

Démarré automatiquement par `docker-compose.dev.yml` sous le nom `dev-freebox-stub`, et
`dev-connector-freebox` pointe dessus via `FREEBOX_BASE_URL`. Exposé sur `127.0.0.1:18099`
pour inspection directe.

Pour viser la vraie box depuis le dev — à ne faire qu'en connaissance de cause :

```
FREEBOX_BASE_URL=http://192.168.1.254 FREEBOX_APP_TOKEN=<le vrai jeton> task dev
```
