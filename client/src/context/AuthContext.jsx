import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'codeledger.auth';

function loadStored() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function AuthProvider({ children }) {
    const [auth, setAuth] = useState(loadStored); // { token, username } | null

    const persist = (value) => {
        setAuth(value);
        if (value) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    const login = useCallback(async (username, password) => {
        const data = await api.login(username, password);
        persist({ token: data.token, username: data.username });
    }, []);

    const register = useCallback(async (username, password) => {
        const data = await api.register(username, password);
        persist({ token: data.token, username: data.username });
    }, []);

    const logout = useCallback(() => persist(null), []);

    return (
        <AuthContext.Provider value={{ auth, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}