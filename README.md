# CareWatch

Surveillance physiologique par webcam, exécutée dans le navigateur. CareWatch
estime la fréquence cardiaque et la variabilité cardiaque par
photoplethysmographie distante (rPPG), analyse la posture, les mains et les
expressions faciales, puis produit un rapport mensuel traçable au format d'un
compte rendu d'analyse.

Projet open source sous licence MIT, développé pour le hackathon HACK4BLADI.

## Démonstrations

| Environnement | Lien | Contenu |
| :--- | :--- | :--- |
| Hugging Face (statique) | https://ysfmo98-carewatch.static.hf.space | Caméra, vision, rPPG, rapport PDF |
| GitHub Pages (statique) | https://cortexllms.github.io/CareWatch/ | Même build, hébergement de secours |
| Local (complet) | `http://localhost:5173` | Frontend + API + SQLite + notifications |

Les deux démonstrations statiques exécutent l'intégralité du traitement dans le
navigateur, sans serveur. Le dépôt complet ajoute la persistance SQLite et les
notifications Novu et Telegram.

## Fonctions

- **Fréquence cardiaque (rPPG)** — algorithme POS (Wang et al., 2017), filtre
  passe-bande Butterworth 0,7–4 Hz, estimation spectrale avec interpolation
  parabolique. La confiance affichée est le rapport signal/bruit spectral
  mesuré, jamais une constante.
- **Variabilité cardiaque** — RMSSD, SDNN et ratio LF/HF, calculés côté serveur
  (NeuroKit2) avec repli local sur les intervalles inter-battements.
- **Vision du corps et des mains** — squelette MediaPipe Pose (33 points) et
  Hands (21 points par main), superposé au flux vidéo.
- **Geste d'urgence** — paume ouverte face caméra maintenue 450 ms : alerte
  critique, bannière rouge, alarme sonore et notification. La géométrie est
  calculée en 3D pour rester fiable lorsque la paume fait face à l'objectif.
- **Visage** — maillage facial, ratio d'ouverture des yeux (EAR), PERCLOS,
  bâillements (MAR normalisé) et grimace de douleur.
- **Choix de la source vidéo** — webcam intégrée, caméra USB ou caméra
  virtuelle iVCam alimentée par un téléphone. Le choix est mémorisé et un
  repli automatique évite de bloquer la session si la source disparaît.
- **Rapport mensuel PDF** — compte rendu de laboratoire avec synthèse des
  constantes, détail quotidien, alertes, empreinte SHA-256 et références OMS.
- **Alertes multicanal** — Novu (in-app, e-mail) et Telegram, avec anti-spam
  de 15 secondes par type.
- **Interface trilingue** — français, anglais, arabe (RTL), thèmes clair et
  sombre, mise en page responsive.

## Architecture

```
frontend/   React 18 + Vite, MediaPipe Tasks Vision, jsPDF
backend/    Node.js + Express, SQLite, Novu, Telegram
docs/       Guide utilisateur, guide ingénieur, intégration Novu
```

Le frontend peut fonctionner seul (mode statique). Lorsqu'il est servi par le
backend, les deux partagent la même origine : les appels passent par `/api`,
sans CORS ni configuration supplémentaire.

## Démarrage rapide

Prérequis : Node.js 22 ou supérieur.

```bash
git clone https://github.com/CortexLLMs/CareWatch.git
cd CareWatch

# Backend
cd backend
npm install
cp .env.example .env        # renseigner les clés (facultatif)
npm start                   # http://localhost:5000

# Frontend (second terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Variables du backend : `NOVU_API_URL`, `NOVU_API_KEY`, `NOVU_WORKFLOW`,
`NOVU_SUBSCRIBER`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Sans clés,
l'application reste utilisable et les alertes sont uniquement locales.

## Documentation

- [Guide utilisateur](docs/GUIDE_UTILISATEUR.md) — prise en main, lecture des
  mesures, rapport mensuel, dépannage.
- [Guide ingénieur](docs/GUIDE_INGENIEUR.md) — pipeline rPPG, vision, modèle
  de données, seuils d'alerte, validation, déploiement, formules et références.
- [Intégration Novu](docs/novu-carewatch.md) — workflow et canaux.

## Données et confidentialité

Les images de la caméra ne quittent jamais l'appareil : elles sont traitées
dans le navigateur et ne sont pas transmises. Les mesures agrégées sont
stockées dans le navigateur pour la démonstration statique, ou dans une base
SQLite locale lorsque le backend est utilisé. Le rapport PDF est généré
localement.

## Limites

CareWatch n'est pas un dispositif médical. Les valeurs sont des estimations
expérimentales destinées à la démonstration et à la recherche. La SpO2 par
caméra n'est pas calibrée cliniquement. Aucun diagnostic ne doit être fondé
sur ces mesures.

## Équipe

Équipe 5 · HACK4BLADI · Casablanca · 2026.

## Licence

MIT. Voir [LICENSE](LICENSE).
