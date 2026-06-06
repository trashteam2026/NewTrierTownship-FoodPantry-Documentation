import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: "doc",
      id: "intro",
      label: "Introduction",
    },
    {
      type: "doc",
      id: "getting-started",
      label: "Getting Started",
    },
    {
      type: "doc",
      id: "authentication",
      label: "Authentication",
    },
    {
      type: "category",
      label: "Frontend",
      items: [
        {
          type: "doc",
          id: "frontend/project-structure",
          label: "Project Structure",
        },
        {
          type: "doc",
          id: "frontend/features",
          label: "Features",
        },
        {
          type: "doc",
          id: "frontend/deployment",
          label: "Deployment",
        },
      ],
    },
    {
      type: "category",
      label: "Backend",
      items: [
        {
          type: "doc",
          id: "backend/project-structure",
          label: "Project Structure",
        },
        {
          type: "doc",
          id: "backend/architecture",
          label: "Architecture & Core Logic",
        },
        {
          type: "doc",
          id: "backend/deployment",
          label: "Deployment",
        },
      ],
    },
    {
      type: "doc",
      id: "database-schema",
      label: "Database Schema",
    },
    {
      type: "doc",
      id: "gotchas",
      label: "Known Behaviors",
    },
  ],
};

export default sidebars;
