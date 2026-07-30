# Integrar Ministerio CRECE con Wix gratis

La forma mas simple y gratis es publicar esta carpeta como un sitio estático y luego enlazarla desde Wix.

## Opcion recomendada: GitHub Pages

GitHub Pages publica sitios estáticos hechos con HTML, CSS y JavaScript directamente desde un repositorio. Es ideal para esta versión porque no requiere servidor.

Pasos:

1. Crea una cuenta gratis en GitHub.
2. Crea un repositorio nuevo, por ejemplo:

```text
ministerio-crece
```

3. Sube el contenido de esta carpeta:

```text
escuela-dominical-prfwb/
```

4. En GitHub, entra a:

```text
Settings > Pages
```

5. En **Build and deployment**, selecciona:

```text
Deploy from a branch
```

6. Selecciona:

```text
main / root
```

7. GitHub te dara un enlace parecido a:

```text
https://TU-USUARIO.github.io/ministerio-crece/
```

Ese enlace se puede poner en Wix.

## Cómo integrarlo en Wix

### Forma mas simple

En Wix:

1. Agrega un botón.
2. Texto del botón:

```text
Ministerio CRECE
```

3. Enlace:

```text
https://TU-USUARIO.github.io/ministerio-crece/
```

4. Configura para abrir en la misma página o en una nueva, según prefieras.

### Como subpágina visual dentro de Wix

Puedes crear una página en Wix llamada:

```text
Ministerio CRECE
```

Luego agrega un **Embed / iframe** con el enlace publicado.

Nota: si usas iframe, la camara para escanear QR puede depender de permisos del navegador y de Wix. Para QR, normalmente es mas confiable abrir la app en su propio enlace.

## Sobre base de datos

La versión actual funciona con `localStorage`, o sea, datos locales del navegador. Sirve para prototipo.

Para uso real con varios dispositivos, el próximo paso gratis seria conectar:

- Firebase free tier
- Supabase free tier
- Google Sheets API

Recomendación: Firebase, porque sirve bien para estudiantes, asistencia y clases.

## Fuentes

- GitHub Pages: https://pages.github.com/
- GitHub Pages docs: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Cloudflare Pages static HTML: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- Netlify Free: https://www.netlify.com/blog/introducing-netlify-free-plan/
