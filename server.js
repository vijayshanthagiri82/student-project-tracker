
import express from 'express';

const app = express();

// Serve existing HTML, CSS and JavaScript files
app.use(express.static('public'));

// Allow JSON request bodies up to 10 KB
app.use(express.json({ limit: '10kb' }));

// Health check API route
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Keep the existing port configuration
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
