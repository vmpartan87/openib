# Data formats

Built-in data lives in `src/data/*.json`. User data is kept in the browser and can be exported as one JSON file (*Library → Export*). Both use the same item shapes, defined in [`src/core/types.ts`](../src/core/types.ts).

Every item has a `source` field: `illustrative`, `published`, `measured`, `calibrated` or `user`.

## Cartridge

```json
{
  "id": "308-win",
  "name": ".308 Winchester",
  "caseLength": 51.18,        // mm, max case length
  "capacityGrH2O": 56.0,      // grains of water to overflow, fired case
  "boreDiameter": 7.62,       // mm
  "grooveDiameter": 7.82,     // mm
  "maxPressureMPa": 415,      // e.g. C.I.P. Pmax
  "defaultCoal": 71.12,       // mm
  "source": "published"
}
```

Case capacity varies by several percent between brass makers. Users should weigh their own fired cases filled with water. Verify maximum pressures against the current C.I.P. TDCC tables or SAAMI standards before relying on the pressure warnings.

## Bullet

```json
{ "id": "308-168-hpbt", "name": ".308 168 gr HPBT match (generic)", "diameter": 7.82, "massGr": 168, "length": 31.2, "source": "illustrative" }
```

## Powder

```json
{
  "id": "example-sb-medium",
  "name": "Example SB-Medium (illustrative, not a real powder)",
  "kind": "single-base",
  "impetus": 1000000,          // J/kg
  "covolume": 0.001,           // m^3/kg
  "gamma": 1.24,
  "density": 1600,             // kg/m^3 solid
  "bulkDensity": 900,          // kg/m^3 loose (fill ratio only)
  "flameTemp": 2900,           // K
  "burnRate": 8.5,             // B in dZ/dt = B·(p/MPa)^n
  "pressureExponent": 0.9,
  "form": { "chi": 1, "lambda": 0, "mu": 0 },
  "source": "illustrative"
}
```

## Contributing powder models

A contributed powder model must come with:

1. The raw measurements: rifle, barrel length, cartridge, case capacity, bullet, COAL, charges, every chronograph velocity, temperature, and pressure traces if you have them.
2. The calibrated parameters, produced with the *Calibrate* tool or your own documented method.
3. A statement that the data is your own and that you release it under the MIT licence.

**Never copy powder parameters from QuickLOAD, GRT databases or any other proprietary source.**
