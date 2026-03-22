const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();

// --- CONFIGURACIÓN DE MIDDLEWARE ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/')));

// --- CONFIGURACIÓN DE BASE DE DATOS (POOL) ---
const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10
});

// Verificar conexión DB
db.getConnection((err, conn) => {
    if (err) console.error("❌ Error DB:", err.message);
    else {
        console.log("✅ Conectado a Railway");
        conn.release();
    }
});

// --- RUTA: REGISTRO DIRECTO ---
app.post('/register', (req, res) => {
    const { nombre, correo, password } = req.body;

    // Al registrar, ponemos 'verificado = 1' (true) de una vez para saltar el código
    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol, verificado) VALUES (?, ?, ?, 'usuario', 1)";
    
    db.query(sql, [nombre, correo, password], (err, result) => {
        if (err) {
            console.error("❌ Error DB:", err.sqlMessage);
            return res.status(500).json({ error: "Error: El correo ya existe o la base de datos falló." });
        }

        console.log("✅ Usuario registrado y verificado automáticamente:", correo);
        res.json({ success: true, message: "¡Registro exitoso! Ya puedes iniciar sesión." });
    });
});

// --- RUTA: LOGIN ---
app.post('/login', (req, res) => {
    const { correo, password } = req.body;

    const sql = "SELECT * FROM USUARIOS WHERE Correo = ? AND Contrasena = ?";
    
    db.query(sql, [correo, password], (err, results) => {
        if (err) return res.status(500).json({ error: "Error en el servidor" });

        if (results.length > 0) {
            const usuario = results[0];
            
            // Aunque saltamos el código, mantenemos la validación por si acaso
            if (!usuario.verificado) { 
                return res.status(403).json({ error: "Cuenta no verificada." });
            }

            res.json({ 
                success: true,
                message: "¡Bienvenido!", 
                user: { nombre: usuario.Nombre, rol: usuario.Rol } 
            });
        } else {
            res.status(401).json({ error: "Correo o contraseña incorrectos" });
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));