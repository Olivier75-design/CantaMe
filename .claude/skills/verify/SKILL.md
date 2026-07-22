---
name: verify
description: Vérifie CantaMe avant un commit ou un push — build + type-check, parité des clés i18n es/en, lint, et scan de secrets dans le diff git. À utiliser quand on demande de « vérifier », « valider », « préparer un commit » ou avant de pousser sur main.
---

# Vérifier CantaMe avant de pousser

Objectif : attraper les erreurs avant qu'elles n'atteignent Vercel (le déploiement se fait depuis `main`). Tout se lance depuis la racine du dépôt **`cancion-tuya/`** (l'app Next.js y vit ; l'espace de travail parent `CantaMe/` n'est pas le repo).

Exécuter les étapes dans l'ordre. Rapporter un résumé clair à la fin (✓ / ✗ par étape). En cas d'échec, s'arrêter et expliquer quoi corriger — ne pas committer tant qu'une étape est ✗.

## 1. Build + type-check
`npm run build` fait aussi le type-check TypeScript complet. Sur cette machine, `.next` est verrouillé par OneDrive → tuer node et supprimer `.next` d'abord, sinon erreur EPERM.

PowerShell :
```
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$next = "c:\Users\olivi\OneDrive\Documents\CantaMe\cancion-tuya\.next"
if (Test-Path $next) { Remove-Item -Recurse -Force $next -ErrorAction SilentlyContinue }
Push-Location "c:\Users\olivi\OneDrive\Documents\CantaMe\cancion-tuya"; npm run build; Pop-Location
```
Attendre `✓ Compiled successfully` **et** `Finished TypeScript`. Toute erreur de type = ✗.

## 2. Parité des clés i18n (es ↔ en)
Chaque chaîne visible doit exister dans `src/locales/es.json` **et** `src/locales/en.json` avec le même chemin de clé — sinon `t()` renvoie la clé brute à l'écran. Lancer le script fourni :
```
Push-Location "c:\Users\olivi\OneDrive\Documents\CantaMe\cancion-tuya"; node .claude/skills/verify/scripts/check-i18n.mjs; Pop-Location
```
Sortie `✓ i18n OK` = bon. Toute clé listée comme manquante = ✗ (l'ajouter dans le fichier qui manque, à l'identique).

## 3. Lint (optionnel mais recommandé)
```
Push-Location "c:\Users\olivi\OneDrive\Documents\CantaMe\cancion-tuya"; npm run lint; Pop-Location
```
Les erreurs bloquent ; les warnings sont tolérés mais à signaler.

## 4. Scan de secrets dans le diff
Avant tout commit, s'assurer qu'aucune **vraie** valeur secrète ne part sur GitHub. Seul `.env.example` (placeholders) peut être suivi ; `.env.local` doit rester ignoré.

- Vérifier que `.env.local` n'est PAS suivi : `git -C "c:\Users\olivi\OneDrive\Documents\CantaMe\cancion-tuya" ls-files --error-unmatch .env.local` doit échouer (« did not match »).
- Scanner le diff (staged + working) pour des motifs de secrets réels :
  `git -C "c:\Users\olivi\OneDrive\Documents\CantaMe\cancion-tuya" diff HEAD` puis chercher `sk-` (OpenAI/MiniMax), `sb_secret_` (Supabase service_role), `pvk_` (Moneroo), ou une valeur non vide de `MONEROO_WEBHOOK_SECRET`.
- Si un de ces motifs apparaît ailleurs que dans `.env.example` (placeholders) → **STOP**, ne pas committer, prévenir l'utilisateur.

## 5. Rapport final
Résumer : build, i18n, lint, secrets — chacun ✓ ou ✗. Si tout est ✓, indiquer que c'est prêt à committer/pousser. Ne jamais pousser sans y avoir été autorisé.
