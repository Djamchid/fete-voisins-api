// Configuration
const API_URL = 'https://script.google.com/macros/s/AKfycbx8hiEDN_ncShkzXKoOk79enFAvcH7TP_xV0KmEqtB5dj1hOkL7f4iterT_KT45PHXoGw/exec';
const ALLOWED_ORIGINS = ['https://djamchid.github.io'];
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

// Fonction principale pour traiter les requêtes
async function handleRequest(request) {
  // Vérifier si l'origine est autorisée
  const origin = request.headers.get('Origin');
  
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({
      result: 'error',
      error: 'Origine non autorisée'
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  // Ajouter les en-têtes CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 heures
  };
  
  // Gérer les requêtes OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  // Gérer les requêtes GET
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const params = url.searchParams;
      
      // Construire l'URL avec les paramètres pour Google Apps Script
      const apiUrl = new URL(API_URL);
      for (const [key, value] of params) {
        apiUrl.searchParams.append(key, value);
      }
      
      // Faire la requête à Google Apps Script
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'FeteVoisinsProxy/1.0'
        }
      });
      
      // Lire le corps de la réponse
      const data = await response.text();
      
      // Renvoyer la réponse avec les en-têtes CORS
      return new Response(data, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Erreur lors de la requête GET:', error);
      
      return new Response(JSON.stringify({
        result: 'error',
        error: 'Erreur lors de la communication avec le serveur'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
  
  // Gérer les requêtes POST
  if (request.method === 'POST') {
    try {
      // Vérifier la taille de la charge utile
      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > MAX_PAYLOAD_SIZE) {
        return new Response(JSON.stringify({
          result: 'error',
          error: 'Taille de la requête trop importante'
        }), {
          status: 413,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Obtenir le corps de la requête
      let body;
      const contentType = request.headers.get('Content-Type');
      
      if (contentType && contentType.includes('application/json')) {
        // Récupérer et valider le JSON
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({
            result: 'error',
            error: 'Format JSON invalide'
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      } else {
        // Pour les autres types de contenu, on récupère le texte brut
        body = await request.text();
      }
      
      // Faire la requête à Google Apps Script
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': contentType || 'application/json',
          'User-Agent': 'FeteVoisinsProxy/1.0'
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
      });
      
      // Lire le corps de la réponse
      const data = await response.text();
      
      // Renvoyer la réponse avec les en-têtes CORS
      return new Response(data, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Erreur lors de la requête POST:', error);
      
      return new Response(JSON.stringify({
        result: 'error',
        error: 'Erreur lors de la communication avec le serveur'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
  
  // Si la méthode n'est ni GET, ni POST, ni OPTIONS
  return new Response(JSON.stringify({
    result: 'error',
    error: 'Méthode non supportée'
  }), {
    status: 405,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Allow': 'GET, POST, OPTIONS'
    }
  });
}

// Écouter les requêtes
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
