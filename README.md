# Eline Mobile — Logiciel de caisse & gestion

Application de bureau (Windows) pour la gestion d'une boutique de **téléphones et accessoires** :
caisse (POS) avec scan code-barres et impression de tickets, suivi des téléphones par **IMEI**,
gestion du stock, clients, fournisseurs, rapports et tableau de bord.

> Devise : **Dinar algérien (DA)** · prix unique (sans TVA) · Interface en français.

---

## ✨ Fonctionnalités

- **Caisse (POS)** : recherche/scan de produits, panier, remises, encaissement (espèces, carte, virement, crédit), rendu de monnaie, **vérification de prix par scan**, **impression automatique du ticket** thermique (58/80 mm).
- **Suivi IMEI** : chaque téléphone est tracé individuellement (entrée en stock, vente, garantie). Sélection de l'IMEI à la vente, recherche par IMEI.
- **Reprise d'occasion** : rachat de téléphones d'occasion (IMEI + état + prix de rachat/revente) → entrent directement en stock, prêts à revendre.
- **Crédit & ardoise** : ventes à crédit avec acompte, suivi des dettes par client, encaissements partiels, relevé de compte, relance **WhatsApp**.
- **Import / Export Excel** : export complet des données (.xlsx) et import (produits, clients, IMEI) avec modèles — pour migrer depuis/vers un autre logiciel.
- **Produits & catégories** : catalogue complet, marques/modèles, prix d'achat/vente, marge, codes-barres, **impression d'étiquettes**.
- **Stock** : réception, ajustement d'inventaire, alertes de rupture, **historique des mouvements**.
- **Ventes** : historique, détail du ticket, **réimpression**, **remboursement** (réintègre le stock et les IMEI).
- **Clients & fournisseurs** : fichiers avec historique d'achats.
- **Tableau de bord & rapports** : CA, bénéfice, marge, meilleures ventes, valeur du stock, export **CSV**.
- **Paramètres** : infos boutique + fiscales (RC/NIF/AI), logo, TVA, devise, choix de l'imprimante, personnalisation du ticket.
- **Sauvegarde / restauration** des données en un clic.

## 🧱 Technologie

| Composant | Choix |
|---|---|
| Bureau | Electron 31 |
| Interface | React 18 + TypeScript + Tailwind CSS |
| Base de données | SQLite via **sql.js** (WASM, aucune compilation native requise) |
| Graphiques | Recharts |
| Build | electron-vite + electron-builder |

La base de données est un **fichier local** (`eline-mobile.db`) enregistré automatiquement après chaque
opération dans le dossier de données utilisateur de Windows.

---

## 🚀 Développement

```bash
npm install
npm run dev        # lance l'app en mode développement (rechargement à chaud)
```

## 🏗️ Compiler / vérifier

```bash
npm run build      # compile main + preload + renderer dans out/
```

## 📦 Créer l'installateur Windows (.exe)

```bash
npm run dist       # génère release/Eline Mobile-Setup-1.0.0.exe (NSIS)
```

> Au premier lancement, electron-builder télécharge ses ressources (NSIS, winCodeSign).
> L'installateur final se trouve dans le dossier `release/`.

Pour un test rapide sans installateur (dossier décompressé) :

```bash
npm run dist:dir   # génère release/win-unpacked/Eline Mobile.exe
```

---

## 🖨️ Matériel

- **Imprimante ticket** : installez le pilote Windows de votre imprimante thermique, puis
  sélectionnez-la dans **Paramètres → Imprimante**. Le ticket s'imprime automatiquement à chaque vente.
- **Lecteur code-barres** : tout lecteur USB « clavier » (keyboard-wedge) fonctionne sans configuration —
  scannez directement dans la page **Caisse**.

## 💾 Emplacement des données

`%APPDATA%/eline-mobile-pos/eline-mobile.db`

Utilisez **Paramètres → Sauvegarde** pour conserver une copie de sécurité sur clé USB.

---

## 🔄 Mettre à jour l'application chez le client

Les **données du client ne sont jamais effacées** par une mise à jour : elles vivent dans
`%APPDATA%/eline-mobile-pos/`, séparées du programme. Les changements de base de données sont
appliqués **automatiquement** au démarrage (migrations idempotentes), sans perte de données.

### Méthode simple (manuelle) — recommandée
1. Côté développeur : modifiez le code, montez la version dans `package.json` (ex. `1.0.0` → `1.1.0`).
2. `npm run dist` → génère un nouvel installateur dans `release/`.
3. Envoyez le fichier `.exe` au client (WeTransfer, clé USB, email…).
4. Le client **double-clique** sur le nouvel installateur : il s'installe **par-dessus** l'ancienne
   version. Les produits, ventes, IMEI, clients, dettes… **sont conservés**.

> Conseil : demandez au client de faire une **sauvegarde** (Paramètres → Sauvegarde) avant toute mise à jour.

### Méthode automatique (optionnelle, à activer plus tard)
On peut brancher **electron-updater** : l'app vérifie elle-même les nouvelles versions et se met à jour
en un clic. Cela nécessite d'héberger les versions (GitHub Releases, un serveur web ou un bucket S3) et,
idéalement, une **signature de code** (certificat). À mettre en place si le client veut des mises à jour
sans intervention manuelle.

---

## 📁 Structure du projet

```
src/
  main/            Processus principal Electron (DB, IPC, impression, sauvegarde)
    db/            schema, base sql.js, données de démo, requêtes métier (repo)
  preload/         Pont sécurisé (contextBridge)
  renderer/        Interface React
    src/
      components/  Bibliothèque UI + layout + étiquettes
      lib/         api, formatage, hooks, paramètres, notifications
      pages/       Tableau de bord, Caisse, Produits, Stock, Ventes, Clients, Fournisseurs, Rapports, Paramètres
      store/       Panier (zustand)
  shared/          Types partagés
```

© 2026 Eline Mobile.
