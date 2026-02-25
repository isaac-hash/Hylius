"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface User {
    id: string;
    email: string;
    role: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
}

interface AuthContextType {
    token: string | null;
    user: User | null;
    organization: Organization | null;
    isLoading: boolean;
    login: (token: string, user: User, org: Organization) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const fetchMe = async (currentToken: string) => {
        try {
            const res = await fetch("/api/auth/me", {
                headers: {
                    Authorization: `Bearer ${currentToken}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                setOrganization(data.organization);
            } else {
                localStorage.removeItem("hylius_token");
                setToken(null);
            }
        } catch (error) {
            console.error("Failed to fetch user context", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const storedToken = localStorage.getItem("hylius_token");
        if (storedToken) {
            setToken(storedToken);
            fetchMe(storedToken).catch(console.error);
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = (newToken: string, newUser: User, newOrg: Organization) => {
        localStorage.setItem("hylius_token", newToken);
        setToken(newToken);
        setUser(newUser);
        setOrganization(newOrg);
        router.push("/");
    };

    const logout = () => {
        localStorage.removeItem("hylius_token");
        setToken(null);
        setUser(null);
        setOrganization(null);
        router.push("/login");
    };

    const checkAuth = async () => {
        if (token) {
            await fetchMe(token);
        }
    };

    return (
        <AuthContext.Provider value={{ token, user, organization, isLoading, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
