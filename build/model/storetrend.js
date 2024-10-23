// src/model/storetrend.ts
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = (sequelize, dataTypes) => {
    class StoreTrend extends sequelize_1.Model {
    }
    StoreTrend.init({
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
    }, {
        sequelize,
        modelName: "storetrend",
        freezeTableName: true,
        timestamps: true,
    });
    return StoreTrend;
};
