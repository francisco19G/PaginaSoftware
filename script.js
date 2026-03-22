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
// En tu archivo script.js
const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10
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
// --- RUTA PARA INICIAR SESIÓN ---
app.post('/login', (req, res) => {
    const { correo, password } = req.body;

    console.log("Intento de login:", correo);

    // Buscamos al usuario por correo y contraseña exactos
    const sql = "SELECT * FROM USUARIOS WHERE Correo = ? AND Contrasena = ?";
    
    db.query(sql, [correo, password], (err, results) => {
        if (err) {
            console.error("Error en Login:", err.message);
            return res.status(500).json({ error: "Error en el servidor al verificar datos." });
        }

        if (results.length > 0) {
            // ¡Usuario encontrado!
            const usuario = results[0];
            console.log("✅ Login exitoso para:", usuario.Nombre);
            
            res.json({ 
                message: "¡Bienvenido de nuevo!", 
                user: { nombre: usuario.Nombre, rol: usuario.Rol } 
            });
        } else {
            // No hubo coincidencias
            res.status(401).json({ error: "Correo o contraseña incorrectos." });
        }
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
const nodemailer = require('nodemailer');

// 1. Configurar el transporte de correo (Usa variables de entorno en Render)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Tu correo
        pass: process.env.EMAIL_PASS  // Tu "Contraseña de aplicación" de Google
    }
});

// 2. Modificar la ruta /register
app.post('/register', (req, res) => {
    const { nombre, correo, password } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000); // Genera 6 dígitos

    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol, CodigoVerificacion) VALUES (?, ?, ?, 'usuario', ?)";
    
    db.query(sql, [nombre, correo, password, codigo], (err, result) => {
        if (err) return res.status(500).json({ error: err.sqlMessage });

        // Enviar el correo
        const mailOptions = {
            from: '"BAJAR Tienda" <tu-correo@gmail.com>',
            to: correo,
            subject: 'Tu código de verificación',
            html: `<h1>Bienvenido ${nombre}</h1><p>Tu código es: <b>${codigo}</b></p>`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) console.log("Error correo:", error);
            res.json({ message: "Código enviado a tu correo" });
        });
    });
});

// 3. NUEVA RUTA: Confirmar Código
app.post('/verify', (req, res) => {
    const { correo, codigo } = req.body;
    const sql = "UPDATE USUARIOS SET Verificado = TRUE WHERE Correo = ? AND CodigoVerificacion = ?";

    db.query(sql, [correo, codigo], (err, result) => {
        if (result.affectedRows > 0) {
            res.json({ message: "Cuenta verificada con éxito" });
        } else {
            res.status(400).json({ error: "Código incorrecto" });
        }
    });
});