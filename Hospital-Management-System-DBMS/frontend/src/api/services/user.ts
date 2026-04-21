// src/api/services/user.ts
import apiClient from "../client";

export const UserService = {
    login: async (email: string, password: string): Promise<void> => {
        return apiClient.post("/login", { email, password });
    },
    verify: async (): Promise<number> => {
        const data = (await apiClient.post('/verify')).data;
        return data.role;
    },
};