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
- Change interests from the main feed
- Clear Topic + Field behavior: Topic is the search term, Field guides source categories
- Share papers through the phone share sheet or clipboard fallback
- PDF/full-text/type badges where metadata is available
- Saved papers in local browser storage
- PWA manifest
- Service worker for basic offline caching
- Cloudflare Pages Function proxy with edge caching in `functions/api/proxy.js`

## API usage and caching

The deployed app sends research API requests through `/api/proxy`. The proxy caches successful responses at the Cloudflare edge so many users can share the same API result instead of every phone calling arXiv, PubMed, bioRxiv, and medRxiv separately.

Current cache times:

- arXiv: 2 hours
- bioRxiv / medRxiv: 1 hour
- PubMed: 15 minutes

The proxy also supports optional PubMed/NCBI settings through Cloudflare environment variables:

- `NCBI_TOOL`
- `NCBI_EMAIL`
- `NCBI_API_KEY`

These are not required for a small test, but they are recommended before a bigger public launch.

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
