const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

const transactionsRouter = require('./routes/transactions');
const mongoUri = process.env.MONGO_URI;
const corsOrigin = process.env.CORS_ORIGIN || '*';

// Middlewares
app.use(bodyParser.json());
app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin }));

app.use('/api/transactions', transactionsRouter);

if (!mongoUri) {
  console.warn('MONGO_URI is not set. API server started without database connection.');
} else {
  mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});