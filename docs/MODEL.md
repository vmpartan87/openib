# The OpenIB interior ballistics model

OpenIB uses a **lumped-parameter (zero-dimensional) model**. The gas in the chamber and bore is described by one mean pressure and one temperature. A pressure gradient between the breech and the bullet base is added with the Lagrange approximation. This is the classical textbook approach (see e.g. Corner, *Theory of the Interior Ballistics of Guns*, 1950, and Carlucci & Jacobson, *Ballistics: Theory and Design of Guns and Ammunition*).

All computation is done in SI units. The code is in [`src/core/model.ts`](../src/core/model.ts).

## Symbols

| Symbol | Meaning | Unit |
|---|---|---|
| ω | charge mass | kg |
| m | bullet mass | kg |
| A | bore area, π/4 · ((d_bore + d_groove)/2)² | m² |
| V₀ | initial empty volume = case capacity − bullet volume inside the case | m³ |
| x, v | bullet travel and velocity | m, m/s |
| Z | burnt fraction of the grain web (0…1) | – |
| ψ | burnt fraction of the charge mass (0…1) | – |
| f | propellant force (impetus), f = R·T₀ | J/kg |
| b | co-volume | m³/kg |
| ρ | propellant solid density | kg/m³ |
| γ, θ | ratio of specific heats, θ = γ − 1 | – |
| B, n | burn-rate coefficient and pressure exponent | 1/s, – |
| p₀ | shot-start pressure | Pa |
| p_r | bore resistance after engraving | Pa |
| h | heat-loss fraction | – |

## Equations

**Form function.** This gives the mass burnt as a function of the web burnt:

    ψ(Z) = χ Z (1 + λZ + μZ²),    with χ(1 + λ + μ) = 1

- A neutral grain (long single-perforated tube) has χ = 1, λ = μ = 0.
- Degressive shapes (balls, flakes) have χ > 1 and λ < 0.
- Progressive shapes have χ < 1 and λ > 0.

**Burn law.** This is Vieille's law applied to the web:

    dZ/dt = B · (p_mean / 1 MPa)^n,   Z ≤ 1

**Free volume available to the gas:**

    V_free = V₀ + A·x − (ω/ρ)(1 − ψ) − b·ω·ψ

**Energy balance.** The internal energy of the gas is:

    U = (1 − h)·f·ω·ψ/θ − ½·m·v²·(1 + ω/(3m)) − A·p_r·x

The term ω/(3m) is the kinetic energy of the gas moving behind the bullet (Lagrange).

**Equation of state (Noble–Abel):**

    p_mean = θ · U / V_free

**Lagrange pressure gradient:**

    p_base   = p_mean / (1 + ω/(3m))
    p_breech = p_base · (1 + ω/(2m))

The reported "chamber pressure" is p_breech. This is closest to what a case-mouth piezo or a strain gauge over the chamber measures.

**Bullet motion.** The bullet starts moving once p_base ≥ p₀:

    m · dv/dt = A · (p_base − p_r),   dx/dt = v

**Ignition.** The primer is modelled as an initial burnt fraction ψ₀ that gives the primer pressure in V₀.

**Integration.** Classic RK4 with a fixed step (default 1·10⁻⁷ s). The muzzle exit is found by linear interpolation inside the final step.

## Outputs

- Max chamber pressure, its time and the bullet travel at that point
- Muzzle velocity, muzzle energy, chamber pressure at exit
- Burnt fraction at exit (ψ at the muzzle)
- Barrel time, from shot start to exit
- Ballistic efficiency = ½mv² / (f·ω/θ)
- Fill ratio = (ω / bulk density) / case capacity

## Validation in the test suite

- **Analytic check.** With instant burning and no losses, the model must reproduce adiabatic expansion of a Noble–Abel gas: U·V_free^θ = const. The test matches to better than 0.5 %.
- **Time-step convergence.** Results at Δt = 1·10⁻⁷ s and 2.5·10⁻⁸ s agree within 0.3 %.
- **Monotonic trends.** Pressure and velocity rise with charge. Pressure rises with deeper seating. Velocity rises with barrel length.
- **Calibration round-trip.** A burn rate used to generate synthetic velocities is recovered within ±2 %.

## Known limitations

These are the reasons predictions can be wrong:

1. **Powder parameters.** The bundled powders are illustrative and do not represent any real product. Real powders vary from lot to lot.
2. **Lumped heat loss.** Heat transfer to the barrel is modelled as a constant fraction of propellant energy. In reality it depends on time, wall area and gas temperature.
3. **No temperature sensitivity** of the burn rate (yet).
4. **No multi-perforated grain sliver phase** and no explicit deterrent-coating layer. Deterred powders are approximated with the form function and absorbed by calibration.
5. **Constant shot-start pressure and bore friction.** Real engraving depends on bullet construction, jacket material, freebore and jump.
6. **Seating intrusion** treats the bullet as a cylinder of bullet diameter. Boat-tails occupy less volume.
7. **Low fill ratios** (< ~75 %) cause position-sensitive, erratic ignition that this model cannot represent.
8. A model that matches measured *velocities* may still be wrong about *pressure*. Velocity calibration does not validate pressure.

## Ideas for improvement

- Temperature coefficient of burn rate
- Convective heat-transfer model (e.g. Nordheim) instead of a constant fraction
- Two-phase burning for 7-perf grains and coated layers
- Pressure-trace import (strain gauge) for two-quantity calibration
- Barrel-time-based tuning (OBT) and barrel-harmonics helpers
