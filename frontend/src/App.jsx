import { useEffect, useState } from "react";

const App = () => {
	const [size, setSize] = useState(1);
	const [files, setFiles] = useState([]);

	const origin = window?.location?.origin;

	const handleGenerate = async () => {
		const res = await fetch(`${origin}/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ size }),
		});
		const data = await res.json();
		console.log(data);
		if (data.url) setFiles(prev => [...prev, data]);
	};


	useEffect(() => {
		fetch(`${origin}/files`)
			.then(res => res.json())
			.then(data => setFiles(data)); // assume backend returns [{fileName, url}, ...]
	}, []);

	return (
		<div className="p-4 flex flex-col items-center justify-center min-h-screen bg-[#1a1a1a]" >
			<h1 className="text-xl mb-4 text-white">Generate File</h1>

			<select
				id="abc"
				value={size}
				onChange={(e) => setSize(Number(e.target.value))}
				className="bg-[#1a1a1a] text-white text-bold border border-white py-1 px-2 m-2"
			>
				{[1, 2, 5, 10, 15, 18].map((n) => (
					<option key={n} value={n}>{n} GiB</option>
				))}
			</select>

			<button onClick={handleGenerate} className="bg-blue-500 text-white p-2 rounded-md cursor-pointer click:bg-white">
				Generate
			</button>

			<ul className="mt-4">
				{files.map((f) => (
					<li key={f.fileName}>
						<a href={`${origin}${f.url}`} target="_blank" className="text-green-400 underline">{f.fileName}</a>
					</li>
				))}
			</ul>
		</div >
	);
}
export default App
