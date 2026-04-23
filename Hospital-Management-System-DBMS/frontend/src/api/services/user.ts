// src/api/services/user.ts
import apiClient from "../client";
import type { CreateAccountFormValues, DoctorInfo, PatientInfo } from "../types/user";

export const UserService = {
    login: async (email: string, password: string): Promise<void> => {
        return apiClient.post("/login", { email, password });
    },
    verify: async (): Promise<number> => {
        const data = (await apiClient.post("/verify")).data;
        return data.role;
    },
    role_patient: async (): Promise<PatientInfo> => {
        const req = await apiClient.get("/role");
        return req.data;
    },
    role_doctor: async (): Promise<DoctorInfo> => {
        const req = await apiClient.get("/role");
        return req.data;
    },
    change_pwd: async (
        old_password: string,
        new_password: string,
    ): Promise<any> => {
        const req = await apiClient.post("/change_password", {
            old_password,
            new_password,
        });
        return req.data;
    },
    register: async (data: CreateAccountFormValues): Promise<any> => {
        const req = await apiClient.post("/register", data);
        return req.data;
    },
};
