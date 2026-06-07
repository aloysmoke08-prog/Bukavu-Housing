const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/authMiddleware');
const { upload, uploadBufferToCloudinary } = require('../config/cloudinary');

// Get profile details with listings, favorites, etc.
router.get('/profil', authMiddleware, async (req, res) => {
  try {
    const { data: annonces } = await supabaseAdmin
      .from('logements')
      .select('id, titre, type, quartier, prix, devise, images, disponible, vues, cree_le')
      .eq('proprietaire_id', req.user.id)
      .order('cree_le', { ascending: false });

    const { data: favorisData } = await supabaseAdmin
      .from('favoris')
      .select('logement_id, logements(id, titre, type, quartier, prix, devise, images, disponible)')
      .eq('utilisateur_id', req.user.id);

    const favoris = favorisData ? favorisData.map(f => f.logements).filter(Boolean) : [];

    res.json({
      user: req.user,
      annonces: annonces || [],
      favoris,
    });
  } catch (err) {
    console.error('[GET /users/profil]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Update profile text information
router.put('/profil', authMiddleware, async (req, res) => {
  const { nom, whatsapp, telephone2, email_contact, bio } = req.body;
  const verifie = !!whatsapp; // Badge verified if WhatsApp is provided

  try {
    const { data, error } = await supabaseAdmin
      .from('utilisateurs')
      .update({
        nom,
        whatsapp,
        telephone: whatsapp || null, // compatibility fallback
        telephone2: telephone2 || null,
        email_contact: email_contact || null,
        bio: bio ? bio.substring(0, 200) : null,
        verifie
      })
      .eq('id', req.user.id)
      .select('id, nom, email, whatsapp, telephone, telephone2, email_contact, avatar_url, bio, verifie')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[PUT /users/profil]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Update profile avatar picture
router.put('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier fourni.' });
  }

  try {
    const avatarUrl = await uploadBufferToCloudinary(req.file, 'bukavu_housing/avatars');

    const { data, error } = await supabaseAdmin
      .from('utilisateurs')
      .update({ avatar_url: avatarUrl })
      .eq('id', req.user.id)
      .select('id, nom, email, whatsapp, telephone, telephone2, email_contact, avatar_url, bio, verifie')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[PUT /users/avatar]', err);
    res.status(500).json({ error: 'Erreur lors de l\'upload de la photo de profil.' });
  }
});

// Change user password
router.put('/password', authMiddleware, async (req, res) => {
  const { ancienPassword, nouveauPassword } = req.body;

  if (!ancienPassword || !nouveauPassword) {
    return res.status(400).json({ error: 'Ancien et nouveau mots de passe requis.' });
  }

  if (nouveauPassword.length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
  }

  try {
    const { data: user, error } = await supabaseAdmin
      .from('utilisateurs')
      .select('password_hash, provider')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    if (user.provider !== 'email') {
      return res.status(400).json({ error: 'Les comptes connectés par Google ne peuvent pas modifier leur mot de passe par ce biais.' });
    }

    const ok = await bcrypt.compare(ancienPassword, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
    }

    const hash = await bcrypt.hash(nouveauPassword, 12);
    await supabaseAdmin
      .from('utilisateurs')
      .update({ password_hash: hash })
      .eq('id', req.user.id);

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    console.error('[PUT /users/password]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Delete user account
router.delete('/compte', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('utilisateurs')
      .delete()
      .eq('id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Compte supprimé avec succès.' });
  } catch (err) {
    console.error('[DELETE /users/compte]', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du compte.' });
  }
});

// Toggle Favorite listing
router.post('/favoris/:logementId', authMiddleware, async (req, res) => {
  const { logementId } = req.params;
  try {
    const { data: existing } = await supabaseAdmin
      .from('favoris')
      .select('id')
      .eq('utilisateur_id', req.user.id)
      .eq('logement_id', logementId)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('favoris')
        .delete()
        .eq('utilisateur_id', req.user.id)
        .eq('logement_id', logementId);

      return res.json({ favori: false, message: 'Retiré des favoris.' });
    } else {
      await supabaseAdmin
        .from('favoris')
        .insert({ utilisateur_id: req.user.id, logement_id: logementId });

      return res.json({ favori: true, message: 'Ajouté aux favoris.' });
    }
  } catch (err) {
    console.error('[POST /users/favoris]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Check if listing is favorited
router.get('/favoris/:logementId', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('favoris')
      .select('id')
      .eq('utilisateur_id', req.user.id)
      .eq('logement_id', req.params.logementId)
      .single();

    res.json({ favori: !!data });
  } catch {
    res.json({ favori: false });
  }
});

// List user's published listings
router.get('/annonces', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('logements')
      .select('*')
      .eq('proprietaire_id', req.user.id)
      .order('cree_le', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[GET /users/annonces]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Get user messages (internal messaging)
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select(`
        id, contenu, lu, cree_le, logement_id,
        expediteur:utilisateurs!expediteur_id(id, nom, avatar_url, whatsapp),
        destinataire:utilisateurs!destinataire_id(id, nom, avatar_url, whatsapp),
        logements(id, titre)
      `)
      .or(`expediteur_id.eq.${req.user.id},destinataire_id.eq.${req.user.id}`)
      .order('cree_le', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[GET /users/messages]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Send message (internal messaging)
router.post('/messages', authMiddleware, async (req, res) => {
  const { destinataire_id, logement_id, contenu } = req.body;

  if (!destinataire_id || !logement_id || !contenu) {
    return res.status(400).json({ error: 'Tous les champs (destinataire, logement, contenu) sont requis.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        expediteur_id: req.user.id,
        destinataire_id,
        logement_id,
        contenu
      })
      .select(`
        id, contenu, lu, cree_le, logement_id,
        expediteur:utilisateurs!expediteur_id(id, nom, avatar_url, whatsapp),
        destinataire:utilisateurs!destinataire_id(id, nom, avatar_url, whatsapp),
        logements(id, titre)
      `)
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('[POST /users/messages]', err);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message.' });
  }
});

// Mark messages as read
router.put('/messages/lire', authMiddleware, async (req, res) => {
  const { expediteur_id, logement_id } = req.body;
  if (!expediteur_id || !logement_id) {
    return res.status(400).json({ error: 'Champs manquants.' });
  }

  try {
    await supabaseAdmin
      .from('messages')
      .update({ lu: true })
      .eq('expediteur_id', expediteur_id)
      .eq('destinataire_id', req.user.id)
      .eq('logement_id', logement_id);

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /users/messages/lire]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Déconnecté avec succès.' });
});

module.exports = router;
