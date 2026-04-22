import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { decode, jwt, sign, verify } from "hono/jwt";
import { Users } from "./db/generated";
import { HonoEnv } from "./types";
import { sha256 } from "hono/utils/crypto";
import { UserService } from "./services/user"

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
        console.error(err);
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
                httpOnly: false,
                sameSite: "none",
                secure: true,
                path: "/",
            },
        );
        return c.json({ ok: "ok" });
    }
});

interface CreateAccountFormValues {
  name: string;
  gender: string;
  age: number;
  height: string;
  weight: string;
  conditions?: string;
  surgeries?: string;
  medications?: string;
  address: string;
  email: string;
  password: string;
}

auth.post("/verify", async (c) => {
    if (c.get("authStatus") === "valid") {
        return c.json({ ok: "ok", role: c.get("jwtPayload")?.user.role });
    } else if (c.get("authStatus") === "missing") {
        return c.json({ ok: "ok", role: -1 });
    } else {
        return c.json(
            { error: "Unauthorized", status: c.get("authStatus") },
            401,
        );
    }
});
auth.post("/register", async (c) => {
    try {
        const data = (await c.req.json()) as CreateAccountFormValues;
        const db = c.get("db");
        const password = (await sha256(data.password)) as string;

        const exists = await UserService.findUserByEmail(db, data.email);
        if (exists.length > 0) {
            return c.json({ error: "User already exists" }, 400);
        }

        await UserService.registerUserAsPatient(db, data.email, password, data);
        return c.json({ ok: "ok" });
    } catch (err: any) {
        if (err instanceof SyntaxError) {
            console.error(err);
            return c.json({ error: "Invalid JSON format" }, 400);
        } else {
            console.error(err);
            return c.json({ error: err.message }, 500);
        }
    }
});
auth.get("/role", async (c) => {
    try {
        const db = c.get("db");
        if (c.get("authStatus") === "valid") {
            const data = c.get('jwtPayload')?.user
            const role = data?.role
            const email = data?.email || "";
            switch (role) {
                case 0:
                    const pat = await UserService.selectPatient(db, email);
                    return c.json(pat[0]);
                    break;
                case 1:
                    const doc = await UserService.selectDoctor(db,email);
                    return c.json(doc[0]);
                    break;
                default:
                    break;
            }
        } else {
            throw new Error("Invalid token!");
        }
        return c.json({});
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export { auth };

export { customAuth };
