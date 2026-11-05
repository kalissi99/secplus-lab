# Sec+ Lab — Révision CompTIA Security+ SY0-701

Site statique (HTML/CSS/JS, sans build) de révision : flashcards avec répétition espacée, quiz d'entraînement, examen blanc chronométré et suivi de progression.

## Contenu
- `data/flashcards.js` : flashcards (terme en anglais, explication en français), réparties sur les 5 domaines
- `data/quiz.js` : questions style examen (en anglais) avec explications en français
- `app.js`, `styles.css`, `index.html` : l'application

Pour ajouter une carte : `[domaine, "Terme", "Explication"]`
Pour ajouter une question : `[domaine, "Question ?", ["A","B","C","D"], indexBonneRéponse, "Explication"]` (l'index commence à 0)

Domaines : 1 General Security Concepts (12 %) · 2 Threats, Vulnerabilities & Mitigations (22 %) · 3 Security Architecture (18 %) · 4 Security Operations (28 %) · 5 Security Program Management & Oversight (20 %)

## Déployer sur Vercel

**Option A — via GitHub (recommandé)**
1. Crée un dépôt GitHub (ex. `secplus-lab`) et pousse le contenu de ce dossier :
   ```bash
   git init && git add . && git commit -m "Sec+ Lab"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/secplus-lab.git
   git push -u origin main
   ```
2. Sur vercel.com → **Add New… → Project** → importe le dépôt.
3. Framework Preset : **Other**. Laisse Build Command et Output Directory vides → **Deploy**.

**Option B — en ligne de commande**
```bash
npm i -g vercel
vercel        # première fois : répondre aux questions
vercel --prod
```

## Tester en local
```bash
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

La progression est enregistrée dans le `localStorage` du navigateur (elle ne se synchronise pas entre appareils).
