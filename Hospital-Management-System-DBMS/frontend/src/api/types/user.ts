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