import * as firebaseApp from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- GUIA DE INTEGRAÇÃO ---
// 1. Acesse https://console.firebase.google.com/
// 2. Clique no seu projeto "Lielson Tattoo Studio"
// 3. Clique no ícone de engrenagem (Configurações do projeto) -> Geral
// 4. Role até "Seus aplicativos" e copie os valores do objeto "firebaseConfig"
// 5. Substitua os valores abaixo mantendo as aspas.

const firebaseConfig = {
  // Exemplo: apiKey: "AIzaSyDOC..."
  apiKey: "AIzaSyBzcA_HwOb4VB7ft8GwHSUXEge4AZe9ny4",
  
  // Exemplo: authDomain: "lielson-tattoo.firebaseapp.com"
  authDomain: "lielson-tattoo-studio.firebaseapp.com",
  
  // Exemplo: projectId: "lielson-tattoo"
  projectId: "lielson-tattoo-studio",
  
  // Exemplo: storageBucket: "lielson-tattoo.appspot.com"
  storageBucket: "lielson-tattoo-studio.firebasestorage.app",
  
  // Exemplo: messagingSenderId: "123456789"
  messagingSenderId: "819003867808",
  
  // Exemplo: appId: "1:123456789:web:abcdef"
  appId: "819003867808:web:647168afee2dca0c55bfc5I"
};

// Inicializa a conexão
const app = firebaseApp.initializeApp(firebaseConfig);

// Exporta o banco de dados para ser usado no storageService.ts
export const db = getFirestore(app);