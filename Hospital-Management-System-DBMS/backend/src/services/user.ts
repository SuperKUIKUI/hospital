import { Kysely, Selectable } from "kysely";
import { Doctor, Patient, DB, Users } from "../db/generated";

// Helper function to validate SHA256 hash format
function isValidSha256(hash: string): boolean {
    if (typeof hash !== 'string' || hash.length !== 64) {
        return false;
    }
    // Check if it contains only lowercase hexadecimal characters
    return /^[0-9a-f]{64}$/.test(hash);
}

const UserService = {
    async findUserByEmail(
        db: Kysely<DB>,
        email: string,
    ): Promise<Selectable<Users>[]> {
        return await db
            .selectFrom("Users")
            .selectAll()
            .where("email", "=", email)
            .limit(1)
            .execute();
    },
    async registerUserAsPatient(
        db: Kysely<DB>,
        email: string,
        password: string,
        patient: Selectable<Patient>,
    ): Promise<void> {
        const trx = await db.startTransaction().execute();
        patient.email = email;
        patient.password = "";
        try {
            await trx
                .insertInto("Users")
                .values({
                    email: email,
                    password: password,
                    role: 0,
                })
                .execute();
            await trx.insertInto("Patient").values(patient).execute();
            await trx.commit().execute();
        } catch (err) {
            console.error(err);
            await trx.rollback().execute();
        }
    },
    async registerUserAsDoctor(
        db: Kysely<DB>,
        email: string,
        password: string,
        doctor: Selectable<Doctor>,
    ) {
        const trx = await db.startTransaction().execute();
        doctor.email = email;
        doctor.password = "";
        try {
            await trx
                .insertInto("Users")
                .values({
                    email: email,
                    password: password,
                    role: 1,
                })
                .execute();
            await trx.insertInto("Doctor").values(doctor).execute();
            await trx.commit().execute();
        } catch (err) {
            console.error(err);
            await trx.rollback().execute();
        }
    },
    async selectPatient(
        db: Kysely<DB>,
        email: string,
    ): Promise<Selectable<Patient>[]> {
        return await db
            .selectFrom("Patient")
            .selectAll()
            .limit(1)
            .where("email", "=", email)
            .execute();
    },
    async selectDoctor(
        db: Kysely<DB>,
        email: string,
    ): Promise<Selectable<Doctor>[]> {
        return await db
            .selectFrom("Doctor")
            .selectAll()
            .limit(1)
            .where("email", "=", email)
            .execute();
    },
    async changeUserPassword(
        db: Kysely<DB>,
        email: string,
        old_password: string,
        new_password: string,
    ): Promise<void> {
        if (!isValidSha256(old_password)) {
            throw new Error("Invalid old password format. Must be a valid SHA256 hash.");
        }
        if (!isValidSha256(new_password)) {
            throw new Error("Invalid new password format. Must be a valid SHA256 hash.");
        }

        // 使用单个原子 UPDATE 语句防止竞态条件，并确保必须匹配旧密码
        const result = await db
            .updateTable("Users")
            .set({
                password: new_password,
            })
            .where("email", "=", email)
            .where("password", "=", old_password)
            .execute();

        // 在 Kysely MySQL 中，execute() 返回包含 numUpdatedRows 的数组或对象
        // 我们需要确保确实有一行被更新了
        if (result.length === 0 || result[0].numUpdatedRows === BigInt(0)) {
            throw new Error("Password update failed: invalid credentials or user not found.");
        }
    },
};
export { UserService };
