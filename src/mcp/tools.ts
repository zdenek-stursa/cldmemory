import { z } from 'zod';
import { MemoryType } from '../types/memory';

export const tools = {
  store_memory: {
    description: 'Store a new memory with human-like characteristics',
    inputSchema: z.object({
      content: z.string().describe('The memory content'),
      type: z.enum([
        'episodic',
        'semantic',
        'procedural',
        'emotional',
        'sensory',
        'working',
      ]).describe('Type of memory'),
      context: z.object({
        location: z.string().optional().describe('Where this happened'),
        people: z.array(z.string()).optional().describe('People involved'),
        mood: z.string().optional().describe('Emotional state'),
        activity: z.string().optional().describe('What was happening'),
        tags: z.array(z.string()).optional().describe('Additional tags'),
        source: z.string().optional().describe('Source of information'),
      }).optional().describe('Context of the memory'),
      importance: z.number().min(0).max(1).optional().describe('Importance (0-1)'),
    }),
  },

  store_memory_chunked: {
    description: 'Store a large memory with automatic semantic chunking',
    inputSchema: z.object({
      content: z.string().describe('The memory content (can be very long)'),
      type: z.enum([
        'episodic',
        'semantic',
        'procedural',
        'emotional',
        'sensory',
        'working',
      ]).describe('Type of memory'),
      context: z.object({
        location: z.string().optional().describe('Where this happened'),
        people: z.array(z.string()).optional().describe('People involved'),
        mood: z.string().optional().describe('Emotional state'),
        activity: z.string().optional().describe('What was happening'),
        tags: z.array(z.string()).optional().describe('Additional tags'),
        source: z.string().optional().describe('Source of information'),
      }).optional().describe('Context of the memory'),
      importance: z.number().min(0).max(1).optional().describe('Importance (0-1)'),
      chunkingOptions: z.object({
        method: z.enum(['semantic', 'fixed', 'sentence', 'paragraph']).default('semantic'),
        maxChunkSize: z.number().optional().describe('Maximum chunk size in tokens'),
        overlapSize: z.number().optional().describe('Overlap size in tokens'),
        semanticThreshold: z.number().min(0).max(1).optional().describe('Semantic similarity threshold'),
      }).optional().describe('Chunking configuration'),
    }),
  },

  search_memories: {
    description: 'Search for memories using natural language',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      type: z.enum([
        'episodic',
        'semantic',
        'procedural',
        'emotional',
        'sensory',
        'working',
      ]).optional().describe('Filter by memory type'),
      minImportance: z.number().min(0).max(1).optional().describe('Minimum importance'),
      emotionalRange: z.object({
        min: z.number().min(-1).max(1),
        max: z.number().min(-1).max(1),
      }).optional().describe('Emotional valence range'),
      dateRange: z.object({
        start: z.string().describe('Start date (ISO format or YYYY-MM-DD)'),
        end: z.string().describe('End date (ISO format or YYYY-MM-DD)'),
      }).optional().describe('Filter by creation date range'),
      limit: z.number().min(1).max(50).default(10).describe('Number of results'),
      includeAssociations: z.boolean().default(false).describe('Include associated memories'),
      detailLevel: z.enum(['compact', 'full']).default('compact').describe('Level of detail to return'),
      similarityThreshold: z.number().min(0).max(1).optional().describe('Minimum similarity score (0-1) - default is 0.7'),
      reconstructChunks: z.boolean().default(false).describe('Reconstruct full content from chunks'),
    }),
  },

  get_memory: {
    description: 'Retrieve a specific memory by ID',
    inputSchema: z.object({
      id: z.string().describe('Memory ID'),
    }),
  },

  update_memory: {
    description: 'Update an existing memory',
    inputSchema: z.object({
      id: z.string().describe('Memory ID'),
      content: z.string().optional().describe('New content'),
      importance: z.number().min(0).max(1).optional().describe('New importance'),
      context: z.object({
        location: z.string().optional(),
        people: z.array(z.string()).optional(),
        mood: z.string().optional(),
        activity: z.string().optional(),
        tags: z.array(z.string()).optional(),
        source: z.string().optional(),
      }).optional().describe('Updated context'),
      metadata: z.record(z.any()).optional().describe('Additional metadata'),
    }),
  },

  delete_memory: {
    description: 'Delete a memory',
    inputSchema: z.object({
      id: z.string().describe('Memory ID to delete'),
    }),
  },

  analyze_memories: {
    description: 'Analyze memory patterns and connections',
    inputSchema: z.object({
      timeRange: z.object({
        start: z.string().describe('ISO date string'),
        end: z.string().describe('ISO date string'),
      }).optional().describe('Time range to analyze'),
      type: z.enum([
        'episodic',
        'semantic',
        'procedural',
        'emotional',
        'sensory',
        'working',
      ]).optional().describe('Filter by type'),
    }),
  },

  connect_memories: {
    description: 'Manually create or strengthen connections between memories',
    inputSchema: z.object({
      sourceId: z.string().describe('Source memory ID'),
      targetId: z.string().describe('Target memory ID'),
      relationshipType: z.enum([
        'caused_by',
        'similar_to',
        'contradicts',
        'follows',
        'explains',
        'reminds_of',
        'derived_from',
      ]).optional().describe('Type of relationship'),
      bidirectional: z.boolean().default(true).describe('Create connection in both directions'),
    }),
  },

  find_memory_paths: {
    description: 'Find connection paths between two memories',
    inputSchema: z.object({
      startId: z.string().describe('Starting memory ID'),
      endId: z.string().describe('Target memory ID'),
      maxDepth: z.number().min(1).max(10).default(5).describe('Maximum path length'),
      includeContent: z.boolean().default(false).describe('Include memory content in results'),
    }),
  },

  get_association_graph: {
    description: 'Get the network graph of memory associations',
    inputSchema: z.object({
      centerMemoryId: z.string().optional().describe('Center the graph on this memory'),
      depth: z.number().min(1).max(5).default(2).describe('Levels of connections to include'),
      minImportance: z.number().min(0).max(1).optional().describe('Filter by minimum importance'),
      includeContent: z.boolean().default(false).describe('Include memory content'),
    }),
  },

  consolidate_memories: {
    description: 'Merge similar or duplicate memories into a consolidated memory',
    inputSchema: z.object({
      memoryIds: z.array(z.string()).min(2).describe('Memory IDs to consolidate'),
      strategy: z.enum([
        'merge_content',
        'summarize',
        'keep_most_important',
        'create_composite',
      ]).default('merge_content').describe('Consolidation strategy'),
      keepOriginals: z.boolean().default(false).describe('Keep original memories after consolidation'),
    }),
  },

  remove_association: {
    description: 'Remove a connection between two memories',
    inputSchema: z.object({
      sourceId: z.string().describe('Source memory ID'),
      targetId: z.string().describe('Target memory ID'),
      bidirectional: z.boolean().default(true).describe('Remove connection in both directions'),
    }),
  },

  delete_memories_bulk: {
    description: 'Delete multiple memories by their IDs',
    inputSchema: z.object({
      ids: z.array(z.string()).min(1).describe('Array of memory IDs to delete'),
    }),
  },

  delete_all_memories: {
    description: 'Delete ALL memories from the system. Use with caution!',
    inputSchema: z.object({
      confirm: z.literal(true).describe('Must be true to confirm deletion of all memories'),
    }),
  },
};