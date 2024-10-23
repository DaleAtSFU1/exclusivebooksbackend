"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const sqlconfig_1 = __importDefault(require("./model/sqlconfig"));
// @ts-ignore
const express_1 = __importDefault(require("express"));
// @ts-ignore
const cors_1 = __importDefault(require("cors"));
const transactionSaveController_1 = __importDefault(require("./controllers/transactionSaveController"));
const http = require('http');
const log4js = require("log4js");
const PORT = process.env.PORT || 8080;
const router = (0, express_1.default)();
let logger = log4js.getLogger();
logger.level = process.env.LOG_LEVEL;
router.use((0, cors_1.default)({ origin: true }));
router.use(express_1.default.json());
function apiKeyValidation(req, res, next) {
    const expectedApiKey = process.env.API_KEY;
    const authorizationHeader = req.headers['authorization'];
    if (!authorizationHeader || authorizationHeader !== expectedApiKey) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
}
router.use('/transaction', apiKeyValidation);
router.use("/transaction", transactionSaveController_1.default);
/** Server */
const httpServer = http.createServer(router);
sqlconfig_1.default.sequelize.sync().then(() => __awaiter(void 0, void 0, void 0, function* () {
    httpServer.listen(PORT, () => logger.info(`The server is running on port ${PORT}`));
})).catch((error) => {
    logger.error("DB Sync Error:" + error.message, error);
});
// TODO: remind jj of iparams and validation
