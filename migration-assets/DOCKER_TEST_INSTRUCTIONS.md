# 🐳 Docker Testing Instructions

## 📋 Pre-test Setup

Na serveru s Dockerem před testováním:

```bash
# 1. Zkopírovat migration-assets/docker/* do root projektu
cp migration-assets/docker/* ./

# 2. Ujistit se, že build context obsahuje:
ls -la Dockerfile docker-compose.yml .dockerignore package.json src/

# 3. Ověřit Docker + docker-compose verze
docker --version        # požadováno: 20.0+
docker-compose --version # požadováno: 1.27+
```

## 🧪 Test Sequence

### Test 1: Basic Docker Build
```bash
# Očekávaný výsledek: Úspěšný multi-stage build
docker build -t mcp-cldmemory-enhanced:test .

# Verificatio:
docker images | grep mcp-cldmemory-enhanced
# Měl by zobrazit image ~200-300MB
```

### Test 2: Single Container (SSE Mode)
```bash
# Start container s SSE transportem
docker run -d --name mcp-test \
  -p 3000:3000 \
  -e MCP_TRANSPORT_MODE=sse \
  -e MCP_HOST=0.0.0.0 \
  mcp-cldmemory-enhanced:test

# Health check (should return JSON s active sessions)
curl -f http://localhost:3000/health
# Očekávaný response: {"status":"healthy","activeSessions":0,"uptime":"..."}

# Ping test
curl -f http://localhost:3000/ping  
# Očekávaný response: {"status":"pong","timestamp":"..."}

# SSE connection test (ponechat běžet 5 sec, pak Ctrl+C)
timeout 5 curl -N -H "Accept: text/event-stream" http://localhost:3000/sse
# Očekávaný response: event stream s session info

# Cleanup
docker stop mcp-test && docker rm mcp-test
```

### Test 3: Multi-Container (MCP + Qdrant)
```bash
# Start celého stacku
docker-compose up -d

# Ověřit že oba services běží
docker-compose ps
# Měl by zobrazit 2 services jako "Up"

# Test Qdrant health
curl -f http://localhost:6333/
# Očekávaný response: Qdrant info JSON

# Test MCP health  
curl -f http://localhost:3000/health

# Test komunikace MCP → Qdrant
# (pokud máš test endpoint pro Qdrant connection)

# Logs monitoring (kontrola chyb)
docker-compose logs mcp-cldmemory-server | grep -i error
docker-compose logs mcp-cldmemory-qdrant | grep -i error
# Neměl by zobrazit žádné kritické errory

# Cleanup
docker-compose down -v
```

### Test 4: Performance & Load
```bash
# Start služeb
docker-compose up -d

# Test multiple SSE connections (simulace concurrent clients)
for i in {1..5}; do
  (curl -N -H "Accept: text/event-stream" http://localhost:3000/sse &)
done

# Kontrola active sessions
curl http://localhost:3000/health
# Měl by zobrazit aktiveSessions: 5

# Cleanup connections
pkill -f "curl.*sse"
docker-compose down
```

## ✅ Success Criteria

**PASS pokud:**
- ✅ Docker build dokončen bez chyb
- ✅ Single container health check OK  
- ✅ Multi-container setup bez errors v logs
- ✅ SSE connections fungují
- ✅ Qdrant odpovídá na portu 6333
- ✅ MCP odpovídá na portu 3000
- ✅ Multiple concurrent SSE sessions OK

**FAIL pokud:**
- ❌ Build errors nebo warnings
- ❌ Health checks fail
- ❌ Connection refused na ports
- ❌ Error logs během startup
- ❌ SSE connections hang nebo fail
- ❌ Memory/CPU usage abnormální

## 🚨 Troubleshooting

### Pokud build failuje:
```bash
# Detailní build log
docker build --no-cache --progress=plain -t mcp-cldmemory-enhanced:test .

# Kontrola base image
docker pull node:18-alpine
```

### Pokud health checks failují:
```bash
# Kontrola container logs
docker logs mcp-test

# Test uvnitř containeru
docker exec -it mcp-test /bin/sh
# wget -O - http://localhost:3000/health
```

### Pokud Qdrant connection failuje:
```bash
# Test Qdrant connectivity
docker-compose exec mcp-cldmemory-server nc -zv mcp-cldmemory-qdrant 6333

# Kontrola DNS resolution
docker-compose exec mcp-cldmemory-server nslookup mcp-cldmemory-qdrant
```

## 📊 Expected Results Log

Pro dokumentaci úspěšného testu:

```bash
# Spusť po všech testech a ulož output:
echo "=== DOCKER TEST RESULTS ===" > docker-test-results.log
echo "Build status:" >> docker-test-results.log
docker images | grep mcp-cldmemory-enhanced >> docker-test-results.log

echo "Health check:" >> docker-test-results.log  
curl -s http://localhost:3000/health >> docker-test-results.log

echo "Container status:" >> docker-test-results.log
docker-compose ps >> docker-test-results.log

echo "Resource usage:" >> docker-test-results.log
docker stats --no-stream >> docker-test-results.log
```

Tento log pošli zpět jako potvrzení úspěšného testu!