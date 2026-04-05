import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SRC_DIR = './src';
const EXTENSIONS = ['.js', '.mjs'];

console.log('🚀 Starting Project Integrity Check...\n');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath));
    } else if (EXTENSIONS.includes(path.extname(filePath))) {
      results.push(filePath);
    }
  }
  return results;
}

const allFiles = getFiles(SRC_DIR);
const exportMap = new Map(); // filePath -> Set of exported names
const errors = [];

// --- Phase 1: Syntax and Export Extraction ---
for (const file of allFiles) {
  // 1. Syntax Check
  try {
    execSync(`node --check "${file}"`, { stdio: 'ignore' });
  } catch (err) {
    errors.push(`❌ Syntax Error in ${file}: Unbalanced braces, duplicate declarations, or invalid ESM.`);
    continue;
  }

  // 2. Extract Exports (Regex based for simplicity in a standalone script)
  const content = fs.readFileSync(file, 'utf8');
  const exports = new Set();
  
  // Matches: export function name, export const name, export class name
  const exportMatches = content.matchAll(/export\s+(?:function|const|let|var|class|async\s+function)\s+([a-zA-Z0-9_]+)/g);
  for (const match of exportMatches) {
    exports.add(match[1]);
  }

  // Matches: export { name1, name2 }
  const blockExportMatches = content.matchAll(/export\s+\{([^}]+)\}/g);
  for (const match of blockExportMatches) {
    match[1].split(',').forEach(name => {
      const trimmed = name.trim().split(/\s+as\s+/)[0]; // Handle 'name as alias'
      if (trimmed) exports.add(trimmed);
    });
  }

  exportMap.set(path.resolve(file), exports);
}

// --- Phase 2: Import Verification ---
for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dirname = path.dirname(file);

  // Matches: import { a, b } from './file.js'
  const importMatches = content.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    const symbols = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    let importPath = match[2];
    
    // Resolve relative path
    if (!importPath.endsWith('.js')) importPath += '.js';
    const absolutePath = path.resolve(dirname, importPath);

    if (!fs.existsSync(absolutePath)) {
      errors.push(`🔗 Broken Path in ${file}: Cannot find file "${importPath}"`);
      continue;
    }

    const availableExports = exportMap.get(absolutePath);
    if (availableExports) {
      for (const symbol of symbols) {
        if (!availableExports.has(symbol)) {
          errors.push(`❓ Missing Export: "${symbol}" is imported in ${file} but not exported by ${importPath}`);
        }
      }
    }
  }
}

// --- Results ---
if (errors.length > 0) {
  console.log('⚠️  Integrity Check Failed:\n');
  errors.forEach(err => console.error(err));
  process.exit(1);
} else {
  console.log('✅ Integrity Check Passed! No syntax errors or broken imports found.');
  process.exit(0);
}
