# 📱 Telegram Mini App - Arqueo y Cobros de Créditos

Aplicación para registro de arqueos diarios y control de visitas de vendedores.

## 🚀 Deploy Rápido

### Paso 1: Subir a GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/arqueo-telegram.git
git push -u origin main
```

En GitHub: **Settings** → **Pages** → Source: **main** / **root** → Save

Tu URL será: `https://TU_USUARIO.github.io/arqueo-telegram/`

---

### Paso 2: Configurar Google Sheets

#### Libro 1: ARQUEO
1. Crear Google Sheets nuevo
2. **Extensiones → Apps Script** → Pegar `google-apps-script/Code.gs`
3. **Arqueos → Inicializar Hojas** (menú)
4. **Implementar → Nueva implementación → Aplicación web**
5. Copiar URL del script

#### Libro 2: VISITAS
1. Crear otro Google Sheets llamado "RUTAS"
2. Crear una hoja por vendedor (nombre = username de Telegram)
3. Columnas en cada hoja: `Día | Código | Nombre`
4. **Extensiones → Apps Script** → Pegar `google-apps-script/CodeVisitas.gs`
5. **Visitas → Inicializar Hojas** (menú)
6. Implementar como aplicación web

---

### Paso 3: Conectar Frontend con Backend

Editar `app.js` líneas 5-6:
```javascript
const GOOGLE_SCRIPT_URL_ARQUEO = 'https://script.google.com/...';
const GOOGLE_SCRIPT_URL_VISITAS = 'https://script.google.com/...';
```

---

### Paso 4: Crear Bot de Telegram

1. Hablar con **@BotFather** → `/newbot`
2. **Bot Settings → Menu Button → Configure**
3. Ingresar URL de GitHub Pages

---

## 📁 Estructura

```
├── index.html              # Página principal (2 tabs)
├── styles.css              # Estilos (tema oscuro)
├── app.js                  # Lógica de ambos formularios
├── google-apps-script/
│   ├── Code.gs             # Backend Arqueo
│   └── CodeVisitas.gs      # Backend Visitas
└── README.md
```

## 📊 Hojas de Google Sheets

### Libro ARQUEO
| Hoja | Propósito |
|------|-----------|
| Arqueos | Registros principales |
| Creditos | Detalle créditos |
| Gastos | Detalle gastos |
| Clientes | Maestro saldos |

### Libro RUTAS
| Hoja | Propósito |
|------|-----------|
| [Username] | Clientes por día del vendedor |
| Historial | Registro de visitas realizadas |

## 🧪 Probar Localmente

Abrir `index.html` en Chrome. Usa las flechas ◄ ► para cambiar de día en Visitas.
