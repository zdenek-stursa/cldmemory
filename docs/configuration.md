# Configuration Guide

This guide covers all configuration options for the MCP Memory Server.

## Environment Variables

The server uses environment variables for configuration. These can be set in a `.env` file or passed directly.

### Core Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `QDRANT_URL` | Qdrant server URL | - | Yes |
| `QDRANT_API_KEY` | Qdrant API key (if using cloud) | - | No |
| `QDRANT_COLLECTION_NAME` | Collection name for memories | `human_memories` | Yes |
| `OPENAI_API_KEY` | OpenAI API key for embeddings | - | Yes |
| `OPENAI_MODEL` | OpenAI embedding model | `text-embedding-3-small` | Yes |
| `MCP_SERVER_NAME` | Name of the MCP server | `memory-server` | Yes |
| `MCP_SERVER_PORT` | Port for the MCP server | `3000` | Yes |

### Transport Configuration

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `MCP_TRANSPORT_MODE` | Transport protocol mode | `stdio` | `stdio`, `sse`, `both` |
| `MCP_PORT` | Port for SSE transport | `3000` | Any valid port |
| `MCP_HOST` | Host binding for SSE transport | `localhost` | IP address or hostname |
| `MCP_CORS_ORIGIN` | CORS origin for SSE transport | `*` | Origin URL or `*` |

### Memory Metadata Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `MEMORY_METADATA` | Automatic metadata for all memories | `user:john,env:prod` |
| `SIMILARITY_THRESHOLD` | Default similarity threshold for search | `0.7` |

### Advanced Configuration

```bash
# Vector Configuration
VECTOR_DIMENSION=1536  # For text-embedding-3-small

# Memory Defaults
DEFAULT_IMPORTANCE=0.5
MAX_ASSOCIATIONS=5
MEMORY_DECAY_RATE=0.01

# Search Configuration
DEFAULT_SEARCH_LIMIT=10
MAX_SEARCH_LIMIT=50
```

## Transport Modes

The memory server supports three transport modes:

### STDIO Transport (Default)
- **Protocol**: Standard MCP over stdin/stdout
- **Use case**: Claude Code integration
- **Configuration**: `MCP_TRANSPORT_MODE=stdio`

### SSE Transport (HTTP)
- **Protocol**: Server-Sent Events over HTTP
- **Use case**: Web applications, HTTP clients
- **Configuration**: `MCP_TRANSPORT_MODE=sse`
- **Endpoints**:
  - `GET /sse` - Establish SSE connection
  - `POST /messages` - Send MCP messages
  - `GET /health` - Health check
  - `GET /ping` - Ping endpoint

### Dual Transport Mode
- **Protocol**: Both STDIO and SSE simultaneously
- **Use case**: Support multiple client types
- **Configuration**: `MCP_TRANSPORT_MODE=both`

## MCP Configuration File

The `claude-code-mcp.json` file configures how Claude Code connects to your server.

### STDIO Configuration (Default)

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "MCP_TRANSPORT_MODE": "stdio"
      }
    }
  }
}
```

### SSE Configuration

For HTTP/web clients, configure SSE mode:

```json
{
  "mcpServers": {
    "memory-sse": {
      "type": "sse",
      "url": "http://localhost:3000/sse",
      "env": {
        "MCP_TRANSPORT_MODE": "sse"
      }
    }
  }
}
```

### Dual Mode Configuration

Support both STDIO and SSE simultaneously:

```json
{
  "mcpServers": {
    "memory-stdio": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "MCP_TRANSPORT_MODE": "both"
      }
    },
    "memory-sse": {
      "type": "sse", 
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### Environment-Specific Configurations

```json
{
  "mcpServers": {
    "memory-dev": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/path/to/cldmemory",
      "env": {
        "NODE_ENV": "development",
        "MCP_TRANSPORT_MODE": "stdio"
      }
    },
    "memory-prod": {
      "command": "node",
      "args": ["/path/to/cldmemory/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "MCP_TRANSPORT_MODE": "both",
        "MCP_HOST": "0.0.0.0",
        "MCP_CORS_ORIGIN": "https://yourdomain.com"
      }
    }
  }
}
```

## Claude Code CLI Options

When using the memory server with Claude Code, you have several options:

### Permission Handling

```bash
# Interactive mode - will prompt for permissions
claude -p "Store a memory" --mcp-config claude-code-mcp.json

# Skip all permissions (use with caution)
claude -p "Store a memory" \
  --mcp-config claude-code-mcp.json \
  --dangerously-skip-permissions

# Allow specific tools
claude -p "Store a memory" \
  --mcp-config claude-code-mcp.json \
  --allowedTools "mcp__memory__store_memory,mcp__memory__search_memories"
```

### Output Formats

```bash
# JSON output
claude -p "Search memories" \
  --mcp-config claude-code-mcp.json \
  --output-format json

# Stream JSON for real-time updates
claude -p "Analyze memories" \
  --mcp-config claude-code-mcp.json \
  --output-format stream-json
```

## Memory Types Configuration

The system supports different memory types, each with specific characteristics:

```typescript
enum MemoryType {
  EPISODIC = 'episodic',     // Personal experiences
  SEMANTIC = 'semantic',     // Facts and knowledge
  PROCEDURAL = 'procedural', // How-to information
  EMOTIONAL = 'emotional',   // Emotional memories
  SENSORY = 'sensory',      // Sensory experiences
  WORKING = 'working',      // Short-term memory
}
```

### Memory Type Behaviors

| Type | Default Importance | Decay Rate | Max Associations |
|------|-------------------|------------|------------------|
| Episodic | 0.7 | 0.01 | 5 |
| Semantic | 0.5 | 0.001 | 3 |
| Procedural | 0.6 | 0.0001 | 3 |
| Emotional | 0.8 | 0.02 | 7 |
| Sensory | 0.4 | 0.05 | 3 |
| Working | 0.3 | 0.1 | 2 |

## Qdrant Configuration

### Collection Settings

The Qdrant collection is created with these settings:

```javascript
{
  vectors: {
    size: 1536,        // Dimension for text-embedding-3-small
    distance: 'Cosine' // Similarity metric
  }
}
```

### Indexing Configuration

For better performance with large memory collections:

```javascript
{
  vectors: {
    size: 1536,
    distance: 'Cosine',
    hnsw_config: {
      m: 16,
      ef_construct: 100,
      full_scan_threshold: 10000
    }
  }
}
```

## Docker Deployment

### Docker Compose (Recommended)

The included `docker-compose.yml` provides a complete setup:

```yaml
version: '3.8'
services:
  mcp-cldmemory-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MCP_TRANSPORT_MODE=sse
      - MCP_HOST=0.0.0.0
      - QDRANT_URL=http://mcp-cldmemory-qdrant:6333
    depends_on:
      - mcp-cldmemory-qdrant
      
  mcp-cldmemory-qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage
```

### Deployment Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale server instances
docker-compose up -d --scale mcp-cldmemory-server=3

# Stop services
docker-compose down
```

### Environment Configuration for Docker

Create a `.env` file for Docker deployment:

```bash
# Docker environment
MCP_TRANSPORT_MODE=sse
MCP_HOST=0.0.0.0
MCP_PORT=3000
MCP_CORS_ORIGIN=*

# Database
QDRANT_URL=http://mcp-cldmemory-qdrant:6333
QDRANT_COLLECTION_NAME=human_memories

# OpenAI
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=text-embedding-3-small

# Memory settings
MEMORY_METADATA=env:production,deployment:docker
```

## Security Configuration

### API Key Management

Never commit API keys to version control. Use environment variables:

```bash
# In production, use secret management
export OPENAI_API_KEY=$(vault read -field=key secret/openai)
export QDRANT_API_KEY=$(vault read -field=key secret/qdrant)
```

### SSE Transport Security

For production SSE deployments:

```bash
# Restrict CORS origins
MCP_CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Bind to specific interface
MCP_HOST=10.0.1.100

# Use HTTPS in production (configure reverse proxy)
```

### Access Control

For production use, consider:

1. **Tool Permissions**: Use `--allowedTools` instead of `--dangerously-skip-permissions`
2. **API Rate Limiting**: Implement rate limits for OpenAI API calls
3. **Memory Access Control**: Add user-specific memory isolation
4. **Transport Security**: Use HTTPS for SSE transport in production

## Performance Tuning

### Embedding Cache

To reduce API calls, implement caching:

```javascript
// In memory.ts
const embeddingCache = new Map<string, number[]>();

async createEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) return cached;
  
  const embedding = await this.openai.createEmbedding(text);
  embeddingCache.set(text, embedding);
  return embedding;
}
```

### Batch Operations

For better performance when storing multiple memories:

```bash
claude -p "Store these memories in batch: [memory1, memory2, memory3]" \
  --mcp-config claude-code-mcp.json
```

## Monitoring and Logging

### Enable Debug Logging

```bash
# In your .env file
LOG_LEVEL=debug
LOG_FORMAT=json

# Or via command line
NODE_ENV=development LOG_LEVEL=debug node dist/index.js
```

### Health Checks

Add health check endpoint for monitoring:

```javascript
// In index.ts
server.setRequestHandler('health/check', async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  services: {
    qdrant: await this.checkQdrantHealth(),
    openai: await this.checkOpenAIHealth()
  }
}));
```