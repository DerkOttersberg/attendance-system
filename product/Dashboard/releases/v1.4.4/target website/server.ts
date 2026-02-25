import express, { Express, Request, Response } from 'express';
import { AddressInfo } from "net";
import cors from "cors";
import Queries from './queries';
import { TokenGenerator } from "ts-token-generator";
import cookieParser from 'cookie-parser';
import helmet from "helmet";

const app: Express = express();

const tokgen = new TokenGenerator();

const COOKIES_SECRET = "super cookie secret";

app.use(helmet());
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
        },
    })
);
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = ["*"];
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.indexOf("*") !== -1) {
            console.log(`Allowed connection from origin: ${origin}`);
            callback(null, true);
        } else {
            console.log(`Blocked CORS request from origin: ${origin}`);
            callback(null, false);
        }
    },
    credentials: true,
}));

app.use(cookieParser(COOKIES_SECRET));
app.use(express.json({ limit: "5kb" }));
app.use(express.urlencoded({ extended: true, limit: "5kb" }));
app.set('port', 3000);

const server = app.listen(app.get('port'), function () {
    console.log(`Express server listening on port ${(server.address() as AddressInfo).port}`);
});


//routes

app.put('/api/addDeelnemer', async (req: Request, res: Response) => {
    if (!await CheckToken(req)) {
        res.sendStatus(401);
        return;
    }

    if (req.body.naam)
    {
        const result = await Queries.InsertDeelnemer(req.body.naam);
        res.sendStatus(200);
        return;
    }
    res.sendStatus(500);
});

app.get('/api/allDeelnemers', async (req: Request, res: Response) => {
    console.log("gettting all deelnemers data");
    const result = await Queries.GetAllDeelnemers();
    res.json(result);
});

app.delete('/api/removeDeelnemer', async (req: Request, res: Response) => {
    if (!await CheckToken(req)) {
        res.sendStatus(401);
        return;
    }

    if (req.body.id)
    {
        await Queries.deleteDeelnemer(req.body.id)
        res.sendStatus(200);
        return;
    }
    res.sendStatus(500);
});

app.post('/api/changeName', async (req: Request, res: Response) => {
    if (!await CheckToken(req)) {
        res.sendStatus(401);
        return;
    }

    if (req.body.newName && req.body.id)
    {
        await Queries.UpdateDeelnemerName(req.body.id, req.body.newName);
        res.sendStatus(200);
        return;
    }
    res.sendStatus(500);
});

app.post('/api/updatePunten', async (req: Request, res: Response) => {
    if (!await CheckToken(req))
    {
        res.sendStatus(401);
        return;
    }

    if ((req.body.punten || req.body.punten == 0) && req.body.id && req.body.naam)
    {
        await Queries.UpdateDeelnemerPunten(req.body.id, req.body.punten);
        await Queries.AddHistory(req.body.naam, req.body.punten);
        res.sendStatus(200);
        return;
    }
    res.sendStatus(500);
});

app.post('/api/getHistory', async (req: Request, res: Response) => {
    if (req.body.naam)
    {
        const result = await Queries.GetHistory(req.body.naam);
        res.json(result);
        return;
    }
    res.sendStatus(500);
});

app.get('/api/login/:pass', async (req: Request, res: Response) =>
{
    if (req.params.pass == "BitsGoes1!")
    {
        const token = tokgen.generate();
        if ((await Queries.TokenExistsByToken(req.cookies["login"]))) {
            const result = (await Queries.UpdateToken(req.cookies["login"])); {
                if (!result) {
                    res.sendStatus(500);
                    return;
                }
            }
            res.sendStatus(200);
            return;
        }

        Queries.RemoveToken(req.cookies["login"]);
        let result = (await Queries.AddToken(token));
        if (!result) {
            res.sendStatus(500);
            return;
        }
        res.cookie('login', token, { path: '/', httpOnly: true, maxAge: 3600000, sameSite: "strict" });
        res.sendStatus(200);
        return;
    }
    res.sendStatus(401);
});

//token
app.get('/api/validatetoken', async (req: Request, res: Response) => {
    if (await (CheckToken(req)))
    {
        await Queries.UpdateToken(req.cookies["login"]);
        res.sendStatus(200);
    }
    else res.sendStatus(401);
});

app.get('/api/logout', async (req: Request, res: Response) => {
    const result = (await Queries.RemoveToken(req.cookies["login"]));
    if (!result) {
        res.sendStatus(500);
        return;
    }
    res.clearCookie("login");
    res.sendStatus(200);
});

async function CheckToken(req: Request): Promise<boolean>
{
    if (await Queries.TokenExistsByToken(req.cookies["login"])) {
        const result = (await Queries.UpdateToken(req.cookies["login"]));
        if (!result) {
            return false;
        }
        return true;
    }
    return false;
}
