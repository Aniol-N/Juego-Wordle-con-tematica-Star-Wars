(function () {
    "use strict";

    let API_URL = "https://swapi.py4e.com/api/people/?page=";
    let SERVER_URL = "http://localhost:8089";
    let charactersList = document.getElementById("characters-list");
    let pagination = document.getElementById("pagination");
    let statusText = document.getElementById("status");
    let currentPage = 1;

    function setStatus(message, isError) {
        statusText.textContent = message;
        statusText.className = isError ? "error" : "";
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
        formData.append("eye_color", character.eye_color || "unknown");
        formData.append("birth_year", character.birth_year || "unknown");
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

    // --- Juego: start, autocomplete, check ---
    let startBtn = document.getElementById("start-game");
    let guessInput = document.getElementById("guess-input");
    let suggestionsEl = document.getElementById("suggestions");
    let checkBtn = document.getElementById("check-btn");
    let checkResult = document.getElementById("check-result");

    function startGame() {
        setStatus("Iniciando juego...", false);
        fetch(SERVER_URL + "/juego/start", { method: "POST" })
            .then((r) => r.json())
            .then((j) => {
                if (j.error) {
                    setStatus(j.error, true);
                    return;
                }
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

                if (result.guessedName) {
                    let guessInfo = document.createElement("div");
                    guessInfo.className = "meta";
                    guessInfo.textContent = "Comparando: " + result.guessedName;
                    checkResult.appendChild(guessInfo);
                }
            })
            .catch(() => {
                checkResult.textContent = "Error en la comprobacion.";
            });
    }

    startBtn && startBtn.addEventListener("click", startGame);
    checkBtn && checkBtn.addEventListener("click", checkGuess);

    function renderCharacters(characters) {
        charactersList.innerHTML = "";

        characters.forEach(function (character) {
            let card = document.createElement("article");
            card.className = "card";
            let eyeColor = character.eye_color || "desconocido";
            let birthYear = character.birth_year || "desconocido";

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
})();
