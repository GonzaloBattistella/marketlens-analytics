// --- COMPONENTE DE INTERFAZ DE USUARIO (UI) ---

/**
 * Modifica el botón de sesión en el Navbar para mostrar el usuario logueado.
 */
function UI_actualizarBotonUsuario(username) {
    const btnSesion = document.getElementById('btn-sesion');
    const btnRegistro = document.getElementById('btn-registro');
    const contenedorUsuario = document.getElementById('contenedor-usuario');
    const navbarUsername = document.getElementById('navbar-username');
    const avatarUsuario = document.getElementById('avatar-usuario'); // Contenedor del circulo. 


    // Ocultamos los botones de Auth (Crear Cuenta, Iniciar Sesion).
    if(btnSesion) btnSesion.classList.add('hidden');
    if(btnRegistro) btnRegistro.classList.add('hidden');

    // Inyectamos el nombre en el nuevo bloque y lo mostramos.
    if(contenedorUsuario && navbarUsername) {
        navbarUsername.textContent = username;
        contenedorUsuario.classList.remove('hidden');
    }

    // Controlamos dinamicamente la foto de perfil o el avatar por defecto.
    if(avatarUsuario) {
        const fotoGuardada = localStorage.getItem('foto_perfil');

        // Si hay una URL válida guardada en el localStorage, agregamos una etiqueta img.
        if (fotoGuardada && fotoGuardada != 'null' && fotoGuardada.trim() != '') {
            avatarUsuario.innerHTML = `
                <img src="${fotoGuardada}" alt="${username}" 
                     class="w-full h-full rounded-full object-cover">
            `;
        }else {
            // Si es null o está vacia, dejamos el icono por defecto.
            avatarUsuario.innerHTML = `👤`;
        }
    }
}

/**
 * Restaura el Navbar a su estado original (Login/Registro visibles).
 */
function UI_restaurarBotonesNavbar() {
    const btnSesion = document.getElementById('btn-sesion');
    const btnRegistro = document.getElementById('btn-registro');
    const contenedorUsuario = document.getElementById('contenedor-usuario');

    // Ocultamos el bloque de perfil.
    if(contenedorUsuario) contenedorUsuario.classList.add('hidden');

    if(btnSesion) {
        btnSesion.innerHTML = `Iniciar Sesión`;
        btnSesion.className = "text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded-lg border border-blue-500 transition shadow-md shadow-blue-500/10";
    }

    if (btnRegistro) {
        btnRegistro.classList.remove('hidden');
    }
}

/**
 * Muestra una alerta estética flotante usando SweetAlert2 (diseño oscuro).
 * @param {string} titulo - El título principal de la alerta.
 * @param {string} mensaje - El texto detallado.
 * @param {string} icono - El tipo de icono: 'success', 'error', 'warning', 'info'.
 */
function UI_mostrarAlerta(titulo, mensaje, icono = 'success') {
    Swal.fire({
        title: titulo,
        text: mensaje,
        icon: icono,
        background: '#1f2937',    // bg-gray-800 de Tailwind
        color: '#ffffff',         // Texto blanco
        confirmButtonColor: '#2563eb', // bg-blue-600 de Tailwind
        timer: icono === 'success' ? 2500 : null, // Si es exito (bienvenida/registro), el alerta se 
        customClass: {
            popup: 'rounded-2xl border border-gray-700 shadow-2xl' // Le clavamos tus bordes redondeados
        }
    });
}

/**
 * Verifica el estado del servidor y actualiza el LED indicador en el Navbar.
 */
async function UI_verificarEstadoServidor() {
    const led = document.getElementById('led-estado');
    const contenedor = document.getElementById('contenedor-estado');
    const texto = document.getElementById('texto-estado');

    if(!led || !contenedor) return;

    try {
        const response = await fetch('http://127.0.0.1:8000/health');

        if (response.ok) {
            // Caso ONLINE: Verde esmeralda con pulso suave.
            led.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20";
            contenedor.setAttribute('title', 'Servidor Activo • PostgreSQL Conectado');
            if (texto) texto.className = "text-xs text-emerald-400 font-medium hidden sm:inline";
        }else {
            // Caso ERROR DEL SERVIDOR (Status 500)
            throw new Error("Server Error");
        }
    } catch (error) {
        // CASO DESCONECTADO (Backend caído por completo o fetch fallido)
        // Le sacamos el pulso animado para denotar que está "muerto"
        led.className = "w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-500/20";
        contenedor.setAttribute('title', 'Servidor Desconectado • Reintentando...');
        if (texto) texto.className = "text-xs text-red-400 font-medium hidden sm:inline";
    }
}

/**
 * Alterna la visibilidad de la barra lateral de la Watchlist (abrir/cerrar)
 * @param {boolean} abrir - True para mostrar la barra, false para ocultarla.
 */
function UI_toggleWatchlist(abrir) {
    const sidebar = document.getElementById('watchlist-sidebar');
    const overlay = document.getElementById('watchlist-overlay');

    if (!sidebar || !overlay) return;

    if (abrir) {
        // Abrimos: Quito el desplazamiento hacia la derecha.
        sidebar.classList.remove('translate-x-full');

        // Muestro el fondo oscuro con opacidad y le permito hacer click.
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100');
    }else {
        // Cerramos: Mandamos la barra de vuelta fuera de la pantalla.
        sidebar.classList.add('translate-x-full');

        // Ocultamos el fondo oscuro
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0', 'pointer-events-none');
    }
}

/**
 * Rendderiza lso activos favoritos del usuario dentro de la barra lateral.
 * @param {string[]} listaFavoritos - Array con los tickers favoritos (ej: ['AAPL', 'GGAL']).
 */
function UI_renderizarWatchlist(listaFavoritos) {
    const contenedor = document.getElementById('watchlist-contenido');
    const badge = document.getElementById('watchlist-badge');

    if (!contenedor) return;

    // Limpio el contenido viejo, para no duplicar tarjetas al actualizar.
    contenedor.innerHTML = '';

    // Controlamos el "Badge" (el puntito indicador en la estrella del Navbar).
    if (badge) {
        if (listaFavoritos.length > 0) {
            badge.classList.remove('hidden'); // Muestro el badge.
        }else {
            badge.classList.add('hidden'); // Oculto el badge.
        }
    }

    // CASO VACIO: Si el usuario no tiene favoritos todavia.
    if (listaFavoritos.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-12 text-gray-500 text-sm">
                <p class="font-medium">Tu watchlist está vacía</p>
                <p class="text-xs mt-1 text-gray-600">Tocá la estrella de cualquier activo en el tablero para seguirlo de cerca.</p>
            </div>
        `;
        return;
    }

    // CASO CON DATOS: Recorremos el array y creamos las tarjetas dinamicamente.
    listaFavoritos.forEach(ticker => {
        // Creamos el div contenedor para la tarjeta.
        const tarjeta = document.createElement('div');

        tarjeta.className = "bg-gray-850 p-3 rounded-xl border border-gray-800 flex justify-between items-center hover:border-amber-500/40 transition-all cursor-pointer group";

        // Seteamos un atributo de datos para identificar el ticker facilmente.
        tarjeta.setAttribute('data-ticker', ticker);

        // Estructura interna de la tarjeta (Ticker a la izq, tacho de la basura a la der).
        tarjeta.innerHTML = `
            <div class="flex flex-col">
                <span class="text-sm font-bold text-white tracking-wider group-hover:text-amber-400 transition-colors">${ticker}</span>
                <span class="text-xs text-gray-500">Activo en seguimiento</span>
            </div>
            
            <button onclick="alternarFavorito('${ticker}', true)" title="Quitar de Favoritos" class="btn-eliminar-favorito text-gray-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors" title="Eliminar de mi lista">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        `;

        // EVENTO CLICK EN LA TARJETA: Carga el historial en el gráfico central.
        tarjeta.addEventListener('click', (e) => {
            // Si el usuario clickeo el "tacho de basura", frenamos aca para que no abra el grafico.
            if (e.target.closest('.btn-eliminar-favorito')) return;

            // Reutilizo la funcion para dibujar el grafico del activo seleccionado.
            verHistorial(ticker);

            // Cerramos la barra automaticamente para que se vea el grafico comodo.
            UI_toggleWatchlist(false);
        });

        // Inyectamos la tarjeta armada en el contenedor principal.
        contenedor.appendChild(tarjeta);
    });
}