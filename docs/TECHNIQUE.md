# Premiers repères techniques

## Statut et périmètre

Version **0.2.0-beta.4**, expérimentale et utilisée localement. Le dépôt est public
pour montrer l'avancement et recueillir des avis ; le plugin n'est pas prêt pour
une diffusion générale, n'est pas une extension officielle et n'a pas été soumis
au catalogue ou à la communauté LERD.

Il présente les sites et worktrees et permet de préparer puis d'appliquer leurs
protections natives. Le démarrage, l'arrêt et la publication restent dans LERD.
Le plugin n'installe aucun proxy, service système ou cœur LERD modifié.

## Architecture

```text
Tableau de bord LERD
  └─ iframe du plugin : ui/index.html + ui/view.js
       └─ pont natif ui/lerd.js : lerd.api(...)
            └─ routes déclarées dans plugin.yaml
                 ├─ GET shares → bin/shares → GET /api/sites
                 │                         └→ GET /api/share-access
                 └─ GET/POST policy → bin/policy → /api/share-access
```

Le manifeste déclare aussi la commande `lerd lerd-access-sharing:shares`, la page
globale, l'onglet de site et l'action contextuelle de protection. LERD fournit
le contexte de cible et les variables d'environnement nécessaires aux exécutables.

| Fichier | Responsabilité |
|---|---|
| `plugin.yaml` | Identité, version, commandes, routes et intégrations UI |
| `access_sharing.py` | Lecture de l'API locale et normalisation de l'inventaire |
| `native_policy.py` | Validation des politiques, appels natifs, héritage et révisions |
| `bin/shares`, `bin/policy` | Adaptation entre le processus plugin et ses routes/commande |
| `ui/lerd.js` | Pont natif iframe/tableau de bord |
| `ui/view.js` | Filtres, tri, états, rendu et confirmation des changements |
| `ui/index.html` | Structure, contrôles accessibles et styles adaptés au thème |
| `tests/` | Tests Python et contrôles JavaScript |

## Contrats et états

L'inventaire normalisé conserve `schema_version: 1`. Les métadonnées `runtime`
sont additives ; une interface ne doit pas supposer leur présence sur une ancienne
version. `read_only: true` concerne cet inventaire, pas la route d'édition des règles.

- `public_shared` et `lan_port` déterminent le type de publication. Une URL
  publique suggérée ne suffit pas à déclarer un partage actif.
- Pause, veille, état PHP et workers proviennent exclusivement de `/api/sites`.
  Aucun processus n'est inspecté par le plugin et aucun fichier interne n'est lu.
- Le moteur PHP peut être partagé : son activité ne prouve pas que chaque page
  fonctionne. Le statut FPM du parent n'est pas attribué à un worktree qui ne le
  rapporte pas. Une valeur absente reste **Non rapporté**.
- `branch` est l'identité native du worktree ; `git_branch` sert à l'affichage.
  Les deux ne sont pas interchangeables.
- Les règles sont lues séparément via `/api/share-access`. Les révisions du parent
  et de la branche permettent au cœur de refuser une écriture concurrente périmée.

L'interface ne change aucune protection lors d'une recherche, d'un tri ou d'une
actualisation. L'édition présente un résumé et exige une confirmation explicite.
La politique est appliquée par le cœur LERD, jamais par du JavaScript client.

## Compatibilité et sécurité

Le manifeste cible LERD 1.38 ou supérieur, mais **le numéro de version seul ne
garantit pas les capacités requises**. L'édition nécessite `/api/share-access`,
actuellement développé dans le [fork personnel de LERD](https://github.com/Thibault-MTZ/lerd).
Elle n'est pas encore une capacité garantie de LERD officiel. Sans ce contrat,
le plugin signale l'indisponibilité ; il ne prétend pas appliquer une protection.

Les appels backend utilisent `LERD_API_URL` et `LERD_API_TOKEN` fournis par LERD.
L'URL doit être locale ; les redirections et les proxies HTTP d'environnement sont
désactivés pour éviter de transmettre le jeton ailleurs. Le jeton n'est pas intégré
au HTML. Les secrets Basic sont transmis au cœur pour hachage, ne sont pas renvoyés
par les lectures et ne doivent jamais figurer dans les logs, fixtures ou issues.
Le formulaire est limité à 64 Kio. Un accès distant Basic nécessite HTTPS.

Le filtrage dépend de l'IP réellement vue par LERD et de la configuration de confiance
des relais. Le plugin ne gère pas cette configuration. Les partages LAN et les
tunnels externes restent distincts du proxy public protégé.

## Développement local

Python 3 standard suffit pour le backend ; Node.js sert aux contrôles UI.

```sh
python3 -m unittest discover -s tests -v
node tests/test_ui.cjs
git diff --check
```

Sur une installation de test compatible :

```sh
lerd plugin install .
lerd plugin list
lerd lerd-access-sharing:shares
```

L'installation copie les fichiers : modifier le checkout ou faire `git pull` ne
met pas automatiquement la copie installée à jour. Pour une mise à jour locale,
sauvegarder la copie installée, utiliser les commandes natives adaptées à sa
version de LERD, puis contrôler la page, les filtres et les règles avant/après.
Ne pas importer la configuration privée d'un autre environnement.

Conserver les fichiers exécutables en LF. Pour une évolution, ajouter d'abord des
fixtures d'API anonymisées et les tests de normalisation, puis les états UI.
Vérifier liste vide, erreur API, champs absents, worktrees, mobile et confirmation.
Les tests automatisés ne remplacent pas la validation sur un cœur compatible.

## Avant une éventuelle soumission communautaire

- Stabiliser et documenter le contrat natif avec le projet LERD.
- Tester installation, mise à jour et retour arrière sur une machine indépendante.
- Compléter les tests de compatibilité, d'accessibilité et de sécurité.
- Définir le support des versions et les limites d'utilisation.

Les [retours et suggestions](https://github.com/Thibault-MTZ/lerd-access-sharing/issues)
sont bienvenus dès maintenant, y compris sans installation. Il n'y a pas encore
de date ni d'engagement de publication communautaire.
