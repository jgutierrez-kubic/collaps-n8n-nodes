# Suite `collaps-n8n-nodes` — Resumen de nodos

## Cadena típica de análisis (Condenser)

```
Db Connection → Schema Fetcher → Table Selector → Column Selector (×4)
      → Key & Column Mapper → Method Configurator
      → BTTF Trigger (2 inputs) → [Wait] → Sync Visores (sub-workflow)
```

## Cadena típica de ingest / refinado (Catalizador)

```
Db Connection → Schema Fetcher → Table Selector → Column Selector
      → Ingest Mapper → (persist a_2_config) → Refiner Trigger → [Wait]
```

Opcional: `Work Table Generator` y `Data Watcher` como satélites.

---

## Nodos

### 1. COLLAPS Database Connection

Valida la conexión a PostgreSQL (host/port/db/user/password) y emite el contexto de conexión aguas abajo. Es el punto de entrada de credenciales.

### 2. COLLAPS Schema Fetcher

Consulta schemas reales en Postgres y deja elegir uno (`selectedSchema`). Emite `{ schema: "s00001_..." }`.

### 3. COLLAPS Table Selector

Lee el schema upstream, lista tablas y deja elegir una. Emite `{ schema, tableName }`.

### 4. COLLAPS Column Selector

Lee schema + tableName, lista columnas y deja seleccionar un subconjunto. Emite `{ schema, tableName, columns: [...] }`.

En el flujo de cruce se usan **4 instancias**: Key A, Columns A, Key B, Columns B.

### 5. COLLAPS Key & Column Mapper

4 inputs: Key A / Columns A / Key B / Columns B.

Arma el cruce (llaves + pares de columnas) y emite `bttfPayload` + `column_pairs`.

La UI de mapeo usa expresiones ocultas (bypass del sandbox Temp-Node).

### 6. COLLAPS Method Configurator

Asigna métodos de cálculo (global o per-pair) del catálogo `collaps_engine`.

Fallback de pares sin método: `strict_equal`.

Emite `metodos_calculo` (CSV alineado 1:1 con `columnas_a`).

### 7. COLLAPS BTTF Trigger

Orquestador HTTP puro (sin escribir a Postgres):

- Input 0: Structure (Mapper)
- Input 1: Methods (Configurator)

Construye payload **camelCase** (`tableA`, `joinKeyA`, `calculationMethods`, `targetTable` vía `c_results_<camelCase>`, `callbackUrl` desde `$execution.resumeUrl`) y hace POST a Cloud Run (`/api/v1/condenser/job`).

### 8. COLLAPS Work Table Generator

Pide crear una tabla de trabajo derivada: elige lado A/B, nombre amigable → `w_table_<camelCase>`, group by / order by como CSV, y POST a `/api/v1/worktables/create`.

### 9. COLLAPS Data Watcher

Nodo auxiliar de inspección: observa schema/tabla upstream (útil para debug / monitoreo, no es parte del path crítico del Condenser).

### 10. COLLAPS Ingest Mapper

Recibe el output del Column Selector y arma filas de configuración para `a_2_config` (propiedad, rol, ordenLlave, formatoEntrada, reglaLimpieza, unidadEsperada, parametro, guardar). Emite JSON camelCase listo para insert.

### 11. COLLAPS Refiner Trigger

Dispara el job asíncrono del Catalizador (`POST /api/v1/catalyst/job`) con `schemaName`, `sourceTable` y `callbackUrl` (auto `$execution.resumeUrl` si el campo queda vacío). Devuelve HTTP 202; usar nodo Wait después para reanudar.

---

## Extra (no es custom node)

**Sync Visores (NocoDB / Directus)** — workflow utilitario en `workflows/` que fuerza refresh de CMS tras el análisis (HTTP paralelo con timeout/retry).

---

## Regla de arquitectura

n8n orquesta y arma contratos; el motor Python en Cloud Run hace el trabajo pesado y la persistencia.
