# Tournament Director

Console LAN pour diriger un tournoi de poker cashless (sans buy-in / payouts) : joueurs, tables, blindes, seating automatique, horloge salle et éliminations depuis le téléphone.

## Prérequis

- Node.js 20+
- npm

## Lancer en local (LAN)

```bash
npm install
npm run dev
```

Le serveur écoute sur **0.0.0.0:43123**.

Sur la machine hôte :

- Directeur : [http://127.0.0.1:43123/](http://127.0.0.1:43123/)
- Horloge salle : [http://127.0.0.1:43123/clock](http://127.0.0.1:43123/clock)
- Mobile floor : [http://127.0.0.1:43123/mobile](http://127.0.0.1:43123/mobile)

Sur le Wi‑Fi local, ouvrez l’URL LAN affichée en haut de la console directeur (ex. `http://192.168.x.x:43123`) puis ajoutez `/clock` ou `/mobile` selon l’écran.

Production :

```bash
npm run build
npm run start
```

## Fonctionnalités v1

- Un tournoi à la fois, persisté dans `data/tournament.json` (écritures atomiques)
- Sync live via SSE (timer, tables, éliminations)
- Placement / rééquilibrage / casse de tables 100 % automatique
- Stack moyen = `stackDépart × inscrits / joueurs restants`
- PIN court sur l’écran directeur pour autoriser les éliminations mobile

## Hors scope

Buy-in, payouts, rebuy, APK native, multi-tournois, cloud, auth.
