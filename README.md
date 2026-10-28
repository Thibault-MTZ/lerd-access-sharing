# Accès et partages LERD — V1

Plugin natif local, fondé sur le squelette produit par `lerd plugin new`.
Le dépôt est indépendant de toute configuration d’hébergement.

La V1 vise une **vue en lecture seule** des partages de sites et de worktrees.
Elle ne fournit pas de pare-feu, de contrôle IP, d’authentification ni de limite
de requêtes. Elle ne remplace pas les protections d’une passerelle existante.

## Fonctions de la bêta 0.1.0

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

Rechargez le tableau de bord LERD pour voir la page. Le plugin utilise uniquement
Python 3 standard et le pont d’interface du squelette natif. Il n’installe aucun
service ou binaire LERD modifié.

## Limites assumées

L’API fournit une URL publique même pour certains partages **inactifs** : seul
`public_shared: true` est interprété comme un partage public actif. L’API actuelle
ne fournit pas le numéro du port public, ni les politiques IP/authentification/
requêtes de passerelles externes : la page l’indique, sans les inventer.

Les tunnels externes ne sont pas couverts. La présence d’un partage natif ne
prouve pas son accessibilité Internet, la configuration DNS/TLS ou la sécurité
de l’application. L’accès direct au port natif et l’accès via une passerelle
sont distincts.

Les hooks de plugins LERD actuels interviennent après une opération réussie ;
ils ne constituent pas un point d’interception bloquant des requêtes HTTP.
Une véritable extension de contrôle d’accès demanderait un contrat natif
supplémentaire, hors de cette V1.

## Origine du squelette

Le pont `ui/lerd.js` et l’icône viennent du générateur LERD 1.38, sous licence MIT
(voir `LICENSE`). Aucun binaire LERD modifié n’est inclus.
