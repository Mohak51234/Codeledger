import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import roomsRoutes from './routes/rooms.routes.js';
import { initSockets } from './sockets/index.js';

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

async function main() {
    await connectDB();

    const app = express();
    app.use(cors({ origin: CLIENT_ORIGIN }));
    app.use(express.json());

    app.use('/api/auth', authRoutes);
    app.use('/api/rooms', roomsRoutes);
    app.get('/health', (req, res) => res.json({ ok: true }));

    const httpServer = http.createServer(app);
    initSockets(httpServer, CLIENT_ORIGIN);

    httpServer.listen(PORT, () => {
        console.log(`[server] listening on port ${PORT}`);
    });
}

main().catch((err) => {
    console.error('[server] failed to start', err);
    process.exit(1);
});