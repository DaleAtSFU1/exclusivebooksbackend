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
    // Check if the trend exists in the local database
    const existingTrend = await db.authortrend.findOne({
      where: { author_id: data.author_id, customer_id: data.customer_id },
    });

    if (existingTrend) {
      // Update existing trend
      existingTrend.transaction_count += 1;
      existingTrend.amount_spent += data.amount;
      await existingTrend.save();
    } else {
      // Create new trend
      const newTrend = {
        authorTrend_id: data.display_name,
        author_id: data.author_id,
        customer_id: data.customer_id,
        transaction_count: 1,
        amount_spent: data.amount,
      };
      await db.authortrend.create(newTrend);
    }

    // Prepare data for Freshsales API
    const trendData = {
      cm_author_trend: {
        name: data.display_name,
        custom_field: {
          cf_author_master: data.author_master_id,
          cf_customer: data.customer_id,
          cf_transaction_count: existingTrend ? existingTrend.transaction_count : 1,
          cf_total_spend: existingTrend ? existingTrend.amount_spent : data.amount,
        },
      },
    };

    const apiKey = process.env.API_KEY;
    const commonConfig = {
      headers: {
        Authorization: `Token token=${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // Adjust timeout as needed
    };

    // Perform API call to create/update the author trend
    await axios.post(
      'https://ebsa.myfreshworks.com/crm/sales/api/custom_module/cm_author_trend',
      trendData,
      commonConfig
    );

    logger.info("Author trend created or updated successfully in Freshsales.");
    return 'Success';
  } catch (error: any) {
    logger.error("Error creating or updating author trend:", error.response?.data || error.message);
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
        cf_author_master: authorTrend.author_id,
        cf_customer: authorTrend.customer_id,
        cf_transaction_count: authorTrend.transaction_count,
        cf_total_spend: authorTrend.amount_spent,
      },
    },
  };

  logger.debug(`hehehehe ${JSON.stringify(trendData.cm_author_trend)}`);

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
