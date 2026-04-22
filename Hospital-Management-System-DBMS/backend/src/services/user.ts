import { Kysely, Selectable } from "kysely";
import { Doctor, Patient, DB, Users } from "../db/generated";

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
};
export { UserService };
