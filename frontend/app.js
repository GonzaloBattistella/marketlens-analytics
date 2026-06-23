// URL base de tu backend de FastAPI
const API_URL = "http://127.0.0.1:8000";

let tickerGLobal = "";
let miGrafico = null;
let datosHistoricosCompletos = []; // Para guardar los datos del historial originales.
let tipoVistaActual = 'linea'; // valores posibles: 'linea' y 'velas'.
let misfavoritosGlobal = []; // Variable global, donde se almacenan los favortios del usuario.
let datosMercadoGlobal = []; // Guardará el listado completo de activos con sus precios en tiempo real.
let unidadTiempoActual = 'dias'; // Puede ser 'dias', 'meses', 'max'.
let cantidadTiempoActual = 30; // El valor numerico actual del slider activo.
let herramientaActiva = 'cruz'; // Estado global de tu barra de herramientas.
let mostrarSMA20 = false; // Para controlar el estado de los indicadores. (SMA 2o días).
let mostrarEMA20 = false; 


// Cuando la página termine de cargarse en el navegador, ejecutamos la función
document.addEventListener("DOMContentLoaded", () => {
    // Registro seguro y compatible de plugins
    if (typeof window['chartjs-plugin-zoom'] !== 'undefined') {
        Chart.register(window['chartjs-plugin-zoom']);
    } else if (typeof ChartZoom !== 'undefined') {
        Chart.register(ChartZoom);
    }

    cargarIndicadores();

    const btnCerrar = document.getElementById('btn-cerrar-panel');
    const panelGeneral = document.getElementById('seccion-grafico');

    // Agrego los elementos del DOM para el login.
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const btnRegistro = document.getElementById('btn-registro');
    const btnSesion = document.getElementById('btn-sesion');

    // CHEQUEO DE SESION ACTIVA.
    const tokenGuardado = localStorage.getItem('token');
    const usuarioGuardado = localStorage.getItem('username');

    if (tokenGuardado && usuarioGuardado) {
        // Si existen en el localStorage, cambiamos el botón automáticamente sin pedir login
        UI_actualizarBotonUsuario(usuarioGuardado);

        // Si el usuario ya está logueado, ocultamos el boton de registro para que no moleste.
        if (btnRegistro) btnRegistro.classList.add('hidden');
    } else {
        // Mostramos los botones de IniciarSesion/Registro.
        UI_restaurarBotonesNavbar();
    }

    // ---- ESCUCHADORES DE EVENTOS (LISTENERS) ---- 

    if (btnCerrar && panelGeneral) {
        btnCerrar.addEventListener('click', () => {
            panelGeneral.style.display = 'none'; // Oculta todo el bloque completo (Grafico + Noticias).
            console.log("❌ Panel lateral cerrado correctamente.");
        })
    }

    // Boton Iniciar Sesión (abre el formulario de Login).
    if (btnSesion) {
        btnSesion.addEventListener('click', () => {
            const authContainer = document.getElementById('auth-container');
            if (authContainer) {
                authContainer.classList.remove('hidden');
            }

            irAPantallaLogin();
        });
    }

    // Boton de cerrar sesión.
    const btnLogout = document.getElementById('btn-logout');

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            Swal.fire({
                title: '¿Cerrar Sesión?',
                text: "Vas a salir de tu cuenta de MarketLens.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',     // Botón rojo para salir
                cancelButtonColor: '#3085d6',    // Botón azul para quedarse
                confirmButtonText: 'Sí, salir',
                cancelButtonText: 'Cancelar',
                background: '#1f2937',
                color: '#ffffff',
                customClass: { popup: 'rounded-2xl border border-gray-700' }
            }).then((result) => {
                if (result.isConfirmed) {
                    // Si confirma, limpiamos el almacenamiento local
                    localStorage.removeItem('token');
                    localStorage.removeItem('username');
                    localStorage.removeItem('foto_perfil');

                    // Mostramos cartel de éxito animado de SweetAlert2
                    Swal.fire({
                        title: '¡Sesión Cerrada!',
                        text: 'Saliste correctamente de MarketLens.',
                        icon: 'success',
                        background: '#1f2937',
                        color: '#ffffff',
                        timer: 2000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        customClass: { popup: 'rounded-2xl border border-gray-700' }
                    }).then(() => {
                        // Restauramos la barra y recargamos la app limpia
                        UI_restaurarBotonesNavbar();
                        location.reload();
                    });
                }
            });
        });
    }

    // Evento para boton de Crear Cuenta, para abrir el registro directo desde el navbar.
    if (btnRegistro) {
        btnRegistro.addEventListener('click', (e) => {
            authContainer.classList.remove('hidden'); // Muestro el fondo desenfocado.
            irAPantallaRegistro();
        });
    }

    // CONFIGURACIÓN DE LOS EVENTOS DE LA WATCHLIST.
    const btnAbrirWatchlist = document.getElementById('btn-abrir-watchlist');
    const btnCerrarWatchlist = document.getElementById('btn-cerrar-watchlist');
    const watchlistOverlay = document.getElementById('watchlist-overlay');

    // Click en la estrella del Navbar -> Cierra la barra.
    if (btnAbrirWatchlist) {
        btnAbrirWatchlist.addEventListener('click', () => UI_toggleWatchlist(true));
    }

    // Click en la "X" de la barra -> Cierra la barra.
    if (btnCerrarWatchlist) {
        btnCerrarWatchlist.addEventListener('click', () => UI_toggleWatchlist(false));
    }

    // Click en el fondo oscuro difuminado -> Cierra la barra.
    if (watchlistOverlay) {
        watchlistOverlay.addEventListener('click', () => UI_toggleWatchlist(false));
    }

    // Ejecutamos el chequeo de salud del servidor de inmediato al cargar la pagina.
    UI_verificarEstadoServidor();
    setInterval(UI_verificarEstadoServidor, 30000); // Chequeo el estado automaticamente cada 30 segundos. 
});

// FUNCIÓN 1: Ir a buscar los indicadores a la DB y dibujarlos en la tabla
function cargarIndicadores() {
    const tablaBody = document.getElementById("tabla-indicadores-body");

    // Le pegamos al endpoint de lectura rápida que creamos hace un rato
    fetchAutenticado(`${API_URL}/db/indicadores`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Error al conectar con el backend");
            }
            return response.json(); // Convertimos la respuesta a un objeto/array de JS
        })
        .then(activos => {
            // Guardamos la foto del mercado en timepo real de forma global.
            datosMercadoGlobal = activos;

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

                // Pregunto si este activo es un favorito o no.
                const esFavorito = misfavoritosGlobal.includes(activo.ticker);

                // Si es favorito, lo pintamos de amarillo, sino de gris.
                const claseEstrella = esFavorito ? "text-amber-400" : "text-gray-500 hover:text-amber-300";

                // si es favorito, el SVG se rellena (fill="currentColor"), si no queda vacio (fill="none")
                const rellenoEstrella = esFavorito ? "currentColor" : "none";

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
                        
                        <button data-ticker="${activo.ticker}"
                                onclick="alternarFavorito('${activo.ticker}', ${esFavorito})" 
                                class="btn-estrella-ticker ${claseEstrella} p-1.5 rounded-lg hover:bg-gray-700 transition-colors" 
                                title="${esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="${rellenoEstrella}" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </button>
                    
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

            // llamo a la funcion encargada de cargar la watchlist con sus datos.
            cargarWatchlist();
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
    fetchAutenticado(`${API_URL}/indicadores/${ticker}`)
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
    // Actualizo el valor del ticker de la variable global, para que se mantenga actualizada.
    tickerGLobal = ticker.toUpperCase();

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
    fetchAutenticado(`${API_URL}/db/historial/${ticker}`)
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
            datosHistoricosCompletos = datosHistorial; // Me guardo los datos del historial que vinieron de la DB.

            // RESETEO INTELIGENTE DE CONTROLES AL CAMBIAR DE ACTIVO
            const sliderDias = document.getElementById("range-dias");
            if (sliderDias) {
                sliderDias.value = 30;
                const txtDias = document.getElementById("valor-dias");
                if (txtDias) txtDias.innerText = 30;
            }

            const sliderMeses = document.getElementById("range-meses");
            if (sliderMeses) {
                sliderMeses.value = 2;
                const txtMeses = document.getElementById("valor-meses");
                if (txtMeses) txtMeses.innerText = 2;
            }

            // Forzamos que visualmente el sistema regrese a la unidad "Días" predeterminada
            unidadTiempoActual = 'dias';
            const btnDias = document.getElementById('btn-unidad-dias');
            const contDias = document.getElementById('contenedor-slider-dias');
            const contMeses = document.getElementById('contenedor-slider-meses');

            if (btnDias && contDias && contMeses) {
                document.getElementById('btn-unidad-meses').className = "text-xs font-semibold px-3 py-1.5 rounded-md transition-all text-slate-400 hover:text-white bg-transparent";
                document.getElementById('btn-unidad-max').className = "text-xs font-semibold px-3 py-1.5 rounded-md transition-all text-slate-400 hover:text-white bg-transparent";
                btnDias.className = "text-xs font-semibold px-3 py-1.5 rounded-md transition-all bg-blue-500 text-white shadow-md";
                contDias.classList.remove('hidden');
                contMeses.classList.add('hidden');
            }

            // Llamo a función interna que se encarga de procesar y dibujar el estado inicial (30 días).
            actualizarGraficoProcesado(datosHistoricosCompletos.slice(-30));

            // Auto-scrollear suavemente hasta la sección del gráfico
            seccionGrafico.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
            console.error("Error técnico real:", error);

            // Alerta con SweetAlert2
            Swal.fire({
                title: 'Activo sin Datos Iniciales',
                html: `Para poder graficar <strong>${ticker.toUpperCase()}</strong>, la base de datos necesita poblarse por primera vez.<br><br>Por favor, presiona el boton para sincronizar los datos del mercado.`,
                icon: 'info',
                showCancelButton: true,
                background: '#1f2937',
                color: '#ffffff',
                confirmButtonColor: '#10b981', // Verde esmeralda para la accion
                cancelButtonColor: '#ef4444', // Rojo para cancelar
                confirmButtonText: 'Sincronizar ahora',
                cancelButtonText: 'Cancelar',
                customClass: {
                    popup: 'rounded-2xl border border-gray-700'
                }
            }).then((result) => {
                // Si el usuario hace click en "Sincronizar ahora"
                if (result.isConfirmed) {
                    // Mostramos un cartel de "Cargando" para que el usuario sepa que se esta cargando los datos.
                    Swal.fire({
                        title: 'Sincronizando...',
                        text: `Buscando datos históricos de ${ticker.toUpperCase()}. Esto puede demorar unos segundos.`,
                        allowOutsideClick: false,
                        didOpen: () => { Swal.showLoading(); },
                        background: '#1f2937',
                        color: '#ffffff'
                    });

                    // Le pegamos al endpoint que va a buscar los datos, para cargarlos a DB.
                    fetch(`${API_URL}/historial/${ticker.toLowerCase()}`)
                        .then(res => {
                            if (!res.ok) throw new Error("Error en la sincronizacion.");
                            return res.json();
                        })
                        .then(() => {
                            // Exito! volvemos a llamar a la funcion, que dibuja el grafico.
                            Swal.close();
                            verHistorial(ticker);
                        })
                        .catch(err => {
                            console.error(err);
                            Swal.fire({
                                title: 'Error de Red',
                                text: 'No se pudo poblar la base de datos. Verificá que el servidor esté online.',
                                icon: 'error',
                                background: '#1f2937',
                                color: '#ffffff'
                            });
                        });
                }
            });
        });
}

/**
 * Alterna visualmente entre los sliders de dias, meses o vista maxima.
 * Verificando si el activo tiene suficientes datos historicos.
 */
function cambiarUnidadTiempo(unidad) {
    unidadTiempoActual = unidad; // Guardamos el estado

    // Reseteamos valores por defecto de los sliders al cambiar de pestaña
    if (unidad === 'dias') {
        cantidadTiempoActual = 30;
        document.getElementById('range-dias').value = 30;
        document.getElementById('valor-dias').innerText = 30;
    } else if (unidad === 'meses') {
        cantidadTiempoActual = 2;
        document.getElementById('range-meses').value = 2;
        document.getElementById('valor-meses').innerText = 2;
    }

    // Sincronizamos la UI de los botones (encender el activo, apagar el resto)
    actualizarEstilosBotonesTiempo(unidad);

    // Dibujamos con el nuevo rango
    renderizarRangoActual();
}

/**
 * Procesa el movimiento de los sliders, calcula el recorte matematico
 * y actualiza las etiquetas del DOM. 
 */
function procesarSliderInteligente(unidad, valor) {
    // Si el usuario mueve el slider, nos aseguramos que pertenezca a la unidad activa
    unidadTiempoActual = unidad;
    cantidadTiempoActual = parseInt(valor);

    // Actualizamos el número en el badge correspondiente
    if (unidad === 'dias') {
        document.getElementById('valor-dias').innerText = valor;
    } else if (unidad === 'meses') {
        document.getElementById('valor-meses').innerText = valor;
    }

    // Dibujamos dinámicamente mientras arrastra
    renderizarRangoActual();
}

// FUNCIÓN AUXILIAR DE UI: Mantiene los botones en su lugar.
function actualizarEstilosBotonesTiempo(unidadActiva) {
    const btnDias = document.getElementById('btn-unidad-dias');
    const btnMeses = document.getElementById('btn-unidad-meses');
    const btnMax = document.getElementById('btn-unidad-max');

    const contDias = document.getElementById('contenedor-slider-dias');
    const contMeses = document.getElementById('contenedor-slider-meses');

    // clase base de Tailwind.
    const claseInactivo = "text-xs font-semibold px-3 py-1.5 rounded-md transition-all text-slate-400 hover:text-white bg-transparent";
    const claseActivo = "text-xs font-semibold px-3 py-1.5 rounded-md transition-all bg-blue-500 text-white shadow-md";

    // Resetear estilos de botones
    btnDias.className = claseInactivo;
    btnMeses.className = claseInactivo;
    btnMax.className = claseInactivo;

    // Ocultar sliders por defecto.
    contDias.classList.add('hidden');
    contMeses.classList.add('hidden');

    // Activamos lo que corresponda segun el estado real.
    if (unidadActiva === 'dias') {
        btnDias.className = claseActivo;
        contDias.classList.remove('hidden');
    } else if (unidadActiva === 'meses') {
        btnMeses.className = claseActivo;
        contMeses.classList.remove('hidden');
    } else if (unidadActiva === 'max') {
        btnMax.className = claseActivo;
    }
}

// ======================================================================
//    FUNCIÓN AUXILIAR: RENDERIZAR RANGO ACTUAL (Evita duplicar código)
// ======================================================================
function renderizarRangoActual() {
    if (!datosHistoricosCompletos || datosHistoricosCompletos.length === 0) return;

    let datosFiltrados = [];
    const totalDiasDisponibles = datosHistoricosCompletos.length;

    if (unidadTiempoActual === 'dias') {
        // Validacion por si pide mas dias de los que existen en total.
        if (cantidadTiempoActual > totalDiasDisponibles) {
            mostrarToast(`⚠️ Este activo solo cuenta con ${totalDiasDisponibles} días de historial.`, 'info');
            datosFiltrados = datosHistoricosCompletos;
        } else {
            // Cortamos los ultimos X dias.
            datosFiltrados = datosHistoricosCompletos.slice(-cantidadTiempoActual);
        }
    }
    else if (unidadTiempoActual === 'meses') {
        // 1 mes de bolsa, tiene aprox 22 dias habiles.
        const diasRequeridos = cantidadTiempoActual * 22

        if (diasRequeridos > totalDiasDisponibles) {
            mostrarToast(`❌ Historial insuficiente para calcular ${cantidadTiempoActual} meses.`, 'warning');

            // Hacemos que la UI vuelva suavemente a 'dias' para que no queda la pantalla rota. 
            setTimeout(() => cambiarUnidadTiempo('dias'), 300);
            return; // Frenamos el renderizado.
        }

        datosFiltrados = datosHistoricosCompletos.slice(-diasRequeridos);
    }
    else if (unidadTiempoActual === 'max') {
        // Muestra los 5 años completos sin recortar.
        datosFiltrados = datosHistoricosCompletos;
    }

    // Llamado a la funcion que se encarga de destruir el gráfico viejo y renderizar nuevamente el grafico actualizado.
    actualizarGraficoProcesado(datosFiltrados);
}

/**
 * Actualiza el bloque OHLC Estático en la cabecera del gráfico.
 * con los valores de la ultima jornada disponible. 
 */
function actualizarPanelOHLCEstatico(aperturas, maximos, minimos, cierres) {
    const ohlcOpen = document.getElementById('ohlc-open');
    const ohlcHigh = document.getElementById('ohlc-high');
    const ohlcLow = document.getElementById('ohlc-low');
    const ohlcClose = document.getElementById('ohlc-close');

    // Validamos que los arrays existan y tengan datos para evitar un "undefined".
    if (aperturas && aperturas.length > 0) {
        // En los arrays historicos, el ultimo indice siempre representa la jornada mas reciente.
        const ultimoIndex = aperturas.length - 1;

        // Inyectamos los valores formateados a 2 decimales.
        if (ohlcOpen) ohlcOpen.innerText = `$${aperturas[ultimoIndex].toFixed(2)}`;
        if (ohlcHigh) ohlcHigh.innerText = `$${maximos[ultimoIndex].toFixed(2)}`;
        if (ohlcLow) ohlcLow.innerText = `$${minimos[ultimoIndex].toFixed(2)}`;
        if (ohlcClose) ohlcClose.innerText = `$${cierres[ultimoIndex].toFixed(2)}`;
    }
}


// =====================================================================================
//                 RENDERIZACIÓN DEL GRÁFICO DE UN ACTIVO (CON SMA FIJADA)
// =====================================================================================
function actualizarGraficoProcesado(datosARenderizar) {
    // LIMPIEZA DEL REPORTE DE IA (Evita mostrar info del activo anterior).
    const estadoInicialIA = document.getElementById('ia-estado-inicial');
    const estadoCargaIA = document.getElementById('ia-estado-carga');
    const textoReporteIA = document.getElementById('ia-texto-reporte');

    if (estadoInicialIA && estadoCargaIA && textoReporteIA) {
        estadoInicialIA.classList.remove('hidden');
        estadoCargaIA.classList.add('hidden');
        textoReporteIA.classList.add('hidden');
        textoReporteIA.innerHTML = '';
    }
    
    // =========================================================================

    // Procesamiento de los datos a renderizar (Ya recortados por el slider/vista)
    const etiquetasFechas = datosARenderizar.map(dia => dia.fecha);
    const preciosCierre = datosARenderizar.map(dia => dia.precio_cierre);
    const volumenes = datosARenderizar.map(dia => dia.volumen || 0);
    const preciosApertura = datosARenderizar.map(dia => dia.precio_apertura);
    const preciosMaximos = datosARenderizar.map(dia => dia.precio_maximo);
    const preciosMinimos = datosARenderizar.map(dia => dia.precio_minimo);

    const esVistaLinea = (tipoVistaActual === 'linea');

    const maximoAbsoluto = esVistaLinea ? Math.max(...preciosCierre) : Math.max(...preciosMaximos);
    const minimoAbsoluto = esVistaLinea ? Math.min(...preciosCierre) : Math.min(...preciosMinimos);
    const sumaCierres = preciosCierre.reduce((acc, p) => acc + p, 0);
    const promedioPrecio = sumaCierres / preciosCierre.length;

    // CALCULOS DE INDICADORES (Usando el historial completo para evitar desfasajes en el gráfico).
    const datosSMA20 = calcularSMA(datosHistoricosCompletos, 20, etiquetasFechas, tipoVistaActual);
    const datosEMA20 = calcularEMA(datosHistoricosCompletos, 20, etiquetasFechas, tipoVistaActual);

    // Actualizo los valores del Panel OHLC dentro de la sección del Gráfico
    actualizarPanelOHLCEstatico(preciosApertura, preciosMaximos, preciosMinimos, preciosCierre);

    const ctx = document.getElementById('historicoChart').getContext('2d');

    // Creación del Gradiente Premium (Oro -> Transparente)
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
    gradient.addColorStop(1, 'rgba(31, 41, 55, 0.0)');

    let datasetPrincipal = {};

    if (tipoVistaActual === 'linea') {
        datasetPrincipal = {
            type: 'line',
            label: 'Precio de Cierre (USD)',
            data: preciosCierre,
            borderColor: '#fbbf24',
            backgroundColor: gradient,
            borderWidth: 2,
            tension: 0.25,
            fill: true,
            pointBackgroundColor: '#fbbf24',
            pointRadius: 0,
            pointHitRadius: 15,
            pointHoverRadius: 6,
            pointHoverBorderColor: '#1f2937',
            pointHoverBorderWidth: 2,
            yAxisID: 'y'
        };
    } else {
        // Configuración para Gráfico de Velas Japonesas
        datasetPrincipal = {
            type: 'candlestick',
            label: 'Precios OHLC',
            data: datosARenderizar.map(dia => ({
                x: luxon.DateTime.fromISO(dia.fecha).valueOf(),
                o: dia.precio_apertura,
                h: dia.precio_maximo,
                l: dia.precio_minimo,
                c: dia.precio_cierre
            })),
            yAxisID: 'y',
            color: {
                up: '#10b981',
                down: '#ef4444',
                unchanged: '#94a3b8'
            }
        };
    }

    if (miGrafico) {
        miGrafico.destroy();
    }

    miGrafico = new Chart(ctx, {
        data: {
            labels: etiquetasFechas,
            datasets: [
                datasetPrincipal,
                {
                    type: 'bar',
                    label: 'Volumen Diario',
                    data: volumenes,
                    backgroundColor: 'rgba(156, 163, 175, 0.08)',
                    hoverBackgroundColor: 'rgba(156, 163, 175, 0.2)',
                    yAxisID: 'yVolumen',
                    barThickness: 'flex'
                },

                // DATASET DINAMICO DE LA SMA20.
                ...(mostrarSMA20 ? [{
                    label: 'SMA (20)',
                    data: datosSMA20,
                    type: 'line',
                    borderColor: '#a855f7', // Violeta tecnológico
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.2,
                    yAxisID: 'y'
                }] : []), 

                // DATASET DINAMICO DE LA EMA20.
                ...(mostrarEMA20 ? [{
                    label: 'EMA (20)',
                    data: datosEMA20,
                    type: 'line',
                    borderColor: '#22d3ee', // Cyan/Celeste dinamico.
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.2,
                    yAxisID: 'y'
                }] : [])
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onHover: (event) => {
                const canvas = event.chart.canvas;
                if (typeof herramientaActiva !== 'undefined' && herramientaActiva === 'lupa') {
                    canvas.style.cursor = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='6'></circle><line x1='16' y1='16' x2='22' y2='22'></line></svg>\") 8 8, auto";
                } else {
                    canvas.style.cursor = 'crosshair';
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const index = context.dataIndex;
                            // Validamos que el dataset al que se le pasa el mouse sea el principal (0)
                            if (context.datasetIndex === 0) {
                                return [
                                    `🟢 Apertura: $${preciosApertura[index].toFixed(2)}`,
                                    `🔵 Cierre: $${preciosCierre[index].toFixed(2)}`,
                                    `🔺 Máximo: $${preciosMaximos[index].toFixed(2)}`,
                                    `🔻 Mínimo: $${preciosMinimos[index].toFixed(2)}`
                                ];
                            }
                            // Si el mouse pasa arriba de la línea SMA (dataset 2), mostramos su valor promediado
                            if (context.dataset && context.dataset.label === 'SMA (20)') {
                                const puntoActual = context.dataset.data[context.dataIndex];
                                if (puntoActual !== null && puntoActual !== undefined) {
                                    // Si es un objeto (vista velas), extraemos .y. Si es un número plano (vista Linea), lo usamos directo.
                                    const valorLimpio = (typeof puntoActual === 'object') ? puntoActual.y : puntoActual;
                                    return `SMA (20): $${valorLimpio.toFixed(2)}`;
                                }

                                return null;
                            }

                            // Soporte Tooltip para la EMA20.
                            if (context.dataset && context.dataset.label === 'EMA (20)') {
                                const puntoActual = context.dataset.data[context.dataIndex];
                                if(puntoActual !== null && puntoActual !== undefined) {
                                    const valorLimpio = (typeof puntoActual === 'object') ? puntoActual.y : puntoActual;
                                    return `EMA (20): $${valorLimpio.toFixed(2)}`;
                                }

                                return null;
                            }
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
                },
                zoom: {
                    zoom: {
                        drag: {
                            enabled: true,
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            borderColor: 'rgba(59, 130, 246, 0.6)',
                            borderWidth: 1
                        },
                        wheel: { enabled: true, speed: 0.1 },
                        mode: 'x',
                        scales: ['x'],
                        onZoomStart: function () {
                            return (typeof herramientaActiva !== 'undefined' && herramientaActiva === 'lupa');
                        }
                    }
                }
            },
            scales: {
                x: {
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
                        callback: function (value) { return '$' + value.toFixed(2); }
                    },
                    min: Number((minimoAbsoluto * 0.98).toFixed(2)),
                    max: Number((maximoAbsoluto * 1.02).toFixed(2))
                },
                yVolumen: {
                    type: 'linear',
                    display: false,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    min: 0,
                    max: Math.max(...volumenes) * 4
                }
            }
        }
    });
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
        fetchAutenticado(`${API_URL}/db/refrescar`, { method: "POST" })
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

                // Toast de éxito, al refrescar la DB.
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true,
                    background: '#1f2937',
                    color: '#ffffff'
                });
                Toast.fire({
                    icon: 'success',
                    title: 'Base de datos actualizada con éxito'
                });
            })
            .catch(error => {
                console.error("Error al refrescar:", error);

                // Alerta con SweetAlert2
                Swal.fire({
                    title: 'Error de Actualización',
                    text: 'No se pudieron sincronizar los datos globales. Por favor, verificá que el servidor esté online e intentá nuevamente.',
                    icon: 'error',
                    background: '#1f2937',
                    color: '#ffffff',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'Entendido',
                    customClass: {
                        popup: 'rounded-2xl border border-gray-700'
                    }
                });

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
        fetchAutenticado(`${API_URL}/db/indicadores/${ticker}`, { method: "DELETE" })
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
    if (miGrafico) {
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
        tipoVistaActual = 'linea';
    } else {
        // Velas Activo (Azul con texto blanco)
        btnVelas.className = "bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors";
        // Línea Inactivo (Fondo oscuro, texto gris)
        btnLinea.className = "text-slate-400 hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-transparent";
        tipoVistaActual = 'velas';
    }

    renderizarRangoActual();
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
    contenedor.innerHTML = `
        <div class="text-xs text-center py-12 text-slate-500">
            <span class="inline-block animate-spin mr-1">⏳</span> Buscando primicias del mercado...
        </div>
    `;

    try {
        // Le pegamos a nuestro endpoint del backend.
        const respuesta = await fetchAutenticado(`http://127.0.0.1:8000/api/noticias/${ticker}`);

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
    } catch (error) {
        console.log("Error al cargar las noticias: ", error);
        contenedor.innerHTML = `
            <div class="text-xs text-center py-12 text-red-400">
                ⚠️ Error al conectar con el servidor de noticias.
            </div>
        `;
    }
}

// ==========================================================================
//          INTEGRACIÓN CON EL REPORTE ESTRUCTURAL DE IA (GEMINI 2.5)
// ==========================================================================

// Función auxiliar para renderizar Markdown basico que devuelve la IA.
function mapearMarkdownAHTML(textoMarkdown) {
    let html = textoMarkdown
        // Convertir títulos ### Ejemplo a <h3>
        .replace(/^### (.*$)/gim, '<h4 class="text-md font-bold text-indigo-400 mt-4 mb-2 tracking-wide border-b border-slate-800/50 pb-1">$1</h4>')
        // Convertir negritas **texto** a <strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100 font-semibold">$1</strong>')
        // Convertir viñetas de guiones o asteriscos a elementos de lista con estilo Tailwind
        .replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="list-none pl-4 relative before:content-[\'•\'] before:text-indigo-500 before:absolute before:left-0">$1</li>');

    return html;
}


// Event Listener para el boton de generar informe.
document.getElementById('btn-generar-ia').addEventListener('click', async () => {
    // Capturo los elementos del DOM. (significa Document Object Model, o Modelo de Objetos del Documento).
    const btnGenerar = document.getElementById('btn-generar-ia');
    const estadoInicial = document.getElementById('ia-estado-inicial');
    const estadoCarga = document.getElementById('ia-estado-carga');
    const textoReporte = document.getElementById('ia-texto-reporte');

    // Obtengo el ticker Activo.
    const ticker = tickerGLobal;

    // Transicion de estados visuales: Muestro el spinner de carga.
    estadoInicial.classList.add('hidden');
    textoReporte.classList.add('hidden');
    estadoCarga.classList.remove('hidden');

    // deshabilito el boton temporalmente para evitar que el usuario no haga spam de clicks.
    btnGenerar.disabled = true;
    btnGenerar.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        // Peticion fetch al Backend de FastAPI.
        const url = `http://127.0.0.1:8000/api/analisis/${ticker}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Error en el servidor: ${response.statusText}');
        }

        const data = await response.json();

        // Renderizo el Markdown que nos mandó la IA a HTML limpio.
        const reporteHtmlHTML = mapearMarkdownAHTML(data.reporte);

        // Inyecto el resultado y muestro el contenedor de éxito.
        textoReporte.innerHTML = reporteHtmlHTML;

        estadoCarga.classList.add('hidden');
        textoReporte.classList.remove('hidden');


    }
    catch (error) {
        console.error("❌ Error al procesar el reporte de IA:", error);

        // Estado de error en la Interfaz.
        textoReporte.innerHTML = `
            <div class="text-red-400 text-xs p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-center">
                Hubo un inconveniente al generar el reporte estructural. Por favor, verificá la conexión con el servidor o reintentá en unos minutos.
            </div>
        `;
        estadoCarga.classList.add('hidden');
        textoReporte.classList.remove('hidden');
    }
    finally {
        // Rehabilito el boton al terminar (sea Exito o Error). 
        btnGenerar.disabled = false;
        btnGenerar.classList.remove('opacity-50', 'cursor-not-allowed');
    }
})


// ==========================================================================
//          FUNCIONES PARA LA SECCION DE LOGIN DE LA PAGINA.
// ==========================================================================

// Funcion global para mostrar el login y configurar su enlace de "Registrate acá".
function irAPantallaLogin() {
    const authContainer = document.getElementById('auth-container');

    if (!authContainer) {
        console.error("❌ ERROR: No se encontró 'auth-container' en el DOM");
        return;
    }

    // Le paso al login: el contenedor, la funcion de exito, y la accion si clickea "Registrate acá".
    mostrarLogin(authContainer, loginExitoso, irAPantallaRegistro);
}

//Función global para mostrar el registro y configurar su enlace de "Inicia Sesion acá".
function irAPantallaRegistro() {
    const authContainer = document.getElementById('auth-container');

    if (!authContainer) {
        console.error("❌ ERROR: No se encontró 'auth-container' en el DOM");
        return;
    }

    mostrarRegistro(authContainer, irAPantallaLogin, irAPantallaLogin);
}

// FUNCION QUE SE EJECUTA SOLO SI EL LOGIN FUE EXITOSO.
function loginExitoso() {
    // Obtengo el nombre de usuario, guardado en el local Storage.
    const usuario = localStorage.getItem('username') || 'Usuario';

    // Cambio el boton del navbar para reflejar que ya esta Logueado.
    UI_actualizarBotonUsuario(usuario);

    // Vuelvo a ocultar el contenedor flotante del login.
    const authContainer = document.getElementById('auth-container');
    if (authContainer) authContainer.classList.add('hidden');

    // 3. Mostramos la alerta de bienvenida y ESPERAMOS a que termine
    Swal.fire({
        title: `¡Bienvenido, ${usuario}!`,
        text: "Ingresaste correctamente a MarketLens. Ya podés gestionar tus activos.",
        icon: 'success',
        background: '#1f2937',
        color: '#ffffff',
        confirmButtonColor: '#2563eb',
        timer: 3000,                  // ⏱️ La dejamos 3 segundos clavados para que se lea perfecto
        timerProgressBar: true,
        customClass: {
            popup: 'rounded-2xl border border-gray-700 shadow-2xl'
        }
    }).then(() => {
        // ESTO SE EJECUTA SOLO CUANDO LA ALERTA DESAPARECE
        console.log("La alerta terminó, recargando la página...");
        location.reload();
    });
}

// =========================================================================
//                          FUNCIONES PARA LA WATCHLIST
// =========================================================================

/**
 * Obtiene los tickers favoritos del usuario desde el backend y manda a renderizar la watchlist.
 */
function cargarWatchlist() {
    // Recuperamos el token de seguridad que guardaste al iniciar sesión.
    const token = localStorage.getItem("token");

    console.log("Token recuperado de localStorage:", token);

    if (!token) {
        console.warn("Watchlist: No hay un usuario autenticado o token disponible.");
        return;
    }

    // Le pegamos al endpoint real de favoritos.
    fetchAutenticado(`${API_URL}/favorites`, { method: "GET" })
        .then(response => {
            if (!response.ok) {
                throw new Error("No se pudieron recuperar los favoritos del servidor.");
            }
            return response.json(); // El backend devuelve un array de string.
        })
        .then(listaTickers => {
            console.log("Watchlist cargada desde Postgres:", listaTickers);

            // Guardamos los tickers en la variable global.
            misfavoritosGlobal = listaTickers;

            // Le paso los datos reales a la función que renderiza las tarjetas de los tickers.
            UI_renderizarWatchlist(listaTickers);

            // Espero 50ms a que el DOM de cargarIndicadores esté listo.
            setTimeout(() => {
                UI_sincronizarEstrellasTabla(listaTickers);
            }, 50);
        })
        .catch(error => {
            console.error("Error al cargar la Watchlist:", error);
        });
}


// FUNCION PARA ALTERNAR LOS FAVORITOS.
/**
 * Agrega o elimina un activo de los favoritos del usuario interactuando con la API
 * @param {string} ticker - El símbolo del activo (ej: 'AAPL')
 * @param {boolean} esFavorito - Estado actual del activo en la tabla
 */
function alternarFavorito(ticker, esFavorito) {
    const token = localStorage.getItem("token");

    if (!token) {
        // Si no está logueado, tiramos un alerta con SweetAlert2.
        Swal.fire({
            title: '¡Atención!',
            text: 'Debes iniciar sesión para administrar tus activos favoritos.',
            icon: 'warning',
            confirmButtonColor: '#3085d6', // Ajustá este color al de tu diseño (ej: el azul de Tailwind)
            confirmButtonText: 'Entendido',
            background: '#1e293b', // Si usás modo oscuro (slate-800), si no, sacá esta línea
            color: '#fff'          // Texto blanco para modo oscuro, si no, sacá esta línea
        });
        return;
    }

    const metodo = esFavorito ? "DELETE" : "POST";
    const accion = esFavorito ? "remove" : "add";

    // URL CORRECTA (Validada por Swagger): El ticker viaja en la URL
    const url = `${API_URL}/favorites/${accion}?ticker=${ticker}`;

    console.log(`Enviando petición oficial: ${metodo} -> ${url}`);

    // Ejecutamos el Fetch limpio (Sin body, igual que en el GET)
    fetchAutenticado(url, { method: metodo, })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error en el servidor: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("¡ÉXITO! Backend respondió:", data);

            // Disparo las alertas visuales (toast) segun la acción.
            if (metodo === "POST") {
                mostrarToast(`¡${ticker} agregado a tus favoritos!`, 'success');
            } else {
                mostrarToast(`¡${ticker} eliminado de tus favoritos!`, 'info');
            }

            // Actualizamos la interfaz en tiempo real
            cargarWatchlist();   // Recarga la barra lateral con el nuevo favorito.
        })
        .catch(error => {
            console.error("Error en alternarFavorito:", error);
            mostrarToast("Hubo un problema al actualizar los favoritos.", "error");
        });
}

// FUNCION REUTILIZABLE QUE FABRICA LOS CARTELITOS (TOAST) DINAMICOS USANDO TAILWIND CSS.
/**
 * Muestra una notificación flotante estilo Toast que se auto-destruye.
 * @param {string} mensaje - Texto a mostrar.
 * @param {'success' | 'info' | 'error'} tipo - Tipo de alerta para el color.
 */
function mostrarToast(mensaje, tipo = 'success') {
    const contenedor = document.getElementById("contenedor-notificaciones");
    if (!contenedor) return;

    const toast = document.createElement("div");

    // Configuración de colores con Tailwind
    let clasesColor = "bg-emerald-600 text-white"; // Exito (Verde).
    if (tipo === 'info') clasesColor = "bg-blue-600 text-white"; // Info/eliminado Azul.
    if (tipo === 'error') clasesColor = "bg-rose-600 text-white"; // Error rojo.

    // Estilo de la tarjeta flotante con animaciones sutiles.
    toast.className = `${clasesColor} px-4 py-3 rounded-xl shadow-2xl font-medium text-sm flex items-center gap-3 transition-all duration-300 transform translate-y-2 opacity-0`;

    // Iconos segun la acción.
    const icono = tipo === 'success' ? '⭐' : tipo === 'info' ? '🗑️' : '❌';
    toast.innerHTML = `<span>${icono}</span><span>${mensaje}</span>`;

    // Agregamos el toast al contenedor principal.
    contenedor.appendChild(toast);

    // Truco para la animacion de entrada (faide-in + slide-up) se note suave.
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 50);

    // Auto-destrucción a los 3 segundos.
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-2'); // Animación de salida hacia arriba
        setTimeout(() => toast.remove(), 300); // Lo borro fisicamente del DOM. 
    }, 3000);
}

/**
 * Realiza peticiones HTTP incluyendo el token de seguridad y manejando de forma
 * centralizada los errores de autenticación (401 Expirado/Inválido o 400 Problemas de Token).
 * @param {string} url - Direccion del endpoint.
 * @param {Object} opciones - Configuracion nativa del fetch (method, body, etc). 
 * @returns {Promise<Response>} - La respuesta del servidor si es valida.
 */
function fetchAutenticado(url, opciones = {}) {
    const token = localStorage.getItem("token");

    // Aseguramos los headers base de tipo JSON combinando los existentes.
    opciones.headers = {
        "Content-Type": "application/json",
        ...opciones.headers
    };

    // Si hay token, lo inyecto de forma limpia
    if (token) {
        opciones.headers["Authorization"] = `Bearer ${token}`;
    }

    return fetch(url, opciones)
        .then(response => {
            // 🚨 DETECCIÓN DE SESIÓN EXPIRADA O CORRUPTA (Atajamos 401 y 400 por si las moscas)
            if (response.status === 401 || response.status === 400) {
                console.error(`Problema de autenticación (${response.status}). Abriendo Login dinámico...`);

                // Limpio de inmediato el token caducado y los datos del usuario viejo
                localStorage.removeItem("token");
                localStorage.removeItem("username");
                localStorage.removeItem("foto_perfil");

                // Sistema de Alerta Profesional (Plan A)
                if (typeof Swal !== "undefined") {
                    Swal.fire({
                        title: '¡Sesión Expirada!',
                        text: 'Por razones de seguridad, tu sesión ha terminado. Por favor, iniciá sesión nuevamente.',
                        icon: 'warning',
                        confirmButtonText: 'Iniciar Sesión',
                        confirmButtonColor: '#fbbf24', // Color oro/amber de tu app
                        timer: 5000,
                        timerProgressBar: true,
                        allowOutsideClick: false,
                        background: '#1f2937',
                        color: '#ffffff',
                        customClass: { popup: 'rounded-2xl border border-gray-700' }
                    }).then(() => {
                        // Capturo el contenedor flotante del login.
                        const authContainer = document.getElementById('auth-container');

                        if (authContainer) {
                            // Le sacamos laclase hidden.
                            authContainer.classList.remove('hidden');

                            if (typeof mostrarLogin === "function") {
                                mostrarLogin(authContainer, loginExitoso, irAPantallaRegistro);
                            } else {
                                // Plan de respaldo por si 'mmostraLogin' requiere el puente global.
                                irAPantallaLogin();
                            };
                        } else {
                            console.error("❌ No se encontró 'auth-container' al intentar forzar el login.");
                        };
                    });
                } else {
                    // Respaldo de emergencia nativo
                    alert("Tu sesión ha expirado por seguridad. Por favor, iniciá sesión nuevamente.");
                    irAPantallaLogin();
                }

                // Corto el flujo tirando una excepción controlada para que no siga ejecutando los .then() de afuera
                throw new Error(`Sesión inválida (${response.status}).`);
            }

            // Si todo está bien (200, 201, etc.), pasamos la respuesta limpia.
            return response;
        });
}


// ============================================================================
//      FUNCIONES PARA LA SECCIÓN DE LA TOOLBOX (Caja de Herramientas).
// ============================================================================

/**
 * Alterna el tipo de herramienta sellecionada por el usuario.
 * @param {string} herramienta - Toma el valor de 'lupa' o 'cruz'. 
 */
function alternarHerramienta(herramienta) {
    const btnLupa = document.getElementById('btn-herramienta-lupa');
    const iconoLupa = document.getElementById('icon-lupa');

    // Si ya estaba activa la lupa y se vuelve a tocar, se desactiva (vuelve a la cruz).
    if (herramientaActiva === 'lupa' && herramienta === 'lupa') {
        herramientaActiva = 'cruz';

        // Estilos de boton INACTIVO / DESACTIVADO.
        if (btnLupa) {
            btnLupa.className = "text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all bg-transparent flex items-center gap-2 hover:bg-slate-700/40";

            // Al apagarse la funcion, invita a volver a activarla.
            btnLupa.title = "Activar Lupa (Zoom)";
        }
        if (iconoLupa) {
            iconoLupa.className = "w-4 h-4 text-slate-400 pointer-events-none transition-colors duration-200";
        }

        // Si tenia zoom metido, al llamar a está funcion limpia el lienzo.
        // y vuelve a dibujar los dias exactos que corresponden al slider activo.
        renderizarRangoActual();
    } else {
        // Activamos la herramienta lupa
        herramientaActiva = herramienta;

        // Estilos de boton ACTIVO (Estilo Oro Premium).
        if (btnLupa) {
            btnLupa.className = "bg-amber-500/10 text-amber-400 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 border border-amber-500/30 shadow-sm shadow-amber-500/5";

            // Al Encenderse, te avisa que si haces click se desactiva.
            btnLupa.title = "Desactivar Lupa (Reset Zoom)";
        }
        if (iconoLupa) {
            iconoLupa.className = "w-4 h-4 text-amber-400 pointer-events-none transition-colors duration-200";
        }
    }

    // Sincronizacion inmediata del cursor sobre el canvas.
    if (miGrafico && miGrafico.canvas) {
        if (herramientaActiva === 'lupa') {
            miGrafico.canvas.style.cursor = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23d97706' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='6'></circle><line x1='16' y1='16' x2='22' y2='22'></line></svg>\") 8 8, auto";
        } else {
            miGrafico.canvas.style.cursor = 'crosshair';
        }
    }
}


/**
 * Controla el desplegable con la lista de herramaientas.
 */
function toggleDropdownIndicadores() {
    const dropdown = document.getElementById('dropdown-indicadores');
    if (dropdown) dropdown.classList.toggle('hidden');
}

// Evento Escuchador: Cerrar dropdown si hacen click fuera del menú.
window.addEventListener('click', function(e) {
    const dropdown = this.document.getElementById('dropdown-indicadores');
    const contenedor = this.document.getElementById('contenedor-dropdown-indicadores');

    if (dropdown && contenedor && !contenedor.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
})


/**
 * Calcula la Media Móvil Simple (SMA) de un array de datos.
 * @param {Array} datosCompletos - Array con los precios de cierre.
 * @param {Number} periodo - Cantidad de días para el promedio (ej.20).
 * @param {String} fechasVisibles - Fechas de los dias en que hubo operaciones.
 * @param {String} vistaActual - Tipo de vista del Gráfico (ej. 'velas', 'linea').
 * @returns {Array} Array del mismo largo que 'datosCompletos', con valores de la SMA o null.
 */
// FUNCIÓN CALCULAR SMA PROFESIONAL (Filtrado estricto anti-renderizado roto)
function calcularSMA(datosCompletos, periodo, fechasVisibles, vistaActual) {
    if (!datosCompletos || datosCompletos.length === 0) return [];

    // 1. Calculamos la SMA para todo el historial (solo guardamos si el valor es numérico y válido)
    let smaMap = {};
    for (let i = 0; i < datosCompletos.length; i++) {
        if (i >= periodo - 1) {
            let suma = 0;
            for (let j = 0; j < periodo; j++) {
                suma += datosCompletos[i - j].precio_cierre;
            }
            smaMap[datosCompletos[i].fecha] = Number((suma / periodo).toFixed(2));
        }
    }

    // 2. Construimos el array para Chart.js
    let resultadoFinal = [];

    fechasVisibles.forEach(fecha => {
        const valorSMA = smaMap[fecha];
        
        // Si es nulo o no existe, lo salteamos completamente. 
        // No le mandamos basura ni 'nulls' al motor de Chart.js.
        if (valorSMA !== undefined && valorSMA !== null) {
            if (vistaActual === 'velas') {
                resultadoFinal.push({
                    x: new Date(fecha).getTime(), // Timestamp numérico puro y limpio
                    y: valorSMA
                });
            } else {
                resultadoFinal.push(valorSMA);
            }
        } else {
            // Para la vista de líneas tradicional, si faltan los primeros días, 
            // sí empujamos 'null' para no desalinear los índices del eje 'category'.
            if (vistaActual !== 'velas') {
                resultadoFinal.push(null);
            }
        }
    });

    return resultadoFinal;
}


/**
 * TOGGLE SMA 20.
 */
function toggleSMA20() {
    // 1. Invertimos el estado booleano global
    mostrarSMA20 = !mostrarSMA20;

    // 2. Buscamos y alteramos de forma segura las visibilidades en la interfaz
    const checkSMA = document.getElementById('check-sma');
    const testigoSMA = document.getElementById('testigo-sma');

    if (checkSMA) checkSMA.classList.toggle('hidden', !mostrarSMA20);
    if (testigoSMA) testigoSMA.classList.toggle('hidden', !mostrarSMA20);

    // 3. Forzamos el redibujado sincronizado con el rango del slider actual
    if (typeof renderizarRangoActual === 'function') {
        renderizarRangoActual();
    }
}

/**
 * TOGGLE EMA 20.
 */
function toggleEMA20() {
    // 1. Invertimos el estado booleano global
    mostrarEMA20 = !mostrarEMA20;

    // 2. Buscamos y alteramos de forma segura las visibilidades en la interfaz
    const checkEMA = document.getElementById('check-ema');
    const testigoEMA = document.getElementById('testigo-ema');

    if (checkEMA) checkEMA.classList.toggle('hidden', !mostrarEMA20);
    if (testigoEMA) testigoEMA.classList.toggle('hidden', !mostrarEMA20);

    // 3. Forzamos el redibujado sincronizado con el rango del slider actual
    if (typeof renderizarRangoActual === 'function') {
        renderizarRangoActual();
    }
}

/**
 * Calcula el valor del EMA.
 */
// FUNCION CALCULAR EMA PROFESIONAL (Adaptable a Lineas y Velas).
function calcularEMA (datosCompletos, periodo, fechasVisibles, vistaActual) {
    if (!datosCompletos || datosCompletos.length === 0) return [];

    let emaMap = {};

    // Calculo el multiplicador Exponencial (Factor K).
    const multiplicador = 2 / (periodo + 1);

    // Necesito un punto de partida (una SMA Simple) para los primeros 'periodo' días.
    let sumaInicial = 0;
    for (let i=0; i < periodo; i++) {
        sumaInicial += datosCompletos[i].precio_cierre
    }
    let emaAnterior = sumaInicial / periodo;

    // Guardo esa primera SMA en nuestro mapa.
    emaMap[datosCompletos[periodo - 1].fecha] = Number(emaAnterior.toFixed(2));

    // Corremos el calculo exponencial para el resto del historial.
    for (let i = periodo; i < datosCompletos.length; i++) {
        const precioActual = datosCompletos[i].precio_cierre;

        // FORMULA EMA.
        const emaActual = (precioActual - emaAnterior) * multiplicador + emaAnterior;

        emaMap[datosCompletos[i].fecha] = Number(emaActual.toFixed(2));
        emaAnterior = emaActual; // Actualizo el valor del EMA, el de hoy pasa a ser el de "ayer" en la proxima vuelta.
    }

    // Mapeamos y recortamos segun las fechas que estan en pantalla.
    let resultadoFinal = [];
    
    fechasVisibles.forEach(fecha => {
        const valorEMA = emaMap[fecha];

        if (valorEMA !== undefined && valorEMA !== null) {
            if (vistaActual === 'velas') {
                resultadoFinal.push({
                    x: new Date(fecha).getTime(),
                    y: valorEMA
                });
            } else {
                resultadoFinal.push(valorEMA);
            }
        } else {
            if (vistaActual !== 'velas') {
                resultadoFinal.push(null);
            }
        }
    });

    return resultadoFinal;
} 