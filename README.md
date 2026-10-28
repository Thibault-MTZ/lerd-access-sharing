# Accès et partages LERD — V1

Plugin natif local, fondé sur le squelette produit par `lerd plugin new`.
Le dépôt est indépendant de toute configuration d’hébergement.

La V1 vise une **vue en lecture seule** des partages de sites et de worktrees.
Elle ne fournit pas de pare-feu, de contrôle IP, d’authentification ni de limite
de requêtes. Elle ne remplace pas les protections d’une passerelle existante.

## État initial

Le squelette et le pont d’interface natif sont présents. Les fonctions de lecture
et leurs tests seront ajoutés avant installation ; aucune publication automatique
de projet n’est prévue.

## Origine du squelette

Le pont `ui/lerd.js` et l’icône viennent du générateur LERD 1.38, sous licence MIT
(voir `LICENSE`). Aucun binaire LERD modifié n’est inclus.
