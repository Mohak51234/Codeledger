import { Router } from 'express';
import User from '../models/User.js';
import { signToken } from '../config/jwt.js';

const router = Router();

router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password || password.length < 6) {
        return res.status(400).json({
            error: 'Username and a password of at least 6 characters are required',
        });
    }

    const existing = await User.findOne({ username });
    if (existing) {
        return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ username, passwordHash });

    const token = signToken(user);
    res.status(201).json({ token, username: user.username });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || !(await user.verifyPassword(password))) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user);
    res.json({ token, username: user.username });
});

export default router;