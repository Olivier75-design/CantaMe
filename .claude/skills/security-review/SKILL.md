---
name: security-review
description: Revue de sécurité de CantaMe — relit un changement (ou une route/zone donnée) pour les failles qui comptent sur cette stack : IDOR/autorisation, secrets exposés, RLS Supabase, validation d'entrées, intégrité des paiements, rate limiting, fuite d'erreurs. À utiliser avant de pousser du code sensible (API, auth, paiements, base de données) ou quand on demande une revue de sécurité.
---

# Revue de sécurité — CantaMe

Stack : Next.js (App Router) + TypeScript + Supabase (Auth / Postgres / Storage via la clé **service_role**) + Moneroo (paiements). Fait fondamental : toutes les routes serveur utilisent `service_role`, qui **contourne RLS** → ce n'est donc PAS la base qui protège les accès applicatifs, c'est **le code** qui doit vérifier l'identité et la propriété des ressources.

## Comment procéder
1. Si un diff apparaît ci-dessous, concentrer la revue dessus ; sinon, revoir la route ou la zone nommée par l'utilisateur.
2. Parcourir la checklist ci-dessous. Pour chaque problème réel : **sévérité** (🔴 critique / 🟠 haute / 🟡 moyenne), `fichier:ligne`, un **scénario d'exploitation concret**, et le **correctif**.
3. Ne rien inventer — ne signaler que ce qui est réellement exploitable. Trier du plus grave au moins grave.

## Changements en cours
!`git -C "c:\Users\olivi\OneDrive\Documents\CantaMe\cancion-tuya" diff HEAD`

## Checklist (par ordre d'impact sur CantaMe)

### 1. Autorisation / IDOR — 🔴
- Toute route qui lit ou modifie les données d'un utilisateur DOIT dériver l'identité du **token de session vérifié** (`getUserFromRequest`), JAMAIS d'un champ du body (`userId`, `email`).
- Vérifier la **propriété** de la ressource avant d'agir (la commande appartient bien à l'appelant, ou l'appelant est admin). Sinon, quiconque connaît un UUID agit sur la commande d'autrui.

### 2. Secrets — 🔴
- Aucun secret avec le préfixe `NEXT_PUBLIC_` (ça part dans le bundle navigateur). `SUPABASE_SERVICE_ROLE_KEY`, `MONEROO_SECRET_KEY`, `MONEROO_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `MINIMAX_API_KEY` restent **serveur uniquement**.
- Aucun secret en dur dans le code. `.env.local` reste ignoré par git ; seul `.env.example` (placeholders) est suivi.

### 3. RLS Supabase — 🔴
- Toute **nouvelle table** doit avoir `enable row level security` ET **aucune** policy permissive `using(true)`. L'app passe par `service_role`, donc aucune policy n'est nécessaire pour qu'elle marche — mais RLS off = données lisibles avec la clé anon publique.

### 4. Validation & confiance dans le client — 🟠
- Ne jamais faire confiance au client pour un **prix, un montant, un nombre de crédits, un rôle admin**. Toujours recalculer/résoudre côté serveur (ex. la remise promo est recalculée dans `/api/payments/create`, le prix du pack est résolu depuis `packId`).
- Valider la présence et la forme des champs attendus avant de les utiliser.

### 5. Intégrité des paiements — 🟠
- Montant calculé côté serveur. Webhook Moneroo : signature HMAC-SHA256 vérifiée, **fail-closed** si le secret manque. Le crédit d'un paiement est **idempotent** (une seule fois par `paymentId`).

### 6. Rate limiting — 🟠
- Les routes coûteuses ou abusables (`generate-song`, `generate-lyrics`, `payments/create`, `auth/signup`, `promo/validate`, génération/révision) passent par `rateLimit(...)`.

### 7. Fuite d'informations — 🟡
- Messages d'erreur **génériques** côté client ; détails (stack, message interne, cause) loggés **côté serveur uniquement**. Ne pas renvoyer d'objet d'erreur brut au client.

### 8. Flux d'authentification — 🔴
- Aucune route publique ne doit pouvoir **réinitialiser un mot de passe**, **confirmer un compte arbitraire**, ou **créditer gratuitement** un compte. (Rappel de l'audit : une route signup qui réinitialisait le mot de passe d'un compte existant = prise de contrôle de compte.)

### 9. Injection / XSS — 🟡
- Éviter `document.write` et `dangerouslySetInnerHTML` avec des données non fiables. Les requêtes Supabase doivent rester paramétrées (jamais de SQL concaténé avec de l'entrée utilisateur).

## Rapport final
Terminer par : un **verdict global** (🔴 / 🟠 / 🟡 / ✅), la liste des findings triés du plus grave au moins grave, et pour chacun le **correctif concret**. Si rien n'est trouvé, le dire clairement plutôt que d'inventer des problèmes.
