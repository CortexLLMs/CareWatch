# CareWatch × Novu — Guide d'intégration et de test local

> Notifications multicanal (Telegram, e-mail, in-app) pour les alertes physiologiques CareWatch.
> Ce document décrit l'intégration déjà implémentée dans le dépôt et la procédure de test
> de Novu en local, étape par étape.

---

## 1. Ce qui est implémenté dans CareWatch

| Composant | Fichier | Rôle |
|---|---|---|
| Routes API | `backend/routes_novu.js` | `GET /api/novu/status`, `POST /api/novu/test`, `POST /api/novu/notify` |
| Branchement alerte | `backend/server.js` (`POST /api/alerts/save`) | Déclenche Novu en **asynchrone** pour toute alerte `critical` ou `high` |
| Normalisation d'énumération | `backend/server.js` | `heartRate → heart_rate`, `oxygen → spo2` (corrige le rejet par la contrainte `CHECK`) |
| Interface | `frontend/src/components/NotifyCard.jsx` | État du service, canal actif, bouton de test, retour d'envoi |
| Client HTTP | `frontend/src/lib/api.js` | `novuStatus()`, `novuTest()`, `saveAlert(sid, alert, notify)` |
| Configuration | `backend/.env` / `backend/.env.example` | `NOVU_API_URL`, `NOVU_API_KEY`, `NOVU_WORKFLOW`, `NOVU_MOCK`… |

**Principe :** la notification ne bloque jamais l'écriture de l'alerte. Si Novu est lent ou absent,
l'alerte est enregistrée, le canal est tracé dans `alerts.notified_channels` (`["novu:alerte-carewatch"]`)
et l'échec est journalisé côté serveur (`! Novu non envoyé : …`).

### Telegram direct sur anomalie (indépendant de Novu)

| Composant | Fichier | Rôle |
|---|---|---|
| Module Telegram | `backend/telegram.js` | `sendTelegramAlert()` via l'API Bot (`sendMessage`, HTML), `telegramStatus()` |
| Branchement alerte | `backend/server.js` (`POST /api/alerts/save`) | Après Novu, envoi Telegram **uniquement** pour `severity = critical` ou `high` |
| Statut | `backend/routes_novu.js` | `GET /api/novu/status` inclut le champ `telegram` (`enabled`, `tokenSet`, `chatIdSet`) |
| Interface | `frontend/src/components/NotifyCard.jsx` | Ligne `TELEGRAM : Actif — alertes anomalies` ou `Non configuré (TELEGRAM_BOT_TOKEN)` |
| Configuration | `backend/.env` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TIMEOUT` (défaut 6000 ms) |

**Activation en 2 minutes :**
1. Sur Telegram, parler à **@BotFather** → `/newbot` → récupérer le jeton (`123456789:AAF...`).
2. Envoyer `/start` à ce bot, puis ouvrir `https://api.telegram.org/bot<JETON>/getUpdates`
   → relever `result[].message.chat.id` (le `chat_id`).
3. Renseigner `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` dans `backend/.env`, redémarrer le backend.

**Comportement :** message HTML (`🚨/⚠️`, type, message d'anomalie, FC, SpO₂, session, horodatage),
envoi **non bloquant** ; si le jeton est absent, l'envoi est ignoré silencieusement
(et `notified_channels` ne contiendra que `novu:...`). Un envoi réussi ajoute `telegram`
aux canaux de l'alerte en base. Vérification : `POST /api/novu/test` (Novu) puis enregistrer
une alerte `critical` (Telegram) et lire le log serveur (`✓ Telegram notifié (…)`).

**Nouveaux déclencheurs depuis la caméra (frontend) :**

| Type | Sévérité | Déclencheur | Canal |
|---|---|---|---|
| `emergency` | `critical` | **Geste d'urgence** : paume ouverte levée vers la caméra ~1 s (cooldown 30 s) | Novu + Telegram |
| `grimace` | `high` | **Grimace douloureuse maintenue** (sourcils baissés + lèvre haute remontée + bouche tendue ≥ 60 % pendant ~0,2 s) | Novu + Telegram |

Le frontend limite les envois à **1 notification par type toutes les 15 s** (anti-spam),
l'affichage dans *Alertes actives* reste instantané et disparaît dès que le signal retombe.

---

## 2. Déployer Novu en local (procédure officielle)

### 2.1 Prérequis

| Élément | Exigence | Vérification |
|---|---|---|
| Docker + Docker Compose | Dernière version stable | `docker --version` / `docker compose version` |
| Git | Récent | `git --version` |
| RAM libre | **4 Go minimum** (5 Go confortable) | `docker info` → `MemTotal` |
| Ports libres | 3000 (API), 4000 (dashboard) | `netstat -ano | findstr :3000` |

> Sur une machine de 16 Go dont **1 Go seulement est libre**, la pile Novu ne peut pas démarrer :
> MongoDB + Redis + 4 services Novu consomment 4 à 6 Go. Libérez de la mémoire (navigateurs,
> IDE, machine virtuelle) avant de lancer la stack.

### 2.2 Méthode rapide (script officiel de la communauté)

```bash
curl -fsSL https://raw.githubusercontent.com/novuhq/novu/next/docker/community/setup.sh | bash
```

Le script :
1. crée le dossier `./novu` ;
2. génère `JWT_SECRET`, `STORE_ENCRYPTION_KEY` et `NOVU_SECRET_KEY` ;
3. démarre la stack via Docker Compose.

Tableau de bord : <http://localhost:4000> — API : `http://localhost:3000`.

### 2.3 Méthode manuelle (stack communautaire)

```bash
git clone https://github.com/novuhq/novu.git
cd novu/docker/community
cp .env.example .env
docker compose up -d
```

Le `docker-compose.yml` communautaire inclut MongoDB, Redis et les services Novu (API, worker, web).

### 2.4 Commandes utiles

```bash
docker compose ps                 # état des services
docker compose logs -f api        # journaux de l'API
docker compose restart api        # redémarrage ciblé
docker compose down               # arrêt (conserve les volumes)
docker compose down -v            # arrêt + purge des données
```

---

## 3. Configurer le workflow Novu

Dans le tableau de bord (<http://localhost:4000>) :

1. **Créer un workflow** nommé `alerte-carewatch` (identifiant exact repris par `NOVU_WORKFLOW`).
2. **Ajouter un canal** — commencer par **Telegram** (gratuit, configuration la plus rapide et plus
   fiable que les API WhatsApp non officielles) :
   - créer un bot via [@BotFather](https://t.me/BotFather) → récupérer le `TOKEN` ;
   - dans Novu : *Providers → Telegram → Connect* → coller le token ;
   - ouvrir le bot, lui écrire `/start` pour l'enregistrer comme abonné.
3. **Ajouter le canal e-mail** (provider SMTP ou Resend) en second, pour router la même alerte
   vers plusieurs canaux.
4. **Récupérer la clé API** : *Settings → API keys → Create API key* (format `novu_v1_…`).
5. **Créer l'abonné** correspondant à l'identifiant utilisé par CareWatch (`carewatch-user` par
   défaut), ou laisser CareWatch créer l'abonné à la première notification (option *Create
   subscriber if not exists* du workflow).

---

## 4. Brancher CareWatch

`backend/.env` (copier `backend/.env.example`) :

```ini
NOVU_API_URL=http://localhost:3000
NOVU_API_KEY=novu_v1_xxxxxxxxxxxxxxxx
NOVU_WORKFLOW=alerte-carewatch
NOVU_SUBSCRIBER=carewatch-user
NOVU_TIMEOUT=6000
NOVU_MOCK=0
```

Démarrage (le chargeur `.env` natif de Node 24 est utilisé par `npm start` et `npm run dev`) :

```bash
cd backend
npm start          # node --env-file-if-exists=.env server.js
```

> **Mode simulation** : `NOVU_MOCK=1` construit et journalise la charge utile **sans aucun appel
> réseau** — utile pour valider le câblage sans Novu, et pour les environnements de recette.

---

## 5. Tester

### 5.1 État du service

```bash
curl http://localhost:5000/api/novu/status
```

```json
{ "enabled": true, "mock": false, "apiUrl": "http://localhost:3000",
  "workflow": "alerte-carewatch", "subscriberId": "carewatch-user",
  "hasKey": true, "reachable": true, "workflows": ["alerte-carewatch"] }
```

### 5.2 Notification de test

```bash
curl -X POST http://localhost:5000/api/novu/test \
  -H "Content-Type: application/json" \
  -d '{"to":{"subscriberId":"carewatch-user","email":"aidant@example.com"}}'
```

```json
{ "ok": true, "mock": false, "workflow": "alerte-carewatch",
  "status": 201, "acknowledged": true,
  "transactionId": "…", "message": "Evenement Novu declenche" }
```

### 5.3 Déclenchement par une alerte réelle

Le front CareWatch déclenche l'envoi dès qu'un seuil `high` ou `critical` est franchi
(`frontend/src/components/Dashboard.jsx` → `apiSaveAlert(..., notify)`), ou manuellement :

```bash
curl -X POST http://localhost:5000/api/alerts/save \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<uuid>","metrics":{"heartRate":118,"oxygen":90},
       "notify":{"subscriberId":"carewatch-user","email":"aidant@example.com"},
       "alert":{"type":"heartRate","severity":"critical","message":"Elevated heart rate"}}'
```

La réponse reste `{"message":"Alert saved"}` (instantané) ; la notification part en arrière-plan.
Côté base, `alerts.notified_channels` devient `["novu:alerte-carewatch"]`.

### 5.4 Depuis l'interface

Le tableau de bord comporte une carte **Notifications** (en bas du panneau) :
état du service (connecté / simulation / injoignable / non configuré), workflow, canal actif,
bouton **« Envoyer une notification de test »** et retour d'envoi détaillé.

---

## 6. Correspondance des données (CareWatch → Novu → Liquid)

| Champ CareWatch | Clé du payload Novu | Type | Exemple |
|---|---|---|---|
| Type d'alerte | `alert_type` | texte | `heart_rate`, `spo2`, `stress` |
| Sévérité | `severity` | texte | `critical`, `high` |
| Message | `message` | texte | `Elevated heart rate` |
| Fréquence cardiaque | `heart_rate` | bpm | `118` |
| Saturation | `spo2` | \% | `90` |
| Stress | `stress` | 0-100 | `71` |
| Somnolence | `drowsiness` | 0-100 | `12` |
| Excitation (arousal) | `arousal` | 0-100 | `66` |
| HRV (RMSSD) | `rmssd` | ms | `24` |
| Confiance de mesure | `confidence` | 0-100 | `88` |
| Session | `session_id` | uuid | `bf977cd7-…` |
| Horodatage | `recorded_at` | ISO 8601 | `2026-10-22T11:28:53.686Z` |

Dans le workflow Novu, le template Liquid utilise ces clés, par exemple :

```liquid
{{payload.heart_rate}} bpm · SpO2 {{payload.spo2}} %
{{payload.severity | uppercase}} — {{payload.message}}
```

---

## 7. Dépannage

| Symptôme | Cause probable | Correction |
|---|---|---|
| `401` sur `/v1/events/trigger` | `NOVU_API_KEY` absente, expirée ou mal collée | Régénérer la clé dans le dashboard ; vérifier les espaces parasites |
| `404 workflow` | Identifiant de workflow différent | Utiliser l'identifiant affiché dans Novu, ou aligner `NOVU_WORKFLOW` |
| `Novu injoignable` | Conteneur API arrêté ou port 3000 occupé | `docker compose ps`, `docker compose logs -f api` |
| `Delai depasse (6000 ms)` | Novu lent (RAM insuffisante) | Augmenter `NOVU_TIMEOUT`, libérer de la mémoire |
| Aucune trace dans les logs serveur | Alerte `medium`/`low` | Seuls `critical` et `high` notifient ; utiliser `/api/novu/test` |
| Telegram ne reçoit rien | Bot non enregistré / abonné absent | `/start` auprès du bot ; vérifier l'abonné dans Novu |
| L'alerte n'est pas enregistrée | Vocabulaire hors énumération | La route normalise désormais `heartRate`/`oxygen` ; pour un nouveau type, ajouter l'alias dans `TYPE_MAP` |

---

## 8. Sécurité

- La clé Novu **n'est jamais** exposée au navigateur : elle vit uniquement dans `backend/.env`.
- `backend/.env` est ignoré par Git (le `.env` local n'est pas versionné) ; ne versionner que
  `.env.example`.
- Les appels sortants sont bornés par `NOVU_TIMEOUT` et encadrés par un `AbortController`.
- En production : ne jamais activer `NOVU_MOCK=1` (les alertes partiraient en mode simulation) ;
  vérifier au démarrage que `hasKey` vaut `true` (endpoint `/api/novu/status`).
