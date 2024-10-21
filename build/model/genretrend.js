// src/model/genretrend.ts
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = (sequelize, dataTypes) => {
    class GenreTrend extends sequelize_1.Model {
    }
    GenreTrend.init({
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
    }, {
        sequelize,
        modelName: "genretrend",
        freezeTableName: true,
        timestamps: true,
    });
    return GenreTrend;
};
