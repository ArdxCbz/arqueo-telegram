/**
 * CONTROL DE VISITAS - Google Apps Script Backend
 * 
 * INSTRUCCIONES:
 * 1. Crear nuevo Google Sheets llamado "RUTAS"
 * 2. Crear una hoja por cada vendedor (nombre = username de Telegram)
 * 3. En cada hoja, columnas: Día | Código | Nombre
 * 4. Extensiones → Apps Script → Pegar este código
 * 5. Implementar como aplicación web
 */

// ===== Configuración =====
const SHEET_HISTORIAL = 'Historial';

// ===== Inicializar =====
function inicializarHojasVisitas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Crear hoja de historial si no existe
  let sheet = ss.getSheetByName(SHEET_HISTORIAL);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_HISTORIAL);
    sheet.getRange(1, 1, 1, 8).setValues([[
      'Fecha', 'Vendedor', 'Día Programado', 'Día Real', 
      'Código', 'Nombre', 'Visitó', 'Timestamp'
    ]]);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  }
  
  // Crear hoja de ejemplo para vendedor
  const vendedorEjemplo = ss.getSheetByName('ModoDesarrollo');
  if (!vendedorEjemplo) {
    const ejemplo = ss.insertSheet('ModoDesarrollo');
    ejemplo.getRange(1, 1, 1, 3).setValues([['Día', 'Código', 'Nombre']]);
    ejemplo.getRange(1, 1, 1, 3).setFontWeight('bold');
    
    // Datos de ejemplo
    ejemplo.getRange(2, 1, 6, 3).setValues([
      ['LUN', 'C001', 'Tienda La Esquina'],
      ['LUN', 'C002', 'Abarrotes Don Pedro'],
      ['MAR', 'C003', 'Minimarket Sol'],
      ['MIE', 'C004', 'Bodega Central'],
      ['JUE', 'C005', 'Distribuidora Norte'],
      ['VIE', 'C006', 'Super Familiar']
    ]);
  }
}

// ===== GET: Obtener clientes del día =====
function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'clientes') {
      const vendedor = e.parameter.vendedor;
      const dia = e.parameter.dia; // LUN, MAR, etc.
      
      // Buscar hoja del vendedor
      let sheet = ss.getSheetByName(vendedor);
      
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: `No se encontró hoja para vendedor: ${vendedor}`,
          clientes: []
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      const data = sheet.getDataRange().getValues();
      const clientes = [];
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === dia) {
          clientes.push({
            codigo: data[i][1],
            nombre: data[i][2]
          });
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        vendedor: vendedor,
        dia: dia,
        clientes: clientes
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Obtener historial de un vendedor
    if (action === 'historial') {
      const vendedor = e.parameter.vendedor;
      const fecha = e.parameter.fecha;
      
      const sheet = ss.getSheetByName(SHEET_HISTORIAL);
      const data = sheet.getDataRange().getValues();
      const registros = [];
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === vendedor && (!fecha || data[i][0] === fecha)) {
          registros.push({
            fecha: data[i][0],
            diaProgramado: data[i][2],
            diaReal: data[i][3],
            codigo: data[i][4],
            nombre: data[i][5],
            visito: data[i][6]
          });
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        registros: registros
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Acción no válida'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== POST: Guardar visitas =====
function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_HISTORIAL);
    
    // Guardar cada visita
    datos.visitas.forEach(visita => {
      sheet.appendRow([
        datos.fecha,
        datos.vendedor,
        datos.diaProgramado,
        datos.diaReal,
        visita.codigo,
        visita.nombre,
        visita.visito ? 'Sí' : 'No',
        datos.timestamp
      ]);
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `${datos.visitas.length} registros guardados`
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== Menú personalizado =====
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Visitas')
    .addItem('Inicializar Hojas', 'inicializarHojasVisitas')
    .addToUi();
}
