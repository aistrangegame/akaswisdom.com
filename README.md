# akaswisdom-deploy

Idea → Airtable record → `git push` → live on akaswisdom.com.

## How it works

```
Airtable (content)  →  scripts/build.js  →  /public (static HTML)  →  GitHub Actions  →  SiteGround (SFTP)
```

- **templates/** holds the HTML shells. `{{FieldName}}` gets replaced with the matching Airtable field.
- **scripts/build.js** fetches every record from your Airtable table and renders it through
  whichever template its `Template` field names (defaults to `default.html`).
- **.github/workflows/deploy.yml** runs the build and pushes the result to SiteGround
  automatically on every push to `main`.
- Claude Code's job in this repo: write/edit templates, adjust build.js as the content model
  grows, add new Airtable fields as needed — then commit and push. The Action handles the rest.

## One-time setup

### 1. Airtable
Create (or reuse) a base with a table (default name `Pages`) with at least:
- `Title` (text)
- `Slug` (text) — becomes the URL path, e.g. `zorb-original` → `akaswisdom.com/zorb-original/`
- `Summary` (long text)
- `Body` (long text or rich text)
- `Template` (single select, optional) — which file in `/templates` to render through
- `Status` (single select: Draft / Live) — only `Live` rows get built

Grab your **Base ID** (starts with `app...`, visible in the API docs for the base at
airtable.com/api) and a **Personal Access Token** (account settings → Developer Hub) scoped
to `data.records:read` on this base.

### 2. SiteGround
In Site Tools for akaswisdom.com: **Site → FTP Accounts** → create an account
(e.g. `deploy@akaswisdom.com`), and when setting its home directory, scope it directly to
`public_html` — the folder that contains the live site (`akas/`, `zorb/`, `wazoodle/`, etc.),
not the account root (which also has `logs/` and `webstats/` in it).

Because the account's home is already scoped to `public_html`, the *remote path* used for
deploys is `/` (the FTP session lands inside `public_html` automatically — pointing it at
`/public_html` again would nest one level too deep).

Note the **hostname**, **username**, and the **password** you set — you'll add these as
GitHub secrets, never paste them into chat.

### 3. GitHub repo
Push this folder to a new (private is fine) GitHub repo, then under
**Settings → Secrets and variables → Actions**, add these directly in GitHub (not here):

| Secret | Value |
|---|---|
| `AIRTABLE_API_KEY` | your Airtable personal access token |
| `AIRTABLE_BASE_ID` | the `app...` base ID |
| `AIRTABLE_TABLE_NAME` | `Pages` (or your table name) |
| `FTP_HOST` | `gvam1027.siteground.biz` (from FTP Accounts) |
| `FTP_USERNAME` | `deploy@akaswisdom.com` |
| `FTP_PASSWORD` | the password you generated for this FTP account |
| `FTP_REMOTE_PATH` | `/` (since the account's home is already scoped to `public_html`) |

Deploys run over **FTPS** (FTP + TLS) on port 21, so the password isn't sent in the clear.

Push to `main` (or click **Run workflow** on the Actions tab) and it builds + deploys.

## Local preview

```bash
npm install
cp .env.example .env   # fill in your Airtable values
npm run build           # writes to /public
npx serve public        # or any static server, to preview before pushing
```

## Growing beyond one flat template

Right now every record renders through a single template with simple field substitution.
As akaswisdom.com's real structure (parent pages, maker portrait pages, portals, etc.) gets
folded in, the natural next step is more templates in `/templates` and a `Template` value per
Airtable row pointing at the right one — the build script already supports that per-record.
