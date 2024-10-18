// src/services/themaService.ts

import axios from 'axios';
import { ThemaDetailsResponse } from '../../interfaces/ThemaDetails';
import log4js from 'log4js';

let logger = log4js.getLogger();
logger.level = process.env.LOG_LEVEL || 'info';

// Function to fetch thema details
export async function fetchThemaDetails(themaId: number): Promise<string> {
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
        const response = await axios.get<ThemaDetailsResponse>(themaDetailsUrl, config);
        logger.debug(`Thema Details Response: ${JSON.stringify(response.data)}`);

        const genreSubgenreId = response.data.cm_thema.custom_field?.cf_genre_subgenre;

        if (genreSubgenreId) {
            logger.info(`Retrieved Genre Subgenre ID: ${genreSubgenreId} for Thema: ${response.data.cm_thema.name}`);
            return genreSubgenreId.toString();
        } else {
            logger.warn(`Genre Subgenre ID not found for Thema ID: ${themaId}; using default genre ID.`);
            return '31000009917'; // Replace with your DEFAULT_GENRE_ID
        }
    } catch (error: any) {
        logger.error(`Error fetching thema details for Thema ID ${themaId}:`, error.response?.data || error.message);
        throw new Error(`Failed to fetch thema details for Thema ID ${themaId}`);
    }
}