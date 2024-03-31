// routes/transactions.js

const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

// Create a transaction
router.post('/', async (req, res) => {
    const transaction = new Transaction(req.body);
    try {
        const savedTransaction = await transaction.save();
        res.status(200).json(savedTransaction);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all transactions
router.get('/', async (req, res) => {
    const { page = 1, limit = 10 } = req.query; // Default page 1 and limit 10
    try {
        const transactions = await Transaction.find()
                               .limit(limit * 1)
                               .skip((page - 1) * limit)
                               .exec();
        const count = await Transaction.countDocuments();
        res.json({
            transactions,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get a single transaction
router.get('/:id', getTransaction, (req, res) => {
    res.json(res.transaction);
});

// Update a transaction
router.patch('/:id', getTransaction, async (req, res) => {
    if (req.body.title != null) {
        res.transaction.title = req.body.title;
    }
    if (req.body.amount != null) {
        res.transaction.amount = req.body.amount;
    }
    // Add more fields as necessary
    try {
        const updatedTransaction = await res.transaction.save();
        res.json(updatedTransaction);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a transaction
router.delete('/:id', getTransaction, async (req, res) => {
    try {
        await res.transaction.remove();
        res.json({ message: 'Deleted Transaction' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Middleware to get transaction by ID
async function getTransaction(req, res, next) {
    let transaction;
    try {
        transaction = await Transaction.findById(req.params.id);
        if (transaction == null) {
            return res.status(404).json({ message: 'Cannot find transaction' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }

    res.transaction = transaction;
    next();
}

module.exports = router;
