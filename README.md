# Thiga Storybook Feed

Ce dossier prépare le fichier Figma `demo-thiga` pour le workflow Storybook/n8n Thiga.

Source Figma :

- File key : `eJDPjIrF5PRUpMXtXsvSRX`
- Page composants : `Components`
- Component sets : decouverts automatiquement depuis Figma quand ils correspondent a `tokens.json > component.*`

## Fichiers à pousser dans le nouveau repo

- `tokens.json` : source structurée issue de Figma
- `tokens-docs.json` : seed minimal, à enrichir par n8n uniquement
- `build/css/variables.css` : sortie CSS à utiliser par Storybook

## Export direct depuis Figma

Le plugin local `figma-token-exporter` lit les variables natives et tous les composants du fichier. Après sa configuration initiale, un clic met à jour uniquement `tokens.json` sur GitHub. Il ne génère aucun fichier JSON intermédiaire.

`npm run storybook` synchronise `tokens.json` et le CSS généré `build/css/variables.css` depuis `main`, ainsi que `tokens-docs.json` depuis la dernière branche `ai/*`. Il surveille les deux branches toutes les 30 secondes. Le CSS de revue est téléchargé depuis GitHub sans régénération locale. Pour fixer une revue précise : `STORYBOOK_REVIEW_BRANCH=ai/nom-de-la-branche npm run storybook`.

Sur cette machine, le service local Storybook est aussi installé avec `npm run storybook:install-service`. Il reste disponible sur `http://localhost:6007` et conserve cette synchronisation automatique.

```bash
npm run figma-plugin:install
npm run figma-plugin:build
```

Importer ensuite le `figma-token-exporter/manifest.json` de **ce dépôt Thiga** depuis `Plugins > Development > Import plugin from manifest` dans Figma Desktop. Si le plugin de développement déjà enregistré pointe vers `ds-documentation-caba`, remplacer cet enregistrement. Les instructions détaillées sont dans `figma-token-exporter/README.md`.

## Export attendu

Le fichier attendu par GitHub et n8n est un seul `tokens.json` au format stable:

- `core`
- `semantic`
- `typography`
- `component`

Le plugin Figma produit directement cette forme. Aucune coche Tokens Studio ni fichier `normalized` ou `fallback` n'est necessaire dans le workflow courant.

## Raccordement workflow

Le workflow n8n `ds-documentation-thiga` applique ce principe :

1. GitHub lit `tokens.json` sur `main`
2. GitHub lit `tokens-docs.json`
3. n8n détecte les composants incomplets sous `component`
4. MCP/Figma fournit le contexte du composant
5. OpenAI rédige le Markdown et une première implémentation JSX
6. MCP remplace l'aperçu par le rendu déterministe issu du blueprint Figma quand il peut le faire exactement ; sinon, il conserve le code et ajoute une alerte de revue Storybook
7. n8n pousse seulement `tokens-docs.json` dans une branche review

## Spécifications d’accessibilité

La cible de revue est WCAG 2.2 AA ; une prévisualisation Storybook ou un audit statique ne constitue pas une attestation de conformité. Les exigences par composant sont centralisées dans `tools/ds-component-mcp/registry/accessibility-contracts.json`. Le MCP les joint au contexte de génération avec leur provenance ; n8n les inclut dans l’empreinte de changement puis enregistre dans `tokens-docs.json` le contrat, l’audit statique et le statut de revue. Storybook affiche ces trois éléments à côté du composant.

Figma reste la source des dimensions, variantes et styles ; il ne suffit pas à établir le nom accessible, le comportement clavier, la sémantique HTML ou le résultat au lecteur d’écran. Pour un nouveau composant, ajouter un contrat `accessibilitySpec` via `component.<nom>.$dev` dans les tokens ou dans la description Figma sous `@thiga-dev`, puis faire valider son usage réel par l’équipe. Tant que ce contrat est absent, Storybook signale une revue requise. Le bouton utilise un élément natif et un focus visible ; l’aperçu de Data Table reste visuel et ne remplace pas un `<table>` avec en-têtes et légende ; List Item attend le choix explicite du pattern de sélection.

Avant livraison, vérifier manuellement les parcours clavier, le focus, les noms et états annoncés, le contraste, le zoom et les technologies d’assistance sur l’implémentation de production. Références : [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [noms accessibles](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) et [tableaux](https://www.w3.org/WAI/ARIA/apg/patterns/table/).

## Sources de chaque vue Storybook

- Les tokens et le CSS du Design System sont lus depuis le même commit de `main`.
- Chaque review `ai/*` lit `tokens-docs.json` au commit exact de sa branche. Le JSX et la documentation viennent de ce JSON ; les couleurs et autres variables proviennent du CSS généré sur `main`. Les variables CSS sont appliquées à l'aperçu de revue.
- Le JSX affiche dans une review vient exclusivement de `tokens-docs.json`. Le workflow n8n le construit depuis le contrat MCP/Figma et le MCP le valide a nouveau avant toute sauvegarde ou creation de PR. Storybook ne fabrique pas de structure de composant de remplacement.

Les composants du fichier Thiga ont des contrats MCP dédiés :

- Button : styles `primary`, `secondary` ; tailles `sm`, `md`, `lg` ; états `default`, `hover`, `pressed`, `disabled`
- Card : styles `elevated`, `outlined` ; états `default`, `hover`, `disabled`
- Data Table : densités `comfortable`, `compact`
- List Item : densités `comfortable`, `compact` ; états `default`, `hover`, `selected`
- Icônes : `arrowRight`, `check`, `more`

Dans Storybook, ces icônes sont regroupées sous une seule entrée **Utility Icons** : une galerie montre leurs aperçus JSX issus de `tokens-docs.json`, avec les spécifications et le code de chacune dans un volet dépliable. Les entrées JSON restent séparées pour préserver les références Figma et la régénération ciblée n8n. Toute nouvelle entrée dont le nom Figma commence par `Icon/` rejoint automatiquement cette librairie.

Les nouveaux composants sont auto-detectes depuis l'inventaire Figma complet :

- les variantes internes sont regroupees sous leur Component Set ;
- les composants autonomes sont inclus meme sans entree prealable dans `tokens.json` ;
- les couleurs et styles doivent correspondre a des variables publiees dans `variables.css`. Lorsqu'un asset, un gradient ou un effet ne peut pas etre rendu exactement, Storybook le signale avec des pistes de correction sans arreter la revue.

Les composants modifies sont aussi detectes: le workflow compare les tokens et le blueprint Figma stable, puis regenere uniquement les entrees obsoletes dans `tokens-docs.json`.

Le cache Figma et les contrats MCP doivent rester la source des axes : aucune variante héritée d’un autre design system ne doit être ajoutée.

## Vérification locale

Le forfait Figma Pro ne donne pas acces au scope REST `file_variables:read`. Le plugin local contourne cette limite proprement en lisant les variables natives depuis le fichier ouvert, sans utiliser l'API REST payante.

```bash
npm run refresh-figma-cache
npm run workflow:preflight
npm run build-storybook
```

Le MCP et n8n sont installables comme services macOS persistants avec `npm run mcp:install-service` et `npm run n8n:install-service`.
