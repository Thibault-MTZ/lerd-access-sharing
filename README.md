# Accès et partages LERD

> **Bêta expérimentale — usage local personnel.** Ce plugin est en cours de
> développement et n'est pas encore prêt pour une diffusion ou une utilisation
> générale. Il n'a pas été soumis au catalogue ni à la communauté LERD comme
> proposition officielle. Le dépôt public permet de suivre le travail ; il ne
> constitue pas une version stable ni une recommandation pour la production.

Si vous découvrez ce projet, **vos avis sont les bienvenus** : ergonomie,
fonctionnement, intégration aux API LERD ou idées d'amélioration. Vous pouvez
[ouvrir une issue](https://github.com/Thibault-MTZ/lerd-access-sharing/issues)
pour partager un retour ou signaler un problème. Précisez votre version de LERD
et les étapes utiles, sans joindre de mots de passe, jetons ou configuration privée.
Il n'est pas nécessaire d'installer le plugin pour donner un avis sur son approche.

Documentation : [utilisation](DOCS.md) · [premiers repères techniques](docs/TECHNIQUE.md).

La [proposition UX commune](docs/UX-COMMUNE.md) prépare la cohérence avec le futur
plugin [Archives de projets](https://github.com/Thibault-MTZ/lerd-project-archive).
Les préférences d'affichage et de repli restent à développer ; cette documentation
ne change pas les réglages de la version actuelle.

Plugin natif local, fondé sur le squelette produit par `lerd plugin new`.
Le dépôt est indépendant de toute configuration d’hébergement.

## Historique du démarrage

Ce projet est né comme un test personnel pour mon Homelab. Avec l'arrivée du
système de plugins de LERD, j'ai commencé à en faire un plugin réutilisable,
indépendant de ma configuration. Je souhaite le proposer prochainement à la
communauté, après avoir avancé les tests et stabilisé une première bêta.

Le tout premier prototype a été préparé localement avant son intégration dans ce
dépôt. Les premières étapes ont ensuite été regroupées rapidement en commits pour
retracer une suite logique : squelette, lecture native, tests, corrections et
interface. Ce début d'historique présente les jalons du prototype ; il ne prétend
pas être un relevé exhaustif de chaque modification locale. La suite est suivie
dans Git avec des changements testés et cohérents.

La version de développement **0.2.0-beta.4** ajoute une liste compacte avec filtres
rapides, compteurs, recherche par domaine, tri et cartes automatiques sur mobile.
La publication et les signaux d'exécution sont indépendants : pause, veille, PHP
et workers proviennent exclusivement de `GET /api/sites`. Un champ absent reste
non rapporté ; un moteur PHP actif peut être partagé et ne prouve pas la santé
d'une application. Le plugin ne lit ni systemd, ni les fichiers internes de LERD.

La version précédente a ajouté la configuration des protections
par site et worktree : IP autorisées, Basic Auth, combinaison des deux, fermeture
et limite de requêtes par client. Le proxy **LERD** applique les règles, y compris
sur les ports directs ; le plugin ne dépend ni de Gestion ni d'un Caddy local.

L'inventaire regroupe les projets et leurs worktrees, avec recherche, filtres,
tri et détails techniques disponibles dans LERD. Sur un cœur compatible avec
`ui.share_action`, le menu de partage proxy actif propose **Protection d’accès** :
il ouvre directement la règle du site ou du worktree sélectionné. Les versions
sans cette extension conservent la page et l'onglet de site **Accès**.

La vue complète propose une arborescence des projets et worktrees, ou des cartes,
avec les couleurs et palettes du tableau de bord. Les nouveaux worktrees sans
règle explicite héritent du projet parent sur un cœur compatible ; une exception
peut être créée puis réinitialisée avec confirmation. Les règles explicites déjà
enregistrées sont conservées. Les révisions du parent et de la branche protègent
les modifications concurrentes.

**Compatibilité : cette fonction nécessite une version LERD exposant
`/api/share-access`, développée dans [le fork LERD](https://github.com/Thibault-MTZ/lerd).
Elle ne fait pas encore partie de LERD officiel.** Sans cette capacité, l'interface
signale l'incompatibilité et ne confirme aucune protection. La version0.1 reste
un inventaire en lecture seule. Valider la nouvelle version avant de retirer une
passerelle existante.

La page **Accès et partages** et l'onglet **Accès** d'un site proposent les règles
de la cible exacte. Une application explicite et un contrôle de révision évitent
d'écraser une modification concurrente. Les mots de passe sont transmis à LERD
pour hachage et ne sont jamais renvoyés à l'interface. La limite de requêtes produit
une réponse429 ; elle ne limite pas le débit de téléchargement.

## Inventaire natif conservé

- Page native **Accès et partages**, recherche et filtre des partages actifs.
- Sites et worktrees, branche Git, mode LAN/public/fermé et URL native.
- `GET /api/plugins/lerd-access-sharing/shares` et commande
  `lerd lerd-access-sharing:shares`.
- Lecture exclusive de `GET /api/sites`, avec le jeton fourni au processus par
  LERD. Aucun fichier de configuration interne n’est lu ou modifié.
- Pas de jeton ni de données d’hébergement enregistrés ; pas de redirection HTTP
  et pas de proxy HTTP système pour les appels à l’API locale.

## Installation et tests

Dans le dossier du dépôt, sur la machine qui exécute LERD :

```sh
python3 -m unittest discover -s tests -v
lerd plugin install .
lerd plugin list
lerd lerd-access-sharing:shares
```

Exécuter aussi `node tests/test_ui.cjs` pour le contrôle de l'interface en développement.
Rechargez le tableau de bord LERD pour voir la page. Le plugin utilise uniquement
Python 3 standard et le pont d’interface du squelette natif. Il n’installe aucun
service ou binaire LERD modifié lui-même. Le cœur compatible doit être installé
séparément. Une installation copie les fichiers : un `git pull` ne met pas la
copie installée à jour ; utiliser les commandes natives de retrait et de
réinstallation pour la remplacer. Aucun projet n'est supprimé par ce retrait.

Le dépôt impose les fins de ligne LF, y compris lors d’un export Git depuis
Windows : les exécutables natifs ne doivent jamais contenir de shebang CRLF.

## Limites assumées

L’API fournit une URL publique même pour certains partages **inactifs** : seul
`public_shared: true` est interprété comme un partage public actif. L’API actuelle
ne fournit pas le numéro du port public. Les règles sont lues séparément depuis
`/api/share-access` ; elles ne décrivent pas les politiques d'une passerelle externe.

Les tunnels externes ne sont pas couverts. La présence d’un partage natif ne
prouve pas son accessibilité Internet, la configuration DNS/TLS ou la sécurité
de l’application. L’accès direct au port natif et l’accès via une passerelle
sont distincts.

Les hooks de plugins LERD actuels interviennent après une opération réussie ;
ils ne constituent pas un point d’interception bloquant des requêtes HTTP.
L'édition utilise donc un contrat natif distinct, pas ces hooks. Basic Auth doit
être utilisé à travers HTTPS. La confiance dans les en-têtes d'IP nécessite des
relais explicitement approuvés dans la configuration LERD ; aucune adresse propre
à un hébergement n'est codée en dur dans ce plugin.

## Origine du squelette

Le pont `ui/lerd.js` et l’icône viennent du générateur LERD 1.38, sous licence MIT
(voir `LICENSE`). Aucun binaire LERD modifié n’est inclus.
