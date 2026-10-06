# Big Wave Brad

Runner en 3D low-poly façon PlayStation 1 : Brad, surfeur blond très content de lui,
traverse la baie de gauche à droite, de la plage de départ jusqu'à l'autre rive.

## Lancer

Pas de build, pas de npm : Three.js est chargé depuis un CDN. Il faut seulement un
serveur local, parce que les modules ES ne se chargent pas en `file://`.

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Contrôles

| Touche | Action |
| --- | --- |
| Espace | sauter |
| Shift / C (maintenir) | se baisser ; en l'air : plongeon rapide |
| ↑ / ↓ (W / S) | changer de couloir (fond / devant) |
| P / Échap | pause |
| M | couper le son |

Sur téléphone ou tablette, des boutons apparaissent à l'écran : ▲ ▼ à gauche pour les
couloirs, JUMP et DUCK (maintenir) à droite, et un bouton pause en haut. On touche l'écran
pour démarrer ou rejouer. Le jeu se joue en paysage (il se met en pause en portrait) et
passe en plein écran quand le navigateur le permet.

## Le niveau

1. **La plage**, à pied avec la planche sous le bras : château de sable, crabes, filet de volley.
2. **La mer** : bouées et ailerons (on saute), rochers (on change de couloir), mouettes et
   pontons (on se baisse), troncs d'arbre (on saute, ils barrent les 3 couloirs).
   Les **vagues** servent de tremplins, avec un arc de coquillages à attraper en l'air. Les **canettes de boisson énergisante** donnent 3 s de
   boost : on va plus vite et on casse tout ce qu'on touche.
3. **L'autre rive** : arche d'arrivée, tiki bar, pose de culturiste.

3 vies, 4 checkpoints. Bonus de fin : 500 points par vie restante, et 1000 si tous les
coquillages ont été ramassés, avec en prime la **médaille d'or**.

Au premier obstacle qui demande de sauter, de se baisser ou de changer de couloir, une touche
de clavier en 3D qui s'enfonce montre le geste à faire ; elles restent en place, on les revoit après une chute.

## Code

| Fichier | Rôle |
| --- | --- |
| `src/ps1.js` | rendu PS1 : 240 lignes de résolution, sommets qui tremblent, couleurs 15 bits tramées |
| `src/models.js` | tous les modèles low-poly, construits à partir de primitives |
| `src/world.js` | ciel, mer animée, plages, décor |
| `src/lanes.js` | repères de couloirs (ligne sur l'eau, traits dans le sable) |
| `src/level.js` | **disposition du niveau** (obstacles, coquillages, boosts, checkpoints) |
| `src/player.js` | physique et animations de Brad |
| `src/audio.js` | effets sonores et musique synthétisés en WebAudio |
| `src/main.js` | boucle de jeu, collisions, HUD, caméra |

Pour modifier le parcours, il suffit d'éditer les tableaux `HAZARDS`, `SHELL_LINES`, `BOOSTS` et `TUTORIAL_CUES` (tutoriel animé)
dans `src/level.js`.

Après une modification, `node tools/check-level.mjs` vérifie qu'un même chemin permet de
ramasser **tous** les coquillages et canettes (rien sur un obstacle, pas de choix forcé entre deux
couloirs, assez de place pour changer de couloir ou contourner un rocher).

Pour vérifier en conditions réelles, `tools/autopilot.js` joue le niveau entier avec la vraie
physique (sans rendu) et liste les collectibles manqués et les chutes. Dans la console du
navigateur, sur la page du jeu :

```js
await import('/tools/autopilot.js').then((m) => m.run())
```
