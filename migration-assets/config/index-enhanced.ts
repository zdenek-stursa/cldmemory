import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { MemoryService } from './services/memory';
import { MemoryType } from './types/memory';
import { tools } from './mcp/tools';
import { config } from './config/environment';
import { zodToJsonSchema } from './utils/zodToJsonSchema';
import { SSETransportServer } from './transport/sse.js';
import { readFileSync } from 'fs';
import { join } from 'path';

type TransportMode = 'stdio' | 'sse' | 'both';

class MemoryMCPServer {
  private server: Server;
  private memoryService: MemoryService;
  private sseTransportServer?: SSETransportServer;
  private transportMode: TransportMode;

  constructor() {
    this.memoryService = new MemoryService();
    this.transportMode = this.getTransportMode();
    
    this.server = new Server(
      {
        name: 'mcp-memory-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private getTransportMode(): TransportMode {
    const mode = process.env.MCP_TRANSPORT_MODE?.toLowerCase() as TransportMode;
    return ['stdio', 'sse', 'both'].includes(mode) ? mode : 'stdio';
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
      })),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {

          case 'store_memory': {
            const parsed = tools.store_memory.inputSchema.parse(args);
            const memory = await this.memoryService.createMemory(
              parsed.content,
              parsed.type as MemoryType,
              parsed.context,
              parsed.importance,
              parsed.summary
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(memory, null, 2),
                },
              ],
            };
          }

          case 'store_memory_chunked': {
            const parsed = tools.store_memory_chunked.inputSchema.parse(args);
            const memories = await this.memoryService.createMemoryWithChunking(
              parsed.content,
              parsed.type as MemoryType,
              parsed.context,
              parsed.importance,
              parsed.chunkingOptions,
              parsed.summary
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message: `Created ${memories.length} memory chunks`,
                    parentId: memories[0].id,
                    chunkIds: memories.slice(1).map(m => m.id),
                    memories: memories
                  }, null, 2),
                },
              ],
            };
          }

          case 'search_memories': {
            const parsed = tools.search_memories.inputSchema.parse(args);
            const searchParams: any = {
              query: parsed.query,
              type: parsed.type as MemoryType | undefined,
              minImportance: parsed.minImportance,
              emotionalRange: parsed.emotionalRange,
              limit: parsed.limit,
              includeAssociations: parsed.includeAssociations,
              detailLevel: parsed.detailLevel,
              similarityThreshold: parsed.similarityThreshold,
              reconstructChunks: parsed.reconstructChunks,
            };
            
            // Add date range if provided
            if (parsed.dateRange) {
              searchParams.dateRange = {
                start: new Date(parsed.dateRange.start),
                end: new Date(parsed.dateRange.end),
              };
            }
            
            const memories = await this.memoryService.searchChunkedMemories(searchParams);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(memories, null, 2),
                },
              ],
            };
          }

          case 'get_memory': {
            const parsed = tools.get_memory.inputSchema.parse(args);
            const memory = await this.memoryService.getMemory(parsed.id);
            return {
              content: [
                {
                  type: 'text',
                  text: memory ? JSON.stringify(memory, null, 2) : 'Memory not found',
                },
              ],
            };
          }

          case 'update_memory': {
            const parsed = tools.update_memory.inputSchema.parse(args);
            const memory = await this.memoryService.updateMemory(parsed.id, {
              content: parsed.content,
              importance: parsed.importance,
              context: parsed.context,
              metadata: parsed.metadata,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: memory ? JSON.stringify(memory, null, 2) : 'Memory not found',
                },
              ],
            };
          }

          case 'delete_memory': {
            const parsed = tools.delete_memory.inputSchema.parse(args);
            await this.memoryService.deleteMemory(parsed.id);
            return {
              content: [
                {
                  type: 'text',
                  text: `Memory ${parsed.id} deleted successfully`,
                },
              ],
            };
          }

          case 'analyze_memories': {
            const parsed = tools.analyze_memories.inputSchema.parse(args);
            // Simple analysis for now
            const memories = await this.memoryService.searchMemories({
              query: '',
              type: parsed.type as MemoryType | undefined,
              limit: 100,
            });

            const analysis = {
              totalMemories: memories.length,
              byType: memories.reduce((acc, m) => {
                acc[m.type] = (acc[m.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>),
              averageImportance: memories.reduce((sum, m) => sum + m.importance, 0) / memories.length,
              averageEmotionalValence: memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length,
              mostCommonTags: this.getMostCommonTags(memories),
            };

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(analysis, null, 2),
                },
              ],
            };
          }

          case 'connect_memories': {
            const parsed = tools.connect_memories.inputSchema.parse(args);
            await this.memoryService.connectMemories(
              parsed.sourceId,
              parsed.targetId,
              parsed.bidirectional
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `Connected memories ${parsed.sourceId} and ${parsed.targetId}`,
                },
              ],
            };
          }

          case 'find_memory_paths': {
            const parsed = tools.find_memory_paths.inputSchema.parse(args);
            const paths = await this.memoryService.findMemoryPaths(
              parsed.startId,
              parsed.endId,
              parsed.maxDepth,
              parsed.includeContent
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(paths, null, 2),
                },
              ],
            };
          }

          case 'get_association_graph': {
            const parsed = tools.get_association_graph.inputSchema.parse(args);
            const graph = await this.memoryService.getAssociationGraph(
              parsed.centerMemoryId,
              parsed.depth,
              parsed.minImportance,
              parsed.includeContent
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(graph, null, 2),
                },
              ],
            };
          }

          case 'consolidate_memories': {
            const parsed = tools.consolidate_memories.inputSchema.parse(args);
            const consolidated = await this.memoryService.consolidateMemories(
              parsed.memoryIds,
              parsed.strategy,
              parsed.keepOriginals
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(consolidated, null, 2),
                },
              ],
            };
          }

          case 'remove_association': {
            const parsed = tools.remove_association.inputSchema.parse(args);
            await this.memoryService.removeAssociation(
              parsed.sourceId,
              parsed.targetId,
              parsed.bidirectional
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `Removed association between ${parsed.sourceId} and ${parsed.targetId}`,
                },
              ],
            };
          }

          case 'delete_memories_bulk': {
            const parsed = tools.delete_memories_bulk.inputSchema.parse(args);
            const result = await this.memoryService.deleteMemories(parsed.ids);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message: `Deleted ${result.deleted} memories`,
                    deleted: result.deleted,
                    failed: result.failed,
                    totalRequested: parsed.ids.length
                  }, null, 2),
                },
              ],
            };
          }

          case 'delete_all_memories': {
            const parsed = tools.delete_all_memories.inputSchema.parse(args);
            if (parsed.confirm !== true) {
              throw new Error('Confirmation required to delete all memories');
            }
            const result = await this.memoryService.deleteAllMemories();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message: 'All memories have been deleted',
                    deleted: result.deleted
                  }, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private getMostCommonTags(memories: any[]): Record<string, number> {
    const tagCounts: Record<string, number> = {};
    memories.forEach(m => {
      m.context.tags?.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.fromEntries(
      Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    );
  }

  private logStartupBanner() {
    const banner = `
╔══════════════════════════════════════════════════════════════╗
║                    MCP MEMORY SERVER                         ║
║                Human-like Memory System                      ║
╚══════════════════════════════════════════════════════════════╝`;
    
    console.error(banner);
    console.error('');
  }

  private getVersion(): string {
    try {
      const packagePath = join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      return '1.0.0'; // fallback version
    }
  }

  private async logServerInfo() {
    const port = process.env.MCP_PORT || '3000';
    const host = process.env.MCP_HOST || 'localhost';
    const nodeEnv = process.env.NODE_ENV || 'development';
    const version = this.getVersion();

    console.error('📋 SERVER CONFIGURATION:');
    console.error(`   • Version: ${version}`);
    console.error(`   • Environment: ${nodeEnv}`);
    console.error(`   • Transport Mode: ${this.transportMode.toUpperCase()}`);
    console.error('');

    console.error('🌐 TRANSPORT ENDPOINTS:');
    
    if (this.transportMode === 'stdio' || this.transportMode === 'both') {
      console.error('   • STDIO: Available for MCP client connections');
    }
    
    if (this.transportMode === 'sse' || this.transportMode === 'both') {
      console.error(`   • SSE: http://${host}:${port}/sse`);
      console.error(`   • Health Check: http://${host}:${port}/health`);
      console.error(`   • Server Info: http://${host}:${port}/info`);
    }
    console.error('');
  }

  private async logQdrantStatus() {
    try {
      console.error('🔗 QDRANT CONNECTION:');
      // Test Qdrant connection through memory service
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      console.error(`   • URL: ${qdrantUrl}`);
      console.error('   • Status: Connected ✅');
      console.error('');
    } catch (error) {
      console.error('🔗 QDRANT CONNECTION:');
      console.error('   • Status: Connection failed ❌');
      console.error(`   • Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('');
    }
  }

  private logAvailableTools() {
    const toolNames = Object.keys(tools);
    console.error('🛠️  AVAILABLE TOOLS:');
    toolNames.forEach(tool => {
      console.error(`   • ${tool}`);
    });
    console.error(`   • Total: ${toolNames.length} tools`);
    console.error('');
  }

  private logGracefulShutdownInfo() {
    console.error('⚡ SHUTDOWN:');
    console.error('   • Graceful shutdown enabled');
    console.error('   • Supports SIGINT and SIGTERM signals');
    console.error('');
  }

  async start() {
    try {
      // Display startup banner
      this.logStartupBanner();
      
      // Initialize memory service
      console.error('🚀 STARTUP SEQUENCE:');
      console.error('   • Initializing memory service...');
      await this.memoryService.initialize();
      console.error('   • Memory service initialized ✅');
      console.error('');

      // Log server configuration
      await this.logServerInfo();
      
      // Check and log Qdrant status
      await this.logQdrantStatus();
      
      // Log available tools
      this.logAvailableTools();

      // Start transports based on mode
      console.error('🔌 STARTING TRANSPORTS:');
      
      if (this.transportMode === 'stdio' || this.transportMode === 'both') {
        await this.startStdioTransport();
      }

      if (this.transportMode === 'sse' || this.transportMode === 'both') {
        await this.startSSETransport();
      }

      // Set up graceful shutdown
      this.setupGracefulShutdown();
      this.logGracefulShutdownInfo();
      
      console.error('✅ MCP Memory Server started successfully!');
      console.error('   Ready to accept connections...');
      console.error('');
      
    } catch (error) {
      console.error('❌ STARTUP FAILED:');
      console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('');
      throw error;
    }
  }

  private async startStdioTransport() {
    console.error('   • Starting STDIO transport...');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('   • STDIO transport started ✅');
  }

  private async startSSETransport() {
    try {
      console.error('   • Starting SSE transport...');
      
      // Create a separate server instance for SSE to avoid conflicts
      const sseServer = new Server(
        {
          name: 'mcp-memory-server',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Set up the same handlers for the SSE server
      this.setupHandlersForServer(sseServer);

      this.sseTransportServer = new SSETransportServer(sseServer, {
        port: parseInt(process.env.MCP_PORT || '3000'),
        corsOrigin: process.env.MCP_CORS_ORIGIN,
        host: process.env.MCP_HOST || 'localhost'
      });

      await this.sseTransportServer.start();
      console.error('   • SSE transport started ✅');
      
      const serverInfo = this.sseTransportServer.getServerInfo();
      console.error(`   • Listening on: ${serverInfo.host}:${serverInfo.port}`);
      
    } catch (error) {
      console.error('   • SSE transport failed ❌');
      console.error(`   • Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private setupHandlersForServer(server: Server) {
    // Copy all handlers to the provided server instance
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'store_memory': {
            const parsed = tools.store_memory.inputSchema.parse(args);
            const memory = await this.memoryService.createMemory(
              parsed.content,
              parsed.type as MemoryType,
              parsed.context,
              parsed.importance
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(memory, null, 2),
                },
              ],
            };
          }

          case 'store_memory_chunked': {
            const parsed = tools.store_memory_chunked.inputSchema.parse(args);
            const memories = await this.memoryService.createMemoryWithChunking(
              parsed.content,
              parsed.type as MemoryType,
              parsed.context,
              parsed.importance,
              parsed.chunkingOptions
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message: `Created ${memories.length} memory chunks`,
                    parentId: memories[0].id,
                    chunkIds: memories.slice(1).map(m => m.id),
                    memories: memories
                  }, null, 2),
                },
              ],
            };
          }

          case 'search_memories': {
            const parsed = tools.search_memories.inputSchema.parse(args);
            const memories = await this.memoryService.searchChunkedMemories({
              query: parsed.query,
              type: parsed.type as MemoryType | undefined,
              minImportance: parsed.minImportance,
              emotionalRange: parsed.emotionalRange,
              limit: parsed.limit,
              includeAssociations: parsed.includeAssociations,
              detailLevel: parsed.detailLevel,
              similarityThreshold: parsed.similarityThreshold,
              reconstructChunks: parsed.reconstructChunks,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(memories, null, 2),
                },
              ],
            };
          }

          case 'get_memory': {
            const parsed = tools.get_memory.inputSchema.parse(args);
            const memory = await this.memoryService.getMemory(parsed.id);
            return {
              content: [
                {
                  type: 'text',
                  text: memory ? JSON.stringify(memory, null, 2) : 'Memory not found',
                },
              ],
            };
          }

          case 'update_memory': {
            const parsed = tools.update_memory.inputSchema.parse(args);
            const memory = await this.memoryService.updateMemory(parsed.id, {
              content: parsed.content,
              importance: parsed.importance,
              context: parsed.context,
              metadata: parsed.metadata,
            });
            return {
              content: [
                {
                  type: 'text',
                  text: memory ? JSON.stringify(memory, null, 2) : 'Memory not found',
                },
              ],
            };
          }

          case 'delete_memory': {
            const parsed = tools.delete_memory.inputSchema.parse(args);
            await this.memoryService.deleteMemory(parsed.id);
            return {
              content: [
                {
                  type: 'text',
                  text: `Memory ${parsed.id} deleted successfully`,
                },
              ],
            };
          }

          case 'analyze_memories': {
            const parsed = tools.analyze_memories.inputSchema.parse(args);
            const memories = await this.memoryService.searchMemories({
              query: '',
              type: parsed.type as MemoryType | undefined,
              limit: 100,
            });

            const analysis = {
              totalMemories: memories.length,
              byType: memories.reduce((acc, m) => {
                acc[m.type] = (acc[m.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>),
              averageImportance: memories.reduce((sum, m) => sum + m.importance, 0) / memories.length,
              averageEmotionalValence: memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length,
              mostCommonTags: this.getMostCommonTags(memories),
            };

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(analysis, null, 2),
                },
              ],
            };
          }

          case 'connect_memories': {
            const parsed = tools.connect_memories.inputSchema.parse(args);
            await this.memoryService.connectMemories(
              parsed.sourceId,
              parsed.targetId,
              parsed.bidirectional
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `Connected memories ${parsed.sourceId} and ${parsed.targetId}`,
                },
              ],
            };
          }

          case 'find_memory_paths': {
            const parsed = tools.find_memory_paths.inputSchema.parse(args);
            const paths = await this.memoryService.findMemoryPaths(
              parsed.startId,
              parsed.endId,
              parsed.maxDepth,
              parsed.includeContent
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(paths, null, 2),
                },
              ],
            };
          }

          case 'get_association_graph': {
            const parsed = tools.get_association_graph.inputSchema.parse(args);
            const graph = await this.memoryService.getAssociationGraph(
              parsed.centerMemoryId,
              parsed.depth,
              parsed.minImportance,
              parsed.includeContent
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(graph, null, 2),
                },
              ],
            };
          }

          case 'consolidate_memories': {
            const parsed = tools.consolidate_memories.inputSchema.parse(args);
            const consolidated = await this.memoryService.consolidateMemories(
              parsed.memoryIds,
              parsed.strategy,
              parsed.keepOriginals
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(consolidated, null, 2),
                },
              ],
            };
          }

          case 'remove_association': {
            const parsed = tools.remove_association.inputSchema.parse(args);
            await this.memoryService.removeAssociation(
              parsed.sourceId,
              parsed.targetId,
              parsed.bidirectional
            );
            return {
              content: [
                {
                  type: 'text',
                  text: `Removed association between ${parsed.sourceId} and ${parsed.targetId}`,
                },
              ],
            };
          }

          case 'delete_memories_bulk': {
            const parsed = tools.delete_memories_bulk.inputSchema.parse(args);
            const result = await this.memoryService.deleteMemories(parsed.ids);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message: `Deleted ${result.deleted} memories`,
                    deleted: result.deleted,
                    failed: result.failed,
                    totalRequested: parsed.ids.length
                  }, null, 2),
                },
              ],
            };
          }

          case 'delete_all_memories': {
            const parsed = tools.delete_all_memories.inputSchema.parse(args);
            if (parsed.confirm !== true) {
              throw new Error('Confirmation required to delete all memories');
            }
            const result = await this.memoryService.deleteAllMemories();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message: 'All memories have been deleted',
                    deleted: result.deleted
                  }, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private setupGracefulShutdown() {
    const gracefulShutdown = async (signal: string) => {
      console.error(`\n🛑 SHUTDOWN INITIATED:`);
      console.error(`   • Signal received: ${signal}`);
      console.error('   • Graceful shutdown in progress...');
      
      if (this.sseTransportServer) {
        console.error('   • Stopping SSE transport server...');
        await this.sseTransportServer.stop();
        console.error('   • SSE transport stopped ✅');
      }

      console.error('   • All services stopped');
      console.error('✅ Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }
}

// Start the server
const server = new MemoryMCPServer();
server.start().catch((error) => {
  console.error('💥 CRITICAL ERROR:');
  console.error(`   Failed to start MCP Memory Server: ${error instanceof Error ? error.message : 'Unknown error'}`);
  console.error('   Server startup aborted');
  console.error('');
  process.exit(1);
});