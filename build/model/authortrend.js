// src/model/authortrend.ts
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = (sequelize, dataTypes) => {
    class AuthorTrend extends sequelize_1.Model {
    }
    AuthorTrend.init({
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
            type: dataTypes.STRING,
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
    }, {
        sequelize,
        modelName: "authortrend",
        freezeTableName: true,
        timestamps: true,
    });
    return AuthorTrend;
};
