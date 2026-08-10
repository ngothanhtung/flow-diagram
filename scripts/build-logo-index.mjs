#!/usr/bin/env node
// Build the logo catalog used by the LogoPicker.
// Reads logos/categories/*.md, extracts category titles and logo slugs,
// copies SVG assets to public/logos, and writes public/logos.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATEGORIES_DIR = path.join(ROOT, 'logos', 'categories');
const SOURCE_LOGOS_DIR = path.join(ROOT, 'logos', 'logos');
const PUBLIC_LOGOS_DIR = path.join(ROOT, 'public', 'logos');
const INDEX_PATH = path.join(ROOT, 'public', 'logos.json');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function parseCategoryTitle(firstLine) {
  // Example: "# 🤖 AI & Machine Learning <sub>(144)</sub>"
  // Strip leading #, HTML tags, trailing count badge, emojis / variation
  // selectors, and trim.
  return firstLine
    .replace(/^#\s*/, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s*\(\d+\)\s*$/g, '')
    .replace(/[︀-️​-‍⁠﻿]/g, '')
    .replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '')
    .trim();
}

function parseSlugs(markdown) {
  const slugs = [];
  // Each logo is referenced like:
  // <a href="../logos/anthropic.svg"><img src="../logos/anthropic.svg" ... alt="anthropic"/><br/><sub><code>anthropic</code></sub></a>
  const imgRegex = /<img[^>]+src="\.\.\/logos\/([^"]+)\.svg"[^>]*>/gi;
  const codeRegex = /<code>([^<]+)<\/code>/gi;

  let match;
  while ((match = imgRegex.exec(markdown)) !== null) {
    slugs.push(match[1]);
  }
  if (slugs.length === 0) {
    // Fallback if the markdown uses a different shape.
    while ((match = codeRegex.exec(markdown)) !== null) {
      slugs.push(match[1]);
    }
  }
  return [...new Set(slugs)];
}

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function build() {
  if (!fs.existsSync(CATEGORIES_DIR)) {
    console.error(`Categories directory not found: ${CATEGORIES_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(SOURCE_LOGOS_DIR)) {
    console.error(`Logos directory not found: ${SOURCE_LOGOS_DIR}`);
    process.exit(1);
  }

  const categoryFiles = fs
    .readdirSync(CATEGORIES_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort();

  const categories = [];
  const usedLabels = new Set();
  const logoMap = new Map();

  for (const fileName of categoryFiles) {
    const categoryId = fileName.replace(/\.md$/, '');
    const markdown = readText(path.join(CATEGORIES_DIR, fileName));
    const firstLine = markdown.split(/\r?\n/)[0] ?? '';
    let label = parseCategoryTitle(firstLine) || categoryId;
    if (usedLabels.has(label)) {
      label = `${label} (${categoryId})`;
    }
    usedLabels.add(label);
    const slugs = parseSlugs(markdown);

    categories.push({ id: categoryId, label, count: slugs.length });

    for (const slug of slugs) {
      let entry = logoMap.get(slug);
      if (!entry) {
        const type = slug.endsWith('-wordmark') ? 'wordmark' : 'icon';
        entry = { id: slug, name: slug, categories: [], type };
        logoMap.set(slug, entry);
      }
      if (!entry.categories.includes(categoryId)) {
        entry.categories.push(categoryId);
      }
    }
  }

  // Preserve deterministic order: sort by slug.
  const logos = [...logoMap.values()].sort((a, b) => a.id.localeCompare(b.id));

  // Copy SVG assets.
  console.log(`Copying SVG assets to ${PUBLIC_LOGOS_DIR}...`);
  copyRecursiveSync(SOURCE_LOGOS_DIR, PUBLIC_LOGOS_DIR);

  // Write index.
  const index = { categories, logos };
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));

  console.log(`Wrote ${INDEX_PATH}`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Logos: ${logos.length}`);
}

build();
