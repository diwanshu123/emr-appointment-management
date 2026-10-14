const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.disable('x-powered-by');
if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);
app.use(helmet());
app.use(cors({ origin: env.clientOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (env.NODE_ENV !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.get('/health', (req, res) =>
  res.json({ success: true, message: 'OK', data: { uptime: process.uptime() }, meta: {} })
);
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
