import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "DISC Documentation",
  tagline: "New Trier Food Pantry Inventory System Documentation",
  favicon: "img/favicon.ico",

  url: "https://docs.discnu.org",
  baseUrl: "/",

  organizationName: "DISC-NU",
  projectName: "DISC-Documentation-Website",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  markdown: {
    mermaid: true,
  },

  themes: ["@docusaurus/theme-mermaid"],

  presets: [
    [
      "classic",
      {
        docs: {
          id: "food-pantry",
          path: "docs",
          routeBasePath: "/",

          sidebarPath: require.resolve("./sidebars.workshop-series.ts"),
          editUrl:
            "https://github.com/DISC-NU/DISC-Documentation-Website/tree/main",
        },
        blog: false,
        pages: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [],

  themeConfig: {
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      defaultMode: "light",
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "Develop & Innovate for Social Change",
      logo: {
        alt: "DISC Logo",
        src: "img/disc-logo.png",
        href: "https://disc-nu.github.io/disc-website/",
      },
      items: [
        {
          type: "doc",
          docId: "intro",
          position: "left",
          label: "Food Pantry",
          docsPluginId: "food-pantry",
        },
        {
          href: "https://github.com/DISC-NU/DISC-Documentation-Website",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "Food Pantry",
              to: "/",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "DISC Website",
              href: "https://disc-nu.github.io/disc-website/",
            },
            {
              label: "GitHub",
              href: "https://github.com/DISC-NU",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Develop and Innovate for Social Change`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    algolia: {
      // The application ID provided by Algolia
      appId: "3TFR2VJ1XU",

      // Public API key: it is safe to commit it
      apiKey: "ad5ad1f82b15090e44a9c782190183dc",

      indexName: "disc-nuio",

      // Optional: see doc section below
      contextualSearch: true,

      // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
      externalUrlRegex: "external\\.com|domain\\.com",

      // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
      replaceSearchResultPathname: {
        from: "/docs/", // or as RegExp: /\/docs\//
        to: "/",
      },

      // Optional: Algolia search parameters
      searchParameters: {},

      // Optional: path for search page that enabled by default (`false` to disable it)
      searchPagePath: "search",

      // Optional: whether the insights feature is enabled or not on Docsearch (`false` by default)
      insights: false,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
