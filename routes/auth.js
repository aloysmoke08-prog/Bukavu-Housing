const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { supabaseAdmin } = require('../config/supabase');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function genToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// Configuration de Nodemailer pour l'envoi de mail de réinitialisation
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'ethereal_user',
    pass: process.env.SMTP_PASS || 'ethereal_pass',
  },
});

async function sendResetEmail(email, token, req) {
  const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
  const mailOptions = {
    from: '"Bukavu Housing" <noreply@bukavu-housing.com>',
    to: email,
    subject: 'Réinitialisation de votre mot de passe — Bukavu Housing',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5eeff; border-radius: 12px; background-color: #f8f9ff;">
        <h2 style="color: #002045; text-align: center;">Bukavu Housing</h2>
        <p>Bonjour,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Bukavu Housing.</p>
        <p>Veuillez cliquer sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien est valide pendant <strong>15 minutes</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #002045; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Réinitialiser mon mot de passe</a>
        </div>
        <p>Si le bouton ne fonctionne pas, vous pouvez copier et coller le lien suivant dans votre navigateur :</p>
        <p style="word-break: break-all; color: #74777f;">${resetUrl}</p>
        <hr style="border: 0; border-top: 1px solid #c4c6cf; margin: 20px 0;">
        <p style="font-size: 12px; color: #74777f; text-align: center;">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail en toute sécurité.</p>
      </div>
    `,
  };
  
  console.log(`[RESET PASSWORD] Token generated for ${email}: ${token}`);
  console.log(`[RESET PASSWORD] Link for testing: ${resetUrl}`);
  
  try {
    if (process.env.SMTP_USER && process.env.SMTP_USER !== 'ethereal_user') {
      await transporter.sendMail(mailOptions);
      console.log(`[RESET PASSWORD] Email sent to ${email}`);
    } else {
      console.log(`[RESET PASSWORD] SMTP not configured. Token logged above.`);
    }
  } catch (err) {
    console.error(`[RESET PASSWORD] Failed to send email to ${email}:`, err);
  }
}

// Validations pour l'inscription
const registerValidation = [
  body('nom').trim().notEmpty().withMessage('Le nom complet est obligatoire.'),
  body('email').trim().isEmail().withMessage('Adresse email invalide.'),
  body('password')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères.')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir au moins une lettre majuscule.')
    .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre.')
    .matches(/[^A-Za-z0-9]/).withMessage('Le mot de passe doit contenir au moins un symbole.'),
  body('whatsapp')
    .trim()
    .matches(/^(?:\+243|0)[0-9]{9}$/)
    .withMessage('Le numéro WhatsApp doit commencer par +243 ou 0 et être suivi de 9 chiffres.'),
  body('email_contact')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage('Adresse email de contact invalide.'),
  body('telephone2')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^(?:\+243|0)[0-9]{9}$/)
    .withMessage('Le téléphone secondaire doit commencer par +243 ou 0 et être suivi de 9 chiffres.'),
];

router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { nom, email, password, whatsapp, email_contact, telephone2 } = req.body;

  try {
    const { data: existant } = await supabaseAdmin
      .from('utilisateurs')
      .select('id')
      .eq('email', email)
      .single();

    if (existant) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }

    const hash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabaseAdmin
      .from('utilisateurs')
      .insert({
        nom,
        email,
        password_hash: hash,
        whatsapp: whatsapp || null,
        telephone: whatsapp || null, // compatibilité
        telephone2: telephone2 || null,
        email_contact: email_contact || null,
        provider: 'email'
      })
      .select('id, nom, email, whatsapp, telephone, telephone2, email_contact, avatar_url, bio, verifie')
      .single();

    if (error) throw error;

    const token = genToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe obligatoires.' });
  }

  try {
    const { data: user, error } = await supabaseAdmin
      .from('utilisateurs')
      .select('id, nom, email, whatsapp, telephone, telephone2, email_contact, avatar_url, bio, verifie, password_hash, provider')
      .eq('email', email)
      .single();

    if (error || !user) {
      console.warn(`[failed login attempt] Email introuvable: ${email}, IP: ${req.ip}, Time: ${new Date().toISOString()}`);
      return res.status(401).json({ error: 'Aucun compte avec cet email.' });
    }

    if (user.provider === 'google') {
      console.warn(`[failed login attempt] Connexion mot de passe impossible pour compte Google. Email: ${email}, IP: ${req.ip}`);
      return res.status(401).json({ error: 'Ce compte utilise la connexion Google.' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      console.warn(`[failed login attempt] Mot de passe invalide. Email: ${email}, IP: ${req.ip}, Time: ${new Date().toISOString()}`);
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    const token = genToken(user.id);
    const { password_hash, ...userData } = user;
    res.json({ token, user: userData });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'idToken Google manquant.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    let { data: user } = await supabaseAdmin
      .from('utilisateurs')
      .select('id, nom, email, whatsapp, telephone, telephone2, email_contact, avatar_url, bio, verifie')
      .eq('email', email)
      .single();

    if (!user) {
      const { data: newUser, error } = await supabaseAdmin
        .from('utilisateurs')
        .insert({
          nom: name,
          email,
          avatar_url: picture,
          google_id: googleId,
          provider: 'google',
          password_hash: null,
        })
        .select('id, nom, email, whatsapp, telephone, telephone2, email_contact, avatar_url, bio, verifie')
        .single();

      if (error) throw error;
      user = newUser;
    } else {
      await supabaseAdmin
        .from('utilisateurs')
        .update({ avatar_url: picture, google_id: googleId })
        .eq('id', user.id);
      user.avatar_url = picture;
    }

    const token = genToken(user.id);
    res.json({ token, user });
  } catch (err) {
    console.error('[google auth]', err);
    res.status(401).json({ error: 'Token Google invalide.' });
  }
});

// Demande de réinitialisation de mot de passe (forgot-password)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'L\'adresse email est requise.' });
  }

  try {
    const { data: user } = await supabaseAdmin
      .from('utilisateurs')
      .select('id, email')
      .eq('email', email)
      .single();

    if (!user) {
      // Pour des raisons de sécurité, nous indiquons le succès même si l'email n'existe pas
      return res.json({ message: 'Si cet e-mail existe, un lien de réinitialisation vous a été envoyé.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    await supabaseAdmin
      .from('utilisateurs')
      .update({ reset_token: token, reset_token_expires: expires })
      .eq('id', user.id);

    await sendResetEmail(user.email, token, req);

    res.json({ message: 'Si cet e-mail existe, un lien de réinitialisation vous a été envoyé.' });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Réinitialisation du mot de passe avec le token
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Le token et le nouveau mot de passe sont requis.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });
  }

  try {
    const { data: user, error } = await supabaseAdmin
      .from('utilisateurs')
      .select('id, reset_token_expires')
      .eq('reset_token', token)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'Token de réinitialisation invalide ou expiré.' });
    }

    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Token de réinitialisation expiré.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);

    await supabaseAdmin
      .from('utilisateurs')
      .update({
        password_hash: hash,
        reset_token: null,
        reset_token_expires: null
      })
      .eq('id', user.id);

    res.json({ message: 'Votre mot de passe a été réinitialisé avec succès.' });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
