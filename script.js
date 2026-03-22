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
app.post('/register', (req, res) => {
    const { nombre, correo, password } = req.body;
    const rolPorDefecto = 'usuario';

    // Usamos USUARIOS en mayúsculas tal cual confirmaste
    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [nombre, correo, password, rolPorDefecto], (err, result) => {
        if (err) {
            // Imprime el error técnico en la consola de Render
            console.error("DETALLE DE MYSQL:", err.message);
            
            // Enviamos el mensaje de error real al frontend para diagnóstico
            return res.status(500).json({ 
                error: "Error de base de datos: " + err.sqlMessage 
            });
        }
        
        console.log("✅ Registro exitoso en tabla USUARIOS");
        res.json({ message: "¡Usuario registrado con éxito!" });
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