import db from "../../model/sqlconfig";
import log4js from "log4js";

let logger = log4js.getLogger();
logger.level = process.env.LOG_LEVEL || 'info';

/**
 * Generates a unique genretrend_id by appending a numerical suffix.
 * @param baseId - The base ID to which the suffix is appended.
 * @returns A unique genretrend_id.
 */
export async function generateUniqueGenreTrendId(baseId: string): Promise<string> {
    let uniqueId = baseId;
    let counter = 1;

    // Loop until a unique ID is found
    while (await db.genretrend.findOne({ where: { genretrend_id: uniqueId } })) {
        uniqueId = `${baseId}-${counter}`;
        counter++;
    }

    logger.debug(`Generated unique genretrend_id: ${uniqueId}`);
    return uniqueId;
}