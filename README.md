# Monorepo Implementation Guide

A complete guide for building a modern monorepo using:

- Turborepo
- PNPM
- React + Vite + TypeScript
- Hono
- Prisma ORM
- Better Auth

---

# Architecture

```text
root/
├── apps/
│   ├── web/          # React + Vite frontend
│   └── api/          # Hono backend
├── packages/
│   └── db/           # Shared Prisma package
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

# Step 1: Initialize Turborepo

Create a new project:

```bash
npx create-turbo@latest
```

Choose:

- Project name: `sms-app` (or your preferred name)
- Package Manager: `pnpm`

## Remove Example Apps

```bash
rm -rf apps/web apps/docs
rm -rf packages/ui
```

## Update `turbo.json`

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"],
      "env": ["VITE_*"]
    }
  },
  "globalEnv": ["CORS_ORIGIN", "DATABASE_URL", "VITE_API_URL"]
}
```

### Why?

- `dist/**` works for both Vite and Hono builds.
- `VITE_*` automatically exposes Vite environment variables.
- `globalEnv` makes variables available across packages.

---

# Step 2: Create Frontend and Backend Apps

## Frontend (React + Vite)

```bash
pnpm create vite@latest apps/web --template react-ts
```

## Backend (Hono)

```bash
pnpm create hono apps/api
```

Choose:

- Runtime: `nodejs`
- Install dependencies: `No`

---

# Step 3: Configure Package Names

## apps/web/package.json

```json
{
  "name": "@repo/web"
}
```

## apps/api/package.json

```json
{
  "name": "@repo/api"
}
```

Add development script:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts"
  }
}
```

---

# Step 4: Share Types Between Apps

## Backend Package

Add:

```json
{
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

## Frontend Package

Add dependency:

```json
{
  "dependencies": {
    "@repo/api": "workspace:*"
  }
}
```

Install:

```bash
pnpm install
```

Alternative:

```bash
pnpm --filter @repo/web add @repo/api --workspace
```

---

# Step 5: Install Runtime Dependencies

## Frontend

```bash
pnpm --filter @repo/web add hono
```

## Backend

```bash
pnpm --filter @repo/api add @hono/node-server dotenv
```

## Backend TypeScript Configuration

`apps/api/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "types": ["node"],
    "rootDir": "src/",
    "outDir": "./dist"
  },
  "exclude": ["node_modules"]
}
```

---

# Step 6: Create Hono API

## Backend

`apps/api/src/index.ts`

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';

import 'dotenv/config';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

const routes = app.get('/api/hello', (c) => {
  return c.json({
    status: 'success',
    message: 'Welcome from Hono Backend!',
  });
});

export type AppTypes = typeof routes;

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server running on ${info.port}`);
  },
);
```

## Frontend

```ts
import { hc } from 'hono/client';
import type { AppTypes } from '@repo/api';

const client = hc<AppTypes>(
  import.meta.env.VITE_API_URL || 'http://localhost:3000',
);
```

---

# Step 7: Run Development Environment

```bash
pnpm dev
```

Applications:

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:3000 |

---

# Step 8: Create Shared Prisma Package

Create package:

```bash
mkdir -p packages/db
```

`packages/db/package.json`

```json
{
  "name": "@repo/db",
  "version": "0.0.0",
  "type": "module"
}
```

Install workspace:

```bash
pnpm install
```

Add scripts:

```json
{
  "scripts": {
    "build": "prisma generate && tsc",
    "db:migrate": "prisma migrate",
    "db:gen": "prisma generate",
    "db:push": "prisma push",
    "db:studio": "prisma studio"
  }
}
```

---

# Step 9: Configure Prisma

Install:

```bash
pnpm --filter @repo/db add @prisma/client @prisma/adapter-pg pg dotenv

pnpm --filter @repo/db add -D prisma @types/node @types/pg
```

Initialize:

```bash
cd packages/db
pnpm dlx prisma init
```

Configure:

```env
DATABASE_URL=
DIRECT_URL=
```

Example schema:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
```

Generate:

```bash
pnpm --filter @repo/db db:gen
```

---

# Step 10: Export Shared Prisma Client

```ts
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const prismaGlobal = globalThis as unknown as {
  prisma: PrismaClient | null;
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

export const prisma =
  prismaGlobal.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.prisma = prisma;
}

export * from './generated/prisma/client.js';
```

Usage:

```ts
import { prisma } from '@repo/db';
```

---

# Step 11: Connect Prisma to Hono

Backend dependency:

```json
{
  "dependencies": {
    "@repo/db": "workspace:*"
  }
}
```

Install:

```bash
pnpm install
```

Example route:

```ts
app.get('/api/users', async (c) => {
  const users = await prisma.user.findMany();

  return c.json({
    status: 'success',
    users,
  });
});
```

---

# Step 12: Display Database Data in React

```ts
import type { InferResponseType } from 'hono/client';

type UsersResponse = InferResponseType<typeof client.api.users.$get>;
```

Fetch users:

```ts
const getUsers = async () => {
  const res = await client.api.users.$get();
  const data = await res.json();
  setUsers(data.users);
};
```

Open Prisma Studio:

```bash
pnpm --filter @repo/db db:studio
```

---

# Step 13: Install Better Auth

Install:

```bash
pnpm --filter @repo/api add better-auth @better-auth/prisma-adapter
```

Environment variables:

```env
BETTER_AUTH_SECRET=secret-key-here
BETTER_AUTH_URL=http://localhost:3000
```

Create:

```ts
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
  },

  plugins: [admin()],

  trustedOrigins: [process.env.CORS_ORIGIN || 'http://localhost:5173'],
});
```

---

# Step 14: Update Prisma Schema for Better Auth

Replace the simple User model with:

- User
- Session
- Account
- Verification

Add:

- role
- banned
- banReason
- banExpires

Run:

```bash
pnpm --filter @repo/db db:push
pnpm --filter @repo/db db:gen
```

---

# Step 15: Register Better Auth Routes

```ts
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));
```

Protected route example:

```ts
routes.get('/api/test/user', async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ message: 'Access denied' }, 401);
  }

  return c.json({
    message: 'Access granted',
    role: session.user.role,
  });
});
```

---

# Step 16: Configure Better Auth Client

Install:

```bash
pnpm --filter @repo/web add better-auth
```

`auth-client.ts`

```ts
import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',

  plugins: [adminClient()],
});
```

---

# Step 17: Authentication Testing

Available features:

- User Registration
- User Login
- User Logout
- Session Management
- Admin Role Detection

Example:

```ts
await authClient.signUp.email({
  email,
  password,
  name: 'New user',
});

await authClient.signIn.email({
  email,
  password,
});

await authClient.signOut();
```

---

# Step 18: Deploying to vercel

Available features:

- Vercel Configuration
- Environment Variables

vercel.json:

```ts
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

turbo.json:

```ts
{
  "globalEnv": [
    "CORS_ORIGIN",
    "DATABASE_URL",
    "VITE_API_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL"
  ]
}
```

---

# Summary

This monorepo architecture provides:

- ✅ Turborepo orchestration
- ✅ PNPM workspaces
- ✅ React + Vite frontend
- ✅ Hono backend
- ✅ Shared TypeScript types
- ✅ Shared Prisma package
- ✅ PostgreSQL support
- ✅ Better Auth authentication
- ✅ Admin role management
- ✅ End-to-end type safety
- ✅ Production-ready structure
- ✅ Vercel deployment ready

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
