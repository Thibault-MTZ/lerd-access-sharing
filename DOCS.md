# Accès et partages

**Statut : bêta expérimentale pour usage local personnel, non prête pour une
diffusion générale et non soumise à la communauté LERD.** Les retours sont
bienvenus via les [issues du dépôt](https://github.com/Thibault-MTZ/lerd-access-sharing/issues).
Voir aussi les [repères techniques](docs/TECHNIQUE.md).

Le plugin affiche les partages natifs LERD et configure les protections du proxy
sur un cœur LERD compatible avec `/api/share-access`. Sans cette capacité,
l'édition est indisponible. Il ne démarre ou n'arrête aucun partage.

Les paramètres de publication restent dans les menus de partage de LERD.

Sur un cœur compatible avec `ui.share_action`, **Protection d’accès** apparaît
dans le menu de partage pour une cible dont le partage proxy est actif. Le
formulaire s'ouvre dans le contexte exact du site ou du worktree, sans modifier
sa règle. La page globale et l'onglet **Accès** restent disponibles.

Les projets regroupent leurs worktrees. Les filtres de partage et de protection,
la recherche et le tri permettent de retrouver une cible. **Détails** affiche
uniquement les métadonnées disponibles : domaine, branche Git et versions de
runtime. Une valeur inconnue n'est pas déduite d'un chemin de projet.

L’**Arborescence** est l’affichage initial et inclut tous les états : site parent
et worktrees connus, indentés sous leur projet. Les projets avec un partage actif
commencent ouverts ; les autres commencent repliés. **Tout déplier** et **Tout
replier** permettent de parcourir l’ensemble. Choisir **Cartes** conserve les
filtres et les replis ; aucune branche n’est créée par cette vue.
Chaque projet reste séparé de ses voisins. La version 0.2.0-beta.4 distingue
**État LERD**, **Publication** et **Protection native**. Vert indique une publication
ou des processus actifs ; ambre indique pause ou veille ; gris indique un état
arrêté, non publié ou non rapporté ; rouge signale une erreur de service.
Une publication peut être protégée par IP ou par compte. Ces indications ne
prouvent ni la santé de l'application ni son accessibilité depuis Internet.

Les filtres rapides comptent les cibles, sites et worktrees compris. Publication,
état LERD et protection se combinent avec une recherche par projet, branche,
domaine ou framework. Les résultats filtrés sont automatiquement dépliés ;
**Effacer les filtres** retrouve la liste complète et ses replis. Les filtres
restent en place pendant **Actualiser**, mais ne sont pas enregistrés entre
deux ouvertures du plugin. Le tri initial place les partages actifs en premier.
Sous 760 px, la liste passe automatiquement en cartes.

Le texte courant utilise une échelle de 14 px, les informations secondaires
12 px et les contrôles au moins 36 px de haut. La police, les couleurs, les
contrastes et les palettes personnalisées restent fournis par le thème LERD,
en mode clair comme en mode sombre. La zone de saisie défile à l’intérieur du
formulaire ; ses actions restent dans le pied de la même modal native.

La page **Accès et partages** lit les sites et worktrees depuis l’API native.
Utilisez **Actualiser**, recherchez un projet ou affichez aussi les partages
fermés. Le numéro de port public et les restrictions de votre passerelle ne sont
pas exposés par cette API : « non exposé » ne signifie jamais « non protégé ».

La commande `lerd lerd-access-sharing:shares` renvoie le même état en JSON.
L'inventaire utilise `GET .../shares`. L'édition explicite utilise
`GET/POST .../policy?site=...&branch=...`, puis l'API native locale de LERD.

## Règles d'accès

Un worktree peut **Utiliser les règles du projet parent** et suivre ses futurs
changements. Son badge indique alors **Règles du parent**. Décocher prépare une
exception, sans toucher au parent. Pour supprimer une exception existante,
**Revenir aux règles du parent** ouvre une confirmation explicite. La révision
réelle de la branche et celle du parent sont envoyées pour détecter une
modification concurrente. Le retour à l’héritage ne transmet aucun identifiant
ni mot de passe, et ne démarre aucun partage. Si le cœur ne fournit pas ce
contrat, les commandes d’héritage restent masquées.

Ouvrir les règles de la cible exacte, projet ou branche. Les modes proposés sont
fermé, public sans restriction, IP, Basic Auth, IP **et** Basic Auth, ou IP **ou**
Basic Auth. Un changement ne démarre pas le partage. Vérifier le résumé avant
de cliquer sur **Appliquer**.

Pour les refus réseau, choisir `403 Accès refusé` ou `404 Introuvable`. Le défi
Basic Auth conserve le statut `401` nécessaire à la demande d’identifiants.

Saisir les IP seules ou en CIDR, IPv4 ou IPv6. Les modes IP exigent au moins une
adresse. Les comptes existants ne révèlent jamais leurs secrets ; saisir un
identifiant et un mot de passe non vide pour créer ou remplacer ce compte. Le
plugin ne tronque, ne normalise et ne limite pas le format ou la taille du mot de
passe. Le formulaire complet reste soumis à une limite globale de 64 KiB. Le
cœur LERD reçoit le secret pour le hacher. Utiliser HTTPS pour tout accès distant
Basic Auth.

La limite indique les requêtes par seconde et par client, avec une rafale tolérée.
Zéro désactive cette limite. Une limite atteinte produit429, pas un ralentissement
de téléchargement. Si une modification concurrente est signalée, recharger les
règles avant de réessayer. Une erreur ne vaut jamais confirmation d'application.

Les règles sont appliquées par LERD. La confiance dans les relais et le port
d'entrée commun sont des réglages d'installation distincts ; ne jamais importer
aveuglément les IP d'une autre machine. Aucun secret n'est enregistré par le plugin.
