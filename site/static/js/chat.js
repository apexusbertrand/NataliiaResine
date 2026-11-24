/* Chat du site Nataliia Résine.
   - window.NR_CHAT.webhook vide : mode démonstration, réponses tirées de chat-connaissance.json
     par mots-clés (rien n'est envoyé).
   - webhook renseigné : widget @n8n/chat (version figée) relié au flux n8n « Site Nataliia Résine — Agent Chat ». */
(function () {
  const CFG = window.NR_CHAT || {};
  const N8N_CHAT_VERSION = '1.42.6';
  const LOGO = '<img src="img/icone-192.png" alt="" width="40" height="40">';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function n8nChat() {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://cdn.jsdelivr.net/npm/@n8n/chat@${N8N_CHAT_VERSION}/dist/style.css`;
    document.head.appendChild(css);
    import(`https://cdn.jsdelivr.net/npm/@n8n/chat@${N8N_CHAT_VERSION}/dist/chat.bundle.es.js`).then(({ createChat }) => {
      createChat({
        webhookUrl: CFG.webhook,
        mode: 'window',
        showWelcomeScreen: false,
        defaultLanguage: 'en',
        metadata: { page: location.pathname, langue: navigator.language, referent: document.referrer || 'direct' },
        initialMessages: [`Bonjour, je suis l’assistant de Nataliia Résine : moquette de pierre pour terrasses, allées, escaliers et abords de piscine autour de ${CFG.zone}. Posez-moi votre question. Pour un devis gratuit, laissez votre prénom, votre téléphone et votre commune : Nataliia vous recontacte.`],
        i18n: { en: { title: 'Nataliia Résine', subtitle: 'Moquette de pierre · devis gratuit', footer: '', getStarted: 'Nouvelle conversation', inputPlaceholder: 'Votre question…', closeButtonTooltip: 'Fermer' } },
      });
      teaser('#n8n-chat .chat-window-toggle');
      fermeture();
    }).catch(() => demoChat()); // CDN injoignable : on garde au moins le mode démonstration
  }

  // Croix dans l'en-tête et bouton rond qui devient une croix quand le chat est ouvert
  function fermeture() {
    const racine = document.getElementById('n8n-chat');
    const attendre = (essais) => {
      const toggle = racine && racine.querySelector('.chat-window-toggle');
      if (!toggle) { if (essais > 0) setTimeout(() => attendre(essais - 1), 300); return; }
      toggle.setAttribute('aria-label', 'Ouvrir le chat');
      const maj = () => {
        const fen = racine.querySelector('.chat-window');
        const ouvert = !!(fen && fen.offsetParent !== null && getComputedStyle(fen).display !== 'none');
        toggle.classList.toggle('is-open', ouvert);
        toggle.setAttribute('aria-label', ouvert ? 'Fermer le chat' : 'Ouvrir le chat');
        const entete = racine.querySelector('.chat-header');
        if (ouvert && entete && !entete.querySelector('.chat-close')) {
          entete.insertAdjacentHTML('beforeend', '<button type="button" class="chat-close" aria-label="Fermer le chat">×</button>');
          entete.querySelector('.chat-close').addEventListener('click', () => toggle.click());
        }
      };
      new MutationObserver(maj).observe(racine, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      toggle.addEventListener('click', () => setTimeout(maj, 50));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && toggle.classList.contains('is-open')) toggle.click(); });
      maj();
    };
    attendre(20);
  }

  // Bulle au-dessus du bouton pour signaler l'assistant (une fois par visite)
  function teaser(selecteur) {
    let ferme = false;
    try { ferme = sessionStorage.getItem('nr-chat-teaser') === 'ferme'; } catch (e) { /* stockage indisponible */ }
    const attendre = (essais) => {
      const toggle = document.querySelector(selecteur);
      if (!toggle) { if (essais > 0) setTimeout(() => attendre(essais - 1), 300); return; }
      toggle.classList.add('chat-pulse');
      if (ferme || document.body.dataset.page === 'projet') return; // pas de bulle sur le simulateur
      document.body.insertAdjacentHTML('beforeend', `
        <div class="chat-teaser" role="dialog" aria-label="Assistant en ligne">
          <button type="button" class="chat-teaser-open">
            <span class="ct-kicker"><span class="ct-dot" aria-hidden="true"></span>Assistant en ligne</span>
            <strong>Une question sur votre projet ?</strong>
            <span class="ct-txt">Prestations, granulats, zone, devis : réponse immédiate, 7 j / 7.</span>
          </button>
          <button type="button" class="chat-teaser-x" aria-label="Masquer ce message">×</button>
        </div>`);
      const bulle = document.querySelector('.chat-teaser');
      const cacher = (memoriser) => {
        bulle.classList.remove('show');
        setTimeout(() => bulle.remove(), 300);
        toggle.classList.remove('chat-pulse');
        if (memoriser) { try { sessionStorage.setItem('nr-chat-teaser', 'ferme'); } catch (e) { /* rien */ } }
      };
      setTimeout(() => bulle.classList.add('show'), 2500);
      const bas = document.querySelector('.site-footer');
      if (bas && 'IntersectionObserver' in window) new IntersectionObserver((es) => es.forEach((e) => bulle.classList.toggle('ct-hidden', e.isIntersecting))).observe(bas);
      bulle.querySelector('.chat-teaser-open').addEventListener('click', () => { toggle.click(); cacher(true); });
      bulle.querySelector('.chat-teaser-x').addEventListener('click', () => cacher(true));
      toggle.addEventListener('click', () => cacher(true));
    };
    attendre(20);
  }

  // Mode démonstration : réponses par mots-clés à partir de la connaissance publiée par le site
  function demoChat() {
    let faq = [];
    fetch('chat-connaissance.json').then((r) => r.json()).then((d) => { faq = d.faq || []; }).catch(() => {});

    document.body.insertAdjacentHTML('beforeend', `
      <button class="chat-fab" type="button" aria-controls="chat" aria-expanded="false" aria-label="Ouvrir le chat : une question ?">${LOGO}<span class="lbl">Une question ?</span><span class="dot" aria-hidden="true"></span></button>
      <section class="chat" id="chat" aria-label="Discuter avec l’assistant">
        <div class="chat-hd">${LOGO}<div><strong>Assistant Nataliia Résine</strong><span>Moquette de pierre · devis gratuit</span></div><button type="button" class="chat-x" aria-label="Fermer le chat">×</button></div>
        <div class="chat-log" aria-live="polite"></div>
        <div class="quick">
          <button type="button">Vous faites quoi ?</button><button type="button">Vous intervenez où ?</button><button type="button">Quels granulats ?</button><button type="button">Combien ça coûte ?</button><button type="button">Voir des chantiers</button>
        </div>
        <form class="chat-in"><input type="text" placeholder="Votre question…" aria-label="Votre question" autocomplete="off"><button type="submit">Envoyer</button></form>
        <div class="chat-demo">Réponses automatiques · pour un devis, utilisez la page Contact</div>
      </section>`);

    const fab = document.querySelector('.chat-fab'); const box = document.getElementById('chat');
    const log = box.querySelector('.chat-log'); const form = box.querySelector('.chat-in'); const input = form.querySelector('input');
    let greeted = false;
    const add = (html, who) => { const m = document.createElement('div'); m.className = 'msg ' + who; m.innerHTML = html; log.appendChild(m); log.scrollTop = log.scrollHeight; return m; };
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    function answer(q) {
      const nq = norm(q);
      let best = null; let score = 0;
      faq.forEach((f) => {
        const s = (f.priorite || 1) * f.mots_cles.reduce((n, k) => {
          const nk = norm(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return n + (new RegExp('(^|[^a-z0-9])' + nk).test(nq) ? k.length : 0);
        }, 0);
        if (s > score) { score = s; best = f; }
      });
      if (best) return best.reponse + (best.lien ? ` <a href="${esc(best.lien.url)}">${esc(best.lien.texte)} →</a>` : '');
      return `Je n’ai pas la réponse à cette question. Le plus simple : la page <a href="contact.html">Contact</a>, ou appelez Nataliia au <a href="tel:${esc(CFG.telephoneLien)}">${esc(CFG.telephone)}</a>.`;
    }
    function ask(q) {
      if (!q.trim()) return;
      add(esc(q), 'me');
      const t = add('écrit…', 'bot typing');
      setTimeout(() => { t.remove(); add(answer(q), 'bot'); }, 600);
    }
    function toggle(open) {
      box.classList.toggle('open', open);
      fab.style.display = open ? 'none' : '';
      fab.setAttribute('aria-expanded', String(open));
      if (open && !greeted) { greeted = true; add(`Bonjour, je suis l’assistant de Nataliia Résine : moquette de pierre (granulats de marbre et résine) pour terrasses, allées, escaliers, abords de piscine, autour de ${esc(CFG.zone)}. Posez-moi votre question.`, 'bot'); }
      if (open) input.focus();
    }
    fab.addEventListener('click', () => toggle(true));
    box.querySelector('.chat-x').addEventListener('click', () => toggle(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('open')) toggle(false); });
    box.querySelector('.quick').addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') ask(e.target.textContent); });
    form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); input.value = ''; });
    teaser('.chat-fab');
  }

  const start = () => (CFG.webhook ? n8nChat() : demoChat());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
