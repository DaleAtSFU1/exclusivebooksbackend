import { SaveTransactionRequest } from "../../interfaces/transactions/saveTransactionRequest";
import { SaveTransactionResponse } from '../../interfaces/transactions/saveTransactionResponse';
import { SaveTransaction } from "../useCaseLayer/transactionSaveService";

export async function saveTransaction(saveTransactionRequest: SaveTransactionRequest): Promise<SaveTransactionResponse> {
    
    let saveTransaction = new SaveTransaction(saveTransactionRequest)

    await saveTransaction.init();

    return saveTransaction.transactionRes
}