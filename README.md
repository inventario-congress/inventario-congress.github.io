# webapp

Node.js requirement:

```bash
node -v
```

Use Node.js 24.x for local development and CI.

Local setup:

```bash
npm install
cp .env.example .env.local
```

Set the required client-side Supabase values:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

Notes:

- `.env.local` is ignored and stays machine-local.
- `.env.example` is committed so other developers know which variables are required.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are public client values for browser apps and should also be configured in the deployment environment that builds this Vite app.

Run the app locally:

```bash
npm run dev
```

GitHub Action keepalive:

- The workflow at `.github/workflows/supabase-keepalive.yml` runs every 3 days and can also be triggered manually.
- It pings `auth/v1/settings` and `rest/v1/` on your Supabase project to keep the project active.
- Configure these GitHub repository secrets before enabling it:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

- These are public client-side values, but using repository secrets keeps them out of the public repo settings view. Do not use a service-role key in this workflow.

GitHub Pages deploy:

- The workflow at `.github/workflows/deploy-pages.yml` builds the app on pushes to `main` and deploys the `dist` output to GitHub Pages.
- It uses the same repository secrets for the Vite build:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

- In GitHub, set Pages to use `GitHub Actions` as the source.
- With the repository named `inventario-congress.github.io` under the `inventario-congress` account, the site will be served at `https://inventario-congress.github.io/` and the current Vite base path is correct.