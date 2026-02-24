const fs = require('fs');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Remove duplicate models by keeping only first occurrence
const lines = schema.split('\n');
const seen = new Set();
const result = [];
let inModel = false;
let currentModel = '';
let skipModel = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.startsWith('model ')) {
    const modelName = line.split(' ')[1];
    if (seen.has(modelName)) {
      skipModel = true;
      inModel = true;
      console.log(`Skipping duplicate: ${modelName} at line ${i+1}`);
    } else {
      seen.add(modelName);
      skipModel = false;
      inModel = true;
      result.push(line);
    }
  } else if (inModel && line === '}') {
    if (!skipModel) {
      result.push(line);
    }
    inModel = false;
    skipModel = false;
  } else {
    if (!skipModel) {
      result.push(line);
    }
  }
}

fs.writeFileSync('prisma/schema.prisma', result.join('\n'));
console.log('Schema fixed!');
