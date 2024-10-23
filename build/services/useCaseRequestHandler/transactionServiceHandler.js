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
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTransaction = void 0;
const transactionSaveService_1 = require("../useCaseLayer/transactionSaveService");
function saveTransaction(saveTransactionRequest) {
    return __awaiter(this, void 0, void 0, function* () {
        let saveTransaction = new transactionSaveService_1.SaveTransaction(saveTransactionRequest);
        yield saveTransaction.init();
        return saveTransaction.transactionRes;
    });
}
exports.saveTransaction = saveTransaction;
