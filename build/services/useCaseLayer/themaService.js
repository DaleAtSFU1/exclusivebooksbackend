"use strict";
// src/services/themaService.ts
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
exports.fetchThemaDetails = void 0;
const axios_1 = __importDefault(require("axios"));
const log4js_1 = __importDefault(require("log4js"));
let logger = log4js_1.default.getLogger();
logger.level = process.env.LOG_LEVEL || 'info';
// Function to fetch thema details
function fetchThemaDetails(themaId) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = process.env.API_KEY;
        const BASE_URL = 'https://ebsa.myfreshworks.com'; // Replace with your actual base URL
        const themaDetailsUrl = `${BASE_URL}/crm/sales/api/custom_module/cm_thema/${themaId}`;
        const config = {
            headers: {
                Authorization: `Token token=${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000, // 10 seconds timeout
        };
        try {
            logger.debug(`Fetching details for Thema ID: ${themaId} from URL: ${themaDetailsUrl}`);
            const response = yield axios_1.default.get(themaDetailsUrl, config);
            logger.debug(`Thema Details Response: ${JSON.stringify(response.data)}`);
            const genreSubgenreId = (_a = response.data.cm_thema.custom_field) === null || _a === void 0 ? void 0 : _a.cf_genre_subgenre;
            if (genreSubgenreId) {
                logger.info(`Retrieved Genre Subgenre ID: ${genreSubgenreId} for Thema: ${response.data.cm_thema.name}`);
                return genreSubgenreId.toString();
            }
            else {
                logger.warn(`Genre Subgenre ID not found for Thema ID: ${themaId}; using default genre ID.`);
                return '31000009917'; // Replace with your DEFAULT_GENRE_ID
            }
        }
        catch (error) {
            logger.error(`Error fetching thema details for Thema ID ${themaId}:`, ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
            throw new Error(`Failed to fetch thema details for Thema ID ${themaId}`);
        }
    });
}
exports.fetchThemaDetails = fetchThemaDetails;
