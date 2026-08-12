module.exports = {
  baseUrl: process.env.K6_BASE_URL || "http://localhost:8000",
  thresholds: {
    readP95Ms: 500,
    writeP95Ms: 2000,
    maxErrorRate: 0.01,
  },
};
