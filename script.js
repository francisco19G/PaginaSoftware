const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();

app.use(express.json()); // Para poder leer datos JSON enviados desde el formulario
app.use(express.static(path.join(__dirname, '/')));

// Configuración de la conexión a Railway (usa tu Variable de Entorno)
const db = mysql.createConnection(process.env.DATABASE_URL || 'tu_url_local_aqui');

// RUTA PARA REGISTRAR USUARIOS
app.post('/register', (req, res) => {
    const { NOMBRE, CORREO, CONTRASEÑA } = req.body;
    const query = 'INSERT INTO USUARIOS (NOMBRE, CORREO, CONTRASEÑA) VALUES (?, ?, ?)';
    
    db.query(query, [NOMBRE, CORREO, CONTRASEÑA], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al registrar usuario' });
        }
        res.json({ message: 'Usuario registrado con éxito' });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));

