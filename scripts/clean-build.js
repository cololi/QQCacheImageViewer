const fs = require('fs');
const path = require('path');

const dirsToClean = ['dist', 'build'];

dirsToClean.forEach((dir) => {
  const dirPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`✓ Cleaned ${dir} directory`);
    } catch (error) {
      console.error(`Error cleaning ${dir} directory:`, error);
      process.exit(1);
    }
  }
});
