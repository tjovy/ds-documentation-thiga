import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';

const port = Number(process.env.DS_MCP_PORT || 3101);

http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  if (request.url !== '/mcp' || request.method !== 'POST') {
    response.writeHead(404).end();
    return;
  }

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } catch (error) {
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: error.message } }));
    }
  } finally {
    await transport.close();
    await server.close();
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`DS MCP listening on http://127.0.0.1:${port}/mcp`);
});
