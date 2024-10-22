import express, { Request, Response } from "express";
import { SaveTransactionRequest } from "../interfaces/transactions/saveTransactionRequest";
import { SaveTransactionResponse } from "../interfaces/transactions/saveTransactionResponse";
import { saveTransaction } from "../services/useCaseRequestHandler/transactionServiceHandler";

import log4js from "log4js";
let logger = log4js.getLogger();
// @ts-ignore
logger.level = process.env.LOG_LEVEL;

const customSourceController = express.Router();

customSourceController.post('/saveTransaction', async (req: Request, res: Response) => {
    try {

        const transactionData = req.body;
        logger.debug(req.body);

        // Create an object that matches the Transaction interface
        const extractedData: SaveTransactionRequest = {
            cm_transaction_id: transactionData.cm_transaction_id,
            cm_transaction_cf_customer: transactionData.cm_transaction_cf_customer,
            cm_transaction_cf_product: transactionData.cm_transaction_cf_product,
            cm_transaction_cf_list_price_vat_excl: transactionData.cm_transaction_cf_list_price_vat_excl,
            cm_transaction_cf_store_code: transactionData.cm_transaction_cf_store_code,
            cm_transaction_cf_units_sold: transactionData.cm_transaction_cf_units_sold
        };


        if (
            extractedData &&
            (extractedData.cm_transaction_id === null || extractedData.cm_transaction_id === undefined) ||
            (extractedData.cm_transaction_cf_customer === null || extractedData.cm_transaction_cf_customer === undefined) ||
            (extractedData.cm_transaction_cf_product === null || extractedData.cm_transaction_cf_product === undefined) ||
            (extractedData.cm_transaction_cf_store_code === null || extractedData.cm_transaction_cf_store_code === undefined) ||
            (extractedData.cm_transaction_cf_list_price_vat_excl === null || extractedData.cm_transaction_cf_list_price_vat_excl === undefined)
          ) {
            logger.error(extractedData,'One or more properties are null or undefined');
            return res.status(400).json({ error: 'One or more properties are null or undefined' });
        }

        const saveTransactionResponse: SaveTransactionResponse = await saveTransaction(extractedData);

        if(saveTransactionResponse.success == false){
            res.status(400).json(saveTransactionResponse);
        }else{
            res.status(200).json(saveTransactionResponse);
        }

    } catch (error) {
        logger.error(error);
        res.status(400).json({ error: 'Error in controller' });
    }
});

export = customSourceController;
