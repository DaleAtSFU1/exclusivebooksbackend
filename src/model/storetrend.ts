// src/model/storetrend.ts
"use strict";
import { Model, DataTypes, Sequelize } from "sequelize";

export interface StoreTrendAttributes {
  id?: number;
  storeTrend_id: number; // Now required
  customer_id: number;
  store_id: number;
  transaction_count: number;
  amount_spent: number;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  class StoreTrend extends Model<StoreTrendAttributes> implements StoreTrendAttributes {
    public id!: number;
    public storeTrend_id!: number;
    public customer_id!: number;
    public store_id!: number;
    public transaction_count!: number;
    public amount_spent!: number;
  }

  StoreTrend.init(
    {
      id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      storeTrend_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        unique: true,
        field: "storeTrend_id",
      },
      customer_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        field: "customer_id",
      },
      store_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        field: "store_id",
      },
      transaction_count: {
        type: dataTypes.BIGINT,
        allowNull: false,
        field: "transaction_count",
        defaultValue: 1,
      },
      amount_spent: {
        type: dataTypes.FLOAT,
        allowNull: false,
        field: "amount_spent",
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "storetrend",
      freezeTableName: true,
      timestamps: true,
    }
  );

  return StoreTrend;
};
