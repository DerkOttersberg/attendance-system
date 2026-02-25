import { Query, QueryNoParams } from './DBService';
import date from 'date-and-time';

export default class Queries {
    public static async InsertDeelnemer(naam: string): Promise<any> {
        return Query(`INSERT INTO deelnemers (naam) VALUES (?)`, [naam]);
    }

    public static async GetAllDeelnemers(): Promise<any> {
        return QueryNoParams(`SELECT * FROM deelnemers`);
    }

    public static async deleteDeelnemer(id: number): Promise<any> {
        return Query(`DELETE FROM deelnemers WHERE id = ?`, [id]);
    }

    public static async UpdateDeelnemerName(id: number, newName: string): Promise<any> {
        return Query(`UPDATE deelnemers SET naam = ? WHERE id = ?`, [newName, id]);
    }

    public static async UpdateDeelnemerPunten(id: number, punten: number): Promise<any> {
        return Query(`UPDATE deelnemers SET punten = ? WHERE id = ?`, [punten, id]);
    }

    public static async AddHistory(naam: string, punten: number): Promise<any> {
        return Query(`INSERT INTO geschiedenis (naam, actie, datum) VALUES (?,?,?)`, [naam, punten, new Date().toISOString()]);
    }

    public static async GetHistory(naam: string) : Promise<any> {
        return Query(`SELECT actie, datum FROM geschiedenis WHERE naam = ?`, [naam]);
    }

    //token
    public static async RemoveToken(token: string): Promise<any> {
        return Query(`DELETE FROM Tokens WHERE Token = ?`, [token]);
    }

    public static async UpdateToken(token: string): Promise<any> {
        if (!token) return false;
        return Query(`UPDATE Tokens Set ExpirationDate = ? WHERE Token = ?`, [date.format(date.addMinutes(new Date(), 10), "DD/MM/YYYY hh:mm:s:SSS"), token]);
    }

    public static async TokenExistsByToken(token: string): Promise<boolean> {
        if (!token) {
            return false;
        }
        const results = await Query(`SELECT Token, ExpirationDate FROM Tokens WHERE Token = ?`,
            [token]);

        if (results.length === 0) return false;
        if (results[0].ExpirationDate < new Date()) {
            this.RemoveToken(token);
            return false;
        }
        return true;
    }

    public static async AddToken(token: string): Promise<string | boolean> {
        const CreationDate = new Date();
        const ExpirationDate = date.addHours(CreationDate, 1);

        return Query(`INSERT INTO Tokens (Token, CreationDate, ExpirationDate) VALUES (?,?,?)`, [token, date.format(CreationDate, "DD/MM/YYYY hh:mm:s:SSS"), date.format(ExpirationDate, "DD/MM/YYYY hh:mm:s:SSS")]);
    }
}