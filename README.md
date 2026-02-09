# ESPRESSO SVG

Web app statique (Vanilla JS modules ES) pour edition SVG en mode split-screen:

- `2/3` gauche: outils + canvas SVG interactif
- `1/3` droite: editeur de code SVG live
- synchro bidirectionnelle DOM <-> code
- themes Latte / Ristretto persistants
- compatible GitHub Pages (aucun backend)

## Stack

- HTML + CSS + JavaScript moderne (modules ES)
- SVG DOM natif
- LocalStorage (preferences + document)
- Web Worker pour optimisation SVG
- Service Worker pour usage offline

## Lancement local

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

## Deploiement GitHub Pages

1. Push du repository sur GitHub.
2. Dans `Settings > Pages`, choisir:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` (ou `master`) / `/root`
3. Sauvegarder. L'app sera servie en statique.

## Fonctions incluses (v1)

- Outils: select, rect, roundRect, circle, ellipse, line, polyline, polygon, pen, text, image, group, clipPath, mask, symbol/use, gradient, filter
- Edition: deplacement, contraintes `Shift`, suppression, ordre de calque, rename, lock/hide
- Canvas: zoom/pan (`wheel`, alt+drag), grille, checker optionnel, snapping
- Canvas Settings avance: dimensions, unites, DPI, viewBox, presets, regles, guides drag/drop, marges, bleed, safe zones, resize handles
- Calques: liste DOM, selection croisee, reorder, lock/hide
- Proprietes: edition geometrique et style sur selection
- Code SVG: edition live, coloration, pretty print, minify, validation parse, defs viewer, inline styles toggle
- Historique: Command Pattern undo/redo avec snapshots
- Import: bouton, drag&drop, clipboard image
- Export: SVG optimise, PNG, JPG

## Arborescence

```text
/core
/engine
/ui
/exporters
/importers
/optimizer
/animation
/utils
```

## Notes

- L'app est desktop-first et fonctionne sans dependance externe.
- Les boutons/actions utilisent un sprite local d'icones Tabler (`assets/tabler-sprite.svg`) et suivent automatiquement le theme actif.
- Certaines fonctions avancees (booleans complexes, edition de noeuds bezier complete, PDF natif vectoriel, plugin API complete) sont prevues pour une iteration suivante.
