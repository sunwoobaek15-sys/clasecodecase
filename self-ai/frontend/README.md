# SELF AI frontend

Next.js (App Router) + TypeScript + Tailwind CSS. All data comes from the FastAPI
backend; `/api/*` is proxied to `SELF_AI_BACKEND_URL` (default `http://127.0.0.1:8000`)
by `next.config.ts`, so the browser only needs this one address.

```
npm install
npm run dev     # development, http://localhost:3000
npm run build && npm start
npm run lint
```

See `../README.md` for the whole project.
