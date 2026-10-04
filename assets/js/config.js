/* =========================================================
   CONFIGURACIÓN DE LA TIENDA — lo único que hace falta tocar
   Los productos y las PCs armadas se editan desde admin.html
   ========================================================= */
window.TW_CONFIG = {
  negocio: {
    nombre: "Titanware",
    // WhatsApp: código de país + área + número, sin "+", espacios ni 15
    whatsapp: "5491166811031",
    whatsappVisible: "+54 9 11 6681-1031",
    instagram: "titanwareok",
    facebook: "https://www.facebook.com/marketplace/profile/61587365600129/",
    ubicacion: "San Francisco Solano, Buenos Aires",
  },

  // Repositorio de GitHub donde vive la página (lo usa el panel admin para publicar cambios)
  github: {
    owner: "TitanwareADMIN",
    repo: "titanware-catalogo",
    branch: "main",
  },

  // Categorías del catálogo, en el orden en que se muestran
  categorias: ["Motherboards", "Procesadores", "Coolers", "Memorias RAM", "Almacenamientos", "Fuentes de poder", "Placas de video", "Gabinetes", "Periféricos"],

  // Categorías de las PCs armadas
  categoriasPC: ["Gamer", "Hogar / Oficina", "Workstation"],
};
