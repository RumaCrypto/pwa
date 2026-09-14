# Capa base: i18n multilenguaje y monedas configurables

Fecha: 2026-09-12
Estado: aprobado, pendiente de plan de implementación

## Contexto

Existen 11 mockups que describen el producto completo de Ruma: home con carrusel
saldo/tarjeta, envío de dinero internacional, pago con QR, niveles de límites,
tarjeta de débito virtual, y agregar/sacar dinero.

Ese alcance se descompuso en siete subsistemas:

| # | Subsistema | Pantallas | Depende de |
|---|---|---|---|
| 1 | **Capa base** (este spec) | — | — |
| 2 | Home v2 | 1 | 1 |
| 3 | Enviar dinero | 2, 3, 4, 5 | 1, 2 |
| 4 | Pagar con QR | 6, 7, 8, 9 | 1 |
| 5 | Límites y niveles | 10 | 1 |
| 6 | Tarjeta | 11 | 1 |
| 7 | Agregar / Sacar dinero | 12, 13 | 1 |

Este documento cubre **solo el subsistema 1**. Los seis restantes consumen la
capa base en cada pantalla (toda pantalla tiene texto traducible y montos en dos
monedas), por lo que construirla primero evita re-trabajo.

Existe además un documento `SPEC-card-like-spending-demo.md` que corresponde a
los subsistemas 4 y 6. No aplica a este spec.

## Problemas que resuelve

1. **`t()` ignora las variables.** El diccionario ya contiene claves como
   `"onramp.step": "Paso {current} de {total}"` y
   `"withdraw.amount.subtitle": "¿Cuánto quieres recibir en {currency}?"`, pero
   `lib/i18n/i18n-context.tsx` hace una búsqueda plana sin sustitución. Hoy esas
   pantallas imprimen `{current}` literal. Es un bug activo.

2. **No hay portugués.** Solo existen `en.json` y `es.json`.

3. **No hay noción de moneda.** El home hace
   `Number(balance ?? 0).toFixed(2)` y antepone un `$` fijo. No hay conversión,
   ni formato por locale, ni forma de que el usuario elija su moneda.

4. **Aritmética de dinero en punto flotante.** Los mockups muestran
   `$200,00 + $1,20 = $201,20`. En `number` eso produce `201.20000000000002`.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Alcance | Capa base sola, sin los otros subsistemas |
| Modelo de moneda | Dos conceptos separados: moneda de visualización del usuario, y moneda de destino por contacto/país |
| Tasas FX | Mock con interfaz real (`RateProvider`), sustituible por un proveedor sin tocar consumidores |
| Interpolación | Sí, con variables y plurales |
| Catálogo inicial | USD, BRL, COP, MXN, ARS, PEN |
| Formato numérico | Según el idioma del usuario (no según la moneda de destino) |
| Persistencia | `localStorage`, siguiendo el patrón que ya usa el idioma |
| Portugués | Traducción completa de las ~250 claves |
| Tests | Vitest, solo para funciones puras |
| UI mínima | Una ruta `/settings` con selector de idioma y moneda |

### Justificación: formato según idioma, no según moneda

Un usuario con la app en inglés que envía a Brasil ve `R$1,080.00`, no
`R$ 1.080,00`. La alternativa (formatear cada monto según su país de origen)
produce pantallas con dos convenciones decimales simultáneas — el saldo propio
con punto y el del destinatario con coma — lo que se lee como un error.

### Justificación: dinero como `bigint` en unidades menores

`Money` guarda centavos como `bigint`, no un `number` decimal. El costo es
convertir en los bordes (entrada de usuario, salida a `Intl`). El beneficio es
que sumas, restas y conversiones FX no acumulan error. Dado que la pantalla de
revisión de envío muestra explícitamente monto + comisión + total convertido,
el error de punto flotante sería visible para el usuario.

## Arquitectura

Dos módulos, sin rutas nuevas salvo `/settings`:

```
lib/
  i18n/
    dictionaries/
      en.json                  ← fuente de verdad de las claves
      es.json
      pt.json                  ← nuevo
    interpolate.ts             ← nuevo: puro, sin React
    translations.ts            ← + pt, + chequeo de paridad en tipos
    i18n-context.tsx           ← t(key, vars), detección de pt
  money/
    currencies.ts              ← nuevo: catálogo
    money.ts                   ← nuevo: tipo Money + aritmética, puro
    rates.ts                   ← nuevo: RateProvider + mock + useRate
    format.ts                  ← nuevo: Intl, atado al idioma activo
    money-context.tsx          ← nuevo: moneda de visualización
app/
  settings/page.tsx            ← nuevo: selector de idioma y moneda
```

Orden de providers en `providers/app-providers.tsx`:

```
Privy → I18n → Money
```

`Money` va dentro de `I18n` porque el formateo depende del idioma activo.

**Frontera:** `lib/money` no conoce React salvo en `money-context.tsx` y el hook
`useRate`. Todo el cálculo y el formateo son funciones puras, invocables y
testeables sin montar un árbol de componentes.

## Componentes

### `lib/i18n/interpolate.ts`

Función pura. Reemplaza `{nombre}` por el valor correspondiente.

```ts
interpolate("Paso {current} de {total}", { current: 1, total: 3 })
// → "Paso 1 de 3"
```

Una variable presente en la plantilla pero ausente en el objeto se deja tal cual
(`{foo}`), de modo que el texto faltante sea visible en pantalla durante el
desarrollo en vez de desaparecer silenciosamente.

### Plurales

Vía `Intl.PluralRules`, con sufijos en el diccionario:

```json
"activity.sends_one":   "{count} envío",
"activity.sends_other": "{count} envíos"
```

Se invoca con la clave base y un `count`:

```ts
t("activity.sends", { count: 2 })  // → "2 envíos"
```

Los tres idiomas (en, es, pt) solo requieren las categorías `one` y `other`.

`TranslationKey` se deriva de `en.json` quitando los sufijos con un tipo
condicional, de forma que el autocompletado ofrezca `activity.sends` y no sus
variantes internas.

### Paridad de diccionarios

Atrapada por el compilador, sin tests:

```ts
const es: Record<keyof typeof enJson, string> = esJson;
const pt: Record<keyof typeof enJson, string> = ptJson;
```

Una clave faltante en `pt.json` rompe `pnpm build`. Con ~250 claves y tres
idiomas, es la única defensa que escala.

### Detección de idioma

`navigator.language` → `es` | `pt` | `en`, con `en` como fallback. Se respeta el
valor de `localStorage` si existe.

### `lib/money/currencies.ts`

Catálogo con código, símbolo, decimales y países asociados:

| Código | Símbolo | Decimales | Países |
|---|---|---|---|
| USD | $ | 2 | US, EC, PA, SV |
| BRL | R$ | 2 | BR |
| COP | $ | 2 | CO |
| MXN | $ | 2 | MX |
| ARS | $ | 2 | AR |
| PEN | S/ | 2 | PE |

El campo de países existe porque los contactos de los mockups se describen por
país ("Brasil · Pix", "Colombia · Nequi"); el subsistema de envíos resolverá
país → moneda contra esta misma tabla.

### `lib/money/money.ts`

```ts
type Money = { amount: bigint; currency: CurrencyCode }
```

Constructores: desde número decimal, desde string decimal (lo que devuelve
`formatUnits` de viem), y desde unidades menores.

Operaciones: `add`, `sub`, `convert(money, rate, destino)`.

`add` y `sub` lanzan si las monedas no coinciden. Es el propósito de tipar el
dinero: sumar USD con BRL es un error de programación que debe fallar ruidoso.

### `lib/money/rates.ts`

```ts
interface RateProvider {
  getRate(from: CurrencyCode, to: CurrencyCode): Promise<number>
}
```

`mockRateProvider` usa una tabla con base USD. La tasa de BRL es 5,40, igual que
en el mockup de envío. Introduce un retardo pequeño para que los estados de
carga se ejerciten de verdad.

`useRate(from, to)` expone `{ rate, loading, error }`.

Cuando exista un proveedor real, se sustituye esta implementación y ningún
consumidor cambia.

**Fuera de alcance:** el congelamiento de tasa por 15 minutos que muestra el
mockup de envío pertenece al subsistema 3.

### `lib/money/format.ts`

`formatMoney(money, language)` usa `Intl.NumberFormat` con el locale derivado
del idioma activo.

`formatMoneyParts(money, language)` usa `Intl.NumberFormat.prototype.formatToParts`
y devuelve símbolo, parte entera, separador y decimales por separado. Lo requiere
la card del home, que renderiza `$328` en tamaño grande y `,35` reducido.
Partir el string a mano se rompe al cambiar de locale.

El locale exacto para español se valida ejecutando `Intl` durante la
implementación: debe producir coma decimal (`1.080,00`) para coincidir con los
mockups. `es-MX` usa punto decimal y por tanto no sirve.

### `lib/money/money-context.tsx`

Expone `displayCurrency` y `setDisplayCurrency`. Persiste en `localStorage` bajo
`ruma-currency`. El valor inicial se sugiere desde la región de
`navigator.language`, con USD como fallback.

### `app/settings/page.tsx`

Ruta mínima con dos selectores, idioma y moneda, usando las claves `settings.*`
que ya existen en el diccionario (`settings.language`, `settings.currency`,
`settings.selectLanguage`, `settings.selectCurrency`, `settings.done`).

Su propósito es hacer la capa base observable: cambiar el idioma o la moneda ahí
debe reformatear el saldo del home en vivo.

## Flujo de datos

```
navigator.language ─┐
localStorage ───────┴→ I18nProvider ─→ language
                                         │
                                         ├→ t(key, vars) ─→ pantallas
                                         │
                          MoneyProvider ─┴→ formatMoney(money, language)
                                         │
localStorage ──────────────────────────→ displayCurrency
                                         │
viem balanceOf → formatUnits → fromDecimalString → Money(USD)
                                         │
                          useRate(USD, displayCurrency) → convert → Money(local)
```

## Manejo de errores

- **Clave de traducción ausente:** cae a inglés, luego a la clave literal. Es el
  comportamiento actual y se conserva.
- **Variable de interpolación ausente:** se deja el marcador `{foo}` visible.
- **Monedas incompatibles en `add`/`sub`:** lanza. Error de programación.
- **`getRate` falla:** `useRate` expone `error`; los consumidores deciden. El
  mock no falla, pero la interfaz lo contempla para que el proveedor real encaje.
- **`localStorage` no disponible:** se usa el valor detectado en memoria. El
  contexto de idioma actual ya asume que solo se lee tras el montaje.

## Verificación

**Vitest, solo funciones puras.** Sin jsdom ni testing-library.

Cubre:
- Aritmética de `Money`: suma, resta, redondeo, el caso `200,00 + 1,20 = 201,20`.
- `add`/`sub` lanzando con monedas distintas.
- Conversión FX contra las tasas del mock.
- Construcción desde string decimal de viem.
- `interpolate`: sustitución, variable ausente, sin variables.
- Selección de plural en los tres idiomas.

**Compilador:** `pnpm build` falla si a `es.json` o `pt.json` les falta una clave.

**Manual:** cambiar idioma y moneda en `/settings` reformatea el saldo del home
en vivo, en los tres idiomas.

## Fuera de alcance

- Las 11 pantallas de los mockups (subsistemas 2–7).
- Proveedor real de tasas de cambio.
- Congelamiento de tasa por tiempo.
- Backend o sincronización de preferencias con el perfil de Privy.
- Migración a una librería de i18n de terceros.
