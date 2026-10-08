import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { appRoot, initDb, isDbConnected, closeDb } from './db'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { schedulingRouter } from './routes/scheduling'
import { roomsRouter } from './routes/rooms'
import { lecturersRouter } from './routes/lecturers'
import { entitiesRouter } from './routes/entities'
import { restrictionsRouter } from './routes/restrictions'

export const app = express()
const PORT = process.env.PORT || 3000

app.set('trust proxy', 1)
app.use(cors({ credentials: true, origin: true }))
// Body parsers are scoped to the API routes; the OIDC proxy below must
// receive the raw urlencoded bodies of the provider's login/logout forms.
app.use('/api', express.json({ limit: '10mb' }))
app.use('/api', express.urlencoded({ extended: true }))

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    databaseConnected: isDbConnected(),
    timestamp: new Date().toISOString(),
  })
})

// Scheduling tool endpoints (module/lecturer mapping, rooms). Mounted before
// the generic entity router so /api/scheduling/... is matched here first.
app.use('/api/scheduling', schedulingRouter)
app.use('/api/scheduling', roomsRouter)
app.use('/api/scheduling', lecturersRouter)

// Restrictions CRUD + effective (inherited) restriction resolution for
// curriculum entities. Mounted before the generic entity router so
// /:table/:id/restrictions is matched here first.
app.use('/api', restrictionsRouter)

// Generic entity CRUD + per-object access management. Mounted after the fixed
// routes above so it cannot shadow them; the router itself 404s any table
// outside its TABLE_SPECS registry.
app.use('/api', entitiesRouter)

interface AppMount {
  path: string
  dirname: string
}

const FRONTEND_APPS: AppMount[] = [
  { path: '/user_entry', dirname: 'user_entry' },
  { path: '/administration', dirname: 'administration' },
  { path: '/scheduling', dirname: 'scheduling' },
  { path: '/competencies', dirname: 'competencies' },
]

const appsBaseDir = path.resolve(appRoot, 'dist/apps')
const distDirs = new Map<string, string>()

for (const mount of FRONTEND_APPS) {
  const candidate = path.join(appsBaseDir, mount.dirname)
  if (existsSync(candidate)) {
    distDirs.set(mount.path, candidate)
    app.use(mount.path, express.static(candidate))
  }
}

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

// ── OIDC provider reverse proxy ─────────────────────────────────────────────
// The whole OIDC conversation (discovery, authorize, token, interaction
// login pages, end-session incl. cancel) is served same-origin through the
// UniWeaver backend. Providers behind the proxy (e.g. docPouch with
// trust proxy + x-forwarded-host) advertise endpoints under this origin,
// so logout-cancel redirects validate against UniWeaver's host and the
// browser never talks to the provider's internal host/port directly.
//
// Both mounts keep the full request path (mounted without a path prefix
// and filtered explicitly) so the upstream receives /oidc/... and
// /interaction/... exactly as the browser sent them. Note: this assumes
// the upstream issuer path matches the /oidc prefix (docPouch default).
const rawOidc = (process.env.OIDC_INTERNAL_ISSUER || process.env.OIDC_ISSUER || 'http://localhost:3000/oidc').replace(/\/+$/, '')
const oidcUpstream = new URL(rawOidc)
const proxyOptions = {
  target: oidcUpstream.origin,
  changeOrigin: true,
  xfwd: true,
  cookieDomainRewrite: '',
}

app.use(createProxyMiddleware({
  ...proxyOptions,
  pathFilter: ['/oidc', '/interaction'],
}))

for (const mount of FRONTEND_APPS) {
  const distDir = distDirs.get(mount.path)
  if (!distDir) continue
  app.get(mount.path, (_req: Request, res: Response) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
  app.get(`${mount.path}/*splat`, (req: Request, res: Response, next: NextFunction) => {
    const relative = req.path.slice(mount.path.length).replace(/^\/+/, '')
    const candidate = path.join(distDir, relative)
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      return next()
    }
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.get('/', (_req: Request, res: Response) => {
  const userEntry = distDirs.get('/user_entry')
  if (userEntry) {
    res.redirect('/user_entry')
    return
  }
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head><title>UniWeaver</title></head>
      <body style="font-family: sans-serif; padding: 2rem;">
        <h1>UniWeaver API Server</h1>
        <p>API is running at <a href="/api/health">/api/health</a>.</p>
        <p>Frontend apps are served under /user_entry, /administration, /scheduling, /competencies.</p>
      </body>
    </html>
  `)
})

export async function startServer(port: number | string = PORT) {
  await initDb()
  return new Promise(resolve => {
    const server = app.listen(port, () => {
      console.log(`[Server] UniWeaver backend listening on http://localhost:${port}`)
      resolve(server)
    })
  })
}

const __filename = fileURLToPath(import.meta.url)
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isMainModule && process.env.NODE_ENV !== 'test') {
  void startServer()
}

process.on('SIGTERM', async () => {
  await closeDb()
  process.exit(0)
})