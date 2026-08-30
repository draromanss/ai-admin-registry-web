# AI Admin Registry — Telegram Mini App

Public browser interface for `@AIAdminRegistryBot`.

Production URL:

```text
https://draromanss.github.io/ai-admin-registry-web/
```

The frontend contains no bot tokens, database credentials, or signing keys.
Authentication uses Telegram-signed Mini App `initData`; all privileged
operations are handled by the private backend deployed on Amvera.

## Architecture

```text
GitHub Pages frontend → Amvera FastAPI backend → PostgreSQL
```

## GitHub Pages configuration

In repository **Settings → Pages**, select **GitHub Actions** as the publishing
source. The included workflow builds and publishes the static Next.js export.

Add the public backend address in **Settings → Secrets and variables → Actions
→ Variables**:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-backend.amvera.io
```

This value is public by design. Never put secrets in any `NEXT_PUBLIC_*`
variable.

## Local development

```bash
npm ci
npm run dev
```

Static Pages build:

```bash
GITHUB_PAGES=true \
NEXT_PUBLIC_BASE_PATH=/ai-admin-registry-web \
npm run build:pages
```
