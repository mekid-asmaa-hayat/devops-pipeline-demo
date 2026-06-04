const express = require('express');
const client = require('prom-client');

const app = express();
app.use(express.json());

// ── Prometheus metrics ──────────────────────────────────────────────
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [register],
});

// Middleware: track every request
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });
  res.on('finish', () => {
    httpRequestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
    end();
  });
  next();
});

// ── Routes ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/info', (req, res) => {
  res.json({
    app: 'devops-pipeline-demo',
    version: process.env.APP_VERSION || '1.0.0',
    env: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/items', (req, res) => {
  const items = [
    { id: 1, name: 'Docker', category: 'containerization' },
    { id: 2, name: 'GitHub Actions', category: 'ci-cd' },
    { id: 3, name: 'Prometheus', category: 'monitoring' },
    { id: 4, name: 'Grafana', category: 'monitoring' },
    { id: 5, name: 'Nginx', category: 'proxy' },
  ];
  res.json({ count: items.length, items });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

module.exports = app;
