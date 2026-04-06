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

// Verificar conexión inicial a la DB
db.getConnection((err, conn) => {
    if (err) console.error("❌ Error de conexión a Railway:", err.message);
    else {
        console.log("✅ ¡Conectado exitosamente a Railway!");
        conn.release();
    }
});

// --- CONFIGURACIÓN DE CORREO (NODEMAILER) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // Recuerda: Contraseña de aplicación de 16 letras
    },
    tls: {
        rejectUnauthorized: false // Evita bloqueos por certificados en la nube
    }
});

// Verificar que el cartero esté listo
transporter.verify((error) => {
    if (error) console.log("❌ Error en configuración de correo:", error.message);
    else console.log("✅ Servidor listo para enviar correos");
});

// --- RUTA: REGISTRO + ENVÍO DE CÓDIGO ---
app.post('/register', (req, res) => {
    const { nombre, correo, password } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000); // 6 dígitos aleatorios

    // IMPORTANTE: verificado = 0 (inicia desactivado)
    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol, verificado, codigo_verificacion) VALUES (?, ?, ?, 'usuario', 0, ?)";
    
    db.query(sql, [nombre, correo, password, codigo], (err, result) => {
        if (err) {
            console.error("❌ Error al insertar en DB:", err.sqlMessage);
            return res.status(500).json({ error: "El correo ya existe o hubo un problema con la base de datos." });
        }

        console.log(`✅ Usuario ${correo} guardado. Enviando código: ${codigo}`);

        // Opciones del correo
        const mailOptions = {
            from: `"Valor Noble" <${process.env.EMAIL_USER}>`,
            to: correo,
            subject: 'Tu código de verificación - Valor Noble',
            html: `
                <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px; max-width: 500px; margin: auto;">
                    <h2 style="color: #2F2A26; text-align: center;">¡Bienvenido a Valor Noble!</h2>
                    <p>Hola <strong>${nombre}</strong>, usa el siguiente código para activar tu cuenta:</p>
                    <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #8c9b8c;">
                        ${codigo}
                    </div>
                    <p style="font-size: 12px; color: #888; text-align: center; margin-top: 20px;">
                        Si no creaste esta cuenta, puedes ignorar este mensaje.
                    </p>
                </div>`
        };

        // Envío del correo (No bloqueante)
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("⚠️ El correo no se envió:", error.message);
                // Respondemos éxito porque el usuario YA está en la DB, pero avisamos del fallo
                return res.json({ 
                    success: true, 
                    message: "Usuario registrado, pero el servicio de correo falló. Tu código (para pruebas) es: " + codigo 
                });
            }
            res.json({ success: true, message: "¡Código enviado! Revisa tu bandeja de entrada." });
        });
    });
});

// --- RUTA: VERIFICAR CÓDIGO ---
app.post('/verify', (req, res) => {
    const { correo, codigo } = req.body;
    
    // Buscamos coincidencia y actualizamos a verificado = 1
    const sql = "UPDATE USUARIOS SET verificado = 1 WHERE Correo = ? AND codigo_verificacion = ?";

    db.query(sql, [correo, codigo], (err, result) => {
        if (err) return res.status(500).json({ error: "Error en la verificación." });

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "¡Cuenta activada con éxito! Ya puedes iniciar sesión." });
        } else {
            res.status(400).json({ error: "El código es incorrecto o no coincide con el correo." });
        }
    });
});

// --- RUTA: LOGIN ---
app.post('/login', (req, res) => {
    const { correo, password } = req.body;

    const sql = "SELECT * FROM USUARIOS WHERE Correo = ? AND Contrasena = ?";
    
    db.query(sql, [correo, password], (err, results) => {
        if (err) return res.status(500).json({ error: "Error en el servidor." });

        if (results.length > 0) {
            const usuario = results[0];
            
            // Verificamos si el usuario ya activó su cuenta
            if (usuario.verificado == 0) { 
                return res.status(403).json({ error: "Tu cuenta aún no está activa. Revisa tu correo para verificarla." });
            }

            res.json({ 
                success: true,
                message: "¡Bienvenido de nuevo!", 
                user: { nombre: usuario.Nombre, rol: usuario.Rol } 
            });
        } else {
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
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
});