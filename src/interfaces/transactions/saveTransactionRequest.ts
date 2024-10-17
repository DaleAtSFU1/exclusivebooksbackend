export interface SaveTransactionRequest {
    cm_transaction_id: number;
    cm_transaction_cf_customer: number;
    cm_transaction_cf_product: number;
    cm_transaction_cf_store_code: number;
    cm_transaction_cf_units_sold: number;
    cm_transaction_cf_list_price_vat_excl: number;
}