# Design notes

## Why rewrite the sync layer instead of just adding auth on top?

The original reference implementation this project started from kept all
room/code state in memory, trusted a client-supplied username with no
verification, and synced code by having the server blindly re-broadcast
whatever the last writer sent (last-write-wins, no conflict detection).
That's fine for a demo, but it means: state is lost on server restart,
anyone can claim to be anyone, and two people typing at once can silently
stomp on each other with no indication anything went wrong.

This version changes the actual architecture, not just the surface:

## Auth: JWT at the socket handshake, not a query-string username

Socket.IO connections authenticate via a JWT passed in `socket.handshake.auth`,
verified in `io.use()` middleware before the connection is ever accepted —
an invalid/missing token never reaches a room. This replaces "trust whatever
username string the client sends" with a real identity tied to a hashed
password in MongoDB.

## Persistence: rooms are DB rows, not in-memory objects

`Room` documents store the current code and a `version` counter. On join,
a client gets state directly from the database via the server — it does
not depend on another connected peer happening to relay their local buffer,
which was the original's approach (`SYNC_CODE` asked an existing peer to
send its buffer to the newcomer). This also means a room survives a server
restart and two people can be in the same room hours apart without one of
them needing to already be connected.

## Conflict handling: optimistic concurrency control, not blind broadcast

Every code-change event carries the `version` the client last saw
(`baseVersion`). The server only applies the edit if `baseVersion` still
matches the room's current version — i.e., nobody else has written since.
If it's stale, the server rejects the write and sends the client the
current authoritative code + version so it can reconcile, instead of
silently overwriting one person's edit with another's.

**Tradeoff, stated explicitly (this is the honest limit of this design):**
this is not a CRDT or OT — it doesn't merge concurrent edits character by
character. Under real simultaneous typing from multiple people it will
reject and force a resync rather than merge intelligently. That's a
deliberate simplicity-vs-correctness tradeoff: optimistic concurrency
control (similar to a compare-and-swap, or an ETag on a REST PUT) is
something I can reason about and guarantee is correct; a hand-rolled CRDT
in this timeframe would be much more likely to have subtle bugs. A real
production version of this would move to Yjs (CRDT) once maintaining a
correct merge algorithm becomes worth the complexity.

## Conflict handling, take two: from find-then-save to an atomic compare-and-swap

The first version of `code:change` did `Room.findOne` → mutate the
document in JS → `.save()`. That has a check-then-act race: two edits
arriving close together can both read the same `version`, both believe
they're valid, and one `.save()` can silently overwrite the other's —
a race that exists even server-side, independent of any client bug.

It also showed up as a *self*-conflict for a single fast-typing user:
the client emitted an edit on every keystroke using whatever version it
last knew about, but if a second keystroke fired before the first
edit's server round trip returned, the second edit still carried the
now-stale version and got rejected — a conflict with no other user
involved at all.

Two fixes, one on each side:

- **Server**: replaced the read-then-write with `Room.findOneAndUpdate`
  filtered on `{ roomId, version: baseVersion }`. MongoDB applies this
  atomically — only one concurrent request can match a given version at
  a time, and the loser simply finds no matching document rather than
  racing on an in-application mutation. This is a proper compare-and-swap,
  not just "check first."
- **Client**: debounced outgoing edits (200ms) and optimistically advances
  its local version the moment it sends, rather than waiting for the
  round trip. This is safe specifically because Socket.IO preserves
  message order on a single connection — my own successive edits are
  guaranteed to arrive in the order I sent them, so assuming the first
  one succeeds before sending the second one is a valid assumption for a
  single writer. If another user's edit genuinely interleaves, the
  server's atomic check still catches it correctly and `code:rejected`
  reconciles the client back to the true state.

## What I'd change with more time

- Rate limiting on code-change events per socket
- Presence/cursor position as a separate, non-persisted ephemeral channel
- Horizontal scaling: currently `presence` is an in-memory Map, which
  only works with a single server instance. Scaling to multiple instances
  would need a shared store (Redis) for presence and a pub/sub layer for
  cross-instance broadcast.