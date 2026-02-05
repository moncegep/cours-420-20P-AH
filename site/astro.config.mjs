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
							badge: 'Nouveau',
							items: [
								{ label: "Modélisation: Suivi d'une classe", slug: 'cours/02-conditions' },
								{ label: 'Fonction SI', slug: 'cours/02-fonction-si' },
								{ label: 'Exercices', slug: 'cours/02-exercices' },
							]
						},
					],
				},
				{
					label: 'Guides',
					badge: 'Nouveau',
					items: [
						{ label: 'Modélisation de problèmes', slug: 'guides/modelisation-excel' },
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
