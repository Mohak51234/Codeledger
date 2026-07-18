import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Register = () => {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await register(username, password);
            navigate('/');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="homePageWrapper">
            <form className="formWrapper" onSubmit={submit}>
                <div className="brandMark">
                    &gt;_ codeledger<span className="cursor" />
                </div>
                <h4 className="mainLabel">Create an account</h4>

                <div className="inputGroup">
                    <div className="promptRow">
                        <span className="prefix">user</span>
                        <input
                            className="inputBox"
                            placeholder="pick a username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="promptRow">
                        <span className="prefix">pass</span>
                        <input
                            className="inputBox"
                            type="password"
                            placeholder="min 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button className="btn joinBtn" type="submit" disabled={busy}>
                        {busy ? 'Creating…' : 'Create account →'}
                    </button>

                    <span className="createInfo">
                        Already have one?&nbsp;
                        <Link to="/login" className="createNewBtn">
                            sign in
                        </Link>
                    </span>
                </div>
            </form>
        </div>
    );
};

export default Register;