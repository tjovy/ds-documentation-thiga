# Adaptation n8n pour Thiga

## Cible GitHub

Tous les nodes GitHub du workflow pointent vers :

- `owner`: `tjovy`
- `repository`: `ds-documentation-thiga`
- `filePath`: conserver `tokens.json` et `tokens-docs.json`
- credential n8n unique : `git-demo-thiga` (`0VPNkKqc7Pju3PKI`)

Le workflow live ciblé est `TlWx5OmmkqEk5yoA`. Le jeton GitHub reste uniquement dans ce credential n8n ; il ne doit pas être copié dans les nodes ni dans le dépôt.

## Prompt OpenAI

Le prompt est generique: il doit fonctionner pour tout composant nouveau ou modifie detecte sous `tokens.json > component.*`.

Les informations composant viennent uniquement du MCP `get_component_generation_context`. Le modele ne doit pas interpreter le nom du composant, appliquer une convention generique, ni inventer une variante ou une propriete absente du contexte MCP.

Tous les composants suivent le meme principe: `component`, `figma.blueprint`, `allowedCssVars`, `tokenValues` et `jsxBlueprint` sont les seules sources autorisees.

Pour un composant auto-detecte, le MCP ne deduit plus de tag semantique depuis le nom du composant. Il fournit un `htmlTag` neutre (`div`) avec `semanticHtmlKnown: false`; le prompt doit alors documenter cette limite au lieu d'inventer `nav`, `dialog`, `button`, etc.

Si une semantique developpeur est necessaire pour un composant auto-detecte, elle doit venir d'un contrat MCP explicite :

- soit dans `tokens.json` sous `component.<nom>.$dev` ;
- soit dans la description du composant Figma avec le marqueur `@thiga-dev` suivi d'un objet JSON.

Exemple Figma ou `$dev` :

```json
{
  "htmlTag": "nav",
  "role": "navigation",
  "interactive": true,
  "allowedProps": ["children", "aria-label"],
  "slots": ["item"],
  "accessibility": ["Ajouter aria-label si aucun titre visible ne nomme la navigation."],
  "accessibilitySpec": {
    "requirements": [{"id": "accessible-name", "wcag": "4.1.2", "text": "Nommer la navigation selon sa destination."}],
    "manualChecks": ["Tester l'annonce du nom et la navigation au clavier."]
  },
  "usageRules": {
    "do": ["Utiliser pour une navigation principale ou secondaire."],
    "dont": ["Ne pas utiliser pour une simple liste visuelle sans navigation."]
  }
}
```

## Drift detection

Le workflow calcule les hashes sur tous les composants detectes sous `tokens.json > component.*`. La signature technique `$figma.signature` n'est pas utilisee seule pour declencher une regeneration : le blueprint Figma complet est l'indicateur visuel de reference.

Le MCP peut ajouter des tokens references sous `core`, `semantic`, `typography` selon le contrat du composant.

Pour un composant auto-detecte, le hash part de `component.<nom>`, du blueprint Figma stable et des chemins references par le MCP s'il y en a. Aucun token de fallback n'est ajoute automatiquement.

Le champ `$metadata.figmaFileKey` permet de relier les artefacts au fichier Figma source.

## Contrat accessibilité et revue

Les exigences initiales de chaque composant connu sont dans `tools/ds-component-mcp/registry/accessibility-contracts.json`. Un contrat développeur `accessibilitySpec` explicite peut compléter ou remplacer ce contrat lorsqu’une décision de sémantique est prise. Le MCP transmet sa provenance, n8n l’ajoute au hash de dérive et sauvegarde `_meta.accessibility` (`spec`, `audit`, `reviewStatus`) dans `tokens-docs.json`. Storybook rend visibles les contrôles statiques, les écarts et les tests manuels restants.

Le rendu déterministe issu de Figma garantit la fidélité visuelle, pas la conformité WCAG. Ne pas transformer un aperçu `div` de Data Table en tableau accessible par simple ajout de `role=table`; l’implémentation de production doit employer une structure HTML adaptée. Ne pas utiliser `aria-selected` sur `role=listitem`. Un écart statique ou une vérification clavier/lecteur d’écran à faire maintient la revue ouverte sans bloquer la génération des autres composants.

## Generation documentation + code

Le workflow Thiga utilise maintenant un node `Code` nommé `OpenAI Low Cost — Generate Markdown`.

Raison du choix :

- le contexte MCP est récupéré avant la génération, de façon explicite et traçable ;
- le modèle ne décide pas quels outils appeler, il applique un contrat MCP déjà préparé ;
- l'appel direct à l'OpenAI Responses API permet de fixer le modèle, `reasoning.effort`, `max_output_tokens` et le prompt exact ;
- le MCP `enforce_exact_figma_preview` remplace ensuite le JSX visuel par une version deterministe issue de l'arbre complet Figma : calques, ordre, positions, dimensions, textes et styles ;
- tous les composants presents dans Figma, y compris Button, Card et les composants ajoutes plus tard, ne dependent donc plus d'une interpretation visuelle du modele ;
- un type de noeud, un asset ou un effet non reproductible exactement est publie comme apercu a verifier : Storybook explique la cause, propose des actions et laisse la revue continuer ;
- `Finalize + Validate` reste le garde-fou : seul le markdown/code validé par MCP peut être poussé dans `tokens-docs.json`.

Variables d'environnement n8n nécessaires :

- `OPENAI_API_KEY` : obligatoire pour appeler l'API OpenAI ;
- `OPENAI_MODEL` : optionnel, défaut `gpt-5.4-nano` pour limiter le coût des tests ;
- `MAX_COMPONENTS_PER_RUN` : optionnel, sans valeur tous les composants nouveaux ou modifies sont traites ; la valeur locale Thiga est actuellement `3` pour maitriser le cout. Dans ce mode, le workflow reconnait les composants deja generes dans les branches de revue et passe au suivant a chaque lancement ;
- `OPENAI_REASONING_EFFORT` : optionnel, défaut `none` ;
- `OPENAI_MAX_OUTPUT_TOKENS` : optionnel, défaut `2500` ;
- `OPENAI_MAX_REPAIR_TOKENS` : optionnel, défaut `1200`, utilisé une seule fois après un échec de validation.

Le workflow n'envoie ni le Markdown historique ni le design Figma complet au modèle. L'empreinte `ssot-v9` inclut le contrat d’accessibilité et évite tout appel OpenAI lorsque les sources n'ont pas changé. Avec une limite par lot, les entrées de même empreinte déjà produites sur les branches `ai/*` récentes sont reprises dans le prochain `tokens-docs.json` : la dernière branche de revue cumule ainsi les composants des lots précédents. La finalisation échoue si la provenance du contrat MCP manque.

Le node `Get review branches` utilise le même credential GitHub n8n que les autres nodes. Les fichiers publics de ces branches sont ensuite lus par leur SHA via `raw.githubusercontent.com`, ce qui évite la limite de 60 appels/h des lectures GitHub API anonymes pendant les lots. Aucun jeton n'est copié dans le code ou les variables d'environnement.
