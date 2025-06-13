import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { config } from '../config/environment.js';

export interface SSETransportOptions {
  port?: number;
  corsOrigin?: string;
  host?: string;
}

export interface ClientMetadata {
  sessionId: string;
  metadata: Record<string, string>;
}

export class SSETransportServer {
  private app: express.Application;
  private server?: import('http').Server;
  private transports = new Map<string, SSEServerTransport>();
  private clientMetadata = new Map<string, Record<string, string>>();
  private port: number;
  private host: string;

  constructor(private mcpServer: Server, options: SSETransportOptions = {}) {
    this.port = options.port || parseInt(process.env.MCP_PORT || '3000');
    this.host = options.host || 'localhost'; // Security: bind to localhost only
    this.app = express();
    this.setupMiddleware(options.corsOrigin);
    this.setupRoutes();
  }

  private setupMiddleware(corsOrigin?: string) {
    // CORS configuration from environment
    const origin = corsOrigin || process.env.MCP_CORS_ORIGIN || 'http://localhost:3000';
    
    this.app.use(cors({
      origin: (requestOrigin, callback) => {
        // Security: DNS rebinding protection
        if (!requestOrigin) {
          // Allow same-origin requests (no Origin header)
          callback(null, true);
          return;
        }

        try {
          const url = new URL(requestOrigin);
          // Only allow localhost and configured origins
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || requestOrigin === origin) {
            callback(null, true);
          } else {
            callback(new Error('CORS: Origin not allowed'), false);
          }
        } catch (error) {
          callback(new Error('CORS: Invalid origin'), false);
        }
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Mcp-Session-Id', 'Memory-Metadata'],
      credentials: true
    }));

    this.app.use(express.json({ limit: '10mb' }));
    
    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  private setupRoutes() {
    // SSE endpoint for server-to-client notifications
    this.app.get('/sse', async (req, res) => {
      try {
        // Extract client metadata from headers or query parameters
        const clientMetadataString = req.headers['memory-metadata'] as string || 
                                    req.query.memoryMetadata as string || '';
        
        // Create SSE transport - it will auto-generate sessionId
        const transport = new SSEServerTransport('/messages', res);
        
        // Use transport's own sessionId instead of creating our own
        const sessionId = transport.sessionId;
        this.transports.set(sessionId, transport);

        // Store client metadata for this session
        if (clientMetadataString) {
          const metadata = this.parseClientMetadata(clientMetadataString);
          this.clientMetadata.set(sessionId, metadata);
          console.log(`Client metadata for session ${sessionId}:`, metadata);
        }

        // Store session ID for client reference
        res.setHeader('Mcp-Session-Id', sessionId);

        // Cleanup on connection close
        res.on('close', () => {
          this.transports.delete(sessionId);
          this.clientMetadata.delete(sessionId);
          console.log(`SSE connection closed for session: ${sessionId}`);
        });

        res.on('error', (error) => {
          console.error(`SSE connection error for session ${sessionId}:`, error);
          this.transports.delete(sessionId);
          this.clientMetadata.delete(sessionId);
        });

        console.log(`SSE connection established for session: ${sessionId}`);
        console.log(`Active sessions: ${this.transports.size}`);
        
        // Connect the transport to the MCP server in background (don't block SSE response)
        this.mcpServer.connect(transport).catch(error => {
          console.error(`Failed to connect MCP server to SSE transport ${sessionId}:`, error);
          this.transports.delete(sessionId);
        });

      } catch (error) {
        console.error('Error establishing SSE connection:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error'
            },
            id: null
          });
        }
      }
    });

    // Messages endpoint for client-to-server communication
    this.app.post('/messages', async (req, res) => {
      try {
        const sessionId = req.query.sessionId as string || req.headers['mcp-session-id'] as string;
        
        console.log(`POST /messages request for session: ${sessionId}`);
        console.log(`Available sessions: ${Array.from(this.transports.keys()).join(', ')}`);
        
        if (!sessionId) {
          console.log('Missing sessionId in request');
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Missing sessionId parameter or Mcp-Session-Id header'
            },
            id: null
          });
          return;
        }

        const transport = this.transports.get(sessionId);
        if (!transport) {
          console.log(`Transport not found for session: ${sessionId}`);
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid or expired session ID'
            },
            id: null
          });
          return;
        }

        console.log(`Processing message for session: ${sessionId}`);

        // Inject client metadata into store_memory requests
        const body = req.body;
        if (body && body.method === 'tools/call' && 
            body.params && (body.params.name === 'store_memory' || body.params.name === 'store_memory_chunked')) {
          const clientMetadata = this.getClientMetadata(sessionId);
          if (clientMetadata) {
            // Add client metadata to arguments
            body.params.arguments._clientMetadata = this.formatMetadata(clientMetadata);
            console.log(`Added client metadata to ${body.params.name}:`, clientMetadata);
          }
        }

        // Handle the POST message through the transport
        await transport.handlePostMessage(req, res, body);
        console.log(`Message processed successfully for session: ${sessionId}`);

      } catch (error) {
        const sessionId = req.query.sessionId as string || req.headers['mcp-session-id'] as string;
        console.error(`Error handling POST message for session ${sessionId}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error'
            },
            id: null
          });
        }
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const sessionIds = Array.from(this.transports.keys());
      res.json({
        status: 'ok',
        transport: 'sse',
        activeSessions: this.transports.size,
        sessionIds: sessionIds,
        uptime: process.uptime()
      });
    });

    // Keep-alive endpoint for SSE connections
    this.app.get('/ping', (req, res) => {
      res.json({ timestamp: Date.now() });
    });

    // Error handling for unmatched routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found'
        },
        id: null
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          console.log(`MCP SSE Server listening on ${this.host}:${this.port}`);
          console.log(`SSE endpoint: http://${this.host}:${this.port}/sse`);
          console.log(`Messages endpoint: http://${this.host}:${this.port}/messages`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all active transports
      for (const [sessionId, transport] of this.transports) {
        try {
          transport.close();
          console.log(`Closed transport for session: ${sessionId}`);
        } catch (error) {
          console.error(`Error closing transport ${sessionId}:`, error);
        }
      }
      this.transports.clear();

      if (this.server) {
        this.server.close(() => {
          console.log('SSE Transport Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getActiveSessionsCount(): number {
    return this.transports.size;
  }

  getServerInfo() {
    return {
      transport: 'sse',
      host: this.host,
      port: this.port,
      activeSessions: this.transports.size,
      endpoints: {
        sse: `http://${this.host}:${this.port}/sse`,
        messages: `http://${this.host}:${this.port}/messages`,
        health: `http://${this.host}:${this.port}/health`
      }
    };
  }

  /**
   * Parse client metadata string in the same format as server MEMORY_METADATA
   * Format: "key:value,key2:value2" or just "value" (stored as user:value)
   */
  private parseClientMetadata(metadataStr: string): Record<string, string> {
    const metadata: Record<string, string> = {};
    
    if (!metadataStr) return metadata;
    
    // Parse comma-separated key:value pairs
    const pairs = metadataStr.split(',');
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex > -1) {
        // Handle key:value format
        const key = pair.substring(0, colonIndex).trim();
        const value = pair.substring(colonIndex + 1).trim();
        if (key && value) {
          metadata[key] = value;
        }
      } else {
        // Handle single value without colon - use it as a 'user' key
        const value = pair.trim();
        if (value) {
          metadata['user'] = value;
        }
      }
    }
    
    return metadata;
  }

  /**
   * Get client metadata for a specific session
   */
  getClientMetadata(sessionId: string): Record<string, string> | undefined {
    return this.clientMetadata.get(sessionId);
  }

  /**
   * Convert metadata object back to string format
   */
  formatMetadata(metadata: Record<string, string>): string {
    return Object.entries(metadata)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');
  }
}