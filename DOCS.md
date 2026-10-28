# Accès et partages

Le plugin affiche les partages natifs LERD et configure les protections du proxy
sur un cœur LERD compatible avec `/api/share-access`. Sans cette capacité,
l'édition est indisponible. Il ne démarre ou n'arrête aucun partage.

Les paramètres de publication restent dans les menus de partage de LERD.

La page **Accès et partages** lit les sites et worktrees depuis l’API native.
Utilisez **Actualiser**, recherchez un projet ou affichez aussi les partages
fermés. Le numéro de port public et les restrictions de votre passerelle ne sont
pas exposés par cette API : « non exposé » ne signifie jamais « non protégé ».

La commande `lerd lerd-access-sharing:shares` renvoie le même état en JSON.
L'inventaire utilise `GET .../shares`. L'édition explicite utilise
`GET/POST .../policy?site=...&branch=...`, puis l'API native locale de LERD.

## Règles d'accès

Ouvrir les règles de la cible exacte, projet ou branche. Les modes proposés sont
fermé, public sans restriction, IP, Basic Auth, IP **et** Basic Auth, ou IP **ou**
Basic Auth. Un changement ne démarre pas le partage. Vérifier le résumé avant
de cliquer sur **Appliquer**.

Saisir les IP seules ou en CIDR, IPv4 ou IPv6. Les modes IP exigent au moins une
adresse. Les comptes existants ne révèlent jamais leurs secrets ; saisir un
identifiant et un mot de passe pour créer ou remplacer ce compte. Un secret doit
comporter entre8et72octetsUTF-8. Utiliser HTTPS pour tout accès distant Basic Auth.

La limite indique les requêtes par seconde et par client, avec une rafale tolérée.
Zéro désactive cette limite. Une limite atteinte produit429, pas un ralentissement
de téléchargement. Si une modification concurrente est signalée, recharger les
règles avant de réessayer. Une erreur ne vaut jamais confirmation d'application.

Les règles sont appliquées par LERD. La confiance dans les relais et le port
d'entrée commun sont des réglages d'installation distincts ; ne jamais importer
aveuglément les IP d'une autre machine. Aucun secret n'est enregistré par le plugin.
