# Guide utilisateur — CareWatch

Ce guide décrit l'utilisation de CareWatch pour une personne qui souhaite
surveiller ses constantes avec une simple webcam. Aucune connaissance
technique n'est nécessaire.

CareWatch n'est pas un dispositif médical. Il ne remplace ni un examen
clinique, ni un tensiomètre, ni un oxymètre de pouls certifié. En cas de
malaise, contactez immédiatement un professionnel de santé ou les secours.

## 1. Ouvrir l'application

Deux adresses sont disponibles :

- Démonstration publique : https://ysfmo98-carewatch.static.hf.space
- Hébergement de secours : https://cortexllms.github.io/CareWatch/

L'application fonctionne sur ordinateur et sur téléphone. Sur téléphone,
utilisez de préférence le navigateur Chrome, Safari ou Firefox à jour.

## 2. Avant de démarrer

Pour obtenir des mesures stables :

- placez-vous face à une source de lumière douce (fenêtre ou lampe) ;
- évitez le contre-jour et les néons clignotants ;
- restez à environ 50 à 80 cm de la caméra ;
- dégagez votre visage (pas de masque, de main ou de cheveux devant les yeux) ;
- limitez les mouvements brusques pendant la mesure.

La fréquence cardiaque demande quelques secondes de signal avant de
s'afficher. Un tiret ou une valeur grisée indique que la mesure n'est pas
encore fiable.

## 3. Démarrer une session

1. Autorisez l'accès à la caméra lorsque le navigateur le demande.
2. Appuyez sur **Démarrer**.
3. La vignette vidéo apparaît avec le maillage du visage, le squelette du
   corps et les mains détectées.
4. Le chronomètre de session démarre.

Pour arrêter, appuyez sur **Arrêter**. La session est alors enregistrée.

## 4. Lire le tableau de bord

| Indicateur | Signification | Comment le lire |
| :--- | :--- | :--- |
| Fréquence cardiaque | Battements par minute estimés par la caméra | Stabilisez-vous ; la valeur se lisse sur plusieurs estimations |
| SpO2 | Saturation en oxygène estimée | Mesure expérimentale, indicative seulement |
| VFC (RMSSD) | Variabilité entre deux battements | Plus la valeur est haute, plus le système nerveux est récupéré |
| Somnolence | Fermeture prolongée des paupières (PERCLOS) | Monte lorsque les yeux se ferment souvent ou longtemps |
| Bâillement | Ouverture de la bouche normalisée | Monte pendant un bâillement franc |
| Grimace | Tension faciale associée à la douleur | Réagit aux expressions marquées |
| Confiance | Qualité réelle du signal | En dessous de 30 %, ignorez la fréquence cardiaque |

Chaque valeur est une estimation. La confiance affichée est calculée à partir
du signal, pas fixée arbitrairement.

## 5. Le geste d'urgence

Levez la paume ouverte face à la caméra et maintenez-la environ une
demi-seconde. L'application :

1. affiche une bannière rouge ;
2. déclenche une alarme sonore ;
3. enregistre une alerte critique ;
4. envoie une notification si le serveur et les canaux sont configurés.

Une seule alerte est déclenchée par geste : un délai de 30 secondes évite les
répétitions. Pour réessayer, attendez la fin de ce délai.

Le geste fonctionne mieux avec la main à hauteur du visage, doigts écartés et
paume réellement tournée vers l'objectif.

## 6. Les alertes

Les alertes apparaissent dans le panneau **Alertes** et sont conservées dans
l'historique du jour. Types principaux :

- fréquence cardiaque élevée ou basse ;
- somnolence importante ;
- stress élevé ;
- saturation en oxygène basse (mesure expérimentale) ;
- geste d'urgence ;
- grimace de douleur.

Chaque type possède un anti-spam de 15 secondes : une même alerte ne peut pas
être envoyée en rafale.

## 7. Le rapport mensuel

La carte **Rapport mensuel** se trouve sous le tableau de bord.

1. Choisissez le mois.
2. Vérifiez le nombre de jours enregistrés et d'alertes.
3. Appuyez sur **Télécharger le rapport PDF**.

Le fichier est produit sur votre appareil, sans envoi réseau. Il contient :

- l'identification de la période ;
- la synthèse des constantes ;
- le détail jour par jour ;
- le récapitulatif des alertes ;
- une section de traçabilité avec une référence unique et une empreinte
  SHA-256 ;
- les références de l'Organisation mondiale de la Santé.

Le rapport est un compte rendu de suivi, pas un diagnostic.

## 8. Médicaments et contact

Le panneau **Médicaments** permet de noter un traitement et un contact
d'urgence. Le contact est utilisé pour les notifications lorsque le backend
est connecté. Ces informations restent sur votre appareil en mode statique.

## 9. Réglages

- **Langue** : français, anglais, arabe (affichage de droite à gauche).
- **Thème** : clair ou sombre.
- **Notifications** : e-mail ou Telegram, selon la configuration du serveur.

## 10. En cas de problème

**La caméra reste noire.** Vérifiez l'autorisation dans les réglages du
navigateur, fermez les autres applications qui utilisent la caméra, puis
rechargez la page.

**La fréquence cardiaque ne s'affiche pas.** Le signal est insuffisant :
améliorez l'éclairage, immobilité plus grande, visage entièrement visible.
La mesure peut demander jusqu'à dix secondes.

**Le geste de la paume ne déclenche rien.** Présentez la paume bien ouverte,
doigts écartés, à 40–70 cm, et maintenez-la. Évitez le profil ou le dos de la
main.

**Le rapport est vide.** Aucune session n'a été enregistrée pour ce mois.
Lancez une session de quelques minutes, puis rouvrez la carte.

**Les alertes ne partent pas.** En démonstration statique, il n'y a pas de
serveur : les alertes restent locales. Utilisez l'installation complète pour
les notifications.

## 11. Confidentialité

Les images ne sont pas transmises : le traitement est effectué dans le
navigateur. En mode statique, les mesures agrégées restent dans le stockage
local du navigateur. Vous pouvez les effacer en supprimant les données du
site dans les réglages du navigateur.

## 12. Équipe

Équipe 5 · HACK4BLADI · Casablanca · 2026.

Licence MIT.
