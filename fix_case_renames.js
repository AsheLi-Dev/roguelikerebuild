const fs = require('fs');
const path = require('path');

function handleCaseRename(dirPath) {
    const dir = path.dirname(dirPath);
    const oldName = path.basename(dirPath);
    const newName = oldName.toLowerCase().replace(/ /g, '-');
    
    if (oldName !== newName) {
        const tempPath = path.join(dir, oldName + '_temp_rename_' + Date.now());
        const finalPath = path.join(dir, newName);
        
        console.log(`Renaming: ${dirPath} -> ${finalPath} (via ${tempPath})`);
        
        try {
            fs.renameSync(dirPath, tempPath);
            fs.renameSync(tempPath, finalPath);
        } catch (err) {
            console.error(`Failed to rename ${dirPath}: ${err.message}`);
        }
    }
}

// Check common top-level directories
const dirsToFix = [
    'assets/Audio',
    'assets/UI',
    'assets/biomes/openworld/Rag',
    'assets/biomes/openworld/Trees',
    'assets/enemies/Barbarian',
    'assets/enemies/Beast',
    'assets/enemies/Enemies',
    'assets/enemies/Slime',
    'assets/enemies/undead'
];

dirsToFix.forEach(dirPath => {
    const fullPath = path.join(process.cwd(), dirPath);
    if (fs.existsSync(fullPath)) {
        handleCaseRename(fullPath);
    }
});
