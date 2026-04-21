import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { decode, jwt, sign, verify } from "hono/jwt";
import { Users } from "./db/generated";
import { HonoEnv } from "./types";
import { sha256 } from "hono/utils/crypto";

const auth = new Hono<HonoEnv>();

const customAuth = createMiddleware<HonoEnv>(async (c, next) => {
    // 1. 从 Cookie 中提取字段名为 auth_token 的 JWT
    const token = getCookie(c, "auth_token");

    if (!token) {
        // 情况 A: Cookie 不存在
        c.set("authStatus", "missing");
        c.set("jwtPayload", null);
        // 注意：这里我们选择继续 next()，让后面的路由决定是否拦截
        await next();
        return;
    }

    try {
        // 2. 验证 JWT 是否有效 (假设使用 ES256)
        const payload = await verify(token, c.env.ES256_PUBKEY, "ES256");

        // 3. 将状态保存在变量里
        c.set("jwtPayload", payload);
        c.set("authStatus", "valid");
    } catch (err: any) {
        // 情况 B: Token 无效或过期
        c.set("authStatus", "invalid");
        c.set("jwtPayload", null);
        c.set("authError", err.message);
    }

    await next();
});

const userSummaryFields = [
    "id",
    "email",
    "role",
    "created_at",
    "updated_at",
] as const;

auth.get("/login", async (c) => c.json({}));
auth.post("/login", async (c) => {
    const { email, password } = await c.req.json();
    const db = c.get("db");
    const users = await db
        .selectFrom("Users")
        .select(userSummaryFields)
        .where("email", "=", email)
        .where("password", "=", await sha256(password))
        .limit(1)
        .execute();
    if (users.length === 0) {
        return c.json({ error: "User not found or Password not correct" }, 401);
    } else {
        const user = users[0];
        setCookie(
            c,
            "auth_token",
            await sign({
              user:user,
              exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
              iat: Math.floor(Date.now() / 1000),
            }, c.env.ES256_PRIKEY, "ES256"),
            {
                httpOnly: true,
            },
        );
        return c.json({ ok: "ok" });
    }
});

export { auth };

export { customAuth };
