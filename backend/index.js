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
app.post('/generate', (req, res) => {
	const { size } = req.body; // size in MiB
	if (!size || isNaN(size) || size <= 0) {
		return res.status(400).json({ error: 'Invalid size' });
	}

	const fileName = `${Date.now()}_${size}GiB.bin`;
	const filePath = path.join(FILE_DIR, fileName);
	const buffer = Buffer.alloc(size * 1024 * 1024 * 1024, 0); // Fill with zeros

	fs.writeFile(filePath, buffer, (err) => {
		if (err) return res.status(500).json({ error: 'File generation failed' });
		res.json({
			fileName, url: `/all-files/${fileName}`
		});
	});
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

