const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const appJson = require('./app.json');

const DEFAULT_QR_PREFIX = 'qrtok_';

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      qrTokenPrefix: process.env.QR_TOKEN_PREFIX?.trim() || DEFAULT_QR_PREFIX,
    },
  },
};
