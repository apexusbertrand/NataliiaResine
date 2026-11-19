#!/usr/bin/env bash
# Déploie les fonctions Supabase et leurs réglages non secrets.
# À lancer depuis la racine du dépôt, sur un ordinateur avec Node.js :
#   bash supabase/deployer.sh <ref-du-projet>
# La référence du projet est dans l'URL du tableau de bord : supabase.com/dashboard/project/<ref>
# Les secrets (GITHUB_TOKEN, BREVO_API_KEY, TURNSTILE_SECRET) se saisissent ensuite
# dans Supabase > Edge Functions > Secrets, jamais dans ce fichier.
set -euo pipefail
REF="${1:?Usage : bash supabase/deployer.sh <ref-du-projet>}"
SITE="https://apexusbertrand.github.io/NataliiaResine/"

npx --yes supabase@latest login
npx --yes supabase@latest link --project-ref "$REF"

# Réglages non secrets
npx --yes supabase@latest secrets set --project-ref "$REF" \
  GITHUB_REPO=apexusbertrand/NataliiaResine \
  ALLOWED_ORIGINS=https://apexusbertrand.github.io \
  ADMIN_URL="${SITE}admin/" \
  ALERT_EMAIL=nataliiaresine@gmail.com \
  SENDER_EMAIL=apexus.claude@gmail.com \
  SENDER_NAME="Nataliia Résine"

# Secret de la purge de nuit : généré ici, affiché une fois pour l'étape pg_cron
CRON_SECRET="$(openssl rand -hex 24)"
npx --yes supabase@latest secrets set --project-ref "$REF" CRON_SECRET="$CRON_SECRET"

npx --yes supabase@latest functions deploy publier --project-ref "$REF"
npx --yes supabase@latest functions deploy demande --project-ref "$REF" --no-verify-jwt
npx --yes supabase@latest functions deploy purger --project-ref "$REF" --no-verify-jwt

cat <<FIN

Fonctions déployées. Dernière étape, la purge de nuit :
Supabase > Database > Extensions : activer pg_cron et pg_net, puis dans SQL Editor :

select cron.schedule('purge-prospects', '17 3 * * *', \$\$
  select net.http_post(
    url := 'https://$REF.supabase.co/functions/v1/purger',
    headers := jsonb_build_object('x-cron-secret', '$CRON_SECRET')
  );
\$\$);
FIN
