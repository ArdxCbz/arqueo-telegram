// ===== Telegram WebApp Integration =====
const tg = window.Telegram?.WebApp;

// ===== Configuration =====
// Backend: supabaseClient (configurado en supabaseClient-client.js)
let telegramUserId = null;

// ===== State =====
let creditoIdCounter = 0;
let gastoIdCounter = 0;
let currentTab = 'arqueo';
let currentDiaIndex = 0;
let clientesDelDia = [];
let clientesConDeuda = []; // Caché de clientes con saldo pendiente
let clientesRutaCredito = []; // Caché de clientes de la ruta habilitados para crédito
let vendedorUsername = '';
let modoEdicion = false; // true si ya existe arqueo del día

// Días de la semana
const DIAS_SEMANA = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    initTelegram();
    initTabs();
    initFecha();
    initEventListeners();
    initVisitas();
    initRutaUpload(); // Nueva pestaña de configuración de ruta
    addCreditoRow();
    calcularTodo();
    cargarClientesConDeuda();
    cargarClientesParaCredito(); // Cargar clientes habilitados para crédito

    // Cargar arqueo existente después de un pequeño delay para asegurar que vendedorUsername esté listo
    setTimeout(() => {
        cargarArqueoExistente();
    }, 500);

    // Inicializar UI en pestaña Arqueo (configura botones correctamente)
    switchTab('arqueo');
});

// Cargar clientes con deuda desde supabaseClient
async function cargarClientesConDeuda() {
    if (!supabaseClient) {
        console.log('supabaseClient no inicializado, esperando...');
        return;
    }

    try {
        clientesConDeuda = await getClientesConDeuda();
        console.log('Clientes con deuda cargados:', clientesConDeuda.length);
    } catch (error) {
        console.error('Error cargando clientes con deuda:', error);
    }
}

// Cargar clientes de la ruta habilitados para crédito
// Cargar clientes de la ruta habilitados para crédito
async function cargarClientesParaCredito() {
    if (!supabaseClient || !telegramUserId) {
        console.log('Esperando inicialización para cargar clientes de crédito... reintentando en 1s');
        setTimeout(cargarClientesParaCredito, 1000); // Reintentar
        return;
    }

    try {
        console.log('Cargando clientes de crédito para:', telegramUserId);

        // DEBUG: Mostrar alerta con ID para confirmar
        alert(`DEBUG: Cargando clientes para ID: ${telegramUserId}`);

        clientesRutaCredito = await getClientesParaCredito(telegramUserId);
        console.log('Clientes para crédito cargados:', clientesRutaCredito.length);

        if (clientesRutaCredito.length === 0) {
            console.warn('ATENCIÓN: Cero clientes habilitados para crédito encontrados. Verificar columna credito_habilitado en Supabase.');
        }

        // Importante: Actualizar los selects que ya se renderizaron vacíos
        actualizarSelectsCredito();

    } catch (error) {
        console.error('Error cargando clientes para crédito:', error);
    }
}

// ===== Telegram Integration =====
function initTelegram() {
    if (tg) {
        tg.ready();
        tg.expand();

        // Obtener datos del usuario de Telegram PRIMERO
        const user = tg.initDataUnsafe?.user;
        telegramUserId = user?.id || null;
        vendedorUsername = user?.id ? String(user.id) : 'Usuario';
        const nombreCompleto = user ? (user.first_name + (user.last_name ? ' ' + user.last_name : '')) : 'Usuario';

        // Actualizar UI inmediatamente
        document.getElementById('vendedor-nombre').textContent = nombreCompleto;
        document.getElementById('vendedor-nombre-visitas').textContent = nombreCompleto;
        document.getElementById('vendedor-nombre-ruta').textContent = nombreCompleto;

        // Aplicar tema de Telegram
        if (tg.colorScheme === 'light') {
            document.body.classList.add('light-theme');
        }

        // Configurar botón principal de Telegram
        tg.MainButton.setText('Enviar Arqueo');
        tg.MainButton.show();
        tg.MainButton.onClick(() => {
            if (currentTab === 'arqueo') {
                enviarArqueo();
            } else if (currentTab === 'visitas') {
                guardarVisitas();
            }
            // En pestaña ruta el botón debería estar oculto
        });

        // Ocultar botones HTML ya que Telegram usa MainButton
        const btnArqueo = document.getElementById('btn-enviar');
        const btnVisitas = document.getElementById('btn-guardar-visitas');
        if (btnArqueo) btnArqueo.style.display = 'none';
        if (btnVisitas) btnVisitas.style.display = 'none';

    } else {
        // Modo desarrollo sin Telegram
        console.log('Modo desarrollo detectado');
        telegramUserId = 1719186398; // ID real del vendedor
        vendedorUsername = '1719186398';
        document.getElementById('vendedor-nombre').textContent = 'Modo Desarrollo';
        document.getElementById('vendedor-nombre-visitas').textContent = 'Modo Desarrollo';
        document.getElementById('vendedor-nombre-ruta').textContent = 'Modo Desarrollo';

        // La visibilidad de botones HTML se manejará en switchTab
    }

    // Inicializar supabaseClient DESPUÉS de actualizar la UI
    try {
        initSupabase();

        // Registrar vendedor en supabaseClient (si está disponible)
        if (telegramUserId && supabaseClient) {
            getOrCreateVendedor(telegramUserId, document.getElementById('vendedor-nombre').textContent);
        }
    } catch (error) {
        console.error('Error inicializando supabaseClient:', error);
    }
}



// ===== Tabs Navigation =====
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    currentTab = tabName;

    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Gestión de botones (Telegram y HTML fallback)
    const btnArqueo = document.getElementById('btn-enviar');
    const btnVisitas = document.getElementById('btn-guardar-visitas');

    // 1. Resetear visibilidad de botones HTML (ocultar ambos por defecto)
    if (btnArqueo) btnArqueo.style.display = 'none';
    if (btnVisitas) btnVisitas.style.display = 'none';

    // 2. Configurar botón según plataforma (TG o Web)
    if (tg) {
        if (tabName === 'arqueo') {
            tg.MainButton.setText(modoEdicion ? 'Actualizar Arqueo' : 'Enviar Arqueo');
            tg.MainButton.show();
        } else if (tabName === 'visitas') {
            tg.MainButton.setText('Guardar Visitas');
            tg.MainButton.show();
        } else {
            // En pestaña 'ruta' u otras, ocultamos el botón principal de TG
            tg.MainButton.hide();
        }
    } else {
        // Modo Desarrollo (Sin Telegram)
        if (tabName === 'arqueo') {
            if (btnArqueo) {
                btnArqueo.style.display = 'block';
                btnArqueo.textContent = modoEdicion ? 'Actualizar Arqueo' : 'Enviar Arqueo';
            }
        } else if (tabName === 'visitas') {
            if (btnVisitas) btnVisitas.style.display = 'block';
        }
    }
}

// ===== Fecha =====
function initFecha() {
    const fechaInput = document.getElementById('fecha');
    const hoy = new Date();

    // Usar formato local YYYY-MM-DD para evitar problemas de zona horaria
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    fechaInput.value = `${anio}-${mes}-${dia}`;

    actualizarDiaSemana(hoy);

    fechaInput.addEventListener('change', (e) => {
        const fecha = new Date(e.target.value + 'T12:00:00');
        actualizarDiaSemana(fecha);

        // Limpiar formulario y buscar arqueo existente para la nueva fecha
        modoEdicion = false;
        limpiarFormulario();
        cargarArqueoExistente();
    });
}

// Limpiar formulario de arqueo
function limpiarFormulario() {
    document.getElementById('venta-bruta').value = '';
    document.getElementById('descuentos').value = '';
    document.getElementById('efectivo-entregado').value = '';
    document.getElementById('qr-entregado').value = '';
    calcularTodo();
    actualizarBotonEnviar();
}

function actualizarDiaSemana(fecha) {
    document.getElementById('dia-semana').textContent = DIAS_SEMANA[fecha.getDay()];
}

function formatearFecha(fecha) {
    const d = new Date(fecha + 'T12:00:00');
    const dia = d.getDate();
    const mes = d.getMonth() + 1;
    const anio = String(d.getFullYear()).slice(-2);
    return `${dia}-${mes}-${anio}`;
}

function formatearFechaCorta(fecha) {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

// Timestamp en hora local (Bolivia UTC-4)
function getTimestampLocal() {
    const now = new Date();
    const dia = String(now.getDate()).padStart(2, '0');
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const anio = now.getFullYear();
    const hora = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const seg = String(now.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
}

// Cargar arqueo existente del día (supabaseClient)
async function cargarArqueoExistente() {
    if (!supabaseClient || !telegramUserId) {
        console.log('supabaseClient o telegramUserId no disponible');
        return;
    }

    try {
        const fechaSeleccionada = document.getElementById('fecha').value; // YYYY-MM-DD

        console.log('Buscando arqueo existente:', telegramUserId, fechaSeleccionada);

        const arqueo = await getArqueoDelDia(telegramUserId, fechaSeleccionada);

        console.log('Respuesta arqueo:', arqueo);

        if (arqueo) {
            // Verificar si es el día actual para permitir edición
            const hoy = new Date();
            const fechaHoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
            const esHoy = fechaSeleccionada === fechaHoyStr;

            console.log('Fecha seleccionada:', fechaSeleccionada);
            console.log('Fecha hoy sistema:', fechaHoyStr);
            console.log('¿Es hoy?:', esHoy);

            if (esHoy) {
                modoEdicion = true;

                // Rellenar formulario con datos existentes
                document.getElementById('venta-bruta').value = formatMoney(arqueo.venta_bruta);
                document.getElementById('descuentos').value = formatMoney(arqueo.descuentos);
                document.getElementById('efectivo-entregado').value = formatMoney(arqueo.efectivo_entregado);
                document.getElementById('qr-entregado').value = formatMoney(arqueo.qr_entregado);

                // Cargar gastos
                if (arqueo.gastos && arqueo.gastos.length > 0) {
                    const container = document.getElementById('gastos-container');
                    const gastosRows = container.querySelectorAll('.gasto-row');

                    // Primero llenar los gastos fijos (Combustible, Peaje)
                    const gastosFijos = ['Combustible', 'Peaje'];
                    gastosRows.forEach(row => {
                        const labelEl = row.querySelector('label');
                        if (labelEl) {
                            const nombreFijo = labelEl.textContent;
                            const gastoMatch = arqueo.gastos.find(g => g.concepto === nombreFijo);
                            if (gastoMatch) {
                                row.querySelector('.gasto-input').value = formatMoney(gastoMatch.monto);
                            }
                        }
                    });

                    // Añadir gastos adicionales
                    arqueo.gastos.forEach(gasto => {
                        if (!gastosFijos.includes(gasto.concepto) && gasto.monto > 0) {
                            addGastoRow();
                            const nuevaFila = container.lastElementChild;
                            nuevaFila.querySelector('.gasto-nombre').value = gasto.concepto;
                            nuevaFila.querySelector('.gasto-input').value = formatMoney(gasto.monto);
                        }
                    });
                }

                // Cargar créditos
                if (arqueo.creditos && arqueo.creditos.length > 0) {
                    document.getElementById('creditos-body').innerHTML = '';
                    creditoIdCounter = 0;

                    arqueo.creditos.forEach(credito => {
                        addCreditoRow({
                            codigo: credito.codigo_cliente,
                            saldo: credito.saldo_anterior,
                            cobrado: credito.cobrado,
                            ventaCredito: credito.venta_credito,
                            locked: false // Día actual: editables
                        });
                    });
                }

                // Actualizar cálculos y botón
                calcularTodo();
                actualizarBotonEnviar();
                habilitarFormulario(true);

                console.log('Arqueo cargado para edición');
            } else {
                // Es fecha pasada - mostrar datos pero bloquear edición
                modoEdicion = false;
                document.getElementById('venta-bruta').value = formatMoney(arqueo.venta_bruta);
                document.getElementById('descuentos').value = formatMoney(arqueo.descuentos);
                document.getElementById('efectivo-entregado').value = formatMoney(arqueo.efectivo_entregado);
                document.getElementById('qr-entregado').value = formatMoney(arqueo.qr_entregado);
                calcularTodo();
                habilitarFormulario(false);
                actualizarBotonEnviar();
                console.log('Arqueo de fecha pasada - solo lectura');
            }
        } else {
            // No existe arqueo, verificar si es fecha pasada
            const hoy = new Date();
            const fechaHoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

            if (fechaSeleccionada < fechaHoyStr) {
                habilitarFormulario(false);
            } else {
                habilitarFormulario(true);
            }
        }
    } catch (error) {
        console.error('Error cargando arqueo existente:', error);
    }
}

// Habilitar/deshabilitar formulario
function habilitarFormulario(habilitar) {
    const inputs = document.querySelectorAll('#form-arqueo input');
    const buttons = document.querySelectorAll('#form-arqueo button');
    const btnEnviar = document.getElementById('btn-enviar');

    inputs.forEach(input => input.disabled = !habilitar);
    buttons.forEach(btn => {
        if (btn !== btnEnviar) btn.disabled = !habilitar;
    });

    if (btnEnviar) {
        btnEnviar.disabled = !habilitar;
        btnEnviar.style.opacity = habilitar ? '1' : '0.5';
    }

    if (tg) {
        if (habilitar) {
            tg.MainButton.show();
        } else {
            tg.MainButton.hide();
        }
    }
}

// Actualizar texto del botón según modo
// Actualizar texto del botón según modo
function actualizarBotonEnviar() {
    const btnHtml = document.getElementById('btn-enviar');
    const texto = modoEdicion ? 'Actualizar Arqueo' : 'Enviar Arqueo';

    // Botón HTML (siempre visible en su pestana, pero actualizamos texto por si acaso)
    if (btnHtml) btnHtml.textContent = texto;

    // Botón Telegram (solo si estamos en pestaña arqueo)
    if (tg && currentTab === 'arqueo') {
        tg.MainButton.setText(texto);
    }
}

// ===== Visitas =====
function initVisitas() {
    const hoy = new Date();
    // Validar que hoy sea una fecha válida
    if (isNaN(hoy.getTime())) {
        console.error('Error crítico: Fecha del sistema inválida');
        alert('Error: Fecha del sistema no válida');
        return;
    }

    currentDiaIndex = hoy.getDay(); // 0 = Domingo, 6 = Sábado
    console.log('initVisitas: hoy=', hoy, 'diaIndex=', currentDiaIndex);

    // Event listeners para navegación de días
    document.getElementById('btn-dia-prev').addEventListener('click', () => cambiarDia(-1));
    document.getElementById('btn-dia-next').addEventListener('click', () => cambiarDia(1));

    // Botón guardar visitas
    document.getElementById('btn-guardar-visitas').addEventListener('click', guardarVisitas);

    // Actualizar display del día
    actualizarDisplayDia();

    // Cargar clientes (mock por ahora, se cargará de Google Sheets)
    cargarClientesDelDia();
}

function cambiarDia(direccion) {
    currentDiaIndex = (currentDiaIndex + direccion + 7) % 7;
    actualizarDisplayDia();
    cargarClientesDelDia();
}

function actualizarDisplayDia() {
    const hoy = new Date();
    // Calcular fecha del día seleccionado (basado en la semana actual)
    const diaActual = hoy.getDay();
    const diferencia = currentDiaIndex - diaActual;
    const fechaSeleccionada = new Date(hoy);
    fechaSeleccionada.setDate(hoy.getDate() + diferencia);

    document.getElementById('dia-nombre').textContent = DIAS_SEMANA[currentDiaIndex];
    document.getElementById('dia-fecha').textContent = formatearFechaCorta(fechaSeleccionada);
}

function cargarClientesDelDia() {
    const diaCorto = DIAS_CORTOS[currentDiaIndex];

    // Si supabaseClient está disponible, cargar desde ahí
    if (supabaseClient && telegramUserId) {
        cargarClientesDesdesupabaseClient();
        return;
    }

    // Datos de ejemplo solo para modo desarrollo
    const clientesEjemplo = {
        'LUN': [
            { codigo: 'C001', nombre: 'Tienda La Esquina' },
            { codigo: 'C002', nombre: 'Abarrotes Don Pedro' }
        ],
        'MAR': [
            { codigo: 'C003', nombre: 'Bodega Central' }
        ],
        'MIE': [],
        'JUE': [],
        'VIE': [],
        'SAB': [],
        'DOM': []
    };

    clientesDelDia = clientesEjemplo[diaCorto] || [];
    renderizarClientes();
}

// Cargar clientes desde supabaseClient
async function cargarClientesDesdesupabaseClient() {
    try {
        const diaCorto = DIAS_CORTOS[currentDiaIndex];

        console.log('Cargando clientes para:', telegramUserId, 'día:', diaCorto);

        clientesDelDia = await getClientesRuta(telegramUserId, diaCorto);

        console.log('Clientes cargados:', clientesDelDia);

        renderizarClientes();
    } catch (error) {
        console.error('Error cargando clientes:', error);
        clientesDelDia = [];
        renderizarClientes();
    }
}

function renderizarClientes() {
    const container = document.getElementById('clientes-list');
    const emptyState = document.getElementById('visitas-empty');

    container.innerHTML = '';

    if (clientesDelDia.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
    } else {
        container.style.display = 'flex';
        emptyState.style.display = 'none';

        clientesDelDia.forEach((cliente, index) => {
            const div = document.createElement('div');
            div.className = 'cliente-row';
            div.dataset.index = index;
            div.innerHTML = `
                <label class="cliente-checkbox">
                    <input type="checkbox" class="visita-check" data-codigo="${cliente.codigo}">
                    <span class="checkmark"></span>
                </label>
                <div class="cliente-info">
                    <span class="cliente-codigo">${cliente.codigo}</span>
                    <span class="cliente-nombre">${cliente.nombre}</span>
                </div>
            `;

            container.appendChild(div);

            // Event listener para el checkbox
            const checkbox = div.querySelector('.visita-check');
            checkbox.addEventListener('change', () => {
                div.classList.toggle('checked', checkbox.checked);
                actualizarContadorVisitas();
            });

            // Click en la fila completa también marca/desmarca
            div.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                    div.classList.toggle('checked', checkbox.checked);
                    actualizarContadorVisitas();
                }
            });
        });
    }

    actualizarContadorVisitas();
}

function actualizarContadorVisitas() {
    const checkboxes = document.querySelectorAll('.visita-check');
    const total = checkboxes.length;
    const visitados = document.querySelectorAll('.visita-check:checked').length;

    document.getElementById('visitas-count').textContent = visitados;
    document.getElementById('visitas-total').textContent = total;

    // Actualizar barra de progreso
    const porcentaje = total > 0 ? (visitados / total) * 100 : 0;
    document.getElementById('progress-bar').style.width = `${porcentaje}%`;
}

async function guardarVisitas() {
    if (!supabaseClient || !telegramUserId) {
        alert('Error: No se pudo conectar con la base de datos');
        return;
    }

    const hoy = new Date();
    const fechaStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    const visitas = [];
    document.querySelectorAll('.cliente-row').forEach(row => {
        const checkbox = row.querySelector('.visita-check');
        const codigo = checkbox.dataset.codigo;
        const nombre = row.querySelector('.cliente-nombre').textContent;

        visitas.push({
            codigo,
            nombre,
            visito: checkbox.checked
        });
    });

    const visitasData = {
        telegram_id: telegramUserId,
        fecha: fechaStr,
        dia_programado: DIAS_CORTOS[currentDiaIndex],
        dia_real: DIAS_CORTOS[hoy.getDay()],
        visitas: visitas
    };

    console.log('Visitas a guardar:', visitasData);

    try {
        await guardarHistorialVisitas(visitasData);

        if (tg) {
            tg.showAlert('¡Visitas guardadas correctamente!');
        } else {
            alert('¡Visitas guardadas correctamente!');
        }
    } catch (error) {
        console.error('Error guardando visitas:', error);
        alert('Error al guardar visitas.');
    }
}

// ===== Money Formatting =====
function formatMoney(value) {
    if (isNaN(value) || value === '') return '0,00';
    const num = parseFloat(value);
    return num.toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function parseMoney(str) {
    if (!str || str === '') return 0;
    const cleanStr = String(str)
        .replace(/\./g, '')
        .replace(',', '.');
    return parseFloat(cleanStr) || 0;
}

function handleMoneyInput(input) {
    let value = input.value.replace(/[^\d,]/g, '');
    const parts = value.split(',');
    if (parts.length > 2) {
        value = parts[0] + ',' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1].length > 2) {
        value = parts[0] + ',' + parts[1].slice(0, 2);
    }
    input.value = value;
}

// ===== Event Listeners =====
function initEventListeners() {
    // Escuchar cambio de fecha
    document.getElementById('fecha').addEventListener('change', (e) => {
        cambiarDia(new Date(e.target.value));
        cargarArqueoExistente(); // Recargar datos al cambiar fecha
    });

    // Botones de acción manual (Modo Desarrollo / Fallback)
    document.getElementById('btn-enviar').addEventListener('click', enviarArqueo);
    document.getElementById('btn-guardar-visitas').addEventListener('click', guardarVisitas);

    const moneyInputs = ['venta-bruta', 'descuentos', 'efectivo-entregado', 'qr-entregado'];
    moneyInputs.forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('input', (e) => {
            handleMoneyInput(e.target);
            calcularTodo();
        });
        input.addEventListener('blur', (e) => {
            if (e.target.value) {
                e.target.value = formatMoney(parseMoney(e.target.value));
            }
        });
    });

    // Event listeners para gastos fijos (Combustible, Peaje)
    document.querySelectorAll('.gasto-row .gasto-input').forEach(input => {
        input.addEventListener('input', (e) => {
            handleMoneyInput(e.target);
            calcularTodo();
        });
        input.addEventListener('blur', (e) => {
            if (e.target.value) {
                e.target.value = formatMoney(parseMoney(e.target.value));
            }
        });
    });

    document.getElementById('btn-add-credito').addEventListener('click', () => addCreditoRow());
    document.getElementById('btn-add-gasto').addEventListener('click', () => addGastoRow());
    document.getElementById('btn-enviar').addEventListener('click', enviarArqueo);
}

// ===== Créditos =====
// ===== Créditos =====
function addCreditoRow(data = {}) {
    const tbody = document.getElementById('creditos-body');
    const id = ++creditoIdCounter;
    const isLocked = data.locked || false;

    const tr = document.createElement('tr');
    tr.dataset.creditoId = id;
    tr.classList.toggle('locked-row', isLocked);

    // Generar opciones del SELECT con clientes habilitados
    let opcionesClientes = '';
    if (clientesRutaCredito.length === 0) {
        opcionesClientes = '<option value="" disabled>⚠️ No hay clientes habilitados para crédito</option>';
    } else {
        opcionesClientes = clientesRutaCredito.map(c =>
            `<option value="${c.codigo}" ${data.codigo === c.codigo ? 'selected' : ''}>${c.codigo} - ${c.nombre}</option>`
        ).join('');
    }

    tr.innerHTML = `
        <td>
            ${isLocked ?
            `<input type="text" class="codigo-input readonly" value="${data.codigo || ''}" readonly>` :
            `<select class="codigo-select">
                    <option value="">Seleccionar cliente...</option>
                    ${opcionesClientes}
                </select>`
        }
        </td>
        <td>
            <input type="text" 
                   class="saldo-input readonly" 
                   value="${formatMoney(data.saldo || 0)}" 
                   readonly>
        </td>
        <td>
            <input type="text" 
                   class="cobrado-input ${isLocked ? 'readonly' : ''}" 
                   inputmode="decimal"
                   value="${data.cobrado ? formatMoney(data.cobrado) : ''}" 
                   placeholder="0,00"
                   ${isLocked ? 'readonly' : ''}>
        </td>
        <td>
            <input type="text" 
                   class="venta-credito-input ${isLocked ? 'readonly' : ''}" 
                   inputmode="decimal"
                   value="${data.ventaCredito ? formatMoney(data.ventaCredito) : ''}" 
                   placeholder="0,00"
                   ${isLocked ? 'readonly' : ''}>
        </td>
        <td>
            ${isLocked ? '<span class="locked-icon">🔒</span>' : '<button type="button" class="btn-remove">×</button>'}
        </td>
    `;

    tbody.appendChild(tr);

    if (!isLocked) {
        const codigoSelect = tr.querySelector('.codigo-select');
        const saldoInput = tr.querySelector('.saldo-input');
        const cobradoInput = tr.querySelector('.cobrado-input');
        const ventaCreditoInput = tr.querySelector('.venta-credito-input');
        const removeBtn = tr.querySelector('.btn-remove');

        // Listener para selección de cliente
        codigoSelect.addEventListener('change', (e) => {
            const codigo = e.target.value;
            if (codigo) {
                // 1. Validar duplicados en la tabla actual
                const filas = document.querySelectorAll('#creditos-body tr');
                let duplicado = false;
                filas.forEach(fila => {
                    const select = fila.querySelector('.codigo-select');
                    if (fila !== tr && select && select.value === codigo) {
                        duplicado = true;
                    }
                });

                if (duplicado) {
                    alert('Este cliente ya está en la lista');
                    e.target.value = '';
                    saldoInput.value = formatMoney(0);
                    return;
                }

                // 2. Buscar saldo del cliente en clientesConDeuda
                const cliente = clientesConDeuda.find(c => String(c.codigo) === codigo);
                if (cliente) {
                    saldoInput.value = formatMoney(cliente.saldo);
                } else {
                    saldoInput.value = formatMoney(0); // Cliente sin deuda
                }
            } else {
                saldoInput.value = formatMoney(0);
            }
        });

        [cobradoInput, ventaCreditoInput].forEach(input => {
            input.addEventListener('input', (e) => {
                handleMoneyInput(e.target);
                calcularTodo();
            });
            input.addEventListener('blur', (e) => {
                if (e.target.value) {
                    e.target.value = formatMoney(parseMoney(e.target.value));
                }
            });
        });

        removeBtn.addEventListener('click', () => {
            tr.remove();
            calcularTodo();
        });
    }
}

// Actualizar selects de crédito existentes con los clientes cargados
function actualizarSelectsCredito() {
    const selects = document.querySelectorAll('.codigo-select');
    let opciones = '';

    if (clientesRutaCredito.length === 0) {
        opciones = '<option value="" disabled>⚠️ No hay clientes habilitados para crédito</option>';
    } else {
        opciones = '<option value="">Seleccionar cliente...</option>' +
            clientesRutaCredito.map(c =>
                `<option value="${c.codigo}">${c.codigo} - ${c.nombre}</option>`
            ).join('');
    }

    selects.forEach(select => {
        // Preservar valor seleccionado si existe
        const valorActual = select.value;
        const indexSeleccionado = select.selectedIndex;

        // Solo actualizar si estaba vacío o con mensaje de error, o si queremos refrescar la lista completa
        // Pero para simplificar y asegurar consistencia, regeneramos todo y re-asignamos valor
        select.innerHTML = opciones;

        if (valorActual) {
            select.value = valorActual;
        }
    });

    console.log(`Selects de crédito actualizados: ${selects.length}`);
}

function getCreditosData() {
    const rows = document.querySelectorAll('#creditos-body tr');
    const creditos = [];

    rows.forEach(row => {
        // Obtener código del SELECT o del INPUT (para filas bloqueadas)
        const selectEl = row.querySelector('.codigo-select');
        const inputEl = row.querySelector('.codigo-input');
        const codigo = selectEl ? selectEl.value : (inputEl ? inputEl.value : '');

        const saldo = parseMoney(row.querySelector('.saldo-input').value);
        const cobrado = parseMoney(row.querySelector('.cobrado-input').value);
        const ventaCredito = parseMoney(row.querySelector('.venta-credito-input').value);

        if (codigo || cobrado > 0 || ventaCredito > 0) {
            creditos.push({ codigo, saldo, cobrado, ventaCredito });
        }
    });

    return creditos;
}

// ===== Gastos =====
function addGastoRow() {
    const container = document.getElementById('gastos-container');
    const id = ++gastoIdCounter;

    const div = document.createElement('div');
    div.className = 'gasto-row';
    div.dataset.gastoId = id;
    div.innerHTML = `
        < input type = "text" class="gasto-nombre" placeholder = "Nombre del gasto" style = "
    flex: 1;
    background: var(--bg - input);
    border: 1px solid var(--border - color);
    border - radius: 8px;
    padding: 12px;
    color: var(--text - primary);
    font - size: 0.95rem;
    ">
        < div class="input-money" >
            <input type="text" class="gasto-input" inputmode="decimal" placeholder="0,00">
            <span class="currency">Bs</span>
        </div>
        <button type="button" class="btn-remove-gasto">×</button>
    `;

    container.appendChild(div);

    const moneyInput = div.querySelector('.gasto-input');
    moneyInput.addEventListener('input', (e) => {
        handleMoneyInput(e.target);
        calcularTodo();
    });
    moneyInput.addEventListener('blur', (e) => {
        if (e.target.value) {
            e.target.value = formatMoney(parseMoney(e.target.value));
        }
    });

    div.querySelector('.btn-remove-gasto').addEventListener('click', () => {
        div.remove();
        calcularTodo();
    });
}

function getGastosData() {
    const rows = document.querySelectorAll('.gasto-row');
    const gastos = [];

    rows.forEach(row => {
        const nombreEl = row.querySelector('.gasto-nombre');
        const nombre = nombreEl ? nombreEl.value : row.querySelector('label')?.textContent || row.dataset.gasto;
        const monto = parseMoney(row.querySelector('.gasto-input').value);

        if (monto > 0) {
            gastos.push({ nombre, monto });
        }
    });

    return gastos;
}

// ===== Cálculos =====
function calcularTodo() {
    const ventaBruta = parseMoney(document.getElementById('venta-bruta').value);
    const descuentos = parseMoney(document.getElementById('descuentos').value);
    const ventaTotal = ventaBruta - descuentos;

    document.getElementById('venta-total').textContent = formatMoney(ventaTotal);

    let totalSaldo = 0;
    let totalCobrado = 0;
    let totalVentaCredito = 0;

    document.querySelectorAll('#creditos-body tr').forEach(row => {
        totalSaldo += parseMoney(row.querySelector('.saldo-input').value);
        totalCobrado += parseMoney(row.querySelector('.cobrado-input').value);
        totalVentaCredito += parseMoney(row.querySelector('.venta-credito-input').value);
    });

    document.getElementById('total-saldo').textContent = formatMoney(totalSaldo);
    document.getElementById('total-cobrado').textContent = formatMoney(totalCobrado);
    document.getElementById('total-venta-credito').textContent = formatMoney(totalVentaCredito);

    let totalGastos = 0;
    document.querySelectorAll('.gasto-input').forEach(input => {
        totalGastos += parseMoney(input.value);
    });

    document.getElementById('total-gastos').textContent = formatMoney(totalGastos);

    const totalEfectivo = ventaTotal + totalCobrado - totalVentaCredito - totalGastos;
    document.getElementById('total-efectivo').textContent = formatMoney(totalEfectivo) + ' Bs';

    const efectivoEntregado = parseMoney(document.getElementById('efectivo-entregado').value);
    const qrEntregado = parseMoney(document.getElementById('qr-entregado').value);
    const totalEntregado = efectivoEntregado + qrEntregado;

    const diferencia = totalEntregado - totalEfectivo;
    const diferenciaBox = document.getElementById('diferencia-box');
    const diferenciaEl = document.getElementById('diferencia');

    diferenciaEl.textContent = formatMoney(Math.abs(diferencia)) + ' Bs';

    diferenciaBox.classList.remove('positive', 'negative');
    if (diferencia > 0.01) {
        diferenciaBox.classList.add('positive');
        diferenciaEl.textContent = '+' + diferenciaEl.textContent;
    } else if (diferencia < -0.01) {
        diferenciaBox.classList.add('negative');
        diferenciaEl.textContent = '-' + formatMoney(Math.abs(diferencia)) + ' Bs';
    }
}

// ===== Enviar Arqueo (supabaseClient) =====
async function enviarArqueo() {
    console.log('enviarArqueo llamado');
    console.log('supabaseClient:', supabaseClient);
    console.log('telegramUserId:', telegramUserId);

    if (!supabaseClient) {
        alert('Error: supabaseClient no está inicializado. Recarga la página.');
        return;
    }

    if (!telegramUserId) {
        alert('Error: No se pudo obtener el ID del usuario');
        return;
    }

    const fechaInput = document.getElementById('fecha').value; // YYYY-MM-DD

    const arqueoData = {
        telegram_id: telegramUserId,
        fecha: fechaInput,
        dia_semana: document.getElementById('dia-semana').textContent,
        venta_bruta: parseMoney(document.getElementById('venta-bruta').value),
        descuentos: parseMoney(document.getElementById('descuentos').value),
        venta_total: parseMoney(document.getElementById('venta-total').textContent),
        total_cobrado: parseMoney(document.getElementById('total-cobrado').textContent),
        total_venta_credito: parseMoney(document.getElementById('total-venta-credito').textContent),
        total_gastos: parseMoney(document.getElementById('total-gastos').textContent),
        total_efectivo: parseMoney(document.getElementById('total-efectivo').textContent),
        efectivo_entregado: parseMoney(document.getElementById('efectivo-entregado').value),
        qr_entregado: parseMoney(document.getElementById('qr-entregado').value),
        diferencia: parseMoney(document.getElementById('diferencia').textContent)
    };

    if (arqueoData.venta_bruta <= 0) {
        alert('Por favor ingrese la Venta Bruta');
        return;
    }

    console.log('Datos a enviar:', arqueoData);

    try {
        // 1. Guardar/actualizar arqueo principal
        const arqueoGuardado = await upsertArqueo(arqueoData);
        console.log('Arqueo guardado:', arqueoGuardado);

        // 2. Guardar créditos
        const creditosData = getCreditosData();
        await guardarCreditos(arqueoGuardado.id, creditosData);

        // 3. Actualizar saldos de clientes
        for (const credito of creditosData) {
            if (credito.codigo) {
                const nuevoSaldo = (credito.saldo || 0) - (credito.cobrado || 0) + (credito.ventaCredito || 0);
                await actualizarSaldoCliente(credito.codigo, credito.codigo, nuevoSaldo);
            }
        }

        // 4. Guardar gastos
        const gastosData = getGastosData();
        await guardarGastos(arqueoGuardado.id, gastosData);

        // Éxito
        if (tg) {
            tg.showAlert('¡Arqueo guardado correctamente!', () => {
                tg.close();
            });
        } else {
            alert('¡Arqueo guardado correctamente!');
        }
    } catch (error) {
        console.error('Error guardando arqueo:', error);
        alert('Error al guardar. Por favor intente nuevamente.');
    }
}

// ===== CSV Upload para Ruta =====
let rutasParsedas = []; // Almacena los registros parseados del CSV

const DIAS_MAP_UPLOAD = {
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

function initRutaUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const csvInput = document.getElementById('csv-input');
    const btnSelectFile = document.getElementById('btn-select-file');
    const btnRemoveFile = document.getElementById('btn-remove-file');
    const btnGuardarRuta = document.getElementById('btn-guardar-ruta');

    // Click en zona de upload
    uploadZone.addEventListener('click', () => csvInput.click());
    btnSelectFile.addEventListener('click', (e) => {
        e.stopPropagation();
        csvInput.click();
    });

    // Arrastrar y soltar
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.csv')) {
            procesarArchivoCSV(files[0]);
        }
    });

    // Selección de archivo
    csvInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            procesarArchivoCSV(e.target.files[0]);
        }
    });

    // Remover archivo
    btnRemoveFile.addEventListener('click', () => {
        resetUpload();
    });

    // Guardar ruta
    btnGuardarRuta.addEventListener('click', () => {
        guardarRutaVendedor();
    });
}

function procesarArchivoCSV(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        const contenido = e.target.result;
        const registros = parsearCSVRuta(contenido);

        rutasParsedas = registros;

        // Mostrar nombre del archivo
        document.getElementById('file-info').style.display = 'flex';
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('upload-zone').style.display = 'none';

        // Mostrar preview
        mostrarPreviewRuta(registros);
    };

    reader.readAsText(file);
}

function parsearCSVRuta(contenido) {
    const lineas = contenido.split('\n');
    const registros = [];
    const duplicadosCheck = new Set();

    // Saltar primera línea (header)
    for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        if (!linea) continue;

        const valores = linea.split(',');
        if (valores.length < 5) continue;

        const diaEspanol = (valores[0] || '').toLowerCase().trim();
        const diaCorto = DIAS_MAP_UPLOAD[diaEspanol];
        if (!diaCorto) continue;

        const titulo = (valores[4] || '').trim();
        const { codigo, nombre } = parsearTituloCliente(titulo);
        if (!nombre) continue;

        const codigoFinal = codigo || `AUTO_${i}`;
        const key = `${diaCorto}-${codigoFinal}`;

        if (duplicadosCheck.has(key)) continue;
        duplicadosCheck.add(key);

        registros.push({
            dia_semana: diaCorto,
            codigo_cliente: codigoFinal,
            nombre_cliente: nombre
        });
    }

    return registros;
}

function parsearTituloCliente(titulo) {
    if (!titulo) return { codigo: null, nombre: '' };
    titulo = titulo.trim();
    const match = titulo.match(/^(\d{4})\s+(.+)$/);
    if (match) {
        return { codigo: match[1], nombre: match[2].trim() };
    }
    return { codigo: null, nombre: titulo };
}

function mostrarPreviewRuta(registros) {
    const previewSection = document.getElementById('preview-section');
    const submitContainer = document.getElementById('submit-ruta-container');
    const tbody = document.getElementById('preview-tbody');

    // Estadísticas
    const diasUnicos = new Set(registros.map(r => r.dia_semana));
    document.getElementById('preview-total').textContent = registros.length;
    document.getElementById('preview-dias').textContent = diasUnicos.size;

    // Tabla de preview (máximo 50 filas)
    tbody.innerHTML = '';
    const maxRows = Math.min(registros.length, 50);
    for (let i = 0; i < maxRows; i++) {
        const r = registros[i];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.dia_semana}</td>
            <td>${r.codigo_cliente}</td>
            <td>${r.nombre_cliente}</td>
        `;
        tbody.appendChild(tr);
    }

    if (registros.length > 50) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3" style="text-align:center; color:var(--text-muted)">... y ${registros.length - 50} más</td>`;
        tbody.appendChild(tr);
    }

    previewSection.style.display = 'block';
    submitContainer.style.display = 'block';
}

function resetUpload() {
    rutasParsedas = [];
    document.getElementById('csv-input').value = '';
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('upload-zone').style.display = 'block';
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('submit-ruta-container').style.display = 'none';
    document.getElementById('result-message').style.display = 'none';
}

async function guardarRutaVendedor() {
    if (!supabaseClient || !telegramUserId) {
        alert('Error: No se pudo conectar con la base de datos');
        return;
    }

    if (rutasParsedas.length === 0) {
        alert('No hay datos para guardar');
        return;
    }

    const resultMessage = document.getElementById('result-message');
    const btnGuardar = document.getElementById('btn-guardar-ruta');

    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
        const result = await reemplazarRutaVendedor(telegramUserId, rutasParsedas);

        resultMessage.className = 'result-message success';
        resultMessage.textContent = `✅ ¡Ruta actualizada! ${result.count} clientes guardados.`;
        resultMessage.style.display = 'block';

        // Limpiar después de éxito
        setTimeout(() => {
            resetUpload();
        }, 3000);
    } catch (error) {
        resultMessage.className = 'result-message error';
        resultMessage.textContent = '❌ Error al guardar. Intente nuevamente.';
        resultMessage.style.display = 'block';
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = '🔄 Actualizar Mi Ruta';
    }
}

// Inicializar upload cuando se carga la página (agregar a DOMContentLoaded)
