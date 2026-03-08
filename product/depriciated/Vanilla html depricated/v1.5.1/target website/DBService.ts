import mysql, { Connection } from 'mysql2/promise';

let connection: Connection;

CreateConnection();

function sleep(ms: number): Promise<void> {
    return new Promise(
        (resolve) => setTimeout(resolve, ms));
}

async function CreateConnection() {
    try {
        connection = await mysql.createConnection({
            host: "10.10.1.6",
            user: 'punten',
            password: "BitsGoes1!",
            database: 'punten'
        });      

        connection.connect();
        console.log(`Connected to database on host: 10.10.1.6`);
    } catch (e) {
        console.log(`Cannot connect to mysql database on host: 10.10.1.6. Retrying after 2 seconds...`);
        await sleep(2000);
        CreateConnection();
    }
}

export async function Query(sql: string, params: any[]) {
    try {
        return (await connection.query(sql, params))[0] as any;
    } catch (e) {
        console.log(e);
        if (e.message.includes("Can't add new command when connection is in closed state")) {
            try {
                CreateConnection();
            } catch (e) {
                console.log(e);
            }
        }
    }
}

export async function QueryNoParams(sql: string) {
    try {
        return (await connection.query(sql))[0] as any;
    } catch (e) {
        console.log(e);
        if (e.message.includes("Can't add new command when connection is in closed state")) {
            try {
                CreateConnection();
            } catch (e) {
                console.log(e);
            }
        }
    }
}

module.exports = {
    QueryNoParams,
    Query
}