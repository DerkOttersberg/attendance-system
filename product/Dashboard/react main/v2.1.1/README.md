# Dashboard (Root)

This repo is split into two apps:

- frontend/ (Next.js UI)
- backend/ (Node/Express API)

## Development

Run both frontend and backend:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

Frontend only:

```bash
npm run dev --prefix frontend
```

Backend only:

```bash
npm run dev --prefix backend
```
