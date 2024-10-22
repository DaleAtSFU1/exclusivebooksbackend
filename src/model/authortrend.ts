// src/model/authortrend.ts

"use strict";
import { Model, DataTypes, Sequelize } from "sequelize";

export interface AuthorTrendAttributes {
  id?: number;
  authorTrend_id: number; // Assuming this remains a number
  customer_id: number;
  author_id: string; // Changed to string
  transaction_count: number;
  amount_spent: number;
}

module.exports = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  class AuthorTrend extends Model<AuthorTrendAttributes> implements AuthorTrendAttributes {
    public id!: number;
    public authorTrend_id!: number;
    public customer_id!: number;
    public author_id!: string; // Changed to string
    public transaction_count!: number;
    public amount_spent!: number;
  }

  AuthorTrend.init(
    {
      id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      authorTrend_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        unique: true,
        field: "authorTrend_id",
      },
      customer_id: {
        type: dataTypes.BIGINT,
        allowNull: false,
        field: "customer_id",
      },
      author_id: {
        type: dataTypes.STRING, // Changed to STRING
        allowNull: false,
        field: "author_id",
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
      modelName: "authortrend",
      freezeTableName: true,
      timestamps: true,
    }
  );

  return AuthorTrend;
};
