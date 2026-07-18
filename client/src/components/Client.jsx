import React from 'react';

// deterministic accent per username so the same person keeps the same color
// across a session, without needing an external avatar service.
const PALETTE = ['#FFB627', '#2EC4B6', '#EF6461', '#9AA4C0', '#E4D9B0'];

function colorFor(name = '') {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFor(name = '') {
    return name.trim().slice(0, 2).toUpperCase() || '?';
}

const Client = ({ username, joinedAt }) => {
    return (
        <div className="client">
            <div
                className="clientBadge"
                style={{ background: colorFor(username) }}
            >
                {initialsFor(username)}
            </div>
            <div className="clientMeta">
                <span className="userName">{username}</span>
                {joinedAt && <span className="joinedAt">since {joinedAt}</span>}
            </div>
        </div>
    );
};

export default Client;