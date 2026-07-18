import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    throw new Error('JWT_SECRET is not set');
}
const EXPIRES_IN = '7d';

export function signToken(user) {
    return jwt.sign({ sub: user._id.toString(), username: user.username }, SECRET, {
        expiresIn: EXPIRES_IN,
    });
}

export function verifyToken(token) {
    return jwt.verify(token, SECRET); // throws if invalid/expired
}