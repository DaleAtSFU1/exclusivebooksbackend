// src/model/transaction.ts
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = (sequelize, dataTypes) => {
    class Transaction extends sequelize_1.Model {
    }
    Transaction.init({
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
    }, {
        sequelize,
        modelName: "transaction",
        freezeTableName: true,
        timestamps: true,
    });
    return Transaction;
};
