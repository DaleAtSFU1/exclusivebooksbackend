"use strict";
// src/services/trends/authorPersistAndPost.ts
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
exports.createOrUpdateAuthorTrend = void 0;
const sqlconfig_1 = __importDefault(require("../../model/sqlconfig"));
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const log4js_1 = __importDefault(require("log4js"));
const sequelize_1 = require("sequelize");
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
// Default Author Master ID for failsafe
const DEFAULT_AUTHOR_MASTER_ID = "31000001028"; // Generic Author Master ID
function createOrUpdateAuthorTrend(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!data.author_id || !data.customer_id || !data.display_name) {
                logger.error('Author ID, customer ID, or transaction ID missing');
                throw new Error('Author ID, customer ID, or transaction ID missing');
            }
            if (data.author_id === "31000001887") { // Assuming this is the DEFAULT_AUTHOR_ID
                logger.warn('Using default author ID for author trend.');
            }
            let authorTrend = yield sqlconfig_1.default.authortrend.findOne({
                where: {
                    author_id: data.author_id,
                    customer_id: data.customer_id,
                },
            });
            if (authorTrend) {
                authorTrend.transaction_count += 1;
                authorTrend.amount_spent += data.amount;
                yield authorTrend.save();
                // Post the updated trend to Freshsales
                yield postAuthorTrendToFreshsales(authorTrend, data);
                return 'Author trend updated';
            }
            else {
                const newAuthorTrendData = {
                    authorTrend_id: data.display_name,
                    author_id: data.author_id,
                    customer_id: data.customer_id,
                    transaction_count: 1,
                    amount_spent: data.amount,
                };
                logger.debug("Creating new author trend:", newAuthorTrendData);
                const newAuthorTrend = yield sqlconfig_1.default.authortrend.create(newAuthorTrendData);
                // Post the new trend to Freshsales
                yield postAuthorTrendToFreshsales(newAuthorTrend, data);
                return 'Author trend created';
            }
        }
        catch (error) {
            if (error instanceof sequelize_1.ValidationError) {
                logger.error('Validation error creating or updating author trend:', error.errors);
            }
            else {
                logger.error('Error creating or updating author trend:', error);
            }
            throw error;
        }
    });
}
exports.createOrUpdateAuthorTrend = createOrUpdateAuthorTrend;
function postAuthorTrendToFreshsales(authorTrend, data) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = process.env.API_KEY;
        const apiUrl = `https://ebsa.myfreshworks.com/crm/sales/api/custom_module/cm_author_trend`;
        const commonConfig = {
            headers: {
                'Authorization': `Token token=${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000, // Increased timeout to 10000ms
        };
        // Prepare the data payload
        const trendData = {
            cm_author_trend: {
                name: authorTrend.authorTrend_id.toString(),
                custom_field: {
                    cf_author: authorTrend.author_id,
                    cf_customer: authorTrend.customer_id,
                    cf_transaction_count: authorTrend.transaction_count,
                    cf_total_spend: authorTrend.amount_spent,
                },
            },
        };
        try {
            // Search for existing author trend
            logger.debug(`Searching for existing author trend in Freshsales.`);
            const query = `cf_customer:${data.customer_id} AND cf_author:${data.author_id}`;
            const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${encodeURIComponent(query)}&include=cm_author_trend`;
            const searchResponse = yield axios_1.default.get(searchUrl, commonConfig);
            let existingRecordId = null;
            if (searchResponse.data && searchResponse.data.length > 0) {
                existingRecordId = searchResponse.data[0].id;
                logger.debug(`Found existing author trend in Freshsales with ID: ${existingRecordId}`);
            }
            let response;
            if (existingRecordId) {
                // Update existing trend in Freshsales
                const updateUrl = `${apiUrl}/${existingRecordId}`;
                response = yield axios_1.default.put(updateUrl, trendData, commonConfig);
                logger.info(`Author trend updated in Freshsales.`);
            }
            else {
                // Create new trend in Freshsales
                response = yield axios_1.default.post(apiUrl, trendData, commonConfig);
                logger.info(`Author trend created in Freshsales.`);
                // Update the local record with the ID from Freshsales
                authorTrend.authorTrend_id = response.data.cm_author_trend.id;
                yield authorTrend.save();
            }
        }
        catch (error) {
            logger.error('Error posting author trend to Freshsales:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    });
}
