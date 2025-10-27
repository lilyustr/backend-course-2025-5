const http = require('http');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const fsp = fs.promises;

program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <dir>', 'Шлях до директорії кешу')
  .parse(process.argv);

const options = program.opts();

const cacheDir = path.resolve(options.cache);

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`Директорія кешу створена: ${cacheDir}`);
}

function getFilePath(code) {
  return path.join(cacheDir, `${code}.jpg`);
}

const server = http.createServer(async (req, res) => {
  const urlParts = req.url.split('/');
  const code = urlParts[1];

   if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Помилка: не вказано HTTP код у запиті (наприклад /200)');
    return;
  }

 const filePath = getFilePath(code);

 try {
    switch (req.method) {
      // ---------------------- GET ----------------------
      case 'GET':
        try {
          const data = await fsp.readFile(filePath);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(data);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404: Картинку не знайдено');
        }
        break;

      // ---------------------- PUT ----------------------
      case 'PUT':
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
          const buffer = Buffer.concat(chunks);
          await fsp.writeFile(filePath, buffer);
          res.writeHead(201, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Картинку для коду ${code} збережено`);
        });
        break;

      // ---------------------- DELETE ----------------------
      case 'DELETE':
        try {
          await fsp.unlink(filePath);
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Картинку для коду ${code} видалено`);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404: Картинку не знайдено для видалення');
        }
        break;

      // ---------------------- Інші методи ----------------------
      default:
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('405: Метод не дозволено');
        break;
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Внутрішня помилка сервера: ' + err.message);
  }
});

server.listen(options.port, options.host, () => {
  console.log(`Сервер запущено: http://${options.host}:${options.port}`);
});