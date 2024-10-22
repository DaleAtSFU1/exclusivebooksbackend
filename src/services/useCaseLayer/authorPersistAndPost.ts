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

// Default Author Master ID for failsafe
const DEFAULT_AUTHOR_MASTER_ID = "31000001028"; // Generic Author Master ID

export async function createOrUpdateAuthorTrend(data: General) {
  logger.debug('createOrUpdateAuthorTrend called with data:', JSON.stringify(data, null, 2));

  try {
    // Validation: Check for essential fields
    if (!data.author_id || !data.customer_id || !data.display_name) {
      logger.error('Author ID, customer ID, or transaction ID missing', { data });
      throw new Error('Author ID, customer ID, or transaction ID missing');
    }

    // Warning if default author ID is used
    if (data.author_id === "31000001887") { // Assuming this is the DEFAULT_AUTHOR_ID
      logger.warn('Using default author ID for author trend.', { author_id: data.author_id });
    }

    // Log the search parameters
    logger.debug('Searching for existing author trend in the database.', {
      author_id: data.author_id,
      customer_id: data.customer_id,
    });

    // Search for existing author trend in the database
    let authorTrend = await db.authortrend.findOne({
      where: {
        author_id: data.author_id,
        customer_id: data.customer_id,
      },
    });

    if (authorTrend) {
      logger.info('Existing author trend found. Updating record.', { authorTrendId: authorTrend.id });

      // Log current state before update
      logger.debug('Author trend before update:', {
        transaction_count: authorTrend.transaction_count,
        amount_spent: authorTrend.amount_spent,
      });

      // Update the author trend
      authorTrend.transaction_count += 1;
      authorTrend.amount_spent += data.amount;

      // Log updated state
      logger.debug('Author trend after update:', {
        transaction_count: authorTrend.transaction_count,
        amount_spent: authorTrend.amount_spent,
      });

      // Save the updated author trend
      await authorTrend.save();

      // Post the updated trend to Freshsales
      await postAuthorTrendToFreshsales(authorTrend, data);

      logger.info('Author trend successfully updated.', { authorTrendId: authorTrend.id });
      return 'Author trend updated';
    } else {
      // Prepare data for new author trend
      const newAuthorTrendData = {
        authorTrend_id: data.display_name, // Use transaction ID as authorTrend_id
        author_id: data.author_id,
        customer_id: data.customer_id,
        transaction_count: 1,
        amount_spent: data.amount,
      };

      // Log the creation data
      logger.debug("Creating new author trend with data:", newAuthorTrendData);

      // Create the new author trend in the database
      const newAuthorTrend = await db.authortrend.create(newAuthorTrendData);

      logger.info('New author trend created in the database.', { authorTrendId: newAuthorTrend.id });

      // Post the new trend to Freshsales
      await postAuthorTrendToFreshsales(newAuthorTrend, data);

      logger.info('Author trend successfully posted to Freshsales.', { authorTrendId: newAuthorTrend.id });
      return 'Author trend created';
    }
  } catch (error: any) {
    if (error instanceof ValidationError) {
      logger.error('Validation error creating or updating author trend:', {
        errors: error.errors.map(e => e.message),
        data,
      });
    } else {
      logger.error('Error creating or updating author trend:', {
        message: error.message,
        stack: error.stack,
        data,
      });
    }
    throw error;
  }
}

async function postAuthorTrendToFreshsales(authorTrend: any, data: General) {
  logger.debug('postAuthorTrendToFreshsales called with authorTrend:', {
    authorTrendId: authorTrend.authorTrend_id,
    author_id: authorTrend.author_id,
    customer_id: authorTrend.customer_id,
    transaction_count: authorTrend.transaction_count,
    amount_spent: authorTrend.amount_spent,
  });

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    logger.error('API_KEY is not set in environment variables.');
    throw new Error('API_KEY is not set');
  }

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

  logger.debug('Prepared payload for Freshsales:', trendData);

  try {
    // Construct the search query
    const query = `cf_customer:${data.customer_id} AND cf_author:${data.author_id}`;
    const searchUrl = `https://ebsa.myfreshworks.com/crm/sales/api/search?q=${encodeURIComponent(query)}&include=cm_author_trend`;

    logger.debug(`Searching for existing author trend in Freshsales. Query: ${query}`);
    logger.debug('Search URL:', { searchUrl });

    // Search for existing author trend in Freshsales
    const searchResponse = await axios.get(searchUrl, commonConfig);

    logger.debug('Received search response from Freshsales:', {
      status: searchResponse.status,
      data: searchResponse.data,
    });

    let existingRecordId = null;
    if (searchResponse.data && searchResponse.data.length > 0) {
      existingRecordId = searchResponse.data[0].id;
      logger.info(`Found existing author trend in Freshsales with ID: ${existingRecordId}`);
    }

    let response;
    if (existingRecordId) {
      // Update existing trend in Freshsales
      const updateUrl = `${apiUrl}/${existingRecordId}`;
      logger.debug('Updating existing author trend in Freshsales:', { updateUrl, trendData });

      response = await axios.put(updateUrl, trendData, commonConfig);

      logger.debug('Received response from Freshsales update:', {
        status: response.status,
        data: response.data,
      });

      logger.info(`Author trend updated in Freshsales with ID: ${existingRecordId}`);
    } else {
      // Create new trend in Freshsales
      logger.debug('Creating new author trend in Freshsales:', { apiUrl, trendData });

      response = await axios.post(apiUrl, trendData, commonConfig);

      logger.debug('Received response from Freshsales create:', {
        status: response.status,
        data: response.data,
      });

      logger.info(`Author trend created in Freshsales with ID: ${response.data.cm_author_trend.id}`);

      // Update the local record with the ID from Freshsales
      authorTrend.authorTrend_id = response.data.cm_author_trend.id;
      await authorTrend.save();

      logger.debug('Updated local author trend with Freshsales ID:', {
        authorTrendId: authorTrend.authorTrend_id,
      });
    }
  } catch (error: any) {
    logger.error('Error posting author trend to Freshsales:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
      } : null,
      stack: error.stack,
    });
    throw error;
  }
}