# Conventions UX communes aux deux plugins

Proposition v1 du 30 octobre 2026, commune à **Accès et partages** et **Archives
de projets**. Aucun nouveau comportement appliqué par ce document. Les deux plugins
restent installables et utilisables indépendamment, sans bibliothèque partagée imposée.

## Présentation

Utiliser les composants, couleurs et thèmes natifs LERD ; CSS propre limité à la
disposition. Même barre compacte : titre, actualisation, recherche, filtres avec
compteurs, tri et choix liste/cartes. Cartes sur écran étroit, détails à la demande.
Une action principale par objet, actions secondaires regroupées. Clavier, focus
visible, libellés et couleurs conjointes, animations réduites respectées.

## États cohérents

| Sens | Traitement | Exemple |
|---|---|---|
| Réussite ou activité confirmée | Vert discret + texte | Services actifs, restauration vérifiée |
| Pause ou attention | Ambre + texte | En pause, action requise |
| Inactif, attente ou inconnu | Neutre + texte précis | Arrêté, en attente, non rapporté |
| Échec | Rouge + cause et prochaine action | Transfert interrompu |
| Archive froide | Icône archive et badge distinct du vert | Sur stockage externe, à restaurer |

L'état d'exécution, la publication et la protection sont trois informations séparées.
L'emplacement des données et l'état d'une tâche constituent encore deux dimensions.
Une archive vérifiée peut donc porter un badge « Archivé » et un contrôle « Intégrité
vérifiée » sans être présentée comme un projet actif. Aucun état déduit d'une URL seule.

## Préférences, plus tard

Proposer liste compacte sur ordinateur et cartes sur mobile. Pour Accès et partages,
groupes repliés avec résumé et compteurs ; une recherche ouvre ses correspondances.
Pour Archives, tâches actives et erreurs toujours visibles, file vide repliée.
Ces défauts sont des propositions : l'interface déployée n'est pas modifiée ici.

Un futur panneau permettra vue, densité, tri et groupes ouverts/repliés, avec bouton
« Rétablir les valeurs par défaut ». Préférences visuelles par navigateur et instance,
clés propres à chaque plugin et schéma versionné. Pas d'état sensible ou secret dans
le stockage navigateur. Ne pas présumer l'existence d'une API native de préférences.
Un défaut de stockage ou de rétention est une configuration fonctionnelle distincte,
validée côté serveur : ce n'est pas une simple préférence d'affichage.

## Parcours Archives

Trois vues : **Archives**, **File de transfert**, **Stockages**. Chaque archive indique
projet/groupe, origine, poids stocké, date, inclusions/exclusions, dernière vérification
et action « Restaurer ». Distinguer volume source, archive compressée éventuelle et
gain local réellement mesuré. Une valeur inconnue n'est jamais affichée comme zéro.

Confirmation avant archivage : liste complète, bases exclues, destination, espace
libérable, effet sur les données locales. Confirmation avant restauration : instance,
chemin, conflits et état arrêté attendu. Ne jamais réactiver un partage public ou des
workers simplement parce qu'ils étaient actifs à l'origine.

Après confirmation, la tâche apparaît immédiatement dans la file. Afficher position,
étape, dernière activité, temps écoulé et octets mesurés. Pourcentage uniquement avec
un dénominateur fiable ; pas de pourcentage fictif pour une vérification indéterminée.
Les détails montrent un journal expurgé. L'erreur explique où se trouvent les données
et quelles opérations sont sûres. Une destination joignable ne prouve pas une archive saine.

## Validation future

Comparer les deux plugins en thèmes clair et sombre, sur ordinateur et écran étroit.
Tester recherche, vide, API absente, erreur, état inconnu, file longue, interruption
et navigation clavier. Conserver filtres et sélection lors d'un rafraîchissement.
