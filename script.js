const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();

// --- CONFIGURACIÓN DE MIDDLEWARE ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/')));

// --- CONFIGURACIÓN DE BASE DE DATOS (POOL) ---
// El Pool gestiona múltiples conexiones automáticamente, ideal para Render/Railway
const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificar conexión al iniciar el servidor
db.getConnection((err, conn) => {
    if (err) {
        console.error("❌ Error de conexión a Railway:", err.message);
    } else {
        console.log("✅ ¡Conectado exitosamente a Railway!");
        conn.release(); // Liberar la conexión de prueba
    }
});

// --- RUTA PARA REGISTRAR USUARIOS ---
app.post('/register', (req, res) => {
    // Extraemos los datos del cuerpo de la petición
    const { nombre, correo, password } = req.body;
    
    // Rol asignado automáticamente
    const rolPorDefecto = 'usuario';

    // SQL usando los nombres exactos de tus columnas
    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [nombre, correo, password, rolPorDefecto], (err, result) => {
        if (err) {
            // Imprimimos el error real en la consola de Render para diagnóstico
            console.error("❌ Error en MySQL:", err.code, "-", err.sqlMessage);
            
            // Si el error es por correo duplicado (Unique Key)
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: "Este correo ya está registrado." });
            }

            return res.status(500).json({ error: "Error interno al registrar el usuario." });
        }
        
        console.log("👤 Usuario registrado con éxito:", correo);
        res.json({ message: "¡Usuario registrado con éxito como 'usuario'!" });
    });
});

// --- RUTA PRINCIPAL ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});