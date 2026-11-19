# @ffstack/turnos

Turnero instalable por npm: componentes de React para que un **usuario elija un turno** y un **administrador controle los turnos**, sobre **Firebase (Firestore)** o **Supabase**, con un adaptador **memoria** para demos y tests.

[![npm](https://img.shields.io/npm/v/@ffstack/turnos)](https://www.npmjs.com/package/@ffstack/turnos)
[![GitHub](https://img.shields.io/badge/GitHub-Fran249%2Fturnos--react-blue)](https://github.com/Fran249/turnos-react)

## Instalación rápida (Recomendado)

Configura todo tu proyecto (componentes, base de datos y dependencias) con un solo comando:

```bash
npx @ffstack/turnos init
```

Este comando interactivo:
1. Te preguntará qué base de datos quieres usar (**Firebase**, **Supabase** o **Memoria/Demo**).
2. Generará los componentes `TurnoPicker` y `TurnoAdmin` en tu carpeta `src/turnos/`.
3. Instalará automáticamente las dependencias necesarias (`@supabase/supabase-js`, `firebase`, etc.).
4. Creará un archivo `.env.example` con las variables de entorno requeridas.

---

## Qué genera `turnos` en tu proyecto:

| Archivo | Para qué |
|---|---|
| `src/turnos/TurnoPicker.jsx` | Componente del usuario: ve los turnos del día y elige uno |
| `src/turnos/TurnoAdmin.jsx` | Componente del administrador: crea, cambia estado y elimina turnos |
| `src/turnos/turnos.css` | Estilos autónomos: talones con perforación y registro rayado. |
| `src/turnos/turnos.config.js` | Config de tu proveedor + cliente `turnos` |
| `firestore.rules` *(firebase)* | Reglas Firestore: lectura pública, escritura de admin |
| `supabase-migrations/0001_turnos.sql` *(supabase)* | Tabla `public.turnos`, RLS y RPC `book_turno` atómico |

## Uso

```jsx
import { turnos } from './src/turnos/turnos.config'
import TurnoPicker from './src/turnos/TurnoPicker'

function App() {
  return (
    <TurnoPicker 
      adapter={turnos} 
      user="id-del-usuario" 
      onBooked={(turn) => console.log('Turno reservado:', turn)}
    />
  )
}
```

## Adaptadores y Proveedores

- **Firebase**: Usa Firestore con transacciones para asegurar la capacidad de los turnos.
- **Supabase**: Usa Postgres con Row Level Security y funciones RPC atómicas.
- **Memoria (Demo)**: Ideal para prototipos. Permite visualizar el turnero sin base de datos, bloqueando las reservas hasta que se configure un proveedor real.

## Personalización (CSS)

El componente hereda la fuente y colores de tu app por defecto. Puedes personalizarlo sobreescribiendo estos tokens:

```css
.turnos {
  --turnos-bg: #faf7f1;
  --turnos-primary-bg: #221a12;
  --turnos-accent: #3f5a2f;
  --turnos-radius: 12px;
}
```

Licencia MIT. Hecho por [@ffstack](https://github.com/Fran249).
