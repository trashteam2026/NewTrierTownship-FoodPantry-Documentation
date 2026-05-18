---
id: intro
title: Introduction
sidebar_position: 1
slug: /
---

# New Trier Food Pantry Inventory Management System Introduction

Welcome to the New Trier Food Pantry! This webpage will serve as guide for the Inventory Management project, including details on how to get it up and running, as well as current progress and insights.

## Overview

The goal of the Inventory Management system is to provide a clean way to update and track items in the New Trier Food Pantry. The previous system was an Excel spreadsheet, our website will expand on it by introducing features like:

- **Barcode Scanning**: Gives volunteers a way to update the database with new stock directly.
- **Activity Log**: Allows administrators to generate comprehensive overviews of past Food Pantry activity.
- **Checkout Interface**: Helps administrators keep track of what is being removed in one client interaction.

This is on top of our foundational features:

- **Inventory Database**
- **Low Stock and Out of Stock notifications**
- **User Authentication**
- **Item Categorization**
- and more...

The progress we've made will be detailed in the **handoff documentation**

## Tech Stack

The inventory system itself is split into a JavaScript frontend and backend. The documentation site is a separate Docusaurus project.

### Frontend

- React
- Vite
- styled-components
- Firebase client authentication
- ZXing browser barcode scanner
- `react-icons`

### Backend

- Node.js
- Express
- PostgreSQL through Supabase
- Firebase Admin SDK
- `pg`
- external barcode lookup providers

### Development Tools

- Git for version control
- VS Code as the recommended editor
- ESLint and Prettier for consistent code formatting

## Current Documentation Sections

- **Getting Started**: local setup and environment expectations
- **Authentication**: Firebase auth flow and route protection notes
- **Frontend**: React project structure and user-facing features
- **Backend**: Express/database structure and backend behavior
