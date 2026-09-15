# Contrats inter-services

Ce dossier est la **source de vérité** des échanges entre services Schub.

Tous les échanges sont des appels **HTTP directs** authentifiés par l'en-tête
`X-Internal-Secret`. Il n'y a pas de broker de messages — le raisonnement est dans
`Schub/docs/migration-microservices.md`, §5.

## Pourquoi pas un jar partagé

Un artefact de contrats commun impose une cadence de release commune à tous les services,
ce que la découpe cherche précisément à éviter. Chaque service écrit ses propres records ;
ce dossier dit à quoi ils doivent ressembler.

Le prix est une duplication qui peut dériver. La contrepartie est que **toute évolution de
contrat passe par une modification ici**, visible en revue, avant d'être implémentée.

## Contenu attendu

| Fichier | Décrit | État |
|---|---|---|
| `connector-freebox.openapi.yaml` | redirections de ports du routeur | écrit (phase 1) |
| `connector-portainer.openapi.yaml` | stacks, sonde d'état datée | écrit (phase 2) |
| `connector-discord.openapi.yaml` | notifications poussées vers Discord | à écrire (phase 3) |
| `core.openapi.yaml` | GameServer exposés au BFF et aux connecteurs | à écrire (phase 3) |

## Règle de compatibilité

- Ajouter un champ optionnel à une réponse : compatible, rien à versionner.
- Retirer ou renommer un champ, changer un type, changer un chemin : **incompatible**.
  Exposer la nouvelle forme en parallèle, migrer les appelants, puis retirer l'ancienne.
- Les appelants ignorent les champs qu'ils ne connaissent pas.

## Deux invariants à ne jamais casser

1. **Un connecteur n'expose que du vocabulaire de domaine.** `connector-freebox` renvoie des
   `PortRule`, jamais des `FreeboxRedirection`. C'est ce qui rend le connecteur remplaçable.
2. **Toute lecture d'état issue d'un cache est datée** (`observedAt`). L'appelant doit pouvoir
   décider qu'une valeur est trop vieille pour être crue.
