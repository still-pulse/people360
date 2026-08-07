# Deploy — People 360

| | |
|--|--|
| **Repositório** | https://github.com/still-pulse/people360 |
| **Produção** | https://people360.ossbhcl.org.br |
| **Path** | `/opt/people360` |
| **Proxy** | Dokploy Traefik · rede `dokploy-network` · 80/443 |

---

## Desenvolvimento local

```bash
docker compose -f docker-compose.dev.yml up -d
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
# http://localhost:3000
```

Docker completo:

```bash
docker compose up -d --build
# http://localhost:3002
```

---

## Produção

```bash
git clone https://github.com/still-pulse/people360.git /opt/people360
cd /opt/people360

# Secrets (obrigatório) — nunca commitar
cp .env.example .env
nano .env   # NEXTAUTH_*, SMTP_*, SLACK_*, POSTGRES_PASSWORD, etc.

docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

### Atualizar

```bash
cd /opt/people360
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
docker logs gestaorh-app --tail 100
```

### Containers

| Item | Valor |
|------|--------|
| App | `gestaorh-app` (porta interna 3000) |
| Banco | `gestaorh-db` (Postgres 16) |
| Volumes | postgres_data, uploads_data, documentos_data |

### Schema manual (se precisar)

```bash
docker exec gestaorh-app node node_modules/prisma/build/index.js db push --accept-data-loss --skip-generate
```

---

## Seed (somente desenvolvimento)

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Admin | admin@bhcl.com.br | admin123 |
| Analista | analista@bhcl.com.br | analista123 |

Troque as senhas em produção.

---

## Comandos úteis

```bash
docker logs gestaorh-app -f
docker compose restart app
docker compose ps
docker exec gestaorh-db pg_dump -U gestaorh gestaorh > backup_$(date +%Y%m%d).sql
```
