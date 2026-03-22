const mysql = require('mysql2');

// Esta es la configuración (Cadena de conexión)
const connection = mysql.createConnection({
  host: 'mysql://root:********@caboose.proxy.rlwy.net:52132/railway',
  user: 'tu_usuario',
  password: 'tu_password',
  database: 'nombre_de_tu_bd'
});

connection.connect((err) => {
  if (err) {
    console.error('Error conectando a la base de datos: ' + err.stack);
    return;
  }
  console.log('Conectado con éxito a la base de datos.');
});

module.exports = connection;