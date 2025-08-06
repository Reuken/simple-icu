// server.js
const express = require('express');
const path = require('path'); // Importamos el módulo 'path' de Node
const app = express();
const port = 3000;

// Middleware para poder leer los datos del formulario
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- ¡LÍNEA CLAVE! ---
// Sirve los archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para el login
app.post('/login', (req, res) => {
    const { codigo, contrasena } = req.body;

    const CODIGO_VALIDO = 2140;
    const CONTRASENA_VALIDA = 1234;

    if (codigo === CODIGO_VALIDO && contrasena === CONTRASENA_VALIDA) {
        // En un futuro, aquí podrías redirigir a una página de perfil
        res.send('¡Login exitoso! Bienvenido.');
    } else {
        // Es mejor redirigir de vuelta al login con un mensaje de error
        res.status(401).send('Código o contraseña incorrectos. <a href="/login.html">Inténtalo de nuevo</a>');
    }
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});