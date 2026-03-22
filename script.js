const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();
app.use(express.json()); // <--- ¡SIN ESTA LÍNEA LOS DATOS LLEGAN VACÍOS!
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Para poder leer datos JSON enviados desde el formulario
app.use(express.static(path.join(__dirname, '/')));


// En tu script.js
const mysql = require('mysql2');

// Crear el pool de conexión usando la URL pública de la variable de entorno
const db = mysql.createPool(process.env.DATABASE_URL);

// Prueba la conexión inmediatamente para ver si hay errores en el log
db.getConnection((err, connection) => {
    if (err) {
        console.error("Fallo total de conexión a Railway:", err.message);
    } else {
        console.log("¡Conectado exitosamente a Railway vía URL Pública!");
        connection.release();
    }
});
// RUTA PARA REGISTRAR USUARIOS
// Ruta de registro en script.js
app.post('/register', (req, res) => {
    const { nombre, correo, password } = req.body;
    
    // Definimos el rol como 'usuario' por defecto en el código
    const rolPorDefecto = 'usuario';

    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [nombre, correo, password, rolPorDefecto], (err, result) => {
        if (err) {
            console.error("Error en MySQL:", err);
            return res.status(500).json({ error: "Error al registrar. ¿El correo ya existe?" });
        }
        res.json({ message: "¡Usuario registrado con éxito como 'usuario'!" });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

