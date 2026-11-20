# MENSURA — test cognitivo e informe psicométrico

Página web autocontenida (HTML + CSS + JavaScript, sin dependencias, sin servidor y sin conexión) que aplica un test de seis dominios, lo cronometra, estima tu habilidad con un modelo de teoría de respuesta al ítem y genera un informe con CI estimado, percentil, intervalo de confianza, perfil por dominio y revisión razonada de cada respuesta.

## Cómo abrirla

1. Abre `index.html` con doble clic en Chrome, Edge o Firefox.
2. Elige nivel (Rápido, Completo o Extremo) y pulsa **Comenzar**.
3. Al terminar verás el informe. Puedes descargarlo en PDF con el botón correspondiente (usa el diálogo de impresión del navegador).

No necesita instalación, servidor local ni conexión a internet.

## Qué incluye

- **42 ítems** en el modo completo (49 en Extremo), más una palabra de recuerdo demorado y ensayos de amplitud de dígitos inversa.
- **Seis dominios**: razonamiento abstracto (matrices 3×3), numérico, lógica deductiva, verbal, visualización espacial y memoria de trabajo.
- **Temporizador por ítem** con anillo de cuenta atrás y avance automático al agotarse.
- **Orden aleatorio** de las preguntas y de las opciones en cada intento.
- **Informe**: CI estimado, percentil, IC 95 %, fiabilidad, error típico, curva de distribución, radar por dominio, barras, análisis de tiempos y revisión de respuestas con explicación.
- **Sin guardado del test en curso**: si sales o recargas, el intento se descarta y el test vuelve a empezar.
- **Historial privado opcional**: los resultados que decidas guardar se cifran con un PIN en tu navegador. Solo se abren tocando **«© 2026 MENSURA»** en el pie de página y escribiendo el PIN.
- **Sin red**: no se envía nada a ningún servidor. Todo ocurre en tu navegador.

## Niveles

| Nivel | Ítems | Tiempo por ítem | Duración aproximada |
|---|---|---|---|
| Rápido | 18 + memoria | 70 s | 15 min |
| Completo | 42 + memoria | 55 s | 40 min |
| Extremo | 49 + memoria | 30 s | 38 min |

## Cómo se calcula la puntuación

1. Cada ítem tiene parámetros de discriminación (`a`), dificultad (`b`) y acierto por azar (`c`).
2. La probabilidad de acertar se modela con una curva logística de tres parámetros:

   `P(acierto | θ) = c + (1 − c) / (1 + e^(−a·(θ − b)))`

3. La habilidad `θ` se estima por **EAP** (media a posteriori esperada) con una distribución previa normal estándar.
4. El CI se obtiene con la transformación de desviación: `CI = 100 + 15·θ`.
5. El error típico de `θ` produce el intervalo del 95 %: `θ ± 1,96·SE(θ)`; la fiabilidad estimada es `1 − SE²`.

## Historial privado

Al terminar un test puedes pulsar **«Guardar resultado»** en el informe. La primera vez te pedirá crear un PIN de 4–8 dígitos; a partir de ahí los resultados se guardan cifrados con AES-256-GCM y PBKDF2 en el almacenamiento local del navegador.

- Se abren desde el pie de página, tocando **«© 2026 MENSURA»** (no hay ningún botón visible de historial).
- Cada visita pide el PIN; el PIN no se guarda en ningún sitio.
- Los datos son privados de este navegador: no se sincronizan entre dispositivos y desaparecen si borras los datos del sitio.
- Si olvidas el PIN, no hay recuperación posible.
- Puedes exportar el historial a JSON (sin cifrar) o eliminar resultados concretos.

## Qué significa y qué no

- La media es 100 y la desviación típica 15, como en la escala de CI de desviación de Wechsler.
- **No es un test clínico.** Un CI diagnóstico requiere administración individual, baremos por edad, condiciones controladas y un profesional habilitado.
- Los parámetros de los ítems están calibrados **a priori** por dificultad y formato; no proceden de una muestra normativa propia. Por eso el resultado es una estimación fundamentada, no un baremo clínico.
- El resultado depende del sueño, la fatiga, la práctica previa, la pantalla y el tiempo. El intervalo de confianza no es decorativo: expresa cuánto puede moverse la puntuación por error de medida.
- No existe un «test de CI oficial de Harvard». Las universidades investigan y enseñan psicometría; los tests clínicos comerciales se administran individualmente.

## Estructura

```
index.html                  · estructura de la página
assets/styles.css           · estilos base
assets/theme-light.css      · tema claro (blanco, tinta e índigo)
assets/items.js             · banco de ítems y generadores SVG
assets/app.js               · motor del test, puntuación e informe
```

Los ítems de matrices y de rotación espacial se generan en SVG con reglas verificables (matrices latinas, rotación, suma exclusiva y rotaciones con espejos), de modo que la respuesta correcta y sus distractores son coherentes por construcción.

## Fuentes

- APA. (2018). *IQ*. APA Dictionary of Psychology. <https://dictionary.apa.org/iq>
- MIT OpenCourseWare. (2011). *Intelligence* (9.00SC Introduction to Psychology). <https://ocw.mit.edu/courses/9-00sc-introduction-to-psychology-fall-2011/pages/intelligence/>
- OpenStax. (2020). *Psychology 2e*, §7.5 Measures of Intelligence. <https://openstax.org/books/psychology-2e/pages/7-5-measures-of-intelligence>
- AERA, APA & NCME. (2014). *Standards for Educational and Psychological Testing*. <https://www.apa.org/science/programs/testing/standards>
- Baker, F. B. (2001). *The Basics of Item Response Theory*. ERIC. <https://eric.ed.gov/?id=ED458219>
- Wechsler, D. (1939). *The Measurement of Adult Intelligence*. Williams & Wilkins.

---

Herramienta de entretenimiento y autoconocimiento. No sustituye una evaluación psicológica profesional.
