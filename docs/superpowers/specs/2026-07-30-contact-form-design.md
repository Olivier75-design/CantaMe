# Formulaire de contact — design

**Date :** 2026-07-30
**Statut :** approuvé, en implémentation

## Problème

Le footer, `/privacy` et `/terms` affichent `hello@cantame.app` — une adresse qui
n'existe pas. Un visiteur qui écrit à cette adresse n'atteint personne, et l'adresse
est aspirable par les robots spammeurs.

## Solution

Remplacer l'adresse par un formulaire de contact en modal. Les messages sont
enregistrés en base et consultés dans `/admin`. L'admin répond depuis sa propre
boîte mail via un lien `mailto:` pré-rempli — **aucun service d'envoi (SMTP,
Resend) n'est requis**, ce qui est cohérent avec le reste du projet (l'inscription
crée déjà des comptes pré-confirmés faute de SMTP).

## Décisions

| Question | Choix | Raison |
|---|---|---|
| Page vs modal | **Modal** | Ne fait pas perdre au visiteur sa place dans le tunnel de création |
| Champs | **nom, email, sujet, message** | Le sujet permet de trier ; le nom permet de répondre personnellement |
| Notification | **Admin seulement** | Zéro dépendance externe, zéro coût, opérationnel immédiatement |

## Architecture

### Ouverture globale du modal

`Footer` est monté dans le root layout → présent sur toutes les pages. Il monte
`ContactModal`. L'ouverture depuis ailleurs (privacy, terms) passe par un
événement window `cantame:contact`, ce qui évite de dupliquer le formulaire ou
d'introduire un contexte React supplémentaire pour un seul bouton.

```
Footer (root layout)  ──monte──>  ContactModal
   │                                  ▲
   └─ bouton "Nous contacter" ────────┤ open()
                                      │
/privacy, /terms ──dispatchEvent('cantame:contact')
```

### Flux de données

```
ContactModal ──POST /api/contact──> validation + rate limit + honeypot
                                          │
                                          └──> table contact_messages (service_role)
                                                        │
/admin (onglet Messages) <──GET /api/admin/contact──────┘
       │
       └─ PATCH /api/admin/contact/[id]  (statut, note)
       └─ bouton "Répondre" → mailto: pré-rempli
```

### Composants

**`src/lib/contact.ts`** (serveur) — accès aux données et validation. Une seule
responsabilité : la persistance des messages. `validateContactInput()` est pure et
testable indépendamment de la base.

**`src/lib/constants.ts`** — `CONTACT_SUBJECTS` (liste blanche des sujets). Placé
ici parce que le client et le serveur en ont besoin ; `contact.ts` importe
`getSupabaseServer()` et ne doit jamais être importé par du code client
(même précédent que `promo.ts` / `promoClient.ts`).

**`POST /api/contact`** — public. Rate limit 3 / 10 min par IP. Validation
serveur systématique : le client n'est jamais cru. Honeypot rempli → réponse 200
sans écriture (le bot croit avoir réussi et ne réessaie pas).

**`GET /api/admin/contact`** et **`PATCH /api/admin/contact/[id]`** — derrière
`verifyAdminRequest()`, comme toutes les routes admin.

**`ContactModal.tsx`** — état local uniquement. Pré-remplit nom/email depuis
`useAuth()` si l'utilisateur est connecté. Conserve la saisie en cas d'erreur.

### Schéma

```sql
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null default 'general',
  message text not null,
  status text not null default 'new',   -- new | read | replied | archived
  admin_note text,
  user_id uuid,
  ip text,
  user_agent text,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
```

**RLS activée sans aucune policy** → seul `service_role` accède à la table. Les
emails des visiteurs ne sont donc pas lisibles depuis le navigateur, même avec la
clé anon. C'est la contrainte de sécurité la plus importante de ce design.

## Validation des entrées

| Champ | Règle | Échec |
|---|---|---|
| `name` | 1–80 caractères après trim | 400 |
| `email` | format valide, ≤ 160 caractères | 400 |
| `subject` | doit appartenir à `CONTACT_SUBJECTS` | rabattu sur `general` |
| `message` | 10–2000 caractères après trim | 400 |
| honeypot | doit être vide | 200 silencieux, aucune écriture |

## Gestion d'erreurs

- **429** → « Trop de messages, réessaie dans quelques minutes. »
- **400** → message précisant le champ fautif.
- **500 / réseau** → erreur générique ; **la saisie est conservée** pour que le
  visiteur n'ait pas à réécrire son message.
- **Table absente** → l'API log côté serveur et renvoie 500 ; l'admin affiche un
  état vide explicite plutôt qu'un plantage (même approche que `/api/analytics`).

## i18n

Nouvelles clés sous `contact.*`, présentes **à l'identique** dans `es.json` et
`en.json` — une clé manquante fait afficher le chemin brut par `t()`.

## Hors périmètre (YAGNI)

- Pièces jointes
- Fils de discussion / réponse depuis l'admin
- Notification email ou push à l'admin (choix explicite : l'onglet suffit au volume actuel)
- CAPTCHA (le honeypot + le rate limit suffisent à ce stade)

## Étape manuelle

Le bloc `contact_messages` de `supabase-setup.sql` doit être exécuté une fois dans
le SQL Editor Supabase. Tant qu'il ne l'est pas, l'envoi renvoie une erreur et
l'onglet admin reste vide.

## Validation

Pas de framework de test dans ce projet. Vérification via la skill
`cancion-tuya:verify` : `npm run build` (type-check complet), parité des clés
i18n, lint, scan de secrets — puis test manuel du flux envoi → admin → répondre.
