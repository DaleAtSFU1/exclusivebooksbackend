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
exports.createOrUpdateGenreTrend = void 0;
const sqlconfig_1 = __importDefault(require("../../model/sqlconfig"));
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const log4js_1 = __importDefault(require("log4js"));
const sequelize_1 = require("sequelize");
const genreTrendService_1 = require("./genreTrendService"); // Import the helper
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
// Default Genre ID for failsafe
const DEFAULT_GENRE_ID = "31000009917"; // Generic Genre ID
function createOrUpdateGenreTrend(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!data.genre_id || !data.customer_id || !data.display_name) {
                logger.error('Genre ID, customer ID, or transaction ID missing');
                throw new Error('Genre ID, customer ID, or transaction ID missing');
            }
            if (data.genre_id === DEFAULT_GENRE_ID) {
                logger.warn('Using default genre ID for genre trend.');
            }
            let genreTrend = yield sqlconfig_1.default.genretrend.findOne({
                where: {
                    genre_id: data.genre_id,
                    customer_id: data.customer_id,
                },
            });
            if (genreTrend) {
                // Update existing genre trend
                genreTrend.transaction_count += 1;
                genreTrend.amount_spent += data.amount;
                yield genreTrend.save();
                // Post the updated trend to Freshsales
                yield postGenreTrendToFreshsales(genreTrend, data);
                return 'Genre trend updated';
            }
            else {
                // Generate a unique genretrend_id
                const uniqueGenreTrendId = yield (0, genreTrendService_1.generateUniqueGenreTrendId)(data.display_name);
                const newGenreTrendData = {
                    genretrend_id: uniqueGenreTrendId,
                    genre_id: data.genre_id,
                    customer_id: data.customer_id,
                    transaction_count: 1,
                    amount_spent: data.amount,
                };
                logger.debug("Creating new genre trend:", newGenreTrendData);
                const newGenreTrend = yield sqlconfig_1.default.genretrend.create(newGenreTrendData);
                // Post the new trend to Freshsales
                yield postGenreTrendToFreshsales(newGenreTrend, data);
                return 'Genre trend created';
            }
        }
        catch (error) {
            if (error instanceof sequelize_1.ValidationError) {
                logger.error('Validation error creating or updating genre trend:', error.errors);
            }
            else {
                logger.error('Error creating or updating genre trend:', error);
            }
            throw error;
        }
    });
}
exports.createOrUpdateGenreTrend = createOrUpdateGenreTrend;
function postGenreTrendToFreshsales(genreTrend, data) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = process.env.API_KEY;
        const apiUrl = `https://ebsa.myfreshworks.com/crm/sales/api/custom_module/cm_genre_trend`;
        const commonConfig = {
            headers: {
                'Authorization': `Token token=${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000, // Increased timeout to 10000ms
        };
        // Prepare the data payload
        const trendData = {
            cm_genre_trend: {
                name: genreTrend.genretrend_id.toString(),
                custom_field: {
                    cf_genre_subgenre: genreTrend.genre_id,
                    cf_customer: genreTrend.customer_id,
                    cf_transaction_count: genreTrend.transaction_count,
                    cf_total_spend: genreTrend.amount_spent,
                },
            },
        };
        try {
            // Search for existing genre trend
            logger.debug(`Searching for existing genre trend in Freshsales.`);
            const query = `cf_customer:${data.customer_id} AND cf_genre_subgenre:${data.genre_id}`;
            const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${encodeURIComponent(query)}&include=cm_genre_trend`;
            const searchResponse = yield axios_1.default.get(searchUrl, commonConfig);
            let existingRecordId = null;
            if (searchResponse.data && searchResponse.data.length > 0) {
                existingRecordId = searchResponse.data[0].id;
                logger.debug(`Found existing genre trend in Freshsales with ID: ${existingRecordId}`);
            }
            let response;
            if (existingRecordId) {
                // Update existing trend in Freshsales
                const updateUrl = `${apiUrl}/${existingRecordId}`;
                response = yield axios_1.default.put(updateUrl, trendData, commonConfig);
                logger.info(`Genre trend updated in Freshsales.`);
            }
            else {
                // Create new trend in Freshsales
                response = yield axios_1.default.post(apiUrl, trendData, commonConfig);
                logger.info(`Genre trend created in Freshsales.`);
                // Update the local record with the ID from Freshsales
                genreTrend.genretrend_id = response.data.cm_genre_trend.id;
                yield genreTrend.save();
            }
        }
        catch (error) {
            logger.error('Error posting genre trend to Freshsales:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
            throw error;
        }
    });
}
