# 🚀 Migration Guide: Docker + SSE Integration

## 📁 Assets Extracted

Tato složka obsahuje všechny assets potřebné pro migraci Docker + SSE funkcí do nové verze:

### 🐳 Docker Assets (`/docker/`)
- **Dockerfile**: Multi-stage build pro produkční nasazení
- **docker-compose.yml**: Orchestrace s Qdrant databází
- **.dockerignore**: Build optimalizace

### 🌐 SSE Assets (`/sse/`)
- **transport/sse.ts**: Kompletní SSE transport server
  - Express.js HTTP server
  - Session management s UUID
  - CORS + security headers
  - Health checks + ping endpoints

### ⚙️ Config Assets (`/config/`)
- **environment.ts**: Environment variable konfigurace
- **index-enhanced.ts**: Main server s dual-mode transport

## 🔧 Dependencies Přidané

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13"
  }
}
```

## 🌍 Environment Variables

```bash
# Transport Mode
MCP_TRANSPORT_MODE=stdio|sse|both  # default: stdio

# SSE Server Configuration  
MCP_PORT=3000                      # default: 3000
MCP_HOST=localhost                 # default: localhost
MCP_CORS_ORIGIN=*                  # default: *

# Qdrant Configuration (for Docker)
QDRANT_URL=http://mcp-cldmemory-qdrant:6333
```

## 🚀 Docker Testing Commands

Pro testování na serveru s Dockerem:

```bash
# 1. Základní build test
docker build -t mcp-cldmemory-test .

# 2. Single container test (pouze MCP server)
docker run -p 3000:3000 -e MCP_TRANSPORT_MODE=sse mcp-cldmemory-test

# 3. Multi-container test (s Qdrant)
docker-compose up -d

# 4. Health check test
curl http://localhost:3000/health
curl http://localhost:3000/ping

# 5. SSE connection test
curl -N -H "Accept: text/event-stream" http://localhost:3000/sse

# 6. Logs monitoring
docker-compose logs -f mcp-cldmemory-server
docker-compose logs -f mcp-cldmemory-qdrant
```

## 📊 Funkční Testy

### STDIO Mode (původní)
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | node dist/index.js
```

### SSE Mode  
```bash
# Terminal 1: Start server
MCP_TRANSPORT_MODE=sse node dist/index.js

# Terminal 2: Test SSE connection
curl -N -H "Accept: text/event-stream" http://localhost:3000/sse

# Terminal 3: Send message
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
```

### Dual Mode
```bash
MCP_TRANSPORT_MODE=both node dist/index.js
# Podporuje současně STDIO i SSE
```

## 🔍 Verifikace po Integraci

**Checklist pro ověření úspěšné migrace:**

- [ ] **Docker build**: bez chyb
- [ ] **Docker-compose**: oba services healthy
- [ ] **STDIO transport**: funguje (zpětná kompatibilita)
- [ ] **SSE transport**: connection + messaging OK
- [ ] **Dual mode**: oba transporty současně
- [ ] **Health checks**: /health a /ping odpovídají
- [ ] **Qdrant**: connection test úspěšný
- [ ] **CORS**: povoluje požadované origins
- [ ] **Security headers**: správně nastavené

## 📝 Migration Checklist

Po aplikaci na novou verzi:

1. ✅ Zkopírovat Docker soubory
2. ✅ Zkopírovat SSE transport
3. ✅ Aktualizovat environment config
4. ✅ Integrovat dual-mode do main server
5. ✅ Přidat dependencies do package.json
6. ✅ Otestovat všechny transport modes
7. ✅ Ověřit Docker deployment
8. ✅ Dokumentovat nové funkce

**Zpětná kompatibilita garantována** - původní STDIO mode zůstává default a nezměněný.