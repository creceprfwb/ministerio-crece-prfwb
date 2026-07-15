# Ministerio CRECE PRFWB

Aplicacion web responsive para registrar asistencia y manejar clases del Ministerio CRECE de la Puerto Rico Free Will Baptist Association.

## Estructura

```text
/
├── index.html
├── asistencia.html
├── maestro.html
├── biblioteca.html
├── clase-ninos.html
├── clase-juveniles.html
├── admin.html
├── clases-originales/
│   ├── ninos/
│   └── juveniles/
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── maestro.js
│   ├── biblioteca.js
│   ├── firebase.js
│   └── admin.js
└── assets/
    ├── logo.png
    └── background.jpg
```

## Como abrir

Abre `index.html` directamente en el navegador o usa la extension Live Server de Visual Studio Code.


## Flujo principal

1. La maestra entra a `maestro.html`.
2. Registra al estudiante con nombre y edad.
3. El sistema asigna el grupo automaticamente:
   - 3-10 años: Niños.
   - 11-16 años: Juveniles.
4. El sistema genera un numero de estudiante y un codigo QR.
5. En cada clase, la maestra o lider escanea el QR o escribe el numero en `asistencia.html`.
6. La fecha y hora se guardan automaticamente.
7. El sistema redirige a la clase correspondiente.

## Panel de maestra

Abre `maestro.html`.

Desde ahi puedes:

- Registrar estudiantes.
- Asignar grupo automaticamente por edad.
- Crear numero unico.
- Generar codigo QR.
- Descargar el QR como imagen.
- Buscar estudiantes registrados.
- Publicar la clase de la semana.
- Agregar titulo, versiculo, objetivo, resumen, inicio dinamico, materiales, recurso visual, dinamica, aplicacion, preguntas, reto semanal y notas para la maestra.

## Modulo de clases

Las paginas `clase-ninos.html` y `clase-juveniles.html` muestran contenido dinamico.

Para preparar una clase:

1. Entra a `biblioteca.html`.
2. Selecciona el grupo.
3. Selecciona la clase por fecha.
4. Presiona **Editar clase** si necesitas hacer cambios.
5. Revisa y ajusta el texto para que quede claro y bonito sin cambiar su esencia.
6. Agrega o mejora la dinamica, recurso visual, aplicacion, reto semanal y preguntas.
7. Presiona **Publicar clase**.
8. Usa **Ver o imprimir clase seleccionada** para abrir la version imprimible.

La biblioteca generada incluye 94 lecciones enriquecidas:

- 47 para Niños.
- 47 para Juveniles.

## Panel administrativo

Abre `admin.html`.

Requiere login. El primer usuario que registra una iglesia queda como administrador de esa iglesia.

El panel incluye:

- Total de asistentes.
- Total de estudiantes registrados.
- Asistencia por grupo.
- Historial.
- Busqueda de estudiante.
- Exportacion a Excel.
- Exportacion a PDF.
- Grafica por grupo.

## Data compartida por iglesia con Firebase

La app funciona de dos maneras:

- Sin configurar Firebase: usa `localStorage`, o sea, la data queda solo en ese navegador.
- Con Firebase configurado: cada iglesia entra con su login y su data queda separada por `churchId`.

Para activar la data compartida:

1. Entra a https://console.firebase.google.com
2. Crea un proyecto.
3. Activa **Authentication**.
4. En **Sign-in method**, activa **Email/Password**.
5. Activa **Firestore Database**.
6. Registra una app Web.
7. Copia el objeto `firebaseConfig`.
8. Pegalo en `js/firebase.js`, reemplazando los valores que empiezan con `TU_`.

Paginas de acceso:

- `registro-iglesia.html`: crea una iglesia y su primer usuario administrador.
- `login.html`: entrada de una iglesia ya registrada.

Estructura usada en Firestore:

- `churches/{churchId}`: datos principales de la iglesia.
- `churches/{churchId}/students`: estudiantes de esa iglesia.
- `churches/{churchId}/attendance`: asistencia de esa iglesia.
- `churches/{churchId}/lessons`: clases publicadas de esa iglesia.
- `users/{uid}`: perfil del usuario, iglesia asignada y rol.

Importante: no publiques datos reales de menores con reglas abiertas. Usa reglas privadas antes de publicar.

Reglas recomendadas para produccion:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function hasProfile() {
      return signedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function belongsToChurch(churchId) {
      return hasProfile()
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.churchId == churchId;
    }

    match /churches/{churchId} {
      allow create: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid;
      allow read, update: if belongsToChurch(churchId);

      match /{collectionName}/{docId} {
        allow read, write: if belongsToChurch(churchId);
      }
    }

    match /users/{userId} {
      allow create: if signedIn()
        && request.auth.uid == userId
        && get(/databases/$(database)/documents/churches/$(request.resource.data.churchId)).data.ownerUid == request.auth.uid;
      allow read: if signedIn() && request.auth.uid == userId;
      allow update: if signedIn()
        && request.auth.uid == userId
        && request.resource.data.churchId == resource.data.churchId
        && request.resource.data.role == resource.data.role;
    }
  }
}
```

## Integracion con Wix

Este proyecto no depende del editor de Wix. Puedes integrarlo de tres maneras:

- Publicarlo en un subdominio, por ejemplo `escuela.tudominio.com`.
- Agregar un boton en Wix que abra la aplicacion.
- Insertarlo en Wix con un iframe.

## Proximas mejoras recomendadas

- Pantalla para que el administrador agregue mas maestras a su iglesia.
- Evitar asistencia duplicada por estudiante y fecha.
- Escaneo avanzado de QR con camara en todos los dispositivos.
- Reportes automaticos por semana y mes.
- Panel de contenido para cargar clases.
