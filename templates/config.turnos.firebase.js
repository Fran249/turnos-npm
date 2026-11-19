// Generado por `npx turnos init --firebase` (turnos v0.1.0).
// 1) Instala:  npm i firebase
// 2) Reemplaza la config por la de TU proyecto (Firebase console →
//    Project settings → Your apps). NUNCA subas credenciales reales al repo:
//    para apps públicas usa solo las keys web (apiKey/appId).
// 3) Publica las reglas:  firebase deploy --only firestore:rules
import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection, getDocs, getDoc, query, where, onSnapshot,
  doc, deleteDoc, setDoc, updateDoc, runTransaction,
} from 'firebase/firestore'
import { createClient } from 'turnos'

const app = initializeApp({
  apiKey: 'TU_API_KEY',
  authDomain: 'TU_PROYECTO.firebaseapp.com',
  projectId: 'TU_PROYECTO',
  storageBucket: 'TU_PROYECTO.appspot.com',
  appId: 'TU_APP_ID',
})

// Cliente del paquete `turnos` — mismo contrato para todos los proveedores:
// listTurnos / upsertTurno / removeTurno / bookTurno / unbookTurno / subscribe
export const turnos = createClient({
  provider: 'firebase',
  firebase: {
    db: getFirestore(app),
    // El paquete `turnos` no empaqueta el SDK: el config generado inyecta
    // las funciones de Firestore para que el adaptador no dependa de nada.
    sdk: { collection, getDocs, getDoc, query, where, onSnapshot, doc, deleteDoc, setDoc, updateDoc, runTransaction },
    collectionName: 'turnos',
  },
})
