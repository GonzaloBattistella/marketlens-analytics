// --- VISTA Y LOGICA DEL REGISTRO (ACCESIBLE GLOBALMENTE) ---
function mostrarRegistro(contenedor, onRegistroSuccess, onIrALogin) {
    contenedor.innerHTML = `
        <div class="relative max-w-md w-full bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl space-y-6">
            
            <button id="btn-cerrar-auth" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl p-1 rounded-lg hover:bg-gray-700 transition">
                ✕
            </button>
            
            <div class="text-center">
                <h2 class="text-3xl font-black text-white tracking-tight">
                    Crear <span class="text-blue-400">Cuenta</span>
                </h2>
                <p class="mt-2 text-sm text-gray-400">Registrate para empezar a trackear tus activos</p>
            </div>

            <div id="registro-error-alert" class="hidden bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center"></div>

            <form id="registro-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Nombre de Usuario</label>
                    <input type="text" id="registro-username" required 
                        class="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="Tu nombre o alias">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Correo Electrónico</label>
                    <input type="email" id="registro-email" required 
                        class="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="ejemplo@correo.com">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
                    <input type="password" id="registro-password" required 
                        class="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="Escribí una contraseña segura">
                </div>

                <button type="submit" id="registro-btn"
                    class="w-full py-3 px-4 mt-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50">
                    Registrarse
                </button>
            </form>

            <p class="text-center text-sm text-gray-400">
                ¿Ya tenés una cuenta? 
                <a href="#" id="link-ir-login" class="font-medium text-blue-400 hover:text-blue-300 transition-colors">Iniciá sesión acá</a>
            </p>
        </div>
    `;

    // LOGICA FORMULARIO DE REGISTRO.
    const form = document.getElementById('registro-form');
    const linkIrLogin = document.getElementById('link-ir-login');
    const btnCierre = document.getElementById('btn-cerrar-auth');

    //Evento para volver al login, si el usuario se equivoco de pantalla.
    if (linkIrLogin) {
        linkIrLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            onIrALogin(); // ejecuta la accion de volver.
        });
    }

    // Evento que escucha, si se hace click en la cruz de cierre del formulario.
    if(btnCierre) {
        btnCierre.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("Cerrando formulario de Registro.");
            contenedor.classList.add('hidden'); // Ocultamos todo el panel flotante.
        });
    }



    form.addEventListener('submit', async (e) => {
        // Evito que se recargue automaticamente la pagina.
        e.preventDefault();

        const username = document.getElementById('registro-username').value;
        const email = document.getElementById('registro-email').value;
        const password = document.getElementById('registro-password').value;

        const errorAlert = document.getElementById('registro-error-alert');
        const registroBtn = document.getElementById('registro-btn');

        errorAlert.classList.add('hidden');
        registroBtn.disabled = true;
        registroBtn.innerText = 'Creando cuenta...';

        try {
            // Mando los datos del nuevo usuario en JSON porque los endpoints de creacion en FastAPI,
            // reciben un esquema Pydantic (JSON).
            const objetoUsuario = {
                username: username,
                email: email,
                password: password
            };

            const response = await fetch('http://127.0.0.1:8000/auth/register', {
                method: 'POST',
                headers: {'Content-type': 'application/json'},
                body: JSON.stringify(objetoUsuario)
            });

            const data = response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Error al registrar el usuario');
            }

            // Si salio bien, ejecutamos la funcion de exito pasandole los datos.
            UI_mostrarAlerta("¡Registro Exitoso!", "Tu cuenta se ha creado correctamente. Ya podés iniciar sesión.", "success");
            onRegistroSuccess();
        }
        catch (err) {
            errorAlert.innerText = err.message;
            errorAlert.classList.remove('hidden');
        }
        finally {
            registroBtn.disabled = false;
            registroBtn.innerText = 'Registrarse';
        }
    });
}