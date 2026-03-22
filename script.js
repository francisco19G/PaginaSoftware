const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();
app.use(express.json()); // <--- ¡SIN ESTA LÍNEA LOS DATOS LLEGAN VACÍOS!
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Para poder leer datos JSON enviados desde el formulario
app.use(express.static(path.join(__dirname, '/')));

// Configuración de la conexión a Railway (usa tu Variable de Entorno)
const db = mysql.createConnection(process.env.DATABASE_URL || 'tu_url_local_aqui');

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

