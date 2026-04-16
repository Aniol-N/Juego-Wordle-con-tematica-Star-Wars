(function () {
    "use strict";

    let API_URL = "https://swapi.py4e.com/api/people/?page=";
    let charactersList = document.getElementById("characters-list");
    let pagination = document.getElementById("pagination");
    let statusText = document.getElementById("status");
    let currentPage = 1;

    function setStatus(message, isError) {
        statusText.textContent = message;
        statusText.className = isError ? "error" : "";
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

    function renderCharacters(characters) {
        charactersList.innerHTML = "";

        characters.forEach(function (character) {
            let card = document.createElement("article");
            card.className = "card";

            card.innerHTML =
                "<h3>" + character.name + "</h3>" +
                "<p class='meta'><strong>Altura:</strong> " + character.height + " cm</p>" +
                "<p class='meta'><strong>Peso:</strong> " + character.mass + " kg</p>" +
                "<p class='meta'><strong>Pelo:</strong> " + character.hair_color + "</p>" +
                "<p class='meta'><strong>Piel:</strong> " + character.skin_color + "</p>" +
                "<p class='meta'><strong>Genero:</strong> " + character.gender + "</p>";

            let actions = document.createElement("div");
            actions.className = "actions";

            let transferBtn = document.createElement("button");
            transferBtn.type = "button";
            transferBtn.textContent = "Transferir al servidor";
            transferBtn.addEventListener("click", function () {
                alert("Transferencia simulada para " + character.name + ".");
            });

            let fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = "image/*";

            actions.appendChild(transferBtn);
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
