# ds-component-mcp

Serveur MCP minimal pour fiabiliser la generation de documentation et de code React pour les composants du Design System.

## Ce que fait le serveur

- expose la liste des composants documentables
- retourne le contrat complet d'un composant
- retourne le contexte de generation compact exploitable par OpenAI
- valide le Markdown produit par le modele

## Installation

```bash
cd tools/ds-component-mcp
npm install
```

## Lancement

Mode brut `stdio`:

```bash
npm start
```

Mode n8n `streamable HTTP`:

```bash
npm run start:http
```

URL a utiliser dans n8n:

`http://127.0.0.1:3101/mcp`

## Outils exposes

- `list_components`
- `get_component_definition`
- `get_component_generation_context`
- `validate_component_markdown`

## Source de verite

La semantique de chaque composant vit dans:

- `registry/components/button.json`
- `registry/components/card.json`

Par defaut, les tokens sont lus depuis `tokens.json`. n8n transmet toutefois son snapshot GitHub exact au MCP pour eviter toute divergence avec le fichier local.
