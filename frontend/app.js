// URL base de tu backend de FastAPI
const API_URL = "http://127.0.0.1:8000";

// Cuando la página termine de cargarse en el navegador, ejecutamos la función
document.addEventListener("DOMContentLoaded", () => {
    cargarIndicadores();
});

// FUNCIÓN 1: Ir a buscar los indicadores a la DB y dibujarlos en la tabla
function cargarIndicadores() {
    const tablaBody = document.getElementById("tabla-indicadores-body");
    
    // Le pegamos al endpoint de lectura rápida que creamos hace un rato
    fetch(`${API_URL}/db/indicadores`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Error al conectar con el backend");
            }
            return response.json(); // Convertimos la respuesta a un objeto/array de JS
        })
        .then(activos => {
            // Limpiamos la tabla por si tenía algo adentro
            tablaBody.innerHTML = "";

            if (activos.length === 0) {
                tablaBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="p-8 text-center text-gray-500">
                            No hay activos guardados. ¡Usa el buscador de arriba para agregar el primero!
                        </td>
                    </tr>`;
                return;
            }

            // Recorremos el array de activos que nos devolvió Postgres
            activos.forEach(activo => {
                // Lógica visual: si la variación es positiva verde, si es negativa rojo
                const claseColor = activo.variacion_porcentual >= 0 ? "text-green-400" : "text-red-400";
                const signo = activo.variacion_porcentual >= 0 ? "+" : "";

                // Formateamos la capitalización de mercado para que no sea un número gigante e ilegible
                const capMercadoFormateada = activo.capitalizacion_mercado 
                    ? `$${(activo.capitalizacion_mercado / 1e9).toFixed(2)} B` 
                    : "N/A";

                // Creamos la fila (tr) con los datos del activo
                const fila = document.createElement("tr");
                fila.className = "hover:bg-gray-750 transition duration-150 border-b border-gray-700";
                
                fila.innerHTML = `
                    <td class="p-4 text-gray-500 font-mono">${activo.id}</td>
                    <td class="p-4 font-bold text-blue-400 tracking-wider">${activo.ticker}</td>
                    <td class="p-4 text-gray-300">${activo.nombre}</td>
                    <td class="p-4 text-right font-semibold">$${activo.precio_actual.toFixed(2)}</td>
                    <td class="p-4 text-right font-semibold ${claseColor}">${signo}${activo.variacion_porcentual.toFixed(2)}%</td>
                    <td class="p-4 text-right text-gray-400">${capMercadoFormateada}</td>
                    <td class="p-4 text-center">
                        <button class="bg-gray-700 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded transition" onclick="verHistorial('${activo.ticker}')">
                            📈 Ver Historial
                        </button>
                    </td>
                `;
                
                // Inyectamos la fila adentro del cuerpo de la tabla
                tablaBody.appendChild(fila);
            });
        })
        .catch(error => {
            console.error("Hubo un problema con la petición Fetch:", error);
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-red-400 font-semibold">
                        ❌ No se pudo conectar con el servidor backend. Asegurate de que uvicorn esté prendido.
                    </td>
                </tr>`;
        });
}


// FUNCIÓN 2: Escuchar el formulario de búsqueda para agregar nuevos activos
const buscadorForm = document.getElementById("buscador-form");
const tickerInput = document.getElementById("ticker-input");
const mensajeBusqueda = document.getElementById("mensaje-busqueda");

buscadorForm.addEventListener("submit", (e) => {
    // Evitamos que la página se recargue de golpe (comportamiento por defecto de los formularios HTML)
    e.preventDefault(); 
    
    // Agarramos el texto del input, le sacamos los espacios y lo pasamos a mayúsculas
    const ticker = tickerInput.value.trim().toUpperCase();
    
    if (!ticker) return;

    // Mostramos un estado de "Cargando..." en la pantalla
    mensajeBusqueda.textContent = `🔍 Buscando ${ticker} en Wall Street...`;
    mensajeBusqueda.className = "text-sm mt-2 text-blue-400 font-medium";
    mensajeBusqueda.classList.remove("hidden");

    // Deshabilitamos el botón un segundo para que el usuario no haga 20 clics seguidos
    const botonSubmit = buscadorForm.querySelector("button");
    botonSubmit.disabled = true;
    botonSubmit.classList.add("opacity-50", "cursor-not-allowed");

    // Le pegamos al endpoint del Backend que va a Yahoo Finance y guarda en Postgres
    fetch(`${API_URL}/indicadores/${ticker}`)
        .then(response => {
            if (!response.ok) {
                // Si el backend devuelve un 404 o 500, asumimos que el ticker no existe o falló la API
                throw new Error(`No se encontró el ticker "${ticker}" o la API falló.`);
            }
            return response.json();
        })
        .then(data => {
            // ¡Éxito! El backend ya lo guardó en la DB
            mensajeBusqueda.textContent = `✨ ¡${ticker} (${data.nombre}) agregado con éxito a la base de datos!`;
            mensajeBusqueda.className = "text-sm mt-2 text-green-400 font-medium";
            
            // Limpiamos el campo de texto
            tickerInput.value = "";

            // REFRESCAMOS LA TABLA: Volvemos a leer de la DB para que aparezca la nueva fila al instante
            cargarIndicadores();
        })
        .catch(error => {
            console.error("Error en la búsqueda:", error);
            mensajeBusqueda.textContent = `❌ Error: No se pudo encontrar el ticker "${ticker}". Verificá que esté bien escrito.`;
            mensajeBusqueda.className = "text-sm mt-2 text-red-400 font-medium";
        })
        .finally(() => {
            // Volvemos a habilitar el botón cuando termine todo el proceso (haya salido bien o mal)
            botonSubmit.disabled = false;
            botonSubmit.classList.remove("opacity-50", "cursor-not-allowed");
            
            // Escondemos el mensaje automáticamente después de 4 segundos para que quede limpio
            setTimeout(() => {
                mensajeBusqueda.classList.add("hidden");
            }, 4000);
        });
});


// Función auxiliar que usaremos más adelante para el gráfico
function verHistorial(ticker) {
    alert(`Próximamente: Vamos a dibujar el gráfico para ${ticker}`);
}