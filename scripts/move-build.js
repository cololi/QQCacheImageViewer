const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '../build');
const distRendererDir = path.join(__dirname, '../dist/renderer');

try {
  if (fs.existsSync(buildDir)) {
    if (!fs.existsSync(distRendererDir)) {
      fs.mkdirSync(distRendererDir, { recursive: true });
    }

    // Use fs.cpSync for recursive copy if available (Node.js 16.7.0+)
    if (fs.cpSync) {
      fs.cpSync(buildDir, distRendererDir, { recursive: true });
    } else {
      const copySync = (src, dest) => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (let entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          entry.isDirectory() ? copySync(srcPath, destPath) : fs.copyFileSync(srcPath, destPath);
        }
      };
      copySync(buildDir, distRendererDir);
    }

    fs.rmSync(buildDir, { recursive: true, force: true });
    console.log('✓ Moved build to dist/renderer');
  } else {
    console.log('✓ build directory not found (may have been skipped)');
  }
} catch (error) {
  console.error('Error moving build directory:', error);
  process.exit(1);
}
