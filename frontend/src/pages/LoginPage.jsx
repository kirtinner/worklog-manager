import { useState } from "react";
import api from "../api/api";

export default function LoginPage({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const canSubmit = email.trim() !== "" && password !== "" && !submitting;

    const handleLogin = async (event) => {
        event.preventDefault();
        if (!canSubmit) {
            return;
        }

        setErrorMessage("");
        setSubmitting(true);

        try {
            const res = await api.post("/auth/login", {
                email,
                password
            });

            const token = res.data.token;

            localStorage.setItem("token", token);

            onLogin();
        } catch (error) {
            setErrorMessage(
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Login failed."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="tracking-modal-overlay login-modal-overlay" role="presentation">
            <form
                className="tracking-modal tracking-modal-confirm tracking-modal-editor login-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="login-title"
                onSubmit={handleLogin}
            >
                <div className="tracking-modal-header">
                    <h3 id="login-title">Sign In</h3>
                </div>

                <div className="tracking-modal-body">
                    <div className="tracking-modal-fields">
                        <label className="tracking-modal-field">
                            <span>User Name</span>
                            <input
                                type="text"
                                autoComplete="username"
                                autoFocus
                                value={email}
                                onChange={event => setEmail(event.target.value)}
                                disabled={submitting}
                            />
                        </label>

                        <label className="tracking-modal-field">
                            <span>Password</span>
                            <input
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={event => setPassword(event.target.value)}
                                disabled={submitting}
                            />
                        </label>
                    </div>

                    {errorMessage ? (
                        <div className="tracking-modal-error login-modal-error">{errorMessage}</div>
                    ) : null}
                </div>

                <div className="tracking-modal-actions">
                    <button type="submit" className="tracking-modal-button" disabled={!canSubmit}>
                        Sign In
                    </button>
                </div>
            </form>
        </div>
    );
}
