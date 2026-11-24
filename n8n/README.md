# Flux n8n du chat Nataliia Résine

Le chat du site (bouton en bas à droite de chaque page) est un widget `@n8n/chat` relié à un agent IA dans n8n. L'agent ne parle que de l'activité de Nataliia, récupère les coordonnées et la description du projet, et envoie une fiche de demande par e-mail.

## Flux en service

| Flux | Lien n8n | État |
|---|---|---|
| Site Nataliia Résine — Agent Chat | https://apexus.app.n8n.cloud/workflow/6QOc1NgkFLEyP01P | publié |
| Site Nataliia Résine — Récapitulatif du chat (18 h, Europe/Paris) | https://apexus.app.n8n.cloud/workflow/o7cCXtum9Zgv2Oqe | publié |

- Projet n8n : personnel (Bertrand MARAT).
- Table des échanges : `chat_nataliia` (id D1MDCfrt04DGyJ55).
- Modèle : Claude Sonnet, identifiant n8n « Anthropic account ».
- Envoi des e-mails : identifiant n8n « Gmail Claude ».
- Destinataire, **provisoire** : l'adresse du prestataire (Apexus), saisie uniquement dans n8n. Pour passer à l'adresse de Nataliia, changer le destinataire dans l'outil `transmettre_a_nataliia` (flux 1) et dans le nœud « Envoyer le récapitulatif » (flux 2). Aucune adresse n'est écrite dans ce dépôt public.

## Côté site

- `site/static/js/chat.js` : widget `@n8n/chat` 1.42.6 aux couleurs du site, bulle d'annonce, bouton de fermeture. Sans webhook, mode démonstration (réponses par mots-clés, rien n'est envoyé).
- `site/content/site.json`, champ `chatWebhook` : `https://apexus.app.n8n.cloud/webhook/7a6c64e2-c8c6-4a2d-b66a-ae7d31baa1bd/chat`. Vide = mode démonstration.
- Connaissance de l'agent : `chat-connaissance.json` à la racine du site, générée par `site/build.mjs` à chaque publication (prestations, déroulé, avantages, produits, réalisations, règles, réponses types). Une modification dans l'administration met le chat à jour après publication, sans toucher à n8n.

## 1. Agent Chat

Chat Trigger (public, origine autorisée `https://apexusbertrand.github.io`) → « Lire la connaissance du site » (HTTP) → « Assistant Nataliia Résine » (AI Agent : Claude Sonnet, mémoire de session de 20 messages, outil `transmettre_a_nataliia`) → « Archiver l'échange » (table `chat_nataliia`) → « Réponse au visiteur ».

Règles du prompt (source complète : `n8n/flux-agent-chat.sdk.ts`) :
- sujets autorisés : moquette de pierre, prestations, produits, chantiers, zone, déroulé, simulateur, contact, et Apexus (concepteur du site, création de sites web dynamiques, lien https://apexus.fr) en sujet secondaire ; le reste est refusé poliment ;
- jamais de prix, de délai garanti, de garantie décennale ; produits d'exemple jamais présentés comme réels ;
- récupération progressive : prénom, téléphone ou e-mail, commune, type de surface, m², sol actuel, délai, granulat envisagé ;
- dès qu'il a un téléphone ou un e-mail, l'outil `transmettre_a_nataliia` envoie la fiche : objet `Demande chat · <commune> · <surface>`, synthèse, tableau des champs connus (aucun inventé), conversation complète.

## 2. Récapitulatif du chat

Chaque jour à 18 h (Europe/Paris) : lecture des échanges du jour dans `chat_nataliia`, regroupement par conversation, un seul mail. Pas de mail les jours sans conversation.

## Tests du 24/11/2026

- Question hors sujet + prix au m² : refus poli, pas de prix, demande de coordonnées.
- Projet complet avec téléphone (données TEST) : fiche envoyée et reçue, aucun champ inventé, plus de relance après transmission.
- Adresse de production appelée depuis l'origine du site, puis widget en ligne sur téléphone : réponses correctes.

## Avec le nom de domaine

Remplacer `https://apexusbertrand.github.io` par le domaine dans l'option « Allowed origins » du Chat Trigger, et l'URL de « Lire la connaissance du site ».
