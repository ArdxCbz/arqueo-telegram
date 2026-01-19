// Supabase Configuration
const SUPABASE_URL = 'https://pftngeppuaoobsbnssje.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmdG5nZXBwdWFvb2JzYm5zc2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3ODIxNDUsImV4cCI6MjA4NDM1ODE0NX0.JyU-aFgZRXrt0By-m5tkc4d3FQRrBeKfAp1d8GuJgKU';

// Initialize Supabase client
// Note: supabase-js is loaded via CDN in index.html
let supabase = null;

function initSupabase() {
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase inicializado correctamente');
        return true;
    } else {
        console.error('Supabase library not loaded');
        return false;
    }
}

// ===== Arqueos =====

// Obtener arqueo del día
async function getArqueoDelDia(telegramId, fecha) {
    const { data, error } = await supabase
        .from('arqueos')
        .select(`
            *,
            creditos (*),
            gastos (*)
        `)
        .eq('telegram_id', telegramId)
        .eq('fecha', fecha)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error obteniendo arqueo:', error);
        return null;
    }

    return data;
}

// Guardar o actualizar arqueo
async function upsertArqueo(arqueoData) {
    const { data, error } = await supabase
        .from('arqueos')
        .upsert(arqueoData, {
            onConflict: 'telegram_id,fecha',
            returning: 'representation'
        })
        .select()
        .single();

    if (error) {
        console.error('Error guardando arqueo:', error);
        throw error;
    }

    return data;
}

// Guardar créditos de un arqueo
async function guardarCreditos(arqueoId, creditos) {
    // Primero eliminar créditos anteriores de este arqueo
    await supabase
        .from('creditos')
        .delete()
        .eq('arqueo_id', arqueoId);

    // Insertar nuevos créditos
    if (creditos && creditos.length > 0) {
        const creditosConArqueo = creditos.map(c => ({
            arqueo_id: arqueoId,
            codigo_cliente: c.codigo,
            saldo_anterior: c.saldo || 0,
            cobrado: c.cobrado || 0,
            venta_credito: c.ventaCredito || 0,
            saldo_nuevo: (c.saldo || 0) - (c.cobrado || 0) + (c.ventaCredito || 0)
        }));

        const { error } = await supabase
            .from('creditos')
            .insert(creditosConArqueo);

        if (error) {
            console.error('Error guardando créditos:', error);
            throw error;
        }
    }
}

// Guardar gastos de un arqueo
async function guardarGastos(arqueoId, gastos) {
    // Primero eliminar gastos anteriores de este arqueo
    await supabase
        .from('gastos')
        .delete()
        .eq('arqueo_id', arqueoId);

    // Insertar nuevos gastos
    if (gastos && gastos.length > 0) {
        const gastosConArqueo = gastos.map(g => ({
            arqueo_id: arqueoId,
            concepto: g.nombre,
            monto: g.monto || 0
        }));

        const { error } = await supabase
            .from('gastos')
            .insert(gastosConArqueo);

        if (error) {
            console.error('Error guardando gastos:', error);
            throw error;
        }
    }
}

// ===== Clientes =====

// Obtener clientes con saldo pendiente
async function getClientesConDeuda() {
    const { data, error } = await supabase
        .from('clientes')
        .select('codigo, nombre, saldo')
        .gt('saldo', 0);

    if (error) {
        console.error('Error obteniendo clientes:', error);
        return [];
    }

    return data || [];
}

// Actualizar saldo de cliente
async function actualizarSaldoCliente(codigo, nombre, nuevoSaldo) {
    const { error } = await supabase
        .from('clientes')
        .upsert({
            codigo: codigo,
            nombre: nombre,
            saldo: nuevoSaldo
        }, {
            onConflict: 'codigo'
        });

    if (error) {
        console.error('Error actualizando cliente:', error);
        throw error;
    }
}

// ===== Rutas/Visitas =====

// Obtener clientes de ruta por día
async function getClientesRuta(telegramId, diaSemana) {
    const { data, error } = await supabase
        .from('rutas')
        .select('codigo_cliente, nombre_cliente')
        .eq('telegram_id', telegramId)
        .eq('dia_semana', diaSemana);

    if (error) {
        console.error('Error obteniendo ruta:', error);
        return [];
    }

    return (data || []).map(r => ({
        codigo: r.codigo_cliente,
        nombre: r.nombre_cliente
    }));
}

// Guardar historial de visitas
async function guardarHistorialVisitas(visitasData) {
    const { error } = await supabase
        .from('historial_visitas')
        .upsert(visitasData, {
            onConflict: 'telegram_id,fecha'
        });

    if (error) {
        console.error('Error guardando visitas:', error);
        throw error;
    }
}

// ===== Vendedores =====

// Obtener o crear vendedor
async function getOrCreateVendedor(telegramId, nombre) {
    // Intentar obtener vendedor existente
    let { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

    if (error && error.code === 'PGRST116') {
        // No existe, crear nuevo
        const { data: newVendedor, error: insertError } = await supabase
            .from('vendedores')
            .insert({
                telegram_id: telegramId,
                nombre: nombre
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error creando vendedor:', insertError);
            return null;
        }

        return newVendedor;
    }

    if (error) {
        console.error('Error obteniendo vendedor:', error);
        return null;
    }

    return data;
}
