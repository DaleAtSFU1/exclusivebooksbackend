// src/model/transaction.ts
"use strict";
import { Model, DataTypes, Sequelize } from "sequelize";

export interface TransactionAttributes {
  id?: number;
  transaction_id: number;
  customer_id: number;
  product_id: number;
  store_id: number;
  list_price_vat_excl: number;
  units_sold: number;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  class Transaction extends Model<TransactionAttributes> implements TransactionAttributes {
    public id!: number;
    public transaction_id!: number;
    public customer_id!: number;
    public product_id!: number;
    public store_id!: number;
    public list_price_vat_excl!: number;
    public units_sold!: number;
  }

  Transaction.init(
    {
      id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      transaction_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        unique: true,
        field: "transaction_id",
      },
      customer_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        field: "customer_id",
      },
      product_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        field: "product_id",
      },
      store_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        field: "store_id",
      },
      list_price_vat_excl: {
        type: dataTypes.FLOAT,
        allowNull: false,
        field: "list_price_vat_excl",
      },
      units_sold: {
        type: dataTypes.INTEGER,
        allowNull: false,
        field: "units_sold",
        defaultValue: 1,
      },
    },
    {
      sequelize,
      modelName: "transaction",
      freezeTableName: true,
      timestamps: true,
    }
  );

  return Transaction;
};
