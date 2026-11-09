// Constantes del negocio. Ningún dato secreto va en este archivo.
// RNF-08: zonas, categorías y días se definen aquí como listas; para agregar una zona
// o categoría basta con sumarla aquí y en la restricción check de supabase/schema.sql.

export const CONFIG = Object.freeze({
  NOMBRE: 'Ruta 18',
  ESLOGAN: 'Hamburguesas · Sushi · Platos a la carta',
  DIRECCION: 'Cra. 18 #11-34, Bucaramanga, Santander',
  TELEFONO: '313 491 4296',            // tomado del mockup del documento, confirmar
  WHATSAPP_URL: 'https://wa.me/573134914296',
  INSTAGRAM_URL: '',                   // pendiente
  FACEBOOK_URL: '',                    // pendiente
  ZONA_HORARIA: 'America/Bogota',
  INTERVALO_SLOT_MIN: 30,              // RF-04: las franjas inician cada 30 minutos
  DIAS_MAXIMOS_RESERVA: 30,            // RF-03: se reserva desde hoy hasta hoy + 30 días
  RESERVAS_POR_PAGINA: 10,             // RF-12: paginación del panel
  ADMIN_EMAIL: 'admin@ruta18.app',     // RF-08: el mismo correo creado en Supabase Auth
  ZONAS: Object.freeze({ terraza: 'Terraza', salon: 'Salón' }),
  CATEGORIAS: Object.freeze({
    hamburguesas: 'Hamburguesas',
    sushi: 'Sushi',
    platos: 'Platos a la carta',
    bebidas: 'Bebidas'
  }),
  // Orden de Date.getDay(): 0 = domingo. Sin tildes, igual que en la base de datos.
  DIAS: Object.freeze(['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']),
  DIAS_ETIQUETA: Object.freeze({
    lunes: 'Lunes',
    martes: 'Martes',
    miercoles: 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes',
    sabado: 'Sábado',
    domingo: 'Domingo'
  })
});
