import express from 'express';

const app = express();
const port = process.env.PORT || 8080;

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
