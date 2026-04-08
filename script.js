const express = require('express');
const mysql = require('mysql2');
const path = require('path');
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

// --- RUTA: REGISTRO ---
app.post('/register', (req, res) => {
    const { nombre, correo, password } = req.body;
    const sql = "INSERT INTO USUARIOS (Nombre, Correo, Contrasena, Rol, verificado) VALUES (?, ?, ?, 'usuario', 1)";
    
    db.query(sql, [nombre, correo, password], (err) => {
        if (err) {
            console.error("Error en MySQL:", err.sqlMessage);
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
            if (user.verificado == 0) return res.status(403).json({ error: "Cuenta no activa." });
            res.json({ 
                success: true,
                user: { 
                    id: user.Id_Usuario, nombre: user.Nombre, correo: user.Correo, 
                    rol: user.Rol, telefono: user.Telefono || '', direccion: user.Direccion || ''
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
app.post('/preparar-pago', (req, res) => {
    const { idCliente, productos, subtotal } = req.body;
    const total = subtotal * 1.16;
    const fecha = new Date();
    const sqlVenta = "INSERT INTO VENTAS (Id_Cliente, Fecha, Subtotal, Total, Estado) VALUES (?, ?, ?, ?, 'Esperando Pago')";
    
    db.query(sqlVenta, [idCliente, fecha, subtotal, total], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        const idVenta = result.insertId;
        const referencia = `REF-${fecha.getFullYear()}-${idVenta}-${Math.floor(Math.random()*1000)}`;
        const detalleValues = productos.map(p => [idVenta, p.id, p.qty, p.price]);
        const sqlDetalle = "INSERT INTO DETALLE_VENTA (Id_Venta, Id_Producto, Cantidad, Precio_Unitario) VALUES ?";
        db.query(sqlDetalle, [detalleValues], (errDetalle) => {
            if (errDetalle) return res.status(500).json({ error: "Error en detalle" });
            res.json({ success: true, idVenta, referencia, montoTotal: total });
        });
    });
});

app.post('/registrar-pago', (req, res) => {
    const { idVenta, referencia, metodoPago, monto } = req.body;
    const sqlPago = "INSERT INTO PAGOS (Id_Venta, Referencia_Pago, Metodo_Pago, Estado_Pago, Monto, Fecha) VALUES (?, ?, ?, 'Completado', ?, NOW())";
    db.query(sqlPago, [idVenta, referencia, metodoPago, monto], (err) => {
        if (err) return res.status(500).json({ error: "Error al pagar" });
        db.query("UPDATE VENTAS SET Estado = 'Pagado' WHERE Id_Venta = ?", [idVenta], (errUpd) => {
            res.json({ success: true, message: "Compra finalizada con éxito." });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));