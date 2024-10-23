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
exports.SaveTransaction = void 0;
const log4js_1 = __importDefault(require("log4js"));
const storePersistAndPost_1 = require("./storePersistAndPost");
const genrePersistAndPost_1 = require("./genrePersistAndPost");
const authorPersistAndPost_1 = require("./authorPersistAndPost");
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const sqlconfig_1 = __importDefault(require("../../model/sqlconfig"));
const sequelize_1 = require("sequelize");
const themaService_1 = require("./themaService");
let logger = log4js_1.default.getLogger();
logger.level = process.env.LOG_LEVEL || 'info';
// Configure axios-retry
(0, axios_retry_1.default)(axios_1.default, {
    retries: 3,
    retryDelay: axios_retry_1.default.exponentialDelay,
    retryCondition: (error) => {
        return axios_retry_1.default.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNABORTED';
    },
});
class SaveTransaction {
    constructor(transaction) {
        // Default IDs for failsafe
        this.DEFAULT_AUTHOR_ID = "31000001887"; // Generic Author ID
        this.DEFAULT_STORE_ID = "31000217958"; // Generic Store ID
        this.DEFAULT_GENRE_ID = "31000009917"; // Generic Genre ID
        this.DEFAULT_AUTHOR_MASTER_ID = "31000001028";
        this.transaction = transaction;
        this.productRes = {};
        logger.debug(`Transaction initialized: ${JSON.stringify(this.transaction)}`);
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            logger.debug("Initiating transaction saving process...");
            yield this.saveTransaction();
        });
    }
    saveTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.transactionRes = this.initializeResponse();
                this.customerAndStoreNameAndAmount = this.initializeCustomerAndStoreData();
                // Validate required fields
                if (!this.transaction.cm_transaction_id ||
                    !this.transaction.cm_transaction_cf_customer ||
                    !this.transaction.cm_transaction_cf_product ||
                    !this.transaction.cm_transaction_cf_store_code) {
                    throw new Error("One or more properties are null or undefined");
                }
                const existingTransaction = yield this.checkExistingTransaction();
                if (existingTransaction) {
                    // Transaction exists, update it
                    yield this.updateTransaction(existingTransaction);
                }
                else {
                    // Transaction does not exist, create it
                    yield this.createTransaction();
                }
                let author = yield this.processExternalAPI();
                let genreIds = yield this.processThematicElements();
                // Assign genre_ids
                this.customerAndStoreNameAndAmount.genre_ids = genreIds;
                // Create or update trends for each genre
                const authorTrendStatus = yield (0, authorPersistAndPost_1.createOrUpdateAuthorTrend)(this.customerAndStoreNameAndAmount);
                const storeTrendStatus = yield (0, storePersistAndPost_1.createOrUpdateStoreTrend)(this.customerAndStoreNameAndAmount);
                // Iterate over each genre_id to create/update genre trends
                const genreTrendStatuses = yield Promise.all(genreIds.map((genreId) => (0, genrePersistAndPost_1.createOrUpdateGenreTrend)(Object.assign(Object.assign({}, this.customerAndStoreNameAndAmount), { genre_id: genreId }))));
                // Aggregate genre trend statuses
                const aggregatedGenreTrendStatus = genreTrendStatuses.join(', ');
                yield this.updateTransactionTrendResult(this.transaction.cm_transaction_id, author, authorTrendStatus, storeTrendStatus, aggregatedGenreTrendStatus);
            }
            catch (error) {
                logger.error('Error in saveTransaction:', error);
                yield this.rollbackCreate(this.customerAndStoreNameAndAmount);
                this.transactionRes.success = false;
            }
            finally {
                this.finalizeResponse();
            }
        });
    }
    initializeResponse() {
        logger.debug("Initializing SaveTransactionResponse.");
        return {
            success: true,
            errorCode: null,
            errorList: [],
            info: "Transaction processed",
            data: {
                transaction: this.transaction,
            },
        };
    }
    processExternalAPI() {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const apiKey = process.env.API_KEY;
            const timeoutMilliseconds = 10000; // Increased timeout to 10000ms
            const commonConfig = {
                headers: {
                    Authorization: `Token token=${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: timeoutMilliseconds,
            };
            try {
                logger.debug("Fetching product information from external API.");
                this.productRes = yield axios_1.default.get(`https://ebsa.myfreshworks.com/crm/sales/api/cpq/products/${this.transaction.cm_transaction_cf_product}`, commonConfig);
                logger.info(`Product information fetched successfully.`);
                const authorName = ((_a = this.productRes.data.product.custom_field.cf_author) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                logger.debug(`Author Name: ${authorName}`);
                let authorId = this.DEFAULT_AUTHOR_ID;
                let authorMasterId = this.DEFAULT_AUTHOR_MASTER_ID;
                if (authorName && authorName !== '') {
                    // Perform search to get author ID
                    const query = `${authorName}`;
                    const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${query}&include=cm_author`;
                    logger.debug(`Author Search URL: ${searchUrl}`);
                    const authorLookupRes = yield axios_1.default.get(searchUrl, commonConfig);
                    logger.debug(`Author Search Response: ${JSON.stringify(authorLookupRes.data)}`);
                    if (authorLookupRes.data && authorLookupRes.data.length > 0) {
                        authorId = authorLookupRes.data[0].id;
                        // Fetch the author record to get cf_author_master
                        const authorUrl = `https://ebsa.myfreshworks.com/crm/sales/api/custom_module/cm_author/${authorId}`;
                        const authorRes = yield axios_1.default.get(authorUrl, commonConfig);
                        logger.debug(`Author Details Response: ${JSON.stringify(authorRes.data)}`);
                        if (authorRes.data && authorRes.data.cm_author) {
                            authorMasterId = ((_b = authorRes.data.cm_author.custom_field) === null || _b === void 0 ? void 0 : _b.cf_author_master) || this.DEFAULT_AUTHOR_MASTER_ID;
                            if (!authorMasterId) {
                                logger.warn("Author master ID not found in author record; using default author master ID.");
                                authorMasterId = this.DEFAULT_AUTHOR_MASTER_ID;
                            }
                        }
                        else {
                            logger.warn("Author record not found; using default author master ID.");
                            authorMasterId = this.DEFAULT_AUTHOR_MASTER_ID;
                        }
                    }
                    else {
                        logger.warn("Author not found in search; using default author ID and author master ID.");
                    }
                }
                else {
                    logger.warn("Author name is missing or empty; using default author ID and author master ID.");
                }
                // Assign IDs to customerAndStoreNameAndAmount
                this.customerAndStoreNameAndAmount.author_id = authorId;
                this.customerAndStoreNameAndAmount.author_master_id = authorMasterId;
                this.customerAndStoreNameAndAmount.amount = Number(this.transaction.cm_transaction_cf_list_price_vat_excl);
                this.customerAndStoreNameAndAmount.customer_id = this.transaction.cm_transaction_cf_customer;
                this.customerAndStoreNameAndAmount.display_name = this.transaction.cm_transaction_id.toString();
                const storeCode = this.transaction.cm_transaction_cf_store_code;
                if (storeCode && storeCode !== 0) {
                    this.customerAndStoreNameAndAmount.store_id = storeCode.toString(); // Ensure store_id is a string
                }
                else {
                    logger.warn("Store code is missing or zero; using default store ID.");
                    this.customerAndStoreNameAndAmount.store_id = this.DEFAULT_STORE_ID;
                }
                return authorId;
            }
            catch (error) {
                logger.error("Error processing external API: ", ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) || error.message);
                throw error;
            }
        });
    }
    processThematicElements() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const genreIds = [];
            const uniqueGenreIds = [];
            try {
                // Utilize the fetchThemaDetails function
                const themacode = (_a = this.productRes.data.product.custom_field.cf_themacode) === null || _a === void 0 ? void 0 : _a.trim();
                if (!themacode) {
                    logger.warn("No themacode provided; using default genre ID.");
                    return [this.DEFAULT_GENRE_ID];
                }
                const searchTerms = themacode.split('|').map((term) => term.trim().toUpperCase());
                for (const term of searchTerms) {
                    const query = `${term}`;
                    const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${query}&include=cm_thema`;
                    logger.debug(`Searching for Thema with query: ${query}`);
                    const searchResponse = yield axios_1.default.get(searchUrl, {
                        headers: {
                            Authorization: `Token token=${process.env.API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 10000,
                    });
                    if (searchResponse.data && searchResponse.data.length > 0) {
                        const themaId = searchResponse.data[0].id;
                        logger.debug(`Found Thema ID: ${themaId} for thema code: ${term}`);
                        // Fetch thema details
                        const genreSubgenreId = yield (0, themaService_1.fetchThemaDetails)(themaId);
                        genreIds.push(genreSubgenreId);
                    }
                    else {
                        logger.warn(`Thema with code '${term}' not found; using default genre ID.`);
                        genreIds.push(this.DEFAULT_GENRE_ID);
                    }
                }
                // Remove duplicates
                const uniqueSet = new Set(genreIds);
                uniqueGenreIds.push(...uniqueSet);
                logger.info(`Unique Genre IDs collected: ${uniqueGenreIds.join(', ')}`);
                return uniqueGenreIds;
            }
            catch (error) {
                logger.error("Error processing thematic elements: ", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
                return [this.DEFAULT_GENRE_ID];
            }
        });
    }
    rollbackCreate(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.deleteGenreTrends(data);
                yield this.deleteAuthorTrend(data);
                yield this.deleteStoreTrend(data);
                yield this.deleteTransaction();
            }
            catch (error) {
                logger.error('Error during rollback: ', error);
            }
        });
    }
    deleteTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const transactionId = this.transaction.cm_transaction_id;
                if (transactionId) {
                    yield sqlconfig_1.default.transaction.destroy({
                        where: {
                            transaction_id: transactionId,
                        },
                    });
                }
            }
            catch (error) {
                logger.error('Error during deleteTransaction: ', error);
            }
        });
    }
    deleteGenreTrends(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield sqlconfig_1.default.genretrend.destroy({
                    where: { customer_id: data.customer_id, genre_id: data.genre_ids },
                });
            }
            catch (error) {
                logger.error('Error deleting genre trends from the database: ', error);
            }
        });
    }
    deleteAuthorTrend(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield sqlconfig_1.default.authortrend.destroy({
                    where: { customer_id: data.customer_id, author_id: data.author_id },
                });
            }
            catch (error) {
                logger.error('Error deleting author trend from the database: ', error);
            }
        });
    }
    deleteStoreTrend(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield sqlconfig_1.default.storetrend.destroy({
                    where: { customer_id: data.customer_id, store_id: data.store_id },
                });
            }
            catch (error) {
                logger.error('Error deleting store trend from the database: ', error);
            }
        });
    }
    updateTransactionTrendResult(transactionId, author, authorTrendStatus, storeTrendStatus, genreTrendStatus) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const trendResultData = {
                custom_field: {
                    cf_trend_result: `Author Trend: ${authorTrendStatus}, Store Trend: ${storeTrendStatus}, Genre Trends: ${genreTrendStatus}, Author: ${author}`,
                },
            };
            const apiKey = process.env.API_KEY;
            const apiUrl = `https://ebsa.myfreshworks.com/crm/sales/api/custom_module/cm_transaction/${transactionId}`;
            const commonConfig = {
                headers: {
                    Authorization: `Token token=${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000, // Increased timeout
            };
            try {
                logger.debug(`Updating transaction trend result at URL: ${apiUrl}`);
                yield axios_1.default.put(apiUrl, trendResultData, commonConfig);
                logger.info(`Transaction trend result updated.`);
            }
            catch (error) {
                logger.error(`Error updating transaction trend result for ${transactionId}: `, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            }
        });
    }
    finalizeResponse() {
        if (!this.transactionRes.success) {
            this.transactionRes.errorCode = "400";
            this.transactionRes.info = `Error in transaction service ${this.transaction.cm_transaction_id}`;
        }
        logger.debug(`Final response: ${JSON.stringify(this.transactionRes)}`);
    }
    initializeCustomerAndStoreData() {
        logger.debug("Initializing customer and store-related data.");
        return {
            display_name: this.transaction.cm_transaction_id.toString(),
            genre_ids: [],
            author_id: '',
            author_master_id: '',
            customer_id: 0,
            store_id: '0',
            amount: 0,
        };
    }
    checkExistingTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield sqlconfig_1.default.transaction.findOne({
                    where: {
                        transaction_id: this.transaction.cm_transaction_id,
                    },
                });
            }
            catch (error) {
                logger.error(`Error checking existing transaction: ${error}`);
                throw error;
            }
        });
    }
    createTransaction() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger.debug("Creating transaction in the database.");
                const transactionData = {
                    transaction_id: this.transaction.cm_transaction_id,
                    customer_id: this.transaction.cm_transaction_cf_customer,
                    product_id: this.transaction.cm_transaction_cf_product,
                    store_id: this.transaction.cm_transaction_cf_store_code,
                    list_price_vat_excl: this.transaction.cm_transaction_cf_list_price_vat_excl,
                    units_sold: this.transaction.cm_transaction_cf_units_sold,
                };
                logger.debug("Data being inserted into transaction:", transactionData);
                yield sqlconfig_1.default.transaction.create(transactionData);
            }
            catch (error) {
                if (error instanceof sequelize_1.ValidationError) {
                    logger.error("Validation error creating transaction:", error.errors);
                    error.errors.forEach((err) => {
                        var _a;
                        (_a = this.transactionRes.errorList) === null || _a === void 0 ? void 0 : _a.push(err.message);
                    });
                }
                else {
                    logger.error("Error creating transaction:", error);
                    (_a = this.transactionRes.errorList) === null || _a === void 0 ? void 0 : _a.push("Error persisting the transaction");
                }
                this.transactionRes.success = false;
                throw error;
            }
        });
    }
    updateTransaction(existingTransaction) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger.debug("Updating existing transaction in the database.");
                const updatedTransactionData = {
                    customer_id: this.transaction.cm_transaction_cf_customer,
                    product_id: this.transaction.cm_transaction_cf_product,
                    store_id: this.transaction.cm_transaction_cf_store_code,
                    list_price_vat_excl: this.transaction.cm_transaction_cf_list_price_vat_excl,
                    units_sold: this.transaction.cm_transaction_cf_units_sold,
                };
                yield existingTransaction.update(updatedTransactionData);
            }
            catch (error) {
                if (error instanceof sequelize_1.ValidationError) {
                    logger.error("Validation error updating transaction:", error.errors);
                    error.errors.forEach((err) => {
                        var _a;
                        (_a = this.transactionRes.errorList) === null || _a === void 0 ? void 0 : _a.push(err.message);
                    });
                }
                else {
                    logger.error("Error updating transaction:", error);
                    (_a = this.transactionRes.errorList) === null || _a === void 0 ? void 0 : _a.push("Error updating the transaction");
                }
                this.transactionRes.success = false;
                throw error;
            }
        });
    }
}
exports.SaveTransaction = SaveTransaction;
