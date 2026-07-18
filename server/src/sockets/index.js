import { Server } from 'socket.io';
import { verifyToken } from '../config/jwt.js';
import Room from '../models/Room.js';

const EVENTS = {
    JOIN: 'room:join',
    JOINED: 'room:joined',
    ROSTER: 'room:roster',
    LEFT: 'room:left',
    CODE_CHANGE: 'code:change', // client -> server proposed edit
    CODE_ACCEPTED: 'code:accepted', // server -> all: edit applied, new version
    CODE_REJECTED: 'code:rejected', // server -> sender only: stale version, here's the truth
};

// socketId -> { userId, username, roomId }
const presence = new Map();

export function initSockets(httpServer, corsOrigin) {
    const io = new Server(httpServer, { cors: { origin: corsOrigin } });

    // Auth happens at the handshake, not via a query-string username —
    // an unauthenticated socket never gets a connection at all.
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('unauthorized'));
        try {
            const payload = verifyToken(token);
            socket.user = { id: payload.sub, username: payload.username };
            next();
        } catch (err) {
            next(new Error('unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        socket.on(EVENTS.JOIN, async ({ roomId }) => {
            const room = await Room.findOne({ roomId });
            if (!room) {
                socket.emit('error:message', 'Room does not exist');
                return;
            }

            socket.join(roomId);
            presence.set(socket.id, {
                userId: socket.user.id,
                username: socket.user.username,
                roomId,
                joinedAt: Date.now(),
            });

            // Server sends the authoritative, persisted state directly —
            // it does not depend on another connected peer to relay it.
            socket.emit(EVENTS.JOINED, {
                code: room.code,
                version: room.version,
            });

            broadcastRoster(io, roomId);
            socket.to(roomId).emit('room:presence', {
                type: 'join',
                username: socket.user.username,
            });
        });

        socket.on(EVENTS.CODE_CHANGE, async ({ roomId, code, baseVersion }) => {
            // Atomic compare-and-swap: the filter requires the document to
            // still be at `baseVersion` at the moment MongoDB applies the
            // update. This closes a race that a naive findOne -> mutate ->
            // save would have — two near-simultaneous writes reading the
            // same version and both believing they're valid. With
            // findOneAndUpdate, MongoDB itself guarantees only one of them
            // can match and apply; the other simply finds no matching
            // document and falls through to the rejection path below.
            const updated = await Room.findOneAndUpdate(
                { roomId, version: baseVersion },
                {
                    $set: { code, lastActiveAt: new Date() },
                    $inc: { version: 1 },
                },
                { new: true }
            );

            if (!updated) {
                // Either the room doesn't exist, or baseVersion was stale —
                // fetch the authoritative current state so the client can
                // reconcile instead of silently losing the edit.
                const current = await Room.findOne({ roomId });
                if (!current) return;
                socket.emit(EVENTS.CODE_REJECTED, {
                    code: current.code,
                    version: current.version,
                });
                return;
            }

            io.to(roomId).emit(EVENTS.CODE_ACCEPTED, {
                code: updated.code,
                version: updated.version,
                from: socket.user.username,
            });
        });

        socket.on('disconnect', () => {
            const info = presence.get(socket.id);
            if (!info) return;
            presence.delete(socket.id);

            socket.to(info.roomId).emit(EVENTS.LEFT, {
                username: info.username,
            });
            broadcastRoster(io, info.roomId);
        });
    });

    return io;
}

function broadcastRoster(io, roomId) {
    const roster = [...presence.values()]
        .filter((p) => p.roomId === roomId)
        .map((p) => ({ username: p.username, joinedAt: p.joinedAt }));
    io.to(roomId).emit(EVENTS.ROSTER, roster);
}

export { EVENTS };