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
const SUPABASE_ANON_KEY = 'sb_publishable_r0QjWW_e0cSLRMRkCrlj3A_iNLQdV38';

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

// Función para parsear CSV
function parsearCSV(contenido) {
    const lineas = contenido.split('\n');
    const headers = lineas[0].split('\t').map(h => h.trim());

    const registros = [];

    for (let i = 1; i < lineas.length; i++) {
        const valores = lineas[i].split('\t');
        if (valores.length < headers.length) continue;

        const registro = {};
        headers.forEach((header, index) => {
            registro[header] = valores[index]?.trim() || '';
        });

        registros.push(registro);
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

    registros.forEach((reg, index) => {
        const diaEspanol = (reg['Folder name'] || '').toLowerCase();
        const diaCorto = DIAS_MAP[diaEspanol];

        if (!diaCorto) {
            console.log(`⚠️  Registro ${index + 1}: Día no reconocido "${reg['Folder name']}"`);
            return;
        }

        const { codigo, nombre } = parsearTitulo(reg['Title']);

        if (!nombre) {
            console.log(`⚠️  Registro ${index + 1}: Sin nombre`);
            return;
        }

        rutas.push({
            telegram_id: TELEGRAM_ID,
            dia_semana: diaCorto,
            codigo_cliente: codigo || `AUTO_${index}`,
            nombre_cliente: nombre
        });

        console.log(`✅ ${diaCorto}: [${codigo || 'SIN CÓDIGO'}] ${nombre}`);
    });

    console.log(`\n📊 Total a importar: ${rutas.length} clientes\n`);

    // Insertar en Supabase
    console.log('🚀 Enviando a Supabase...\n');

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rutas`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(rutas)
        });

        if (response.ok) {
            console.log('✅ ¡Importación exitosa!');
            console.log(`   ${rutas.length} clientes agregados a la tabla "rutas"`);
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
