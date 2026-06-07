const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou invalide.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'X7mQ!9vLp2Rz#Kc8Nw4Tg@Yf6JhDs1BaE5uMn3Px');
    const { data: user, error } = await supabaseAdmin
      .from('utilisateurs')
      .select('id, nom, email, whatsapp, telephone, telephone2, email_contact, avatar_url, bio, verifie')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Utilisateur introuvable.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expiré ou invalide.' });
  }
};

const authOptional = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'X7mQ!9vLp2Rz#Kc8Nw4Tg@Yf6JhDs1BaE5uMn3Px');
    const { data: user } = await supabaseAdmin
      .from('utilisateurs')
      .select('id, nom, email')
      .eq('id', decoded.userId)
      .single();
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
};

module.exports = { authMiddleware, authOptional };
