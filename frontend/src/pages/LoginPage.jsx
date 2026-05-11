import { useState } from "react";
import api from "../api/api";

export default function LoginPage({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        try {
            const res = await api.post("/auth/login", {
                email,
                password
            });

            const token = res.data.token;

            localStorage.setItem("token", token);

            onLogin();
        } catch {
            alert("Login failed");
        }
    };

    return (
        <div>
            <h2>Login</h2>

            <input
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
            />

            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
            />

            <button onClick={handleLogin}>Login</button>
        </div>
    );
}
