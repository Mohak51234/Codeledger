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
    PRESENCE: 'room:presence', // server -> all: someone joined
};

// roomId -> a promise chain of pending writes for that room. findOneAndUpdate
// is atomic per-call, but nothing guarantees two calls issued close together
// (even from the same client) reach MongoDB and commit in the order they
// were sent -- the driver's connection pool can let them race. Funneling
// every write for a given room through this queue forces them to actually
// execute one at a time, in arrival order, which is what the client's
// optimistic version bump assumes is true.
const roomWriteQueues = new Map();

function runSerialized(roomId, task) {
    const previous = roomWriteQueues.get(roomId) || Promise.resolve();
    const next = previous.then(task, task); // run even if the prior write errored
    // swallow errors here so the queue itself never gets stuck rejected;
    // the actual error is still handled/returned by `task` itself
    roomWriteQueues.set(roomId, next.catch(() => {}));
    return next;
}

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
            socket.roomId = roomId; // track which room this socket is in for disconnect handling
            socket.joinedAt = Date.now(); // track when this socket joined for roster info

            // Server sends the authoritative, persisted state directly —
            // it does not depend on another connected peer to relay it.
            socket.emit(EVENTS.JOINED, {
                code: room.code,
                version: room.version,
            });

            broadcastRoster(io, roomId);
            socket.to(roomId).emit(EVENTS.PRESENCE, {
                type: 'join',
                username: socket.user.username,
            });
        });

        socket.on(EVENTS.CODE_CHANGE, async ({ roomId, code, baseVersion }) => {

            await runSerialized(roomId, async () => {
                const updated = await Room.findOneAndUpdate(
                    { roomId, version: baseVersion },
                    {
                        $set: { code, lastActiveAt: new Date() },
                        $inc: { version: 1 },
                    },
                    { new: true }
                );

                if (!updated) {
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
        });

        socket.on('disconnect', async () => {
            if (!socket.roomId) return;

            socket.to(socket.roomId).emit(EVENTS.LEFT, {
                username: socket.user.username,
            });

            await broadcastRoster(io, socket.roomId);
        });
    });

    return io;
}

async function broadcastRoster(io, roomId) {
    const sockets = await io.in(roomId).fetchSockets();
    const roster = sockets.map((s) => ({
        username: s.user.username,
        joinedAt: s.joinedAt,
    }));
    io.to(roomId).emit(EVENTS.ROSTER, roster);
}

export { EVENTS };