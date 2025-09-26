// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const FILE_DIR = path.join(process.cwd(), 'public');
if (!fs.existsSync(FILE_DIR)) fs.mkdirSync(FILE_DIR);

// Endpoint to generate a file of given size in MiB
app.post('/generate', async (req, res) => {
	try {
		const { size } = req.body; // MiB
		if (!size || isNaN(size) || size <= 0) return res.status(400).json({ error: 'Invalid size' });

		const fileName = `file_${size}GiB_${Date.now()}.bin`;
		const filePath = path.join(FILE_DIR, fileName);
		const totalBytes = Number(size) * 1024 * 1024 * 1024; // safe for GiB ranges

		const fh = await fs.promises.open(filePath, 'w');
		await fh.truncate(totalBytes); // creates file of desired length without buffering
		await fh.close();

		res.json({ fileName, url: `/all-files/${fileName}` });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'File generation failed' });
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

