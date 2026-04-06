const fs = require('fs');
const path = require('path');

function getAllItems(dir, items = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        items.push(fullPath);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllItems(fullPath, items);
        }
    }
    return items;
}

const rootDir = path.join(process.cwd(), 'assets');
const allItems = getAllItems(rootDir);

// Sort by length descending to rename from bottom-up
allItems.sort((a, b) => b.length - a.length);

const renameMap = [];

for (const oldPath of allItems) {
    const dir = path.dirname(oldPath);
    const oldName = path.basename(oldPath);
    const newName = oldName.toLowerCase().replace(/ /g, '-');
    
    if (oldName !== newName) {
        const newPath = path.join(dir, newName);
        console.log(`Renaming: ${oldPath} -> ${newPath}`);
        // Check if destination exists (case-insensitive check on Windows might be tricky)
        // But since we are lowercasing, if it already exists it might be a collision or already renamed.
        if (fs.existsSync(newPath) && oldPath.toLowerCase() !== newPath.toLowerCase()) {
             console.warn(`Warning: Destination ${newPath} already exists!`);
        }
        
        fs.renameSync(oldPath, newPath);
        renameMap.push({ oldPath, newPath });
    } else {
        // Even if name is same, parent might have changed. 
        // But we are doing bottom-up and we get the list BEFORE any renaming.
        // So the oldPath in our list will become invalid once a parent is renamed.
        // That's why bottom-up is good for renaming the item itself.
    }
}

console.log('Finished renaming assets.');
