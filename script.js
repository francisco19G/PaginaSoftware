const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const nodemailer = require('nodemailer');
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

// --- CONFIGURACIÓN DE CORREO (NODEMAILER) ---
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verificar Cartero
transporter.verify((error) => {
    if (error) console.log("❌ Error Cartero:", error.message);
    else console.log("✅ Cartero listo para enviar correos");
});

// --- RUTA: REGISTRO + ENVÍO DE CÓDIGO ---
app.post('/register', (req, res) => {
    const { nombre, correo, password } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000); // 6 dígitos

    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol, codigo_verificacion) VALUES (?, ?, ?, 'usuario', ?)";
    
    db.query(sql, [nombre, correo, password, codigo], (err, result) => {
        if (err) {
            console.error("Error DB:", err.sqlMessage);
            return res.status(500).json({ error: "Error en base de datos: " + err.sqlMessage });
        }

        const mailOptions = {
            from: `"BAJAR Tienda" <${process.env.EMAIL_USER}>`,
            to: correo,
            subject: 'Tu código de verificación - BAJAR',
            html: `
                <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2F2A26;">¡Bienvenido a BAJAR, ${nombre}!</h2>
                    <p>Usa el siguiente código para verificar tu cuenta:</p>
                    <h1 style="background: #f4f4f4; padding: 10px; text-align: center; letter-spacing: 5px;">${codigo}</h1>
                    <p>Si no solicitaste esto, ignora este correo.</p>
                </div>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("❌ Falló el envío de correo:", error.message);
                return res.json({ 
                    message: "Usuario creado, pero hubo un error enviando el correo.",
                    debug: error.message 
                });
            }
            res.json({ message: "Código enviado a tu correo" });
        });
    });
});

// --- RUTA: VERIFICAR CÓDIGO ---
app.post('/verify', (req, res) => {
    const { correo, codigo } = req.body;
// Antes decía Verificado y CodigoVerificacion
const sql = "UPDATE USUARIOS SET verificado = TRUE WHERE Correo = ? AND codigo_verificacion = ?";

    db.query(sql, [correo, codigo], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.affectedRows > 0) {
            res.json({ message: "Cuenta verificada con éxito" });
        } else {
            res.status(400).json({ error: "Código incorrecto o correo no encontrado" });
        }
    });
});

// --- RUTA: LOGIN ---
app.post('/login', (req, res) => {
    const { correo, password } = req.body;

    // Modificado para que solo deje entrar si está Verificado
    const sql = "SELECT * FROM USUARIOS WHERE Correo = ? AND Contrasena = ?";
    
    db.query(sql, [correo, password], (err, results) => {
        if (err) return res.status(500).json({ error: "Error en el servidor" });

        if (results.length > 0) {
            const usuario = results[0];
            
// Antes decía usuario.Verificado
if (!usuario.verificado) { 
    return res.status(403).json({ error: "Tu cuenta no ha sido verificada. Revisa tu correo." });
}

            res.json({ 
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
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));