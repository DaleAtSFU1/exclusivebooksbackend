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
exports.generateUniqueGenreTrendId = void 0;
const sqlconfig_1 = __importDefault(require("../../model/sqlconfig"));
const log4js_1 = __importDefault(require("log4js"));
let logger = log4js_1.default.getLogger();
logger.level = process.env.LOG_LEVEL || 'info';
/**
 * Generates a unique genretrend_id by appending a numerical suffix.
 * @param baseId - The base ID to which the suffix is appended.
 * @returns A unique genretrend_id.
 */
function generateUniqueGenreTrendId(baseId) {
    return __awaiter(this, void 0, void 0, function* () {
        let uniqueId = baseId;
        let counter = 1;
        // Loop until a unique ID is found
        while (yield sqlconfig_1.default.genretrend.findOne({ where: { genretrend_id: uniqueId } })) {
            uniqueId = `${baseId}-${counter}`;
            counter++;
        }
        logger.debug(`Generated unique genretrend_id: ${uniqueId}`);
        return uniqueId;
    });
}
exports.generateUniqueGenreTrendId = generateUniqueGenreTrendId;
