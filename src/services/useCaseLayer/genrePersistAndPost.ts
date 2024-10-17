// src/services/transactions/genrePersistAndPost.ts

import { General } from "../../interfaces/trends/trendsAll";
import db from "../../model/sqlconfig";
import axios from "axios";
import axiosRetry from "axios-retry";
import log4js from "log4js";
import { ValidationError } from "sequelize";

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

// Default Genre ID for failsafe
const DEFAULT_GENRE_ID = 31000009917; // Generic Genre ID

export async function createOrUpdateGenreTrend(data: General) {
  try {
    if (!data.genre_id || !data.customer_id || !data.display_name) {
      logger.error('Genre ID, customer ID, or transaction ID missing');
      throw new Error('Genre ID, customer ID, or transaction ID missing');
    }

    if (data.genre_id === DEFAULT_GENRE_ID) {
      logger.warn('Using default genre ID for genre trend.');
    }

    let genreTrend = await db.genretrend.findOne({
      where: {
        genre_id: data.genre_id,
        customer_id: data.customer_id,
      },
    });

    if (genreTrend) {
      genreTrend.transaction_count += 1;
      genreTrend.amount_spent += data.amount;
      await genreTrend.save();

      // Post the updated trend to Freshsales
      await postGenreTrendToFreshsales(genreTrend, data);

      return 'Genre trend updated';
    } else {
      const newGenreTrendData = {
        genretrend_id: data.display_name, // Use transaction ID as genretrend_id
        genre_id: data.genre_id,
        customer_id: data.customer_id,
        transaction_count: 1,
        amount_spent: data.amount,
      };

      logger.debug("Creating new genre trend:", newGenreTrendData);

      const newGenreTrend = await db.genretrend.create(newGenreTrendData);

      // Post the new trend to Freshsales
      await postGenreTrendToFreshsales(newGenreTrend, data);

      return 'Genre trend created';
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error('Validation error creating or updating genre trend:', error.errors);
    } else {
      logger.error('Error creating or updating genre trend:', error);
    }
    throw error;
  }
}

async function postGenreTrendToFreshsales(genreTrend: any, data: General) {
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
        cf_genre: genreTrend.genre_id,
        cf_customer: genreTrend.customer_id,
        cf_transaction_count: genreTrend.transaction_count,
        cf_amount_spent: genreTrend.amount_spent,
      },
    },
  };

  try {
    // Search for existing genre trend
    logger.debug(`Searching for existing genre trend in Freshsales.`);
    const query = `cf_customer:${data.customer_id} AND cf_genre:${data.genre_id}`;
    const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${encodeURIComponent(query)}&include=cm_genre_trend`;

    const searchResponse = await axios.get(searchUrl, commonConfig);

    let existingRecordId = null;
    if (searchResponse.data && searchResponse.data.length > 0) {
      existingRecordId = searchResponse.data[0].id;
      logger.debug(`Found existing genre trend in Freshsales with ID: ${existingRecordId}`);
    }

    let response;
    if (existingRecordId) {
      // Update existing trend in Freshsales
      const updateUrl = `${apiUrl}/${existingRecordId}`;
      response = await axios.put(updateUrl, trendData, commonConfig);
      logger.info(`Genre trend updated in Freshsales.`);
    } else {
      // Create new trend in Freshsales
      response = await axios.post(apiUrl, trendData, commonConfig);
      logger.info(`Genre trend created in Freshsales.`);
      // Update the local record with the ID from Freshsales
      genreTrend.genretrend_id = response.data.cm_genre_trend.id;
      await genreTrend.save();
    }
  } catch (error:any) {
    logger.error('Error posting genre trend to Freshsales:', error.response?.data || error.message);
    throw error;
  }
}
