const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch('http://127.0.0.1:3101/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    signal: controller.signal,
  });
  const raw = await response.text();
  const dataLine = raw.split('\n').filter((line) => line.startsWith('data:')).at(-1);
  if (!response.ok || !dataLine) throw new Error(`MCP HTTP ${response.status}`);
  const payload = JSON.parse(dataLine.slice(5));
  const names = (payload.result?.tools || []).map((tool) => tool.name);
  for (const required of ['get_component_generation_context', 'validate_component_markdown']) {
    if (!names.includes(required)) throw new Error(`Outil MCP manquant: ${required}`);
  }
  console.log(`MCP OK: ${names.length} outils disponibles.`);
} finally {
  clearTimeout(timeout);
}
