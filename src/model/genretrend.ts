// src/model/genretrend.ts
"use strict";
import { Model, DataTypes, Sequelize } from "sequelize";

export interface GenreTrendAttributes {
  id?: number;
  genretrend_id: number; // Now required
  customer_id: number;
  genre_id: number;
  transaction_count: number;
  amount_spent: number;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  class GenreTrend extends Model<GenreTrendAttributes> implements GenreTrendAttributes {
    public id!: number;
    public genretrend_id!: number;
    public customer_id!: number;
    public genre_id!: number;
    public transaction_count!: number;
    public amount_spent!: number;
  }

  GenreTrend.init(
    {
      id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      genretrend_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        unique: false,
        field: "genretrend_id",
      },
      customer_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        field: "customer_id",
      },
      genre_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        field: "genre_id",
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
      modelName: "genretrend",
      freezeTableName: true,
      timestamps: true,
    }
  );

  return GenreTrend;
};
