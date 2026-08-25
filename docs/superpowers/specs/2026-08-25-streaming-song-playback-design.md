# Écoute progressive pendant la génération — design

**Date :** 2026-08-25
**Statut :** approuvé, prêt pour le plan d'implémentation

## Problème

Générer une chanson prend **~130 secondes** (mesuré sur `music-2.6`, le modèle actuel),
pendant lesquelles le client regarde une animation de chargement qui **ment** : les
`loadingSteps` de `page.tsx` avancent sur une minuterie et n'ont aucun lien avec la
génération réelle. Plus de deux minutes d'attente sur un écran vide, pour un produit
acheté sur un coup de cœur émotionnel.

MiniMax sait pourtant livrer l'audio au fur et à mesure. On peut faire écouter les
premières secondes chantées **au bout de ~14 secondes** au lieu de 124.

## Ce qui a été mesuré (2026-08-25, vraies générations facturées)

Ces chiffres ne viennent pas de la documentation mais de générations réelles avec la clé
de production et le vrai prompt (`buildStylePrompt('bachata','emotional','female')`).

| | music-3.0 | music-2.6 (actuel) |
|---|---|---|
| Premier morceau audible | **13,8–16,0 s** | 24,5 s |
| Dernier morceau audio | 119,4 s | ~129 s |
| Nombre de morceaux | 31–32 | 17 |
| Poids total | 3,87 Mo | 3,84 Mo |

Faits techniques établis :

- `stream: true` **impose** `output_format: 'hex'`. La réponse est du **SSE**
  (`Content-Type: text/event-stream`), lignes `data: {"data":{"audio":"<hex>","status":N}}`.
- **Le flux envoie la chanson deux fois** : les morceaux incrémentaux (`status: 1`), puis
  un message final (`status: 2`) contenant le fichier complet. Vérifié : les morceaux
  `status:1` recollés sont **identiques octet pour octet** au payload `status:2`.
  ⇒ On diffuse les `status:1` ET on les archive. Concaténer les deux produit une chanson
  jouée deux fois.
- Le message `status:2` arrive **~42 s après** le dernier morceau audio (161,3 s contre
  119,4 s). Finaliser sur le dernier `status:1` est donc plus rapide que d'attendre la fin
  déclarée. **Le streaming raccourcit la génération même sans lecture progressive.**
- Il existe un **trou de ~20 s** dans l'arrivée des morceaux, mais il ne provoque **aucune
  coupure** : le modèle produit la musique bien plus vite qu'on ne l'écoute (41 s de musique
  produites à t=26 s). Simulation seconde par seconde : démarrer la lecture dès le premier
  morceau ne rattrape jamais le générateur.
- Accès API : MiniMax a fermé l'API musique payante aux nouveaux clients le **2026-08-20**.
  Le compte CantaMe est antérieur, donc **conservé**. `music-3.0` et `music-2.6` sont
  autorisés ; `music-*-free` renvoient **410 Gone**. Cette clé est un actif de l'entreprise :
  elle n'est pas rachetable.
- **Qualité : `music-3.0` a été écouté et rejeté** (2026-08-25). Il produit un souffle de
  voix masculine en fin de piste alors que la chanson est en voix féminine. On reste donc
  sur `music-2.6`, dont le premier morceau arrive à **24,5 s** — le gain reste de 130 s
  d'attente à ~25 s, soit un facteur 5.

### Conséquence du maintien sur music-2.6

`music-2.6` livre **17 morceaux** au lieu de 31, donc un flux moins régulier. La simulation
seconde par seconde n'a été faite que sur `music-3.0` ; sur `music-2.6` l'estimation à partir
des volumes agrégés (~3,84 Mo pour ~120 s d'audio, premier morceau de 223 Ko ≈ 7 s) indique
également l'absence de coupure, mais **elle n'est pas mesurée**.

⇒ L'implémentation ne doit pas se reposer sur cette estimation. Le lecteur attend d'avoir
**au moins 8 secondes d'audio tamponnées** avant de démarrer, et l'information est de toute
façon disponible à l'exécution (nombre d'octets reçus ÷ 32 000 = secondes de musique).
Ce seuil rend le démarrage sûr quel que soit le modèle, et permettra de rebasculer sur
`music-3.0` un jour sans retoucher la logique de lecture.

## Décisions

| Question | Choix | Raison |
|---|---|---|
| Qui entend le direct | **Le client débloque AVANT que la composition démarre** | Seule option qui garde le paywall étanche. Effet de bord majeur : chaque appel MiniMax est payé, la conversion sur génération passe à 1/1 (aujourd'hui les abandons sont à ta charge) |
| Fermeture de l'onglet | **La génération continue côté serveur** | Un client qui a payé ne perd jamais rien. Impose le découplage générateur/lecteur |
| Modèle | **On reste sur `music-2.6`** | `music-3.0` est plus rapide (14 s contre 24,5 s) mais a été **rejeté à l'écoute** : un souffle de voix masculine en fin de piste, sur une bachata à voix féminine. Sur un produit-cadeau, l'artefact coûte plus cher que les 10 s gagnées |
| Stockage du tampon | **Table Postgres `song_chunks`** | Transactionnel (le verrou anti-double-génération en dépend). Redis est un cache et peut évincer ; Storage n'a pas de transactions |
| Transport vers le navigateur | **MP3 progressif natif** (pas de MediaSource) | MediaSource n'existe pas sur Safari iPhone, et le marché est mobile |
| Les deux assistants | **Un composant partagé monté par les deux** | Ils dérivent déjà et ont causé de vrais bugs. Écrire le streaming deux fois créerait le prochain, sur le chemin où l'argent passe |

## Parcours, appel par appel

L'ordre change : le paiement passe **avant** la composition. La séquence exacte devient :

| # | Appel | Effet |
|---|---|---|
| 1 | `POST /api/generate-lyrics` | Écrit les paroles (inchangé, ~5 s) |
| 2 | `POST /api/generate-song` | **Ne compose plus.** Crée la commande avec les paroles, `status: PENDING_PAYMENT`, `unlocked: false`, `compose_state: 'idle'`, sans audio |
| 3 | `POST /api/orders/[id]/unlock` | Dépense `CREDITS.perSong` (20). Inchangé, déjà idempotent et déjà remboursant. Renvoie 402 `no_credits` → le client va acheter un pack |
| 4 | `POST /api/orders/[id]/compose` | Réclame le job, lance la génération en fond, renvoie le jeton de lecture |
| 5 | `GET /api/orders/[id]/live?t=…` | Le `<audio>` joue le flux |
| 6 | *(fin de job)* | `audio_url` écrite, `compose_state: 'done'`, morceaux supprimés, lecteur normal |

Les étapes 3 et 4 sont déclenchées par **un seul clic** côté client (« Composer ma
chanson · 1 chanson »), mais restent deux appels distincts : `unlock` est déjà écrit,
testé et idempotent, et le refactorer pour y coller la composition ferait perdre ces
propriétés sur le chemin où l'argent passe.

## Architecture

Le générateur et le lecteur sont **délibérément découplés**. Le générateur ignore si
quelqu'un écoute — c'est ce qui rend la fermeture de l'onglet inoffensive.

```
   MiniMax  ──SSE (status:1)──▶  ┌──────────────┐
                                 │  GÉNÉRATEUR  │  waitUntil(), ~119 s
                                 │              │  ignore qui écoute
                                 └──────┬───────┘
                                        │ INSERT (order_id, seq, bytes)
                                        ▼
                                 ╔══════════════╗
                                 ║ song_chunks  ║  tampon durable
                                 ╚══════┬═══════╝
                                        │ SELECT ... WHERE seq > n
                                 ┌──────▼───────┐
   <audio> iPhone ◀── audio/mpeg │   ROBINET    │  GET /orders/[id]/live
                                 └──────────────┘
```

### Modèle de données

**Déjà appliqué en production le 2026-08-25** (section `1i)` de `supabase-setup.sql`).

- `orders.compose_state` — `idle` | `running` | `done` | `failed`
- `orders.compose_started_at`, `orders.compose_heartbeat_at`, `orders.compose_error`
- `song_chunks (order_id uuid, seq int, bytes bytea, created_at)`, PK `(order_id, seq)`,
  `on delete cascade`, **RLS activée sans aucune politique** (service_role uniquement —
  ces octets *sont* la chanson, donc le paywall)
- Index partiel `orders_compose_running_idx` pour le balai des jobs fantômes

Les morceaux sont **supprimés dès la finalisation** : la table ne contient que les chansons
en cours de fabrication.

### `POST /api/orders/[id]/compose`

Rend la main immédiatement.

1. `requireUnlockedOrder()` — la porte existante de `orderAccess.ts`, pas une nouvelle
2. **Réclamation atomique** :
   `UPDATE orders SET compose_state='running', compose_started_at=now()
   WHERE id=? AND compose_state IN ('idle','failed')`
   Aucune ligne modifiée ⇒ déjà en cours, on ne relance rien. Un double-clic ne peut plus
   facturer deux générations MiniMax.
3. `waitUntil(runComposition(orderId))` puis retourne `{ playToken, state }`

`runComposition` lit le SSE, insère chaque morceau `status:1` (`seq` incrémental), met à
jour `compose_heartbeat_at`, puis à la fin : concatène, téléverse dans le bucket `songs`,
écrit `orders.audio_url`, passe `compose_state='done'`, supprime les morceaux.

### `GET /api/orders/[id]/live?t=<jeton>`

Renvoie `Content-Type: audio/mpeg`, **sans `Content-Length` ni `Accept-Ranges`** (flux vivant).
Émet d'abord tout ce qui existe en base, puis sonde toutes les ~1 s les `seq` supérieurs
jusqu'à ce que `compose_state` ne vaille plus `running`, puis ferme.

Une reconnexion **rejoue depuis `seq = 0`** et enchaîne sur le direct. C'est ~4 Mo
re-téléchargés, et ça règle gratuitement le fait que Safari iPhone relance volontiers une
requête audio en cours de route : le comportement est correct par construction.

### Le jeton de lecture

Une balise `<audio>` **ne peut pas porter le Bearer token Supabase** (contrainte déjà
documentée : c'est pourquoi `/api/orders/[id]/stream` ne peut pas faire jouer de son).
`/live` accepte donc un jeton **HMAC signé serveur** (`orderId` + expiration courte, ~10 min),
émis par `/compose`. Ce n'est pas un contournement du paywall : le jeton n'est délivré que
pour une commande déjà payée et déverrouillée.

### Échec et remboursement

Erreur SSE, aucun morceau audio, ou exception : `compose_state='failed'`,
`compose_error` renseigné, **`CREDITS.perSong` recrédités automatiquement**, message client
« la composition a échoué, tes crédits t'ont été rendus ».

**Balai des jobs fantômes** — une fonction serverless peut mourir sans prévenir. Une commande
`running` dont le `compose_heartbeat_at` a plus de **6 minutes** est déclarée échouée et
remboursée. Sans ça, un client resterait sur un écran de chargement éternel, crédits débités.

## Interface

Un seul composant, `<SongComposer>`, monté par les deux assistants.

```
  ✍️  On écrit les paroles…              (~5 s, OpenAI — déjà le cas)
  🎙️  <Prénom> entre en studio…          (0 → ~25 s)
  ▶   ÇA JOUE   ●EN DIRECT               (dès 8 s d'audio tamponnées)
        + les paroles s'affichent pendant l'écoute
  ✅  Terminé — lecteur complet, curseur, téléchargement
```

- **Les paroles défilent pendant l'écoute.** Elles sont déjà en main avant la musique :
  gratuit à afficher, et ça transforme l'attente en lecture. C'est le moment émotionnel vendu.
- **Pas de barre de progression en direct, un badge « EN DIRECT ».** Un MP3 en flux annonce
  une durée infinie — le bug que le tableau de bord contourne aujourd'hui par une sonde
  (`playIntentRef` / `probing`). On assume plutôt que de bricoler : le curseur apparaît à la fin.
- Un compte à **0 crédit** ne voit jamais l'écran de composition : il est envoyé vers l'achat
  d'un pack.

## Pièges à ne pas rouvrir

1. **La composition ne démarre JAMAIS au montage d'une page.** Uniquement sur clic explicite.
   `/create/preview` compose actuellement au montage — déjà un bug documenté, qui deviendrait
   un **débit automatique à chaque rechargement** maintenant que le paiement est en amont.
   Au retour d'un achat (`?paid=1`) : afficher « Tes crédits sont là — lancer la composition ? »
   avec un bouton.
2. **Ne jamais concaténer `status:1` + `status:2`** → chanson jouée deux fois.
3. **Ne pas ajouter de politique RLS sur `song_chunks`** pour « réparer » une lecture.
   Passer par une route serveur.
4. **Le prompt reste ≲300 caractères** (`npm run check:prompts`). Il est calibré
   empiriquement sur `music-2.6` — tout changement de modèle invalide ce calibrage, et ça
   se juge à l'oreille, pas au type-check.
5. **Ne pas démarrer la lecture au premier octet.** Attendre le seuil de 8 s tamponnées.
   La simulation anti-coupure a été faite sur `music-3.0` (31 morceaux) ; `music-2.6` n'en
   livre que 17, donc un flux moins régulier qui n'a pas été mesuré seconde par seconde.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `src/lib/songStream.ts` | **nouveau** — parsing SSE, écriture/lecture des morceaux |
| `src/lib/generateSong.ts` | variante streaming — **le modèle reste `music-2.6`** |
| `src/lib/orderAccess.ts` | émission + vérification du jeton de lecture |
| `src/app/api/orders/[id]/compose/route.ts` | **nouveau** — réclamation + `waitUntil` |
| `src/app/api/orders/[id]/live/route.ts` | **nouveau** — le robinet |
| `src/components/SongComposer.tsx` | **nouveau** — l'étape partagée |
| `src/app/page.tsx`, `src/app/create/preview/page.tsx` | montent `<SongComposer>` |
| `src/app/api/generate-song/route.ts` | ne compose plus ; crée la commande verrouillée |
| `src/locales/es.json`, `en.json` | nouvelles clés, **parité obligatoire** |
| `supabase-setup.sql` | ✅ déjà fait (section `1i`) |

## Vérification

Pas de framework de test dans ce projet. La validation passe par :

- `npm run build` (type-check complet) et `npm run check:prompts`
- `node .claude/skills/verify/scripts/check-i18n.mjs` (parité es/en)
- Parcours manuel en dev : composition complète, **fermeture d'onglet en plein direct puis
  retour** (le cas qui justifie toute l'architecture), génération en échec → crédits rendus,
  double-clic sur « Composer » → une seule génération facturée
- Écoute sur **iPhone réel**, pas seulement un navigateur de bureau

## Hors périmètre

- Le plafond de stockage Supabase (plan FREE, ~250 chansons à 3,87 Mo) — à traiter à part
- `LYRICS_MAX_CHARS = 1500` alors que l'API accepte 3500 — piste qualité, à mesurer séparément
- Le passage à `music-3.0` — **rejeté à l'écoute le 2026-08-25** (souffle de voix masculine
  en fin de piste, sur une chanson à voix féminine). À reconsidérer si MiniMax corrige
  l'artefact : le gain serait de ~10 s sur le premier son et d'un flux deux fois plus régulier
