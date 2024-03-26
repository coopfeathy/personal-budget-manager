// models/Transaction.js

const mongoose = require('mongoose');

// Schema definition
const TransactionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    }
});

// Model creation
const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;
