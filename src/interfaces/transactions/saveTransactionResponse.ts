import { SaveTransactionRequest } from "./saveTransactionRequest"

export interface SaveTransactionResponse {
    success: boolean,
    errorCode: string|null|undefined,
    errorList: string[]|null|undefined,
    info: string,
    data: {
        transaction: SaveTransactionRequest
    }|null
}