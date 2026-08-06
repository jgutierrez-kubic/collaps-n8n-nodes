# COLLAPS Nodes #10 y #11

`npm run build` → **exit code 0**

## #10 COLLAPS Ingest Mapper

- **Input:** Column Selector (`schema`, `tableName`, `columns`) vía hidden expressions.
- **UI:** `fixedCollection` con:
  - `propiedad` (loadOptions desde columnas upstream)
  - `rol` (llave_humana, atributo, requisito, …)
  - `ordenLlave` (number)
  - `formatoEntrada` (texto, numero, si_no, lista)
  - `reglaLimpieza` (loadOptions → `public.reglas_limpieza`)
  - `unidadEsperada`, `parametro`, `guardar`
- **Output camelCase:**

```json
{
  "schemaName": "...",
  "sourceTable": "...",
  "targetTable": "a_2_config",
  "configRows": [
    {
      "propiedad": "...",
      "rol": "...",
      "ordenLlave": 0,
      "formatoEntrada": "texto",
      "reglaLimpieza": "...",
      "unidadEsperada": "",
      "parametro": "",
      "guardar": true
    }
  ]
}
```

## #11 COLLAPS Refiner Trigger

- **UI:** Schema + Source Table (loadOptions vía DB Connection defaults)
- **`callbackUrl` opcional** → si vacío usa `$execution.resumeUrl`
- **POST** `.../api/v1/catalyst/job` con `{ source, schemaName, sourceTable, callbackUrl }`
- **Devuelve** `{ request, response }` (HTTP 202); el Wait de n8n va después

## Cadena sugerida

```
Column Selector → Ingest Mapper → (insert a_2_config) → Refiner Trigger → Wait
```

Registrados en `package.json`. Recarga el paquete en n8n para verlos.
