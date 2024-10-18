// src/services/transactions/saveTransaction.ts

import { SaveTransactionRequest } from "../../interfaces/transactions/saveTransactionRequest";
import log4js from "log4js";
import { SaveTransactionResponse } from "../../interfaces/transactions/saveTransactionResponse";
import { createOrUpdateStoreTrend } from "./storePersistAndPost";
import { createOrUpdateGenreTrend } from "./genrePersistAndPost";
import { createOrUpdateAuthorTrend } from "./authorPersistAndPost";
import axios from "axios";
import axiosRetry from "axios-retry";
import db from "../../model/sqlconfig";
import { General } from "../../interfaces/trends/trendsAll";
import { ValidationError } from "sequelize";
import { fetchThemaDetails } from "./themaService";

let logger = log4js.getLogger();
logger.level = process.env.LOG_LEVEL || 'info';

// Configure axios-retry
axiosRetry(axios, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNABORTED';
    },
});

export class SaveTransaction {
    transaction: SaveTransactionRequest;
    transactionRes!: SaveTransactionResponse;
    customerAndStoreNameAndAmount!: General;
    productRes: any;

    // Default IDs for failsafe
    private readonly DEFAULT_AUTHOR_ID = "31000001887"; // Generic Author ID
    private readonly DEFAULT_STORE_ID = "31000217958";  // Generic Store ID
    private readonly DEFAULT_GENRE_ID = "31000009917";  // Generic Genre ID
    private readonly DEFAULT_AUTHOR_MASTER_ID = "31000001028";

    constructor(transaction: SaveTransactionRequest) {
        this.transaction = transaction;
        this.productRes = {};
        logger.debug(`Transaction initialized: ${JSON.stringify(this.transaction)}`);
    }

    public async init() {
        logger.debug("Initiating transaction saving process...");
        await this.saveTransaction();
    }

    async saveTransaction() {
        try {
            this.transactionRes = this.initializeResponse();
            this.customerAndStoreNameAndAmount = this.initializeCustomerAndStoreData();

            // Validate required fields
            if (
                !this.transaction.cm_transaction_id ||
                !this.transaction.cm_transaction_cf_customer ||
                !this.transaction.cm_transaction_cf_product ||
                !this.transaction.cm_transaction_cf_store_code
            ) {
                throw new Error("One or more properties are null or undefined");
            }

            const existingTransaction = await this.checkExistingTransaction();

            if (existingTransaction) {
                // Transaction exists, update it
                await this.updateTransaction(existingTransaction);
            } else {
                // Transaction does not exist, create it
                await this.createTransaction();
            }

            let author = await this.processExternalAPI();
            let genreIds = await this.processThematicElements();

            // Assign genre_ids
            this.customerAndStoreNameAndAmount.genre_ids = genreIds;

            // Create or update trends for each genre
            const authorTrendStatus = await createOrUpdateAuthorTrend(this.customerAndStoreNameAndAmount);
            const storeTrendStatus = await createOrUpdateStoreTrend(this.customerAndStoreNameAndAmount);

            // Iterate over each genre_id to create/update genre trends
            const genreTrendStatuses = await Promise.all(
                genreIds.map((genreId) => createOrUpdateGenreTrend({
                    ...this.customerAndStoreNameAndAmount, // Includes genre_ids: string[]
                    genre_id: genreId, // Add individual genre_id: string
                }))
            );

            // Aggregate genre trend statuses
            const aggregatedGenreTrendStatus = genreTrendStatuses.join(', ');

            await this.updateTransactionTrendResult(
                this.transaction.cm_transaction_id,
                author,
                authorTrendStatus,
                storeTrendStatus,
                aggregatedGenreTrendStatus
            );
        } catch (error) {
            logger.error('Error in saveTransaction:', error);
            await this.rollbackCreate(this.customerAndStoreNameAndAmount);
            this.transactionRes.success = false;
        } finally {
            this.finalizeResponse();
        }
    }

    private initializeResponse(): SaveTransactionResponse {
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

    private async processExternalAPI(): Promise<string> {
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
            this.productRes = await axios.get(
                `https://ebsa.myfreshworks.com/crm/sales/api/cpq/products/${this.transaction.cm_transaction_cf_product}`,
                commonConfig
            );
            logger.info(`Product information fetched successfully.`);

            const authorName = this.productRes.data.product.custom_field.cf_author?.trim() || '';

            logger.debug(`Author Name: ${authorName}`);

            let authorId: string = this.DEFAULT_AUTHOR_ID;
            let authorMasterId: string = this.DEFAULT_AUTHOR_MASTER_ID;

            if (authorName && authorName !== '') {
                // Perform search to get author ID
                const query = `name:'${authorName}'`;
                const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${encodeURIComponent(query)}&include=cm_author`;

                logger.debug(`Author Search URL: ${searchUrl}`);

                const authorLookupRes = await axios.get(searchUrl, commonConfig);
                logger.debug(`Author Search Response: ${JSON.stringify(authorLookupRes.data)}`);

                if (authorLookupRes.data && authorLookupRes.data.length > 0) {
                    authorId = authorLookupRes.data[0].id;

                    // Fetch the author record to get cf_author_master
                    const authorUrl = `https://ebsa.myfreshworks.com/crm/sales/api/custom_module/cm_author/${authorId}`;
                    const authorRes = await axios.get(authorUrl, commonConfig);
                    logger.debug(`Author Details Response: ${JSON.stringify(authorRes.data)}`);

                    if (authorRes.data && authorRes.data.cm_author) {
                        authorMasterId = authorRes.data.cm_author.custom_field?.cf_author_master || this.DEFAULT_AUTHOR_MASTER_ID;

                        if (!authorMasterId) {
                            logger.warn("Author master ID not found in author record; using default author master ID.");
                            authorMasterId = this.DEFAULT_AUTHOR_MASTER_ID;
                        }
                    } else {
                        logger.warn("Author record not found; using default author master ID.");
                        authorMasterId = this.DEFAULT_AUTHOR_MASTER_ID;
                    }
                } else {
                    logger.warn("Author not found in search; using default author ID and author master ID.");
                }
            } else {
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
            } else {
                logger.warn("Store code is missing or zero; using default store ID.");
                this.customerAndStoreNameAndAmount.store_id = this.DEFAULT_STORE_ID;
            }

            return authorId;
        } catch (error: any) {
            logger.error("Error processing external API: ", error.response?.data || error.message);
            throw error;
        }
    }

    private async processThematicElements(): Promise<string[]> {
        const genreIds: string[] = [];
        const uniqueGenreIds: string[] = [];

        try {
            // Utilize the fetchThemaDetails function
            const themacode = this.productRes.data.product.custom_field.cf_themacode?.trim();

            if (!themacode) {
                logger.warn("No themacode provided; using default genre ID.");
                return [this.DEFAULT_GENRE_ID];
            }

            const searchTerms = themacode.split('|').map((term: string) => term.trim().toUpperCase());

            for (const term of searchTerms) {
                const query = `name:'${term}'`;
                const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${encodeURIComponent(query)}&include=cm_thema`;

                logger.debug(`Searching for Thema with query: ${query}`);
                const searchResponse = await axios.get<any[]>(searchUrl, {
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
                    const genreSubgenreId = await fetchThemaDetails(themaId);
                    genreIds.push(genreSubgenreId);
                } else {
                    logger.warn(`Thema with code '${term}' not found; using default genre ID.`);
                    genreIds.push(this.DEFAULT_GENRE_ID);
                }
            }

            // Remove duplicates
            const uniqueSet = new Set(genreIds);
            uniqueGenreIds.push(...uniqueSet);

            logger.info(`Unique Genre IDs collected: ${uniqueGenreIds.join(', ')}`);

            return uniqueGenreIds;
        } catch (error: any) {
            logger.error("Error processing thematic elements: ", error.response?.data || error.message);
            return [this.DEFAULT_GENRE_ID];
        }
    }

    private async rollbackCreate(data: General) {
        try {
            await this.deleteGenreTrends(data);
            await this.deleteAuthorTrend(data);
            await this.deleteStoreTrend(data);
            await this.deleteTransaction();
        } catch (error) {
            logger.error('Error during rollback: ', error);
        }
    }

    private async deleteTransaction() {
        try {
            const transactionId = this.transaction.cm_transaction_id;
            if (transactionId) {
                await db.transaction.destroy({
                    where: {
                        transaction_id: transactionId,
                    },
                });
            }
        } catch (error) {
            logger.error('Error during deleteTransaction: ', error);
        }
    }

    private async deleteGenreTrends(data: General) {
        try {
            await db.genretrend.destroy({
                where: { customer_id: data.customer_id, genre_id: data.genre_ids },
            });
        } catch (error) {
            logger.error('Error deleting genre trends from the database: ', error);
        }
    }

    private async deleteAuthorTrend(data: General) {
        try {
            await db.authortrend.destroy({
                where: { customer_id: data.customer_id, author_id: data.author_id },
            });
        } catch (error) {
            logger.error('Error deleting author trend from the database: ', error);
        }
    }

    private async deleteStoreTrend(data: General) {
        try {
            await db.storetrend.destroy({
                where: { customer_id: data.customer_id, store_id: data.store_id },
            });
        } catch (error) {
            logger.error('Error deleting store trend from the database: ', error);
        }
    }

    private async updateTransactionTrendResult(
        transactionId: number,
        author: string | undefined,
        authorTrendStatus: string,
        storeTrendStatus: string,
        genreTrendStatus: string
    ) {
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
            await axios.put(apiUrl, trendResultData, commonConfig);
            logger.info(`Transaction trend result updated.`);
        } catch (error: any) {
            logger.error(`Error updating transaction trend result for ${transactionId}: `, error.response?.data || error.message);
        }
    }

    private finalizeResponse() {
        if (!this.transactionRes.success) {
            this.transactionRes.errorCode = "400";
            this.transactionRes.info = `Error in transaction service ${this.transaction.cm_transaction_id}`;
        }
        logger.debug(`Final response: ${JSON.stringify(this.transactionRes)}`);
    }

    private initializeCustomerAndStoreData(): General {
        logger.debug("Initializing customer and store-related data.");
        return {
            display_name: this.transaction.cm_transaction_id.toString(),
            genre_ids: [], // Initialize as empty array
            author_id: '',
            author_master_id: '', // Initialize as an empty string
            customer_id: 0,
            store_id: '0',
            amount: 0,
        };
    }

    private async checkExistingTransaction() {
        try {
            return await db.transaction.findOne({
                where: {
                    transaction_id: this.transaction.cm_transaction_id,
                },
            });
        } catch (error) {
            logger.error(`Error checking existing transaction: ${error}`);
            throw error;
        }
    }

    private async createTransaction() {
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

            await db.transaction.create(transactionData);
        } catch (error) {
            if (error instanceof ValidationError) {
                logger.error("Validation error creating transaction:", error.errors);
                error.errors.forEach((err) => {
                    this.transactionRes.errorList?.push(err.message);
                });
            } else {
                logger.error("Error creating transaction:", error);
                this.transactionRes.errorList?.push("Error persisting the transaction");
            }
            this.transactionRes.success = false;
            throw error;
        }
    }

    private async updateTransaction(existingTransaction: any) {
        try {
            logger.debug("Updating existing transaction in the database.");

            const updatedTransactionData = {
                customer_id: this.transaction.cm_transaction_cf_customer,
                product_id: this.transaction.cm_transaction_cf_product,
                store_id: this.transaction.cm_transaction_cf_store_code,
                list_price_vat_excl: this.transaction.cm_transaction_cf_list_price_vat_excl,
                units_sold: this.transaction.cm_transaction_cf_units_sold,
            };

            await existingTransaction.update(updatedTransactionData);
        } catch (error) {
            if (error instanceof ValidationError) {
                logger.error("Validation error updating transaction:", error.errors);
                error.errors.forEach((err) => {
                    this.transactionRes.errorList?.push(err.message);
                });
            } else {
                logger.error("Error updating transaction:", error);
                this.transactionRes.errorList?.push("Error updating the transaction");
            }
            this.transactionRes.success = false;
            throw error;
        }
    }
}