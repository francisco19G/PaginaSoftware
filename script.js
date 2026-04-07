const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();

// --- MIDDLEWARE ---
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/')));

// --- BASE DE DATOS (POOL) ---
const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10
});

// --- CORREO (NODEMAILER) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

// --- RUTAS DE USUARIO (REGISTRO, VERIFICAR, LOGIN, PERFIL) ---

app.post('/register', (req, res) => {
    const { nombre, correo, password } = req.body;
    const codigo = Math.floor(100000 + Math.random() * 900000);
    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol, verificado, codigo_verificacion) VALUES (?, ?, ?, 'usuario', 0, ?)";
    
    db.query(sql, [nombre, correo, password, codigo], (err) => {
        if (err) return res.status(500).json({ error: "El correo ya existe." });
        const mailOptions = {
            from: `"Valor Noble" <${process.env.EMAIL_USER}>`,
            to: correo,
            subject: 'Código de Verificación - Valor Noble',
            html: `<div style="font-family:sans-serif; padding:20px; border:1px solid #ddd;">
                    <h2>¡Hola ${nombre}!</h2>
                    <p>Tu código de activación es: <b style="font-size:24px;">${codigo}</b></p>
                   </div>`
        };
        transporter.sendMail(mailOptions, (error) => {
            if (error) return res.json({ success: true, message: "Registrado. El correo falló. Código: " + codigo });
            res.json({ success: true, message: "Código enviado a tu correo." });
        });
    });
});

app.post('/verify', (req, res) => {
    const { correo, codigo } = req.body;
    const sql = "UPDATE USUARIOS SET verificado = 1 WHERE Correo = ? AND codigo_verificacion = ?";
    db.query(sql, [correo, codigo], (err, result) => {
        if (result && result.affectedRows > 0) res.json({ success: true, message: "Cuenta activada." });
        else res.status(400).json({ error: "Código incorrecto." });
    });
});

app.post('/login', (req, res) => {
    const { correo, password } = req.body;
    const sql = `
        SELECT U.Id_Usuario, U.Nombre, U.Correo, U.Rol, U.verificado, C.Telefono, C.Direccion 
        FROM USUARIOS U 
        LEFT JOIN CLIENTES C ON U.Id_Usuario = C.Id_Usuario 
        WHERE U.Correo = ? AND U.Contrasena = ?`;
    
    db.query(sql, [correo, password], (err, results) => {
        if (err) return res.status(500).json({ error: "Error en el servidor" });
        if (results.length > 0) {
            const user = results[0];
            if (user.verificado == 0) return res.status(403).json({ error: "Verifica tu cuenta primero." });
            res.json({ 
                success: true,
                user: { 
                    id: user.Id_Usuario, 
                    nombre: user.Nombre, 
                    correo: user.Correo, 
                    rol: user.Rol,
                    telefono: user.Telefono || '', 
                    direccion: user.Direccion || ''
                } 
            });
        } else res.status(401).json({ error: "Credenciales inválidas." });
    });
});

app.post('/update-profile', (req, res) => {
    const { nombre, correo, telefono, direccion } = req.body;
    db.query("SELECT Id_Usuario FROM USUARIOS WHERE Correo = ?", [correo], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
        const idU = results[0].Id_Usuario;
        db.query("SELECT Id_Cliente FROM CLIENTES WHERE Id_Usuario = ?", [idU], (err, clients) => {
            if (clients.length > 0) {
                const sqlUpd = "UPDATE CLIENTES SET Nombre=?, Telefono=?, Direccion=?, Correo=? WHERE Id_Usuario=?";
                db.query(sqlUpd, [nombre, telefono, direccion, correo, idU], (err) => {
                    if (err) return res.status(500).json({ error: "Error al actualizar" });
                    res.json({ success: true, message: "Perfil actualizado" });
                });
            } else {
                const sqlIns = "INSERT INTO CLIENTES (Id_Usuario, Nombre, Correo, Telefono, Direccion) VALUES (?,?,?,?,?)";
                db.query(sqlIns, [idU, nombre, correo, telefono, direccion], (err) => {
                    if (err) return res.status(500).json({ error: "Error al crear perfil" });
                    res.json({ success: true, message: "Perfil guardado" });
                });
            }
        });
    });
});

// --- FLUJO DE VENTA Y PAGO ---

// PASO 1: Preparar la venta (Se activa al dar clic en Finalizar Compra)
app.post('/preparar-pago', (req, res) => {
    const { idCliente, productos, subtotal } = req.body;
    const iva = subtotal * 0.16;
    const total = subtotal + iva;
    const fechaActual = new Date();

    // Insertar en tabla VENTAS [cite: 117, 132, 138, 144]
    const sqlVenta = "INSERT INTO VENTAS (Id_Cliente, Fecha, Subtotal, Total, Estado) VALUES (?, ?, ?, ?, 'Esperando Pago')";
    
    db.query(sqlVenta, [idCliente, fechaActual, subtotal, total], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const idVentaGenerada = result.insertId;
        const referenciaUnica = `REF-${fechaActual.getFullYear()}-${idVentaGenerada}-${Math.floor(Math.random()*1000)}`;

        // Guardar detalle de la venta vinculando productos [cite: 108]
        const detalleValues = productos.map(p => [idVentaGenerada, p.id, p.qty, p.price]);
        const sqlDetalle = "INSERT INTO DETALLE_VENTA (Id_Venta, Id_Producto, Cantidad, Precio_Unitario) VALUES ?";

        db.query(sqlDetalle, [detalleValues], (errDetalle) => {
            if (errDetalle) return res.status(500).json({ error: "Error al guardar el detalle de la venta." });

            res.json({
                success: true,
                idVenta: idVentaGenerada,
                referencia: referenciaUnica,
                montoTotal: total
            });
        });
    });
});

// PASO 2: Registrar pago final desde el formulario
app.post('/registrar-pago', (req, res) => {
    const { idVenta, referencia, metodoPago, monto } = req.body;

    // Insertar en tabla PAGOS 
    const sqlPago = "INSERT INTO PAGOS (Id_Venta, Referencia_Pago, Metodo_Pago, Estado_Pago, Monto, Fecha) VALUES (?, ?, ?, 'Completado', ?, NOW())";
    
    db.query(sqlPago, [idVenta, referencia, metodoPago, monto], (err) => {
        if (err) return res.status(500).json({ error: "Error al registrar el pago" });

        // Actualizar el estado de la venta a 'Pagado' [cite: 150]
        db.query("UPDATE VENTAS SET Estado = 'Pagado' WHERE Id_Venta = ?", [idVenta]);
        
        // Opcional: Vaciar el registro del CARRITO DE COMPRAS en la BD [cite: 89]
        // db.query("DELETE FROM CARRITO_DE_COMPRAS WHERE Id_Usuario = (SELECT Id_Cliente FROM VENTAS WHERE Id_Venta = ?)", [idVenta]);

        res.json({ success: true, message: "Pago verificado y compra finalizada con éxito." });
    });
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));