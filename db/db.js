const mysql = require('mysql');
const { HOST } = require('./db.config');
const config = require('./db.config');
var connection = mysql.createPool({
    host: config.HOST,
    user: config.USER,
    password: config.PASSWORD,
    database: config.DB
});
module.exports = connection;