import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataRoot = path.resolve(__dirname, '..', 'public', 'data');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const files = await walk(dataRoot);
  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    totalBefore += Buffer.byteLength(raw);
    const compact = `${JSON.stringify(JSON.parse(raw))}\n`;
    totalAfter += Buffer.byteLength(compact);
    await writeFile(file, compact, 'utf8');
  }

  const beforeMiB = (totalBefore / (1024 * 1024)).toFixed(1);
  const afterMiB = (totalAfter / (1024 * 1024)).toFixed(1);
  console.log(`Minified ${files.length} JSON files: ${beforeMiB} MiB -> ${afterMiB} MiB`);

  const largest = [];
  for (const file of files) {
    const info = await stat(file);
    largest.push({ file, size: info.size });
  }
  largest.sort((a, b) => b.size - a.size);
  for (const item of largest.slice(0, 5)) {
    console.log(`${(item.size / (1024 * 1024)).toFixed(1)} MiB\t${path.relative(path.resolve(__dirname, '..'), item.file)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
