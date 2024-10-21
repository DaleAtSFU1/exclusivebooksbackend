"use strict";
// src/services/trends/storePersistAndPost.ts
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
exports.createOrUpdateStoreTrend = void 0;
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
// Default Store ID for failsafe
const DEFAULT_STORE_ID = "31000217958"; // Generic Store ID
function createOrUpdateStoreTrend(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!data.store_id || !data.customer_id || !data.display_name) {
                logger.error('Store ID, customer ID, or transaction ID missing');
                throw new Error('Store ID, customer ID, or transaction ID missing');
            }
            if (data.store_id === DEFAULT_STORE_ID) {
                logger.warn('Using default store ID for store trend.');
            }
            let storeTrend = yield sqlconfig_1.default.storetrend.findOne({
                where: {
                    store_id: data.store_id,
                    customer_id: data.customer_id,
                },
            });
            if (storeTrend) {
                storeTrend.transaction_count += 1;
                storeTrend.amount_spent += data.amount;
                yield storeTrend.save();
                // Post the updated trend to Freshsales
                yield postStoreTrendToFreshsales(storeTrend, data);
                return 'Store trend updated';
            }
            else {
                const newStoreTrendData = {
                    storeTrend_id: data.display_name,
                    store_id: data.store_id,
                    customer_id: data.customer_id,
                    transaction_count: 1,
                    amount_spent: data.amount,
                };
                logger.debug("Creating new store trend:", newStoreTrendData);
                const newStoreTrend = yield sqlconfig_1.default.storetrend.create(newStoreTrendData);
                // Post the new trend to Freshsales
                yield postStoreTrendToFreshsales(newStoreTrend, data);
                return 'Store trend created';
            }
        }
        catch (error) {
            if (error instanceof sequelize_1.ValidationError) {
                logger.error('Validation error creating or updating store trend:', error.errors);
            }
            else {
                logger.error('Error creating or updating store trend:', error);
            }
            throw error;
        }
    });
}
exports.createOrUpdateStoreTrend = createOrUpdateStoreTrend;
function postStoreTrendToFreshsales(storeTrend, data) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = process.env.API_KEY;
        const apiUrl = `https://ebsa.myfreshworks.com/crm/sales/api/custom_module/cm_store_trend`;
        const commonConfig = {
            headers: {
                'Authorization': `Token token=${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000, // Increased timeout to 10000ms
        };
        // Prepare the data payload
        const trendData = {
            cm_store_trend: {
                name: storeTrend.storeTrend_id.toString(),
                custom_field: {
                    cf_store: storeTrend.store_id,
                    cf_customer: storeTrend.customer_id,
                    cf_transaction_count: storeTrend.transaction_count,
                    cf_total_spend: storeTrend.amount_spent,
                },
            },
        };
        try {
            // Search for existing store trend
            logger.debug(`Searching for existing store trend in Freshsales.`);
            const query = `cf_customer:${data.customer_id} AND cf_store:${data.store_id}`;
            const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${encodeURIComponent(query)}&include=cm_store_trend`;
            const searchResponse = yield axios_1.default.get(searchUrl, commonConfig);
            let existingRecordId = null;
            if (searchResponse.data && searchResponse.data.length > 0) {
                existingRecordId = searchResponse.data[0].id;
                logger.debug(`Found existing store trend in Freshsales with ID: ${existingRecordId}`);
            }
            let response;
            if (existingRecordId) {
                // Update existing trend in Freshsales
                const updateUrl = `${apiUrl}/${existingRecordId}`;
                response = yield axios_1.default.put(updateUrl, trendData, commonConfig);
                logger.info(`Store trend updated in Freshsales.`);
            }
            else {
                // Create new trend in Freshsales
                response = yield axios_1.default.post(apiUrl, trendData, commonConfig);
                logger.info(`Store trend created in Freshsales.`);
                // Update the local record with the ID from Freshsales
                storeTrend.storeTrend_id = response.data.cm_store_trend.id;
                yield storeTrend.save();
            }
        }
        catch (error) {
            logger.error('Error posting store trend to Freshsales:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    });
}
