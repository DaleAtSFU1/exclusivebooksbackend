// src/model/sqlconfig.ts
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sequelize_1 = require("sequelize");
const basename = path_1.default.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.js")[env];
const db = {};
let sequelize;
if (config.use_env_variable) {
    sequelize = new sequelize_1.Sequelize(process.env[config.use_env_variable], config);
}
else {
    sequelize = new sequelize_1.Sequelize(config.database, config.username, config.password, config);
}
// Load all model files
fs_1.default.readdirSync(__dirname)
    .filter((file) => {
    return (file.indexOf(".") !== 0 &&
        file !== basename &&
        (file.endsWith(".ts") || file.endsWith(".js")));
})
    .forEach((file) => {
    const model = require(path_1.default.join(__dirname, file))(sequelize, sequelize_1.DataTypes);
    db[model.name] = model;
    console.log(`Loaded model: ${model.name}`); // For debugging
});
Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});
db.sequelize = sequelize;
db.Sequelize = sequelize_1.Sequelize;
exports.default = db;
