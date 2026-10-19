// Renders the resume pages to PDF with the print stylesheet:
//   assets/resume/Gazutdinov-resume-ru.pdf and -en.pdf
// Usage: npm run build:pdf  (set CHROMIUM_PATH to use an existing Chromium binary)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4',
};

// Minimal static server so the pages load their absolute /assets/... URLs.
const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const [lang, page] of [['ru', '/'], ['en', '/en/']]) {
      const tab = await browser.newPage();
      await tab.goto(base + page, { waitUntil: 'networkidle' });
      await tab.emulateMedia({ media: 'print', colorScheme: 'light' });
      const out = path.join(root, 'assets/resume', `Gazutdinov-resume-${lang}.pdf`);
      await tab.pdf({ path: out, format: 'A4', printBackground: true, tagged: true });
      console.log('wrote', path.relative(root, out));
      await tab.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
