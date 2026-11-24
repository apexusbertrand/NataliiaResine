# Flux n8n du chat Nataliia Résine

Même architecture que le chat du site LOGE&NERJ (voir `apexusbertrand/Test_claude`, branche `SITE_MICHAEL`, `artisan-michael/n8n/`).

Adresse de réception, **provisoire** : l'adresse personnelle du prestataire (Apexus), saisie uniquement dans les nœuds Gmail de n8n, en attendant l'adresse de Nataliia (`nataliiaresine@gmail.com` ou l'adresse du nom de domaine). Pour basculer, changer le destinataire dans les nœuds Gmail des flux 2 et 3, rien d'autre. L'adresse n'est volontairement pas écrite dans ce dépôt public.

Envoi depuis le compte Gmail `apexus.claude` (identifiant n8n « Gmail Claude », déjà utilisé pour LOGE&NERJ), avec en « Répondre à » l'e-mail du visiteur quand il l'a donné.

## Côté site

- `site/static/js/chat.js` : widget `@n8n/chat` 1.42.6 aux couleurs du site, bulle d'annonce, bouton de fermeture. Sans webhook, mode démonstration (réponses par mots-clés, rien n'est envoyé).
- Webhook à renseigner dans `site/content/site.json`, champ `chatWebhook`, puis publier.
- Connaissance de l'agent : `https://apexusbertrand.github.io/NataliiaResine/chat-connaissance.json`, générée par `site/build.mjs` à chaque publication (prestations, déroulé, avantages, produits, réalisations, règles, réponses types). Une modification dans l'administration met le chat à jour après publication, sans toucher à n8n.

## 1. Site Nataliia Résine — Agent Chat

Chat Trigger (public, mode « Embedded chat », origine autorisée `https://apexusbertrand.github.io`) → HTTP Request « Lire la connaissance » (`chat-connaissance.json`) → AI Agent « Assistant Nataliia Résine » (prompt `n8n/prompt-agent-chat.md`, connaissance passée en contexte) + mémoire de session (fenêtre de 20 messages) → réponse.

En parallèle, chaque message (visiteur et assistant) est ajouté à la Data table `chat_nataliia` : `sessionId`, `date`, `role`, `texte`, `page`.

Outil de l'agent : `transmettre_a_nataliia` (flux 2).

## 2. Site Nataliia Résine — Transmission d'une demande (sous-flux)

Appelé par l'outil `transmettre_a_nataliia` avec : `prenom`, `nom`, `telephone`, `email`, `commune`, `type_surface`, `surface_m2`, `support_actuel`, `delai`, `granulat`, `resume`, `urgence`, et `sessionId`.

Execute Workflow Trigger → lecture de la conversation dans `chat_nataliia` (même `sessionId`) → Gmail vers l'adresse de réception.

- Objet : `Demande chat · {{commune ou "commune inconnue"}} · {{type_surface ou "projet"}}`
- Corps : fiche de demande (les champs ci-dessus, en tableau, vides masqués), lien d'appel et lien e-mail, puis la conversation complète.
- Réponse à l'agent : `{"ok": true}`.

## 3. Site Nataliia Résine — Récapitulatif du chat (18 h, Europe/Paris)

Schedule Trigger 18 h → lecture de `chat_nataliia` pour la journée → regroupement par `sessionId` → un seul mail récapitulatif (pas de mail si aucune conversation).

## Mise en route

1. Réautoriser le connecteur n8n dans claude.ai pour que les flux soient créés et testés directement (comme pour LOGE&NERJ), ou les créer à la main d'après ce document.
2. Publier les flux 1, 2 et 3 dans n8n.
3. Copier l'URL du Chat Trigger dans `site/content/site.json` → `chatWebhook`, commit, push : le site passe du mode démonstration au vrai chat.
4. Test : une question hors sujet (refus poli), une question de prix (pas de prix), un projet avec téléphone (un mail arrive sur l'adresse de réception).
