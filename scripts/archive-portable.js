const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const releaseDir = path.join(__dirname, '../release');
const appName = 'win-unpacked';
const outputFile = `QQCacheImageViewer-portable.zip`;

const sevenZipPath = path.join(__dirname, '../node_modules/7zip-bin/win/x64/7za.exe');

if (!fs.existsSync(path.join(releaseDir, appName))) {
    console.error(`Source folder not found: ${path.join(releaseDir, appName)}`);
    console.error('Please run "npm run dist:portable" first.');
    process.exit(1);
}

if (!fs.existsSync(sevenZipPath)) {
    console.error(`7za.exe not found at ${sevenZipPath}`);
    process.exit(1);
}

// Remove existing output file if it exists
const outputPath = path.join(releaseDir, outputFile);
if (fs.existsSync(outputPath)) {
    try {
        fs.unlinkSync(outputPath);
    } catch (e) {
        console.warn('Could not delete existing zip:', e.message);
    }
}

console.log(`Zipping ${appName} to ${outputFile}...`);

const child = spawn(sevenZipPath, ['a', '-tzip', outputFile, appName], {
    cwd: releaseDir,
    stdio: 'inherit'
});

child.on('close', (code) => {
    if (code === 0) {
        console.log(`✓ Archive created successfully at: ${outputPath}`);
    } else {
        console.error(`7zip process exited with code ${code}`);
        process.exit(code);
    }
});
