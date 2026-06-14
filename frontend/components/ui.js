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