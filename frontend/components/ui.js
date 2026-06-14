// --- COMPONENTE DE INTERFAZ DE USUARIO (UI) ---

/**
 * Modifica el botón de sesión en el Navbar para mostrar el usuario logueado.
 */
function UI_actualizarBotonUsuario(username) {
    const btnSesion = document.getElementById('btn-sesion');
    const btnRegistro = document.getElementById('btn-registro');

    if (btnSesion) {
        btnSesion.innerHTML = `
            <span class="flex items-center gap-1.5 w-full">
                <span class="text-purple-400 text-lg">👤</span>
                <span class="text-white font-medium truncate">${username}</span>
            </span>
        `;
        btnSesion.className = "flex items-center justify-start text-sm bg-gray-700 hover:bg-gray-650 px-3.5 py-1.5 rounded-lg border border-gray-600 transition min-w-[120px] cursor-default";
    }

    if (btnRegistro) {
        btnRegistro.classList.add('hidden');
    }
}

/**
 * Restaura el Navbar a su estado original (Login/Registro visibles).
 */
function UI_restaurarBotonesNavbar() {
    const btnSesion = document.getElementById('btn-sesion');
    const btnRegistro = document.getElementById('btn-registro');

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