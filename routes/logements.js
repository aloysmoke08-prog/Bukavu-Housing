const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const {
  upload,
  cloudinary,
  uploadBufferToCloudinary,
} = require("../config/cloudinary");
const {
  authMiddleware,
  authOptional,
} = require("../middleware/authMiddleware");

function getCloudinaryPublicId(url) {
  const match = String(url).match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
}

router.get("/", authOptional, async (req, res) => {
  const { type, quartier, q, page = 1, limit = 12, tri = 'recent' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = supabaseAdmin
      .from("logements")
      .select(
        "id, titre, type, quartier, adresse, chambres, bains, superficie, prix, devise, images, disponible, vues, cree_le, proprietaire_id, utilisateurs(nom, avatar_url, whatsapp, verifie)",
        { count: "exact" },
      )
      .eq("disponible", true);

    // Sorting logic
    if (tri === 'prix_croissant') {
      query = query.order("prix", { ascending: true });
    } else if (tri === 'prix_decroissant') {
      query = query.order("prix", { ascending: false });
    } else if (tri === 'vues') {
      query = query.order("vues", { ascending: false });
    } else {
      query = query.order("cree_le", { ascending: false });
    }

    query = query.range(offset, offset + parseInt(limit) - 1);

    if (type && type !== "tous") query = query.eq("type", type);
    if (quartier) query = query.eq("quartier", quartier);
    if (q)
      query = query.or(
        `titre.ilike.%${q}%,quartier.ilike.%${q}%,adresse.ilike.%${q}%`,
      );

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      logements: data,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit)),
    });
  } catch (err) {
    console.error("[GET /logements]", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.get("/:id", authOptional, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("logements")
      .select("*, utilisateurs(id, nom, telephone, whatsapp, telephone2, email_contact, avatar_url, bio, verifie)")
      .eq("id", req.params.id)
      .single();

    if (error || !data)
      return res.status(404).json({ error: "Logement introuvable." });

    res.json(data);
  } catch (err) {
    console.error("[GET /logements/:id]", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

const uploadPhotos = (req, res, next) => {
  upload.array("photos", 8)(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "Chaque photo doit faire moins de 5 MB." });
    }
    return res
      .status(400)
      .json({ error: err.message || "Erreur pendant l upload des photos." });
  });
};

router.post("/", authMiddleware, uploadPhotos, async (req, res) => {
  const {
    titre,
    type,
    quartier,
    adresse,
    chambres,
    bains,
    superficie,
    prix,
    devise,
    description,
    equipements,
    whatsapp_contact,
    telephone_contact,
    email_contact,
    contact_public,
    video_url
  } = req.body;

  if (!titre || !type || !quartier || !prix || !chambres || !description) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }

  try {
    let images = [];
    if (req.files && req.files.length) {
      try {
        images = await Promise.all(req.files.map(file => uploadBufferToCloudinary(file, 'bukavu_housing/logements')));
      } catch (uploadError) {
        console.error("[Cloudinary upload]", uploadError);
        const stale = /stale request/i.test(uploadError.message || "");
        return res.status(400).json({
          error: stale
            ? "Cloudinary refuse l upload car l heure du serveur est decalee. Synchronisez l heure de la machine ou redeployez sur Vercel."
            : "Erreur Cloudinary pendant l upload des photos: " +
              (uploadError.message || "verification des identifiants requise"),
        });
      }
    }

    let equip = [];
    if (equipements) {
      try {
        equip = JSON.parse(equipements);
      } catch {
        equip = [equipements];
      }
    }

    const isPublic = contact_public === 'true' || contact_public === true || contact_public === 'on';

    const { data, error } = await supabaseAdmin
      .from("logements")
      .insert({
        titre,
        type,
        quartier,
        adresse: adresse || null,
        chambres: parseInt(chambres),
        bains: parseInt(bains) || 0,
        superficie: parseFloat(superficie) || null,
        prix: parseFloat(prix),
        devise: devise || "CDF",
        description,
        equipements: equip,
        images,
        proprietaire_id: req.user.id,
        disponible: true,
        whatsapp_contact: whatsapp_contact || null,
        telephone_contact: telephone_contact || null,
        email_contact: email_contact || null,
        contact_public: isPublic,
        video_url: video_url || null,
        vues: 0
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error("[POST /logements]", err);
    res.status(500).json({ error: "Erreur lors de la publication." });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { data: logement } = await supabaseAdmin
      .from("logements")
      .select("proprietaire_id")
      .eq("id", req.params.id)
      .single();

    if (!logement || logement.proprietaire_id !== req.user.id) {
      return res.status(403).json({ error: "Action non autorisee." });
    }

    const updates = { ...req.body };
    delete updates.proprietaire_id;
    delete updates.cree_le;

    if (updates.contact_public !== undefined) {
      updates.contact_public = updates.contact_public === 'true' || updates.contact_public === true || updates.contact_public === 'on';
    }

    const { data, error } = await supabaseAdmin
      .from("logements")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("[PUT /logements/:id]", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { data: logement } = await supabaseAdmin
      .from("logements")
      .select("proprietaire_id, images")
      .eq("id", req.params.id)
      .single();

    if (!logement || logement.proprietaire_id !== req.user.id) {
      return res.status(403).json({ error: "Action non autorisée." });
    }

    if (logement.images && logement.images.length > 0) {
      for (const url of logement.images) {
        const publicId = getCloudinaryPublicId(url);
        if (publicId)
          await cloudinary.uploader.destroy(publicId).catch(() => {});
      }
    }

    const { error } = await supabaseAdmin
      .from("logements")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ message: "Logement supprimé." });
  } catch (err) {
    console.error("[DELETE /logements/:id]", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// increment views
router.post("/:id/vue", async (req, res) => {
  try {
    const { data: current } = await supabaseAdmin
      .from("logements")
      .select("vues")
      .eq("id", req.params.id)
      .single();

    if (!current) {
      return res.status(404).json({ error: "Logement introuvable." });
    }

    const { error } = await supabaseAdmin
      .from("logements")
      .update({ vues: (current.vues || 0) + 1 })
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true, vues: (current.vues || 0) + 1 });
  } catch (err) {
    console.error('[POST /logements/:id/vue]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// similar listings
router.get("/:id/similaires", async (req, res) => {
  try {
    const { data: current } = await supabaseAdmin
      .from("logements")
      .select("type, quartier")
      .eq("id", req.params.id)
      .single();

    if (!current) {
      return res.status(404).json({ error: "Logement introuvable." });
    }

    let { data: similaires, error } = await supabaseAdmin
      .from("logements")
      .select("id, titre, type, quartier, prix, devise, images, disponible, chambres, bains, superficie")
      .eq("disponible", true)
      .neq("id", req.params.id)
      .eq("quartier", current.quartier)
      .limit(4);

    if (error) throw error;

    if (!similaires || similaires.length < 4) {
      const { data: complementary } = await supabaseAdmin
        .from("logements")
        .select("id, titre, type, quartier, prix, devise, images, disponible, chambres, bains, superficie")
        .eq("disponible", true)
        .neq("id", req.params.id)
        .eq("type", current.type)
        .limit(10);

      if (complementary) {
        similaires = similaires || [];
        const existingIds = new Set(similaires.map(s => s.id));
        for (const item of complementary) {
          if (!existingIds.has(item.id) && similaires.length < 4) {
            similaires.push(item);
          }
        }
      }
    }

    res.json(similaires || []);
  } catch (err) {
    console.error('[GET /logements/:id/similaires]', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// report listing
router.post("/:id/signaler", authMiddleware, async (req, res) => {
  const { raison } = req.body;
  if (!raison) {
    return res.status(400).json({ error: "Veuillez fournir une raison pour le signalement." });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("signalements")
      .insert({
        logement_id: req.params.id,
        utilisateur_id: req.user.id,
        raison
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: "Signalement enregistré.", signalement: data });
  } catch (err) {
    console.error('[POST /logements/:id/signaler]', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du signalement.' });
  }
});

module.exports = router;
