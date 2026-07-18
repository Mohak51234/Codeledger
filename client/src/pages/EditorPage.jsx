import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import Client from '../components/Client.jsx';
import Editor from '../components/Editor.jsx';
import { createSocket } from '../socket';
import { useAuth } from '../context/AuthContext.jsx';

const timeNow = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const EditorPage = () => {
    const { roomId } = useParams();
    const { auth } = useAuth();
    const navigate = useNavigate();

    const socketRef = useRef(null);
    const editorApiRef = useRef(null);
    const versionRef = useRef(0);
    const debounceRef = useRef(null);

    const [clients, setClients] = useState([]);
    const [log, setLog] = useState([]);

    const pushLog = (tag, message) => {
        setLog((prev) =>
            [
                ...prev,
                { tag, message, time: timeNow(), id: `${Date.now()}-${Math.random()}` },
            ].slice(-50)
        );
    };

    useEffect(() => {
        const socket = createSocket(auth.token);
        socketRef.current = socket;

        socket.on('connect_error', () => {
            toast.error('Could not connect — check you are signed in');
            navigate('/');
        });

        socket.on('error:message', (msg) => {
            toast.error(msg);
            navigate('/');
        });

        socket.emit('room:join', { roomId });

        socket.on('room:joined', ({ code, version }) => {
            versionRef.current = version;
            editorApiRef.current?.setCode(code);
            pushLog('join', `you joined as ${auth.username}`);
        });

        socket.on('room:roster', (roster) => setClients(roster));

        socket.on('room:presence', ({ username }) => {
            toast.success(`${username} joined the room`);
            pushLog('join', `${username} joined`);
        });

        socket.on('room:left', ({ username }) => {
            toast.success(`${username} left the room`);
            pushLog('leave', `${username} left`);
        });

        socket.on('code:accepted', ({ code, version, from }) => {
            versionRef.current = version;
            if (from !== auth.username) {
                editorApiRef.current?.setCode(code);
            }
            pushLog('sync', `${from} edited (v${version})`);
        });

        socket.on('code:rejected', ({ code, version }) => {
            versionRef.current = version;
            editorApiRef.current?.setCode(code);
            toast('Someone edited at the same time — synced to latest', {
                icon: '⚠️',
            });
            pushLog('sync', `conflict — resynced to v${version}`);
        });

        return () => socket.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    const handleLocalChange = (code) => {
        // Coalesce rapid keystrokes into one round trip instead of one
        // network + DB write per character — this is also what keeps a
        // single fast-typing user from racing their own unacknowledged edits.
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const baseVersion = versionRef.current;
            socketRef.current?.emit('code:change', { roomId, code, baseVersion });

            // Optimistically assume this edit will be accepted, rather than
            // waiting for the round trip to update our version. This is safe
            // because Socket.IO preserves message order on a single
            // connection, so our own successive edits arrive at the server
            // in the order we sent them. If another user's edit genuinely
            // interleaves before ours lands, the server's compare-and-swap
            // will still correctly reject us — `code:rejected` then
            // reconciles versionRef.current back to the true value.
            versionRef.current = baseVersion + 1;
        }, 200);
    };

    async function copyRoomId() {
        await navigator.clipboard.writeText(roomId);
        toast.success('Room ID copied to clipboard');
    }

    function leaveRoom() {
        navigate('/');
    }

    return (
        <div className="mainWrap">
            <div className="aside">
                <div className="asideInner">
                    <div className="brandMark">
                        &gt;_ codeledger<span className="cursor" />
                    </div>
                    <h3>Connected — {clients.length}</h3>
                    <div className="clientsList">
                        {clients.map((c) => (
                            <Client
                                key={c.username}
                                username={c.username}
                                joinedAt={new Date(c.joinedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            />
                        ))}
                    </div>

                    <h3>Session log</h3>
                    <div className="sessionLog">
                        {log.map((entry) => (
                            <div key={entry.id} className={`logLine ${entry.tag}`}>
                                <span className="logTime">{entry.time}</span>
                                <span className="logTag">
                                    {entry.tag === 'join' ? '+' : entry.tag === 'leave' ? '−' : '~'}
                                </span>
                                <span>{entry.message}</span>
                            </div>
                        ))}
                        <span className="logCursor" />
                    </div>
                </div>
                <button className="btn copyBtn" onClick={copyRoomId}>
                    Copy room id
                </button>
                <button className="btn leaveBtn" onClick={leaveRoom}>
                    Leave session
                </button>
            </div>
            <div className="editorWrap">
                <Editor ref={editorApiRef} onLocalChange={handleLocalChange} />
            </div>
        </div>
    );
};

export default EditorPage;
