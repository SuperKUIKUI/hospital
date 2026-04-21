import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import mysql, { createPool } from "mysql2/promise";
import { createPool as createPool2 } from "mysql2";
import path from "path";
import { Kysely, MysqlDialect } from "kysely";
import { env } from "process";
import { DB } from "./db/generated";
import { HonoEnv } from "./types";
import { config as dotconfig } from "dotenv";
import { auth, customAuth } from "./auth";


const app = new Hono<HonoEnv>();
dotconfig();

// 数据库连接配置
const dbConfig: mysql.PoolOptions = {
    host: "localhost",
    user: "hms_login",
    password: "123456",
    database: "HMS",
    multipleStatements: true,
    // charset: 'utf8mb4'
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 全局状态变量（保留原意）
let email_in_use = "";
let password_in_use = "";
let who = "";

// 中间件
app.use("*",
    cors({
        origin: "http://localhost:3000",
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "Cookie"],
        credentials: true,
    }),
);
app.use("*", logger());

app.use('*', async (c, next) => {
  c.env = {
    ...c.env,
    ...process.env
  }
  await next()
})


const dbInstance = new Kysely<DB>({
    dialect: new MysqlDialect({
        pool: createPool2(process.env.DATABASE_URL as string),
    }),
});

app.use("*", async (c, next) => {
    c.set("db", dbInstance);
    await next();
});

app.use("*", customAuth);


app.get("/", (c) => {
    return c.text("Hospital Management System Backend (Hono)");
});


app.route("/", auth);


// --- 患者相关查询 ---

// 检查患者是否存在
app.get("/checkIfPatientExists", async (c) => {
    const email = c.req.query("email") as string;
    const statement = `SELECT * FROM Patient WHERE email = ?`;
    try {
        const [results] = await pool.execute(statement, [email]);
        return c.json({ data: results });
    } catch (error) {
        console.error(error);
        return c.json({ error: "Database error" }, 500);
    }
});

// 创建用户账户
app.get("/makeAccount", async (c) => {
    const query = c.req.query();
    const { name, email, password, address, gender, age, height, weight } =
        query;
    let { medications, conditions, surgeries } = query;

    if (medications === undefined) medications = "无";
    if (conditions === undefined) conditions = "无";
    if (surgeries === undefined) surgeries = "无";

    try {
        // 插入 Patient 表
        const sql_patient = `INSERT INTO Patient (email, password, name, address, gender, age, height, weight) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const [results] = await pool.execute(sql_patient, [
            email,
            password,
            name,
            address,
            gender,
            age,
            height,
            weight,
        ]);

        // 设置全局状态
        email_in_use = email;
        password_in_use = password;
        who = "pat";

        // 获取最新的 MedicalHistory ID 并插入
        const [historyIds]: any = await pool.execute(
            "SELECT id FROM MedicalHistory ORDER BY id DESC LIMIT 1",
        );
        const generated_id = (historyIds[0]?.id || 0) + 1;

        const sql_history = `INSERT INTO MedicalHistory (id, date, conditions, surgeries, medication) 
                             VALUES (?, curdate(), ?, ?, ?)`;
        await pool.execute(sql_history, [
            generated_id,
            conditions,
            surgeries,
            medications,
        ]);

        // 关联患者与病史
        const sql_fill = `INSERT INTO PatientsFillHistory (patient, history) VALUES (?, ?)`;
        await pool.execute(sql_fill, [email, generated_id]);

        return c.json({ data: results });
    } catch (error) {
        console.error(error);
        return c.json({ error: "Database error" }, 500);
    }
});

// --- 医生相关查询 ---

app.get("/checkIfDocExists", async (c) => {
    const email = c.req.query("email") as string;
    const statement = `SELECT * FROM Doctor WHERE email = ?`;
    try {
        const [results] = await pool.execute(statement, [email]);
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/makeDocAccount", async (c) => {
    const params = c.req.query();
    const name = `${params.name} ${params.lastname}`;
    const { email, password, gender, schedule } = params;

    try {
        const sql_doc = `INSERT INTO Doctor (email, gender, password, name) VALUES (?, ?, ?, ?)`;
        const [results] = await pool.execute(sql_doc, [
            email,
            gender,
            password,
            name,
        ]);

        const sql_sched = `INSERT INTO DocsHaveSchedules (sched, doctor) VALUES (?, ?)`;
        await pool.execute(sql_sched, [schedule, email]);

        email_in_use = email;
        password_in_use = password;
        who = "doc";

        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

// 获取医生统计数据
app.get("/doctorStatistics", async (c) => {
    const doctorEmail = email_in_use;

    if (!doctorEmail || who !== "doc") {
        return c.json(
            {
                error: "No doctor logged in",
                details: "Please login as a doctor first",
            },
            401,
        );
    }

    const monthlyApptQuery = `SELECT 
        DATE_FORMAT(a.date, '%b') as month,
        COUNT(a.id) as count,
        COUNT(DISTINCT 
            CASE WHEN 
                NOT EXISTS (
                    SELECT 1
                    FROM PatientsAttendAppointments AS old_psa
                    INNER JOIN Diagnose AS old_d ON old_psa.appt = old_d.appt
                    WHERE 
                        old_psa.patient = psa.patient
                        AND old_d.doctor = d.doctor
                        AND old_psa.appt < a.id
                ) 
            THEN psa.patient END
        ) as newPatients
        FROM Appointment a
        INNER JOIN PatientsAttendAppointments psa ON a.id = psa.appt
        INNER JOIN Diagnose d ON a.id = d.appt
        WHERE d.doctor = ?
        AND a.date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY YEAR(a.date), MONTH(a.date), DATE_FORMAT(a.date, '%b')
        ORDER BY YEAR(a.date), MONTH(a.date)`;

    const genderStatsQuery = `SELECT 
        p.gender,
        COUNT(DISTINCT psa.patient) as value
        FROM Patient p
        INNER JOIN PatientsAttendAppointments psa ON p.email = psa.patient
        INNER JOIN Diagnose d ON psa.appt = d.appt
        WHERE d.doctor = ?
        AND p.gender IN ('Male', 'Female', '男', '女') 
        GROUP BY p.gender`;

    try {
        const [apptResults]: any = await pool.execute(monthlyApptQuery, [
            doctorEmail,
        ]);
        const [genderResults]: any = await pool.execute(genderStatsQuery, [
            doctorEmail,
        ]);

        return c.json({
            apptStats: apptResults,
            genderStats: genderResults,
        });
    } catch (error) {
        console.error(error);
        return c.json({ error: "Database error" }, 500);
    }
});

// --- 登录与会话 ---

app.get("/checklogin", async (c) => {
    const { email, password } = c.req.query();
    const sql = `SELECT * FROM Patient WHERE email=? AND password=?`;
    try {
        const [results]: any = await pool.execute(sql, [email, password]);
        if (results.length > 0) {
            email_in_use = email;
            password_in_use = password;
            who = "pat";
        }
        return c.json({ data: results });
    } catch (error) {
        return c.json({ failed: "error occurred" }, 500);
    }
});

app.get("/checkDoclogin", async (c) => {
    const { email, password } = c.req.query();
    const sql = `SELECT * FROM Doctor WHERE email=? AND password=?`;
    try {
        const [results]: any = await pool.execute(sql, [email, password]);
        if (results.length > 0) {
            email_in_use = results[0].email;
            password_in_use = results[0].password;
            who = "doc";
        }
        return c.json({ data: results });
    } catch (error) {
        return c.json({ failed: "error occurred" }, 500);
    }
});

app.get("/userInSession", (c) => {
    return c.json({ email: email_in_use, who: who });
});

app.get("/endSession", (c) => {
    email_in_use = "";
    password_in_use = "";
    who = "";
    return c.json({ success: true });
});

// --- 密码与邮箱重置 (POST) ---

app.post("/resetPasswordPatient", async (c) => {
    const { email, oldPassword, newPassword } = c.req.query();
    const sql = `UPDATE Patient SET password = ? WHERE email = ? AND password = ?`;
    try {
        const [results] = await pool.execute(sql, [
            newPassword,
            email,
            oldPassword,
        ]);
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Update failed" }, 500);
    }
});

app.post("/resetPasswordDoctor", async (c) => {
    const { email, oldPassword, newPassword } = c.req.query();
    const sql = `UPDATE Doctor SET password = ? WHERE email = ? AND password = ?`;
    try {
        const [results] = await pool.execute(sql, [
            newPassword,
            email,
            oldPassword,
        ]);
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Update failed" }, 500);
    }
});

app.post("/resetEmailPatient", async (c) => {
    const { oldEmail, newEmail, password } = c.req.query();
    const sql = `UPDATE Patient SET email = ? WHERE email = ? AND password = ?`;
    try {
        const [results]: any = await pool.execute(sql, [
            newEmail,
            oldEmail,
            password,
        ]);
        if (results.affectedRows > 0) email_in_use = newEmail;
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Update failed" }, 500);
    }
});

app.post("/resetEmailDoctor", async (c) => {
    const { oldEmail, newEmail, password } = c.req.query();
    const sql = `UPDATE Doctor SET email = ? WHERE email = ? AND password = ?`;
    try {
        const [results]: any = await pool.execute(sql, [
            newEmail,
            oldEmail,
            password,
        ]);
        if (results.affectedRows > 0) email_in_use = newEmail;
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Update failed" }, 500);
    }
});

app.post("/updateDoctorEmail", async (c) => {
    const { oldEmail, newEmail } = c.req.query();
    try {
        const [exists]: any = await pool.execute(
            "SELECT * FROM Doctor WHERE email = ?",
            [newEmail],
        );
        if (exists.length > 0)
            return c.json({ success: false, message: "Email already in use." });

        const [result]: any = await pool.execute(
            "UPDATE Doctor SET email = ? WHERE email = ?",
            [newEmail, oldEmail],
        );
        if (result.affectedRows === 0)
            return c.json({ success: false, message: "Doctor not found." });

        return c.json({
            success: true,
            message: "Email updated successfully.",
        });
    } catch (err) {
        return c.json({ success: false, message: "Server error." }, 500);
    }
});

// --- 预约相关 ---

app.get("/getDocScheduleOnDate", async (c) => {
    const { email: docEmail, date: dateStr } = c.req.query();
    try {
        // 1. 获取繁忙时段
        const apptQuery = `
            SELECT a.starttime FROM Appointment a
            JOIN Diagnose d ON a.id = d.appt
            WHERE d.doctor = ? AND a.date = ? AND a.status = 'NotDone'
        `;
        const [apptRes]: any = await pool.execute(apptQuery, [
            docEmail,
            dateStr,
        ]);
        const busySlots = apptRes.map((item: any) => item.starttime);

        // 2. 获取医生排班
        const scheduleQuery = `
            SELECT s.starttime, s.endtime, s.breaktime FROM DocsHaveSchedules dhs
            JOIN Schedule s ON dhs.sched = s.id
            WHERE dhs.doctor = ? AND s.day = DAYNAME(?)
        `;
        const [scheduleRes]: any = await pool.execute(scheduleQuery, [
            docEmail,
            dateStr,
        ]);

        let finalSchedule = {
            working: true,
            start: "09:00:00",
            end: "17:00:00",
            break: "12:00:00",
            busy: busySlots,
        };

        if (scheduleRes.length > 0) {
            finalSchedule.start = scheduleRes[0].starttime;
            finalSchedule.end = scheduleRes[0].endtime;
            finalSchedule.break = scheduleRes[0].breaktime;
        }

        return c.json(finalSchedule);
    } catch (error) {
        return c.json({ error: "Schedule check failed" }, 500);
    }
});

app.get("/checkIfApptExists", async (c) => {
    const { email, docEmail, startTime, date } = c.req.query();
    const dateObj = new Date(date);
    const ndate = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()}`;

    try {
        // 检查冲突
        const q1 = `SELECT * FROM PatientsAttendAppointments pa INNER JOIN Appointment a ON pa.appt = a.id 
                    WHERE pa.patient = ? AND a.date = STR_TO_DATE(?, '%d/%m/%Y') AND a.starttime = CONVERT(?, TIME)`;
        const [res1]: any = await pool.execute(q1, [email, ndate, startTime]);

        const q2 = `SELECT * FROM Diagnose d INNER JOIN Appointment a ON d.appt = a.id 
                    WHERE d.doctor = ? AND a.date = STR_TO_DATE(?, '%d/%m/%Y') AND a.status = "NotDone" 
                    AND CONVERT(?, TIME) >= a.starttime AND CONVERT(?, TIME) < a.endtime`;
        const [res2]: any = await pool.execute(q2, [
            docEmail,
            ndate,
            startTime,
            startTime,
        ]);

        const q3 = `SELECT s.id FROM DocsHaveSchedules dhs INNER JOIN Schedule s ON dhs.sched = s.id
                    WHERE dhs.doctor = ? AND s.day = DAYNAME(STR_TO_DATE(?, '%d/%m/%Y'))
                    AND (CONVERT(?, TIME) < s.starttime OR CONVERT(?, TIME) >= s.endtime 
                    OR (CONVERT(?, TIME) >= s.breaktime AND CONVERT(?, TIME) < DATE_ADD(s.breaktime, INTERVAL 1 HOUR)))`;
        const [res3]: any = await pool.execute(q3, [
            docEmail,
            ndate,
            startTime,
            startTime,
            startTime,
        ]);

        const all = [...res1, ...res2, ...(res3.length ? [1] : [])];
        return c.json({ data: all });
    } catch (error) {
        return c.json({ error: "Conflict check failed" }, 500);
    }
});

app.get("/schedule", async (c) => {
    const { time, date, id, endTime, doc, email, concerns, symptoms } =
        c.req.query();
    const dateObj = new Date(date);
    const ndate = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()}`;

    try {
        const sql_appt = `INSERT INTO Appointment (id, date, starttime, endtime, status) 
                          VALUES (?, STR_TO_DATE(?, '%d/%m/%Y'), CONVERT(?, TIME), CONVERT(?, TIME), "NotDone")`;
        await pool.execute(sql_appt, [id, ndate, time, endTime]);

        const sql_diag = `INSERT INTO Diagnose (appt, doctor, diagnosis, prescription) VALUES (?, ?, 'Not Yet Diagnosed', 'Not Yet Diagnosed')`;
        const [results] = await pool.execute(sql_diag, [id, doc]);

        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Scheduling failed" }, 500);
    }
});

app.get("/genApptUID", async (c) => {
    try {
        const [results]: any = await pool.execute(
            "SELECT id FROM Appointment ORDER BY id DESC LIMIT 1",
        );
        const generated_id = (results[0]?.id || 0) + 1;
        return c.json({ id: `${generated_id}` });
    } catch (error) {
        return c.json({ error: "ID generation failed" }, 500);
    }
});

// --- 历史与视图 ---

app.get("/docInfo", async (c) => {
    try {
        const [results] = await pool.execute("SELECT * FROM Doctor");
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/MedHistView", async (c) => {
    const { name } = c.req.query();
    let statement = `SELECT name AS 'Name', PatientsFillHistory.history AS 'ID', email FROM Patient, PatientsFillHistory
                     WHERE Patient.email = PatientsFillHistory.patient
                     AND Patient.email IN (SELECT patient from PatientsAttendAppointments NATURAL JOIN Diagnose WHERE doctor=?)`;
    if (name) statement += ` AND Patient.name LIKE ?`;

    try {
        const [results] = await pool.execute(
            statement,
            name ? [email_in_use, `%${name}%`] : [email_in_use],
        );
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/patientViewAppt", async (c) => {
    const email = c.req.query("email") as string;
    const sql = `SELECT psa.appt as ID, psa.patient as user, psa.concerns as theConcerns, psa.symptoms as theSymptoms, 
                 a.date as theDate, a.starttime as theStart, a.endtime as theEnd, a.status as status
                 FROM PatientsAttendAppointments psa, Appointment a
                 WHERE psa.patient = ? AND psa.appt = a.id`;
    try {
        const [results] = await pool.execute(sql, [email]);
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/getDateTimeOfAppt", async (c) => {
    const id = c.req.query("id") as string;
    const sql = `SELECT starttime as start, endtime as end, date as theDate FROM Appointment WHERE id = ?`;
    try {
        const [results] = await pool.execute(sql, [id]);
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/OneHistory", async (c) => {
    const patientEmail = c.req.query("patientEmail") as string;
    const sql = `SELECT gender, name, email, address, conditions, surgeries, medication
                 FROM PatientsFillHistory
                 JOIN Patient ON PatientsFillHistory.patient = Patient.email
                 JOIN MedicalHistory ON PatientsFillHistory.history = MedicalHistory.id
                 WHERE Patient.email = ?`;
    try {
        const [results] = await pool.execute(sql, [patientEmail]);
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/checkIfHistory", async (c) => {
    const email = c.req.query("email") as string;
    const sql = `SELECT patient FROM PatientsFillHistory WHERE patient = ?`;
    try {
        const [results] = await pool.execute(sql, [email]);
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/addToPatientSeeAppt", async (c) => {
    const { email, id: apptId, concerns, symptoms } = c.req.query();
    const sql = `INSERT INTO PatientsAttendAppointments (patient, appt, concerns, symptoms)
                 VALUES (?, ?, ?, ?)`;
    try {
        const [results] = await pool.execute(sql, [email, apptId, concerns, symptoms]);
        return c.json({ data: results });
    } catch (error) {
        console.error(error);
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/doctorViewAppt", async (c) => {
    const sql = `SELECT a.id, a.date, a.starttime, a.status, p.name, psa.concerns, psa.symptoms
                 FROM Appointment a, PatientsAttendAppointments psa, Patient p
                 WHERE a.id = psa.appt AND psa.patient = p.email
                 AND a.id IN (SELECT appt FROM Diagnose WHERE doctor=?)`;
    try {
        const [results] = await pool.execute(sql, [email_in_use]);
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/allDiagnoses", async (c) => {
    const email = c.req.query("patientEmail") as string;
    const sql = `SELECT A.date, D.name AS doctor, psa.concerns, psa.symptoms, d.diagnosis, d.prescription
                 FROM Appointment A
                 INNER JOIN PatientsAttendAppointments psa ON A.id = psa.appt
                 INNER JOIN Diagnose d ON psa.appt = d.appt
                 INNER JOIN Doctor D ON d.doctor = D.email
                 WHERE psa.patient = ?`;
    try {
        const [results] = await pool.execute(sql, [email]);
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/diagnose", async (c) => {
    const { id, diagnosis, prescription } = c.req.query();
    try {
        await pool.execute(
            `UPDATE Diagnose SET diagnosis=?, prescription=? WHERE appt=?`,
            [diagnosis, prescription, id],
        );
        await pool.execute(`UPDATE Appointment SET status="Done" WHERE id=?`, [
            id,
        ]);
        return c.json({ success: true });
    } catch (error) {
        return c.json({ error: "Diagnosis failed" }, 500);
    }
});

app.get("/showDiagnoses", async (c) => {
    const id = c.req.query("id") as string;
    try {
        const [results] = await pool.execute(
            `SELECT * FROM Diagnose WHERE appt=?`,
            [id],
        );
        return c.json({ data: results });
    } catch (error) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/allDrugs", async (c) => {
    const fetchDrugs = () => pool.execute("SELECT * FROM Medications");
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database timeout")), 10000),
    );

    try {
        const [results]: any = await Promise.race([fetchDrugs(), timeout]);
        return c.json({ data: results });
    } catch (error: any) {
        return c.json({ error: "Database error" }, 500);
    }
});

app.get("/deleteAppt", async (c) => {
    const uid = c.req.query("uid") as string;
    try {
        const [results]: any = await pool.execute(
            `SELECT status FROM Appointment WHERE id=?`,
            [uid],
        );
        if (results.length > 0 && results[0].status === "NotDone") {
            await pool.execute(`DELETE FROM Appointment WHERE id=?`, [uid]);
            return c.json({ success: true });
        }
        return c.json({ error: "Cannot delete completed appointment" }, 400);
    } catch (error) {
        return c.json({ error: "Delete failed" }, 500);
    }
});

// --- 错误处理 ---
app.notFound((c) => c.json({ error: "Not Found" }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal Server Error" }, 500);
});

if (process.env.NODE_ENV === "production") {
    serve(
        {
            fetch: app.fetch,
            port: 3001,
        },
        (info) => {
            console.log(
                `[Production] Listening on http://localhost:${info.port}`,
            );
        },
    );
}

export default app;

