# Fortstats

Site statique + fonctions serveur (dossier `api/`) qui interrogent fortnite-api.com. Les clés restent côté serveur.

## 1. Clé API Fortnite (gratuit)
1. https://dash.fortnite-api.com → connexion avec Discord → crée une clé API.
2. Sur Vercel : Project → Settings → Environment Variables → `FORTNITE_API_KEY` = ta clé.

## 2. Base de données pour le classement entre amis (gratuit)
1. Crée un compte sur https://upstash.com puis « Create Database » (Redis, région Europe, plan gratuit).
2. Sur la page de la base, copie `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` (onglet REST API).
3. Sur Vercel : Project → Settings → Environment Variables, ajoute ces deux variables avec les mêmes noms.
4. Onglet Deployments → « Redeploy » le dernier déploiement (les variables ne sont prises en compte qu'après un nouveau déploiement).

Tant que ces variables manquent, l'onglet Classement affiche « base de données non configurée » ; le reste du site fonctionne.

## 3. Déployer
Mets tous les fichiers sur GitHub : Vercel redéploie automatiquement. (Netlify ne gère que les stats : le classement entre amis demande Vercel.)

## Boutique du jour
Aucune configuration : l'onglet Boutique lit l'API publique de fortnite-api.com via `/api/shop` (Vercel). Netlify ne gère pas cet onglet ni le classement.

## Fonctionnement
- Accueil : l'adresse nue mène toujours à l'accueil ; un profil s'ouvre via `?name=PSEUDO&platform=epic|psn|xbl`.
- Classement : groupes identifiés par un code de 6 caractères ; les stats sont lues par le serveur, jamais envoyées par le navigateur. Actualisation limitée à une fois toutes les 10 minutes par joueur, 30 joueurs maximum par groupe.
- Bilan de saison : stats de la fenêtre « season » de l'API ; l'ancien bilan est archivé dans le navigateur quand une nouvelle saison démarre (le compteur de parties repart de zéro).

## Limites
- Pas de vraie connexion Epic/PSN : le site cherche un pseudo public.
- Epic ne fournit ni le nombre de coffres ouverts (compteur à saisir à la main) ni la liste des parties une par une.
- Groupes sans comptes : toute personne qui a le code peut s'y ajouter, et il n'y a pas de suppression de joueur.

## Autres fonctions
- Thèmes (Fortnite, Sobre, Minuit) mémorisés dans le navigateur.
- Session en cours, prévisions, calendrier d'activité, titre de joueur : calculés dans le navigateur à partir de tes visites (historique stocké localement).
- Comparaison de saisons : disponible dès qu'un bilan de saison a été archivé.
