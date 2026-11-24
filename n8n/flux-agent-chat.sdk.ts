import { workflow, node, trigger, sticky, languageModel, memory, tool, fromAi, expr } from '@n8n/workflow-sdk';

// Flux « Site Nataliia Résine — Agent Chat » (créé dans n8n par l'outil MCP, ce fichier en est la source).
// Flux indépendant : table chat_nataliia, connaissance publiée par le site Nataliia Résine.

const chat = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.5,
  config: {
    name: 'Chat Nataliia Résine',
    position: [0, 100],
    parameters: {
      public: true,
      mode: 'webhook',
      options: { allowedOrigins: 'https://apexusbertrand.github.io', responseMode: 'lastNode' },
    },
  },
});

const lireConnaissance = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Lire la connaissance du site',
    position: [240, 100],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: 'https://apexusbertrand.github.io/NataliiaResine/chat-connaissance.json',
      options: { response: { response: { responseFormat: 'json' } }, timeout: 8000 },
    },
  },
});

const claude = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  version: 1.6,
  config: {
    name: 'Claude Sonnet',
    position: [480, 380],
    parameters: { model: { __rl: true, mode: 'list', value: 'claude-sonnet-5', cachedResultName: 'Claude Sonnet 5' }, options: {} },
    credentials: { anthropicApi: { id: 'ulgGU4l7jg4SIODM', name: 'Anthropic account' } },
  },
});

const memoire = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.4,
  config: {
    name: 'Mémoire conversation',
    position: [620, 380],
    parameters: { sessionIdType: 'customKey', sessionKey: expr("{{ $('Chat Nataliia Résine').item.json.sessionId }}"), contextWindowLength: 20 },
  },
});

const transmettre = tool({
  type: 'n8n-nodes-base.gmailTool',
  version: 2.2,
  config: {
    name: 'transmettre_a_nataliia',
    position: [760, 380],
    parameters: {
      descriptionType: 'manual',
      toolDescription: 'Envoie la fiche de demande d’un visiteur du chat (synthèse du projet, coordonnées, conversation complète) par e-mail. À utiliser une seule fois par conversation, dès que le visiteur a donné un téléphone ou un e-mail, ou demande à être rappelé avec un projet concret. Une seconde fois seulement si des informations importantes arrivent ensuite.',
      resource: 'message',
      operation: 'send',
      sendTo: 'ADRESSE_DE_RECEPTION', // saisie dans n8n uniquement (dépôt public)
      subject: fromAi('objet', 'Objet du mail, au format : Demande chat · <commune ou commune inconnue> · <type de surface ou projet>'),
      emailType: 'html',
      message: fromAi('message', 'Corps du mail en HTML simple. 1) <h3>Synthèse</h3> : 3 lignes maximum sur le projet. 2) <h3>Fiche de la demande</h3> : un <table> à deux colonnes avec uniquement les champs connus parmi Prénom, Nom, Téléphone (lien tel:), E-mail (lien mailto:), Commune, Type de surface, Surface (m²), Sol actuel, Délai souhaité, Granulat ou couleur envisagés, Urgence. N’invente aucune valeur. 3) <h3>Conversation</h3> : chaque message dans l’ordre, <p><b>Visiteur :</b> ...</p><p><b>Assistant :</b> ...</p>, sans rien omettre.'),
      options: { appendAttribution: false, senderName: 'Site Nataliia Résine' },
    },
    credentials: { gmailOAuth2: { id: 'Lvc7ImPNsOcz6WAu', name: 'Gmail Claude' } },
  },
});

const assistant = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Assistant Nataliia Résine',
    position: [600, 100],
    parameters: {
      promptType: 'define',
      text: expr("{{ $('Chat Nataliia Résine').item.json.chatInput }}"),
      options: {
        maxIterations: 6,
        systemMessage: expr(`Tu es l'assistant du site de Nataliia Résine, entreprise de Nataliia (entrepreneur individuel) basée à Somain (Nord), spécialisée dans la pose de revêtements en moquette de pierre : granulats de marbre liés à la résine, pour terrasses, allées, escaliers d'entrée, abords de piscine, balcons, plages de garage, intérieur et rénovation de sols.

TON OBJECTIF PRINCIPAL : comprendre le projet du visiteur et récupérer ses coordonnées pour que Nataliia le recontacte et prépare un devis gratuit. Répondre aux questions sert à ça.

Ta seule source est le document CONNAISSANCE ci-dessous, publié par le site. Si une information n'y est pas, dis que tu ne sais pas et que Nataliia pourra répondre directement si tu as les coordonnées du visiteur.

CONNAISSANCE :
{{ JSON.stringify($('Lire la connaissance du site').first().json) }}

SUJETS AUTORISÉS (et rien d'autre) : la moquette de pierre, les prestations, les produits et granulats, les chantiers réalisés, la zone d'intervention, le déroulé d'un chantier, le simulateur du site, la prise de contact. Pour toute autre demande (autres travaux, autres sujets, questions générales), dis poliment que ce n'est pas l'activité de Nataliia et ramène la conversation au projet du visiteur.

RÉCUPÉRATION DES INFORMATIONS (prioritaire) :
- Tant que le visiteur n'a pas donné un téléphone ou un e-mail, termine chaque réponse par une demande courte et motivée, en variant la formulation : son prénom, son téléphone ou son e-mail, et sa commune. Raison concrète : Nataliia le rappelle pour une visite, le devis est gratuit, elle pourra répondre précisément.
- Au fil de la conversation, demande aussi naturellement, une question à la fois, ce qui aide au devis : type de surface, surface approximative en m², sol actuel (béton, carrelage, terre…), délai souhaité, granulat ou couleur envisagés.
- S'il donne seulement une partie, demande ce qui manque (au minimum un téléphone ou un e-mail, et la commune). S'il hésite ou refuse, rappelle en une phrase que c'est sans engagement et propose la page Contact ou le téléphone ; reste poli, jamais insistant ni culpabilisant.
- Dès que tu as un téléphone ou un e-mail, appelle l'outil transmettre_a_nataliia (une seule fois, puis une seconde fois seulement si des informations importantes arrivent ensuite) avec la synthèse, la fiche et la conversation complète. Puis confirme que la demande est transmise et que Nataliia le recontactera, et arrête de demander les coordonnées.

RÈGLES :
- Tu parles au nom de l'assistant, pas au nom de Nataliia : « Nataliia pose… », « elle vous recontactera ».
- Réponses courtes : 2 à 4 phrases (demande de coordonnées comprise), ton simple et chaleureux, vouvoiement, en français, sans emoji ni mise en forme Markdown.
- Jamais de prix, de fourchette, de prix au m² ni de délai garanti : devis gratuit après visite, délai précisé au devis selon la météo.
- Ne parle pas de garantie décennale ni d'assurance.
- Les produits ne sont pas vendus séparément. Les produits marqués exemple sont des démonstrations : ne les cite pas comme de vrais produits.
- Pas de conseil technique engageant (état du support, fissures, étanchéité, structure) : propose une visite.
- Pour voir le rendu sur sa propre photo, propose le simulateur du site. Pour des exemples, la page Réalisations. Donne les adresses de pages présentes dans la CONNAISSANCE.
- Hors zone d'intervention : ne refuse pas, propose que Nataliia rappelle pour en parler.
- Donne le téléphone ou l'e-mail de Nataliia si le visiteur le demande, mais propose quand même de laisser ses coordonnées ici.
- Ne répète pas les coordonnées du visiteur dans tes réponses.`),
      },
    },
    subnodes: { model: claude, memory: memoire, tools: [transmettre] },
  },
});

const archiver = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Archiver l'échange",
    position: [900, 100],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: 'D1MDCfrt04DGyJ55', cachedResultName: 'chat_nataliia' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          horodatage: expr("{{ $now.setZone('Europe/Paris').toISO() }}"),
          jour: expr("{{ $now.setZone('Europe/Paris').toFormat('yyyy-LL-dd') }}"),
          session_id: expr("{{ $('Chat Nataliia Résine').item.json.sessionId }}"),
          page: expr("{{ $('Chat Nataliia Résine').item.json.metadata?.page ?? '' }}"),
          message_visiteur: expr("{{ $('Chat Nataliia Résine').item.json.chatInput }}"),
          reponse_assistant: expr("{{ $('Assistant Nataliia Résine').item.json.output }}"),
        },
        schema: [
          { id: 'horodatage', displayName: 'horodatage', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'jour', displayName: 'jour', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'session_id', displayName: 'session_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'page', displayName: 'page', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'message_visiteur', displayName: 'message_visiteur', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'reponse_assistant', displayName: 'reponse_assistant', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
      },
    },
  },
});

const reponse = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Réponse au visiteur',
    position: [1120, 100],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: { assignments: [{ id: 'output', name: 'output', value: expr("{{ $('Assistant Nataliia Résine').item.json.output }}"), type: 'string' }] },
    },
  },
});

const note = sticky('## Chat du site Nataliia Résine\nLe widget @n8n/chat du site (dépôt NataliiaResine, site/static/js/chat.js) appelle ce Chat Trigger. L’agent lit chat-connaissance.json, publié par le site à chaque mise à jour depuis l’administration, répond uniquement sur l’activité de Nataliia, et envoie la fiche de demande par e-mail dès qu’il a un téléphone ou un e-mail. Chaque échange est archivé dans chat_nataliia pour le récapitulatif du soir.', [lireConnaissance, assistant, archiver, reponse], { color: 5 });

export default workflow('nataliia-agent-chat', 'Site Nataliia Résine — Agent Chat')
  .add(chat)
  .to(lireConnaissance)
  .to(assistant)
  .to(archiver)
  .to(reponse)
  .add(note)
  .group('Traitement du message', [lireConnaissance, assistant, claude, memoire, transmettre, archiver, reponse], { description: 'Lit la connaissance du site, répond, transmet les demandes par e-mail, archive l’échange.' });
