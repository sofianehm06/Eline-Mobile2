# Outils développeur — NE PAS LIVRER AU CLIENT

## genkey.cjs — Générateur de clés d'activation

Ce dossier contient la **clé privée** qui sert à générer les clés d'activation.
**Gardez-le secret.** Il n'est PAS inclus dans l'installateur livré au client.

### Comment activer un nouveau PC client
1. Le client installe le logiciel et lance l'application.
2. L'écran d'activation affiche un **« ID de cet ordinateur »** (ex. `A1B2-C3D4-E5F6-7890`).
   Le client vous le communique (photo/WhatsApp/téléphone).
3. Vous générez la clé :
   ```
   node tools/genkey.cjs A1B2-C3D4-E5F6-7890
   ```
4. Vous envoyez la **clé affichée** (ou le fichier `licence-XXXX.lic`) au client.
5. Le client la colle dans l'écran d'activation → le logiciel s'active **définitivement** sur ce PC.

### Important
- 1 clé = 1 PC, **à vie** (pas d'expiration).
- La clé ne fonctionne **que** sur l'ordinateur dont l'ID a servi à la générer.
- Copier le logiciel sur un autre PC → ID différent → la clé ne marche pas → il faut une nouvelle clé (donc vous repayer).
- En **développement** (`npm run dev`), l'activation est désactivée (pas de blocage). Le verrou ne s'applique qu'à l'installateur final.
