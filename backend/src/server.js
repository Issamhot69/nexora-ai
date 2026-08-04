require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const organizationsRoutes = require('./routes/organizations');
const companiesRoutes = require('./routes/companies');
const contactsRoutes = require('./routes/contacts');
const dealsRoutes = require('./routes/deals');
const quotesRoutes = require('./routes/quotes');
const invoicesRoutes = require('./routes/invoices');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Nexora AI backend en ligne' });
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Trop de tentatives, reessayez plus tard' } });
app.use('/auth', authLimiter, authRoutes);
app.use('/organizations', organizationsRoutes);
app.use(companiesRoutes);
app.use(contactsRoutes);
app.use(dealsRoutes);
app.use(quotesRoutes);
app.use(invoicesRoutes);

const PORT = process.env.PORT || 4095;
app.listen(PORT, () => {
  console.log(`Serveur Nexora AI demarre sur http://localhost:${PORT}`);
});
