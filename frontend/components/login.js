// VISTA Y LOGICA DEL LOGIN (ACCESIBLE GLOBALMENTE).
function mostrarLogin(contenedor, onLoginSuccess, onIrARegistro) {
    contenedor.innerHTML = `
        <div class="relative max-w-md w-full bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl space-y-6">
            
            <button id="btn-cerrar-auth" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl p-1 rounded-lg hover:bg-gray-700 transition">
                ✕
            </button>
            
            <div class="text-center">
                <h2 class="text-3xl font-black text-white tracking-tight">
                    MARKET<span class="text-blue-400">LENS</span>
                </h2>
                <p class="mt-2 text-sm text-gray-400">Ingresá para gestionar tus activos favoritos</p>
            </div>

            <div id="error-alert" class="hidden bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center"></div>

            <form id="login-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Correo Electrónico</label>
                    <input type="email" id="login-email" required 
                        class="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="ejemplo@correo.com">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
                    <input type="password" id="login-password" required 
                        class="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="Ingresá tu contraseña">
                </div>

                <button type="submit" id="login-btn"
                    class="w-full py-3 px-4 mt-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50">
                    Iniciar Sesión
                </button>
            </form>

            <p class="text-center text-sm text-gray-400">
                ¿No tenés una cuenta? 
                <a href="#" id="link-ir-registro" class="font-medium text-blue-400 hover:text-blue-300 transition-colors">Registrate acá</a>
            </p>
        </div>
    `;


    // LOGICA DEL FORMULARIO.
    const form = document.getElementById('login-form');

    // DELEGACIÓN DE EVENTOS: Escucho los clicks en todo el contenedor.
    contenedor.addEventListener('click', (e) => {
        // Si el elemento clickeado tiene el ID del link de registro.
        if (e.target && e.target.id === 'link-ir-registro') {
            e.preventDefault();
            console.log("¡Click detectado por delegación hacia Registro!");
            onIrARegistro(); // Pasamos a la pantalla de registro.
        }

        // Click en la "X" de cierre. 
        if(e.target && e.target.id === 'btn-cerrar-auth') {
            e.preventDefault(); // Evito que al clickear no se recargue la pagina.
            console.log("Cerrando formulario de Inicio de Sesion.");
            contenedor.classList.add('hidden'); // Ocultamos todo el panel flotante.
        }
    });
    

    form.addEventListener('submit', async (e) => {
        
        // Evitamos que la pagina se recargue.
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorAlert = document.getElementById('error-alert');
        const loginBtn = document.getElementById('login-btn');

        errorAlert.classList.add('hidden');
        loginBtn.disabled = true;
        loginBtn.innerText = 'Verificando...';

        try {
            // Fromato Form Data para OAuth2 de FastAPI.
            const params = new URLSearchParams();
            params.append('username', email);
            params.append('password', password);

            const response = await fetch('http://127.0.0.1:8000/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: params
            })

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Error al iniciar sesión');
            }

            // Guardamos el Token en el navegador.
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('username', data.username);
            localStorage.setItem('foto_perfil', data.foto_perfil || '');

            // Aviso que el login fue un éxito.
            onLoginSuccess();
        }
        catch (err) {
            // Si el error es de red (ej: el backend está caído, fetch tira error de TypeError)
            if (err.message.includes("Failed to fetch") || err.message.includes("fetch")) {
                UI_mostrarAlerta(
                    "Error de Conexión", 
                    "No se pudo establecer comunicación con el servidor. Por favor, intentá más tarde.", 
                    "error"
                );
            } else {
                // Si es un error común (contraseña incorrecta, usuario no existe), usamos el cartelito rojo
                errorAlert.innerText = err.message;
                errorAlert.classList.remove('hidden');

                // Vacío el campo de contraseña para que vuelva a intentar de cero.
                const inputPassword = document.getElementById('login-password');
                if(inputPassword) {
                    inputPassword.value = '';
                    inputPassword.focus(); // Dejo el cursor titilando dentro del campo de la contraseña.
                }
            }
        }
        finally {
            loginBtn.disabled = false;
            loginBtn.innerText = 'Iniciar Sesión';
        }
    });
}