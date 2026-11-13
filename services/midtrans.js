const https = require('https');

class MidtransService {
  constructor() {
    this.serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-t2POl_n-OUb3Xrg-kLCYivwY';
    this.clientKey = process.env.MIDTRANS_CLIENT_KEY || 'Mid-client-5LxtLE2PmYTXuxgl';
    this.isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    this.snapHost = this.isProduction ? 'app.midtrans.com' : 'app.sandbox.midtrans.com';
    this.apiHost = this.isProduction ? 'api.midtrans.com' : 'api.sandbox.midtrans.com';
  }

  getAuthHeader() {
    return 'Basic ' + Buffer.from(this.serverKey + ':').toString('base64');
  }

  /**
   * Request Snap Token dari Midtrans
   */
  async createSnapToken(payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const options = {
        hostname: this.snapHost,
        path: '/snap/v1/transactions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': this.getAuthHeader(),
          'Content-Length': Buffer.byteLength(data),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error_messages ? parsed.error_messages.join(', ') : body));
            }
          } catch (e) {
            reject(new Error('Invalid response from Midtrans: ' + body));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(data);
      req.end();
    });
  }

  /**
   * Cek Status Transaksi ke Midtrans
   */
  async getTransactionStatus(orderId) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.apiHost,
        path: `/v2/${encodeURIComponent(orderId)}/status`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': this.getAuthHeader(),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.end();
    });
  }
}

module.exports = new MidtransService();
