# Guide ingénieur — CareWatch

Documentation technique du pipeline de surveillance physiologique par webcam.
Ce guide décrit l'architecture, les algorithmes, les seuils, le modèle de
données, la validation et le déploiement. Il suppose une familiarité avec le
traitement du signal et le développement web.

CareWatch est un prototype de recherche. Il n'est pas certifié comme
dispositif médical et ne doit pas être utilisé pour un diagnostic.

## 1. Périmètre

| Domaine | Mesure | Statut |
| :--- | :--- | :--- |
| Cardio | Fréquence cardiaque par rPPG | Estimée, confiance mesurée |
| Cardio | RMSSD, SDNN, LF/HF | Calculés sur les IBI |
| Respiration | Non mesurée | Hors périmètre |
| Oxygénation | SpO2 par ratio-of-ratios | Expérimentale, non calibrée |
| Vigilance | PERCLOS, bâillements | Estimée par vision |
| Douleur | Grimace faciale | Indice indicatif |
| Posture | Squelette 33 points | Détection |
| Urgence | Paume ouverte | Détection 3D |

## 2. Architecture

```
+--------------------------- Navigateur ----------------------------+
|  React 18 + Vite                                                  |
|                                                                   |
|  getUserMedia -> <video> -> canvas (ROI, overlay)                 |
|       |                                                           |
|       +-- MediaPipe FaceMesh (478 pts) -> EAR, MAR, ROI           |
|       +-- MediaPipe Pose (33 pts)      -> squelette               |
|       +-- MediaPipe Hands (21 pts)     -> paume 3D                |
|       |                                                           |
|       +-- rPPG: POS -> Butterworth -> DFT -> HR, SNR, SpO2        |
|       |                                                           |
|       +-- Fusion -> metriques -> alertes -> alarme WebAudio       |
|       +-- Historique localStorage -> rapport PDF (jsPDF)          |
+-------------------------------------------------------------------+
                              |  /api (meme origine en production)
                              v
+--------------------------- Serveur -------------------------------+
|  Express + SQLite (users, sessions, health_metrics, alerts, ...)  |
|  Novu (in-app, e-mail)  |  Telegram Bot API  |  static dist/      |
+-------------------------------------------------------------------+
```

Le frontend est autonome. En mode statique (Hugging Face, GitHub Pages),
`api.js` détecte l'absence de backend et bascule sur une session locale ; le
rPPG, la vision, les alertes locales et le PDF restent opérationnels.

## 3. Pipeline temps réel

### 3.1 Acquisition et région d'intérêt

La boucle d'acquisition tourne à la cadence de `requestAnimationFrame`. Chaque
image est dessinée dans un canvas hors écran, puis les pixels sont lus
uniquement dans des patchs autour des points du visage :

- front (10),
- joue droite (234, 93),
- joue gauche (454, 323).

La moyenne RGB de chaque patch fournit un échantillon par image. La cadence
réelle est estimée à partir des horodatages :

$$
f_s = \frac{N-1}{t_{N-1}-t_0}
$$

avec repli à 30 Hz lorsque l'échantillon est trop court.

La source vidéo est sélectionnable. `camera.js` mémorise l'identifiant du
périphérique et construit une contrainte `deviceId: { exact }`, ce qui permet
d'utiliser une caméra virtuelle iVCam alimentée par un téléphone. Si la
source a disparu, `getUserMedia` échoue en `OverconstrainedError` et la
session bascule sur la caméra par défaut sans interruption.

### 3.2 Plane-Orthogonal-to-Skin (POS)

Sur une fenêtre glissante $T_w = 1{,}6$ s, on normalise chaque canal par sa
moyenne puis on construit les projections orthogonales :

$$
X_i = \frac{r_i}{\bar r} - \frac{g_i}{\bar g}, \qquad
Y_i = \frac{r_i}{\bar r} + \frac{g_i}{\bar g} - 2\frac{b_i}{\bar b}
$$

Le coefficient d'équilibrage est le rapport des écarts-types :

$$
\alpha = \frac{\sigma(X)}{\sigma(Y)}
$$

et le signal de pulsation vaut, avec recouvrement-additif des fenêtres :

$$
H_i = X_i - \alpha Y_i
$$

Cette formulation, proposée par Wang et al. (2017), isole la composante
pulsatile commune aux trois canaux tout en annulant les variations
d'éclairage corrélées.

### 3.3 Filtrage

Le signal est filtré par deux biquads RBJ en cascade (Butterworth du second
ordre, $Q = 1/\sqrt{2}$) :

- passe-haut à $f_c = 0{,}7$ Hz (42 bpm),
- passe-bas à $f_c = 4{,}0$ Hz (240 bpm).

La fonction de transfert d'un biquad est :

$$
H(z) = \frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}
$$

avec, pour un passe-bande normalisé,

$$
\omega_0 = \frac{2\pi f_c}{f_s}, \qquad
\alpha_q = \frac{\sin \omega_0}{2Q}, \qquad
a_0 = 1 + \alpha_q
$$

Les coefficients sont normalisés par $a_0$. Le filtre est appliqué en régime
établi, image par image, sans stocker l'historique sur disque.

### 3.4 Estimation de la fréquence et confiance

Une fenêtre de Hann est appliquée au signal filtré, puis une DFT est évaluée
sur la bande 0,7–4,0 Hz. Le pic grossier est affiné par interpolation
parabolique :

$$
f^* = f_k + \frac{\Delta f}{2}
\cdot \frac{P_{k-1}-P_{k+1}}{P_{k-1}-2P_k+P_{k+1}}
$$

La fréquence cardiaque est $HR = 60 f^*$. La confiance n'est pas une
constante : elle dérive du rapport signal/bruit spectral,

$$
\mathrm{SNR}_{dB} = 10\log_{10}\frac{P_{in}}{P_{out}}
$$

où $P_{in}$ est la puissance dans une bande de $\pm 0{,}2$ Hz autour du pic
et $P_{out}$ la puissance restante de la bande. La confiance affichée est :

$$
c = \mathrm{clamp}\!\left(\frac{\mathrm{SNR}_{dB}+3}{13},\,0,\,1\right)
$$

Ainsi, un SNR de $-3$ dB donne une confiance nulle et un SNR de $10$ dB donne
une confiance maximale. Les alertes cardiaques exigent $c > 0{,}3$ et au
moins trois estimations consécutives. La valeur affichée est la médiane des
cinq dernières estimations.

### 3.5 Saturation en oxygène

La SpO2 est estimée par ratio-of-ratios sur les canaux rouge et vert :

$$
R = \frac{AC_R/DC_R}{AC_G/DC_G}, \qquad
SpO_2 \approx 100 - 18\,(R-0{,}5)
$$

La valeur est bornée à $[85, 100]$. La confiance est proportionnelle à
l'amplitude AC exploitable :

$$
c_{SpO_2} = \mathrm{clamp}\!\left(\frac{\min(a_R, a_G)}{0{,}01},\,0,\,1\right),
\qquad a = \frac{AC}{DC}
$$

Une alerte n'est émise que si $SpO_2 < 92\,\%$ et $c_{SpO_2} > 0{,}5$. Cette
mesure est expérimentale : l'absence de calibration par longueur d'onde et de
contrôle de la pression tissulaire interdit tout usage clinique.

### 3.6 Vision faciale

Le maillage FaceMesh fournit 478 points. Les indices utilisés sont :

| Élément | Indices |
| :--- | :--- |
| Œil droit | 33, 160, 158, 133, 153, 144 |
| Œil gauche | 362, 385, 387, 263, 373, 380 |
| Bouche (haut, bas) | 13, 14 |
| Bouche (commissures) | 78, 308 |

Le ratio d'ouverture des yeux est :

$$
EAR = \frac{\|p_2-p_6\| + \|p_3-p_5\|}{2\,\|p_1-p_4\|}
$$

Un œil est considéré fermé sous $0{,}20$. Le PERCLOS est la proportion
d'images fermées sur une fenêtre glissante de 60 s à 30 Hz. La somnolence
affichée est :

$$
D = \mathrm{clamp}(100 \cdot 3 \cdot \mathrm{PERCLOS},\,0,\,100)
$$

Le bâillement utilise le ratio d'ouverture de bouche :

$$
MAR = \frac{\|p_{13}-p_{14}\|}{\|p_{78}-p_{308}\|}
$$

Un plancher adaptatif est entretenu lorsque la bouche est au repos :

$$
\phi = \max(0{,}09,\;1{,}25\,\bar{MAR}_{repos})
$$

Le niveau brut, lissé par moyenne exponentielle, vaut :

$$
y_{raw} = \mathrm{clamp}\!\left(\frac{MAR-\phi}{0{,}36}\cdot 100,\,0,\,100\right),
\qquad
y_k = 0{,}75\,y_{k-1} + 0{,}25\,y_{raw}
$$

Le calcul est continu, indépendant du tampon rPPG : un visage détecté suffit
à alimenter l'indicateur. La valeur de repos n'est mise à jour que lorsque
$y_{raw} < 25$, ce qui évite que le bâillement ne soit absorbé par sa propre
moyenne.

### 3.7 Geste d'urgence

Le geste est évalué sur les landmarks 3D (`worldLandmarks`, en mètres) et non
sur la projection 2D. Lorsqu'une paume fait face à l'objectif, les doigts
pointent vers la caméra et se projettent près du poignet : un test 2D échoue
précisément dans le cas utile. Les critères sont :

1. au moins 4 doigts sur 5 tendus, avec
   $\|p_{tip}-p_0\| > 1{,}06\,\|p_{pip}-p_0\|$ en 3D ;
2. taille apparente suffisante :
   $\max(\|p_0-p_9\|,\,0{,}8\,\|p_5-p_{17}\|) \ge 0{,}055$ ;
3. normale de paume orientée vers la caméra :
   $\|n_z\|/\|n\| \ge 0{,}25$, avec
   $n = (p_{17}-p_5) \times (p_9-p_0)$.

Le maintien est temporel : 450 ms de détection continue, avec une tolérance
de 350 ms entre deux détections (les sorties de MediaPipe sont
intermittentes). Un cooldown de 30 s empêche les répétitions. Le
déclenchement produit une bannière, une alarme WebAudio (trois double-bips
880/660 Hz), une alerte critique immédiate et, si le backend est présent, une
notification Novu et Telegram.

### 3.8 Grimace de douleur

Le score combine trois descripteurs faciaux, avec des références adaptatives :

$$
G = 100\,\mathrm{clamp}\!\left(
0{,}50\,D_{sourcil} + 0{,}30\,D_{nez} + 0{,}40\,O_{bouche}
\right)
$$

où $D_{sourcil}$ mesure l'abaissement des sourcils, $D_{nez}$ l'élévation du
sillon nasogénien et $O_{bouche}$ l'ouverture de bouche. Le score est actif
lorsqu'il dépasse 60 sur environ 0,2 s, avec un cooldown de 30 s.

## 4. Fusion et seuils d'alerte

| Alerte | Condition | Gravité | Anti-spam |
| :--- | :--- | :--- | :--- |
| Tachycardie | $HR > 110$ bpm, $c > 0{,}3$, ≥ 3 estimations | high | 15 s |
| Bradycardie | $HR < 50$ bpm, mêmes gardes | high | 15 s |
| Somnolence | $D > 60$ | high | 15 s |
| Somnolence critique | $D > 80$ | critical | 15 s |
| Stress | arousal $> 75$ | high | 15 s |
| SpO2 basse | $SpO_2 < 92$, $c_{SpO_2} > 0{,}5$ | critical | 15 s |
| Geste d'urgence | paume maintenue 450 ms | critical | 30 s |
| Grimace | score ≥ 60 maintenu | high | 30 s |

Le tableau de bord applique un anti-spam par type : une alerte identique ne
peut être renvoyée avant 15 s. Le geste d'urgence dispose d'un cooldown
distinct de 30 s et d'une bannière de 10 s.

## 5. Modèle de données

SQLite, créé au démarrage par `backend/server.js` :

| Table | Rôle |
| :--- | :--- |
| `users` | Profil, langue, fuseau |
| `user_consents` | Consentements horodatés |
| `sessions` | Session d'acquisition, appareil, cadence |
| `health_metrics` | Échantillons physiologiques |
| `alerts` | Alertes, gravité, accusé de réception |
| `recommendations` | Recommandations associées |
| `scientific_references` | Sources citées |
| `daily_summaries` | Agrégats quotidiens |
| `user_baselines` | Références personnelles |
| `integrations` | Canaux de notification |
| `user_preferences` | Préférences d'affichage |

En mode statique, l'équivalent est stocké dans `localStorage` sous
`carewatch_history_v1`, agrégé par jour :

```
{
  "days": {
    "2026-10-14": {
      "seconds": 1840, "samples": 184,
      "hrN": 120, "hrSum": 8880, "hrMin": 56, "hrMax": 98,
      "spo2N": 80, "spo2Sum": 7832,
      "rmssdN": 30, "rmssdSum": 1350,
      "drowsyMax": 42, "yawnMax": 61, "grimaceMax": 38,
      "confSum": 62, "confN": 100,
      "alerts": { "fatigue": 1, "emergency": 1 }
    }
  }
}
```

Une écriture est effectuée au maximum toutes les 10 s pour limiter l'usure du
stockage. Les valeurs physiologiques sont bornées à $[0, 100]$.

## 6. Rapport PDF et traçabilité

Le rapport est généré dans le navigateur par jsPDF, chargé dynamiquement pour
ne pas alourdir le bundle initial. Il comporte six sections :

1. identification de la période et de la source ;
2. synthèse des constantes ;
3. alertes par type ;
4. détail quotidien ;
5. traçabilité ;
6. références.

La traçabilité repose sur une empreinte SHA-256 du jeu de données canonique :

$$
h = \mathrm{SHA256}\big(\mathrm{JSON}(D)\big), \qquad
\mathrm{r\acute{e}f} = \texttt{CW-}AAMM\texttt{-}h_{[0:6]}
$$

La référence, l'horodatage, la version et la chaîne de traitement figurent
dans le document. Le PDF est produit localement : aucune donnée n'est
transmise.

## 7. Backend et notifications

Routes principales :

| Méthode | Route | Rôle |
| :--- | :--- | :--- |
| GET | `/api/health` | Sonde de disponibilité |
| POST | `/api/users` | Création de profil |
| POST | `/api/users/:id/consent` | Consentement |
| POST | `/api/session/start` | Ouverture de session |
| POST | `/api/session/:id/end` | Clôture |
| POST | `/api/metrics/save` | Échantillon physiologique |
| POST | `/api/alerts/save` | Alerte + notifications |
| GET | `/api/session/:id/history` | Historique de session |
| GET | `/api/users/:id/stats` | Statistiques agrégées |

L'envoi d'alerte est asynchrone et non bloquant. Novu reçoit un déclencheur
de workflow ; Telegram est appelé directement via l'API Bot. Un échec de
notification est journalisé sans interrompre la requête.

Le serveur expose aussi `dist/` et renvoie `index.html` pour toute route non
API, ce qui permet un déploiement monolithique sur un seul port
(`PORT`, 5000 par défaut).

## 8. Validation

Les modules purs (`rppg.js`, `gestures.js`) sont testés hors navigateur avec
des signaux synthétiques :

| Test | Résultat |
| :--- | :--- |
| Cadence estimée | 30,00 Hz |
| Fréquence cardiaque | 72 bpm |
| SNR spectral | 17,66 dB |
| Confiance | 1,00 |
| Intervalle inter-battements | 833 ms |
| SpO2 synthétique | 100 % (confiance 0,55) |
| Paume 3D face caméra | détectée |
| Poing fermé | rejeté |
| Repli 2D | détecté |
| Bâillement (fermé / entrouvert / franc) | 0 / 19 / 100 |

La validation en conditions réelles dépend de l'éclairage, de la caméra et de
la stabilité du sujet. Le navigateur d'intégration continue ne dispose pas de
caméra : les tests de bout en bout temps réel sont réalisés manuellement.

## 9. Limites connues

- La SpO2 par caméra n'est pas calibrée ; elle est indicative.
- Le rPPG est sensible au mouvement et aux variations de luminosité.
- Les modèles MediaPipe sont téléchargés depuis un CDN au premier chargement.
- Le mode statique ne peut pas envoyer de notifications distantes.
- Les navigateurs mobiles suspendent `requestAnimationFrame` lorsque l'onglet
  passe en arrière-plan.
- La détection de paume peut échouer en contre-jour ou main trop éloignée.

## 10. Déploiement

### Local

```bash
cd backend && npm install && npm start
cd frontend && npm install && npm run dev
```

Le frontend utilise `http://localhost:5000` en développement et la même origine
en production (`import.meta.env.PROD`).

### Statique

```bash
cd frontend
npm run build
# dist/ peut être servi par n'importe quel hébergeur statique
```

Les workflows GitHub Actions publient sur GitHub Pages. Le Space Hugging Face
est un Space statique gratuit : l'API n'y est pas disponible, le frontend
bascule automatiquement en mode local.

### Variables d'environnement

```
NOVU_API_URL, NOVU_API_KEY, NOVU_WORKFLOW, NOVU_SUBSCRIBER
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
PORT
```

Aucun secret n'est versionné. Les jetons sont fournis par l'environnement ou
un fichier `.env` exclu du dépôt.

## 11. Références

1. Organisation mondiale de la Santé. *Plan d'action mondial pour la
   prévention et la lutte contre les maladies non transmissibles 2013–2020*.
   Genève : OMS ; 2013.
2. Organisation mondiale de la Santé. *Lignes directrices sur l'activité
   physique et les comportements sédentaires*. Genève : OMS ; 2020.
3. Organisation mondiale de la Santé. *Rapport mondial sur l'hypertension :
   la course contre un tueur silencieux*. Genève : OMS ; 2023.
4. Organisation mondiale de la Santé. *Manuel de formation à l'oxymétrie de
   pouls*. Genève : OMS ; 2011.
5. Wang W, den Brinker AC, Stuijk S, de Haan G. Algorithmic principles of
   remote PPG. *IEEE Transactions on Biomedical Engineering*.
   2017;64(7):1479–1491.
6. Task Force of the European Society of Cardiology and the North American
   Society of Pacing and Electrophysiology. Heart rate variability: standards
   of measurement, physiological interpretation, and clinical use.
   *Circulation*. 1996;93(5):1043–1065.
7. Dinges DF, Grace R. *PERCLOS: a valid psychophysiological measure of
   alertness as assessed by psychomotor vigilance*. Washington : Federal
   Highway Administration ; 1998.

## 12. Équipe et licence

Équipe 5 · HACK4BLADI · Casablanca · 2026.

Licence MIT. Voir [LICENSE](../LICENSE).
