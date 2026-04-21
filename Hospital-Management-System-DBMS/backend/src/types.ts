import { Kysely } from "kysely";
import { DB } from "./db/generated"; // 你的 Kysely 数据库定义

// --- 1. Bindings: 环境变量与外部服务 ---
export interface Bindings {
    DATABASE_URL: string;
    ES256_PRIKEY: string;
    ES256_PUBKEY: string;
    NODE_ENV: "development" | "production";
}

// --- 2. Variables: 请求生命周期内的中间件变量 ---
export interface Variables {
    // JWT 状态
    jwtPayload: {
        sub: number; // 用户ID
        email: string;
        role: number;
    } | null;

    authStatus: "valid" | "invalid" | "missing";
    authError?: string;

    // 也可以存放数据库实例，方便在路由中直接 c.get('db')
    db: Kysely<DB>;
}

// --- 3. 统一封装成 HonoEnv ---
// 这样在实例化 Hono 或写中间件时，只需要引用这一个类型
export type HonoEnv = {
    Bindings: Bindings;
    Variables: Variables;
};
