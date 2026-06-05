// URL base de tu backend de FastAPI
const API_URL = "http://127.0.0.1:8000";

let miGrafico = null;
let datosHistoricosCompletos = []; // Para guardar los datos del historial originales.
let tipoVistaActual = 'linea'; // valores posibles: 'linea' y 'velas'.


// Cuando la página termine de cargarse en el navegador, ejecutamos la función
document.addEventListener("DOMContentLoaded", () => {
    cargarIndicadores();

    const btnCerrar = document.getElementById('btn-cerrar-panel');
    const panelGeneral = document.getElementById('seccion-grafico');

    if (btnCerrar && panelGeneral) {
        btnCerrar.addEventListener('click', () => {
            panelGeneral.style.display = 'none'; // Oculta todo el bloque completo (Grafico + Noticias).
            console.log("❌ Panel lateral cerrado correctamente.");
        })
    }
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
                    <td class="pl-6 pr-4 py-4 flex flex-row items-center justify-end gap-3 whitespace-nowrap">
                        <button class="bg-gray-700 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded transition" onclick="verHistorial('${activo.ticker}')">
                            📈 Ver Historial
                        </button>

                        <button onclick="eliminarActivo('${activo.ticker}')"
                        title= "Eliminar Activo"
                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
                            🗑️
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


// FUNCIÓN 3: Buscar el historial en la DB y dibujar el gráfico interactivo
function verHistorial(ticker) {
    const seccionGrafico = document.getElementById("seccion-grafico");
    const graficoTitulo = document.getElementById("grafico-titulo") || document.getElementById("titulo-grafico");
    
    // Mostramos la sección del gráfico (le sacamos la clase 'hidden' de Tailwind)
    seccionGrafico.classList.remove("hidden");
    
    if (graficoTitulo) {
        graficoTitulo.textContent = `📈 Historial de Precios: ${ticker}`;
    }

    // Disparamos las noticias en paralelo.
    cargarNoticias(ticker); 

    // Le pegamos a tu endpoint de lectura rápida de la base de datos
    fetch(`${API_URL}/db/historial/${ticker}`)
        .then(response => {
            if (!response.ok) {
                throw new Error("No hay historial guardado para este activo.");
            }
            return response.json();
        })
        .then(datosHistorial => {
            // ==========================================
            //          PROCESAMIENTO Y CÁLCULOS
            // ==========================================
            datosHistorialCompletos = datosHistorial; // Me guardo los datos de los 30 dias.
            

            // Reseteamos el slider a 30, cada vez que se abre un activo nuevo.
            const slider = document.getElementById("range-dias");
            if (slider) {
                slider.value = 30;
                document.getElementById("valor-dias").innerText = 30;
            }

            // Llamo a funcion interna que se encarga de procesar y dibujar.
            actualizarGraficoProcesado(datosHistorialCompletos);

            // Auto-scrollear suavemente hasta la sección del gráfico
            seccionGrafico.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            console.error("Error técnico real:", error);
            alert(`⚠️ Para graficar ${ticker}, primero debés consultar el endpoint de actualización (/historial/${ticker}) en el navegador para poblar la base de datos por primera vez.`);
        });
}

// FUNCION Auxiliar: Actualiza el grafico, cuando se cambia el rango de dias en el grafico.
function actualizarGraficoProcesado(datosARenderizar) {
    // Todo tu código de procesamiento actual usando 'datosARenderizar' en vez de 'datosHistorial'
    const etiquetasFechas = datosARenderizar.map(dia => dia.fecha);
    const preciosCierre = datosARenderizar.map(dia => dia.precio_cierre);
    const volumenes = datosARenderizar.map(dia => dia.volumen || 0);
    const preciosApertura = datosARenderizar.map(dia => dia.precio_apertura);
    const preciosMaximos = datosARenderizar.map(dia => dia.precio_maximo);
    const preciosMinimos = datosARenderizar.map(dia => dia.precio_minimo);

    const maximoAbsoluto = Math.max(...preciosMaximos);
    const minimoAbsoluto = Math.min(...preciosMinimos);
    const sumaCierres = preciosCierre.reduce((acc, p) => acc + p, 0);
    const promedioPrecio = sumaCierres / preciosCierre.length;

    // Configuracion dinamica del dataset principal.
    let datasetPrincipal = {};

    if (tipoVistaActual === 'linea') {
        // configuracion clasica de linea azul que ya tenia.
        datasetPrincipal = {
            type: 'line',
            label: 'Precio de Cierre (USD)',
            data: preciosCierre,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            borderWidth: 3,
            tension: 0.2,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 3,
            pointHoverRadius: 6,
            yAxisID: 'y'
        };
    } else {
        // Configuración para Gráfico de Velas Japonesas
        datasetPrincipal = {
            type: 'candlestick',
            label: 'Precios OHLC',
            // Mapeamos los datos en la estructura especial {x, o, h, l, c} que pide el plugin financiero
            data: datosARenderizar.map(dia => ({
                x: luxon.DateTime.fromISO(dia.fecha).valueOf(), // Convierte la fecha a timestamp numérico
                o: dia.precio_apertura,
                h: dia.precio_maximo,
                l: dia.precio_minimo,
                c: dia.precio_cierre
            })),
            yAxisID: 'y',
            // Colores profesionales de trading en Dark Mode:
            color: {
                up: '#10b981',    // Verde esmeralda para días alcistas (Tailwind emerald-500)
                down: '#ef4444',  // Rojo para días bajistas (Tailwind red-500)
                unchanged: '#94a3b8' // Gris si cerró igual
            }
        };
    }

    const ctx = document.getElementById('historicoChart').getContext('2d');

    if (miGrafico) {
        miGrafico.destroy();
    }

    // ==========================================
    //      NUEVA CONFIGURACIÓN DEL CHART
    // ==========================================
    if (miGrafico) {
        miGrafico.destroy();
    }

    miGrafico = new Chart(ctx, {
        data: {
            labels: etiquetasFechas, 
            datasets: [
                datasetPrincipal, // Inyectamos dinámicamente la Línea o las Velas aquí
                {
                    type: 'bar',
                    label: 'Volumen Diario',
                    data: volumenes,
                    backgroundColor: 'rgba(156, 163, 175, 0.15)',
                    hoverBackgroundColor: 'rgba(156, 163, 175, 0.3)',
                    yAxisID: 'yVolumen',
                    barThickness: 'flex'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            if (context.datasetIndex === 0) {
                                return [
                                    `🟢 Apertura: $${preciosApertura[index].toFixed(2)}`,
                                    `🔵 Cierre: $${preciosCierre[index].toFixed(2)}`,
                                    `🔺 Máximo: $${preciosMaximos[index].toFixed(2)}`,
                                    `🔻 Mínimo: $${preciosMinimos[index].toFixed(2)}`,
                                    `📊 Vol: ${volumenes[index].toLocaleString()}`
                                ];
                            }
                                return `📊 Volumen: ${context.raw.toLocaleString()}`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        lineaMax: {
                            type: 'line', yMin: maximoAbsoluto, yMax: maximoAbsoluto,
                            borderColor: 'rgba(239, 68, 68, 0.4)', borderWidth: 1.5, borderDash: [4, 4],
                            label: { display: true, content: `Máx: $${maximoAbsoluto.toFixed(2)}`, position: 'start', backgroundColor: 'rgba(239, 68, 68, 0.7)', style: { fontSize: 10 } }
                        },
                        lineaMin: {
                            type: 'line', yMin: minimoAbsoluto, yMax: minimoAbsoluto,
                            borderColor: 'rgba(34, 197, 94, 0.4)', borderWidth: 1.5, borderDash: [4, 4],
                            label: { display: true, content: `Mín: $${minimoAbsoluto.toFixed(2)}`, position: 'start', backgroundColor: 'rgba(34, 197, 94, 0.7)', style: { fontSize: 10 } }
                        },
                        lineaPromedio: {
                            type: 'line', yMin: promedioPrecio, yMax: promedioPrecio,
                            borderColor: 'rgba(234, 179, 8, 0.3)', borderWidth: 1.5, borderDash: [6, 6],
                            label: { display: true, content: `Prom: $${promedioPrecio.toFixed(2)}`, position: 'end', backgroundColor: 'rgba(234, 179, 8, 0.6)', style: { fontSize: 10 } }
                        }
                    }
                }
            },
            scales: {
                x: {
                    // Para que el plugin financiero de velas dibuje bien, necesita saber que el eje X maneja tiempos
                    type: tipoVistaActual === 'velas' ? 'time' : 'category',
                    time: { unit: 'day' },
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: '#374151' },
                    ticks: { 
                        color: '#9ca3af', 
                        callback: function(value) { return '$' + value.toFixed(2); } 
                    },
                    // Le damos un margen inteligente de holgura por encima y por debajo
                    // Le restamos un 5% al mínimo absoluto para que no toque el piso
                    min: Math.floor(minimoAbsoluto * 0.95), 
                    // Le sumamos un 5% al máximo absoluto para que no toque el techo
                    max: Math.ceil(maximoAbsoluto * 1.05)
                },
            }
        }
    });
}

// FUNCION Auxiliar:Obtiene el numero de dias, cada vez que se modifica el valor del selector.
function cambiarRangoDias(cantidadDias) {
    // Convertimos a numero el valor del slider.
    const dias = parseInt(cantidadDias);

    //Actualizamos el texto en el HTML, para que el usuario vea que numero eligió.
    document.getElementById("valor-dias").innerText = dias;

    if(!datosHistorialCompletos || datosHistorialCompletos.length === 0) {
        console.warn("No hay datos historicos cargados para recortar.");
        return;
    }

    // Cortamos el array original, para quedarnos con los ultimos dias.
    // El slice con numero negativo corta desde el final hacia atras. ?
    const datosRecortados = datosHistorialCompletos.slice(-dias);

    // Volvemos a dibujar el grafico con el recorte. 
    actualizarGraficoProcesado(datosRecortados);
}

// FUNCIÓN 4: Refrescar toda la DB (Indicadores + Historiales) con Cooldown de seguridad
const btnRefrescar = document.getElementById("btn-refrescar");

if (btnRefrescar) {
    btnRefrescar.addEventListener("click", () => {
        // 1. Bloqueamos el botón inmediatamente para evitar clics repetidos
        btnRefrescar.disabled = true;
        btnRefrescar.classList.add("opacity-50", "cursor-not-allowed");
        btnRefrescar.innerHTML = "🔄 Actualizando datos...";

        // 2. Le pegamos al backend inteligente que creamos recién
        fetch(`${API_URL}/db/refrescar`, { method: "POST" })
            .then(response => {
                if (!response.ok) throw new Error("Error al refrescar los datos del servidor.");
                return response.json();
            })
            .then(data => {
                console.log("DB Refrescada:", data.message);
                
                // 3. Como los datos cambiaron en Postgres, refrescamos la tabla visual
                cargarIndicadores();
                
                // 4. Activamos el contador de "Enfriamiento" (Cooldown) de 60 segundos
                iniciarEnfriamientoBoton(60);
            })
            .catch(error => {
                console.error("Error al refrescar:", error);
                alert("❌ No se pudo refrescar la base de datos. Intentá nuevamente.");
                
                // Si falla, le devolvemos el estado normal al botón al toque
                btnRefrescar.disabled = false;
                btnRefrescar.classList.remove("opacity-50", "cursor-not-allowed");
                btnRefrescar.innerHTML = "🔄 Refrescar DB";
            });
    });
}

// Función auxiliar para manejar la cuenta regresiva del botón
function iniciarEnfriamientoBoton(segundosTotales) {
    let tiempoRestante = segundosTotales;
    
    // Usamos un intervalo que se ejecuta cada 1 segundo (1000ms)
    const temporizador = setInterval(() => {
        tiempoRestante--;
        
        if (tiempoRestante > 0) {
            // Mostramos los segundos que faltan para poder volver a clickear
            btnRefrescar.innerHTML = `⏳ Esperá ${tiempoRestante}s...`;
        } else {
            // ¡Se cumplió el tiempo! Limpiamos el intervalo y revivimos el botón
            clearInterval(temporizador);
            btnRefrescar.disabled = false;
            btnRefrescar.classList.remove("opacity-50", "cursor-not-allowed");
            btnRefrescar.innerHTML = "🔄 Refrescar DB";
        }
    }, 1000);
}

// FUNCIÓN 5: Eliminar un activo usando el Modal Personalizado
function eliminarActivo(ticker) {
    // 1. Capturamos los elementos del modal que pusimos en el HTML
    const modal = document.getElementById("modal-confirmacion");
    const modalTitulo = document.getElementById("modal-titulo");
    const modalMensaje = document.getElementById("modal-mensaje");
    const btnConfirmar = document.getElementById("btn-modal-confirmar");
    const btnCancelar = document.getElementById("btn-modal-cancelar");

    // 2. Personalizamos el texto del cartel con el ticker actual
    modalMensaje.innerHTML = `¿Estás seguro de que querés eliminar a <strong class="text-white">${ticker}</strong> de tu lista de indicadores?`;
    modalTitulo.innerText = "¿Eliminar activo?";
    modalTitulo.className = "text-xl font-bold text-white mb-2"; // Vuelve a ser blanco
    btnConfirmar.classList.remove("hidden"); // Reaparece el botón de "Sí, eliminar"
    btnCancelar.innerText = "Cancelar"; // El botón vuelve a decir cancelar
    btnCancelar.className = "bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors";

    // 3. Mostramos el modal sacándole la clase 'hidden'
    modal.classList.remove("hidden");

    // 4. Creamos la función que se ejecutará si el usuario dice que SÍ
    const manejarConfirmacion = () => {
        console.log(`🗑️ Eliminando de forma confirmada: ${ticker}`);
        
        // Hacemos el fetch que ya teníamos programado
        fetch(`${API_URL}/db/indicadores/${ticker}`, { method: "DELETE" })
            .then(response => {
                if (!response.ok) throw new Error("Error al eliminar del servidor.");
                return response.json();
            })
            .then(data => {
                // CASO DE ÉXITO: En vez de cerrar el modal de golpe, le avisamos al usuario
                modalTitulo.innerText = "✨ ¡Éxito!";
                modalTitulo.className = "text-xl font-bold text-emerald-400 mb-2"; // Verde lindo financiera
                modalMensaje.innerHTML = `El activo <strong>${ticker}</strong> y su historial se eliminaron correctamente.`;
                
                // Ocultamos los dos botones viejos y creamos un botón temporal de "OK"
                btnConfirmar.classList.add("hidden");
                btnCancelar.innerText = "Entendido";
                
                // Cuando toca "Entendido", refrescamos la tabla y cerramos del todo
                const finalizarTodo = () => {
                    cerrarModal();
                    cargarIndicadores();
                    btnCancelar.removeEventListener("click", finalizarTodo);
                };
                btnCancelar.addEventListener("click", finalizarTodo);
            })
            .catch(error => {
                console.error(error);
                
                // CASO DE ERROR: Transformamos el modal en un cartel de alerta rojo
                modalTitulo.innerText = "⚠️ Hubo un problema";
                modalTitulo.className = "text-xl font-bold text-red-500 mb-2"; // Rojo de advertencia
                modalMensaje.innerHTML = `No se pudo eliminar a <strong>${ticker}</strong>.<br><span class="text-xs text-slate-500">Detalle: ${error.message}</span>`;
                
                // Ocultamos el botón de confirmar (porque ya falló) y el de cancelar dice "Cerrar"
                btnConfirmar.classList.add("hidden");
                btnCancelar.innerText = "Cerrar";
                btnCancelar.className = "bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors";
            });
    };

    // 5. Función auxiliar para cerrar el cartel y limpiar los eventos
    const cerrarModal = () => {
        modal.classList.add("hidden");
        // Removemos los listeners para que no se acumulen para el próximo clic
        btnConfirmar.removeEventListener("click", manejarConfirmacion);
        btnCancelar.removeEventListener("click", cerrarModal);
    };

    // 6. Escuchamos los clics de los botones del modal
    btnConfirmar.addEventListener("click", manejarConfirmacion);
    btnCancelar.addEventListener("click", cerrarModal);
}

//FUNCION: Cambia el color de los botones, actualiza la variable global y vuelve a renderizar el grafico con los mismos dias.
function cambiarTipoVista(nuevaVista) {
    // Si hay un grafico dibujado, lo destruimos.
    // Esto obliga a Chart.js a resetear los ejes (X e Y) desde cero.
    if(miGrafico) {
        miGrafico.destroy();
        miGrafico = null; // Limpio la variable, para asegurar un lienzo nuevo.
    }

    // Actualizamos la variable global.
    tipoVistaActual = nuevaVista;

    const btnLinea = document.getElementById("btn-vista-linea");
    const btnVelas = document.getElementById("btn-vista-velas");

    if (nuevaVista === 'linea') {
        // Línea Activo (Azul con texto blanco)
        btnLinea.className = "bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors";
        // Velas Inactivo (Fondo oscuro, texto gris)
        btnVelas.className = "text-slate-400 hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-transparent";
    } else {
        // Velas Activo (Azul con texto blanco)
        btnVelas.className = "bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors";
        // Línea Inactivo (Fondo oscuro, texto gris)
        btnLinea.className = "text-slate-400 hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-transparent";
    }

    // Capturamos cuantos dias tiene seleccionados el slider actualmente.
    const slider = document.getElementById("range-dias");
    const cantidadDias = slider ? parseInt(slider.value) : 30;

    // Cortamos el array con esa cantidad exacta de dias.
    const datosRecortados = datosHistorialCompletos.slice(-cantidadDias);

    // Volvemos a renderizar el grafico con los datos actualizados desde cero.
    actualizarGraficoProcesado(datosRecortados);
}


// FUNCION 6: Funcion que va a cargar las noticias, es decir, va a conectar el backend, con el frontend, para que se puedan visualizar las noticias.
async function cargarNoticias(ticker) {
    const panelGeneral = document.getElementById("seccion-grafico");
    const contenedor = document.getElementById("contenedor-noticias");

    // Cada vez que el usuario elige un activo, nos aseguramos de volver a mostrar el panel por si estaba oculto (en display: none).
    if (panelGeneral) {
        panelGeneral.style.display = 'block';
    }

    // Ponemos el estado de carga por si cambia el activo.
    contenedor. innerHTML = `
        <div class="text-xs text-center py-12 text-slate-500">
            <span class="inline-block animate-spin mr-1">⏳</span> Buscando primicias del mercado...
        </div>
    `;

    try {
        // Le pegamos a nuestro endpoint del backend.
        const respuesta = await fetch(`http://127.0.0.1:8000/api/noticias/${ticker}`);

        if (!respuesta.ok) {
            throw new Error("No se pudieron recuperar las noticias.");
        }

        const noticias = await respuesta.json();

        // Si la API no devolvio ninguna noticia, avisamos al usuario.
        if (!noticias || noticias.length === 0) {
            contenedor.innerHTML = `
                <div class="text-xs text-center py-12 text-slate-500">
                    📭 No se encontraron noticias recientes para este activo.
                </div>
            `;
            return; // No hay noticias, termina la funcion.
        }

        // Limpiamos el contenedor antes de inyectar las tarjetas.
        contenedor.innerHTML = "";

        // Recorremos las 4 noticias y armamos el diseño dinámico.
        noticias.forEach(articulo => {
            // Aseguramos que haya un título, si no viene ponemos un genérico
            const titulo = articulo.title || "Novedades en el mercado financiero";
            
            // Si la descripción no existe o está vacía, ponemos un texto seguro
            const descripcion = articulo.description && articulo.description.trim() !== "" 
                ? articulo.description 
                : "Hacé clic para conocer los detalles completos de esta novedad del mercado.";

            // Validamos la fuente / medio de comunicación
            const fuente = articulo.source || "Info Mercado";

            // Validamos la miniatura, si no hay ponemos la de Unsplash
            const imagenUrl = articulo.image_url || "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=150&auto=format&fit=crop&q=60";
            
            // Formateamos la fecha de publicación de manera segura
            let fechaHumana = "Reciente";
            if (articulo.published_at) {
                try {
                    fechaHumana = new Date(articulo.published_at).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short'
                    });
                } catch (e) {
                    console.warn("Error al formatear fecha de una noticia:", e);
                }
            }

            // 5. Construimos la tarjeta HTML con variables recontra validadas
            const tarjetaHTML = `
                <a href="${articulo.url || '#'}" target="_blank" rel="noopener noreferrer" 
                   class="block bg-slate-900/60 hover:bg-slate-700/50 p-3 rounded-lg border border-slate-700/60 transition-all hover:-translate-y-0.5 group">
                    <div class="flex gap-3">
                        <img src="${imagenUrl}" 
                             class="w-16 h-16 object-cover rounded-lg bg-slate-800 shrink-0 border border-slate-700/50 shadow-inner" 
                             alt="News"
                             onerror="this.src='https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=150&auto=format&fit=crop&q=60'"
                        >
                        <div class="flex flex-col justify-between min-w-0 w-full gap-1">
                            <h4 class="text-[11px] font-bold text-slate-100 group-hover:text-blue-400 line-clamp-2 leading-snug transition-colors" title="${titulo}">
                                ${titulo}
                            </h4>
                            
                            <p class="text-[10px] text-slate-400 line-clamp-1 leading-normal font-normal">
                                ${descripcion}
                            </p>

                            <div class="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                                <span class="font-bold text-slate-400 uppercase tracking-wider max-w-[120px] truncate">${fuente}</span>
                                <span class="bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400 font-medium border border-slate-700/30">📅 ${fechaHumana}</span>
                            </div>
                        </div>
                    </div>
                </a>
            `;

            // Inyectamos la tarjeta adentro del panel
            contenedor.insertAdjacentHTML("beforeend", tarjetaHTML);
        });
    } catch(error) {
        console.log("Error al cargar las noticias: ", error);
        contenedor.innerHTML = `
            <div class="text-xs text-center py-12 text-red-400">
                ⚠️ Error al conectar con el servidor de noticias.
            </div>
        `;
    }
}