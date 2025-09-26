// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { once } from 'events';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const FILE_DIR = path.join(process.cwd(), 'public');
fs.mkdirSync(FILE_DIR, { recursive: true })


// Endpoint to generate a file of given size in MiB
app.post('/generate', async (req, res) => {
	let interval;
	let stream;
	try {
		const { size } = req.body; // kept as in original code
		if (!size || isNaN(size) || size <= 0) return res.status(400).json({ error: 'Invalid size' });

		const fileName = `file_${size}GiB_${Date.now()}.bin`;
		const filePath = path.join(FILE_DIR, fileName);

		// Keep CHUNK_SIZE small to limit memory usage (<= 256 MB requirement)
		const CHUNK_SIZE = 100 * 1024 * 1024; // 100 MiB buffer reused

		// original behavior used GiB multiplication; keeping it to avoid changing semantics
		const totalBytes = BigInt(size) * 1024n * 1024n * 1024n;

		// create a reusable zero buffer of CHUNK_SIZE
		const zeroChunk = Buffer.alloc(CHUNK_SIZE, 0);

		// stream response to client as progress updates (chunked transfer)
		res.setHeader('Content-Type', 'application/json; charset=utf-8');

		stream = fs.createWriteStream(filePath, { flags: 'w' });

		let bytesWritten = 0n;

		// send progress to client every 5 seconds
		interval = setInterval(() => {
			try {
				res.write(JSON.stringify({ status: 'in-progress', bytesWritten: bytesWritten.toString(), totalBytes: totalBytes.toString() }) + '\n');
			} catch (err) {
				// ignore write errors here; they'll be caught in the main flow
			}
		}, 5000);

		// handle client disconnect: abort file creation
		req.on('close', async () => {
			if (req.aborted) {
				clearInterval(interval);
				if (stream) {
					stream.destroy(new Error('Client disconnected'));
				}
			}
		});

		// Write loop: write CHUNK_SIZE repeatedly using same buffer to keep memory low
		while (bytesWritten < totalBytes) {
			const remaining = totalBytes - bytesWritten;
			const toWrite = remaining > BigInt(CHUNK_SIZE) ? CHUNK_SIZE : Number(remaining);

			// if partial chunk, write a slice of the reusable buffer to avoid allocating new memory
			const buf = toWrite === CHUNK_SIZE ? zeroChunk : zeroChunk.subarray(0, toWrite);

			if (!stream.write(buf)) {
				// backpressure: wait for 'drain' before continuing
				await once(stream, 'drain');
			}
			bytesWritten += BigInt(toWrite);
		}

		// finish write stream
		stream.end();
		await once(stream, 'finish');

		clearInterval(interval);

		// final success message (client has been receiving chunks already)
		res.write(JSON.stringify({ status: 'done', fileName, url: `/all-files/${fileName}`, bytesWritten: bytesWritten.toString() }) + '\n');
		return res.end();
	} catch (err) {
		// ensure interval cleared and stream destroyed
		if (interval) clearInterval(interval);
		if (stream) stream.destroy();

		console.error('File generation error:', err);

		// If headers weren't sent yet, use normal JSON status; otherwise stream error text and end.
		if (!res.headersSent) {
			return res.status(500).json({ error: err && err.message ? err.message : String(err) });
		} else {
			try {
				res.write(JSON.stringify({ status: 'error', error: err && err.message ? err.message : String(err) }) + '\n');
				res.end();
			} catch (e) {
				// nothing to do
			}
		}
	}
});

// Serve files
app.use('/all-files', express.static(FILE_DIR));
app.use('/assets', express.static(path.join(__dirname, '../frontend/dist/assets')));

app.get('/files', (req, res) => {
	const files = fs.readdirSync(FILE_DIR).map(f => ({
		fileName: f,
		url: `/all-files/${f}`
	}));
	res.json(files);
});

app.get('/', (_, res) => {
	res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));

