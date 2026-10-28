# Accès et partages

La V1 affiche les partages natifs LERD en lecture seule. Elle n’ajoute aucun
contrôle de sécurité et ne démarre ou n’arrête aucun partage.

Les paramètres de publication restent dans les menus de partage de LERD.

La page **Accès et partages** lit les sites et worktrees depuis l’API native.
Utilisez **Actualiser**, recherchez un projet ou affichez aussi les partages
fermés. Le numéro de port public et les restrictions de votre passerelle ne sont
pas exposés par cette API : « non exposé » ne signifie jamais « non protégé ».

La commande `lerd lerd-access-sharing:shares` renvoie le même état en JSON.
Le seul point d’accès du plugin est `GET .../shares` ; aucune écriture ou action
de publication n’est proposée. Aucun compte, mot de passe ou jeton n’est à saisir.
