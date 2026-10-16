import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Local serverless shim: serves /api/<name> from api/<name>.js during `vite dev`
 * using the same (req, res) contract as Vercel Node functions, so the full stack
 * runs with a single `npm run dev` (no `vercel login` required).
 */
function localApi() {
  return {
    name: 'local-vercel-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const name = req.url.slice(5).split('?')[0].replace(/\/+$/, '');
        if (!/^[a-z0-9-]+$/i.test(name)) return next();
        const file = path.resolve(server.config.root, 'api', `${name}.js`);
        if (!fs.existsSync(file)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `No API route: ${name}` }));
          return;
        }
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString('utf8');
          let body = raw;
          if ((req.headers['content-type'] || '').includes('application/json')) {
            body = raw ? JSON.parse(raw) : {};
          }
          req.body = body;
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (obj) => {
            if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
            return res;
          };
          res.send = (data) => {
            res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
            return res;
          };
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, res);
        } catch (err) {
          server.config.logger.error(`[api/${name}] ${err.stack || err}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
          }
          res.end(JSON.stringify({ error: err.message || 'Internal error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Expose ALL .env vars (not just VITE_*) to the local API shim, mirroring Vercel.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [react(), localApi()],
    server: { port: 5173 },
    build: {
      chunkSizeWarningLimit: 1500,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.js', 'api/**/*.test.js'],
    },
  };
});
