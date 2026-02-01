const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

RunQueries();

async function RunQueries() {

    const connection = await mysql.createConnection({
                host: "10.10.1.6",
                user: 'punten',
                password: "BitsGoes1!",
                database: 'punten'
    });

    await connection.connect();

    await connection.query(`DROP TABLE IF EXISTS geschiedenis`);
    await connection.query(`DROP TABLE IF EXISTS deelnemers`);
    await connection.query(`DROP TABLE IF EXISTS Tokens`);

    await connection.query(`
        CREATE TABLE deelnemers (
            ID INT auto_increment NOT NULL,
            naam varchar(100) NOT NULL,
            punten INT(11) NOT NULL DEFAULT 0,
            CONSTRAINT ID PRIMARY KEY (ID),
            CONSTRAINT naam_UNIQUE UNIQUE KEY (naam)
        );
    `);

    await connection.query(`
        CREATE TABLE geschiedenis (
            ID INT auto_increment NOT NULL,
            naam varchar(100) NOT NULL,
            actie INT(11) NOT NULL,
            datum varchar(100) NOT NULL,
            CONSTRAINT ID PRIMARY KEY (ID),
            CONSTRAINT FK_naam FOREIGN KEY (naam)
            REFERENCES deelnemers(naam)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        );
    `);

    await connection.query(`
        CREATE TABLE Tokens (
            ID INT auto_increment NOT NULL,
            Token varchar(200) NOT NULL,
            CreationDate varchar(100) NOT NULL,
            ExpirationDate varchar(100) NOT NULL,
            CONSTRAINT ID PRIMARY KEY (ID),
            CONSTRAINT Token UNIQUE KEY (Token)
        );
    `);

    await connection.close();
}