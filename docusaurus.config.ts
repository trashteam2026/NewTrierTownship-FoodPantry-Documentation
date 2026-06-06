import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "New Trier Township Food Pantry",
  tagline: "Inventory Management System Documentation",
  favicon: "img/favicon.ico",

  url: "https://trashteam2026.github.io",
  baseUrl: "/NewTrierTownship-FoodPantry-Documentation/",

  organizationName: "trashteam2026",
  projectName: "NewTrierTownship-FoodPantry-Documentation",

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
          path: "docs",
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.ts"),
          editUrl:
            "https://github.com/trashteam2026/NewTrierTownship-FoodPantry-Documentation/tree/main",
        },
        blog: false,
        pages: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      defaultMode: "light",
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: "New Trier Township Food Pantry",
      items: [
        {
          href: "https://github.com/trashteam2026/NewTrierTownship-FoodPantry-Documentation",
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
              label: "Introduction",
              to: "/",
            },
            {
              label: "Getting Started",
              to: "/getting-started",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/trashteam2026/NewTrierTownship-FoodPantry-Documentation",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} New Trier Township Food Pantry`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
