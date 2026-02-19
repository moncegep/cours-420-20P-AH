// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Cours 420-20P-AH',
			defaultLocale: 'root',
			locales: {
				root: {
					label: 'Français',
					lang: 'fr',
				}
			},
			customCss: [
				'./src/styles/custom.css',
			],
			sidebar: [
				{
					label: 'Notes de cours',
					items: [
						{
							label: 'Semaine 1',
							collapsed: true,
							items: [
								{ label: 'Introduction', slug: 'cours/01-introduction' }
							]
						},
						{
							label: 'Semaine 2',
							collapsed: true,
							items: [
								{ label: "Modélisation: Suivi d'une classe", slug: 'cours/02-conditions' },
								{ label: 'Fonction SI', slug: 'cours/02-fonction-si' },
								{ label: 'Fonction conditionnel', slug: 'cours/02-fonction-conditionnel' },
								{ label: 'Synthèse', slug: 'cours/02-synthese' },
								{ label: "Exercices", items: [
									{ label: 'Exercices', slug: 'cours/02-exercices' },
									// { label: 'Problèmes', slug: 'exercices/02-exercices' },
								]}
							]
						},
						{
							label: 'Semaine 3',
							items: [
								{ label: 'Fonction ET, OU', slug: 'cours/03-fonction-etou' },
								{ label: 'Mise en forme conditionnelle', slug: 'cours/03-mise-en-forme' },
								{ label: "Exercices", items: [
									{ label: 'Exercices', slug: 'exercices/03-exercices' },
								]}
							]
						},
						{
							label: 'Semaine 4',
							badge: 'Nouveau',
							items: [
								{ label: 'Fonctions dates', slug: 'cours/04-fonctions-dates' },
								{ label: 'Fonctions texte', slug: 'cours/04-fonctions-textes' },
								{ label: "Exercices", items: [
									{ label: 'Exercices', slug: 'exercices/04-exercices-dates' },
								]},
								{ label: "Problèmes", items: [
									{ label: "Crédit d'impôt solidarité", slug: 'exercices/04-problemes' },
								]}
							]
						},
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Modélisation de problèmes', slug: 'guides/modelisation-excel' },
						{ label: 'Notions mathématiques', badge: "Nouveau", slug: 'guides/notions-mathematiques' },
					],
				},
				// {
				// 	label: 'Référence',
				// 	autogenerate: { directory: 'reference' },
				// },
			],
		}),
		react(),
	],
});
