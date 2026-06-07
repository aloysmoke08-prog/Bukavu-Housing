require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const logementsRoutes = require('./routes/logements');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Utilisation de helmet pour sécuriser les en-têtes (avec CSP désactivé pour tolérer les CDNs)
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiter pour l'authentification (max 10 requêtes par 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion/inscription. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth', authLimiter);

const allowedOrigins = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : null,
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }
    return callback(new Error('Origine CORS non autorisee.'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de validation CSRF basique par timestamp
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const csrfToken = req.headers['x-csrf-token'];
    if (!csrfToken) {
      return res.status(403).json({ error: 'Requête sécurisée : Token CSRF manquant.' });
    }
    try {
      const decoded = JSON.parse(Buffer.from(csrfToken, 'base64').toString());
      if (!decoded.ts || Math.abs(Date.now() - decoded.ts) > 15 * 60 * 1000) {
        return res.status(403).json({ error: 'Requête sécurisée : Token CSRF expiré ou hors délai.' });
      }
    } catch (e) {
      return res.status(403).json({ error: 'Requête sécurisée : Token CSRF invalide.' });
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/logements', logementsRoutes);
app.use('/api/users', usersRoutes);

const { supabaseAdmin } = require('./config/supabase');

app.get('/api/stats', async (req, res) => {
  try {
    const { count: logementsCount } = await supabaseAdmin
      .from('logements')
      .select('id', { count: 'exact', head: true });

    const { count: usersCount } = await supabaseAdmin
      .from('utilisateurs')
      .select('id', { count: 'exact', head: true });

    const { data: quartiersData } = await supabaseAdmin
      .from('logements')
      .select('quartier');

    const uniqueQuartiers = new Set(quartiersData ? quartiersData.map(q => q.quartier) : []);

    res.json({
      totalLogements: logementsCount || 0,
      totalUsers: usersCount || 0,
      totalQuartiers: uniqueQuartiers.size || 0
    });
  } catch (err) {
    console.error('[GET /stats]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Bukavu Housing API operationnelle' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'accueil.html'));
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log('Serveur sur port ' + PORT));
}

module.exports = app;

