import dotenv from 'dotenv';
dotenv.config();

import { randomUUID } from 'node:crypto';
import { createApp } from './api.js';
import { startMcpStdio, createMcpServer } from './mcp-server.js';
import { brandManager } from './engine/brand-manager.js';
import { logger } from './utils/logger.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const MODE = process.env.MODE || 'api'; // 'api', 'mcp-stdio', 'mcp-http', 'all'

async function main(): Promise<void> {
  logger.info(`Starting HoloDex in mode: ${MODE}`);

  // Load existing brands
  await brandManager.loadAll();

  if (MODE === 'mcp-stdio') {
    // Pure MCP stdio mode (for agent integration via stdin/stdout)
    await startMcpStdio();
    return;
  }

  // Create Express app
  const app = createApp();

  if (MODE === 'mcp-http' || MODE === 'mcp-sse' || MODE === 'all') {
    // StreamableHTTP transport for MCP over HTTP (Agent365 compatible)
    const sessions = new Map<
      string,
      { transport: StreamableHTTPServerTransport; server: ReturnType<typeof createMcpServer> }
    >();
    const sessionTimestamps = new Map<string, number>();
    const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

    // Periodic cleanup of stale sessions
    setInterval(() => {
      const now = Date.now();
      for (const [id, ts] of sessionTimestamps) {
        if (now - ts > SESSION_TTL_MS) {
          const session = sessions.get(id);
          if (session) {
            session.transport.close();
            session.server.close();
          }
          sessions.delete(id);
          sessionTimestamps.delete(id);
          logger.info(`Cleaned up stale MCP session ${id}`);
        }
      }
    }, 60_000);

    // POST /mcp — handle JSON-RPC messages (initialize, tools/call, etc.)
    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      // Existing session — route to its transport
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session) {
          sessionTimestamps.set(sessionId, Date.now());
          await session.transport.handleRequest(req, res, req.body);
          return;
        }
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Session not found' },
          id: null,
        });
        return;
      }

      // New session — must be an initialize request
      const body = req.body;
      const message = Array.isArray(body) ? body[0] : body;
      if (!message || message.method !== 'initialize') {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'First request must be an initialize request' },
          id: message?.id ?? null,
        });
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      // Session ID is available after handleRequest processes the initialize
      const sid = transport.sessionId;
      if (sid) {
        sessions.set(sid, { transport, server });
        sessionTimestamps.set(sid, Date.now());
        transport.onclose = () => {
          sessions.delete(sid);
          sessionTimestamps.delete(sid);
        };
      }
    });

    // GET /mcp — SSE stream for server-initiated notifications
    app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId) {
        res.status(400).json({ error: 'Missing mcp-session-id header' });
        return;
      }
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      await session.transport.handleRequest(req, res);
    });

    // DELETE /mcp — close a session
    app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId) {
        res.status(400).json({ error: 'Missing mcp-session-id header' });
        return;
      }
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      await session.transport.handleRequest(req, res);
      sessions.delete(sessionId);
      sessionTimestamps.delete(sessionId);
    });

    logger.info('MCP StreamableHTTP transport available at /mcp');
  }

  // Start HTTP server
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`HoloDex API listening on port ${PORT}`);
    logger.info(`API docs: http://localhost:${PORT}/api/v1/info`);
    logger.info(`Health check: http://localhost:${PORT}/api/v1/health`);
    if (MODE === 'mcp-http' || MODE === 'mcp-sse' || MODE === 'all') {
      logger.info(`MCP StreamableHTTP: http://localhost:${PORT}/mcp`);
    }
  });
}

main().catch((err) => {
  logger.error('Fatal error', err);
  process.exit(1);
});
