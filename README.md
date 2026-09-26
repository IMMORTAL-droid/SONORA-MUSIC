# SONORA

SONORA is a React music discovery app built with Vite and the YouTube Data API.

## Run locally

1. Install Node.js.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and add your YouTube Data API key.
4. Start the development server with `npm run dev`.

## Deploy to Vercel

- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_YOUTUBE_API_KEY` in the Vercel project's environment variables, then redeploy.

Do not commit `.env` or put the key in source code. Vite includes `VITE_` variables in browser code, so restrict the YouTube key in Google Cloud Console to the YouTube Data API and your production site's HTTP referrers.
