# PaprFeed PWA

PaprFeed is a beginner-friendly mobile-first PWA for browsing research papers instead of social feeds.

## Run it locally

From this folder:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173
```

## What is included

- arXiv feed
- bioRxiv feed
- medRxiv feed
- PubMed feed
- All-source browsing
- Source counts
- Load more pagination
- Paper detail view
- Quick filters for preprints, published papers, reviews, clinical trials, and free full text
- Hide papers locally on one device
- Reset hidden papers from the source-count row
- First-run onboarding for interests and source mix
- Skipping onboarding opens a neutral All sources + Auto feed sorted by newest
- Change interests from the main feed
- Clear Topic + Field behavior: Topic is the search term, Field guides source categories
- Share papers through the phone share sheet or clipboard fallback
- Copy a simple citation from each paper card
- PDF/full-text/type badges where metadata is available
- Saved papers in local browser storage
- Remove saved papers with a desktop button or a left swipe on mobile
- Optional Google sign-in with Supabase to sync saved papers across devices
- PWA manifest
- Service worker for basic offline caching
- Cloudflare Pages Function proxy with edge caching in `functions/api/proxy.js`

## API usage and caching

The deployed app sends research API requests through `/api/proxy`. The proxy caches successful responses at the Cloudflare edge so many users can share the same API result instead of every phone calling arXiv, PubMed, bioRxiv, and medRxiv separately.

Search is strict for multi-term topics. A query like `cd19 car-t` is treated as `cd19` AND `car-t`, and returned papers must mention both terms in title, abstract, journal, authors, or source metadata. PubMed and arXiv also receive stricter AND-style API queries where supported.

Current cache times:

- arXiv: 2 hours
- bioRxiv / medRxiv: 1 hour
- PubMed: 15 minutes

The proxy also supports optional PubMed/NCBI settings through Cloudflare environment variables:

- `NCBI_TOOL`
- `NCBI_EMAIL`
- `NCBI_API_KEY`

For security, the proxy only allows browser requests from your own app origin. If you use a custom domain later, add a
Cloudflare Pages environment variable:

- `ALLOWED_ORIGINS`

Set it to your allowed domains separated by commas, for example:

```text
https://paprfeed.pages.dev,https://www.your-domain.com
```

These are not required for a small test, but they are recommended before a bigger public launch.

## Google sign-in and saved-paper sync

PaprFeed works without login. Saved papers are stored locally in the browser. To sync saved papers across devices, connect Supabase Auth and Database.

### 1. Create a Supabase project

1. Go to `https://supabase.com`.
2. Sign in.
3. Click `New project`.
4. Choose your organization.
5. Project name: `paprfeed`.
6. Create a database password and store it somewhere safe.
7. Choose the closest region.
8. Click `Create new project`.

### 2. Create the saved papers table

1. In Supabase, open your `paprfeed` project.
2. Click `SQL Editor`.
3. Click `New query`.
4. Paste the contents of `supabase-schema.sql`.
5. Click `Run`.

This creates `saved_papers` with Row Level Security, so signed-in users can only access their own saved papers.

If you already created the table earlier, run the latest `supabase-schema.sql` again. It adds extra limits so users can
only store reasonably sized saved-paper records.

### 3. Enable Google login

1. In Supabase, go to `Authentication`.
2. Go to `URL Configuration`.
3. Set `Site URL` to your live PaprFeed URL, for example:

```text
https://paprfeed.pages.dev
```

4. Add the same URL to `Redirect URLs`.
5. Go to `Providers`.
6. Open `Google`.
7. Enable Google.
8. Copy the `Callback URL` shown on the Google provider page. It will look like:

```text
https://your-project-ref.supabase.co/auth/v1/callback
```

9. Go to Google Cloud Console.
10. Create an OAuth client ID with application type `Web application`.
11. Under `Authorized JavaScript origins`, add your live PaprFeed origin:

```text
https://paprfeed.pages.dev
```

12. Under `Authorized redirect URIs`, add the Supabase callback URL from step 8.
13. Copy the Google `Client ID` and `Client Secret`.
14. Go back to Supabase's Google provider page.
15. Paste the Client ID and Client Secret.
16. Save.

Use your real Cloudflare Pages URL if it is different from `https://paprfeed.pages.dev`.

### 4. Add Supabase URL and anon key

1. In Supabase, go to `Project Settings`.
2. Go to `API`.
3. Copy the `Project URL`.
4. Copy the `anon public` key.
5. Open `supabase-config.js`.
6. Paste them:

```js
export const SUPABASE_URL = "https://your-project-ref.supabase.co";
export const SUPABASE_ANON_KEY = "your-anon-public-key";
```

The anon key is meant to be public. Do not paste the service role key into this app.

### Security notes

- Never put the Supabase `service_role` key into this app or GitHub.
- Keep Row Level Security enabled for every public Supabase table.
- The Cloudflare `_headers` file adds browser security headers, including a Content Security Policy.
- The privacy page explains what is stored locally and what is synced after Google sign-in.

### 5. Deploy again

Upload/push these files to GitHub:

- `_headers`
- `.gitignore`
- `index.html`
- `styles.css`
- `app.js`
- `sw.js`
- `privacy.html`
- `supabase-config.js`
- `supabase-schema.sql`
- `README.md`

Cloudflare Pages should redeploy automatically. Then open the live app, click `Saved`, and use `Sign in`.

## Free deployment path

When you are ready to put the app online:

1. Create a GitHub account if you do not already have one.
2. Create a new GitHub repository.
3. Upload this `paprfeed-pwa` folder.
4. Create a free Cloudflare account.
5. Go to Cloudflare Pages.
6. Connect the GitHub repository.
7. Set the project root to this folder.
8. Leave the build command empty.
9. Set the output directory to `/`.
10. Deploy.

After deployment, the app will use `/api/proxy` for the research APIs. Locally, it calls the APIs directly.

## Later iOS app path

The web app can later be wrapped with Capacitor and opened in Xcode. Publishing to the App Store requires an Apple Developer Program account.
