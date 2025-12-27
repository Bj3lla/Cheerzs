# React + Vite

This application uses React working in Vite with HMR and some ESLint rules. Vercel is used for hosting the webapplication, and is linked to the GitHub repository, so whenever a an update is pushed to main, Vercel auto-deploys this change.  

## Important terminal commands
npm install -> to install dependencies
npm install ably 
npm run dev -> runs localhost
npm run dev:vercel -> runs Vercel dev server (serves /api/*)
npm run build -> updates build for later deployment

## Local testing of /api routes
- When you run `npm run dev` (Vite on http://localhost:5173), Vercel serverless functions in `api/` are NOT served, so `/api/create-room` will return 404.
- To test `api/create-room.js` and `api/join-room.js` locally, run `npm run dev:vercel` and use the URL it prints (commonly http://localhost:3000).

## Environment variables
- Environment variables you set in Vercel are available in production, but not automatically on your machine.
- To use the same env vars locally, run `npx vercel env pull .env.local` then restart `npm run dev:vercel`.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
