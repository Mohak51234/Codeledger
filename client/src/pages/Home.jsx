import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const Home = () => {
    const navigate = useNavigate();
    const { auth, logout } = useAuth();
    const [roomId, setRoomId] = useState('');
    const [busy, setBusy] = useState(false);

    const createNewRoom = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const { roomId: newId } = await api.createRoom(auth.token);
            toast.success('New room created');
            navigate(`/editor/${newId}`);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const joinRoom = () => {
        if (!roomId) {
            toast.error('Room ID is required');
            return;
        }
        navigate(`/editor/${roomId}`);
    };

    const handleInputEnter = (e) => {
        if (e.code === 'Enter') joinRoom();
    };

    return (
        <div className="homePageWrapper">
            <div className="formWrapper">
                <div className="brandMark">
                    &gt;_ codeledger<span className="cursor" />
                </div>
                <h4 className="mainLabel">signed in as {auth.username}</h4>

                <div className="inputGroup">
                    <div className="promptRow">
                        <span className="prefix">room</span>
                        <input
                            type="text"
                            className="inputBox"
                            placeholder="paste an invite id"
                            onChange={(e) => setRoomId(e.target.value)}
                            value={roomId}
                            onKeyUp={handleInputEnter}
                        />
                    </div>

                    <button className="btn joinBtn" onClick={joinRoom}>
                        Join session →
                    </button>

                    <span className="createInfo">
                        No invite?&nbsp;
                        <a onClick={createNewRoom} href="/" className="createNewBtn">
                            {busy ? 'creating…' : 'start a new room'}
                        </a>
                    </span>
                    <span className="createInfo">
                        <a
                            onClick={(e) => {
                                e.preventDefault();
                                logout();
                            }}
                            href="/"
                            className="createNewBtn"
                        >
                            sign out
                        </a>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Home;