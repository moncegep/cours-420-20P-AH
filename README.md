# Cours 420-20P-AH - Informatique pour la gestion de données en entreprise

Ce dépôt contient le matériel pédagogique du cours **Informatique pour la gestion de données en entreprise** (420-20P-AH), un cours de CÉGEP conçu pour développer les compétences en gestion et traitement des données.

## Contenu du cours

Le site contient plusieurs sections :

- **Cours magistraux** : Concepts fondamentaux et théorie
- **Exercices** : Problèmes pratiques et exercices corrigés
- **Guides** : Tutoriels et guides pas à pas
- **Références** : Documentation et aide-mémoire

## Technologies utilisées

- **[Astro](https://astro.build/)** : Framework web statique haute performance
- **[Starlight](https://starlight.astro.build/)** : Thème de documentation pour Astro
- **[React](https://react.dev/)** : Composants interactifs
- **Markdown/MDX** : Format de contenu

## Démarrer avec le projet

### Prérequis

- Node.js 18.x ou supérieur
- npm ou yarn

### Installation

1. Clonez ce dépôt :
```bash
git clone git@github.com:moncegep/cours-420-20P-AH.git
cd cegep/cours-420-20P-AH/site
```

2. Installez les dépendances :
```bash
npm install
```

3. Démarrez le serveur de développement :
```bash
npm run dev
```

Le site sera accessible à `http://localhost:4321`

## Structure du projet

```
cours-420-20P-AH/
├── README.md (ce fichier)
└── site/
    ├── src/
    │   ├── content/
    │   │   └── docs/
    │   │       ├── cours/          # Leçons et concepts théoriques
    │   │       ├── exercices/      # Exercices pratiques
    │   │       ├── guides/         # Guides et tutoriels
    │   │       └── reference/      # Documentation de référence
    │   ├── components/             # Composants React réutilisables
    │   ├── assets/                 # Images et ressources statiques
    │   └── styles/                 # Styles CSS personnalisés
    ├── public/                     # Fichiers statiques
    ├── package.json
    ├── astro.config.mjs
    └── tsconfig.json
```

## Ajouter du contenu

Le contenu est organisé en fichiers Markdown (.md) et MDX (.mdx) dans `site/src/content/docs/`. 

Pour ajouter une nouvelle page :
1. Créez un fichier `.mdx` dans le dossier approprié
2. Ajoutez les métadonnées frontmatter
3. Écrivez votre contenu

## Déploiement

Pour déployer le site :

```bash
npm run build
```

Les fichiers compilés seront générés dans le dossier `dist/`.

## Licence

Ce projet est distribué sous la licence [Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE).

Vous êtes libre de :
- **Partager** : copier et redistribuer le matériel sous n'importe quel format ou média
- **Adapter** : remixer, transformer et développer le matériel à toute fin, même commerciale

À condition de :
- **Attribuer** : créditer l'auteur original et indiquer les modifications apportées

Pour plus de détails, consultez le fichier [LICENSE](LICENSE).

## Contact

Mainteneur : Louis-Edouard Lafontant

---

**Dernière mise à jour :** Février 2026
