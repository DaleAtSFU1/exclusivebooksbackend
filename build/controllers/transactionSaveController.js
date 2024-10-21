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
const express_1 = __importDefault(require("express"));
const transactionServiceHandler_1 = require("../services/useCaseRequestHandler/transactionServiceHandler");
const log4js_1 = __importDefault(require("log4js"));
let logger = log4js_1.default.getLogger();
// @ts-ignore
logger.level = process.env.LOG_LEVEL;
const customSourceController = express_1.default.Router();
customSourceController.post('/saveTransaction', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transactionData = req.body;
        logger.debug(req.body);
        // Create an object that matches the Transaction interface
        const extractedData = {
            cm_transaction_id: transactionData.cm_transaction_id,
            cm_transaction_cf_customer: transactionData.cm_transaction_cf_customer,
            cm_transaction_cf_product: transactionData.cm_transaction_cf_product,
            cm_transaction_cf_list_price_vat_excl: transactionData.cm_transaction_cf_list_price_vat_excl,
            cm_transaction_cf_store_code: transactionData.cm_transaction_cf_store_code,
            cm_transaction_cf_units_sold: transactionData.cm_transaction_cf_units_sold
        };
        if (extractedData &&
            (extractedData.cm_transaction_id === null || extractedData.cm_transaction_id === undefined) ||
            (extractedData.cm_transaction_cf_customer === null || extractedData.cm_transaction_cf_customer === undefined) ||
            (extractedData.cm_transaction_cf_product === null || extractedData.cm_transaction_cf_product === undefined) ||
            (extractedData.cm_transaction_cf_store_code === null || extractedData.cm_transaction_cf_store_code === undefined) ||
            (extractedData.cm_transaction_cf_list_price_vat_excl === null || extractedData.cm_transaction_cf_list_price_vat_excl === undefined)) {
            logger.error(extractedData, 'One or more properties are null or undefined');
            return res.status(400).json({ error: 'One or more properties are null or undefined' });
        }
        const saveTransactionResponse = yield (0, transactionServiceHandler_1.saveTransaction)(extractedData);
        if (saveTransactionResponse.success == false) {
            res.status(400).json(saveTransactionResponse);
        }
        else {
            res.status(200).json(saveTransactionResponse);
        }
    }
    catch (error) {
        logger.error(error);
        res.status(400).json({ error: 'Error in controller' });
    }
}));
module.exports = customSourceController;
