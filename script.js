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

app.post('/register', (req, res) => {
    const { nombre, correo, password } = req.body;
    
    // Mencionamos explícitamente las columnas para que MySQL no se confunda
    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol, verificado) VALUES (?, ?, ?, 'usuario', 1)";
    
    db.query(sql, [nombre, correo, password], (err) => {
        if (err) {
            console.error("Error en MySQL:", err.sqlMessage); // Esto te dirá el error exacto en Render
            return res.status(500).json({ error: "No se pudo registrar el usuario." });
        }
        res.json({ success: true, message: "Registro exitoso." });
    });
});
// --- RUTA: LOGIN ---
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
            // Aunque ahora se activan solas, mantenemos la lógica por si existieran usuarios viejos
            if (user.verificado == 0) return res.status(403).json({ error: "Cuenta no activa." });
            
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
        } else {
            res.status(401).json({ error: "Credenciales inválidas." });
        }
    });
});

// --- RUTA: ACTUALIZAR PERFIL ---
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

// PASO 1: Preparar la venta (Crear registro en VENTAS y DETALLE_VENTA)
app.post('/preparar-pago', (req, res) => {
    const { idCliente, productos, subtotal } = req.body;
    const iva = subtotal * 0.16;
    const total = subtotal + iva;
    const fechaActual = new Date();

    // Insertar en tabla VENTAS [cite: 34, 117]
    const sqlVenta = "INSERT INTO VENTAS (Id_Cliente, Fecha, Subtotal, Total, Estado) VALUES (?, ?, ?, ?, 'Esperando Pago')";
    
    db.query(sqlVenta, [idCliente, fechaActual, subtotal, total], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const idVentaGenerada = result.insertId;
        // Generar Referencia Única para la transacción
        const referenciaUnica = `REF-${fechaActual.getFullYear()}-${idVentaGenerada}-${Math.floor(Math.random()*1000)}`;

        // Mapear productos al detalle de la venta
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

// PASO 2: Registrar el pago final desde el formulario
app.post('/registrar-pago', (req, res) => {
    const { idVenta, referencia, metodoPago, monto } = req.body;

    // 1. Insertar en tabla PAGOS [cite: 52, 163]
    const sqlPago = "INSERT INTO PAGOS (Id_Venta, Referencia_Pago, Metodo_Pago, Estado_Pago, Monto, Fecha) VALUES (?, ?, ?, 'Completado', ?, NOW())";
    
    db.query(sqlPago, [idVenta, referencia, metodoPago, monto], (err) => {
        if (err) return res.status(500).json({ error: "Error al registrar el pago" });

        // 2. Actualizar el estado de la venta a 'Pagado' [cite: 49, 150]
        db.query("UPDATE VENTAS SET Estado = 'Pagado' WHERE Id_Venta = ?", [idVenta], (errUpd) => {
            if (errUpd) console.error("Error al actualizar estado de venta");
            
            res.json({ success: true, message: "Pago verificado y compra finalizada con éxito." });
        });
    });
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));