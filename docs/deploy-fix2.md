#!/usr/bin/env node

/**
 * Auto-fix ALL dynamic imports in LazyComponents.tsx
 * 
 * This script automatically detects dynamic imports and adds the .then() handler
 * for named exports based on the filename (assumes PascalCase component names match filenames)
 * 
 * Usage: node fix-lazy-components.js
 */

const fs = require('fs');
const path = require('path');

// Find the file
const possiblePaths = [
  'apps/web/src/components/optimized/LazyComponents.tsx',
  'src/components/optimized/LazyComponents.tsx',
];

let filePath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    filePath = p;
    break;
  }
}

if (!filePath) {
  console.error('Error: Could not find LazyComponents.tsx');
  process.exit(1);
}

console.log(`Found: ${filePath}`);

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Backup
fs.writeFileSync(`${filePath}.backup`, content);
console.log(`Backup saved: ${filePath}.backup`);

// Regex to find dynamic imports that DON'T already have .then()
// Matches: () => import('path/to/Component'),
// But NOT: () => import('path').then(...)
const dynamicImportRegex = /\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)(?!\.then)/g;

let fixCount = 0;

content = content.replace(dynamicImportRegex, (match, importPath) => {
  // Extract component name from path (last segment, remove extension)
  const segments = importPath.split('/');
  const fileName = segments[segments.length - 1];
  const componentName = fileName.replace(/\.(tsx?|jsx?)$/, '');
  
  fixCount++;
  console.log(`  Fixed: ${componentName}`);
  
  return `() => import('${importPath}').then(mod => mod.${componentName})`;
});

// Write the fixed content
fs.writeFileSync(filePath, content);

console.log(`\n✓ Fixed ${fixCount} dynamic imports`);
console.log('\nNow run: npm run build');