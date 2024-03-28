const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

const transactionsRouter = require('./routes/transactions');

// Middlewares
app.use(bodyParser.json());
app.use(cors());

app.use('/api/transactions', transactionsRouter);

// Connect to MongoDB
mongoose.connect('mongodb://localhost/personalBudgetDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});