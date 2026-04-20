# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev      # Start dev server with hot reload on http://localhost:3000
bun run src/index.ts  # Run without watch mode
```

No test suite is configured yet (`test` script exits with error).

## Architecture

This is a minimal [Elysia](https://elysiajs.com/) API running on [Bun](https://bun.sh/). The entire app lives in `src/index.ts` — a single Elysia instance with routes chained directly on the app object.

**Key pattern:** Routes are defined by chaining `.get()`, `.post()`, etc. on the `Elysia` instance before `.listen(3000)`. The server object is available via `app.server` after listen is called.

**Runtime:** Bun (not Node.js). Use `bun-types` for type definitions. TypeScript strict mode is enabled.
