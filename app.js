// ===== Telegram WebApp Integration =====
const tg = window.Telegram?.WebApp;

// ===== Configuration =====
const GOOGLE_SCRIPT_URL_ARQUEO = 'https://script.google.com/macros/s/AKfycbwreVuOLQt1N36KJDF8oY9Vzc3F0WNAOzg5GIQxyU2nHH5HEOTDY0HB6GcFgJ9eqy9-FA/exec'; // Arqueo
const GOOGLE_SCRIPT_URL_VISITAS = 'https://script.google.com/macros/s/AKfycbzfit8INhfzVrXKKC5aD67dI_emDSL4vSvryc3pacnB1CnsKMzVKTNdBIKPji3nAd2cXA/exec'; // Visitas

// ===== State =====
let creditoIdCounter = 0;
let gastoIdCounter = 0;
let currentTab = 'arqueo';
let currentDiaIndex = 0;
let clientesDelDia = [];
let vendedorUsername = '';

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
    addCreditoRow();
    calcularTodo();
});

// ===== Telegram Integration =====
function initTelegram() {
    if (tg) {
        tg.ready();
        tg.expand();

        // Obtener nombre del usuario de Telegram
        const user = tg.initDataUnsafe?.user;
        vendedorUsername = user?.username || user?.first_name || 'Usuario';
        const nombreCompleto = user ? (user.first_name + (user.last_name ? ' ' + user.last_name : '')) : 'Usuario';

        document.getElementById('vendedor-nombre').textContent = nombreCompleto;
        document.getElementById('vendedor-nombre-visitas').textContent = nombreCompleto;

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
            } else {
                guardarVisitas();
            }
        });
    } else {
        // Modo desarrollo sin Telegram
        vendedorUsername = 'ModoDesarrollo';
        document.getElementById('vendedor-nombre').textContent = 'Modo Desarrollo';
        document.getElementById('vendedor-nombre-visitas').textContent = 'Modo Desarrollo';
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

    // Update Telegram main button
    if (tg) {
        if (tabName === 'arqueo') {
            tg.MainButton.setText('Enviar Arqueo');
        } else {
            tg.MainButton.setText('Guardar Visitas');
        }
    }
}

// ===== Fecha =====
function initFecha() {
    const fechaInput = document.getElementById('fecha');
    const hoy = new Date();

    fechaInput.valueAsDate = hoy;
    actualizarDiaSemana(hoy);

    fechaInput.addEventListener('change', (e) => {
        const fecha = new Date(e.target.value + 'T12:00:00');
        actualizarDiaSemana(fecha);
    });
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

// ===== Visitas =====
function initVisitas() {
    const hoy = new Date();
    currentDiaIndex = hoy.getDay(); // 0 = Domingo, 6 = Sábado

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
    // Por ahora usamos datos de ejemplo
    // En producción esto vendrá de Google Sheets
    const diaCorto = DIAS_CORTOS[currentDiaIndex];

    // Datos de ejemplo para demostración
    const clientesEjemplo = {
        'LUN': [
            { codigo: 'C001', nombre: 'Tienda La Esquina' },
            { codigo: 'C002', nombre: 'Abarrotes Don Pedro' },
            { codigo: 'C003', nombre: 'Minimarket Sol' }
        ],
        'MAR': [
            { codigo: 'C004', nombre: 'Bodega Central' },
            { codigo: 'C005', nombre: 'Distribuidora Norte' }
        ],
        'MIE': [
            { codigo: 'C006', nombre: 'Super Familiar' },
            { codigo: 'C007', nombre: 'Tienda Express' },
            { codigo: 'C008', nombre: 'Comercial Sur' }
        ],
        'JUE': [
            { codigo: 'C009', nombre: 'Mayorista ABC' }
        ],
        'VIE': [
            { codigo: 'C010', nombre: 'Minimarket Luna' },
            { codigo: 'C011', nombre: 'Abarrotes El Sol' }
        ],
        'SAB': [],
        'DOM': []
    };

    clientesDelDia = clientesEjemplo[diaCorto] || [];
    renderizarClientes();
}

// En producción, esta función cargará desde Google Sheets:
async function cargarClientesDesdeSheets() {
    if (GOOGLE_SCRIPT_URL_VISITAS === 'YOUR_GOOGLE_SCRIPT_URL_VISITAS_HERE') {
        return; // Modo desarrollo
    }

    try {
        const diaCorto = DIAS_CORTOS[currentDiaIndex];
        const url = `${GOOGLE_SCRIPT_URL_VISITAS}?action=clientes&vendedor=${encodeURIComponent(vendedorUsername)}&dia=${diaCorto}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            clientesDelDia = data.clientes;
            renderizarClientes();
        }
    } catch (error) {
        console.error('Error cargando clientes:', error);
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
    const hoy = new Date();
    const diaActual = hoy.getDay();
    const diferencia = currentDiaIndex - diaActual;
    const fechaSeleccionada = new Date(hoy);
    fechaSeleccionada.setDate(hoy.getDate() + diferencia);

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

    const datos = {
        vendedor: vendedorUsername,
        fecha: formatearFechaCorta(fechaSeleccionada),
        diaProgramado: DIAS_CORTOS[currentDiaIndex],
        diaReal: DIAS_CORTOS[hoy.getDay()],
        visitas: visitas,
        timestamp: new Date().toISOString(),
        telegramUserId: tg?.initDataUnsafe?.user?.id || null
    };

    console.log('Visitas a guardar:', datos);

    if (GOOGLE_SCRIPT_URL_VISITAS !== 'YOUR_GOOGLE_SCRIPT_URL_VISITAS_HERE') {
        try {
            await fetch(GOOGLE_SCRIPT_URL_VISITAS, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });

            if (tg) {
                tg.showAlert('¡Visitas guardadas correctamente!');
            } else {
                alert('¡Visitas guardadas correctamente!');
            }
        } catch (error) {
            console.error('Error al guardar visitas:', error);
            alert('Error al guardar las visitas. Intente nuevamente.');
        }
    } else {
        alert('Modo desarrollo: Los datos de visitas se imprimieron en consola.');
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

    document.getElementById('btn-add-credito').addEventListener('click', () => addCreditoRow());
    document.getElementById('btn-add-gasto').addEventListener('click', () => addGastoRow());
    document.getElementById('btn-enviar').addEventListener('click', enviarArqueo);
}

// ===== Créditos =====
function addCreditoRow(data = {}) {
    const tbody = document.getElementById('creditos-body');
    const id = ++creditoIdCounter;
    const isLocked = data.locked || false;

    const tr = document.createElement('tr');
    tr.dataset.creditoId = id;
    tr.innerHTML = `
        <td>
            <input type="text" 
                   class="codigo-input ${isLocked ? 'readonly' : ''}" 
                   value="${data.codigo || ''}" 
                   placeholder="COD"
                   ${isLocked ? 'readonly' : ''}>
        </td>
        <td>
            <input type="text" 
                   class="saldo-input readonly" 
                   value="${formatMoney(data.saldo || 0)}" 
                   readonly>
        </td>
        <td>
            <input type="text" 
                   class="cobrado-input" 
                   inputmode="decimal"
                   value="${data.cobrado ? formatMoney(data.cobrado) : ''}" 
                   placeholder="0,00">
        </td>
        <td>
            <input type="text" 
                   class="venta-credito-input" 
                   inputmode="decimal"
                   value="${data.ventaCredito ? formatMoney(data.ventaCredito) : ''}" 
                   placeholder="0,00">
        </td>
        <td>
            <button type="button" class="btn-remove ${isLocked ? 'locked' : ''}" 
                    ${isLocked ? 'disabled' : ''}>×</button>
        </td>
    `;

    tbody.appendChild(tr);

    const cobradoInput = tr.querySelector('.cobrado-input');
    const ventaCreditoInput = tr.querySelector('.venta-credito-input');
    const removeBtn = tr.querySelector('.btn-remove');

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

    if (!isLocked) {
        removeBtn.addEventListener('click', () => {
            tr.remove();
            calcularTodo();
        });
    }
}

function getCreditosData() {
    const rows = document.querySelectorAll('#creditos-body tr');
    const creditos = [];

    rows.forEach(row => {
        const codigo = row.querySelector('.codigo-input').value;
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
        <input type="text" class="gasto-nombre" placeholder="Nombre del gasto" style="
            flex: 1;
            background: var(--bg-input);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 12px;
            color: var(--text-primary);
            font-size: 0.95rem;
        ">
        <div class="input-money">
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

// ===== Enviar Arqueo =====
async function enviarArqueo() {
    const datos = {
        vendedor: document.getElementById('vendedor-nombre').textContent,
        fecha: formatearFecha(document.getElementById('fecha').value),
        dia: document.getElementById('dia-semana').textContent,
        ventaBruta: parseMoney(document.getElementById('venta-bruta').value),
        descuentos: parseMoney(document.getElementById('descuentos').value),
        ventaTotal: parseMoney(document.getElementById('venta-total').textContent),
        creditos: getCreditosData(),
        totalCobrado: parseMoney(document.getElementById('total-cobrado').textContent),
        totalVentaCredito: parseMoney(document.getElementById('total-venta-credito').textContent),
        gastos: getGastosData(),
        totalGastos: parseMoney(document.getElementById('total-gastos').textContent),
        totalEfectivo: parseMoney(document.getElementById('total-efectivo').textContent),
        efectivoEntregado: parseMoney(document.getElementById('efectivo-entregado').value),
        qrEntregado: parseMoney(document.getElementById('qr-entregado').value),
        diferencia: parseMoney(document.getElementById('diferencia').textContent),
        timestamp: getTimestampLocal(),
        telegramUserId: tg?.initDataUnsafe?.user?.id || null
    };

    if (datos.ventaBruta <= 0) {
        alert('Por favor ingrese la Venta Bruta');
        return;
    }

    console.log('Datos a enviar:', datos);

    if (GOOGLE_SCRIPT_URL_ARQUEO !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        try {
            // Con mode: 'no-cors' no podemos leer la respuesta del servidor
            // pero la solicitud se envía correctamente
            await fetch(GOOGLE_SCRIPT_URL_ARQUEO, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(datos)
            });

            // Con no-cors, asumimos éxito si no hubo error de red
            if (tg) {
                tg.showAlert('¡Arqueo enviado correctamente!', () => {
                    tg.close();
                });
            } else {
                alert('¡Arqueo enviado correctamente!');
            }
        } catch (error) {
            console.error('Error de red al enviar:', error);
            alert('Error de conexión. Verifique su internet e intente nuevamente.');
        }
    } else {
        alert('Modo desarrollo: Los datos se imprimieron en consola.\n\nConfigura GOOGLE_SCRIPT_URL para enviar a Google Sheets.');
    }
}
