/**
 * Script para importar clientes desde CSV a Supabase
 * 
 * Uso: 
 * 1. Guarda tu CSV como 'clientes.csv' en esta carpeta
 * 2. Ejecuta: node import-clientes.js
 */

const fs = require('fs');

// Configuración de Supabase
const SUPABASE_URL = 'https://pftngeppuaoobsbnssje.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmdG5nZXBwdWFvb2JzYm5zc2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3ODIxNDUsImV4cCI6MjA4NDM1ODE0NX0.JyU-aFgZRXrt0By-m5tkc4d3FQRrBeKfAp1d8GuJgKU';

// ID de Telegram del vendedor (reemplaza con el tuyo)
const TELEGRAM_ID = 1719186398; // <-- CAMBIA ESTO

// Mapeo de días en español a códigos cortos
const DIAS_MAP = {
    'domingo': 'DOM',
    'lunes': 'LUN',
    'martes': 'MAR',
    'miercoles': 'MIE',
    'miércoles': 'MIE',
    'jueves': 'JUE',
    'viernes': 'VIE',
    'sabado': 'SAB',
    'sábado': 'SAB'
};

// Función para parsear el título y extraer código + nombre
function parsearTitulo(titulo) {
    if (!titulo) return { codigo: null, nombre: '' };

    titulo = titulo.trim();

    // Patrón: 4 dígitos + espacio + nombre
    const match = titulo.match(/^(\d{4})\s+(.+)$/);

    if (match) {
        return {
            codigo: match[1],
            nombre: match[2].trim()
        };
    } else {
        // No tiene código, es solo nombre
        return {
            codigo: null,
            nombre: titulo
        };
    }
}

// Función para parsear CSV (separado por comas)
function parsearCSV(contenido) {
    const lineas = contenido.split('\n');
    const registros = [];

    // Saltar la primera línea (header)
    for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        if (!linea) continue;

        // Dividir por comas
        const valores = linea.split(',');

        if (valores.length >= 5) {
            registros.push({
                dia: valores[0]?.trim() || '',
                titulo: valores[4]?.trim() || ''
            });
        }
    }

    return registros;
}

// Función principal
async function importarClientes() {
    // Leer CSV
    const csvPath = './clientes.csv';

    if (!fs.existsSync(csvPath)) {
        console.error('❌ Error: No se encontró el archivo clientes.csv');
        console.log('Guarda tu CSV como "clientes.csv" en la carpeta del proyecto');
        return;
    }

    const contenido = fs.readFileSync(csvPath, 'utf8');
    const registros = parsearCSV(contenido);

    console.log(`📋 Encontrados ${registros.length} registros en el CSV\n`);

    // Preparar datos para Supabase
    const rutas = [];
    const duplicadosCheck = new Set(); // Para evitar duplicados dentro del mismo CSV

    registros.forEach((reg, index) => {
        const diaEspanol = (reg.dia || '').toLowerCase();
        const diaCorto = DIAS_MAP[diaEspanol];

        if (!diaCorto) {
            console.log(`⚠️  Registro ${index + 1}: Día no reconocido "${reg.dia}"`);
            return;
        }

        const { codigo, nombre } = parsearTitulo(reg.titulo);

        if (!nombre) {
            console.log(`⚠️  Registro ${index + 1}: Sin nombre`);
            return;
        }

        const codigoFinal = codigo || `AUTO_${index}`;

        // Verificar duplicado interno
        const key = `${diaCorto}-${codigoFinal}`;
        if (duplicadosCheck.has(key)) {
            console.log(`⚠️  Registro ${index + 1}: Ignorado por duplicado en CSV (${diaCorto} - ${codigoFinal})`);
            return;
        }
        duplicadosCheck.add(key);

        rutas.push({
            telegram_id: TELEGRAM_ID,
            dia_semana: diaCorto,
            codigo_cliente: codigoFinal,
            nombre_cliente: nombre
        });

        console.log(`✅ ${diaCorto}: [${codigoFinal}] ${nombre}`);
    });

    console.log(`\n📊 Total a importar: ${rutas.length} clientes\n`);

    // Insertar en Supabase con UPSERT
    console.log('🚀 Enviando a Supabase (Upsert)...\n');

    try {
        // Añadimos on_conflict para especificar las columnas de la restricción única
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rutas?on_conflict=telegram_id,dia_semana,codigo_cliente`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates' // Esto activa el funcionamiento tipo UPSERT
            },
            body: JSON.stringify(rutas)
        });

        if (response.ok) {
            console.log('✅ ¡Importación exitosa!');
            console.log(`   Se procesaron ${rutas.length} registros (insertados o actualizados)`);
        } else {
            const error = await response.text();
            console.error('❌ Error de Supabase:', error);
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
    }
}

// Ejecutar
importarClientes();
