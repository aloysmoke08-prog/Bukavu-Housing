# Bukavu Housing

Application fullstack Node.js/Express + Supabase + Cloudinary, prete pour Vercel.

## Developpement local

1. Executer `db/schema.sql` dans Supabase SQL Editor
2. Installer les dependances :
   ```bash
   npm install --legacy-peer-deps
   ```
3. Demarrer le serveur :
   ```bash
   node server.js
   ```
4. Ouvrir `http://localhost:5000`

## Deploiement Vercel

1. Push le projet sur GitHub
2. Connecter le repo sur vercel.com
3. Ajouter toutes les variables d'environnement dans Vercel Dashboard
4. Deployer - l'URL generee fonctionne directement

## Variables d'environnement

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...
PORT=5000
```

## Google OAuth

Le frontend utilise Google Identity Services pour obtenir un `idToken`, puis l'envoie a `POST /api/auth/google`. Ajoutez l'URL Vercel dans les origines autorisees de votre Google Console, ainsi que `http://localhost:5000` pour le local.
