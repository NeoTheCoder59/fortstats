# Mes stats Fortnite

Site statique + une petite fonction serveur qui interroge fortnite-api.com (la clé API reste côté serveur).

## 1. Obtenir une clé API (gratuit)
1. Va sur https://dash.fortnite-api.com et connecte-toi avec Discord.
2. Crée une clé API et copie-la.

## 2. Mettre le code sur GitHub
Crée un dépôt, puis envoie-y tous les fichiers de ce dossier (tu peux le faire depuis le site github.com avec « Upload files »).

## 3a. Déployer sur Vercel (adresse gratuite : nom.vercel.app)
1. https://vercel.com → Add New → Project → importe ton dépôt GitHub.
2. Avant de valider, ajoute la variable d'environnement `FORTNITE_API_KEY` = ta clé.
3. Deploy. Tu peux choisir ton sous-domaine dans Settings → Domains.

## 3b. Ou déployer sur Netlify (adresse gratuite : nom.netlify.app)
1. https://netlify.com → Add new site → Import from Git → ton dépôt.
2. Site configuration → Environment variables → `FORTNITE_API_KEY` = ta clé.
3. Deploy. Le sous-domaine se change dans Domain management.

## Utilisation
Choisis Epic Games, PlayStation ou Xbox, tape ton pseudo, puis « Afficher mes stats ».
Dans Fortnite, les statistiques de carrière doivent être en public (paramètres de confidentialité).

## Limites
- Pas de vraie connexion à un compte Epic/PSN : le site recherche un pseudo public.
- Epic ne fournit ni le nombre de coffres ouverts, ni la liste des parties une par une.
- L'historique est reconstitué en comparant tes visites successives (stocké dans ton navigateur).
