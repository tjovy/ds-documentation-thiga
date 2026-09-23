# Workflow Single Source Of Truth

Le workflow canonique du Design System est le suivant:

1. La source visuelle et structurelle est **Figma**
2. Depuis Figma, on pousse **`tokens.json`** sur GitHub
3. GitHub genere **`build/css/variables.css`** depuis **`tokens.json`**
4. Le workflow n8n lit les dernieres versions de **`tokens.json`** et **`tokens-docs.json`**
5. n8n compare les composants documentes avec les tokens courants
6. Si un composant a derive, n8n appelle **OpenAI**, puis valide localement avec le MCP
7. n8n met a jour **uniquement `tokens-docs.json`**
8. n8n cree une branche GitHub et y pousse **`tokens-docs.json`**
9. Storybook charge:
   - **`tokens-docs.json`** depuis la branche review
   - **`variables.css`** depuis la build GitHub issue de `main`
10. L'edition dans Storybook modifie **uniquement `tokens-docs.json`**
11. La PR est creee ensuite par le dev ou le design ops

## Regles a respecter

- `tokens.json` reste la source brute exportee depuis Figma
- `tokens.json` reste la source canonique exploitee par n8n et le MCP local
- `build/css/variables.css` reste la source CSS generee par GitHub
- `tokens-docs.json` reste la source des specs, descriptions, do/don't et code JSX
- Storybook ne doit pas inventer de preview alternative si le JSX est invalide
- Storybook ne doit pas inventer de couleur, structure ou composant de secours
- le workflow n8n ne doit modifier que `tokens-docs.json`
- la fidelite visuelle doit venir de `Figma + tokens + variables.css`

## Storybook

Pour review une branche IA:

- recuperer `tokens-docs.json` depuis la branche de review
- recuperer `tokens.json` depuis `main`
- recuperer `build/css/variables.css` depuis `main`

Le script `scripts/sync-tokens-preview.js` suit maintenant exactement cette logique.

## Export Figma

La source est le fichier Figma `demo-thiga` (`eJDPjIrF5PRUpMXtXsvSRX`). Le plugin local `figma-token-exporter` lit directement les variables natives et produit le `tokens.json` canonique, sans Tokens Studio et sans dépendre du scope REST payant `file_variables:read`.

Le plugin mappe les collections numérotées du fichier vers quatre groupes stables :

- `01 · Primitives` et `03 · Dimensions` vers `core` ;
- `02 · Semantic Color` vers `semantic` ;
- `04 · Typography` vers `typography` ;
- les métadonnées des composants détectés vers `component`.

Après export :

```bash
npm run build-css
npm run validate-css-contract
npm run refresh-figma-cache
```

L'option `npm run export-figma-tokens:tokens` reste disponible uniquement avec un token Figma possédant `file_variables:read`.

## Ajout automatique de composants

Le workflow peut documenter un nouveau composant sans fichier de registre manuel si le composant existe a la fois dans Figma et dans `tokens.json`.

Convention minimale:

- creer un component set ou composant local Figma nomme comme le composant, par exemple `Accordion`, `Badge`, `Input`, etc.
- creer les variables Figma sous `component/<nom>/...`, par exemple `component/accordion/...`
- exporter les variables avec le plugin local Figma
- rafraichir le cache design avec `npm run refresh-figma-cache`
- pousser `tokens.json` et le cache Figma si tu veux figer ce contexte dans le repo

Le cache Thiga utilise par defaut le fichier `eJDPjIrF5PRUpMXtXsvSRX`. Pour le remplacer explicitement, utilise `THIGA_FIGMA_FILE_KEY`; cela evite qu'une variable globale `FIGMA_FILE_KEY` d'un autre projet change ce cache par accident.

Le MCP construit alors automatiquement un contrat generique pour tout composant `component.<nom>` present dans `tokens.json`.

Button, Card, Data Table, List Item et les trois icônes Thiga ont des contrats explicites. Pour un composant auto-détecté, le HTML racine reste neutre (`div`) tant qu'un contrat `$dev` ou `@thiga-dev` ne fournit pas sa sémantique. Les axes viennent du nommage des variantes Figma (`State=Default`, `Style=Primary`, etc.).

Le workflow detecte aussi les modifications: le hash de derive inclut les tokens du composant, les tokens references et le blueprint Figma stable. Un simple refresh du cache sans changement visuel ne relance pas OpenAI; une modification des variantes, axes, dimensions, auto-layout ou styles Figma relance uniquement les composants concernes.

Si le cache Figma ne contient pas le composant correspondant, le workflow bloque avant OpenAI. C'est volontaire: cela evite de generer une documentation hallucinee.

## n8n

Les fichiers canoniques du workflow sont:

- `n8n/code/filter-incomplete-components.js`
- `n8n/code/get-component-generation-context.js`
- `n8n/code/finalize-component-docs.js`
- `n8n/prompts/component-doc-generator.md`
- `n8n/code/openai-generate-markdown.template.js`
- `n8n/workflows/ds-documentation-thiga.json`

Le workflow live n8n doit rester aligne sur ces fichiers.

## MCP local

Lancer le serveur local:

```bash
npm run mcp:install-service
```

Endpoint:

`http://127.0.0.1:3101/mcp`

Tools utilises:

- `get_component_generation_context`
- `validate_component_markdown`
