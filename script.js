const express = require('express');
const path = require('path');
const app = express();

// Servir archivos estáticos (CSS, Imágenes, JS del navegador)
app.use(express.static(path.join(__dirname, '/')));

// Ruta para mostrar tu página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Usar el puerto que Render asigna automáticamente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});
