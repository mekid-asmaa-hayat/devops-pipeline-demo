# DevOps Pipeline Demo 🚀

Pipeline DevOps complet autour d'une API Node.js/Express : containerisation Docker multi-stage, CI/CD GitHub Actions, reverse proxy Nginx et monitoring Prometheus/Grafana.

[![CI/CD Pipeline](https://github.com/mekid-asmaa-hayat/devops-pipeline-demo/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/mekid-asmaa-hayat/devops-pipeline-demo/actions/workflows/ci-cd.yml)
[![Docker Image](https://img.shields.io/docker/pulls/mekid-asmaa-hayat/devops-pipeline-demo)](https://hub.docker.com/r/mekid-asmaa-hayat/devops-pipeline-demo)

---

## Stack technique

| Composant | Technologie |
|---|---|
| API | Node.js 20 + Express |
| Containerisation | Docker (multi-stage build) |
| Orchestration locale | Docker Compose |
| Reverse proxy | Nginx 1.25 |
| CI/CD | GitHub Actions |
| Registry | Docker Hub |
| Déploiement | Render (free tier) |
| Métriques | Prometheus v2.50 |
| Dashboard | Grafana 10.3 |
| Tests | Jest + Supertest |
| Linting | ESLint |

---

## Architecture

```
Internet
    │
    ▼
┌─────────┐     ┌─────────────┐     ┌──────────────┐
│  Nginx  │────▶│  Node API   │────▶│  /metrics    │
│  :80    │     │  :3000      │     │  (internal)  │
└─────────┘     └─────────────┘     └──────┬───────┘
                                           │
                                    ┌──────▼───────┐     ┌─────────┐
                                    │  Prometheus  │────▶│ Grafana │
                                    │  :9090       │     │  :3001  │
                                    └──────────────┘     └─────────┘
```

**Flux CI/CD :**
```
git push main
    │
    ├── Job 1: Lint + Tests Jest (coverage)
    │
    ├── Job 2: Build Docker image multi-stage
    │          └── Push sur Docker Hub (tag sha + latest)
    │
    └── Job 3: Deploy sur Render via webhook
               └── Health check de validation
```

---

## Lancer le projet localement

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/install/) v2

### Démarrage en une commande

```bash
git clone https://github.com/mekid-asmaa-hayat/devops-pipeline-demo.git
cd devops-pipeline-demo
docker compose up --build
```

Services disponibles :

| Service | URL |
|---|---|
| API (via Nginx) | http://localhost |
| API directe | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

Identifiants Grafana par défaut : `admin / admin`

### Mode développement (hot reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Endpoints API

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Health check (uptime, timestamp) |
| GET | `/api/info` | Métadonnées de l'app (version, env) |
| GET | `/api/items` | Liste d'items (données de démo) |
| GET | `/metrics` | Métriques Prometheus (accès interne) |

Exemple :

```bash
curl http://localhost/health
# {"status":"ok","uptime":42.3,"timestamp":"2024-03-15T10:00:00.000Z"}

curl http://localhost/api/items
# {"count":5,"items":[...]}
```

---

## Docker multi-stage build

Le `Dockerfile` utilise 3 stages pour optimiser la taille de l'image finale :

```
Stage 1 — deps     : npm ci --omit=dev  (dépendances prod uniquement)
Stage 2 — test     : npm ci + lint + jest  (utilisé en CI)
Stage 3 — runner   : image finale alpine + user non-root
```

Taille de l'image finale : ~**120 MB** (vs ~500 MB sans multi-stage).

```bash
# Build manuel
docker build -t devops-pipeline-demo .

# Lancer le container seul
docker run -p 3000:3000 devops-pipeline-demo
```

---

## CI/CD — GitHub Actions

La pipeline `ci-cd.yml` se déclenche sur chaque push `main` :

### Job 1 — Lint & Test
- Setup Node.js 20 avec cache npm
- `npm run lint` (ESLint)
- `npm test` avec couverture de code
- Upload de l'artifact de coverage

### Job 2 — Build & Push
- Docker Buildx pour builds multi-plateformes
- Login Docker Hub via secrets
- Build du stage `runner` (production)
- Push des tags `latest` + `sha-<commit>`
- Cache GitHub Actions pour accélérer les builds

### Job 3 — Deploy
- Trigger du webhook Render
- Attente + health check de validation
- Résumé dans GitHub Actions Summary

### Secrets GitHub à configurer

Aller dans **Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|---|---|
| `DOCKERHUB_USERNAME` | Ton username Docker Hub |
| `DOCKERHUB_TOKEN` | Token Docker Hub (pas le mot de passe) |
| `RENDER_DEPLOY_HOOK_URL` | URL du webhook dans Render → Service → Settings |
| `APP_URL` | URL de l'app Render (ex: `https://devops-pipeline-demo.onrender.com`) |

---

## Monitoring

### Prometheus

Accessible sur `http://localhost:9090`

Métriques exposées par l'API :

```
http_requests_total{method, route, status}  — compteur de requêtes
http_request_duration_seconds{method, route} — durée des requêtes (histogram)
process_cpu_seconds_total                    — CPU du process Node.js
nodejs_heap_size_used_bytes                  — mémoire heap
```

Exemple de requête PromQL :

```promql
# Taux de requêtes par seconde
rate(http_requests_total[1m])

# Latence 95e percentile
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Grafana

Accessible sur `http://localhost:3001` (admin / admin)

La datasource Prometheus est provisionnée automatiquement. Pour importer un dashboard Node.js, utiliser l'ID `11159` depuis grafana.com.

---

## Tests

```bash
# Lancer les tests
npm test

# Avec couverture
npm test -- --coverage

# Watch mode
npm test -- --watch
```

Couverture cible configurée dans `package.json` : 80% lignes/fonctions.

---

## Structure du projet

```
devops-pipeline-demo/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # Pipeline GitHub Actions
├── monitoring/
│   ├── prometheus.yml          # Config Prometheus
│   └── grafana/
│       └── provisioning/
│           └── datasources/
│               └── prometheus.yml
├── nginx/
│   └── nginx.conf              # Config reverse proxy
├── src/
│   ├── app.js                  # Express app + métriques
│   └── server.js               # Entrypoint
├── tests/
│   └── app.test.js             # Tests Jest
├── .dockerignore
├── .eslintrc.js
├── .gitignore
├── docker-compose.yml          # Stack complète (prod)
├── docker-compose.dev.yml      # Override dev (hot reload)
├── Dockerfile                  # Multi-stage build
└── package.json
```

---

## Déploiement sur Render (free tier)

1. Créer un compte sur [render.com](https://render.com)
2. **New → Web Service** → connecter le repo GitHub
3. Paramètres :
   - **Environment :** Docker
   - **Branch :** main
   - **Dockerfile path :** `./Dockerfile`
4. Copier le **Deploy Hook URL** → l'ajouter comme secret GitHub `RENDER_DEPLOY_HOOK_URL`
5. Copier l'URL du service → secret `APP_URL`

---

## Auteur

**Mekid Asma Hayet** — Développeuse Fullstack  
[Portfolio](https://mekid-portfolio.web.app) · [GitHub](https://github.com/mekid-asmaa-hayat) · [LinkedIn](https://linkedin.com/in/mekid-asma-hayet-014850222)
