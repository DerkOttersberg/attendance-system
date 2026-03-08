# Security Checklist (v2.0.0)

This document explains the current security model and lists the recommended steps for production hardening.

## Current Security Model

- Authentication uses a JWT stored in an HTTP-only cookie (`auth_token`).
- Passwords are stored as bcrypt hashes in the database.
- Login is case-insensitive for the username field.
- Rate limiting is applied to all `/api` routes, with a stricter limiter for login.
- Login lockout/backoff is in-memory and keyed by IP + username.
- CORS allows configured origins, and in development it permits any origin to avoid local testing blocks.
- Admin access is enforced server-side for protected `/api` endpoints.

## What Is NOT Stored in the Frontend

- No passwords are stored in the frontend.
- No API keys are stored in the frontend.
- Auth tokens are not accessible to JavaScript because the cookie is HTTP-only.

## Production Checklist

1. Set strong secrets
   - `JWT_SECRET`: long random string
   - `ADMIN_PASSWORD_HASH`: bcrypt hash of the admin password
   - Do not use the default `admin123` in production
   - Location: `backend/` (see `backend/src/server.ts`)

2. Enforce HTTPS
   - Use HTTPS so cookies are encrypted in transit
   - Keep `NODE_ENV=production` so cookies are `secure`
   - Location: `backend/` (see `backend/src/server.ts`)

3. Lock down CORS
   - Set `FRONTEND_ORIGIN` to the exact production UI origin(s)
   - Do not allow `*` in production
   - Location: `backend/` (see `backend/src/server.ts`)

4. Harden rate limits
   - Consider persistent rate limiting (Redis) if internet-facing
   - Monitor `429` responses and login lockouts
   - Location: `backend/` (see `backend/src/server.ts`)

5. Environment and deployment
   - Run the backend on a private network when possible
   - Restrict inbound ports to the API and UI only
   - Ensure backups of the database
   - Location: `backend/` (runtime + deployment config)

6. Logging and monitoring
   - Log auth failures (without passwords)
   - Monitor unusual login attempts
   - Location: `backend/` (add server logging)

7. Data hygiene
   - Remove unused accounts
   - Rotate admin credentials periodically
   - Location: `backend/` (admin creds) + database

## Optional Improvements

- Add multi-factor authentication (MFA) for admin
- Add account lockout notifications
- Add audit log exports

## Where to Configure

- Backend env vars: `.env` or service environment
- Frontend env vars: `.env.local` for `NEXT_PUBLIC_API_BASE`

