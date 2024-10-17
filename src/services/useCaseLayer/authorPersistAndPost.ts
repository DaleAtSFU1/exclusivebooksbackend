// src/services/transactions/authorPersistAndPost.ts

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
  retries: 3, // Number of retries
  retryDelay: axiosRetry.exponentialDelay, // Retry delay strategy
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNABORTED';
  },
});

export async function createOrUpdateAuthorTrend(data: General) {
  try {
    if (!data.author_id || !data.customer_id || !data.display_name) {
      logger.error('Author ID, customer ID, or transaction ID missing');
      throw new Error('Author ID, customer ID, or transaction ID missing');
    }

    // Ensure author_id is a string
    if (typeof data.author_id !== 'string') {
      logger.error('author_id must be a string');
      throw new Error('author_id must be a string');
    }

    let authorTrend = await db.authortrend.findOne({
      where: {
        author_id: data.author_id,
        customer_id: data.customer_id,
      },
    });

    if (authorTrend) {
      authorTrend.transaction_count += 1;
      authorTrend.amount_spent += data.amount;
      await authorTrend.save();

      // Post the updated trend to Freshsales
      await postAuthorTrendToFreshsales(authorTrend, data);

      return 'Author trend updated';
    } else {
      const newAuthorTrendData = {
        authorTrend_id: data.display_name, // Use transaction ID as authorTrend_id
        author_id: data.author_id,
        customer_id: data.customer_id,
        transaction_count: 1,
        amount_spent: data.amount,
      };

      logger.debug("Creating new author trend:", newAuthorTrendData);

      const newAuthorTrend = await db.authortrend.create(newAuthorTrendData);

      // Post the new trend to Freshsales
      await postAuthorTrendToFreshsales(newAuthorTrend, data);

      return 'Author trend created';
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error('Validation error creating or updating author trend:', error.errors);
    } else {
      logger.error('Error creating or updating author trend:', error);
    }
    throw error;
  }
}

async function postAuthorTrendToFreshsales(authorTrend: any, data: General) {
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
        cf_amount_spent: authorTrend.amount_spent,
      },
    },
  };

  try {
    // First, search for an existing record in Freshsales
    logger.debug(`Searching for existing author trend in Freshsales.`);
    const query = `cf_customer:${data.customer_id} AND cf_author:'${data.author_id}'`;
    const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${encodeURIComponent(query)}&include=cm_author_trend`;

    const searchResponse = await axios.get(searchUrl, commonConfig);

    let existingRecordId = null;
    if (searchResponse.data && searchResponse.data.length > 0) {
      existingRecordId = searchResponse.data[0].id;
      logger.debug(`Found existing author trend in Freshsales with ID: ${existingRecordId}`);
    }

    let response;
    if (existingRecordId) {
      // Update existing trend in Freshsales using the retrieved ID
      const updateUrl = `${apiUrl}/${existingRecordId}`;
      response = await axios.put(updateUrl, trendData, commonConfig);
      logger.info(`Author trend updated in Freshsales.`);
    } else {
      // Create new trend in Freshsales
      response = await axios.post(apiUrl, trendData, commonConfig);
      logger.info(`Author trend created in Freshsales.`);
      // Update the local record with the ID from Freshsales
      authorTrend.authorTrend_id = response.data.cm_author_trend.id;
      await authorTrend.save();
    }
  } catch (error:any) {
    logger.error('Error posting author trend to Freshsales:', error.response?.data || error.message);
    throw error;
  }
}
