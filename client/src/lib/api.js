const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, { method = 'GET', body, token } = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
}

export const api = {
    register: (username, password) =>
        request('/auth/register', { method: 'POST', body: { username, password } }),

    login: (username, password) =>
        request('/auth/login', { method: 'POST', body: { username, password } }),

    createRoom: (token) =>
        request('/rooms', { method: 'POST', token }),

    getRoom: (roomId, token) =>
        request(`/rooms/${roomId}`, { token }),
};