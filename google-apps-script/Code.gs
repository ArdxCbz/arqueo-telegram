/**
 * ARQUEO Y COBROS DE CRÉDITOS - Google Apps Script Backend
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Crear nuevo Google Sheets
 * 2. Extensiones → Apps Script
 * 3. Pegar este código en Code.gs
 * 4. Guardar (Ctrl+S)
 * 5. Implementar → Nueva implementación → Aplicación web
 * 6. Ejecutar como: Tu cuenta
 * 7. Quién tiene acceso: Cualquier persona
 * 8. Copiar la URL del script y pegarla en app.js
 */

// ===== Configuración =====
const SHEET_ARQUEOS = 'Arqueos';
const SHEET_CREDITOS = 'Creditos';
const SHEET_GASTOS = 'Gastos';
const SHEET_CLIENTES = 'Clientes';

// ===== Inicializar hojas si no existen =====
function inicializarHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Hoja Arqueos
  let sheet = ss.getSheetByName(SHEET_ARQUEOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ARQUEOS);
    sheet.getRange(1, 1, 1, 14).setValues([[
      'ID', 'Timestamp', 'Vendedor', 'Fecha', 'Día', 
      'Venta Bruta', 'Descuentos', 'Venta Total',
      'Total Cobrado', 'Total Venta Crédito', 'Total Gastos',
      'Total Efectivo', 'Efectivo Entregado', 'QR Entregado', 'Diferencia', 'Telegram ID'
    ]]);
    sheet.getRange(1, 1, 1, 16).setFontWeight('bold');
  }
  
  // Hoja Créditos
  sheet = ss.getSheetByName(SHEET_CREDITOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CREDITOS);
    sheet.getRange(1, 1, 1, 6).setValues([[
      'Arqueo ID', 'Código Cliente', 'Saldo Anterior', 'Crédito Cobrado', 'Venta a Crédito', 'Saldo Nuevo'
    ]]);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  
  // Hoja Gastos
  sheet = ss.getSheetByName(SHEET_GASTOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_GASTOS);
    sheet.getRange(1, 1, 1, 3).setValues([[
      'Arqueo ID', 'Concepto', 'Monto'
    ]]);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  
  // Hoja Clientes (Maestro)
  sheet = ss.getSheetByName(SHEET_CLIENTES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CLIENTES);
    sheet.getRange(1, 1, 1, 3).setValues([[
      'Código Cliente', 'Nombre', 'Saldo Actual'
    ]]);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
}

// ===== Endpoint POST - Recibir Arqueo =====
function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Generar ID único
    const arqueoId = Utilities.getUuid().substring(0, 8);
    
    // 1. Guardar en Arqueos
    const sheetArqueos = ss.getSheetByName(SHEET_ARQUEOS);
    sheetArqueos.appendRow([
      arqueoId,
      datos.timestamp,
      datos.vendedor,
      datos.fecha,
      datos.dia,
      datos.ventaBruta,
      datos.descuentos,
      datos.ventaTotal,
      datos.totalCobrado,
      datos.totalVentaCredito,
      datos.totalGastos,
      datos.totalEfectivo,
      datos.efectivoEntregado,
      datos.qrEntregado,
      datos.diferencia,
      datos.telegramUserId || ''
    ]);
    
    // 2. Guardar Créditos
    if (datos.creditos && datos.creditos.length > 0) {
      const sheetCreditos = ss.getSheetByName(SHEET_CREDITOS);
      const sheetClientes = ss.getSheetByName(SHEET_CLIENTES);
      
      datos.creditos.forEach(credito => {
        if (credito.codigo) {
          const saldoNuevo = credito.saldo - credito.cobrado + credito.ventaCredito;
          
          // Guardar detalle
          sheetCreditos.appendRow([
            arqueoId,
            credito.codigo,
            credito.saldo,
            credito.cobrado,
            credito.ventaCredito,
            saldoNuevo
          ]);
          
          // Actualizar saldo del cliente
          actualizarSaldoCliente(sheetClientes, credito.codigo, saldoNuevo);
        }
      });
    }
    
    // 3. Guardar Gastos
    if (datos.gastos && datos.gastos.length > 0) {
      const sheetGastos = ss.getSheetByName(SHEET_GASTOS);
      datos.gastos.forEach(gasto => {
        sheetGastos.appendRow([
          arqueoId,
          gasto.nombre,
          gasto.monto
        ]);
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      arqueoId: arqueoId,
      message: 'Arqueo guardado correctamente'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== Endpoint GET - Obtener Clientes con Saldo =====
function doGet(e) {
  try {
    const action = e.parameter.action || 'clientes';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'clientes') {
      const sheet = ss.getSheetByName(SHEET_CLIENTES);
      const data = sheet.getDataRange().getValues();
      
      const clientes = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][2] > 0) { // Solo clientes con saldo pendiente
          clientes.push({
            codigo: data[i][0],
            nombre: data[i][1],
            saldo: data[i][2]
          });
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        clientes: clientes
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

// ===== Actualizar saldo de cliente =====
function actualizarSaldoCliente(sheet, codigo, nuevoSaldo) {
  const data = sheet.getDataRange().getValues();
  let encontrado = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === codigo) {
      sheet.getRange(i + 1, 3).setValue(nuevoSaldo);
      encontrado = true;
      break;
    }
  }
  
  // Si no existe, crear nuevo cliente
  if (!encontrado && nuevoSaldo > 0) {
    sheet.appendRow([codigo, '', nuevoSaldo]);
  }
}

// ===== Menú personalizado =====
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Arqueos')
    .addItem('Inicializar Hojas', 'inicializarHojas')
    .addToUi();
}
