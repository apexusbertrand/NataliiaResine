# Administration et simulateur Nataliia Résine : mise en service

Procédure à suivre une fois pour brancher l'administration (lot 2) sur une vraie base. Tant qu'elle n'est pas faite, `/admin/` fonctionne en mode démonstration : les modifications restent dans le navigateur et rien n'est publié.

Couvre le lot 2 (administration) et le lot 3 (réception des demandes du simulateur). Durée : environ 1 h 15. Comptes nécessaires : Supabase (gratuit), accès administrateur au dépôt GitHub.

## Architecture

```
Navigateur de la cliente ── /admin/ (statique, sur GitHub Pages)
        │  connexion e-mail + mot de passe, lecture/écriture
        ▼
Supabase (UE, Francfort) : Auth, Postgres + règles d'accès, Storage (photos), fonction « publier »
        │  bouton « Publier le site » → repository_dispatch
        ▼
GitHub Actions : fetch-content.mjs (contenus publiés) → build.mjs → GitHub Pages
```

Le site public reste 100 % statique. Les photos du site sont servies depuis le stockage public Supabase. Les données des prospects (lot 3) restent dans un stockage privé.

## 1. Créer le projet Supabase

1. supabase.com, « New project ». Nom : `nataliia-resine`. Région : **Central EU (Frankfurt)**. Mot de passe de base : le garder dans le gestionnaire de mots de passe.
2. Settings > API : noter **Project URL** et la clé **anon public**.

## 2. Créer la base

SQL Editor > New query : coller tout le contenu de `supabase/installation.sql`, puis « Run ». Il regroupe `schema.sql` (tables, droits, historique, stockage) et `seed.sql` (prestations et produits d'exemple). Relançable sans perte de données.

La purge RGPD automatique est décrite à l'étape 8 (elle passe par une fonction, qui efface aussi les photos).

## 3. Réglages de connexion

Authentication > Sign In / Providers :

- **Allow new users to sign up : désactivé** (seules les personnes invitées peuvent se connecter) ;
- Email : activé, « Confirm email » activé.

Authentication > URL Configuration :

- Site URL : `https://apexusbertrand.github.io/NataliiaResine/admin/` (puis l'adresse définitive après le passage sur le nom de domaine) ;
- Redirect URLs : la même adresse.

Authentication > Emails : remplacer les modèles « Invite user » et « Reset password » par ceux de `supabase/emails/` (en français).

Mot de passe : Authentication > Providers > Email, longueur minimale 10 caractères.

## 4. Créer le compte de la cliente

1. Authentication > Users > « Invite user » : e-mail de la cliente. Elle reçoit un lien pour choisir son mot de passe.
2. Lui donner l'accès à l'administration : coller `supabase/apres-invitation.sql` dans SQL Editor (adresse à adapter), ou :

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'adresse@de-la-cliente.fr';
```

Même procédure plus tard pour un deuxième utilisateur. Pour retirer un accès : supprimer la ligne dans `admins` (et l'utilisateur dans Auth).

## 5. Fonctions (raccourci)

`bash supabase/deployer.sh <ref-du-projet>` depuis la racine du dépôt, sur un ordinateur avec Node.js : connexion à Supabase, réglages non secrets, déploiement des 3 fonctions et génération du secret de purge. Il affiche à la fin la requête pg_cron de l'étape 8. Restent à saisir à la main, dans Supabase > Edge Functions > Secrets : `GITHUB_TOKEN` (ci-dessous), puis `BREVO_API_KEY` et `TURNSTILE_SECRET` (étape 7).

Le détail, si on préfère faire les étapes une par une, suit.

## 5 bis. Fonction « publier »

Jeton GitHub à grain fin (github.com > Settings > Developer settings > Fine-grained tokens) :

- Repository access : uniquement le dépôt du site ;
- Permissions : **Contents : Read and write** (nécessaire pour `repository_dispatch`), **Actions : Read** (état de la publication) ;
- Expiration : 1 an, avec un rappel pour le renouveler.

Puis, avec la CLI Supabase (`npx supabase`) depuis la racine du dépôt :

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <ref-du-projet>
```

```bash
npx supabase secrets set GITHUB_TOKEN=<jeton> GITHUB_REPO=apexusbertrand/NataliiaResine
```

```bash
npx supabase functions deploy publier
```

La fonction vérifie elle-même que l'appelant est administrateur. Elle n'a jamais besoin d'être appelée sans connexion.

## 6. Brancher le site

Pour ce projet, l'URL et la clé publishable sont déjà inscrites dans `.github/workflows/deploy-pages.yml` (valeurs par défaut). Les variables ci-dessous ne servent que pour changer de projet sans modifier le workflow.

GitHub, dépôt du site > Settings > Secrets and variables > Actions > onglet **Variables** (pas Secrets : ces valeurs sont publiques par conception) :

- `NR_SUPABASE_URL` : Project URL ;
- `NR_SUPABASE_ANON_KEY` : clé anon public.

Relancer le workflow « Publier le site » (Actions > Run workflow). À partir de là :

- le site est construit avec les contenus publiés dans Supabase ;
- `/admin/config.js` est généré avec ces valeurs : l'administration sort du mode démonstration.

## 7. Réception des demandes (lot 3)

Le simulateur calcule tout dans le navigateur du visiteur. À l'envoi, la fonction `demande` vérifie, range les photos dans le stockage privé `demandes`, crée ou complète le dossier prospect, puis envoie deux e-mails.

1. **Brevo** (envoi d'e-mails, France, offre gratuite de 300 e-mails par jour) : créer un compte, vérifier l'expéditeur (adresse du nom de domaine dès qu'il existe, en attendant nataliiaresine@gmail.com), créer une clé API (SMTP & API > API Keys).
2. **Cloudflare Turnstile** (anti-robot, gratuit) : dash.cloudflare.com > Turnstile > Add widget, domaines `apexusbertrand.github.io` puis le nom de domaine, mode « Managed ». Noter la *site key* (publique) et la *secret key*.
3. Secrets des fonctions :

```bash
npx supabase secrets set ALLOWED_ORIGINS=https://apexusbertrand.github.io TURNSTILE_SECRET=<secret-key> BREVO_API_KEY=<cle-brevo> SENDER_EMAIL=<expediteur-verifie> ALERT_EMAIL=nataliiaresine@gmail.com ADMIN_URL=https://apexusbertrand.github.io/NataliiaResine/admin/ CRON_SECRET=<chaine-aleatoire-longue>
```

4. Déployer les deux fonctions, sans vérification de connexion (elles sont appelées par les visiteurs et par la tâche de nuit, et se protègent elles-mêmes) :

```bash
npx supabase functions deploy demande --no-verify-jwt
```

```bash
npx supabase functions deploy purger --no-verify-jwt
```

5. Variable de dépôt GitHub `NR_TURNSTILE_SITE_KEY` : la *site key* Turnstile. Relancer le workflow.

Sans `TURNSTILE_SECRET`, le contrôle anti-robot est désactivé (un champ piège et la limite de 3 demandes par heure et par adresse restent actifs). Sans `BREVO_API_KEY`, les demandes sont enregistrées mais aucun e-mail ne part.

## 8. Purge RGPD automatique

Database > Extensions : activer `pg_cron` et `pg_net`. Puis, dans l'éditeur SQL (remplacer la référence du projet et le secret) :

```sql
select cron.schedule('purge-prospects', '17 3 * * *', $$
  select net.http_post(
    url := 'https://<ref-du-projet>.supabase.co/functions/v1/purger',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  );
$$);
```

Chaque nuit, les dossiers sans contact depuis 3 ans (sauf statut « Signé ») sont supprimés, photos comprises.

## 9. Vérifier

1. Ouvrir `/admin/`, se connecter avec le compte de la cliente (ou un compte de test ajouté à `admins`).
2. Créer une réalisation avec 2 photos, l'enregistrer, cliquer « Publier le site ».
3. Dans GitHub Actions, un run « repository_dispatch » démarre. 2 minutes plus tard, la réalisation est sur le site, photos servies depuis `…supabase.co/storage/v1/object/public/media/…`.
4. Historique : « Revenir à cette version » sur la création, republier, la réalisation disparaît.
5. Se connecter avec un compte qui n'est pas dans `admins` : refus « Ce compte n'a pas accès ».
6. Sur le site, page « Créez votre projet » : charger une photo, tracer la zone, envoyer avec une adresse de test. Vérifier : e-mail d'alerte reçu par la cliente, e-mail de confirmation avec la simulation en pièce jointe, dossier visible dans Demandes avec ses 2 images, photos absentes de toute adresse publique (Storage > demandes : bucket privé).
7. Supprimer ce dossier depuis l'administration : vérifier dans Storage que les photos ont disparu.

## Points d'attention

- **Tests** : base `supabase/tests/run.sh` (Postgres 16), fonctions `deno test -A supabase/functions/tests/` (faux Supabase, faux Brevo, faux Turnstile), moteur du simulateur `node --test site/tests/*.test.mjs`.

- **Mise en pause** : un projet Supabase gratuit sans activité pendant 7 jours est mis en pause. Le site public n'est pas touché (il est statique), mais l'administration et la publication ne répondent plus jusqu'à la relance dans le tableau de bord. Si la cliente publie peu, passer à l'offre Pro (25 $/mois) ou programmer une requête hebdomadaire.
- **Échec de récupération** : si Supabase ne répond pas pendant un build, le workflow échoue et le site en ligne reste dans son état précédent.
- **Jeton GitHub** : expire au bout d'un an. Symptôme : « La publication n'a pas pu être lancée ». Le renouveler puis `supabase secrets set GITHUB_TOKEN=...`.
- **Nom de domaine** : au changement d'adresse, mettre à jour `url` dans `site/content/site.json`, la Site URL et les Redirect URLs Supabase.
- **Sauvegardes** : l'offre gratuite n'a pas de sauvegarde à un instant donné. Exporter la base de temps en temps (Database > Backups, ou `pg_dump`). L'historique des modifications permet déjà d'annuler une erreur de saisie.

## Mise en ligne pour Google (le jour du nom de domaine)

Le site est optimisé pour le référencement (audit Lighthouse mobile, copie sans préversion : 100 en SEO, accessibilité et bonnes pratiques, 99 à 100 en performance). Il reste fermé aux moteurs tant que `preversion` vaut `true`.

1. `site/content/site.json` : `url` = adresse définitive (avec `/` final), `preversion` = `false`, `reseaux` = liens Instagram, Facebook, fiche Google (A2).
2. Google Search Console : ajouter le domaine. Pour la vérification par balise HTML, copier le code dans `googleVerification` de `site.json`. Puis soumettre `https://<domaine>/sitemap.xml`.
3. Fiche Google Business Profile (business.google.com), au nom de Nataliia Résine : catégorie de type entreprise de revêtements de sol, zone desservie (Somain, Douai, Valenciennes, Lille, Arras), adresse masquée, téléphone, lien vers le site, photos de chantiers. C'est le premier levier pour apparaître sur « moquette de pierre Douai ».
4. Demander aux clients satisfaits un avis sur la fiche Google.

Ce qui est en place : titres et descriptions par page avec mots-clés et villes, titre principal (H1) sur chaque page, données structurées (entreprise locale, zone desservie, 8 services, site, fil d'Ariane), balises de partage (Open Graph), adresse canonique, plan du site daté sans les pages exclues. Produits d'exemple, mentions légales, confidentialité et page 404 sont exclus de l'index.
