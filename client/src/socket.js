import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export function createSocket(token) {
    return io(SOCKET_URL, {
        auth: { token }, // read by the server's io.use() middleware
        reconnectionAttempts: Infinity,
        transports: ['websocket'],
    });
}