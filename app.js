(function () {
    "use strict";

    let API_URL = "https://swapi.py4e.com/api/people/?page=";
    let SERVER_URL = "http://localhost:8089";
    let charactersList = document.getElementById("characters-list");
    let pagination = document.getElementById("pagination");
    let statusText = document.getElementById("status");
    let resetListBtn = document.getElementById("reset-list");
    let resetDataBtn = document.getElementById("reset-data");
    let currentPage = 1;

    function setStatus(message, isError) {
        statusText.textContent = message;
        statusText.className = isError ? "error" : "";
    }

    function getCharacterField(character, snakeCaseKey, camelCaseKey) {
        return character[snakeCaseKey] || character[camelCaseKey] || "desconocido";
    }

    function transferCharacter(character, fileInput, buttonElement) {
        let selectedFile = fileInput.files[0] || null;

        if (!selectedFile) {
            setStatus("Selecciona una imagen antes de transferir.", true);
            return;
        }

        let formData = new FormData();
        formData.append("name", character.name);
        formData.append("height", character.height);
        formData.append("mass", character.mass);
        formData.append("hair_color", character.hair_color);
        formData.append("eye_color", getCharacterField(character, "eye_color", "eyeColor"));
        formData.append("birth_year", getCharacterField(character, "birth_year", "birthYear"));
        formData.append("skin_color", character.skin_color);
        formData.append("gender", character.gender);
        formData.append("photo", selectedFile);

        buttonElement.disabled = true;
        buttonElement.textContent = "Enviando...";

        fetch(SERVER_URL + "/persona", {
            method: "POST",
            body: formData
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("Fallo al transferir al servidor");
                }
                return response.json();
            })
            .then(function (result) {
                setStatus("Personaje enviado: " + character.name, false);
                console.log("Respuesta del servidor:", result);
                loadSavedCharacters();
            })
            .catch(function () {
                setStatus("No se pudo enviar al servidor. Verifica que server.js este ejecutandose.", true);
            })
            .finally(function () {
                buttonElement.disabled = false;
                buttonElement.textContent = "Transferir al servidor";
            });
    }

    function getPeople(page) {
        setStatus("Cargando pagina " + page + "...", false);
        console.log("getPeople:", page);

        let xhr = new XMLHttpRequest();
        xhr.open("GET", API_URL + page, true);

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }

            if (xhr.status == 200) {
                let data = JSON.parse(xhr.responseText);
                currentPage = page;
                renderCharacters(data.results);
                renderPagination(data.count, page);
                setStatus(
                    "Mostrando " + data.results.length + " personajes. Pagina " + page + ".",
                    false
                );
            } else {
                charactersList.innerHTML = "";
                setStatus("No se pudo cargar la API. Revisa tu conexion e intenta de nuevo.", true);
            }
        };

        xhr.send();
    }

    function resetCharacterList() {
        getPeople(1);
    }

    // --- Personajes Guardados ---
    let savedCharactersList = document.getElementById("saved-characters");

    function loadSavedCharacters() {
        if (!savedCharactersList) {
            console.error("Error: elemento saved-characters no encontrado");
            return;
        }
        
        fetch(SERVER_URL + "/persona")
            .then((r) => {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.json();
            })
            .then((data) => {
                console.log("Personajes cargados:", data);
                if (data.items && data.items.length > 0) {
                    renderSavedCharacters(data.items);
                } else {
                    savedCharactersList.innerHTML = "<p style='text-align:center;color:#999;'>No hay personajes guardados aún</p>";
                }
            })
            .catch((err) => {
                console.error("Error cargando personajes guardados:", err);
                savedCharactersList.innerHTML = "<p style='text-align:center;color:#999;'>No se pudo cargar los personajes guardados</p>";
            });
    }

    function renderSavedCharacters(characters) {
        if (!savedCharactersList) return;
        
        savedCharactersList.innerHTML = "";

        characters.forEach(function (character) {
            let card = document.createElement("article");
            card.className = "card saved-card";

            let imageHtml = "";
            if (character.photo && character.photo.storedName) {
                imageHtml = "<img src='" + SERVER_URL + "/img/" + character.photo.storedName + "' alt='" + character.name + "' class='char-image'>";
            }

            card.innerHTML =
                imageHtml +
                "<h3>" + character.name + "</h3>" +
                "<p class='meta'><strong>Altura:</strong> " + character.height + " cm</p>" +
                "<p class='meta'><strong>Peso:</strong> " + character.mass + " kg</p>" +
                "<p class='meta'><strong>Pelo:</strong> " + character.hair_color + "</p>" +
                "<p class='meta'><strong>Ojos:</strong> " + character.eye_color + "</p>" +
                "<p class='meta'><strong>Año de nacimiento:</strong> " + character.birth_year + "</p>" +
                "<p class='meta'><strong>Piel:</strong> " + character.skin_color + "</p>" +
                "<p class='meta'><strong>Genero:</strong> " + character.gender + "</p>" +
                "<p class='meta saved-date'><strong>Guardado:</strong> " + new Date(character.recibidoEn).toLocaleString() + "</p>";

            savedCharactersList.appendChild(card);
        });
    }

    // --- Juego: start, autocomplete, check ---
    let startBtn = document.getElementById("start-game");
    let guessInput = document.getElementById("guess-input");
    let suggestionsEl = document.getElementById("suggestions");
    let checkBtn = document.getElementById("check-btn");
    let checkResult = document.getElementById("check-result");
    let attemptsCountEl = document.getElementById("attempts-count");
    let attemptHistoryEl = document.getElementById("attempt-history");
    let attempts = 0;
    let history = [];

    function updateAttemptsCounter() {
        if (attemptsCountEl) {
            attemptsCountEl.textContent = String(attempts);
        }
    }

    function renderAttemptHistory() {
        if (!attemptHistoryEl) {
            return;
        }

        attemptHistoryEl.innerHTML = "";

        if (history.length === 0) {
            let emptyItem = document.createElement("li");
            emptyItem.className = "attempt-item attempt-empty";
            emptyItem.textContent = "Sin intentos aun.";
            attemptHistoryEl.appendChild(emptyItem);
            return;
        }

        history.forEach(function (entry, index) {
            let item = document.createElement("li");
            item.className = "attempt-item" + (entry.isWin ? " attempt-win" : "");

            let name = document.createElement("span");
            name.className = "attempt-name";
            name.textContent = (index + 1) + ". " + entry.guessedName;

            let score = document.createElement("span");
            score.className = "attempt-score";
            score.textContent = "Verdes: " + entry.greens + " | Rojos: " + entry.reds + " | Desconocidos: " + entry.unknowns;

            item.appendChild(name);
            item.appendChild(score);
            attemptHistoryEl.appendChild(item);
        });
    }

    function getMatchStats(match) {
        let stats = { greens: 0, reds: 0, unknowns: 0 };

        Object.keys(match || {}).forEach(function (key) {
            if (match[key] === "verde") {
                stats.greens += 1;
            } else if (match[key] === "rojo") {
                stats.reds += 1;
            } else {
                stats.unknowns += 1;
            }
        });

        return stats;
    }

    function startGame() {
        setStatus("Iniciando juego...", false);
        fetch(SERVER_URL + "/juego/start", { method: "POST" })
            .then((r) => r.json())
            .then((j) => {
                if (j.error) {
                    setStatus(j.error, true);
                    return;
                }
                attempts = 0;
                history = [];
                updateAttemptsCounter();
                renderAttemptHistory();
                checkResult.innerHTML = "";
                guessInput.value = "";
                suggestionsEl.innerHTML = "";
                checkBtn.disabled = false;
                guessInput.disabled = false;
                setStatus("Juego iniciado (fuente: " + (j.fuente || "local") + ").", false);
            })
            .catch(() => setStatus("No se pudo iniciar el juego.", true));
    }

    function renderSuggestions(list) {
        suggestionsEl.innerHTML = "";
        list.forEach(function (name) {
            let d = document.createElement("div");
            d.className = "suggestion";
            d.textContent = name;
            d.addEventListener("click", function () {
                guessInput.value = name;
                suggestionsEl.innerHTML = "";
            });
            suggestionsEl.appendChild(d);
        });
    }

    function autocomplete(q) {
        if (!q) {
            suggestionsEl.innerHTML = "";
            return;
        }
        fetch(SERVER_URL + "/juego/autocomplete?q=" + encodeURIComponent(q))
            .then((r) => r.json())
            .then((data) => {
                renderSuggestions(data.items || []);
            })
            .catch(() => {});
    }

    guessInput && guessInput.addEventListener("input", function (e) {
        autocomplete(e.target.value.trim());
    });

    function checkGuess() {
        let name = guessInput.value.trim();
        if (!name) return;
        fetch(SERVER_URL + "/juego/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guess: name }),
        })
            .then((r) => r.json())
            .then((result) => {
                if (result.error) {
                    checkResult.textContent = result.error;
                    checkResult.className = "error";
                    return;
                }

                checkResult.innerHTML = "";
                Object.keys(result.match).forEach(function (key) {
                    let el = document.createElement("div");
                    el.textContent = key + ": " + result.match[key];
                    el.className = "check-" + result.match[key];
                    checkResult.appendChild(el);
                });

                attempts += 1;
                updateAttemptsCounter();

                let stats = getMatchStats(result.match);
                let isWin = result.match && result.match.name === "verde";
                history.unshift({
                    guessedName: result.guessedName || name,
                    greens: stats.greens,
                    reds: stats.reds,
                    unknowns: stats.unknowns,
                    isWin: isWin,
                });
                renderAttemptHistory();

                if (result.guessedName) {
                    let guessInfo = document.createElement("div");
                    guessInfo.className = "meta";
                    guessInfo.textContent = "Comparando: " + result.guessedName;
                    checkResult.appendChild(guessInfo);
                }

                if (isWin) {
                    let winNotice = document.createElement("div");
                    winNotice.className = "win-notice";
                    winNotice.textContent = "¡Has ganado! Lo adivinaste en " + attempts + " intento" + (attempts === 1 ? "" : "s") + ".";
                    checkResult.insertBefore(winNotice, checkResult.firstChild);
                    setStatus("Victoria en " + attempts + " intento" + (attempts === 1 ? "" : "s") + ".", false);
                    checkBtn.disabled = true;
                    guessInput.disabled = true;
                }
            })
            .catch(() => {
                checkResult.textContent = "Error en la comprobacion.";
            });
    }

    updateAttemptsCounter();
    renderAttemptHistory();

    startBtn && startBtn.addEventListener("click", startGame);
    checkBtn && checkBtn.addEventListener("click", checkGuess);
    resetListBtn && resetListBtn.addEventListener("click", resetCharacterList);
    resetDataBtn && resetDataBtn.addEventListener("click", function () {
        if (confirm("¿Estás seguro? Esto borrará todos los personajes guardados e imágenes.")) {
            fetch(SERVER_URL + "/reset", { method: "POST" })
                .then((r) => r.json())
                .then((data) => {
                    console.log("Reset response:", data);
                    setStatus(data.mensaje || "Datos reseteados", false);
                    setTimeout(function() {
                        loadSavedCharacters();
                    }, 300);
                })
                .catch((err) => {
                    console.error("Reset error:", err);
                    setStatus("Error al resetear datos", true);
                });
        }
    });

    function renderCharacters(characters) {
        charactersList.innerHTML = "";

        characters.forEach(function (character) {
            let card = document.createElement("article");
            card.className = "card";
            let eyeColor = getCharacterField(character, "eye_color", "eyeColor");
            let birthYear = getCharacterField(character, "birth_year", "birthYear");

            card.innerHTML =
                "<h3>" + character.name + "</h3>" +
                "<p class='meta'><strong>Altura:</strong> " + character.height + " cm</p>" +
                "<p class='meta'><strong>Peso:</strong> " + character.mass + " kg</p>" +
                "<p class='meta'><strong>Pelo:</strong> " + character.hair_color + "</p>" +
                "<p class='meta'><strong>Ojos:</strong> " + eyeColor + "</p>" +
                "<p class='meta'><strong>Año de nacimiento:</strong> " + birthYear + "</p>" +
                "<p class='meta'><strong>Piel:</strong> " + character.skin_color + "</p>" +
                "<p class='meta'><strong>Genero:</strong> " + character.gender + "</p>";

            let actions = document.createElement("div");
            actions.className = "actions";

            let transferBtn = document.createElement("button");
            transferBtn.type = "button";
            transferBtn.textContent = "Transferir al servidor";

            let getSavedBtn = document.createElement("button");
            getSavedBtn.type = "button";
            getSavedBtn.textContent = "Ver guardado en servidor";

            let fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = "image/*";

            transferBtn.addEventListener("click", function () {
                transferCharacter(character, fileInput, transferBtn);
            });

            getSavedBtn.addEventListener("click", function () {
                fetch(SERVER_URL + "/persona/" + encodeURIComponent(character.name))
                    .then(function (r) {
                        if (!r.ok) {
                            throw new Error("No encontrado");
                        }
                        return r.json();
                    })
                    .then(function (data) {
                        setStatus("Encontrado en servidor: " + data.item.name, false);
                    })
                    .catch(function () {
                        setStatus("No existe en servidor todavia: " + character.name, true);
                    });
            });

            actions.appendChild(transferBtn);
            actions.appendChild(getSavedBtn);
            actions.appendChild(fileInput);
            card.appendChild(actions);
            charactersList.appendChild(card);
        });
    }

    function renderPagination(totalItems, activePage) {
        pagination.innerHTML = "";

        let totalPages = Math.ceil(totalItems / 10);

        for (let i = 1; i <= totalPages; i += 1) {
            let button = document.createElement("button");
            button.type = "button";
            button.textContent = String(i);
            button.className = "page-btn" + (i === activePage ? " active" : "");

            (function (pageNumber) {
                button.addEventListener("click", function () {
                    getPeople(pageNumber);
                });
            })(i);

            pagination.appendChild(button);
        }
    }

    getPeople(1);
    console.log("Cargando personajes guardados...");
    loadSavedCharacters();
})();
