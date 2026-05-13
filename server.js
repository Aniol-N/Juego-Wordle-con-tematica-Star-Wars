const http = require("http");
const fs = require("fs");
const path = require("path");
const { formidable } = require("formidable");

const PORT = 8089;
const DATA_FILE = path.join(__dirname, "personajes.json");
const IMG_DIR = path.join(__dirname, "img");
const SECRET_FILE = path.join(__dirname, "juego_secreto.json");
const juego = {
	intentos: 0,
	ultimaPalabra: null,
	actualizadoEn: null,
	secreto: null,
};

ensureStorage();

function ensureStorage() {
	if (!fs.existsSync(IMG_DIR)) {
		fs.mkdirSync(IMG_DIR, { recursive: true });
	}

	if (!fs.existsSync(DATA_FILE)) {
		fs.writeFileSync(DATA_FILE, "[]", "utf8");
	}
}

function readPersonas() {
	try {
		const raw = fs.readFileSync(DATA_FILE, "utf8");
		const data = JSON.parse(raw);
		return Array.isArray(data) ? data : [];
	} catch (error) {
		return [];
	}
}

function writePersonas(personas) {
	fs.writeFileSync(DATA_FILE, JSON.stringify(personas, null, 2), "utf8");
}

function firstValue(value) {
	return Array.isArray(value) ? value[0] : value;
}

function setCorsHeaders(res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, payload) {
	setCorsHeaders(res);
	res.statusCode = statusCode;
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(payload));
}

function writeSecret(secret) {
	try {
		juego.secreto = secret;
		fs.writeFileSync(SECRET_FILE, JSON.stringify(secret, null, 2), "utf8");
	} catch (e) {}
}

function normalizeValue(value) {
	return String(value || "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

function normalizeColor(value) {
	const raw = normalizeValue(value).split(",")[0].split("/")[0].trim();
	if (!raw || raw === "n/a" || raw === "none" || raw === "unknown") {
		return "unknown";
	}
	return raw;
}

function normalizeGender(value) {
	const raw = normalizeValue(value);
	if (!raw || raw === "n/a") {
		return "unknown";
	}
	return raw;
}

function fetchJson(url) {
	return new Promise((resolve, reject) => {
		http.get(url, (resp) => {
			let body = "";
			resp.on("data", (chunk) => {
				body += chunk;
			});
			resp.on("end", () => {
				if (resp.statusCode < 200 || resp.statusCode >= 300) {
					reject(new Error("HTTP " + resp.statusCode));
					return;
				}
				try {
					resolve(JSON.parse(body));
				} catch (e) {
					reject(e);
				}
			});
		}).on("error", reject);
	});
}

async function fetchAllSwapiPeople() {
	const names = [];
	let page = 1;
	let hasNext = true;

	while (hasNext) {
		const data = await fetchJson("https://swapi.py4e.com/api/people/?page=" + page);
		(data.results || []).forEach((p) => {
			if (p && p.name) {
				names.push(String(p.name));
			}
		});
		hasNext = !!data.next;
		page += 1;
	}

	return names;
}

async function fetchSwapiPersonByName(name) {
	const data = await fetchJson("https://swapi.py4e.com/api/people/?search=" + encodeURIComponent(name));
	if (!data.results || data.results.length === 0) {
		return null;
	}

	const exact = data.results.find((p) => normalizeValue(p.name) === normalizeValue(name));
	return exact || data.results[0] || null;
}

function readBody(req, callback) {
	let body = "";

	req.on("data", (chunk) => {
		body += chunk;

		if (body.length > 1_000_000) {
			req.socket.destroy();
		}
	});

	req.on("end", () => {
		if (!body) {
			callback({});
			return;
		}

		try {
			callback(JSON.parse(body));
		} catch (error) {
			callback(null);
		}
	});
}

const server = http.createServer((req, res) => {
	if (req.method === "OPTIONS") {
		setCorsHeaders(res);
		res.statusCode = 204;
		res.end();
		return;
	}

	const requestUrl = new URL(req.url, `http://${req.headers.host}`);
	const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";

	// Serve saved images
	if (pathname.startsWith("/img/")) {
		const imgName = pathname.replace("/img/", "");
		const filePath = path.join(IMG_DIR, imgName);
		if (fs.existsSync(filePath)) {
			const stream = fs.createReadStream(filePath);
			res.setHeader("Content-Type", "image/*");
			setCorsHeaders(res);
			res.statusCode = 200;
			stream.pipe(res);
			return;
		}

		sendJson(res, 404, { error: "Imagen no encontrada" });
		return;
	}

	// GET /persona/:name -> buscar por nombre
	if (pathname.startsWith("/persona/") && req.method === "GET") {
		const name = decodeURIComponent(pathname.replace("/persona/", "")).trim();
		if (!name) {
			sendJson(res, 400, { error: "Nombre vacio" });
			return;
		}

		const personas = readPersonas();
		const found = personas.find((p) => String(p.name).toLowerCase() === String(name).toLowerCase());
		if (!found) {
			sendJson(res, 404, { error: "Persona no encontrada" });
			return;
		}

		sendJson(res, 200, { item: found });
		return;
	}

	if (pathname === "/persona") {
		if (req.method === "GET") {
			const personas = readPersonas();
			sendJson(res, 200, {
				total: personas.length,
				items: personas,
			});
			return;
		}

		if (req.method === "POST") {
			const form = formidable({
				uploadDir: IMG_DIR,
				keepExtensions: true,
				multiples: false,
			});

			form.parse(req, (error, fields, files) => {
				if (error) {
					sendJson(res, 400, { error: "No se pudo procesar el formulario" });
					return;
				}

				const uploadedPhoto = firstValue(files.photo);

				if (!uploadedPhoto) {
					sendJson(res, 400, { error: "Debes enviar una imagen en el campo photo" });
					return;
				}

				const personas = readPersonas();
				const registro = {
					id: personas.length + 1,
					recibidoEn: new Date().toISOString(),
					name: firstValue(fields.name) || null,
					height: firstValue(fields.height) || null,
					mass: firstValue(fields.mass) || null,
					hair_color: firstValue(fields.hair_color) || null,
					eye_color: firstValue(fields.eye_color) || null,
					birth_year: firstValue(fields.birth_year) || null,
					skin_color: firstValue(fields.skin_color) || null,
					gender: firstValue(fields.gender) || null,
					photo: {
						originalName: uploadedPhoto.originalFilename || null,
						storedName: path.basename(uploadedPhoto.filepath),
						mimeType: uploadedPhoto.mimetype || null,
						size: uploadedPhoto.size || 0,
					},
				};

				personas.push(registro);
				writePersonas(personas);

				sendJson(res, 201, {
					mensaje: "Persona guardada con imagen",
					item: registro,
				});
			});
			return;
		}

		sendJson(res, 405, { error: "Metodo no permitido" });
		return;
	}

	if (pathname === "/juego") {
		if (req.method === "GET") {
			sendJson(res, 200, juego);
			return;
		}

		if (req.method === "POST") {
			readBody(req, (data) => {
				if (!data) {
					sendJson(res, 400, { error: "JSON invalido" });
					return;
				}

				juego.intentos = Number(data.intentos ?? juego.intentos);
				juego.ultimaPalabra = data.ultimaPalabra ?? juego.ultimaPalabra;
				juego.actualizadoEn = new Date().toISOString();

				sendJson(res, 200, {
					mensaje: "Estado del juego actualizado",
					juego,
				});
			});
			return;
		}

		sendJson(res, 405, { error: "Metodo no permitido" });
		return;
	}

	// Juego: start
	if (pathname === "/juego/start" && req.method === "POST") {
		(async () => {
			const personas = readPersonas();
			if (personas && personas.length > 0) {
				const idx = Math.floor(Math.random() * personas.length);
				const secreto = personas[idx];
				writeSecret(secreto);
				sendJson(res, 200, { mensaje: "Personaje secreto seleccionado", fuente: "local" });
				return;
			}

			try {
				const names = await fetchAllSwapiPeople();
				if (!names.length) {
					sendJson(res, 400, { error: "No hay personajes disponibles en SWAPI" });
					return;
				}

				const idx = Math.floor(Math.random() * names.length);
				const person = await fetchSwapiPersonByName(names[idx]);
				if (!person) {
					sendJson(res, 400, { error: "No se pudo obtener personaje de SWAPI" });
					return;
				}

				const secreto = {
					name: person.name,
					eye_color: person.eye_color,
					gender: person.gender,
				};

				writeSecret(secreto);
				sendJson(res, 200, { mensaje: "Personaje secreto seleccionado", fuente: "swapi" });
			} catch (error) {
				sendJson(res, 500, { error: "No se pudo iniciar juego con SWAPI" });
			}
		})();
		return;
	}

	// Juego: autocomplete
	if (pathname === "/juego/autocomplete" && req.method === "GET") {
		(async () => {
			const q = normalizeValue(requestUrl.searchParams.get("q") || "");
			if (!q) {
				sendJson(res, 200, { total: 0, items: [] });
				return;
			}

			const personas = readPersonas();
			let names = personas.map((p) => p.name).filter((n) => typeof n === "string");

			if (names.length === 0) {
				try {
					names = await fetchAllSwapiPeople();
				} catch (error) {
					sendJson(res, 500, { error: "No se pudo consultar autocomplete" });
					return;
				}
			}

			const items = names.filter((n) => normalizeValue(n).startsWith(q)).slice(0, 10);
			sendJson(res, 200, { total: items.length, items });
		})();
		return;
	}

	// Juego: check guess
	if (pathname === "/juego/check" && req.method === "POST") {
		readBody(req, async (data) => {
			if (!data || !data.guess) {
				sendJson(res, 400, { error: "Falta el nombre a comprobar" });
				return;
			}

			const guess = String(data.guess).trim();
			const personas = readPersonas();
			let guessed = personas.find((p) => normalizeValue(p.name) === normalizeValue(guess));
			if (!juego.secreto) {
				// try read from file
				try {
					const raw = fs.readFileSync(SECRET_FILE, "utf8");
					juego.secreto = JSON.parse(raw);
				} catch (e) {
					juego.secreto = null;
				}
			}

			if (!juego.secreto) {
				sendJson(res, 400, { error: "Aun no hay personaje secreto. Inicia el juego." });
				return;
			}

			const match = {};
			const secret = juego.secreto;

			if (!guessed) {
				try {
					const person = await fetchSwapiPersonByName(guess);
					if (person) {
						guessed = {
							name: person.name,
							height: person.height,
							mass: person.mass,
							hair_color: person.hair_color,
							eye_color: person.eye_color,
							birth_year: person.birth_year,
							skin_color: person.skin_color,
							gender: person.gender,
						};
					}
				} catch (error) {
					// Sigue y devolvemos comparacion con desconocido si no hay datos
				}
			}

			// Compare name
			if (secret.name && guessed && guessed.name) {
				match.name = normalizeValue(guessed.name) === normalizeValue(secret.name) ? "verde" : "rojo";
			} else {
				match.name = "desconocido";
			}

			// Compare height
			if (secret.height && guessed && guessed.height) {
				match.height = String(guessed.height).trim() === String(secret.height).trim() ? "verde" : "rojo";
			} else {
				match.height = "desconocido";
			}

			// Compare mass
			if (secret.mass && guessed && guessed.mass) {
				match.mass = String(guessed.mass).trim() === String(secret.mass).trim() ? "verde" : "rojo";
			} else {
				match.mass = "desconocido";
			}

			// Compare hair_color
			if (secret.hair_color && guessed && guessed.hair_color) {
				match.hair_color = normalizeColor(guessed.hair_color) === normalizeColor(secret.hair_color) ? "verde" : "rojo";
			} else {
				match.hair_color = "desconocido";
			}

			// Compare eye_color
			if (secret.eye_color && guessed && guessed.eye_color) {
				match.eye_color = normalizeColor(guessed.eye_color) === normalizeColor(secret.eye_color) ? "verde" : "rojo";
			} else {
				match.eye_color = "desconocido";
			}

			// Compare birth_year
			if (secret.birth_year && guessed && guessed.birth_year) {
				match.birth_year = String(guessed.birth_year).trim() === String(secret.birth_year).trim() ? "verde" : "rojo";
			} else {
				match.birth_year = "desconocido";
			}

			// Compare skin_color
			if (secret.skin_color && guessed && guessed.skin_color) {
				match.skin_color = normalizeColor(guessed.skin_color) === normalizeColor(secret.skin_color) ? "verde" : "rojo";
			} else {
				match.skin_color = "desconocido";
			}

			// Compare gender
			if (secret.gender && guessed && guessed.gender) {
				match.gender = normalizeGender(guessed.gender) === normalizeGender(secret.gender) ? "verde" : "rojo";
			} else {
				match.gender = "desconocido";
			}

			sendJson(res, 200, {
				guessedName: guessed ? guessed.name : guess,
				match,
			});
		});
		return;
	}

	sendJson(res, 404, {
		error: "Ruta no encontrada",
		rutas: ["/persona", "/juego"],
	});
});

server.listen(PORT, () => {
	console.log(`Servidor iniciado en http://localhost:${PORT}`);
});