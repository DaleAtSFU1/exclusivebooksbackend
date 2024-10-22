require('dotenv').config();
import db from "./model/sqlconfig";
// @ts-ignore
import express, { Express, Error, Request, Response } from 'express';
// @ts-ignore
import cors from 'cors';
import transactionSaveController from "./controllers/transactionSaveController";

const http=require('http');
const log4js = require("log4js");
const PORT = process.env.PORT || 8080;
const router: Express = express();

let logger = log4js.getLogger();
logger.level = process.env.LOG_LEVEL

router.use(cors({origin: true}));
router.use(express.json())

function apiKeyValidation(req: Request, res: Response, next: () => void) {
    const expectedApiKey = process.env.API_KEY;
  
    const authorizationHeader = req.headers['authorization'];
  
    if (!authorizationHeader || authorizationHeader !== expectedApiKey) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    next();
  }

router.use('/transaction', apiKeyValidation);
router.use("/transaction", transactionSaveController);

/** Server */
const httpServer = http.createServer(router);

db.sequelize.sync().then(async () => {
    httpServer.listen(PORT, () => logger.info(`The server is running on port ${PORT}`));
}).catch((error: Error) => {
    logger.error("DB Sync Error:"+error.message, error);
});

// TODO: remind jj of iparams and validation