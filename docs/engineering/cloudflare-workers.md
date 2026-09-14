# Cloudflare Workers deployment

Novelndex runs on Cloudflare Workers through Vinext. It preserves the existing Next.js App Router and server rendering; deploy it as a Worker, not as a static Cloudflare Pages site.

Use Node.js 22 or later for the Cloudflare build and local Vinext commands.

## One-time Cloudflare setup

1. Create a Workers application named `novelndex`, or change `name` in `wrangler.jsonc` before the first deployment.
2. In **Workers & Pages → novelndex → Settings → Variables and Secrets**, add these **build variables** from the Firebase web app configuration:

   ```text
   NEXT_PUBLIC_FIREBASE_API_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   NEXT_PUBLIC_FIREBASE_PROJECT_ID
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   NEXT_PUBLIC_FIREBASE_USE_EMULATOR=0
   ```

   They are `NEXT_PUBLIC_` values, so they are bundled into browser JavaScript. They are Firebase identifiers rather than private server credentials; never add a Firebase Admin service account to Workers.
3. Connect the intended production branch in Workers Builds. Set its build command to `corepack pnpm build:cloudflare`, its deploy command to `corepack pnpm exec vinext-cloudflare deploy --config dist/server/wrangler.json`, and its non-production branch deploy command to `corepack pnpm exec wrangler versions upload --config dist/server/wrangler.json`.
4. Add the Workers custom domain after a successful preview deployment.

## Local verification

Use a non-production Firebase project or emulator configuration in `.env.local`:

```powershell
corepack pnpm build:cloudflare
corepack pnpm preview:cloudflare
```

`preview:cloudflare` runs the compiled Worker locally. It does not deploy. `deploy:cloudflare` builds and publishes the Worker, so run it only after validating the preview.

## Release gate

Do not attach a public production domain while `firestore.rules` allows `read, write: if true`. The application has no authentication yet, so those rules would let every visitor read and modify all novel data. Complete Phase 5 authentication and restrictive Firestore rules before public launch.

## Operational notes

- `wrangler.jsonc` enables `nodejs_compat`, which Vinext requires.
- The server uses Firestore Lite rather than the full Firestore SDK because the latter dynamically generates code that Workers reject. Lite supports the app's current one-off reads and writes, but not realtime listeners or offline persistence.
- `NovelCover` disables Next image optimization, so the Worker does not need a Cloudflare Images binding.
- Vinext uses the Workers Cache API for CDN caching and does not require an R2 or KV binding for the current application.
