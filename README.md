# MCP Memory Server

A human-like memory system using Qdrant vector database and OpenAI embeddings, accessible through the Model Context Protocol (MCP).

## Features

- **Human-like Memory Types**:
  - Episodic (personal experiences)
  - Semantic (facts and knowledge)
  - Procedural (how to do things)
  - Emotional (emotional memories)
  - Sensory (sensory impressions)
  - Working (short-term memory)

- **Memory Characteristics**:
  - Importance scoring (0-1)
  - Emotional valence (-1 to 1)
  - Associations between memories
  - Context (location, people, mood, activity)
  - Decay factor and access tracking
  - Automatic project tracking (hostname:folder)
  - Custom metadata via environment variables

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

   **Required environment variables**:
   - `QDRANT_URL` - Qdrant server URL (e.g., `http://localhost:6333`)
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `OPENAI_MODEL` - Embedding model (default: `text-embedding-3-small`)

   **Optional environment variables**:
   - `MEMORY_METADATA` - Optional metadata to include with all memories
     - Format: `"key:value,key2:value2"` or just `"value"` (stored as `user:value`)
     - Examples: `"server:prod,user:john"` or `"davidstrejc"`
   - `MCP_TRANSPORT_MODE` - Transport protocol (`stdio`, `sse`, or `both`)
     - `stdio` (default): Standard MCP protocol for Claude Code
     - `sse`: HTTP Server-Sent Events for web clients
     - `both`: Support both protocols simultaneously
   - `MCP_PORT` - Port for SSE transport (default: `3000`)
   - `MCP_HOST` - Host binding for SSE transport (default: `localhost`)
   - `MCP_CORS_ORIGIN` - CORS origin for SSE transport (default: `*`)

3. **Start services**:

   **Option A: Docker Compose (Recommended)**
   ```bash
   docker-compose up -d
   ```
   This starts both Qdrant and the memory server with SSE transport.

   **Option B: Manual Setup**
   ```bash
   # Start Qdrant
   docker run -p 6333:6333 -p 6334:6334 \
     --name qdrant-memory \
     -v $(pwd)/qdrant_storage:/qdrant/storage:z \
     qdrant/qdrant
   
   # Build and start memory server
   npm run build
   npm start
   ```

4. **Choose your transport**:
   - **STDIO mode**: For Claude Code integration (default)
   - **SSE mode**: For web applications and HTTP clients
   - **Both modes**: Support multiple client types simultaneously

## Usage

### STDIO Mode (Claude Code Integration)

Configure Claude Code with the provided MCP configuration:

```bash
# Basic usage
claude -p "Store a memory about today's meeting" --mcp-config claude-code-mcp.json

# Skip permissions for automation
claude -p "Search my memories" --mcp-config claude-code-mcp.json --dangerously-skip-permissions

# List available tools
claude -p "List available memory tools" --mcp-config claude-code-mcp.json
```

### SSE Mode (HTTP API)

For web applications and HTTP clients:

```bash
# Start server in SSE mode
MCP_TRANSPORT_MODE=sse npm start

# Test connection
curl http://localhost:3000/health

# Establish SSE connection
curl -N -H "Accept: text/event-stream" http://localhost:3000/sse

# Send MCP messages (in another terminal)
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Dual Mode (Both Protocols)

Support both STDIO and SSE simultaneously:

```bash
# Start in dual mode
MCP_TRANSPORT_MODE=both npm start

# Now both Claude Code (STDIO) and web clients (SSE) can connect
```

Available MCP tools (prefixed with `mcp__memory__`):

- `store_memory` - Store a new memory
- `search_memories` - Search for memories using natural language
- `get_memory` - Retrieve a specific memory
- `update_memory` - Update an existing memory
- `delete_memory` - Delete a memory
- `analyze_memories` - Analyze memory patterns

## Example Usage

```
# Store a memory
store_memory({
  "content": "Had lunch with Sarah at the Italian restaurant",
  "type": "episodic",
  "context": {
    "location": "Downtown Italian restaurant",
    "people": ["Sarah"],
    "mood": "happy"
  },
  "importance": 0.8
})

# Search memories
search_memories({
  "query": "restaurant experiences",
  "limit": 5,
  "includeAssociations": true
})
```

## Transport Modes

This memory server supports multiple transport protocols:

### STDIO Transport (Default)
- **Use case**: Claude Code integration
- **Protocol**: Standard MCP over stdin/stdout
- **Configuration**: Set `MCP_TRANSPORT_MODE=stdio` (default)

### SSE Transport (HTTP)
- **Use case**: Web applications, HTTP clients
- **Protocol**: Server-Sent Events over HTTP
- **Endpoints**:
  - `GET /sse` - Establish SSE connection
  - `POST /messages` - Send MCP messages
  - `GET /health` - Health check
  - `GET /ping` - Ping endpoint
- **Configuration**: Set `MCP_TRANSPORT_MODE=sse`

### Dual Transport Mode
- **Use case**: Support both client types simultaneously
- **Configuration**: Set `MCP_TRANSPORT_MODE=both`

## New Features

**Automatic Project Tracking**: All memories now include a `project` field that captures the hostname and current working directory (e.g., `"myserver:/home/user/project"`).

**Environment Metadata**: Set the `MEMORY_METADATA` environment variable to automatically include custom metadata in all memories:
```bash
export MEMORY_METADATA="server:production,team:engineering,region:us-west"
```

This metadata is automatically:
- Added to all new memories
- Included in memory embeddings for better search relevance
- Used in search queries to improve context matching

**Docker Deployment**: Full containerization support with docker-compose for easy deployment and scaling.

## Memory Analytics Tool

A comprehensive CLI tool is included for analyzing memories:

```bash
# Quick start
./memory-analytics count    # Count memories by agent
./memory-analytics tags     # Analyze tag usage
./memory-analytics compare  # Compare agents
./memory-analytics all      # Run all analytics
```

See [docs/MEMORY_ANALYTICS.md](docs/MEMORY_ANALYTICS.md) for detailed documentation.

## Development

- `npm run dev` - Run in development mode
- `npm run build` - Build TypeScript
- `npm run test` - Run tests
- `npm run lint` - Run linter
- `npm run typecheck` - Type check