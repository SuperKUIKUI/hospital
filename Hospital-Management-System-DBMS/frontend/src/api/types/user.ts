// src/api/types/user.ts
export interface User {
    id: string;
    username: string;
    email: string;
    role: number;
}

export interface UpdateUserDto {
    username?: string;
    avatar?: string;
}

export interface PatientInfo {
    email: string;
    password: string;
    address: string;
    age: number | null;
    gender: string;
    height: string | null;
    name: string;
    weight: string | null;
}