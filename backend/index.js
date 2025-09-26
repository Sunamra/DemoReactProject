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


function formatDuration(ms) {
	const totalMs = Math.floor(ms);
	const hours = Math.floor(totalMs / 3600000);
	const minutes = Math.floor((totalMs % 3600000) / 60000);
	const seconds = Math.floor((totalMs % 60000) / 1000);
	const milliseconds = totalMs % 1000;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

app.post('/generate', async (req, res) => {
	let stream;
	try {
		const { size } = req.body; // MiB (kept as in original)
		if (!size || isNaN(size) || size <= 0) return res.status(400).json({ error: 'Invalid size' });

		const fileName = `file_${size}GiB_${Date.now()}.bin`;
		const filePath = path.join(FILE_DIR, fileName);

		// Keep CHUNK_SIZE within memory budget
		const CHUNK_SIZE = 100 * 1024 * 1024; // 100 MiB buffer reused

		const totalBytes = BigInt(size) * 1024n * 1024n * 1024n;
		const zeroChunk = Buffer.alloc(CHUNK_SIZE, 0);

		// track time
		const startTime = process.hrtime.bigint();

		stream = fs.createWriteStream(filePath, { flags: 'w' });

		let bytesWritten = 0n;

		// handle client disconnect: abort file creation
		req.on('close', () => {
			if (req.aborted) {
				if (stream) {
					stream.destroy(new Error('Client disconnected'));
				}
			}
		});

		while (bytesWritten < totalBytes) {
			const remaining = totalBytes - bytesWritten;
			const toWrite = remaining > BigInt(CHUNK_SIZE) ? CHUNK_SIZE : Number(remaining);
			const buf = toWrite === CHUNK_SIZE ? zeroChunk : zeroChunk.subarray(0, toWrite);

			if (!stream.write(buf)) {
				await new Promise((resolve, reject) => {
					stream.once('drain', resolve);
					stream.once('error', reject);
				});
			}
			bytesWritten += BigInt(toWrite);
		}

		stream.end();
		await new Promise((resolve, reject) => {
			stream.once('finish', resolve);
			stream.once('error', reject);
		});

		const endTime = process.hrtime.bigint();
		const durationMs = Number(endTime - startTime) / 1e6; // milliseconds
		const durationStr = formatDuration(durationMs);

		// Final JSON response with time taken
		return res.json({ fileName, url: `/all-files/${fileName}`, timeTaken: durationStr });
	} catch (err) {
		if (stream) stream.destroy();
		console.error('File generation error:', err);
		return res.status(500).json({ error: err && err.message ? err.message : String(err) });
	}
});
// app.post('/generate', async (req, res) => {
// 	try {
// 		const { size } = req.body; // MiB
// 		if (!size || isNaN(size) || size <= 0) return res.status(400).json({ error: 'Invalid size' });

// 		const fileName = `file_${size}GiB_${Date.now()}.bin`;
// 		const filePath = path.join(FILE_DIR, fileName);
// 		const totalBytes = Number(size) * 1024 * 1024 * 1024;

// 		const fh = await fs.promises.open(filePath, 'w');
// 		await fh.truncate(totalBytes); // creates file of desired length without buffering
// 		await fh.close();

// 		res.json({ fileName, url: `/all-files/${fileName}` });
// 	} catch (err) {
// 		console.error(err);
// 		res.status(500).json({ error: 'File generation failed' });
// 	}
// });

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

