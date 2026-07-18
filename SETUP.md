# codeledger — setup

A real-time collaborative code editor: JWT auth, MongoDB-persisted rooms,
optimistic-concurrency code sync. See `server/DESIGN.md` for the
architecture decisions and tradeoffs — read that before an interview.

## 1. Server

```
cd server
cp .env.example .env      # edit JWT_SECRET, MONGO_URI if needed
npm install
npm run dev               # requires MongoDB running locally, or set MONGO_URI to Atlas
```

Runs on http://localhost:4000. Health check: `GET /health`.

## 2. Client

```
cd client
cp .env.example .env
npm install
npm start
```

Runs on http://localhost:3000.

## 3. Try it

1. Open two browser windows (or one normal + one incognito, since auth
   tokens are stored in localStorage per-browser-profile).
2. Register two different users, one per window.
3. In window A: create a room, copy the room ID.
4. In window B: paste the room ID, join.
5. Type in either editor — changes should sync live, and the session log
   in the sidebar should show join/sync events.
6. To see the conflict path fire: throttle your network in devtools, or
   just type fast in both windows near-simultaneously — one write will
   occasionally get rejected and resynced. This is expected and is the
   optimistic-concurrency-control path described in DESIGN.md.

## What's genuinely new vs. the reference project this started from

- JWT auth at the socket handshake (not a typed username)
- MongoDB persistence for rooms — state survives server restarts
- Version-checked (optimistic concurrency) sync instead of blind
  last-write-wins broadcast, with an explicit rejection/resync path
- Server-authoritative state on join (fetched from the DB directly,
  not relayed from another connected peer)
- Redesigned UI (terminal-ledger theme) with a live session log

`components/Editor.js`'s CodeMirror wiring and the general React-Router
page-based structure are the parts closest in spirit to the original —
everything about identity, persistence, and conflict handling is new.