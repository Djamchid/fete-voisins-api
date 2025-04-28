/**
 * API Client pour La Fête des Voisins
 * Ce script permet de communiquer avec l'API Google Apps Script
 * sans utiliser d'iframes (ce qui évite les problèmes de CSP)
 */

// Configuration
const API_URL = 'https://script.google.com/macros/s/AKfycbwQQxPHrQxXm4Rx1NItu0Ejcj0BNE032zwrStBU7_zcV40VY0trPwk2CBKZN7gQ5Zp0fA/exec';
const DEBUG = false; // Activer pour voir les logs détaillés

/**
 * Classe principale pour gérer les interactions avec l'API
 */
class FeteVoisinsApiClient {
  constructor() {
    this.csrfToken = null;
    this.lastError = null;
    this.isInitialized = false;
    
    // Initialiser l'API
    this.init();
  }

  /**
   * Initialise l'API en récupérant un jeton CSRF
   */
  async init() {
    try {
      if (DEBUG) console.log('Initialisation de l\'API...');
      
      // Récupérer un jeton CSRF
      await this.refreshCsrfToken();
      
      this.isInitialized = true;
      
      if (DEBUG) console.log('API initialisée avec succès');
      
      // Déclencher un événement pour signaler que l'API est prête
      document.dispatchEvent(new CustomEvent('fete-voisins-api-ready'));
      
      return true;
    } catch (error) {
      this.lastError = error.message || 'Erreur d\'initialisation';
      console.error('Erreur lors de l\'initialisation de l\'API:', error);
      
      // Déclencher un événement pour signaler que l'API a échoué
      document.dispatchEvent(new CustomEvent('fete-voisins-api-error', { 
        detail: { error: this.lastError } 
      }));
      
      return false;
    }
  }

  /**
   * Rafraîchit le jeton CSRF
   */
  async refreshCsrfToken() {
    try {
      const response = await this.makeRequest('GET', {
        origin: window.location.origin
      });
      
      if (response && response.csrfToken) {
        this.csrfToken = response.csrfToken;
        return true;
      }
      
      throw new Error('Pas de jeton CSRF dans la réponse');
    } catch (error) {
      this.lastError = 'Erreur de rafraîchissement du jeton: ' + (error.message || 'Erreur inconnue');
      console.error('Erreur lors du rafraîchissement du jeton CSRF:', error);
      throw error;
    }
  }

  /**
   * Effectue une requête vers l'API
   * @param {string} method - Méthode HTTP (GET ou POST)
   * @param {Object} params - Paramètres pour la requête GET
   * @param {Object} data - Données pour la requête POST
   * @returns {Promise<Object>} - Réponse JSON de l'API
   */
  async makeRequest(method, params = {}, data = null) {
    try {
      // Construire l'URL avec les paramètres
      const url = new URL(API_URL);
      
      // Ajouter l'origine aux paramètres si elle n'est pas déjà présente
      if (!params.origin) {
        params.origin = window.location.origin;
      }
      
      // Ajouter les paramètres à l'URL
      Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
      });
      
      if (DEBUG) console.log(`Requête ${method} vers ${url}`);
      
      // Options de la requête
      const options = {
        method: method,
        headers: {
          'User-Agent': 'FeteVoisinsClient/1.0'
        },
        mode: 'cors',
        credentials: 'omit'
      };
      
      // Ajouter le corps pour les requêtes POST
      if (method === 'POST' && data) {
        // Ajouter le jeton CSRF et l'origine aux données
        data.csrfToken = this.csrfToken;
        data.origin = window.location.origin;
        
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
        
        if (DEBUG) console.log('POST data:', data);
      }
      
      // Effectuer la requête
      const response = await fetch(url.toString(), options);
      
      // Vérifier le statut de la réponse
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }
      
      // Analyser la réponse JSON
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('Réponse non-JSON reçue:', responseText);
        throw new Error('Format de réponse invalide');
      }
      
      if (DEBUG) console.log('Réponse de l\'API:', responseData);
      
      // Mettre à jour le jeton CSRF si présent dans la réponse
      if (responseData.newCsrfToken) {
        this.csrfToken = responseData.newCsrfToken;
        if (DEBUG) console.log('Nouveau jeton CSRF reçu');
      } else if (responseData.csrfToken) {
        this.csrfToken = responseData.csrfToken;
        if (DEBUG) console.log('Jeton CSRF reçu');
      }
      
      // Gérer les erreurs dans la réponse
      if (responseData.result === 'error') {
        this.lastError = responseData.error || 'Erreur inconnue';
        throw new Error(this.lastError);
      }
      
      return responseData;
    } catch (error) {
      this.lastError = error.message || 'Erreur de communication';
      console.error(`Erreur lors de la requête ${method}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les données des contributions
   * @returns {Promise<Array>} - Liste des contributions
   */
  async getContributions() {
    try {
      if (!this.isInitialized) {
        await this.init();
      }
      
      const response = await this.makeRequest('GET', {
        action: 'getData'
      });
      
      if (response && response.result === 'success' && Array.isArray(response.data)) {
        return response.data;
      }
      
      throw new Error('Format de données invalide');
    } catch (error) {
      this.lastError = 'Erreur lors de la récupération des contributions: ' + (error.message || 'Erreur inconnue');
      console.error('Erreur lors de la récupération des contributions:', error);
      throw error;
    }
  }

  /**
   * Envoie une contribution
   * @param {Object} formData - Données du formulaire
   * @returns {Promise<Object>} - Réponse de l'API
   */
  async submitContribution(formData) {
    try {
      if (!this.isInitialized) {
        await this.init();
      }
      
      // Valider les données avant l'envoi
      this.validateFormData(formData);
      
      const response = await this.makeRequest('POST', {}, formData);
      
      // Vérifier si le jeton CSRF était invalide et réessayer une fois
      if (response.error && response.error.includes('jeton invalide')) {
        if (DEBUG) console.log('Jeton CSRF invalide, rafraîchissement et nouvel essai...');
        
        await this.refreshCsrfToken();
        return this.makeRequest('POST', {}, formData);
      }
      
      return response;
    } catch (error) {
      this.lastError = 'Erreur lors de l\'envoi de la contribution: ' + (error.message || 'Erreur inconnue');
      console.error('Erreur lors de l\'envoi de la contribution:', error);
      throw error;
    }
  }

  /**
   * Valide les données du formulaire
   * @param {Object} data - Données à valider
   * @throws {Error} - Erreur si les données sont invalides
   */
  validateFormData(data) {
    if (!data) {
      throw new Error('Aucune donnée fournie');
    }
    
    // Vérifier les champs obligatoires
    const requiredFields = ['nom', 'email', 'categorie', 'detail', 'portions'];
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      throw new Error(`Champs obligatoires manquants: ${missingFields.join(', ')}`);
    }
    
    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Format d\'email invalide');
    }
    
    // Valider la catégorie
    const validCategories = ['sale', 'sucre', 'soft', 'alco'];
    if (!validCategories.includes(data.categorie)) {
      throw new Error('Catégorie invalide');
    }
    
    // Valider le nombre de personnes
    const nbPersonnes = parseInt(data.nbPersonnes);
    if (isNaN(nbPersonnes) || nbPersonnes < 1 || nbPersonnes > 20) {
      throw new Error('Nombre de personnes invalide (doit être entre 1 et 20)');
    }
    
    // Valider le nombre de portions
    const portions = parseInt(data.portions);
    if (isNaN(portions) || portions < 1 || portions > 100) {
      throw new Error('Nombre de portions invalide (doit être entre 1 et 100)');
    }
    
    // Valider le format du téléphone si fourni
    if (data.telephone && data.telephone.trim() !== '') {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(data.telephone)) {
        throw new Error('Format de téléphone invalide (10 chiffres attendus)');
      }
    }
    
    return true;
  }

  /**
   * Récupère la dernière erreur
   * @returns {string|null} - Message d'erreur ou null
   */
  getLastError() {
    return this.lastError;
  }
}

// Créer et exposer l'instance de l'API
window.FeteVoisinsApi = new FeteVoisinsApiClient();

// Pour la compatibilité avec l'ancienne API
window.addEventListener('fetch', event => {
  console.warn('L\'API handleRequest est dépréciée. Utilisez FeteVoisinsApi à la place.');
});
