CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS utilisateurs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom           TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  telephone     TEXT,
  avatar_url    TEXT,
  provider      TEXT NOT NULL DEFAULT 'email', 
  google_id     TEXT,
  cree_le       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titre           TEXT NOT NULL,
  type            TEXT NOT NULL,          
  quartier        TEXT NOT NULL,
  adresse         TEXT,
  chambres        INT NOT NULL DEFAULT 1,
  bains           INT DEFAULT 0,
  superficie      NUMERIC,
  prix            NUMERIC NOT NULL,
  devise          TEXT NOT NULL DEFAULT 'CDF',
  description     TEXT NOT NULL,
  equipements     TEXT[] DEFAULT '{}',     
  images          TEXT[] DEFAULT '{}',     
  disponible      BOOLEAN DEFAULT TRUE,
  proprietaire_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  cree_le         TIMESTAMPTZ DEFAULT NOW(),
  modifie_le      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favoris (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  utilisateur_id  UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  logement_id     UUID NOT NULL REFERENCES logements(id) ON DELETE CASCADE,
  cree_le         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(utilisateur_id, logement_id)
);

CREATE INDEX IF NOT EXISTS idx_logements_type      ON logements(type);
CREATE INDEX IF NOT EXISTS idx_logements_quartier  ON logements(quartier);
CREATE INDEX IF NOT EXISTS idx_logements_dispo     ON logements(disponible);
CREATE INDEX IF NOT EXISTS idx_logements_proprio   ON logements(proprietaire_id);
CREATE INDEX IF NOT EXISTS idx_logements_cree_le   ON logements(cree_le DESC);
CREATE INDEX IF NOT EXISTS idx_favoris_user        ON favoris(utilisateur_id);


CREATE OR REPLACE FUNCTION update_modifie_le()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modifie_le = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_logements_modifie_le
  BEFORE UPDATE ON logements
  FOR EACH ROW EXECUTE FUNCTION update_modifie_le();

ALTER TABLE utilisateurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE logements    DISABLE ROW LEVEL SECURITY;
ALTER TABLE favoris      DISABLE ROW LEVEL SECURITY;

-- Mises à jour du schéma Bukavu Housing

-- Colonnes additionnelles pour utilisateurs
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS telephone2 TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS email_contact TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS verifie BOOLEAN DEFAULT FALSE;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- Colonnes additionnelles pour logements
ALTER TABLE logements ADD COLUMN IF NOT EXISTS whatsapp_contact TEXT;
ALTER TABLE logements ADD COLUMN IF NOT EXISTS telephone_contact TEXT;
ALTER TABLE logements ADD COLUMN IF NOT EXISTS email_contact TEXT;
ALTER TABLE logements ADD COLUMN IF NOT EXISTS contact_public BOOLEAN DEFAULT TRUE;
ALTER TABLE logements ADD COLUMN IF NOT EXISTS vues INT DEFAULT 0;
ALTER TABLE logements ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Table pour les signalements
CREATE TABLE IF NOT EXISTS signalements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logement_id    UUID REFERENCES logements(id) ON DELETE CASCADE,
  utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  raison         TEXT NOT NULL,
  cree_le        TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour la messagerie interne
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expediteur_id   UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  destinataire_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  logement_id     UUID REFERENCES logements(id) ON DELETE CASCADE,
  contenu         TEXT NOT NULL,
  lu              BOOLEAN DEFAULT FALSE,
  cree_le         TIMESTAMPTZ DEFAULT NOW()
);

-- Désactivation de RLS sur les nouvelles tables
ALTER TABLE signalements DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages     DISABLE ROW LEVEL SECURITY;

