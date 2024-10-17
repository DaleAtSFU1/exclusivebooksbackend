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

// Default Store ID for failsafe
const DEFAULT_STORE_ID = "31000217958"; // Generic Store ID

export async function createOrUpdateStoreTrend(data: General) {
  try {
    if (!data.store_id || !data.customer_id || !data.display_name) {
      logger.error('Store ID, customer ID, or transaction ID missing');
      throw new Error('Store ID, customer ID, or transaction ID missing');
    }

    if (data.store_id === DEFAULT_STORE_ID) {
      logger.warn('Using default store ID for store trend.');
    }

    let storeTrend = await db.storetrend.findOne({
      where: {
        store_id: data.store_id,
        customer_id: data.customer_id,
      },
    });

    if (storeTrend) {
      storeTrend.transaction_count += 1;
      storeTrend.amount_spent += data.amount;
      await storeTrend.save();

      // Post the updated trend to Freshsales
      await postStoreTrendToFreshsales(storeTrend, data);

      return 'Store trend updated';
    } else {
      const newStoreTrendData = {
        storeTrend_id: data.display_name, // Use transaction ID as storeTrend_id
        store_id: data.store_id,
        customer_id: data.customer_id,
        transaction_count: 1,
        amount_spent: data.amount,
      };

      logger.debug("Creating new store trend:", newStoreTrendData);

      const newStoreTrend = await db.storetrend.create(newStoreTrendData);

      // Post the new trend to Freshsales
      await postStoreTrendToFreshsales(newStoreTrend, data);

      return 'Store trend created';
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error('Validation error creating or updating store trend:', error.errors);
    } else {
      logger.error('Error creating or updating store trend:', error);
    }
    throw error;
  }
}

async function postStoreTrendToFreshsales(storeTrend: any, data: General) {
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

    const searchResponse = await axios.get(searchUrl, commonConfig);

    let existingRecordId = null;
    if (searchResponse.data && searchResponse.data.length > 0) {
      existingRecordId = searchResponse.data[0].id;
      logger.debug(`Found existing store trend in Freshsales with ID: ${existingRecordId}`);
    }

    let response;
    if (existingRecordId) {
      // Update existing trend in Freshsales
      const updateUrl = `${apiUrl}/${existingRecordId}`;
      response = await axios.put(updateUrl, trendData, commonConfig);
      logger.info(`Store trend updated in Freshsales.`);
    } else {
      // Create new trend in Freshsales
      response = await axios.post(apiUrl, trendData, commonConfig);
      logger.info(`Store trend created in Freshsales.`);
      // Update the local record with the ID from Freshsales
      storeTrend.storeTrend_id = response.data.cm_store_trend.id;
      await storeTrend.save();
    }
  } catch (error:any) {
    logger.error('Error posting store trend to Freshsales:', error.response?.data || error.message);
    throw error;
  }
}
