import { Router } from 'express';
import crypto from 'crypto';
import Room from '../models/Room.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

// Create a new persisted room, owned by the requesting user.
router.post('/', async (req, res) => {
    const roomId = crypto.randomUUID();
    const room = await Room.create({ roomId, createdBy: req.user.sub, code: '' });
    res.status(201).json({ roomId: room.roomId });
});

// Fetch the last-known persisted state of a room (used on join/rejoin
// so a client gets the real server-authoritative code, not just
// whatever another connected peer happens to have in memory).
router.get('/:roomId', async (req, res) => {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ roomId: room.roomId, code: room.code, version: room.version });
});

export default router;