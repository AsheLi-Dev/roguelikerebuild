const fs = require('fs');
const path = require('path');

const extensions = ['.js', '.json', '.css', '.html'];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Regex to match asset paths: starting with ./assets/ or assets/
    // We want to target the path inside the quotes.
    // Example: "./assets/Audio/Dash.mp3" -> "./assets/audio/dash.mp3"
    // Example: "./assets/Combat VFX/..." -> "./assets/combat-vfx/..."
    
    const newContent = content.replace(/(['"`])(\.?\/assets\/[^'"`]+)(['"`])/g, (match, quote1, assetPath, quote2) => {
        const normalized = assetPath.toLowerCase().replace(/ /g, '-');
        if (normalized !== assetPath) {
            changed = true;
            return quote1 + normalized + quote2;
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated references in: ${filePath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'archive project' && file !== 'assets') {
                walkDir(fullPath);
            }
        } else if (extensions.includes(path.extname(fullPath))) {
            processFile(fullPath);
        }
    }
}

// Also process styles.css in root
if (fs.existsSync('styles.css')) processFile('styles.css');
if (fs.existsSync('index.html')) processFile('index.html');

// Process src directory
if (fs.existsSync('src')) walkDir('src');

console.log('Finished updating code references.');
