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
    
    // 1. Obtener o crear hoja Arqueos
    let sheetArqueos = ss.getSheetByName(SHEET_ARQUEOS);
    
    if (!sheetArqueos) {
      sheetArqueos = ss.insertSheet(SHEET_ARQUEOS);
    }
    
    // Verificar si tiene encabezados
    const primeraFila = sheetArqueos.getRange(1, 1).getValue();
    if (!primeraFila || primeraFila === '') {
      sheetArqueos.getRange(1, 1, 1, 16).setValues([[
        'ID', 'Timestamp', 'Vendedor', 'Fecha', 'Día', 
        'Venta Bruta', 'Descuentos', 'Venta Total',
        'Total Cobrado', 'Total Venta Crédito', 'Total Gastos',
        'Total Efectivo', 'Efectivo Entregado', 'QR Entregado', 'Diferencia', 'Telegram ID'
      ]]);
      sheetArqueos.getRange(1, 1, 1, 16).setFontWeight('bold');
    }
    
    // 2. Verificar si ya existe arqueo de este vendedor para esta fecha
    const allData = sheetArqueos.getDataRange().getValues();
    let filaExistente = -1;
    let arqueoId = '';
    
    for (let i = 1; i < allData.length; i++) {
      // Columna 3 = Vendedor, Columna 4 = Fecha
      if (allData[i][2] === datos.vendedor && allData[i][3] === datos.fecha) {
        filaExistente = i + 1; // +1 porque getRange es 1-indexed
        arqueoId = allData[i][0];
        break;
      }
    }
    
    const nuevaFila = [
      arqueoId || Utilities.getUuid().substring(0, 8),
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
    ];
    
    if (filaExistente > 0) {
      // Actualizar registro existente
      sheetArqueos.getRange(filaExistente, 1, 1, 16).setValues([nuevaFila]);
      arqueoId = nuevaFila[0];
    } else {
      // Crear nuevo registro
      arqueoId = nuevaFila[0];
      sheetArqueos.appendRow(nuevaFila);
    }
    
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
    
    // Obtener arqueo del día para un vendedor
    if (action === 'arqueo') {
      const vendedor = e.parameter.vendedor;
      const fecha = e.parameter.fecha;
      
      const sheet = ss.getSheetByName(SHEET_ARQUEOS);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          existe: false
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][2]) === String(vendedor) && data[i][3] === fecha) {
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            existe: true,
            arqueo: {
              id: data[i][0],
              timestamp: data[i][1],
              vendedor: data[i][2],
              fecha: data[i][3],
              dia: data[i][4],
              ventaBruta: data[i][5],
              descuentos: data[i][6],
              ventaTotal: data[i][7],
              totalCobrado: data[i][8],
              totalVentaCredito: data[i][9],
              totalGastos: data[i][10],
              totalEfectivo: data[i][11],
              efectivoEntregado: data[i][12],
              qrEntregado: data[i][13],
              diferencia: data[i][14]
            }
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        existe: false
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
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
